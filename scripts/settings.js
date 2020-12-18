"use strict";

import { remote, app } from 'electron'
export const settings = require('electron-settings');

import fs from 'fs'
import path from 'path'

function settings_old_path() {
  // Path used for settings
  const defaultSettingsFileName = 'Settings';
  const _app = app || remote.app;
  const userDataPath = _app.getPath('userData');
  const defaultSettingsFilePath = path.join(userDataPath, defaultSettingsFileName);
  return defaultSettingsFilePath;
}

export var program_settings = null

const default_safety_link_rules = [
  /^\w+:>\w+:$/,           // no safetyclass -> no safetyclass
  /^\w+:QM>\w+:$/,         // QM -> no safetyclass
  /^\w+:SIL-2>\w+:$/,      // SIL-2 -> no safetyclass
  /^\w+:QM>\w+:QM$/,       // QM -> QM
  /^\w+:SIL-2>\w+:QM$/,    // SIL-2 -> QM
  /^\w+:SIL-2>\w+:SIL-2$/, // SIL-2 -> SIL-2
  /^impl.*>.*$/,           // impl can cover anything (maybe?)
  /^swintts.*>.*$/,        // swintts can cover anything (maybe?)
  /^swuts.*>.*$/           // swuts can cover anything (maybe?)
];

/**
 *
 * @param {function} settings_updated_callback - callback to put new settings into effect
 */
