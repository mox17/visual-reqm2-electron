"use strict";
import { remote } from 'electron';
import { defined_specobject_fields, program_settings, check_and_upgrade_settings } from './settings.js';
import { update_color_settings } from './color.js';
import fs from 'fs';
export const settings = require('electron-settings');

/**
 * Sets the settings directory and settings filename.
 * Directory is expected to exist.
 * @param {string} pathname 
 */
export function set_settings_path(pathname) {
  if (pathname.includes('\\')) {
    pathname.replace('\\', '/')
  }
  let basename = new String(pathname).substring(pathname.lastIndexOf('/') + 1);
  let path = new String(pathname).substring(0, pathname.lastIndexOf('/') + 1);
  if (path.endsWith('/')) {
    path = path.substring(0, path.length);
  }
  console.log(path, basename);
  //settings.configure({ dir: path, file: basename })
}

/**
 * Read setting from electron-settings interface and check for data elements.
 * @param {function} settings_updated_callback callback to put new settings into effect
 */
export function handle_settings(settings_updated_callback) {
  //rq: ->(rq_settings_file)
  //settings.configure({ prettify: true, numSpaces: 2 })
  let doctype_colors = null;
  if (settings.has('doctype_colors')) {
    doctype_colors = settings.get('doctype_colors');
  }
  update_color_settings(doctype_colors, update_doctype_colors)
  let prog_settings = null;
  if (settings.has('program_settings')) {
    // Upgrade settings to add new values
    // console.log(settings._getSettingsFilePath());
    prog_settings = settings.get('program_settings');
  }
  let updated = check_and_upgrade_settings(prog_settings);
  if (updated) {
    settings.set('program_settings', program_settings, {prettify: true});
  }
  //console.log(program_settings);

  document.getElementById('sett_ok').addEventListener("click", function() {
    if (settings_dialog_results()) {
      settings_updated_callback();
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

  settings_dialog_prepare();
}

/**
 * The list of fields to ignore is dynamically defined as a list of tags.
 * Add checkboxes for each of these tags.
 */
function add_fields_to_dialog() {
  let field_div = document.getElementById('ignore_fields');
  let fields = '';
  for (let f_name of defined_specobject_fields) {
    let row = `  <input type="checkbox" id="sett_ignore_${f_name}" title="Ignore differences of ${f_name}"> ${f_name}</button><br/>\n`;
    fields += row;
  }
  field_div.innerHTML = fields;
}

/**
 * Populate html and make settings modal visible
 */
export function open_settings() {
  settings_dialog_prepare();
  settingsPopup.style.display = "block";
}

/**
 * Update html elements to reflect the values of the settings
 */
function settings_dialog_prepare() {
  // Add the needed checkboxes
  add_fields_to_dialog();
  document.getElementById('regex_error').innerHTML = "";
  // Set the checkboxes to reflect program_settings.compare_fields object
  for (let field of defined_specobject_fields) {
    let dom_id = `sett_ignore_${field}`;
    let box = document.getElementById(dom_id);
    //console.log(field, dom_id, box, program_settings.compare_fields[field])
    if (box && (typeof(program_settings.compare_fields[field])!=='undefined')) {
      box.checked = !program_settings.compare_fields[field];
    }
  }
  document.getElementById('sett_show_coverage').checked = program_settings.show_coverage;
  document.getElementById('sett_color_status').checked = program_settings.color_status;
  document.getElementById('sett_show_errors').checked = program_settings.show_errors;
  document.getElementById('sett_check_for_updates').checked = program_settings.check_for_updates;
  let box = document.getElementById('sett_max_calc_nodes');
  if (box) {
    //rq: ->(rq_config_node_limit)
    //console.log(program_settings.max_calc_nodes)
    if (!program_settings.max_calc_nodes) {
      program_settings.max_calc_nodes = 1000;
    }
    box.value = program_settings.max_calc_nodes.toString();
  }
  box = document.getElementById('top_doctypes');
  if (box) {
    //console.log(program_settings.max_calc_nodes);
    box.value = program_settings.top_doctypes.join(',');
  }
  document.getElementById('safety_rules').value = JSON.stringify(program_settings.safety_link_rules, 0, 2);
}

/**
 * Check if new settings are valid
 * @return {boolean} true if valid
 */
function settings_dialog_results() {
  // Set program_settings.compare_fields object according to the checkboxes
  document.getElementById('regex_error').innerHTML = ""
  for (let field of defined_specobject_fields) {
    let dom_id = `sett_ignore_${field}`
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
  //console.log(program_settings)
  try {
    //rq: ->(rq_safety_rules_config)
    let new_safety_rules = JSON.parse(document.getElementById('safety_rules').value)
    let result = process_rule_set(new_safety_rules)
    if (result.pass) {
      return true
    } else {
      document.getElementById('regex_error').innerHTML = result.error
      setTimeout(function(){document.getElementById('safety_rules').focus();}, 1);
    }
  } catch(e) {
    document.getElementById('regex_error').innerHTML = e;
    //alert(e)
  }
  remote.getCurrentWindow().focus()
  //document.getElementById('safety_rules').readOnly = "false"
  return false
}

/**
 * User file selector for 'safety' rules, possibly showing alert
 */
export function load_safety_rules_fs() {
  //rq: ->(rq_safety_rules_import)
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

/**
 * Check if this looks like a plausible arrays of regex.
 * Update settings if found OK and return status.
 * @param {string} new_rules json array of regex strings
 * @return {boolean} true if it seems good
 */
export function process_rule_set(new_rules) {
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
        result.error = `Expected ">" in regex "${rule}"`
        result.pass = false
        break
      }
      let regex_rule
      try {
        regex_rule = new RegExp(rule)
      }
      catch(err) {
        result.error = `Malformed regex: ${err.message}`
        result.pass = false
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

/**
 * Callback function to update doctype color mappings
 * @param {dict} colors mapping from doctypes to colors
 */
function update_doctype_colors(colors) {
  //rq: ->(rq_doctype_color_sett)
  settings.set('doctype_colors', colors, {prettify: true})
}
