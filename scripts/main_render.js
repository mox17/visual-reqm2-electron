'use strict'
import { setLimitReporter, xmlEscape } from './diagrams.js'
import { getColor, saveColorsFs, loadColorsFs } from './color.js'
import { handleSettings, loadSafetyRulesFs, openSettings, saveProgramSettings } from './settings_dialog'
import { openDoctypes } from './doctype_dialog'
import { getIgnoredFields, programSettings, isFieldAList } from './settings.js'
import { ipcRenderer, shell, clipboard } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { settingsUpdated, oreqmMain, oreqmRef, saveDiagramFile, selectColor,
         createOreqmMain, createOreqmRef, clearOreqmRef } from './main_data.js'
import { searchTooltip } from './reqm2oreqm.js'
import { getTimeNow, logTimeSpent } from './util'
import { searchLanguage, setSearchLanguage, searchRegexValidate, setSearchLanguageHints,
         setSearchLanguageButtons, searchPattern, excludedDoctypes, setExcludedDoctypes } from './search'
import { cmdLineParameters, checkCmdLineSteps } from './cmdline'
import { showDoctypesSafety, showDoctypes, selectedFormat, clearHtmlTable, updateDiagram,
         clearDiagram, spinnerShow, selectedNodes,
         selectedNode, panZoom, nextSelected, prevSelected, selectedIndex,
         setSelectedIndex, graphResults, centerNode, setDoctypeCountShown, clearDoctypesTable,
         clearSelectionHighlight, filterChange, filterGraph, autoUpdate, setAutoUpdate,
         reportLimitAsToast, myShowToast, setExcludedDoctypeCheckboxes, toggleExclude,
         doctypeFilterChange, diagramType, diagramTypeNone, diagramTypeSpecobjects,
         diagramTypeDoctypes, diagramTypeSafety } from './show_diagram'
import { setIssueCount, saveProblems } from './issues'
import { copyIdNode, menuDeselect, addNodeToSelection, excludeId, copyPng, showInternal,
         nodeSource, showSource } from './context-menu.js'
import { progressbarStart, progressbarUpdate, progressbarStop } from './progressbar.js'
//import { round, set } from 'lodash'
import Sortable from 'sortablejs'
const open = require('open')
const XLSX = require('xlsx');

const beforeUnloadMessage = null

/** Version available on github.com */
let latestVersion = 'unknown'

/** @description Draggable border between diagram and selection logic to the left */
const resizeEvent = new Event('paneresize')
Split(['#oreqm_div', '#graph'], {
  sizes: [15, 85],
  onDragEnd: /* istanbul ignore next */ function () {
    const svgOutput = document.getElementById('svg_output')
    if (svgOutput !== null) {
      svgOutput.dispatchEvent(resizeEvent)
    }
  }
})

// Handlers for menu operations triggered via RPC
ipcRenderer.on('about', async (_item, _window, _key_ev) => {
  showAbout()
})

// istanbul ignore next
ipcRenderer.on('readme', (_item, _window, _key_ev) => {
  showReadme()
})

// istanbul ignore next
ipcRenderer.on('vql_help', (_item, _window, _key_ev) => {
  showVqlHelp()
})

ipcRenderer.on('load_main_oreqm', async (_item, _window, _key_ev) => {
  await getMainOreqmFile()
})

ipcRenderer.on('load_ref_oreqm', async (_item, _window, _key_ev) => {
  await getRefOreqmFile()
})

ipcRenderer.on('save_colors', async (_item, _window, _key_ev) => {
  await saveColorsFs()
})

ipcRenderer.on('load_colors', async (_item, _window, _key_ev) => {
  await loadColorsFs(updateDoctypeTable)
})

ipcRenderer.on('load_safety', async (_item, _window, _key_ev) => {
  await loadSafetyRulesFs()
})

ipcRenderer.on('save_diagram_as', async (_item, _window, _key_ev) => {
  await menuSaveAs()
})

ipcRenderer.on('save_issues_as', async (_item, _window, _key_ev) => {
  await saveProblems()
})

ipcRenderer.on('show_issues', (_item, _window, _key_ev) => {
  showProblems()
})

ipcRenderer.on('open_settings', (_item, _window, _key_ev) => {
  openSettings()
})

ipcRenderer.on('open_doctypes', (_item, _window, _key_ev) => {
  const usedDoctypes = oreqmMain ? new Set(oreqmMain.getDoctypes().keys()) : new Set()
  openDoctypes(usedDoctypes, updateDoctypeTable)
})

ipcRenderer.on('save_diagram_ctx', async (_item, _window, _key_ev) => {
  await saveDiagramCtx()
})

ipcRenderer.on('load_diagram_ctx', async (_item, _window, _key_ev) => {
  await loadDiagramCtx()
})

ipcRenderer.on('save_diagram_sel', (_item, _window, _key_ev) => {
  openSheetExportDialog()
})

/** Keyboard accelerators for svg pan zoom */
// istanbul ignore next
ipcRenderer.on('svg_reset_zoom', () => {
  // istanbul ignore next
  if (document.getElementById('svg_output')) {
    panZoom.reset()
  }
})

// istanbul ignore next
ipcRenderer.on('svg_pan_left', () => {
  // istanbul ignore next
  if (document.getElementById('svg_output')) {
    panZoom.panBy({ x: 100, y: 0 })
  }
})

// istanbul ignore next
ipcRenderer.on('svg_pan_right', () => {
  // istanbul ignore next
  if (document.getElementById('svg_output')) {
    panZoom.panBy({ x: -100, y: 0 })
  }
})

// istanbul ignore next
ipcRenderer.on('svg_pan_up', () => {
  // istanbul ignore next
  if (document.getElementById('svg_output')) {
    panZoom.panBy({ x: 0, y: 100 })
  }
})

// istanbul ignore next
ipcRenderer.on('svg_pan_down', () => {
  // istanbul ignore next
  if (document.getElementById('svg_output')) {
    panZoom.panBy({ x: 0, y: -100 })
  }
})

// istanbul ignore next
ipcRenderer.on('svg_zoom_in', () => {
  // istanbul ignore next
  if (document.getElementById('svg_output')) {
    panZoom.zoomIn()
  }
})

// istanbul ignore next
ipcRenderer.on('svg_zoom_out', () => {
  // istanbul ignore next
  if (document.getElementById('svg_output')) {
    panZoom.zoomOut()
  }
})

// istanbul ignore next
ipcRenderer.on('selected_next', () => {
  // istanbul ignore next
  if (document.getElementById('svg_output')) {
    nextSelected()
  }
})

// istanbul ignore next
ipcRenderer.on('selected_prev', () => {
  // istanbul ignore next
  if (document.getElementById('svg_output')) {
    prevSelected()
  }
})

// istanbul ignore next
ipcRenderer.on('filter_graph', () => {
  // istanbul ignore next
  if (document.getElementById('svg_output')) {
    filterGraph()
  }
})

/**
 * This function will check for the existence of a file.
 * When running as a portable app on Windows, the PWD changes,
 * such that a relative path no longer works.
 * This function tries to detect this and uses a PWD environment
 * variable, if such exist.
 * @param {string} name
 * @return {string} name if it exist, empty string if not found
 */
function findFile (name) {
  let newPath = ''
  // istanbul ignore else
  if (fs.existsSync(name)) {
    return name
  }
  // istanbul ignore next
  if (process.env.PORTABLE_EXECUTABLE_APP_FILENAME) {
    // File not found, we are running as portable, so try to find PWD
    if (process.env.PWD) {
      const testPath = path.join(process.env.PWD, name)
      if (fs.existsSync(testPath)) {
        console.log(`Found file at ${testPath}`)
        newPath = testPath
      }
    } else {
      process.stderr.write(`File not found '${name}'\n${process.env.PORTABLE_EXECUTABLE_APP_FILENAME} is running as 'portable'. Add PWD to environment to allow relative paths for input files or specify absolute paths.`)
    }
  }
  // istanbul ignore next
  return newPath
}

