'use strict'
// eslint-disable-next-line no-redeclare
/* global alert */
import { remote } from 'electron'
import { defined_specobject_fields, program_settings, check_and_upgrade_settings } from './settings.js'
import { update_color_settings } from './color.js'
import fs from 'fs'
import { settings_configure } from './settings_helper.js'
const electron_settings = require('electron-settings')

/**
 * Read setting from electron-settings interface and check for data elements.
 * @param {function} settings_updated_callback callback to put new settings into effect
 */
export function handle_settings (settings_updated_callback, args) {
  //rq: ->(rq_settings_file)
  // console.log("Settings default file:", electron_settings.file())
  settings_configure(electron_settings, args.settDir, args.settFile)
  const settings_file = electron_settings.file()
  const settingsPopup = document.getElementById('settingsPopup')

  document.getElementById('settings_file_path').innerHTML = settings_file

  let doctype_colors = null
  // console.dir(settings)
  if (electron_settings.hasSync('doctype_colors')) {
    doctype_colors = electron_settings.getSync('doctype_colors')
  }
  update_color_settings(doctype_colors, update_doctype_colors)
  let prog_settings = null
  if (electron_settings.hasSync('program_settings')) {
    // Upgrade settings to add new values
    // console.log(settings._getSettingsFilePath());
    prog_settings = electron_settings.getSync('program_settings')
  }
  const updated = check_and_upgrade_settings(prog_settings)
  if (updated) {
    electron_settings.setSync('program_settings', program_settings)
  }
  // console.log(program_settings);

  document.getElementById('sett_ok').addEventListener('click', function () {
    if (settings_dialog_results()) {
      settings_updated_callback()
      settingsPopup.style.display = 'none'
    } else {
      // settingsPopup.style.display = "none";
      // setTimeout(function() {
      //   settingsPopup.style.display = "block";
      // }, 0)
    }
  })

  document.getElementById('sett_cancel').addEventListener('click', function () {
    settingsPopup.style.display = 'none'
  })

  settings_dialog_prepare()
}

/**
 * The list of fields to ignore is dynamically defined as a list of tags.
 * Add checkboxes for each of these tags.
 */
function add_fields_to_dialog () {
  const field_div = document.getElementById('ignore_fields')
  let fields = ''
  for (const f_name of defined_specobject_fields) {
    const row = `  <input type="checkbox" id="sett_ignore_${f_name}" title="Ignore differences of ${f_name}"> ${f_name}</button><br/>\n`
    fields += row
  }
  field_div.innerHTML = fields
}

/**
 * Populate html and make settings modal visible
 */
export function open_settings () {
  const settingsPopup = document.getElementById('settingsPopup')
  settings_dialog_prepare()
  settingsPopup.style.display = 'block'
}

/**
 * Update html elements to reflect the values of the settings
 */
function settings_dialog_prepare () {
  // Add the needed checkboxes
  add_fields_to_dialog()
  document.getElementById('regex_error').innerHTML = ''
  // Set the checkboxes to reflect program_settings.compare_fields object
  for (const field of defined_specobject_fields) {
    const dom_id = `sett_ignore_${field}`
    const box = document.getElementById(dom_id)
    // console.log(field, dom_id, box, program_settings.compare_fields[field])
    if (box && (typeof (program_settings.compare_fields[field]) !== 'undefined')) {
      box.checked = !program_settings.compare_fields[field]
    }
  }
  document.getElementById('sett_show_coverage').checked = program_settings.show_coverage
  document.getElementById('sett_color_status').checked = program_settings.color_status
  document.getElementById('sett_show_errors').checked = program_settings.show_errors
  document.getElementById('sett_check_for_updates').checked = program_settings.check_for_updates
  let box = document.getElementById('sett_max_calc_nodes')
  if (box) {
    //rq: ->(rq_config_node_limit)
    // console.log(program_settings.max_calc_nodes)
    if (!program_settings.max_calc_nodes) {
      program_settings.max_calc_nodes = 1000
    }
    box.value = program_settings.max_calc_nodes.toString()
  }
  box = document.getElementById('top_doctypes')
  if (box) {
    // console.log(program_settings.max_calc_nodes);
    box.value = program_settings.top_doctypes.join(',')
  }
  document.getElementById('safety_rules').value = JSON.stringify(program_settings.safety_link_rules, null, 2)
}

