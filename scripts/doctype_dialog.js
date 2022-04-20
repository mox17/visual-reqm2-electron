'use strict'
import { ipcRenderer } from 'electron'
import { programSettings } from './settings.js'
import { updateColorSettings } from './color.js'
import Sortable from 'sortablejs'

// doctypes settings handling

document.getElementById('doctypeColorDialogOk').addEventListener('click', async function () {
  document.getElementById('doctypeColorDialog').style.display = 'none'
  await doctypesDialogSave()
})

document.getElementById('doctypeColorDialogCancel').addEventListener('click', function () {
  document.getElementById('doctypeColorDialog').style.display = 'none'
})

document.getElementById('doctypeColorDialogClose').addEventListener('click', function () {
  document.getElementById('doctypeColorDialog').style.display = 'none'
})

/**
 * Pointer to callback when updating settings
 */
let doctypeSettingsCallback = null

/**
 * Populate html and make settings modal visible
 * @param activeDoctypes set of doctypes used in current diagram
 */
 export function openDoctypes (activeDoctypes, callbackOnSave) {
  // save set for later use when saving
  document.__activeDoctypes__ = activeDoctypes
  doctypeSettingsCallback = callbackOnSave
  const doctypesPopup = document.getElementById('doctypeColorDialog')
  // Do not hide inactive doctypes in dialog when there is no oreqm data
  const hideUnknown = activeDoctypes.size ? true : false
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
  <li data-doctype="${dt.doctype}" id="li_${dt.doctype}">
    <div id="dt_attr_${dt.doctype}" style="background-color:${dt.color}; display: inline-block; width:100%">
      <span style="width:30%;float:left;">&nbsp;${dt.doctype}</span>
      <span style="width:10%">
        <label for="color_${dt.doctype}">color:</label>
        <input type="color" id="color_${dt.doctype}" value="${dt.color}" title="Select doctype color"></input>
      </span>
      <span style="float:right;">
        <button id="delete_${dt.doctype}" style="font-size:18px;padding:0;" title="Delete doctype">&#x1f5d1;</button>
        <input type="radio" name="v-model_${dt.doctype}" id="dt_dsgn_${dt.doctype}" value="design" title="Cluster on design side">design</input>
        <input type="radio" name="v-model_${dt.doctype}" id="dt_none_${dt.doctype}" value=""       title="No clustering"    >none</input>
        <input type="radio" name="v-model_${dt.doctype}" id="dt_test_${dt.doctype}" value="test"   title="Cluster on test side"  >test&nbsp;</input>
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

  // Update the elements with js
  for (const dt of programSettings.doctype_attributes) {
    // Check if list is filtered - doctype might not be shown
    if (!document.getElementById(`color_${dt.doctype}`)) {
      continue
    }
    document.getElementById(`color_${dt.doctype}`).onchange = () => {
      document.getElementById(`dt_attr_${dt.doctype}`).style.backgroundColor = document.getElementById(`color_${dt.doctype}`).value
    }
    if (activeDoctypes.has(dt.doctype)) {
      // hide delete button for active doctypes
      document.getElementById(`delete_${dt.doctype}`).style.display = 'none'
    } else {
      // Set up delete handler
      document.getElementById(`delete_${dt.doctype}`).onclick = async () => {
        const confirm = await ipcRenderer.invoke('dialog.showMessageBoxSync',
        {
          type: 'question',
          buttons: ['Cancel', 'Delete'],
          defaultId: 0,
          message: `Delete attributes for doctype "${dt.doctype}"?`
        })
        //console.log(confirm)
        if (confirm === 1) {
          const parent = document.getElementById('doctype_attributes')
          parent.removeChild(document.getElementById(`li_${dt.doctype}`))
        }
      }
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
  // istanbul ignore next
  return undefined
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
  return undefined
}

/**
 * Get content of dialog and update settings
 */
async function doctypesDialogSave () {
  //console.log('Before:', programSettings.doctype_attributes)
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
    // All elements in doctype_attributes array are replaced
    programSettings.doctype_attributes = []
    for (let i = 0; i < items.length; ++i) {
      // do something with items[i], which is a <li> element
      const doctype = items[i].getAttribute('data-doctype')
      programSettings.doctype_attributes.push({
        doctype: doctype,
        color: document.getElementById(`color_${doctype}`).value,
        cluster: document.querySelector(`input[name="v-model_${doctype}"]:checked`).value
      })
    }
  }
  programSettings.doctype_clusters = document.getElementById('doctype_clusters').checked
  //console.log('After:', programSettings.doctype_attributes)
  await ipcRenderer.invoke('settingsSetSync', 'program_settings', programSettings)
  if (doctypeSettingsCallback) {
    // Update color module internal table TODO: refactor this double representation of colors
    let palette = {}
    for (const dt of programSettings.doctype_attributes) {
      palette[dt.doctype] = dt.color
    }
    // Update with colors from settings
    updateColorSettings(palette, null)
    // Trigger updates with new colors
    doctypeSettingsCallback()
  }
}