/**
 * Main processing triggered from main process starts here.
 * Processed command line parameters are received here
 */
ipcRenderer.on('argv', (event, parameters, args) => {
  let ok = true
  let main = false
  let ref = false

  // console.log("ipcRenderer.on('argv'")
  // console.dir(args)
  setLimitReporter(reportLimitAsToast)
  handleSettings(settingsUpdated).then( async () => {
    document.getElementById('vrm2_batch').innerHTML = 'init'
    setSearchLanguageButtons(programSettings.search_language)

    document.getElementById('prog_version').innerHTML = await ipcRenderer.invoke('app.getVersion')
    document.getElementById('auto_update').checked = autoUpdate

    document.getElementById('search_tooltip').innerHTML = searchTooltip(searchLanguage)
    document.getElementById('no_rejects').checked = programSettings.no_rejects

    // istanbul ignore else
    if ((args.newVer !== false) && (args.newVer === true || programSettings.check_for_updates)) {
      checkNewerReleaseAvailable()
    }
    cmdLineParameters(args)
    if (args.oreqm_main !== undefined && args.oreqm_main.length > 0) {
      //rq: ->(rq_one_oreqm_cmd_line)
      const checkMain = findFile(args.oreqm_main)
      // istanbul ignore else
      if (checkMain.length) {
        args.oreqm_main = checkMain
      }
      const mainStat = fs.existsSync(args.oreqm_main) ? fs.statSync(args.oreqm_main) : null
      if (mainStat && mainStat.isFile()) {
        main = true
      } else {
        // Log to stderr as these are command line options
        process.stderr.write(`Not a file: ${args.oreqm_main}\n`)
        process.stderr.write(`Curr dir: ${process.cwd()}\n`)
        //console.log(`Not a file: ${args.oreqm_main}`)
        ok = false
      }
    }
    if (args.oreqm_ref !== undefined && args.oreqm_ref.length > 0) {
      //rq: ->(rq_two_oreqm_cmd_line)
      const checkRef = findFile(args.oreqm_ref)
      // istanbul ignore else
      if (checkRef.length) {
        args.oreqm_ref = checkRef
      }
      const refStat = fs.existsSync(args.oreqm_ref) ? fs.statSync(args.oreqm_ref) : null
      if (refStat && refStat.isFile()) {
        // console.log(args.oreqm_ref, refStat);
        ref = true
      } else {
        process.stderr.write(`Not a file: ${args.oreqm_ref}\n`)
        //console.log('Not a file.', args.oreqm_ref)
        ok = false
      }
    }
    if (ok && main) {
      // console.log("render files:", args.oreqm_main, args.oreqm_ref)
      loadFileMainFs(args.oreqm_main, ref ? args.oreqm_ref : null)
    } else if (args.context !== undefined && args.context.length > 0) {
      // Check for context file (exclusive with oreqm_main & oreqm_ref)
      const checkContext = findFile(args.context)
      // console.log("render context:", args.context)
      // istanbul ignore else
      if (checkContext.length) {
        args.context = checkContext
      }
      const ctxStat = fs.existsSync(args.context) ? fs.statSync(args.context) : null
      if (ctxStat && ctxStat.isFile()) {
        loadDiagramContext(args.context)
      }
    }
  })
})
/**
 * The steps of the cmd-line processing are handled through the process queue.
 * The request for next operation is sent to main process, which echoes it back.
 * The processing then continues via this handler.
 */
ipcRenderer.on('cl_cmd', (_evt, arg) => {
  // console.log("cl_cmd", arg)
  // istanbul ignore else
  if (arg === 'next') {
    checkCmdLineSteps()
  } else {
    console.log(`Unexpected cl_cmd ${arg}`)
  }
})

/**
 * Called when a user accepts the option to reload a modified file
 * The selection between main and ref is based on the presence of
 * 'main' (case ignored) in the title.
 */
ipcRenderer.on('file_updated', (_evt, title, path)  => {
  // console.log("ipcRenderer.on('file_updated", title, path)
  if (title.toLowerCase().includes('main')) {
    loadFileMainFs(path, null)
  } else {
    loadFileRefFs(path)
  }
})

window.addEventListener('beforeunload', function () {
  return beforeUnloadMessage
})

// Selection/deselection of nodes by right-clicking the diagram
document.getElementById('menu_select').addEventListener('click', function () {
  // Add node to the selection criteria (if not already selected)
  //rq: ->(rq_ctx_add_selection)
  addNodeToSelection(selectedNode)
})

/** Context menu handler  */
document.getElementById('menu_deselect').addEventListener('click', function () {
  menuDeselect()
})

// Context menu handler
document.getElementById('menu_copy_id').addEventListener('click', function () {
  copyIdNode(false)
})

// Context menu handler
document.getElementById('menu_copy_ffb').addEventListener('click', function () {
  copyIdNode(true)
})

/** context menu item handler. Copy diagram as png to clipboard */
document.getElementById('menu_copy_png').addEventListener('click', function () {
  copyPng() //rq: ->(rq_ctx_copy_png)
})

/** context menu handler - save diagram as */
document.getElementById('menu_save_as').addEventListener('click', async function () {
  await menuSaveAs()
})

async function menuSaveAs () {
  const saveOptions = {
    filters: [
      { name: 'SVG files', extensions: ['svg'] }, //rq: ->(rq_save_svg_file)
      { name: 'PNG files', extensions: ['png'] }, //rq: ->(rq_save_png_file)
      { name: 'DOT files', extensions: ['dot'] }
    ],
    properties: ['openFile']
  }
  const savePath = await ipcRenderer.invoke('dialog.showSaveDialogSync', null, saveOptions)
  // istanbul ignore else
  if (typeof (savePath) !== 'undefined') {
    saveDiagramFile(savePath)
  }
}

/**
 * Save diagram context will save a json file with
 * the paths of input files and the selection parameters
 * used to generate the current diagram.
 *
 * Also save the settings in the json file.
 *
 */
async function saveDiagramCtx () {
  let defPath = ""
  // istanbul ignore else
  if (oreqmMain) {
    if (path.isAbsolute(oreqmMain.filename)) {
      defPath = path.dirname(oreqmMain.filename)
    } else {
      defPath = path.join(process.cwd(), path.dirname(oreqmMain.filename))
    }

    const saveOptions = {
      filters: [
        { name: 'ReqM2 context files', extensions: ['vr2x'] }
      ],
      properties: ['openFile'],
      defaultPath: defPath,
      title: "Save ReqM2 context file"

    }
    // Suggest to save in same directory as oreqm_main
    const savePath = await ipcRenderer.invoke('dialog.showSaveDialogSync', null, saveOptions)
    // istanbul ignore else
    if (typeof (savePath) !== 'undefined') {
      saveDiagramContext(savePath)
    }
  }
}

/**
 * Load diagram context will load a json file with
 * the paths of input file(s) and the selection parameters used.
 * It will then replace current input file(s) with the ones listed
 * in json file, and apply the specified selection parameters.
 *
 * TODO: devise a strategy for handling settings that is not totally surprising
 * for the user.
 * The scenario to consider is that a rendering of a context file dependS on certain settings,
 * which the user loading this file may not have selected.
 * After finishing looking at the diagram, and and the user loads something else, how to
 * revert to 'normal' settings, and how to explain this behavior.
 * For now we 'solve' this by ignoring the problem.
 */
async function loadDiagramCtx () {
  let LoadPath = await ipcRenderer.invoke('dialog.showOpenDialogSync',
    {
      filters: [{ name: 'ReqM2 context files', extensions: ['vr2x'] }],
      properties: ['openFile'],
      defaultPath: process.cwd(),
      title: "Load ReqM2 context file"
    })
  // istanbul ignore elsen
  if (LoadPath) {
    loadDiagramContext(LoadPath[0])
  }
}