export function handle_settings(settings_updated_callback) {
  if (settings.has('program_settings')) {
    // Upgrade settings to add new values
    //console.log(settings._getSettingsFilePath())
    program_settings = settings.get('program_settings')
    //console.log(program_settings)
    // New options are added here with default values when reading settings from previous version
    if (! ('max_calc_nodes' in program_settings)) {
      program_settings.max_calc_nodes = 1000;
    }
    if (! ('show_coverage' in program_settings) || (typeof(program_settings.show_coverage) !== 'boolean')) {
      program_settings.show_coverage = false;
    }
    if (! ('top_doctypes' in program_settings)) {
      program_settings.top_doctypes = ['reqspec1'];
    }
    if (! ('color_status' in program_settings) || (typeof(program_settings.color_status) !== 'boolean')) {
      program_settings.color_status = false;
    }
    if (! ('show_errors' in program_settings) || (typeof(program_settings.show_errors) !== 'boolean')) {
      program_settings.show_errors = true;
    }
    if (! ('check_for_updates' in program_settings) || (typeof(program_settings.check_for_updates) !== 'boolean')) {
      program_settings.check_for_updates = true;
    }
    if (! ('safety_link_rules' in program_settings)) {
      program_settings.safety_link_rules = default_safety_link_rules;
    }
  } else {
    // Establish default settings
    program_settings = {
      compare_fields: {
        id: true,
        comment: true,
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
      show_coverage: false,
      top_doctypes: ['reqspec1'],
      color_status: false,
      show_errors: true,
      check_for_updates: true,
      safety_link_rules: default_safety_link_rules
    }
    settings.set('program_settings', program_settings, {prettify: true})
  }
  //console.log(program_settings)
  settings_dialog_prepare()

  document.getElementById('sett_ok').addEventListener("click", function() {
    if (settings_dialog_results()) {
      settings_updated_callback()
      settingsPopup.style.display = "none";
    } else {
      // settingsPopup.style.display = "none";
      // setTimeout(function() {
      //   settingsPopup.style.display = "block";
      // }, 0)
    }
  });

  document.getElementById('sett_cancel').addEventListener("click", function() {
    settingsPopup.style.display = "none";
  });
}

const defined_specobject_fields = [
  'id',
  'comment',
  'dependson',
  'description',
  'doctype',
  'fulfilledby',
  'furtherinfo',
  'linksto',
  'needsobj',
  'platform',
  'rationale',
  'safetyclass',
  'safetyrationale',
  'shortdesc',
  'source',
  'sourcefile',
  'sourceline',
  'status',
  'tags',
  'usecase',
  'verifycrit',
  'version',
  'violations'
];

function add_fields_to_dialog() {
  let field_div = document.getElementById('ignore_fields')
  let fields = ''
  for (let f_name of defined_specobject_fields) {
    let row = `  <input type="checkbox" id="sett_ignore_${f_name}" title="Ignore differences of ${f_name}"> ${f_name}</button><br/>\n`
    fields += row
  }
  field_div.innerHTML = fields
}

export function open_settings() {
  settings_dialog_prepare()
  settingsPopup.style.display = "block";
}

function settings_dialog_prepare() {
  // Add the needed checkboxes
  add_fields_to_dialog()
  document.getElementById('regex_error').innerHTML = ""
  // Set the checkboxes to reflect program_settings.compare_fields object
  for (let field of defined_specobject_fields) {
    let dom_id = "sett_ignore_{}".format(field)
    let box = document.getElementById(dom_id)
    //console.log(field, dom_id, box, program_settings.compare_fields[field])
    if (box && (typeof(program_settings.compare_fields[field])!=='undefined')) {
      box.checked = !program_settings.compare_fields[field]
    }
  }
  document.getElementById('sett_show_coverage').checked = program_settings.show_coverage
  document.getElementById('sett_color_status').checked = program_settings.color_status
  document.getElementById('sett_show_errors').checked = program_settings.show_errors
  document.getElementById('sett_check_for_updates').checked = program_settings.check_for_updates
  let box = document.getElementById('sett_max_calc_nodes')
  if (box) {
    //console.log(program_settings.max_calc_nodes)
    if (!program_settings.max_calc_nodes) {
      program_settings.max_calc_nodes = 1000
    }
    box.value = program_settings.max_calc_nodes.toString()
  }
  box = document.getElementById('top_doctypes')
  if (box) {
    //console.log(program_settings.max_calc_nodes)
    box.value = program_settings.top_doctypes.join(',')
  }
  document.getElementById('safety_rules').value = JSON.stringify(program_settings.safety_link_rules, 0, 2)
}

/**
 * Check if new settings are valid
 * 
 * @return {boolean} - true if valid
 */
function settings_dialog_results() {
  // Set program_settings.compare_fields object according to the checkboxes
  document.getElementById('regex_error').innerHTML = ""
  for (let field of defined_specobject_fields) {
    let dom_id = "sett_ignore_{}".format(field)
    let box = document.getElementById(dom_id)
    //console.log(field, dom_id, box, program_settings.compare_fields[field])
    if (box) {
      program_settings.compare_fields[field] = !box.checked
    }
  }
  program_settings.show_coverage     = document.getElementById('sett_show_coverage').checked
  program_settings.color_status      = document.getElementById('sett_color_status').checked
  program_settings.show_errors       = document.getElementById('sett_show_errors').checked
  program_settings.check_for_updates = document.getElementById('sett_check_for_updates').checked
  program_settings.max_calc_nodes    = parseInt(document.getElementById('sett_max_calc_nodes').value)
  program_settings.top_doctypes      = document.getElementById('top_doctypes').value.split(",")
  console.log(program_settings)
  try {
    let new_safety_rules = JSON.parse(document.getElementById('safety_rules').value)
    let result = process_rule_set(new_safety_rules)
    if (result.pass) {
      return true
    } else {
      document.getElementById('regex_error').innerHTML = result.error
      setTimeout(function(){document.getElementById('safety_rules').focus();}, 1);
    }
  } catch(e) {
    document.getElementById('regex_error').innerHTML = e
    //alert(e)
  }
  remote.getCurrentWindow().focus()
  //document.getElementById('safety_rules').readOnly = "false"
  return false
}

export function get_ignored_fields() {
  // return a list of fields to ignore
  let ignore = []
  for (let field of defined_specobject_fields) {
    if (!program_settings.compare_fields[field]) {
      ignore.push(field)
    }
  }
  return ignore
}

/**
 * Check if this looks like a plausible arrays of regex.
 * Update settings if found OK and return status.
 * @param {string} new_rules - json array of regex strings
 * 
 * @return {boolean} - true if it seems good
 */
function process_rule_set(new_rules) {
  let regex_array = []
  let result = {
    pass: true,
    error: ''
  }
  if (new_rules.length > 0) {
    for (let rule of new_rules) {
      if (!(typeof(rule)==='string')) {
        result.error = 'Expected an array of rule regex strings'
        result.pass = false
        //alert('Expected an array of rule regex strings')
        break;
      }
      if (!rule.includes('>')) {
        result.error = 'Expected ">" in regex "{}"'.format(rule)
        result.pass = false
        //alert('Expected ">" in regex "{}"'.format(rule))
        //console.log('Expected ">" in regex "{}"'.format(rule))
        break
      }
      let regex_rule
      try {
        regex_rule = new RegExp(rule)
      }
      catch(err) {
        result.error = 'Malformed regex: {}'.format(err.message)
        result.pass = false
        //alert('Malformed regex: {}'.format(err.message))
        break
      }
      regex_array.push(regex_rule)
    }
    if (result.pass) {
      // Update tests
      program_settings.safety_link_rules = regex_array
      //console.log(program_settings.safety_link_rules)
      settings.set('program_settings', program_settings, {prettify: true})
    }
  } else {
     //alert('Expected array of rule regex strings')
     result.error = 'Expected array of rule regex strings'
     result.pass = false
  }
  return result
}

export function load_safety_rules_fs() {
  let LoadPath = remote.dialog.showOpenDialogSync(
    {
      filters: [{ name: 'JSON files', extensions: ['json']}],
      properties: ['openFile']
    })
  if (typeof(LoadPath) !== 'undefined' && (LoadPath.length === 1)) {
    let new_rules = JSON.parse(fs.readFileSync(LoadPath[0], {encoding: 'utf8', flag: 'r'}))
    let result = process_rule_set(new_rules)
    if (!result.pass) {
      alert(result.error)
    }
  }
}
