'use strict'
// eslint-disable-next-line no-redeclare
import { ipcRenderer } from 'electron'
import { definedSpecobjectFields, programSettings, checkAndUpgradeSettings } from './settings.js'
import { updateColorSettings } from './color.js'
import fs from 'fs'
import { showAlert } from './util.js'
import Sortable from 'sortablejs'

/**
 * Read setting from electron-settings interface and check for data elements.
 * @param {function} settingsUpdatedCallback callback to put new settings into effect
 */
export async function handleSettings (settingsUpdatedCallback) {
  //rq: ->(rq_settings_file,rq_cl_settings_file)
  const settingsFile = await ipcRenderer.invoke('settingsFile')
  const settingsPopup = document.getElementById('settingsPopup')

  document.getElementById('settings_file_path').innerHTML = settingsFile

  let doctypeColors = null
  if (await ipcRenderer.invoke('settingsHasSync', 'doctype_colors')) {
    doctypeColors = await ipcRenderer.invoke('settingsGetSync', 'doctype_colors')
  }
  updateColorSettings(doctypeColors, updateDoctypeColors)
  let progSettings = null
  if (await ipcRenderer.invoke('settingsHasSync', 'program_settings')) {
    // Upgrade settings to add new values
    progSettings = await ipcRenderer.invoke('settingsGetSync', 'program_settings')
  }
  const updated = checkAndUpgradeSettings(progSettings, doctypeColors)
  if (doctypeColors) {
    // doctype_colors have been migrated to doctype_attributes in program_settings
    await ipcRenderer.invoke('settingsUnsetSync', 'doctype_colors')
  }
  if (updated) {
    await ipcRenderer.invoke('settingsSetSync', 'program_settings', programSettings)
  }
  // console.log(programSettings);

  document.getElementById('sett_ok').addEventListener('click', async function () {
    if (await settingsDialogResults()) {
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
async function settingsDialogResults () {
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
      await ipcRenderer.invoke('settingsSetSync', 'program_settings', programSettings)
      return true
    } else {
      document.getElementById('regex_error').innerHTML = result.error
      setTimeout(function () { document.getElementById('safety_rules').focus() }, 1)
    }
  } catch (e) {
    document.getElementById('regex_error').innerHTML = e
    // alert(e)
  }
  await ipcRenderer.invoke('window.focus')
  // document.getElementById('safety_rules').readOnly = "false"
  return false
}

/**
 * Save settings in file
 */
export async function saveProgramSettings () {
  await ipcRenderer.invoke('settingsSetSync', 'program_settings', programSettings)
}
/**
 * User file selector for 'safety' rules, possibly showing alert
 */
export async function loadSafetyRulesFs () {
  //rq: ->(rq_safety_rules_import)
  const LoadPath = await ipcRenderer.invoke('dialog.showOpenDialogSync',
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
async function updateDoctypeColors (colors) {
  //rq: ->(rq_doctype_color_sett)
  await ipcRenderer.invoke('settingsSetSync', 'doctype_colors', colors)
}


// doctypes settings handling

document.getElementById('doctypeColorDialogOk').addEventListener('click', function () {
  document.getElementById('doctypeColorDialog').style.display = 'none'
  doctypesDialogSave()
})

document.getElementById('doctypeColorDialogCancel').addEventListener('click', function () {
  document.getElementById('doctypeColorDialog').style.display = 'none'
})

document.getElementById('doctypeColorDialogClose').addEventListener('click', function () {
  document.getElementById('doctypeColorDialog').style.display = 'none'
})

/**
 * Populate html and make settings modal visible
 * @param activeDoctypes set of doctypes used in current diagram
 */
 export function openDoctypes (activeDoctypes) {
  // save set for later use when saving
  document.__activeDoctypes__ = activeDoctypes
  const doctypesPopup = document.getElementById('doctypeColorDialog')
  const hideUnknown = true
  doctypesDialogPrepare(activeDoctypes, hideUnknown)
  document.getElementById('hide_unused_doctypes').onclick = () => {
    const hide = document.getElementById('hide_unused_doctypes').checked
    doctypesDialogPrepare(activeDoctypes, hide)
  }
  doctypesPopup.style.display = 'block'
}

/**
 * Set up doctype dialog for attribute editing
 * @param {Set} activeDoctypes The subset used in current diagram
 * @param {boolean} filter limit display to active doctypes
 */
 function doctypesDialogPrepare (activeDoctypes, filter) {
  document.getElementById('hide_unused_doctypes').checked = filter
  document.getElementById('doctype_clusters').checked = programSettings.doctype_clusters
  // initialize doctype table
  let table = '<ul id="doctype_attributes" class="doctype-attr-list col">\n'
  for (const dt of programSettings.doctype_attributes) {
    if (filter && (activeDoctypes != null) && !activeDoctypes.has(dt.doctype)) {
      continue
    }
    table += `\
  <li data-doctype="${dt.doctype}">
    <div id="dt_attr_${dt.doctype}" style="background-color:${dt.color}; display: inline-block; width:100%">
      <span style="width:30%;float:left;">&nbsp;${dt.doctype}</span>
      <span style="width:10%">
        <label for="color_${dt.doctype}">color:</label>
        <input type="color" id="color_${dt.doctype}" value="${dt.color}"></input>
      </span>
      <span style="float:right;">
        <input type="radio" name="v-model_${dt.doctype}" id="dt_dsgn_${dt.doctype}" value="design">design</input>
        <input type="radio" name="v-model_${dt.doctype}" id="dt_none_${dt.doctype}" value=""      >none</input>
        <input type="radio" name="v-model_${dt.doctype}" id="dt_test_${dt.doctype}" value="test"  >test&nbsp;</input>
      </span>
    </div>
  </li>\n`
  }
  table += '</ul>'
  //console.log(table)
  document.getElementById('doctypeColorDialogTable').innerHTML = table
  new Sortable(document.getElementById('doctype_attributes'), {
    group: 'doctypes',
    animation: 150,
    ghostClass: "placeholder"
  })

  // Update the elements using script
  for (const dt of programSettings.doctype_attributes) {
    // Check if list is filtered - doctype might not be shown
    if (!document.getElementById(`color_${dt.doctype}`)) {
      continue
    }
    document.getElementById(`color_${dt.doctype}`).onchange = () => {
      document.getElementById(`dt_attr_${dt.doctype}`).style.backgroundColor = document.getElementById(`color_${dt.doctype}`).value
    }
    switch (dt.cluster) {
    case "design":
      document.getElementById(`dt_dsgn_${dt.doctype}`).checked = true
      break

      case "test":
      document.getElementById(`dt_test_${dt.doctype}`).checked = true
      break

      case "":
    default:
      document.getElementById(`dt_none_${dt.doctype}`).checked = true
      break
    }
  }

}

/**
 * Helper function to find array positions related to a subset of doctypes
 * in array order
 * @param {Set} activeDoctypes
 * @returns index
 */
function firstOfSetIndex (activeDoctypes) {
  for (let index = 0; index < programSettings.doctype_attributes.length; ++index) {
    if (activeDoctypes.has(programSettings.doctype_attributes[index].doctype)) {
      return index
    }
  }
  return -1
}

/**
 * Helper function to find array positions related to a subset of doctypes
 * in array order
 * @param {Set} activeDoctypes The doctypes to find
 * @param {integer} startIndex start looking from here
 * @returns index
 */
function nextOfSetIndex (activeDoctypes, startIndex) {
  for (let index = startIndex+1; index < programSettings.doctype_attributes.length; ++index) {
    if (activeDoctypes.has(programSettings.doctype_attributes[index].doctype)) {
      return index
    }
  }
  return -1
}

/**
 * Get content of dialog and update settings
 */
function doctypesDialogSave () {
  console.log('Before:', programSettings.doctype_attributes)
  // is this a partial or complete edit of the doctype_attributes
  const ul = document.getElementById('doctype_attributes')
  const items = ul.getElementsByTagName("li")
  if (document.getElementById('hide_unused_doctypes').checked) {
    // The subset of doctypes which shall replace items in doctype_attributes
    let doctypeIndex = firstOfSetIndex(document.__activeDoctypes__)
    for (let i = 0; i < items.length; ++i) {
      // do something with items[i], which is a <li> element
      const doctype = items[i].getAttribute('data-doctype')
      programSettings.doctype_attributes[doctypeIndex].doctype = doctype
      programSettings.doctype_attributes[doctypeIndex].color = document.getElementById(`color_${doctype}`).value
      programSettings.doctype_attributes[doctypeIndex].cluster = document.querySelector(`input[name="v-model_${doctype}"]:checked`).value
      doctypeIndex = nextOfSetIndex(document.__activeDoctypes__, doctypeIndex)
    }
  } else {
    // All elements in doctype_attributes are replaced
    for (let i = 0; i < items.length; ++i) {
      // do something with items[i], which is a <li> element
      const doctype = items[i].getAttribute('data-doctype')
      programSettings.doctype_attributes[i].doctype = doctype
      programSettings.doctype_attributes[i].color = document.getElementById(`color_${doctype}`).value
      programSettings.doctype_attributes[i].cluster = document.querySelector(`input[name="v-model_${doctype}"]:checked`).value
    }
  }
  programSettings.doctype_clusters = document.getElementById('doctype_clusters').checked
  console.log('After:', programSettings.doctype_attributes)
  // TODO: save settings and trigger redraw?
}