/**
 * Calculate the absolute path of supplied filename/path
 * @param {string} filename
 * @returns
 */
function calcAbsPath (filename) {
  let absPath
  if (path.isAbsolute(filename)) {
    absPath = filename
  } else {
    absPath = path.join(process.cwd(), filename)
  }
  return absPath
}

/**
 * Create json object which specifies absolute and relative paths
 * to input oreqm files as well as the applied parameters.
 *
 * @param {string} ctxPath file path to store json context
 */
function saveDiagramContext (ctxPath) {
  // istanbul ignore else
  if (oreqmMain) {
    let absPathMain = calcAbsPath(oreqmMain.filename)
    // Make context file relative paths portable between Linux and Windows
    let relPath = path.relative(path.dirname(ctxPath), absPathMain).replaceAll('\\', '/')
    // istanbul ignore next
    if (relPath[0] !== '.') {
      relPath = './' + relPath
    }
    let absPathRef = ""
    let relPathRef = ""
    if (oreqmRef) {
      absPathRef = calcAbsPath(oreqmRef.filename)
      relPathRef = path.relative(path.dirname(ctxPath), absPathRef).replaceAll('\\', '/')
      // istanbul ignore next
      if (relPathRef[0] !== '.') {
        relPathRef = './' + relPathRef
      }
    }

    let diagCtx = {
      version: 2,
      main_oreqm_rel: relPath,
      ref_oreqm_rel: relPathRef,
      no_rejects: document.getElementById('no_rejects').checked,
      search_language: searchLanguage,
      search_regex: document.getElementById('search_regex').value,
      excluded_ids: document.getElementById('excluded_ids').value,
      limit_depth_input: document.getElementById('limit_depth_input').checked,
      excluded_doctypes: oreqmMain.getExcludedDoctypes(),
      // Settings here
      settings: {
        compare_fields: programSettings.compare_fields,
        safety_link_rules: programSettings.safety_link_rules,
        show_errors: programSettings.show_errors,
        show_coverage: programSettings.show_coverage,
        color_status: programSettings.color_status
      }
    }
    let jsonCtx = JSON.stringify(diagCtx, null, 2)
    //console.log(jsonCtx)
    fs.writeFileSync(ctxPath, jsonCtx, 'utf8')
  }
}

/**
 * Load context file, check content and load if OK
 * The following checks are performed:
 * 1) If relative paths resolve use those
 * 2) otherwise use absolute paths
 * 3) If a file is not found then report failure
 * 4) Update selection data
 * 5) load file(s)
 *
 * @param {string} ctxPath
 */
function loadDiagramContext (ctxPath) {
  // suppress display updates while loading context
  let saveAuto = autoUpdate
  setAutoUpdate(false)
  let diagCtx = JSON.parse(fs.readFileSync(ctxPath, { encoding: 'utf8', flag: 'r' }))
  let ctxDir = path.dirname(ctxPath)
  let mainRelPath = path.join(ctxDir, diagCtx.main_oreqm_rel).replaceAll('\\', '/')
  let refRelPath = null

  let mainRel = fs.existsSync(mainRelPath)
  let loadRef = diagCtx.ref_oreqm_rel !== ""
  let refRel = false
  // Set up async handler for context load
  vr2xHandler = vr2xHandlerFunc
  // Set up a handler to restore parameters when load of oreqm file(s) complete
  vr2xCtx = {
    diagCtx: diagCtx,
    auto_update: saveAuto
  }
  if (!path.isAbsolute(mainRelPath) && mainRelPath[0] !== '.') {
    mainRelPath = './' + mainRelPath
  }
  if (loadRef) {
    refRelPath = path.join(ctxDir, diagCtx.ref_oreqm_rel).replaceAll('\\', '/')
    refRel = fs.existsSync(refRelPath)
    if (refRel && !path.isAbsolute(refRelPath) && refRelPath[0] !== '.') {
      refRelPath = './' + refRelPath
    }
  }
  if (mainRel && loadRef && refRel) {
    // both relative paths OK
    loadFileMainFs(mainRelPath, refRelPath)
  } else if (mainRel && !loadRef) {
    // main rel only
    loadFileMainFs(mainRelPath, null)
  } else {
    setAutoUpdate(saveAuto)
    // display error message
    let msg = "Could not open:\n"
    if (loadRef) {
      msg += mainRel ? "" : mainRelPath + '\n'
      msg += refRel ? "" : refRelPath + '\n'
    } else {
      msg += mainRelPath + '\n'
    }
    msg = msg.replace(/([^\n]{35,400}?(\/|\\))/g, '$1\n  ')
    ipcRenderer.send('cmd_show_error', "ReqM2 Context file", msg)
    return
  }
}

let vr2xHandler = null
let vr2xCtx = null

/**
 * Async handler called after loading of oreqm file(s)
 * to set search parameters and settings
 */
function vr2xHandlerFunc () {
  updateSettingsFromContext(vr2xCtx.diagCtx)
  restoreContextAttributes(vr2xCtx.diagCtx)
  setExcludedDoctypeCheckboxes()
  setAutoUpdate(vr2xCtx.auto_update)
  filterChange()
  // Clear handler - it only applies to context loads
  vr2xHandler = null
}

/**
 * Restore the attributes stored in the context object
 * @param {object} ctx
 */
function restoreContextAttributes (ctx) {
  document.getElementById('no_rejects').checked = ctx.no_rejects
  // Handle version differences in file formats
  if (ctx.version === 1) {
    setSearchLanguage(document.getElementById('id_radio_input').checked ? 'ids' : 'reg')
  } else
  // istanbul ignore else
  if (ctx.version === 2) {
    setSearchLanguage(ctx.search_language)
  }
  document.getElementById('search_regex').value = ctx.search_regex
  document.getElementById('excluded_ids').value = ctx.excluded_ids
  document.getElementById('limit_depth_input').checked = ctx.limit_depth_input
  oreqmMain.setExcludedDoctypes(ctx.excluded_doctypes)
  setSearchLanguageButtons(searchLanguage)
}

/**
 * Update settings found in context file (these are not ALL settings)
 * @param {object} ctx
 */
function updateSettingsFromContext (ctx) {
  for (const key in ctx.settings.compare_fields) {
    // if (programSettings.compare_fields[key] !== ctx.settings.compare_fields[key]) {
    //   console.log(key, programSettings.compare_fields[key], ctx.settings.compare_fields[key])
    // }
    programSettings.compare_fields[key] = ctx.settings.compare_fields[key]
  }

  // if (programSettings.safety_link_rules != ctx.settings.safety_link_rules) {
  //   console.log("safety_link_rules", programSettings.safety_link_rules, ctx.settings.safety_link_rules)
  // }
  programSettings.safety_link_rules = ctx.settings.safety_link_rules

  // if (programSettings.show_errors !== ctx.settings.show_errors) {
  //   console.log("show_errors", programSettings.show_errors, ctx.settings.show_errors)
  // }
  programSettings.show_errors = ctx.settings.show_errors

  // if (programSettings.show_coverage !== ctx.settings.show_coverage) {
  //   console.log("show_coverage", programSettings.show_coverage, ctx.settings.show_coverage)
  // }
  programSettings.show_coverage = ctx.settings.show_coverage

  // if (programSettings.color_status !== ctx.settings.color_status) {
  //   console.log("color_status", programSettings.color_status, ctx.settings.color_status)
  // }
  programSettings.color_status = ctx.settings.color_status
}