/**
 * Check if new settings are valid
 * @return {boolean} true if valid
 */
function settings_dialog_results () {
  // Set program_settings.compare_fields object according to the checkboxes
  document.getElementById('regex_error').innerHTML = ''
  for (const field of defined_specobject_fields) {
    const dom_id = `sett_ignore_${field}`
    const box = document.getElementById(dom_id)
    // console.log(field, dom_id, box, program_settings.compare_fields[field])
    if (box) {
      program_settings.compare_fields[field] = !box.checked
    }
  }
  program_settings.show_coverage = document.getElementById('sett_show_coverage').checked
  program_settings.color_status = document.getElementById('sett_color_status').checked
  program_settings.show_errors = document.getElementById('sett_show_errors').checked
  program_settings.check_for_updates = document.getElementById('sett_check_for_updates').checked
  program_settings.max_calc_nodes = parseInt(document.getElementById('sett_max_calc_nodes').value)
  program_settings.top_doctypes = document.getElementById('top_doctypes').value.split(',')
  // console.log(program_settings)
  try {
    //rq: ->(rq_safety_rules_config)
    const new_rules = document.getElementById('safety_rules').value
    // alert(new_rules)
    const new_safety_rules = JSON.parse(new_rules)
    const result = process_rule_set(new_safety_rules)
    if (result.pass) {
      // alert(JSON.stringify(new_safety_rules) );
      program_settings.safety_link_rules = new_safety_rules
      electron_settings.setSync('program_settings', program_settings)
      return true
    } else {
      document.getElementById('regex_error').innerHTML = result.error
      setTimeout(function () { document.getElementById('safety_rules').focus() }, 1)
    }
  } catch (e) {
    document.getElementById('regex_error').innerHTML = e
    // alert(e)
  }
  remote.getCurrentWindow().focus()
  // document.getElementById('safety_rules').readOnly = "false"
  return false
}

/**
 * Save settings in file
 */
export function save_program_settings() {
  electron_settings.setSync('program_settings', program_settings)
}
/**
 * User file selector for 'safety' rules, possibly showing alert
 */
export function load_safety_rules_fs () {
  //rq: ->(rq_safety_rules_import)
  const LoadPath = remote.dialog.showOpenDialogSync(
    {
      filters: [{ name: 'JSON files', extensions: ['json'] }],
      properties: ['openFile']
    })
  if (typeof (LoadPath) !== 'undefined' && (LoadPath.length === 1)) {
    const new_rules = JSON.parse(fs.readFileSync(LoadPath[0], { encoding: 'utf8', flag: 'r' }))
    const result = process_rule_set(new_rules)
    if (!result.pass) {
      alert(result.error)
    }
  }
}

/**
 * Check if this looks like a plausible array of regexes.
 * Update settings if found OK and return status.
 * @param {string} new_rules json array of regex strings
 * @return {boolean} true if it seems good
 */
export function process_rule_set (new_rules) {
  const regex_array = []
  const result = {
    pass: true,
    error: ''
  }
  if (new_rules.length > 0) {
    for (const rule of new_rules) {
      if (!(typeof (rule) === 'string')) {
        result.error = 'Expected an array of rule regex strings'
        result.pass = false
        // alert('Expected an array of rule regex strings')
        break
      }
      if (!rule.includes('>')) {
        result.error = `Expected ">" in regex "${rule}"`
        result.pass = false
        break
      }
      let regex_rule
      try {
        regex_rule = new RegExp(rule)
      } catch (err) {
        result.error = `Malformed regex: ${err.message}`
        result.pass = false
        break
      }
      regex_array.push(regex_rule)
    }
    if (result.pass) {
      result.regex_list = regex_array
    }
  } else {
    result.error = 'Expected array of rule regex strings'
    // alert(result.error)
    result.pass = false
  }
  return result
}

/**
 * Callback function to update doctype color mappings
 * @param {dict} colors mapping from doctypes to colors
 */
function update_doctype_colors (colors) {
  //rq: ->(rq_doctype_color_sett)
  electron_settings.setSync('doctype_colors', colors)
}
