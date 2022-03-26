'use strict'
// eslint-disable-next-line no-redeclare
import { remote } from 'electron'
import { definedSpecobjectFields, programSettings, checkAndUpgradeSettings } from './settings.js'
import { updateColorSettings } from './color.js'
import fs from 'fs'
import { settingsConfigure } from './settings_helper.js'
import { showAlert } from './util.js'
const electronSettings = require('electron-settings')

/**
 * Read setting from electron-settings interface and check for data elements.
 * @param {function} settingsUpdatedCallback callback to put new settings into effect
 */
export function handleSettings (settingsUpdatedCallback, args) {
  //rq: ->(rq_settings_file,rq_cl_settings_file)
  // console.log("Settings default file:", electron_settings.file())
  settingsConfigure(electronSettings, args.settDir, args.settFile)
  const settingsFile = electronSettings.file()
  const settingsPopup = document.getElementById('settingsPopup')

  document.getElementById('settings_file_path').innerHTML = settingsFile

  let doctypeColors = null
  // console.dir(settings)
  if (electronSettings.hasSync('doctype_colors')) {
    doctypeColors = electronSettings.getSync('doctype_colors')
  }
  updateColorSettings(doctypeColors, updateDoctypeColors)
  let progSettings = null
  if (electronSettings.hasSync('program_settings')) {
    // Upgrade settings to add new values
    // console.log(settings._getSettingsFilePath());
    progSettings = electronSettings.getSync('program_settings')
  }
  const updated = checkAndUpgradeSettings(progSettings)
  if (updated) {
    electronSettings.setSync('program_settings', programSettings)
  }
  // console.log(programSettings);

  document.getElementById('sett_ok').addEventListener('click', function () {
    if (settingsDialogResults()) {
      settingsUpdatedCallback()
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

  settingsDialogPrepare()
}

/**
 * The list of fields to ignore is dynamically defined as a list of tags.
 * Add checkboxes for each of these tags.
 */
function addFieldsToDialog () {
  const fieldDiv = document.getElementById('ignore_fields')
  let fields = ''
  for (const fName of definedSpecobjectFields) {
    const row = `  <input type="checkbox" id="sett_ignore_${fName}" title="Ignore differences of ${fName}"> ${fName}</button><br/>\n`
    fields += row
  }
  fieldDiv.innerHTML = fields
}

/**
 * Populate html and make settings modal visible
 */
export function openSettings () {
  const settingsPopup = document.getElementById('settingsPopup')
  settingsDialogPrepare()
  settingsPopup.style.display = 'block'
}

/**
 * Update html elements to reflect the values of the settings
 */
function settingsDialogPrepare () {
  // Add the needed checkboxes
  addFieldsToDialog()
  document.getElementById('regex_error').innerHTML = ''
  // Set the checkboxes to reflect programSettings.compare_fields object
  for (const field of definedSpecobjectFields) {
    const domId = `sett_ignore_${field}`
    const box = document.getElementById(domId)
    // console.log(field, dom_id, box, programSettings.compare_fields[field])
    if (box && (typeof (programSettings.compare_fields[field]) !== 'undefined')) {
      box.checked = !programSettings.compare_fields[field]
    }
  }
  document.getElementById('sett_show_coverage').checked = programSettings.show_coverage
  document.getElementById('sett_color_status').checked = programSettings.color_status
  document.getElementById('sett_show_errors').checked = programSettings.show_errors
  document.getElementById('sett_check_for_updates').checked = programSettings.check_for_updates
  let box = document.getElementById('sett_max_calc_nodes')
  //rq: ->(rq_config_node_limit)
  box.value = programSettings.max_calc_nodes.toString()
  box = document.getElementById('top_doctypes')
  box.value = programSettings.top_doctypes.join(',')
  document.getElementById('safety_rules').value = JSON.stringify(programSettings.safety_link_rules, null, 2)
}

/**
 * Check if new settings are valid
 * @return {boolean} true if valid
 */
function settingsDialogResults () {
  // Set programSettings.compare_fields object according to the checkboxes
  document.getElementById('regex_error').innerHTML = ''
  for (const field of definedSpecobjectFields) {
    const domId = `sett_ignore_${field}`
    const box = document.getElementById(domId)
    // console.log(field, dom_id, box, programSettings.compare_fields[field])
    programSettings.compare_fields[field] = !box.checked
  }
  programSettings.show_coverage = document.getElementById('sett_show_coverage').checked
  programSettings.color_status = document.getElementById('sett_color_status').checked
  programSettings.show_errors = document.getElementById('sett_show_errors').checked
  programSettings.check_for_updates = document.getElementById('sett_check_for_updates').checked
  programSettings.max_calc_nodes = parseInt(document.getElementById('sett_max_calc_nodes').value)
  programSettings.top_doctypes = document.getElementById('top_doctypes').value.split(',')
  // console.log(programSettings)
  try {
    //rq: ->(rq_safety_rules_config)
    const newRules = document.getElementById('safety_rules').value
    const newSafetyRules = JSON.parse(newRules)
    const result = processRuleSet(newSafetyRules)
    if (result.pass) {
      programSettings.safety_link_rules = newSafetyRules
      electronSettings.setSync('program_settings', programSettings)
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
export function saveProgramSettings () {
  electronSettings.setSync('program_settings', programSettings)
}
/**
 * User file selector for 'safety' rules, possibly showing alert
 */
export function loadSafetyRulesFs () {
  //rq: ->(rq_safety_rules_import)
  const LoadPath = remote.dialog.showOpenDialogSync(
    {
      filters: [{ name: 'JSON files', extensions: ['json'] }],
      properties: ['openFile']
    })
  if (typeof (LoadPath) !== 'undefined' && (LoadPath.length === 1)) {
    const newRules = JSON.parse(fs.readFileSync(LoadPath[0], { encoding: 'utf8', flag: 'r' }))
    const result = processRuleSet(newRules)
    if (!result.pass) {
      showAlert(result.error)
    }
  }
}

/**
 * Check if this looks like a plausible array of regexes.
 * Update settings if found OK and return status.
 * @param {string} newRules json array of regex strings
 * @return {boolean} true if it seems good
 */
export function processRuleSet (newRules) {
  const regexArray = []
  const result = {
    pass: true,
    error: ''
  }
  if (newRules.length > 0) {
    for (const rule of newRules) {
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
      let regexRule
      try {
        regexRule = new RegExp(rule)
      } catch (err) {
        result.error = `Malformed regex: ${err.message}`
        result.pass = false
        break
      }
      regexArray.push(regexRule)
    }
    if (result.pass) {
      result.regex_list = regexArray
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
function updateDoctypeColors (colors) {
  //rq: ->(rq_doctype_color_sett)
  electronSettings.setSync('doctype_colors', colors)
}


// spreadsheet export settings handling