/**
 * Save diagram selection will save a text file with
 * the ids and doctypes of the selected nodes and the set of ancestors
 * (also id and doctype) from the current diagram.
 */
 async function saveDiagramSel () {
  let defPath = ""
  // istanbul ignore else
  if (oreqmMain) {
    if (path.isAbsolute(oreqmMain.filename)) {
      defPath = path.dirname(oreqmMain.filename)
    } else {
      defPath = path.join(process.cwd(), path.dirname(oreqmMain.filename))
    }

    const saveOptions = {
      filters: [
        { name: 'Spreadsheet (xlsx)', extensions: ['xlsx'] }
      ],
      properties: ['openFile'],
      defaultPath: defPath,
      title: "Save ReqM2 selection as file"
    }

    // Suggest to save in same directory as oreqmMain
    const savePath = await ipcRenderer.invoke('dialog.showSaveDialogSync', null, saveOptions)
    // istanbul ignore else
    if (typeof (savePath) !== 'undefined') {
      await saveDiagramSelectionAsSpreadsheet(savePath)
    }
  }
}

/**
 * Populate the sheetExportPopup dialog with the fields selected for export and other related settings
 */
function prepareSheetExportDialog () {
  //rq: ->(rq_spreadsheet_export_cfg)
  const exportFieldsAvailable = document.getElementById('export_fields_available')
  const exportFieldsSelected = document.getElementById('export_fields_selected')

  document.getElementById('sheet_export_multi').checked = programSettings.export_multi

  // Create ul of selected fields
  let ulExported = '<ul id="sheet_ul_exported" class="export-field-list col">\n'
  programSettings.export_fields.forEach(function (field) {
    ulExported += ` <li class="export-field" id="export_field_${field}">${field}</li>\n`
  })
  ulExported += '</ul>\n'
  exportFieldsSelected.innerHTML = ulExported

  // Create ul of not selected fields. compare_fields have all the needed names
  let fieldList = Object.keys(programSettings.compare_fields)
  fieldList.push("ancestor_id")
  fieldList.push("ancestor_dt")
  fieldList.push("ancestor_status")
  let ulNotExported = '<ul id="sheet_ul_not_exported" class="export-field-list col">\n'
  for (const field of fieldList) {
    if (programSettings.export_fields.indexOf(field) < 0) {
      // Not an exported field, add to this list
      ulNotExported += `  <li class="export-field" id="export_field_${field}">${field}</li>\n`
    }
  }
  ulNotExported += '</ul>\n'
  exportFieldsAvailable.innerHTML = ulNotExported

  // Set up double-click transfer between lists
  for (const fieldName of fieldList) {
    const fieldId = `export_field_${fieldName}`
    const fieldNode = document.getElementById(fieldId)
    if (fieldNode) {
      fieldNode.ondblclick = () => {
        const node = document.getElementById(fieldId)
        const otherParent = (node.parentElement.id === "sheet_ul_exported") ?
          document.getElementById('sheet_ul_not_exported') :
          document.getElementById('sheet_ul_exported')
        node.parentElement.removeChild(node)
        otherParent.appendChild(node)
      }
    }
  }

  new Sortable(document.getElementById('sheet_ul_exported'), {
    group: 'export_tags',
    animation: 150,
    ghostClass: "placeholder"
  })

  new Sortable(document.getElementById('sheet_ul_not_exported'), {
    group: 'export_tags',
    animation: 150,
    ghostClass: "placeholder"
  })
}

async function saveSheetExportDialogChoices () {
  // extract list of fields and save
  let exList = document.getElementById('sheet_ul_exported')
  let exportList = exList.getElementsByTagName('li')
  programSettings.export_fields = Array.from(exportList).map(r => r.innerHTML)
  programSettings.export_multi = document.getElementById('sheet_export_multi').checked
  //console.log(programSettings.export_fields)
  await saveProgramSettings()
}

function openSheetExportDialog () {
  prepareSheetExportDialog()
  document.getElementById('sheetExportPopup').style.display = 'block'
}

document.getElementById('sheet_export_ok').addEventListener('click', async function () {
  saveSheetExportDialogChoices()
  document.getElementById('sheetExportPopup').style.display = 'none'
  await saveDiagramSel()
})

document.getElementById('sheet_export_cancel').addEventListener('click', function () {
  document.getElementById('sheetExportPopup').style.display = 'none'
})

document.getElementById('sheetExportPopupClose').addEventListener('click', function () {
  document.getElementById('sheetExportPopup').style.display = 'none'
})

/**
 * Calculate the 1st row headline.
 * Notice that different categories of errors are all merged into the 'errors' column
 * @returns string[] 1st row labels
 */
function calcHeadLine () {
  let errCol = ''
  let headLine = []
  for (let f of programSettings.export_fields) {
    switch (f) {
      // Merge all errors into one column
      case 'miscov':
      case 'errors':
      case 'ffberrors':
      case 'violations':
        if (!errCol.length) {
          errCol = 'errors'
          headLine.push(errCol)
        }
        break;
      default:
        headLine.push(f)
    }
  }
  return headLine
}

/**
 * Save selected specobjects as xlsx file, with the fields specified in export dialog
 * @param {String} pathname
 */
async function saveDiagramSelectionAsSpreadsheet (pathname) {
  //rq: ->(rq_spreadsheet_export)
  // Determine what fields are exported
  const headLine = calcHeadLine()
  const errCol = headLine.indexOf('errors')
  const ancIdCol = headLine.indexOf('ancestor_id')
  const ancDtCol = headLine.indexOf('ancestor_dt')
  const ancStCol = headLine.indexOf('ancestor_status')
  const listAncestors = ancIdCol >= 0 || ancDtCol >= 0 || ancStCol >= 0
  let sheetArray = [] // array-of-arrays for worksheet export
  sheetArray.push(headLine)
  // List of selected nodes
  for (let s of oreqmMain.subset) {
    const ancestors = listAncestors ? oreqmMain.getAncestors(s, new Set()) : new Set()
    const rec = oreqmMain.requirements.get(s)
    let errSet = new Set()
    let row = []
    if (programSettings.export_fields.indexOf('miscov') >= 0) {
      for (const m of rec.miscov) {
        errSet.add(`Missing coverage from doctype ${m}`)
      }
    }
    if (programSettings.export_fields.indexOf('errors') >= 0) {
      for (const e of rec.errors) {
        errSet.add(`${e.trim()}`)
      }
    }
    if (programSettings.export_fields.indexOf('ffberrors') >= 0) {
      for (const f of rec.ffberrors) {
        errSet.add(`${f.trim()}`)
      }
    }
    if (programSettings.export_fields.indexOf('violations') >= 0) {
      for (const v of rec.violations) {
        errSet.add(`${v.trim()}`)
      }
    }
    // Fill row with specobject data
    for (const field of headLine) {
      switch (field) {
        // These fields will be looped over - put placeholder for now
        case 'errors':
        case 'ancestor_id':
        case 'ancestor_dt':
        case 'ancestor_status':
          row.push('')
          break;

        default:
          if (isFieldAList[field]) {
            row.push(rec[field].join('\n'))
          } else {
            row.push(rec[field])
          }
        }
    }
    if (programSettings.export_multi) {
      // Each error and ancestor combo gets a separate row
      if (errSet.size) {
        for (const err of errSet) {
          row[errCol] = err
          if (ancestors.size > 0) {
            for (const a of ancestors) {
              if (ancIdCol >= 0) {
                row[ancIdCol] = a.id
              }
              if (ancDtCol >= 0) {
                row[ancDtCol] = a.doctype
              }
              if (ancStCol >= 0) {
                row[ancStCol] = a.status
              }
              sheetArray.push(row.slice())
            }
          } else {
            sheetArray.push(row.slice())
          }
        }
      } else {
        // selected specobjects without errors
        sheetArray.push(row.slice())
      }
    } else {
      // Single row for all errors/ancestors
      if (errCol >= 0) {
        row[errCol] = Array.from(errSet).join('\n')
      }
      const ancArr = Array.from(ancestors)
      if (ancIdCol >= 0) {
        row[ancIdCol] = ancArr.map(a => a.id).join('\n')
      }
      if (ancDtCol >= 0) {
        row[ancDtCol] = ancArr.map(a => a.doctype).join('\n')
      }
      if (ancStCol >= 0) {
        row[ancStCol] = ancArr.map(a => a.status).join('\n')
      }
      sheetArray.push(row.slice())
    }
  }
  let workBook = XLSX.utils.book_new()
  let titleArray = [['Export from Visual ReqM2', await ipcRenderer.invoke('app.getVersion')],
                    [],
                    ['Input oreqm file', oreqmMain.filename],
                    ['timestamp', oreqmMain.timestamp], // A4
                    [],
                    ['Search language', searchLanguage],
                    ['Search term', searchPattern]
                  ]
  let titleSheet = XLSX.utils.aoa_to_sheet(titleArray)
  let titleSheetCols = calcAutoWidth(titleArray)
  titleSheet["!cols"] = titleSheetCols
  XLSX.utils.book_append_sheet(workBook, titleSheet, 'Input')

  let workSheet = XLSX.utils.aoa_to_sheet(sheetArray)

  // Auto width
  let worksheetCols = calcAutoWidth(sheetArray)
  workSheet["!cols"] = worksheetCols

  XLSX.utils.book_append_sheet(workBook, workSheet, 'specobjects')
  // Data filter
  let maxCol = String.fromCharCode(64+sheetArray[0].length)
  let maxRow = sheetArray.length
  workSheet['!autofilter'] = { ref:`A1:${maxCol}${maxRow}`}

  XLSX.writeFile(workBook, pathname)
}

