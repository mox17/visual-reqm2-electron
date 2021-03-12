'use strict'

/** This is the settings object. Update or initialize with check_and_upgrade_settings() */
export let program_settings = null

export const default_program_settings = {
  compare_fields: {
    id: true,
    comment: true,
    covstatus: true,
    dependson: true,
    description: true,
    doctype: true,
    fulfilledby: true,
    furtherinfo: true,
    linksto: true,
    needsobj: true,
    platform: true,
    rationale: true,
    safetyclass: true,
    safetyrationale: true,
    shortdesc: true,
    source: true,
    sourcefile: false,
    sourceline: false,
    status: true,
    tags: true,
    usecase: true,
    verifycrit: true,
    version: true,
    violations: false
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
  ]
}

/** These are data fields used from the specobject, plus a pseudo field (see below) */
export const defined_specobject_fields = Object.keys(default_program_settings.compare_fields)

/**
 * Handle settings data, migrate old data and add new fields
 * @param {object} sett_data Initial settings, typically extracted from storage or provided from test harness
 * @return {boolean} true: settings were modified, false: no modification
 */
export function check_and_upgrade_settings (sett_data) {
  let modified = false
  if (sett_data && (typeof sett_data === 'object')) {
    program_settings = sett_data
    // New options are added here with default values when reading settings from previous version
    if (!('compare_fields' in program_settings)) {
      program_settings.compare_fields = default_program_settings.compare_fields
      modified = true
    }
    if (!('max_calc_nodes' in program_settings)) {
      program_settings.max_calc_nodes = default_program_settings.max_calc_nodes
      modified = true
    }
    if (!('show_coverage' in program_settings) || (typeof (program_settings.show_coverage) !== 'boolean')) {
      program_settings.show_coverage = default_program_settings.show_coverage
      modified = true
    }
    if (!('top_doctypes' in program_settings)) {
      program_settings.top_doctypes = default_program_settings.top_doctypes
      modified = true
    }
    if (!('color_status' in program_settings) || (typeof (program_settings.color_status) !== 'boolean')) {
      program_settings.color_status = default_program_settings.color_status
      modified = true
    }
    if (!('show_errors' in program_settings) || (typeof (program_settings.show_errors) !== 'boolean')) {
      program_settings.show_errors = default_program_settings.show_errors
      modified = true
    }
    if (!('check_for_updates' in program_settings) || (typeof (program_settings.check_for_updates) !== 'boolean')) {
      program_settings.check_for_updates = default_program_settings.check_for_updates
      modified = true
    }
    if (!('safety_link_rules' in program_settings)) {
      program_settings.safety_link_rules = default_program_settings.safety_link_rules
      modified = true
    }
  } else {
    // Establish default settings
    program_settings = default_program_settings
    modified = true
  }
  return modified
}

/**
 * Return a list of the tags to ignore when comparing specobjects
 * @return {string[]} List of tag names
 */
export function get_ignored_fields () {
  // return a list of fields to ignore
  //rq: ->(rq_tag_ignore_diff)
  const ignore = []
  for (const field of defined_specobject_fields) {
    if (!program_settings.compare_fields[field]) {
      ignore.push(field)
    }
  }
  return ignore
}
