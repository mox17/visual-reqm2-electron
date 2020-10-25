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

/**
 *
 * @param {function} settings_updated_callback - callback to put new settings into effect
 */
export function handle_settings(settings_updated_callback) {
  if (settings.has('program_settings')) {
    //console.log(settings._getSettingsFilePath())
    program_settings = settings.get('program_settings')
    // New options are added here with default values when reading settings from previous version
    if (! ('max_calc_nodes' in program_settings)) {
      program_settings.max_calc_nodes = 1000;
    }
    if (! ('show_coverage' in program_settings)) {
      program_settings.show_coverage = false;
    }
    if (! ('top_doctypes' in program_settings)) {
      program_settings.top_doctypes = ['reqspec1'];
    }
    if (! ('color_status' in program_settings)) {
      program_settings.color_status = false;
    }
    if (! ('show_errors' in program_settings)) {
      program_settings.show_errors = true;
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
      show_errors: true
    }
    settings.set('program_settings', program_settings)
  }
  //console.log(program_settings)
  settings_dialog_prepare()

  document.getElementById('sett_ok').addEventListener("click", function() {
    settings_dialog_results();
    settings_updated_callback()
    settingsPopup.style.display = "none";
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

function settings_dialog_prepare() {
  // Add the needed checkboxes
  add_fields_to_dialog()
  // Set the checkboxes to reflect program_settings.compare_fields object
  for (let field of defined_specobject_fields) {
    let dom_id = "sett_ignore_{}".format(field)
    let box = document.getElementById(dom_id)
    //console.log(field, dom_id, box, program_settings.compare_fields[field])
    if (box && (typeof(program_settings.compare_fields[field])!=='undefined')) {
      box.checked = !program_settings.compare_fields[field]
    }
  }
  let box = document.getElementById('sett_show_coverage')
  if (box) {
    box.checked = program_settings.show_coverage
  }
  box = document.getElementById('sett_color_status')
  if (box) {
    box.checked = program_settings.color_status
  }
  box = document.getElementById('sett_max_calc_nodes')
  if (box) {
    //console.log(program_settings.max_calc_nodes)
    box.value = program_settings.max_calc_nodes.toString()
  }
  box = document.getElementById('top_doctypes')
  if (box) {
    //console.log(program_settings.max_calc_nodes)
    box.value = program_settings.top_doctypes.join(',')
  }
}

function settings_dialog_results() {
  // Set program_settings.compare_fields object according to the checkboxes
  for (let field of defined_specobject_fields) {
    let dom_id = "sett_ignore_{}".format(field)
    let box = document.getElementById(dom_id)
    //console.log(field, dom_id, box, program_settings.compare_fields[field])
    if (box) {
      program_settings.compare_fields[field] = !box.checked
    }
  }
  let box = document.getElementById('sett_show_coverage')
  program_settings.show_coverage = box.checked
  box = document.getElementById('sett_color_status')
  program_settings.color_status = box.checked
  box = document.getElementById('sett_show_errors')
  program_settings.show_errors = box.checked
  box = document.getElementById('sett_max_calc_nodes')
  program_settings.max_calc_nodes = parseInt(box.value)
  box = document.getElementById('top_doctypes')
  program_settings.top_doctypes = box.value.split(",")
  //console.log(program_settings.top_doctypes)
  settings.set('program_settings', program_settings)
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