/**
 * Calculate max column width for array-of_array data
 * @param {array} sheetArray
 * @returns witdth[]
 */
function calcAutoWidth (sheetArray) {
  let objectMaxLength = new Array(sheetArray[0].length).fill(0)
  sheetArray.forEach(arr => {
    arr.forEach((value, key) => {
      let len = 0
      switch (typeof value) {
        case "number": len = 10; break
        case "string": len = value.length; break
        case "object": if (value instanceof Date)
          len = 10; break
      }
      objectMaxLength[key] = Math.max(objectMaxLength[key], len)
    })
  })
  let worksheetCols = objectMaxLength.map(width => {
    return {
      width
    }
  })
  return worksheetCols
}

/**
 * Create doctype table with counts and exclusion checkboxes
 * @param {Map<string,string[]>} doctypeDict
 */
function displayDoctypesWithCount (doctypeDict) {
  const doctypeNames = Array.from(doctypeDict.keys())
  doctypeNames.sort()
  const excluded = oreqmMain.getExcludedDoctypes() // so we can tick them again
  // console.log(doctypeNames)

  const element = document.getElementById('dyn_doctype_table')
  if (element) {
    element.parentNode.removeChild(element)
  }
  const table = document.createElement('table')
  table.id = 'dyn_doctype_table'
  let row = table.insertRow()
  let cell
  table.className = 'doctype_table'
  cell = row.insertCell()
  cell.innerHTML = '<b>doctype</b>'
  cell = row.insertCell()
  cell.innerHTML = '<b>count</b>'
  cell = row.insertCell()
  cell.innerHTML = '<b>shown</b>'
  cell = row.insertCell()
  cell.innerHTML = '<b>select</b>'
  cell = row.insertCell()
  cell.innerHTML = '<input type="checkbox" id="doctype_all" title="set all off or on"><b>exclude</b>'
  cell.addEventListener('change', doctypeFilterAllChange)
  let doctypeTotals = 0
  for (const doctypeName of doctypeNames) {
    row = table.insertRow()
    row.style.backgroundColor = getColor(doctypeName)
    cell = row.insertCell()
    cell.innerHTML = doctypeName

    cell = row.insertCell()
    cell.innerHTML = doctypeDict.get(doctypeName).length
    doctypeTotals += doctypeDict.get(doctypeName).length

    cell = row.insertCell()
    cell.innerHTML = `<div id="doctype_shown_${doctypeName}">0</div>`

    cell = row.insertCell()
    cell.innerHTML = `<div id="doctype_select_${doctypeName}">0</div>`

    cell = row.insertCell()
    const checked = excluded.includes(doctypeName)
    // console.log("dt table", doctype_name, checked)
    cell.innerHTML = `<div><input type="checkbox" id="doctype_${doctypeName}" ${checked ? 'checked' : ''}/></div>`
    cell.addEventListener('change', doctypeFilterChange)
    cell = null
  }
  // Totals row
  row = table.insertRow()
  cell = row.insertCell()
  cell.innerHTML = 'totals:'

  cell = row.insertCell()
  cell.innerHTML = `<div id="doctype_totals">${doctypeTotals}</div>` //rq: ->(rq_totals_stat)

  cell = row.insertCell()
  cell.innerHTML = '<div id="doctype_shown_totals">0</div>'

  cell = row.insertCell()
  cell.innerHTML = '<div id="doctype_select_totals">0</div>'

  document.getElementById('doctype_table').appendChild(table)
}

/** Invert all doctype exclusions and update */
function doctypeFilterAllChange () {
  toggleExclude()
}

document.getElementById('auto_update').addEventListener('click', function () {
  // console.log("auto_update_click")
  setAutoUpdate(document.getElementById('auto_update').checked)
  filterChange()
})

document.getElementById('id_radio_input').addEventListener('change', function () {
  selectSearchLanguage('ids')
})

document.getElementById('regex_radio_input').addEventListener('change', function () {
  selectSearchLanguage('reg')
})

document.getElementById('vql_radio_input').addEventListener('change', function () {
  selectSearchLanguage('vql')
})

document.getElementById('limit_depth_input').addEventListener('change', function () {
  filterChange()
})

document.getElementById('search_regex').addEventListener('change', function () {
  if (searchRegexValidate(this)) {
    filterChange()
  }
})

document.getElementById('search_regex').addEventListener('focus', function () {
  searchRegexValidate(this)
})

document.getElementById('search_regex').addEventListener('keyup', function(_ev) {
  searchRegexValidate(this)
})

document.getElementById('search_regex').addEventListener('blur', function(_event) {
  // Hide errorbox when focus leaves selection criteria box
  if (this.errorbox) {
    this.errorbox.style.display = 'none';
  }
});

document.getElementById('excluded_ids').addEventListener('change', function () {
  filterChange()
})

/**
 * Handle UI selection of search language
 * @param {string} lang 'ids', 'req' or 'vql' selected in UI
 */
async function selectSearchLanguage (lang) {
  setSearchLanguageHints(lang)
  setSearchLanguage(lang)
  programSettings.search_language = searchLanguage
  await saveProgramSettings()
  filterChange()
}

/**
 * Set auto-update status
 * @param {boolean} state true: do auto update, false: user has to trigger update
 */
// istanbul ignore next
// eslint-disable-next-line no-unused-vars
function updateAutoUpdate (state) {
  document.getElementById('auto_update').checked = state
  setAutoUpdate(state)
}

/**
 * Create main oreqm object from XML string
 * @param {string} name filename of oreqm file
 * @param {string} data xml data
 * @param {boolean} Update diagrame when loaded (not wanted if caller has load of a reference file pending.)
 */
function processDataMain (name, data, update) {
  // console.log("processDataMain")
  createOreqmMain(name, data)
  document.getElementById('name').innerHTML = oreqmMain.filename
  document.getElementById('size').innerHTML = (Math.round(data.length / 1024)) + ' KiB'
  document.getElementById('timestamp').innerHTML = oreqmMain.timestamp
  if (excludedDoctypes.length) {
    oreqmMain.setExcludedDoctypes(excludedDoctypes)
    setExcludedDoctypes([])
  }
  if (oreqmRef) { // if we have a reference do a compare
    const gr = compareOreqm(oreqmMain, oreqmRef)
    setDoctypeCountShown(gr.doctypeDict, gr.selectedDict)
  }
  displayDoctypesWithCount(oreqmMain.getDoctypes())
  if (update) {
    if (autoUpdate) {
      filterGraph()
    } else {
      oreqmMain.setSvgGuide()
      updateDiagram(selectedFormat)
    }
  }
  document.getElementById('get_ref_oreqm_file').disabled = false
  document.getElementById('clear_ref_oreqm').disabled = false
  ipcRenderer.send('menu_load_ref', true)
  setWindowTitle(name)
}

