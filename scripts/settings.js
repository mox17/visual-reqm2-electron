'use strict'

/** This is the settings object. Update or initialize with checkAndUpgradeSettings() */
export let programSettings = null

export const defaultProgramSettings = {
  compare_fields: {
    id: true,
    comment: true,
    covstatus: false, // generated
    dependson: true, // list
    description: true,
    doctype: true,
    fulfilledby: true,
    furtherinfo: true,
    linksto: true, // list
    needsobj: true, // list
    platform: true, // list
    rationale: true,
    safetyclass: true,
    safetyrationale: true,
    shortdesc: true,
    source: true,
    sourcefile: false,
    sourceline: false,
    sourcerevision: true,
    creationdate: true,
    category: true,
    priority: true,
    securityclass: true,
    securityrationale: true,
    verifymethods: true, // list
    verifycond: true,
    testin: true,
    testexec: true,
    testout: true,
    testpasscrit: true,
    releases: true, // list
    conflicts: true, // list
    status: true,
    tags: true, // list
    usecase: true,
    verifycrit: true,
    version: true,
    violations: false, // list
    errors: false, // list
    ffberrors: false, // list
    miscov: false // list
  },
  max_calc_nodes: 1000,
  show_coverage: true,
  top_doctypes: [],
  color_status: true,
  show_errors: true,
  check_for_updates: true,
  safety_link_rules: [
    '^\\w+:>\\w+:$', // no safetyclass -> no safetyclass
    '^\\w+:QM>\\w+:$', // QM -> no safetyclass
    '^\\w+:SIL-2>\\w+:$', // SIL-2 -> no safetyclass
    '^\\w+:QM>\\w+:QM$', // QM -> QM
    '^\\w+:SIL-2>\\w+:QM$', // SIL-2 -> QM
    '^\\w+:SIL-2>\\w+:SIL-2$', // SIL-2 -> SIL-2
    '^impl.*>.*$', // impl can cover anything (maybe?)
    '^swintts.*>.*$', // swintts can cover anything (maybe?)
    '^swuts.*>.*$' // swuts can cover anything (maybe?)
  ],
  search_language: 'vql'
}

/** These are data fields used from the specobject, plus a pseudo field (see below) */
export const definedSpecobjectFields = Object.keys(defaultProgramSettings.compare_fields)

/**
 * Handle settings data, migrate old data and add new fields
 * @param {object} settData Initial settings, typically extracted from storage or provided from test harness
 * @return {boolean} true: settings were modified, false: no modification
 */
export function checkAndUpgradeSettings (settData) {
  let modified = false
  if (settData && (typeof settData === 'object')) {
    programSettings = settData
    // New options are added here with default values when reading settings from previous version
    if (!('compare_fields' in programSettings)) {
      programSettings.compare_fields = defaultProgramSettings.compare_fields
      modified = true
    }
    if (!('max_calc_nodes' in programSettings)) {
      programSettings.max_calc_nodes = defaultProgramSettings.max_calc_nodes
      modified = true
    }
    if (!('show_coverage' in programSettings) || (typeof (programSettings.show_coverage) !== 'boolean')) {
      programSettings.show_coverage = defaultProgramSettings.show_coverage
      modified = true
    }
    if (!('top_doctypes' in programSettings)) {
      programSettings.top_doctypes = defaultProgramSettings.top_doctypes
      modified = true
    }
    if (!('color_status' in programSettings) || (typeof (programSettings.color_status) !== 'boolean')) {
      programSettings.color_status = defaultProgramSettings.color_status
      modified = true
    }
    if (!('show_errors' in programSettings) || (typeof (programSettings.show_errors) !== 'boolean')) {
      programSettings.show_errors = defaultProgramSettings.show_errors
      modified = true
    }
    if (!('check_for_updates' in programSettings) || (typeof (programSettings.check_for_updates) !== 'boolean')) {
      programSettings.check_for_updates = defaultProgramSettings.check_for_updates
      modified = true
    }
    if (!('safety_link_rules' in programSettings)) {
      programSettings.safety_link_rules = defaultProgramSettings.safety_link_rules
      modified = true
    }
    if (!('search_language' in programSettings)) {
      programSettings.search_language = defaultProgramSettings.search_language
      modified = true
    }
  } else {
    // Establish default settings
    programSettings = defaultProgramSettings
    modified = true
  }
  return modified
}

/**
 * Return a list of the tags to ignore when comparing specobjects
 * @return {string[]} List of tag names
 */
export function getIgnoredFields () {
  // return a list of fields to ignore
  //rq: ->(rq_tag_ignore_diff)
  const ignore = []
  for (const field of definedSpecobjectFields) {
    if (!programSettings.compare_fields[field]) {
      ignore.push(field)
    }
  }
  return ignore
}