/**
 * Update window title
 * @param {string} extra typically pathname of oreqm
 */
function setWindowTitle (extra) {
  const title = `Visual ReqM2 - ${extra}`
  document.getElementById('vrm2_win_title').innerHTML = title
}

/**
 * Load and process both main and reference oreqm files
 * @param {string} file
 * @param {string} refFile
 */
function loadFileMainFs (file, refFile) {
  // console.log("loadFileMainFs", file, refFile);
  clearHtmlTable()
  clearDiagram()
  clearDoctypesTable()
  spinnerShow()

  // This is a work-around. When testing on Windows the async filereading hangs,
  // so use sync interface instead.
  progressbarStart('Loading main file', path.basename(file))
  const now = getTimeNow()
  let data = fs.readFileSync(file, 'UTF-8')
  logTimeSpent(now, "Read main oreqm")
  // console.log("main file read", refFile)
  progressbarUpdate('Processing main file', path.basename(file))
  processDataMain(file, data, refFile ? false : true)
  if (refFile) {
    progressbarUpdate('Loading reference file', path.basename(refFile))
    loadFileRefFs(refFile)
  } else if (vr2xHandler) {
    progressbarUpdate('Loading context file', '...')
    vr2xHandler()
  }
  progressbarStop()

  // read file asynchronously
  // fs.readFile(file, 'UTF-8', (err, data) => {
  //   console.log("main file read")
  //   processDataMain(file, data)
  //   if (refFile) {
  //     loadFileRefFs(refFile)
  //   } else if (vr2xHandler) {
  //     vr2xHandler()
  //   }
  // })
}

/** Handle button click for interactive load of main oreqm via file selector */
document.getElementById('get_main_oreqm_file').addEventListener('click', async function () {
  await getMainOreqmFile() //rq: ->(rq_filesel_main_oreqm)
})

async function getMainOreqmFile () {
  const filePath = await ipcRenderer.invoke('dialog.showOpenDialogSync',
    {
      filters: [{ name: 'OREQM files', extensions: ['oreqm'] }],
      properties: ['openFile']
    })
  //rq: ->(rq_filesel_main_oreqm)
  // console.log(filePath);
  if (typeof (filePath) !== 'undefined' && (filePath.length === 1)) {
    loadFileMainFs(filePath[0], null)
  }
}

/**
 * Calculate oreqm_ref and calculate diff to oreqm_main
 * @param {string} name filename of reference oreqm file
 * @param {string} data XML content of oreqm file
 */
function processDataRef (name, data) {
  // Clean up data related to a previous ref file
  oreqmMain.removeGhostRequirements(true)  // possible ghost reqs were related to now disappearing ref file
  clearHtmlTable()
  updateDoctypeTable()  // This includes reqs of doctypes that might now be gone

  // console.log("processDataRef")
  // load new reference
  createOreqmRef(name, data)
  document.getElementById('ref_name').innerHTML = name
  document.getElementById('ref_size').innerHTML = (Math.round(data.length / 1024)) + ' KiB'
  document.getElementById('ref_timestamp').innerHTML = oreqmRef.getTime()
  const gr = compareOreqm(oreqmMain, oreqmRef)
  setDoctypeCountShown(gr.doctypeDict, gr.selectedDict)
  displayDoctypesWithCount(oreqmMain.getDoctypes())
  filterChange()
  setWindowTitle(`${oreqmMain.filename} vs. ${oreqmRef.filename}`)
}

/**
 * Load reference oreqm file. Main oreqm file is expected to be present.
 * @param {string} file
 */
function loadFileRefFs (file) {
  // Load reference file
  // istanbul ignore else
  if (oreqmMain) {
    spinnerShow()

    // read file synchronously
    let data = fs.readFileSync(file, 'UTF-8')
    processDataRef(file, data)
    if (vr2xHandler) {
      vr2xHandler()
    }

    // read file asynchronously
    // fs.readFile(file, 'UTF-8', (err, data) => {
    //   console.log("loadFileRefFs readfile done")
    //   processDataRef(file, data)
    //   if (vr2xHandler) {
    //     vr2xHandler()
    //   }
    // })
  }
}

document.getElementById('get_ref_oreqm_file').addEventListener('click', async function () {
  await getRefOreqmFile()
})

/**
 * Interactive selection of input file
 */
async function getRefOreqmFile () {
  //rq: ->(rq_filesel_ref_oreqm)
  const filePath = await ipcRenderer.invoke('dialog.showOpenDialogSync',
    {
      filters: [{ name: 'OREQM files', extensions: ['oreqm'] }],
      properties: ['openFile']
    })
  // console.log(filePath);
  if (typeof (filePath) !== 'undefined' && (filePath.length === 1)) {
    loadFileRefFs(filePath[0])
  }
}

document.getElementById('invert_exclude').addEventListener('click', function () {
  invertExclude()
})

/**
 * Toggle each doctype exclusion individually
 */
function invertExclude () {
  // Invert the exclusion status of all doctypes
  // istanbul ignore else
  if (oreqmMain) {
    const doctypes = oreqmMain.getDoctypes()
    const names = doctypes.keys()
    for (const doctype of names) {
      const box = document.getElementById(`doctype_${doctype}`)
      box.checked = !box.checked
    }
    doctypeFilterChange()
  }
}

document.getElementById('filter_graph').addEventListener('click', function () {
  filterGraph()
})

// Combobox handler
document.getElementById('nodeSelect').addEventListener('change', function () {
  // Select node from drop-down
  setSelectedIndex(document.getElementById('nodeSelect').selectedIndex)
  if (document.getElementById('single_select').checked) {
    //rq: ->(rq_single_view)
    // Generate new diagram with *single* selected node
    graphResults([selectedNodes[selectedIndex]], false)
    updateDiagram(selectedFormat)
  } else {
    clearSelectionHighlight()
    centerNode(selectedNodes[selectedIndex])
  }
})

document.getElementById('prev_selected').addEventListener('click', function () {
  //rq: ->(rq_navigate_sel)
  prevSelected()
})

document.getElementById('next_selected').addEventListener('click', function () {
  //rq: ->(rq_navigate_sel)
  nextSelected()
})

document.getElementById('copy_selected').addEventListener('click', function () {
  copySelected()
})

/**
 * Put list of selected <id>s on clipboard as text
 */
function copySelected () {
  //rq: ->(rq_selected_clipboard)
  let txt = ''
  if (oreqmMain && selectedNodes.length) {
    txt = selectedNodes.join('\n')+'\n'
  }
  clipboard.writeText(txt)
}

document.getElementById('single_select').addEventListener('change', function () {
  if (document.getElementById('single_select').checked) {
    graphResults([selectedNodes[selectedIndex]], false)
  } else {
    graphResults(selectedNodes, false)
  }
  updateDiagram(selectedFormat)
})

document.getElementById('clear_ref_oreqm').addEventListener('click', function () {
  clearReferenceOreqm()
})

function clearReferenceOreqm () {
  if (oreqmRef) {
    clearOreqmRef()
    clearHtmlTable()
    updateDoctypeTable()
    document.getElementById('ref_name').innerHTML = ''
    document.getElementById('ref_size').innerHTML = ''
    document.getElementById('ref_timestamp').innerHTML = ''
    filterChange()
  }
  setWindowTitle(oreqmMain.filename)
}

// Setup for the "about" dialog
const aboutPane = document.getElementById('aboutPane')

// Get the button that opens the modal
const aboutButton = document.getElementById('aboutButton')

// Get the <span> element that closes the modal
const aboutPaneClose = document.getElementById('aboutPaneClose')

function showAbout () {
  aboutPane.style.display = 'block'
}

// When the user clicks the button, open the modal
aboutButton.onclick = function () {
  showAbout()
}

// When the user clicks on <span> (x), close the modal
aboutPaneClose.onclick = function () {
  aboutPane.style.display = 'none'
}

// When the user clicks anywhere outside of the modal, close it
// istanbul ignore else
window.onbeforeunload = function () {
  // "Graph is going away..."
}

// When the user clicks the button, open the modal
document.getElementById('issuesButton').onclick = function () {
  showProblems()
}

function showProblems () {
  // Show problems colleced in oreqmMain
  const ref = document.getElementById('problem_list')
  const headerMain = '\n<h2>Detected problems</h2>\n'
  let problemTxt = 'Nothing to see here...'
  if (oreqmMain) {
    problemTxt = xmlEscape(oreqmMain.getProblems())
  }
  ref.innerHTML = `${headerMain}<pre id="raw_problems">${problemTxt}</pre>`
  problemPopup.style.display = 'block'
}

function clearProblems () {
  // istanbul ignore else
  if (oreqmMain) {
    oreqmMain.clearProblems()
    document.getElementById('issueCount').innerHTML = 0
    showProblems()
  }
}

// Setup for the raw node display dialog (raw text and diff (for changed reqs))
// Get the <span> element that closes the modal
const problemPopupClose = document.getElementById('problemPopupClose')

// When the user clicks on <span> (x), close the modal
problemPopupClose.onclick = function () {
  problemPopup.style.display = 'none'
}

const settingsPopup = document.getElementById('settingsPopup')

const settingsPopupClose = document.getElementById('settingsPopupClose')

// When the user clicks on <span> (x), close the modal
settingsPopupClose.onclick = function () {
  settingsPopup.style.display = 'none'
}

// When the user clicks anywhere outside of the modal, close it
window.onbeforeunload = function () {
  // "Graph is going away..."
}

const problemPopup = document.getElementById('problemPopup')

// When the user clicks anywhere outside one of the modal dialogs, close it
window.onclick = function (event) {
  if (event.target === aboutPane) {
    aboutPane.style.display = 'none'
  } else if (event.target === nodeSource) {
    nodeSource.style.display = 'none'
  } else if (event.target === problemPopup) {
    problemPopup.style.display = 'none'
  } else if (event.target === settingsPopup) {
    settingsPopup.style.display = 'none'
  }
}

document.getElementById('menu_exclude').addEventListener('click', function () {
  excludeId()
})

document.getElementById('clear_search_regex').addEventListener('click', function () {
  clearSearchRegex()
})

function clearSearchRegex () {
  document.getElementById('search_regex').value = ''
  filterChange()
}

document.getElementById('clear_excluded_ids').addEventListener('click', function () {
  clearExcludedIds()
})

function clearExcludedIds () {
  document.getElementById('excluded_ids').value = ''
  filterChange()
}

/** Drag and drop file handling main */
const dropAreaMain = document.getElementById('drop_area_main')
const dropAreaOutput = document.getElementById('output')
/** Drag and drop file handling reference */
const dropAreaRef = document.getElementById('drop_area_ref');

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropAreaMain.addEventListener(eventName, preventDefaults, false)
  dropAreaOutput.addEventListener(eventName, preventDefaults, false)
  dropAreaRef.addEventListener(eventName, preventDefaults, false)
  document.body.addEventListener(eventName, preventDefaults, false)
})

// Highlight drop area when item is dragged over it
;['dragenter', 'dragover'].forEach(eventName => {
  dropAreaMain.addEventListener(eventName, highlightMain, false)
  dropAreaOutput.addEventListener(eventName, highlightOutput, false)
  dropAreaRef.addEventListener(eventName, highlightRef, false)
})

;['dragleave', 'drop'].forEach(eventName => {
  dropAreaMain.addEventListener(eventName, unhighlightMain, false)
  dropAreaOutput.addEventListener(eventName, unhighlightOutput, false)
  dropAreaRef.addEventListener(eventName, unhighlightRef, false)
})

// istanbul ignore next
dropAreaMain.addEventListener('drop', (event) => {
  //rq: ->(rq_drop_main_oreqm)
  event.stopPropagation()
  event.preventDefault()
  // console.log(event.dataTransfer.files);
  processDroppedFile(event, true)
})

// istanbul ignore next
dropAreaOutput.addEventListener('drop', (event) => {
  //rq: ->(rq_drop_main_oreqm)
  event.stopPropagation()
  event.preventDefault()
  processDroppedFile(event, true)
})

// istanbul ignore next
dropAreaRef.addEventListener('drop', (event) => {
  //rq: ->(rq_drop_ref_oreqm)
  event.stopPropagation()
  event.preventDefault()
  // console.log(event.dataTransfer.files);
  processDroppedFile(event, false)
})

// istanbul ignore next
function preventDefaults (e) {
  e.preventDefault()
  e.stopPropagation()
}

// istanbul ignore next
function highlightMain () {
  dropAreaMain.classList.add('highlight')
}

// istanbul ignore next
function highlightOutput () {
  dropAreaOutput.classList.add('highlight')
}

// istanbul ignore next
function highlightRef () {
  if (oreqmMain) {
    dropAreaRef.classList.add('highlight')
  }
}

// istanbul ignore next
function unhighlightMain () {
  dropAreaMain.classList.remove('highlight')
}

// istanbul ignore next
function unhighlightOutput () {
  dropAreaOutput.classList.remove('highlight')
}

// istanbul ignore next
function unhighlightRef () {
  dropAreaRef.classList.remove('highlight')
}

// istanbul ignore next
// Main oreqm file
dropAreaMain.addEventListener('dragover', (event) => {
  event.stopPropagation()
  event.preventDefault()
  // Style the drag-and-drop as a "copy file" operation.
  event.dataTransfer.dropEffect = 'copy'
})

// istanbul ignore next
// Reference oreqm file
dropAreaRef.addEventListener('dragover', (event) => {
  event.stopPropagation()
  event.preventDefault()
  // Style the drag-and-drop as a "copy file" operation.
  if (oreqmMain) {
    event.dataTransfer.dropEffect = 'copy'
  } else {
    event.dataTransfer.dropEffect = 'none'
  }
})

// istanbul ignore next
document.addEventListener('dragover', (event) => {
  event.stopPropagation()
  event.preventDefault()
  event.dataTransfer.dropEffect = 'none'
})

// istanbul ignore next
/**
 * Process dropped file, if there is just one file
 * @param {object} ev
 * @param {boolean} mainFile true: main file, false: reference file
 */
function processDroppedFile (ev, mainFile) {
  let droppedFile
  let count = 0
  let i = 0
  if (ev.dataTransfer.items) {
    // Use DataTransferItemList interface to access the file(s)
    for (i = 0; i < ev.dataTransfer.items.length; i++) {
      // If dropped items aren't files, reject them
      if (ev.dataTransfer.items[i].kind === 'file') {
        count++
        const file = ev.dataTransfer.items[i].getAsFile()
        // console.log('... file[' + i + '].name = ' + file.name);
        droppedFile = file
      }
    }
  } else {
    // Use DataTransfer interface to access the file(s)
    for (i = 0; i < ev.dataTransfer.files.length; i++) {
      // console.log('... file[' + i + '].name = ' + ev.dataTransfer.files[i].name);
      droppedFile = ev.dataTransfer.files[i]
      count++
    }
  }
  // Check file. Only one, either .oreqm or .vrm2x
  if (count === 1) {
    const filename = droppedFile.path.length ? droppedFile.path : droppedFile.name
    if (filename.endsWith('.vr2x')) {
      loadDiagramContext(filename)
    } else if (filename.endsWith('.oreqm')) {
      if (mainFile) {
        loadFileMainFs(filename)
      } else {
        loadFileRefFs(filename)
      }
    }
  }
}

// Doctype hierarchy button handler
document.getElementById('show_doctypes').addEventListener('click', function () {
  showDoctypes()
})

// Safety button handler
document.getElementById('show_doctypes_safety').addEventListener('click', function () {
  showDoctypesSafety()
})

document.getElementById('menu_xml_txt').addEventListener('click', function () {
  //rq: ->(rq_ctx_show_xml)
  showSource()
})

/**
 * Context menu handler to show internal tagged search format
 */
document.getElementById('menu_search_txt').addEventListener('click', function () {
  showInternal()
})

document.getElementById('save_problems').addEventListener('click', async function () {
  await saveProblems()
})

document.getElementById('clear_problems').addEventListener('click', function () {
  clearProblems()
})

/**
 * Update doctype table. Colors associated with doctypes may have changed, therefore cached
 * visualization data is cleared.
 */
function updateDoctypeTable () {
  if (oreqmMain) {
    oreqmMain.clearCache()
    displayDoctypesWithCount(oreqmMain.doctypes)
    // refresh the correct type of diagram
    switch (diagramType) {
    case diagramTypeSpecobjects:
      filterChange()
      break

    case diagramTypeDoctypes:
      showDoctypes()
      break

    case diagramTypeSafety:
      showDoctypesSafety()
      break
    }
  }
}

/**
 * Compare two oreqm files, each represented as objects.
 * The main object will have visualization elements added and default diff related search terms are added.
 * @param {object} oreqmMain
 * @param {object} oreqmRef
 * @return {object} diff graph
 */
function compareOreqm (oreqmMain, oreqmRef) {
  // Both main and reference oreqm have been read.
  // Highlight new, changed and removed nodes in main oreqm (removed are added as 'ghosts')
  // eslint-disable-next-line no-unused-vars
  const results = oreqmMain.compareRequirements(oreqmRef, getIgnoredFields())
  const newSearchArray = []
  let rawSearch = document.getElementById('search_regex').value.trim()
  // This is a hack, these prefixes are a hidden part of 'delta' reqs <id>, and a search term is constructed to find them
  // Also avoid adding them more than once.
  if (!rawSearch.includes('new:')) newSearchArray.push('new:')
  if (!rawSearch.includes('chg:')) newSearchArray.push('chg:')
  if (!rawSearch.includes('rem:')) newSearchArray.push('rem:')
  const newSearch = newSearchArray.join('|')
  if (newSearchArray.length && rawSearch) {
    if (searchLanguage === 'vql') {
      rawSearch = rawSearch + '\nor ' + newSearchArray.join(' or ')
    } else {
      rawSearch = newSearch + '|\n' + rawSearch
    }
  } else if (newSearch.length) {
    rawSearch = searchLanguage === 'vql' ? newSearchArray.join(' or ') : newSearch
  }
  document.getElementById('search_regex').value = rawSearch
  // console.log(results)
  const graph = oreqmMain.createGraph(selectColor,
    programSettings.top_doctypes,
    oreqmMain.constructGraphTitle(true, null, oreqmRef, searchLanguage, searchPattern),
    [],
    programSettings.max_calc_nodes,
    programSettings.show_coverage,
    programSettings.color_status)
  setIssueCount()
  return graph
}

/* auto-update logic */

const notification = document.getElementById('notification')
const autoUpdateMessage = document.getElementById('auto-update-message')
const restartButton = document.getElementById('restart-button')

// istanbul ignore next
ipcRenderer.on('update_available', () => {
  ipcRenderer.removeAllListeners('update_available')
  autoUpdateMessage.innerText = 'A new update is available. Downloading now...'
  notification.classList.remove('hidden')
})

// istanbul ignore next
ipcRenderer.on('update_downloaded', () => {
  ipcRenderer.removeAllListeners('update_downloaded')
  autoUpdateMessage.innerText = 'Update Downloaded. It will be installed on restart. Restart now?'
  restartButton.classList.remove('hidden')
  notification.classList.remove('hidden')
})

// istanbul ignore next
function closeNotification () {
  notification.classList.add('hidden')
}

// istanbul ignore next
function restartApp () {
  ipcRenderer.send('restart_app')
}

// istanbul ignore next
document.getElementById('close-button').addEventListener('click', function () {
  closeNotification()
})

// istanbul ignore next
document.getElementById('restart-button').addEventListener('click', function () {
  restartApp()
})

// Open https:// urls in external browser
if (document.readyState !== 'complete') {
  document.addEventListener('DOMContentLoaded', function () {
    prepareTags()
  }, false)
} else {
  // istanbul ignore next
  prepareTags()
}

// istanbul ignore next
function urlClickHandler (e, url) {
  e.preventDefault()
  document.shellOpenExternal(url)
}

/**
 * Make URLs clickable
 */
function prepareTags () {
  document.urlClickHandler = urlClickHandler
  document.shellOpenExternal = shell.openExternal
  const aTags = document.getElementsByTagName('a')
  for (let i = 0; i < aTags.length; i++) {
    // console.log(aTags[i])
    // aTags[i].setAttribute("onclick", "require('shell').openExternal('" + aTags[i].href + "')");
    aTags[i].setAttribute('onclick', "document.urlClickHandler(event, '" + aTags[i].href + "')")
    aTags[i].href = '#'
  }
  return false
}

/**
 * Get latest release tag from github and check against this version.
 * Update 'About' dialog with release version and set button green.
 */
function checkNewerReleaseAvailable () {
  //rq: ->(rq_check_github_release)
  const options = {
    hostname: 'api.github.com',
    port: 443,
    path: '/repos/mox17/visual-reqm2-electron/releases/latest',
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'com.mox17.visualreqm2'
    }
  }

  https.get(options, (resp) => {
    let data = ''

    resp.on('data', (chunk) => {
      data += chunk
    })

    resp.on('end', async () => {
      const latestRel = JSON.parse(data)
      // console.log(latest_rel.explanation);
      latestVersion = latestRel.name
      // console.log(latest_version);
      if (latestVersion !== await ipcRenderer.invoke('app.getVersion')) {
        aboutButton.style.background = '#00FF00'
      }
      document.getElementById('latest_release').innerHTML = ` available for download is ${latestVersion}`
      if (latestVersion > await ipcRenderer.invoke('app.getVersion')) {
        myShowToast(`A newer version ${latestVersion} is available for download</br>Open <b>[About]</b> for more information`)
      }
    })
  }).on('error', (err) => {
    console.log('Error: ' + err.message)
  })
}

/**
 * Helper function to save coverage data for unit tests
 */
window.addEventListener('unload', function(_event) {
  // istanbul ignore else
  if (window.__coverage__) {
    let name = `.nyc_output/renderer_${uuidv4()}.json`
    //fs.writeFileSync('xyz.json', process.env.NYC_CONFIG);
    // istanbul ignore else
    if (process.env.NYC_CONFIG) {
      let cfg = JSON.parse(process.env.NYC_CONFIG)
      // istanbul ignore else
      if (cfg.tempDir !== undefined) {
        // Use uuid as name to allow for several runs to coexist in same coverage report
        name = `${cfg.tempDir}/renderer_${uuidv4()}.json`
      }
    }
    console.log(`Found coverage report, writing to ${name}`);
    fs.writeFileSync(name, JSON.stringify(window.__coverage__));
  }
})

// istanbul ignore next
function showReadme () {
  open('https://github.com/mox17/visual-reqm2-electron#readme')
}

// istanbul ignore next
function showVqlHelp () {
  open('https://github.com/mox17/visual-reqm2-electron/blob/main/doc/VQL.md')
}
