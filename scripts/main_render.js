'use strict'
// eslint-disable-next-line no-redeclare
/* global DOMParser, Event, Split, alert, svgPanZoom, Diff, ClipboardItem  */
import { xml_escape, set_limit_reporter } from './diagrams.js'
import { get_color, save_colors_fs, load_colors_fs } from './color.js'
import { handle_settings, load_safety_rules_fs, open_settings, save_program_settings } from './settings_dialog.js'
import { get_ignored_fields, program_settings } from './settings.js'
import { ipcRenderer, remote, shell, clipboard } from 'electron'
import { base64StringToBlob } from 'blob-util'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import https from 'https'
import {
  settings_updated, oreqm_main, oreqm_ref, save_diagram_file, select_color,
  svg_result, create_oreqm_main, create_oreqm_ref,
  convert_svg_to_png, clear_oreqm_ref
} from './main_data.js'
import { search_tooltip } from './reqm2oreqm.js'
import { get_time_now, log_time_spent } from './util'
import { search_language, set_search_language, search_regex_validate, set_search_language_hints,
         set_search_language_buttons, search_pattern, excluded_doctypes, set_excluded_doctypes } from './search'
import { cmd_line_parameters, check_cmd_line_steps } from './cmdline'
import { show_doctypes_safety, show_doctypes, selected_format, clear_html_table, update_diagram,
         clear_diagram, spinner_show, selected_nodes,
         selected_node, panZoom, next_selected, prev_selected, selected_index,
         set_selected_index, graph_results, center_node, set_doctype_count_shown, clear_doctypes_table,
         clear_selection_highlight, filter_change, filter_graph, auto_update, set_auto_update,
         report_limit_as_toast, show_toast, set_excluded_doctype_checkboxes, toggle_exclude,
         doctype_filter_change } from './show_diagram'
import { set_issue_count } from './issues'
import { copy_id_node, menu_deselect, add_node_to_selection } from './context-menu.js'
const open = require('open')

const mainWindow = remote.getCurrentWindow()

const beforeUnloadMessage = null

/** Version available on github.com */
let latest_version = 'unknown'

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
ipcRenderer.on('about', (_item, _window, _key_ev) => {
  show_about()
})

ipcRenderer.on('readme', (_item, _window, _key_ev) => {
  show_readme()
})

ipcRenderer.on('vql_help', (_item, _window, _key_ev) => {
  show_vql_help()
})

ipcRenderer.on('load_main_oreqm', (_item, _window, _key_ev) => {
  get_main_oreqm_file()
})

ipcRenderer.on('load_ref_oreqm', (_item, _window, _key_ev) => {
  get_ref_oreqm_file()
})

ipcRenderer.on('save_colors', (_item, _window, _key_ev) => {
  save_colors_fs()
})

ipcRenderer.on('load_colors', (_item, _window, _key_ev) => {
  load_colors_fs(update_doctype_table)
})

ipcRenderer.on('load_safety', (_item, _window, _key_ev) => {
  load_safety_rules_fs()
})

ipcRenderer.on('save_diagram_as', (_item, _window, _key_ev) => {
  menu_save_as()
})

ipcRenderer.on('save_issues_as', (_item, _window, _key_ev) => {
  save_problems()
})

ipcRenderer.on('show_issues', (_item, _window, _key_ev) => {
  show_problems()
})

ipcRenderer.on('open_settings', (_item, _window, _key_ev) => {
  open_settings()
})

ipcRenderer.on('save_diagram_ctx', (_item, _window, _key_ev) => {
  save_diagram_ctx()
})

ipcRenderer.on('load_diagram_ctx', (_item, _window, _key_ev) => {
  load_diagram_ctx()
})

ipcRenderer.on('save_diagram_sel', (_item, _window, _key_ev) => {
  save_diagram_sel()
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
    next_selected()
  }
})

// istanbul ignore next
ipcRenderer.on('selected_prev', () => {
  // istanbul ignore next
  if (document.getElementById('svg_output')) {
    prev_selected()
  }
})

// istanbul ignore next
ipcRenderer.on('filter_graph', () => {
  // istanbul ignore next
  if (document.getElementById('svg_output')) {
    filter_graph()
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
function find_file (name) {
  let new_path = ''
  // istanbul ignore else
  if (fs.existsSync(name)) {
    return name
  }
  // istanbul ignore next
  if (process.env.PORTABLE_EXECUTABLE_APP_FILENAME) {
    // File not found, we are running as portable, so try to find PWD
    if (process.env.PWD) {
      const test_path = path.join(process.env.PWD, name)
      if (fs.existsSync(test_path)) {
        console.log(`Found file at ${test_path}`)
        new_path = test_path
      }
    } else {
      process.stderr.write(`File not found '${name}'\n${process.env.PORTABLE_EXECUTABLE_APP_FILENAME} is running as 'portable'. Add PWD to environment to allow relative paths for input files or specify absolute paths.`)
    }
  }
  // istanbul ignore next
  return new_path
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
  set_limit_reporter(report_limit_as_toast)
  handle_settings(settings_updated, args)
  set_search_language_buttons(program_settings.search_language)

  document.getElementById('search_tooltip').innerHTML = search_tooltip(search_language)

  // istanbul ignore else
  if ((args.newVer !== false) && (args.newVer === true || program_settings.check_for_updates)) {
    check_newer_release_available()
  }
  cmd_line_parameters(args)
  if (args.oreqm_main !== undefined && args.oreqm_main.length > 0) {
    //rq: ->(rq_one_oreqm_cmd_line)
    const check_main = find_file(args.oreqm_main)
    // istanbul ignore else
    if (check_main.length) {
      args.oreqm_main = check_main
    }
    const main_stat = fs.existsSync(args.oreqm_main) ? fs.statSync(args.oreqm_main) : null
    if (main_stat && main_stat.isFile()) {
      main = true
    } else {
      console.log('Not a file.', args.oreqm_main)
      console.log('Cur dir:', process.cwd())
      ok = false
    }
  }
  if (args.oreqm_ref !== undefined && args.oreqm_ref.length > 0) {
    //rq: ->(rq_two_oreqm_cmd_line)
    const check_ref = find_file(args.oreqm_ref)
    // istanbul ignore else
    if (check_ref.length) {
      args.oreqm_ref = check_ref
    }
    const ref_stat = fs.existsSync(args.oreqm_ref) ? fs.statSync(args.oreqm_ref) : null
    if (ref_stat && ref_stat.isFile()) {
      // console.log(args.oreqm_ref, ref_stat);
      ref = true
    } else {
      console.log('Not a file.', args.oreqm_ref)
      ok = false
    }
  }
  if (ok && main) {
    // console.log("render files:", args.oreqm_main, args.oreqm_ref)
    load_file_main_fs(args.oreqm_main, ref ? args.oreqm_ref : null)
  } else if (args.context !== undefined && args.context.length > 0) {
    // Check for context file (exclusive with oreqm_main & oreqm_ref)
    const check_context = find_file(args.context)
    // console.log("render context:", args.context)
    // istanbul ignore else
    if (check_context.length) {
      args.context = check_context
    }
    const ctx_stat = fs.existsSync(args.context) ? fs.statSync(args.context) : null
    if (ctx_stat && ctx_stat.isFile()) {
      load_diagram_context(args.context)
    }
  }
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
    check_cmd_line_steps()
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
    load_file_main_fs(path, null)
  } else {
    load_file_ref_fs(path)
  }
})

document.getElementById('prog_version').innerHTML = remote.app.getVersion()
document.getElementById('auto_update').checked = auto_update

window.addEventListener('beforeunload', function () {
  return beforeUnloadMessage
})

// Selection/deselection of nodes by right-clicking the diagram
document.getElementById('menu_select').addEventListener('click', function () {
  // Add node to the selection criteria (if not already selected)
  //rq: ->(rq_ctx_add_selection)
  add_node_to_selection(selected_node)
})

/** Context menu handler  */
document.getElementById('menu_deselect').addEventListener('click', function () {
  menu_deselect()
})

// Context menu handler
document.getElementById('menu_copy_id').addEventListener('click', function () {
  copy_id_node(false)
})

// Context menu handler
document.getElementById('menu_copy_ffb').addEventListener('click', function () {
  copy_id_node(true)
})

/*
  document.getElementById('menu_copy_svg').addEventListener("click", function() {
    copy_svg2()
  }); */

/**
 * Copy svg image to clipboard as <img src="data:image/svg;base64,..." width="" height="" alt="diagram" />
 */
/*
  function copy_svg () {
    let clip_txt = `<img src="data:image/svg;base64,${
      btoa(svg_result)}" width="${
      svg_element.getAttribute('width')}" height="${
      svg_element.getAttribute('height')}" alt="diagram"/>`
    const ta = document.createElement('textarea'); // 'img' ??
    ta.value = clip_txt
    ta.setAttribute('readonly', '');
    ta.style = { position: 'absolute', left: '-9999px' };
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  */

/*
  function copy_svg2 () {
    var image_blob = arrayBufferToBlob(svg_result, 'image/svg+xml')
    console.log(image_blob)
    let item = new ClipboardItem({'image/svg+xml': image_blob})
    console.log(item)
    navigator.clipboard.write([item]).then(function() {
      console.log("Copied to clipboard successfully!");
    }, function(error) {
      console.error("unable to write to clipboard. Error:");
      console.log(error);
    })
  }
  */

/** context menu item handler. Copy diagram as png to clipboard */
document.getElementById('menu_copy_png').addEventListener('click', function () {
  copy_png() //rq: ->(rq_ctx_copy_png)
})

function copy_png () {
  convert_svg_to_png(svg_result, png_callback)
}

/**
 * Create binary blob of png and put on clipboard
 * @param {null} ev event
 * @param {string} png image as string
 */
function png_callback (ev, png) {
  // istanbul ignore else
  if (ev === null) {
    const image_blob = base64StringToBlob(png.src.slice(22), 'image/png')
    // console.log(image_blob)
    const item = new ClipboardItem({ 'image/png': image_blob })
    // console.log(item)
    navigator.clipboard.write([item]).then(function () {
      // console.log("Copied to clipboard successfully!");
    }, function (_error) {
      // console.error("unable to write to clipboard. Error:");
      // console.log(_error);
    })
  }
}

/** context menu handler - save diagram as */
document.getElementById('menu_save_as').addEventListener('click', function () {
  menu_save_as()
})

function menu_save_as () {
  const save_options = {
    filters: [
      { name: 'SVG files', extensions: ['svg'] }, //rq: ->(rq_save_svg_file)
      { name: 'PNG files', extensions: ['png'] }, //rq: ->(rq_save_png_file)
      { name: 'DOT files', extensions: ['dot'] }
    ],
    properties: ['openFile']
  }
  const savePath = remote.dialog.showSaveDialogSync(null, save_options)
  // istanbul ignore else
  if (typeof (savePath) !== 'undefined') {
    save_diagram_file(savePath)
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
function save_diagram_ctx () {
  let defPath = ""
  if (oreqm_main) {
    if (path.isAbsolute(oreqm_main.filename)) {
      defPath = path.dirname(oreqm_main.filename)
    } else {
      defPath = path.join(process.cwd(), path.dirname(oreqm_main.filename))
    }
  }

  const save_options = {
    filters: [
      { name: 'ReqM2 context files', extensions: ['vr2x'] }
    ],
    properties: ['openFile'],
    defaultPath: defPath,
    title: "Save ReqM2 context file"

  }
  // Suggest to save in same directory as oreqm_main
  const savePath = remote.dialog.showSaveDialogSync(null, save_options)
  // istanbul ignore else
  if (typeof (savePath) !== 'undefined') {
    save_diagram_context(savePath)
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
function load_diagram_ctx () {
  let LoadPath = remote.dialog.showOpenDialogSync(
    {
      filters: [{ name: 'ReqM2 context files', extensions: ['vr2x'] }],
      properties: ['openFile'],
      defaultPath: process.cwd(),
      title: "Load ReqM2 context file"
    })
  if (LoadPath) {
    load_diagram_context(LoadPath[0])
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
function save_diagram_context (ctxPath) {
  if (oreqm_main) {
    let absPath_main = calcAbsPath(oreqm_main.filename)
    // Make context file relative paths portable between Linux and Windows
    let relPath = path.relative(path.dirname(ctxPath), absPath_main).replaceAll('\\', '/')
    if (relPath[0] !== '.') {
      relPath = './' + relPath
    }
    let absPath_ref = ""
    let relPath_ref = ""
    if (oreqm_ref) {
      absPath_ref = calcAbsPath(oreqm_ref.filename)
      relPath_ref = path.relative(path.dirname(ctxPath), absPath_ref).replaceAll('\\', '/')
      if (relPath_ref[0] !== '.') {
        relPath_ref = './' + relPath_ref
      }
    }

    let diagCtx = {
      version: 2,
      main_oreqm_rel: relPath,
      ref_oreqm_rel: relPath_ref,
      no_rejects: document.getElementById('no_rejects').checked,
      search_language: search_language,
      search_regex: document.getElementById('search_regex').value,
      excluded_ids: document.getElementById('excluded_ids').value,
      limit_depth_input: document.getElementById('limit_depth_input').checked,
      excluded_doctypes: oreqm_main.get_excluded_doctypes(),
      // Settings here
      settings: {
        compare_fields: program_settings.compare_fields,
        safety_link_rules: program_settings.safety_link_rules,
        show_errors: program_settings.show_errors,
        show_coverage: program_settings.show_coverage,
        color_status: program_settings.color_status
      }
    }
    let json_ctx = JSON.stringify(diagCtx, null, 2)
    console.log(json_ctx)
    fs.writeFileSync(ctxPath, json_ctx, 'utf8')
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
function load_diagram_context (ctxPath) {
  // suppress display updates while loading context
  let save_auto = auto_update
  set_auto_update(false)
  let diagCtx = JSON.parse(fs.readFileSync(ctxPath, { encoding: 'utf8', flag: 'r' }))
  let ctxDir = path.dirname(ctxPath)
  let main_rel_path = path.join(ctxDir, diagCtx.main_oreqm_rel).replaceAll('\\', '/')
  let ref_rel_path = null

  let main_rel = fs.existsSync(main_rel_path)
  let load_ref = diagCtx.ref_oreqm_rel !== ""
  let ref_rel = false
  // Set up async handler for context load
  vr2x_handler = vr2x_handler_func
  // Set up a handler to restore parameters when load of oreqm file(s) complete
  vr2x_ctx = {
    diagCtx: diagCtx,
    auto_update: save_auto
  }
  if (!path.isAbsolute(main_rel_path) && main_rel_path[0] !== '.') {
    main_rel_path = './' + main_rel_path
  }
  if (load_ref) {
    ref_rel_path = path.join(ctxDir, diagCtx.ref_oreqm_rel).replaceAll('\\', '/')
    ref_rel = fs.existsSync(ref_rel_path)
    if (ref_rel && !path.isAbsolute(ref_rel_path) && ref_rel_path[0] !== '.') {
      ref_rel_path = './' + ref_rel_path
    }
  }
  if (main_rel && load_ref && ref_rel) {
    // both relative paths OK
    load_file_main_fs(main_rel_path, ref_rel_path)
  } else if (main_rel && !load_ref) {
    // main rel only
    load_file_main_fs(main_rel_path, null)
  } else {
    set_auto_update(save_auto)
    // display error message
    let msg = "Could not open:\n"
    if (load_ref) {
      msg += main_rel ? "" : main_rel_path + '\n'
      msg += ref_rel ? "" : ref_rel_path + '\n'
    } else {
      msg += main_rel_path + '\n'
    }
    msg = msg.replace(/([^\n]{35,400}?(\/|\\))/g, '$1\n  ')
    ipcRenderer.send('cmd_show_error', "ReqM2 Context file", msg)
    return
  }
}

let vr2x_handler = null
let vr2x_ctx = null

/**
 * Async handler called after loading of oreqm file(s)
 * to set search parameters and settings
 */
function vr2x_handler_func () {
  update_settings_from_context(vr2x_ctx.diagCtx)
  restoreContextAttributes(vr2x_ctx.diagCtx)
  set_excluded_doctype_checkboxes()
  set_auto_update(vr2x_ctx.auto_update)
  filter_change()
  // Clear handler - it only applies to context loads
  vr2x_handler = null
}

/**
 * Restore the attributes stored in the context object
 * @param {object} ctx
 */
function restoreContextAttributes (ctx) {
  document.getElementById('no_rejects').checked = ctx.no_rejects
  // Handle version differences in file formats
  if (ctx.version === 1) {
    set_search_language(document.getElementById('id_checkbox_input').checked ? 'ids' : 'reg')
  } else if (ctx.version === 2) {
    set_search_language(ctx.search_language)
  }
  document.getElementById('search_regex').value = ctx.search_regex
  document.getElementById('excluded_ids').value = ctx.excluded_ids
  document.getElementById('limit_depth_input').checked = ctx.limit_depth_input
  oreqm_main.set_excluded_doctypes(ctx.excluded_doctypes)
  set_search_language_buttons(search_language)
}

/**
 * Update settings found in context file (these are not ALL settings)
 * @param {object} ctx
 */
function update_settings_from_context (ctx) {
  for (const key in ctx.settings.compare_fields) {
    if (program_settings.compare_fields[key] !== ctx.settings.compare_fields[key]) {
      console.log(key, program_settings.compare_fields[key], ctx.settings.compare_fields[key])
    }
    program_settings.compare_fields[key] = ctx.settings.compare_fields[key]
  }

  if (program_settings.safety_link_rules != ctx.settings.safety_link_rules) {
    //console.log("safety_link_rules", program_settings.safety_link_rules, ctx.settings.safety_link_rules)
  }
  program_settings.safety_link_rules = ctx.settings.safety_link_rules

  if (program_settings.show_errors !== ctx.settings.show_errors) {
    console.log("show_errors", program_settings.show_errors, ctx.settings.show_errors)
  }
  program_settings.show_errors = ctx.settings.show_errors

  if (program_settings.show_coverage !== ctx.settings.show_coverage) {
    console.log("show_coverage", program_settings.show_coverage, ctx.settings.show_coverage)
  }
  program_settings.show_coverage = ctx.settings.show_coverage

  if (program_settings.color_status !== ctx.settings.color_status) {
    console.log("color_status", program_settings.color_status, ctx.settings.color_status)
  }
  program_settings.color_status = ctx.settings.color_status
}

/**
 * Save diagram selection will save a text file with
 * the ids and doctypes of the selected nodes and the set of ancestors
 * (also id and doctype) from the current diagram.
 */
 function save_diagram_sel () {
  let defPath = ""
  if (oreqm_main) {
    if (path.isAbsolute(oreqm_main.filename)) {
      defPath = path.dirname(oreqm_main.filename)
    } else {
      defPath = path.join(process.cwd(), path.dirname(oreqm_main.filename))
    }
  } else {
    return
  }

  const save_options = {
    filters: [
      { name: 'ReqM2 select files (csv)', extensions: ['csv'] }
    ],
    properties: ['openFile'],
    defaultPath: defPath,
    title: "Save ReqM2 selection file"
  }

  // Suggest to save in same directory as oreqm_main
  const savePath = remote.dialog.showSaveDialogSync(null, save_options)
  // istanbul ignore else
  if (typeof (savePath) !== 'undefined') {
    save_diagram_selection(savePath)
  }
}

/**
 * Get the system list separator, which is needed for csv files (on this machine)
 * @returns separator, i.e. ';' for some european locales or ','
 */
function get_list_separator () {
  const list = ['a', 'b'];
  const s = list.toLocaleString();
  const sep = s[1];
  return sep
}

function save_diagram_selection (pathname) {
  // List of selected nodes
  const comma = get_list_separator()
  let output = `"sel_id"${comma}"sel_dt"${comma}"sel_status"${comma}"errors"${comma}"ancestor_id"${comma}"ancestor_dt"${comma}"ancestor_status"\n`
  for (let s of oreqm_main.subset) {
    let ancestors = oreqm_main.get_ancestors(s, new Set())
    let rec = oreqm_main.requirements.get(s)
    let sel_dt = rec.doctype
    let err_set = new Set()
    for (let m of rec.miscov) {
      err_set.add(`Missing coverage from doctype ${m}`)
    }
    for (let e of rec.errors) {
      err_set.add(`${e.trim()}`)
    }
    for (let f of rec.ffberrors) {
      err_set.add(`${f.trim()}`)
    }
    for (let v of rec.violations) {
      err_set.add(`${v.trim()}`)
    }
    for (let err of err_set) {
      if (ancestors.size > 0) {
        for (let a of ancestors) {
          output += `"${s}"${comma}"${sel_dt}"${comma}"${rec.status}"${comma}"${err}"${comma}"${a.id}"${comma}"${a.doctype}"${comma}"${a.status}"\n`
        }
      } else {
        output += `"${s}"${comma}"${sel_dt}"${comma}"${rec.status}"${comma}"${err}"${comma}${comma}\n`
      }
    }
  }
  fs.writeFileSync(pathname, output, 'utf8')
}

/**
 * Create doctype table with counts and exclusion checkboxes
 * @param {Map<string,string[]>} doctype_dict
 */
function display_doctypes_with_count (doctype_dict) {
  const doctype_names = Array.from(doctype_dict.keys())
  doctype_names.sort()
  const excluded = oreqm_main.get_excluded_doctypes() // so we can tick them again
  // console.log(doctype_names)

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
  cell.addEventListener('change', doctype_filter_all_change)
  let doctype_totals = 0
  for (const doctype_name of doctype_names) {
    row = table.insertRow()
    row.style.backgroundColor = get_color(doctype_name)
    cell = row.insertCell()
    cell.innerHTML = doctype_name

    cell = row.insertCell()
    cell.innerHTML = doctype_dict.get(doctype_name).length
    doctype_totals += doctype_dict.get(doctype_name).length

    cell = row.insertCell()
    cell.innerHTML = `<div id="doctype_shown_${doctype_name}">0</div>`

    cell = row.insertCell()
    cell.innerHTML = `<div id="doctype_select_${doctype_name}">0</div>`

    cell = row.insertCell()
    const checked = excluded.includes(doctype_name)
    // console.log("dt table", doctype_name, checked)
    cell.innerHTML = `<div><input type="checkbox" id="doctype_${doctype_name}" ${checked ? 'checked' : ''}/></div>`
    cell.addEventListener('change', doctype_filter_change)
    cell = null
  }
  // Totals row
  row = table.insertRow()
  cell = row.insertCell()
  cell.innerHTML = 'totals:'

  cell = row.insertCell()
  cell.innerHTML = `<div id="doctype_totals">${doctype_totals}</div>` //rq: ->(rq_totals_stat)

  cell = row.insertCell()
  cell.innerHTML = '<div id="doctype_shown_totals">0</div>'

  cell = row.insertCell()
  cell.innerHTML = '<div id="doctype_select_totals">0</div>'

  document.getElementById('doctype_table').appendChild(table)
}

/** Invert all doctype exclusions and update */
function doctype_filter_all_change () {
  toggle_exclude()
}

document.getElementById('auto_update').addEventListener('click', function () {
  // console.log("auto_update_click")
  set_auto_update(document.getElementById('auto_update').checked)
  filter_change()
})

document.getElementById('id_checkbox_input').addEventListener('change', function () {
  select_search_language('ids')
})

document.getElementById('regex_checkbox_input').addEventListener('change', function () {
  select_search_language('reg')
})

document.getElementById('vql_checkbox_input').addEventListener('change', function () {
  select_search_language('vql')
})

document.getElementById('limit_depth_input').addEventListener('change', function () {
  filter_change()
})

document.getElementById('search_regex').addEventListener('change', function () {
  if (search_regex_validate(this)) {
    filter_change()
  }
})

document.getElementById('search_regex').addEventListener('focus', function () {
  search_regex_validate(this)
})

document.getElementById('search_regex').addEventListener('keyup', function(_ev) {
  search_regex_validate(this)
})

document.getElementById('search_regex').addEventListener('blur', function(_event) {
  // Hide errorbox when focus leaves selection criteria box
  if (this.errorbox) {
    this.errorbox.style.display = 'none';
  }
});

document.getElementById('excluded_ids').addEventListener('change', function () {
  filter_change()
})

/**
 * Handle UI selection of search language
 * @param {string} lang 'ids', 'req' or 'vql' selected in UI
 */
function select_search_language (lang) {
  set_search_language_hints(lang)
  set_search_language(lang)
  program_settings.search_language = search_language
  save_program_settings()
  filter_change()
}

/**
 * Set auto-update status
 * @param {boolean} state true: do auto update, false: user has to trigger update
 */
// eslint-disable-next-line no-unused-vars
function update_auto_update (state) {
  document.getElementById('auto_update').checked = state
  set_auto_update(state)
}

/**
 * Create main oreqm object from XML string
 * @param {string} name filename of oreqm file
 * @param {string} data xml data
 * @param {boolean} Update diagrame when loaded (not wanted if caller has load of a reference file pending.)
 */
function process_data_main (name, data, update) {
  // console.log("process_data_main")
  create_oreqm_main(name, data)
  document.getElementById('name').innerHTML = oreqm_main.filename
  document.getElementById('size').innerHTML = (Math.round(data.length / 1024)) + ' KiB'
  document.getElementById('timestamp').innerHTML = oreqm_main.timestamp
  if (excluded_doctypes.length) {
    oreqm_main.set_excluded_doctypes(excluded_doctypes)
    set_excluded_doctypes([])
  }
  if (oreqm_ref) { // if we have a reference do a compare
    const gr = compare_oreqm(oreqm_main, oreqm_ref)
    set_doctype_count_shown(gr.doctype_dict, gr.selected_dict)
  }
  display_doctypes_with_count(oreqm_main.get_doctypes())
  if (update) {
    if (auto_update) {
      filter_graph()
    } else {
      oreqm_main.set_svg_guide()
      update_diagram(selected_format)
    }
  }
  document.getElementById('get_ref_oreqm_file').disabled = false
  document.getElementById('clear_ref_oreqm').disabled = false
  ipcRenderer.send('menu_load_ref', true)
  set_window_title(name)
}

/**
 * Update window title
 * @param {string} extra typically pathname of oreqm
 */
function set_window_title (extra) {
  const title = `Visual ReqM2 - ${extra}`
  mainWindow.setTitle(title)
}

/**
 * Load and process both main and reference oreqm files
 * @param {string} file
 * @param {string} ref_file
 */
function load_file_main_fs (file, ref_file) {
  // console.log("load_file_main_fs", file, ref_file);
  clear_html_table()
  clear_diagram()
  clear_doctypes_table()
  spinner_show()

  // This is a work-around. When testing on Windows the async filereading hangs,
  // so use sync interface instead.
  const now = get_time_now()
  let data = fs.readFileSync(file, 'UTF-8')
  log_time_spent(now, "Read main oreqm")
  // console.log("main file read", ref_file)
  process_data_main(file, data, ref_file ? false : true)
  if (ref_file) {
    load_file_ref_fs(ref_file)
  } else if (vr2x_handler) {
    vr2x_handler()
  }

  // read file asynchronously
  // fs.readFile(file, 'UTF-8', (err, data) => {
  //   console.log("main file read")
  //   process_data_main(file, data)
  //   if (ref_file) {
  //     load_file_ref_fs(ref_file)
  //   } else if (vr2x_handler) {
  //     vr2x_handler()
  //   }
  // })
}

/** Handle button click for interactive load of main oreqm via file selector */
document.getElementById('get_main_oreqm_file').addEventListener('click', function () {
  get_main_oreqm_file()
})

function get_main_oreqm_file () {
  //rq: ->(rq_filesel_main_oreqm)
  const filePath = remote.dialog.showOpenDialogSync(
    {
      filters: [{ name: 'OREQM files', extensions: ['oreqm'] }],
      properties: ['openFile']
    })
  // console.log(filePath);
  if (typeof (filePath) !== 'undefined' && (filePath.length === 1)) {
    load_file_main_fs(filePath[0], null)
  }
}

/**
 * Calculate oreqm_ref and calculate diff to oreqm_main
 * @param {string} name filename of reference oreqm file
 * @param {string} data XML content of oreqm file
 */
function process_data_ref (name, data) {
  // Clean up data related to a previous ref file
  oreqm_main.remove_ghost_requirements(true)  // possible ghost reqs were related to now disappearing ref file
  update_doctype_table()  // This includes reqs of doctypes that might now be gone

  // console.log("process_data_ref")
  // load new reference
  create_oreqm_ref(name, data)
  document.getElementById('ref_name').innerHTML = name
  document.getElementById('ref_size').innerHTML = (Math.round(data.length / 1024)) + ' KiB'
  document.getElementById('ref_timestamp').innerHTML = oreqm_ref.get_time()
  const gr = compare_oreqm(oreqm_main, oreqm_ref)
  set_doctype_count_shown(gr.doctype_dict, gr.selected_dict)
  display_doctypes_with_count(oreqm_main.get_doctypes())
  filter_change()
  set_window_title(`${oreqm_main.filename} vs. ${oreqm_ref.filename}`)
}

/**
 * Load reference oreqm file. Main oreqm file is expected to be present.
 * @param {string} file
 */
function load_file_ref_fs (file) {
  // Load reference file
  if (oreqm_main) {
    spinner_show()

    // read file synchronously
    let data = fs.readFileSync(file, 'UTF-8')
    console.log("load_file_ref_fs readfile done")
    process_data_ref(file, data)
    if (vr2x_handler) {
      vr2x_handler()
    }

    // read file asynchronously
    // fs.readFile(file, 'UTF-8', (err, data) => {
    //   console.log("load_file_ref_fs readfile done")
    //   process_data_ref(file, data)
    //   if (vr2x_handler) {
    //     vr2x_handler()
    //   }
    // })
  } else {
    alert('No main file selected')
  }
}

document.getElementById('get_ref_oreqm_file').addEventListener('click', function () {
  get_ref_oreqm_file()
})

/**
 * Interactive selection of input file
 */
function get_ref_oreqm_file () {
  //rq: ->(rq_filesel_ref_oreqm)
  const filePath = remote.dialog.showOpenDialogSync(
    {
      filters: [{ name: 'OREQM files', extensions: ['oreqm'] }],
      properties: ['openFile']
    })
  // console.log(filePath);
  if (typeof (filePath) !== 'undefined' && (filePath.length === 1)) {
    load_file_ref_fs(filePath[0])
  }
}

document.getElementById('invert_exclude').addEventListener('click', function () {
  invert_exclude()
})

/**
 * Toggle each doctype exclusion individually
 */
function invert_exclude () {
  // Invert the exclusion status of all doctypes
  // istanbul ignore else
  if (oreqm_main) {
    const doctypes = oreqm_main.get_doctypes()
    const names = doctypes.keys()
    for (const doctype of names) {
      const box = document.getElementById(`doctype_${doctype}`)
      box.checked = !box.checked
    }
    doctype_filter_change()
  }
}

document.getElementById('filter_graph').addEventListener('click', function () {
  filter_graph()
})

// Combobox handler
document.getElementById('nodeSelect').addEventListener('change', function () {
  // Select node from drop-down
  set_selected_index(document.getElementById('nodeSelect').selectedIndex)
  if (document.getElementById('single_select').checked) {
    // Generate new diagram with *single* selected node
    graph_results([selected_nodes[selected_index]], false)
    update_diagram(selected_format)
  } else {
    clear_selection_highlight()
    center_node(selected_nodes[selected_index])
  }
})

document.getElementById('prev_selected').addEventListener('click', function () {
  //rq: ->(rq_navigate_sel)
  prev_selected()
})

document.getElementById('next_selected').addEventListener('click', function () {
  //rq: ->(rq_navigate_sel)
  next_selected()
})

document.getElementById('copy_selected').addEventListener('click', function () {
  copy_selected()
})

/**
 * Put list of selected <id>s on clipboard as text
 */
function copy_selected () {
  let txt = ''
  if (oreqm_main && selected_nodes.length) {
    txt = selected_nodes.join('\n')+'\n'
  }
  clipboard.writeText(txt)
}

document.getElementById('single_select').addEventListener('change', function () {
  if (document.getElementById('single_select').checked) {
    graph_results([selected_nodes[selected_index]], false)
  } else {
    graph_results(selected_nodes, false)
  }
  update_diagram(selected_format)
})

document.getElementById('clear_ref_oreqm').addEventListener('click', function () {
  clear_reference_oreqm()
})

function clear_reference_oreqm () {
  if (oreqm_ref) {
    clear_oreqm_ref()
    clear_html_table()
    update_doctype_table()
    document.getElementById('ref_name').innerHTML = ''
    document.getElementById('ref_size').innerHTML = ''
    document.getElementById('ref_timestamp').innerHTML = ''
    filter_change()
  }
  set_window_title(oreqm_main.filename)
}

// Setup for the "about" dialog
const aboutPane = document.getElementById('aboutPane')

// Get the button that opens the modal
const aboutButton = document.getElementById('aboutButton')

// Get the <span> element that closes the modal
const aboutPaneClose = document.getElementById('aboutPaneClose')

function show_about () {
  aboutPane.style.display = 'block'
}

// When the user clicks the button, open the modal
aboutButton.onclick = function () {
  show_about()
}

// When the user clicks on <span> (x), close the modal
aboutPaneClose.onclick = function () {
  aboutPane.style.display = 'none'
}

// Setup for the raw node display dialog (raw text and diff (for changed reqs))
const nodeSource = document.getElementById('nodeSource')

// Get the <span> element that closes the modal
const nodeSourceClose = document.getElementById('nodeSourceClose')

// When the user clicks on <span> (x), close the modal
nodeSourceClose.onclick = function () {
  nodeSource.style.display = 'none'
}

// When the user clicks anywhere outside of the modal, close it
window.onbeforeunload = function () {
  // "Graph is going away..."
}

const problemPopup = document.getElementById('problemPopup')

// Get the button that opens the modal
const issuesButton = document.getElementById('issuesButton')

// When the user clicks the button, open the modal
issuesButton.onclick = function () {
  show_problems()
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
  // Add node to the exclusion list
  //rq: ->(rq_ctx_excl)
  if (oreqm_main && oreqm_main.check_node_id(selected_node)) {
    let excluded_ids = document.getElementById('excluded_ids').value.trim()
    if (excluded_ids.length) {
      excluded_ids += '\n' + selected_node
    } else {
      excluded_ids = selected_node
    }
    document.getElementById('excluded_ids').value = excluded_ids
    filter_change()
  }
})

document.getElementById('clear_search_regex').addEventListener('click', function () {
  clear_search_regex()
})

function clear_search_regex () {
  document.getElementById('search_regex').value = ''
  filter_change()
}

document.getElementById('clear_excluded_ids').addEventListener('click', function () {
  clear_excluded_ids()
})

function clear_excluded_ids () {
  document.getElementById('excluded_ids').value = ''
  filter_change()
}

/** Drag and drop file handling main */
const drop_area_main = document.getElementById('drop_area_main')
const drop_area_output = document.getElementById('output')
/** Drag and drop file handling reference */
const drop_area_ref = document.getElementById('drop_area_ref');

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  drop_area_main.addEventListener(eventName, preventDefaults, false)
  drop_area_output.addEventListener(eventName, preventDefaults, false)
  drop_area_ref.addEventListener(eventName, preventDefaults, false)
  document.body.addEventListener(eventName, preventDefaults, false)
})

// Highlight drop area when item is dragged over it
;['dragenter', 'dragover'].forEach(eventName => {
  drop_area_main.addEventListener(eventName, highlight_main, false)
  drop_area_output.addEventListener(eventName, highlight_output, false)
  drop_area_ref.addEventListener(eventName, highlight_ref, false)
})

;['dragleave', 'drop'].forEach(eventName => {
  drop_area_main.addEventListener(eventName, unhighlight_main, false)
  drop_area_output.addEventListener(eventName, unhighlight_output, false)
  drop_area_ref.addEventListener(eventName, unhighlight_ref, false)
})

drop_area_main.addEventListener('drop', (event) => {
  //rq: ->(rq_drop_main_oreqm)
  event.stopPropagation()
  event.preventDefault()
  // console.log(event.dataTransfer.files);
  process_dropped_file(event, true)
})

drop_area_output.addEventListener('drop', (event) => {
  //rq: ->(rq_drop_main_oreqm)
  event.stopPropagation()
  event.preventDefault()
  process_dropped_file(event, true)
})

drop_area_ref.addEventListener('drop', (event) => {
  //rq: ->(rq_drop_ref_oreqm)
  event.stopPropagation()
  event.preventDefault()
  // console.log(event.dataTransfer.files);
  process_dropped_file(event, false)
})

function preventDefaults (e) {
  e.preventDefault()
  e.stopPropagation()
}

function highlight_main () {
  drop_area_main.classList.add('highlight')
}

function highlight_output () {
  drop_area_output.classList.add('highlight')
}

function highlight_ref () {
  if (oreqm_main) {
    drop_area_ref.classList.add('highlight')
  }
}

function unhighlight_main () {
  drop_area_main.classList.remove('highlight')
}

function unhighlight_output () {
  drop_area_output.classList.remove('highlight')
}

function unhighlight_ref () {
  drop_area_ref.classList.remove('highlight')
}

// Main oreqm file
drop_area_main.addEventListener('dragover', (event) => {
  event.stopPropagation()
  event.preventDefault()
  // Style the drag-and-drop as a "copy file" operation.
  event.dataTransfer.dropEffect = 'copy'
})

// Reference oreqm file
drop_area_ref.addEventListener('dragover', (event) => {
  event.stopPropagation()
  event.preventDefault()
  // Style the drag-and-drop as a "copy file" operation.
  if (oreqm_main) {
    event.dataTransfer.dropEffect = 'copy'
  } else {
    event.dataTransfer.dropEffect = 'none'
  }
})

document.addEventListener('dragover', (event) => {
  event.stopPropagation()
  event.preventDefault()
  event.dataTransfer.dropEffect = 'none'
})

/**
 * Process dropped file, if there is just one file
 * @param {object} ev
 * @param {boolean} main_file true: main file, false: reference file
 */
function process_dropped_file (ev, main_file) {
  let dropped_file
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
        dropped_file = file
      }
    }
  } else {
    // Use DataTransfer interface to access the file(s)
    for (i = 0; i < ev.dataTransfer.files.length; i++) {
      // console.log('... file[' + i + '].name = ' + ev.dataTransfer.files[i].name);
      dropped_file = ev.dataTransfer.files[i]
      count++
    }
  }
  // Check file. Only one, either .oreqm or .vrm2x
  if (count === 1) {
    const filename = dropped_file.path.length ? dropped_file.path : dropped_file.name
    if (filename.endsWith('.vr2x')) {
      load_diagram_context(filename)
    } else if (filename.endsWith('.oreqm')) {
      if (main_file) {
        load_file_main_fs(filename)
      } else {
        load_file_ref_fs(filename)
      }
    }
  }
}

// Doctype hierarchy button handler
document.getElementById('show_doctypes').addEventListener('click', function () {
  show_doctypes()
})

// Safety button handler
document.getElementById('show_doctypes_safety').addEventListener('click', function () {
  show_doctypes_safety()
})

/**
 * Add git style '+', '-' in front of changed lines.
 * The part can be multi-line and is expected to end with a newline
 * @param {object} part diff object
 * @return {string} updated string
 */
function src_add_plus_minus (part) {
  const insert = part.added ? '+' : part.removed ? '-' : ' '
  let txt = part.value
  const last_char = txt.slice(-1)
  txt = txt.slice(0, -1)
  txt = insert + txt.split(/\n/gm).join('\n' + insert)
  return txt + last_char
}

document.getElementById('menu_xml_txt').addEventListener('click', function () {
  show_source()
})

/**
 * Show selected node as XML in the source code modal (html)
 */
function show_source () {
  if (selected_node.length) {
    const ref = document.getElementById('req_src')
    if (oreqm_ref && oreqm_main.updated_reqs.includes(selected_node)) {
      //rq: ->(rq_ctx_show_diff)
      // create a diff
      const text_ref = xml_escape(oreqm_ref.get_xml_string(selected_node))
      const text_main = xml_escape(oreqm_main.get_xml_string(selected_node))
      let result = '<h2>XML format (changed specobject)</h2><pre>'
      const diff = Diff.diffLines(text_ref, text_main, {ignoreWhitespace: true})
      diff.forEach(function (part) {
        // green for additions, red for deletions, black for common parts
        const color = part.added ? 'green' : part.removed ? 'red' : 'grey'
        let font = 'normal'
        if (part.added || part.removed) {
          font = 'bold'
        }
        result += `<span style="color: ${color}; font-weight: ${font};">${src_add_plus_minus(part)}</span>`
      })
      result += '</pre>'
      ref.innerHTML = result
    } else {
      //rq: ->(rq_ctx_show_xml)
      let header_main = '<h2>XML format</h2>'
      if (oreqm_main.removed_reqs.includes(selected_node)) {
        header_main = '<h2>XML format (removed specobject)</h2>'
      } else if (oreqm_main.new_reqs.includes(selected_node)) {
        header_main = '<h2>XML format (new specobject)</h2>'
      }
      ref.innerHTML = `${header_main}<pre>${xml_escape(oreqm_main.get_xml_string(selected_node))}</pre>`
    }
    nodeSource.style.display = 'block'
  }
}

/**
 * Context menu handler to show internal tagged search format
 */
document.getElementById('menu_search_txt').addEventListener('click', function () {
  show_internal()
})

function show_internal () {
  // Show selected node as internal tagged string
  if (selected_node.length) {
    const ref = document.getElementById('req_src')
    const header_main = "<h2>Internal tagged 'search' format</h2>"
    const a_txt = oreqm_main.get_all_text(selected_node).replace(/\n/g, '\u21B5\n')
    ref.innerHTML = `${header_main}<pre>${xml_escape(a_txt)}</pre>`
    nodeSource.style.display = 'block'
  }
}

function show_problems () {
  // Show problems colleced in oreqm_main
  const ref = document.getElementById('problem_list')
  const header_main = '\n<h2>Detected problems</h2>\n'
  let problem_txt = 'Nothing to see here...'
  if (oreqm_main) {
    problem_txt = xml_escape(oreqm_main.get_problems())
  }
  ref.innerHTML = `${header_main}<pre id="raw_problems">${problem_txt}</pre>`
  problemPopup.style.display = 'block'
}

document.getElementById('save_problems').addEventListener('click', function () {
  save_problems()
})

function save_problems () {
  //rq: ->(rq_issues_file_export)
  const problems = oreqm_main.get_problems()
  const SavePath = remote.dialog.showSaveDialogSync(null, {
    filters: [{ name: 'TXT files', extensions: ['txt'] }],
    properties: ['openFile']
  })
  if (typeof (SavePath) !== 'undefined') {
    fs.writeFileSync(SavePath, problems, 'utf8')
  }
}

document.getElementById('clear_problems').addEventListener('click', function () {
  clear_problems()
})

function clear_problems () {
  if (oreqm_main) {
    oreqm_main.clear_problems()
    document.getElementById('issueCount').innerHTML = 0
    show_problems()
  }
}

/**
 * Update doctype table. Colors associated with doctypes may have changed, therefore cached
 * visualization data is cleared.
 */
function update_doctype_table () {
  if (oreqm_main) {
    oreqm_main.clear_cache()
    display_doctypes_with_count(oreqm_main.doctypes)
    filter_change()
  }
}

/**
 * Compare two oreqm files, each represented as objects.
 * The main object will have visualization elements added and default diff related search terms are added.
 * @param {object} oreqm_main
 * @param {object} oreqm_ref
 * @return {object} diff graph
 */
function compare_oreqm (oreqm_main, oreqm_ref) {
  // Both main and reference oreqm have been read.
  // Highlight new, changed and removed nodes in main oreqm (removed are added as 'ghosts')
  // eslint-disable-next-line no-unused-vars
  const results = oreqm_main.compare_requirements(oreqm_ref, get_ignored_fields())
  const new_search_array = []
  let raw_search = document.getElementById('search_regex').value.trim()
  // This is a hack, these prefixes are a hidden part of 'delta' reqs <id>, and a search term is constructed to find them
  // Also avoid adding them more than once.
  if (!raw_search.includes('new:')) new_search_array.push('new:')
  if (!raw_search.includes('chg:')) new_search_array.push('chg:')
  if (!raw_search.includes('rem:')) new_search_array.push('rem:')
  const new_search = new_search_array.join('|')
  if (new_search_array.length && raw_search) {
    if (search_language === 'vql') {
      raw_search = raw_search + '\nor ' + new_search_array.join(' or ')
    } else {
      raw_search = new_search + '|\n' + raw_search
    }
  } else if (new_search.length) {
    raw_search = search_language === 'vql' ? new_search_array.join(' or ') : new_search
  }
  document.getElementById('search_regex').value = raw_search
  // console.log(results)
  const graph = oreqm_main.create_graph(select_color,
    program_settings.top_doctypes,
    oreqm_main.construct_graph_title(true, null, oreqm_ref, search_language, search_pattern),
    [],
    program_settings.max_calc_nodes,
    program_settings.show_coverage,
    program_settings.color_status)
  set_issue_count()
  return graph
}

/* auto-update logic */

const notification = document.getElementById('notification')
const auto_update_message = document.getElementById('auto-update-message')
const restartButton = document.getElementById('restart-button')

ipcRenderer.on('update_available', () => {
  ipcRenderer.removeAllListeners('update_available')
  auto_update_message.innerText = 'A new update is available. Downloading now...'
  notification.classList.remove('hidden')
})

ipcRenderer.on('update_downloaded', () => {
  ipcRenderer.removeAllListeners('update_downloaded')
  auto_update_message.innerText = 'Update Downloaded. It will be installed on restart. Restart now?'
  restartButton.classList.remove('hidden')
  notification.classList.remove('hidden')
})

function closeNotification () {
  notification.classList.add('hidden')
}

function restartApp () {
  ipcRenderer.send('restart_app')
}

document.getElementById('close-button').addEventListener('click', function () {
  closeNotification()
})

document.getElementById('restart-button').addEventListener('click', function () {
  restartApp()
})

// Open https:// urls in external browser
if (document.readyState !== 'complete') {
  document.addEventListener('DOMContentLoaded', function () {
    prepareTags()
  }, false)
} else {
  prepareTags()
}

function url_click_handler (e, url) {
  e.preventDefault()
  document.shell_openExternal(url)
}

/**
 * Make URLs clickable
 */
function prepareTags () {
  document.url_click_handler = url_click_handler
  document.shell_openExternal = shell.openExternal
  const aTags = document.getElementsByTagName('a')
  for (let i = 0; i < aTags.length; i++) {
    // console.log(aTags[i])
    // aTags[i].setAttribute("onclick", "require('shell').openExternal('" + aTags[i].href + "')");
    aTags[i].setAttribute('onclick', "document.url_click_handler(event, '" + aTags[i].href + "')")
    aTags[i].href = '#'
  }
  return false
}

/**
 * Get latest release tag from github and check against this version.
 * Update 'About' dialog with release version and set button green.
 */
function check_newer_release_available () {
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

    resp.on('end', () => {
      const latest_rel = JSON.parse(data)
      // console.log(latest_rel.explanation);
      latest_version = latest_rel.name
      // console.log(latest_version);
      if (latest_version !== remote.app.getVersion()) {
        aboutButton.style.background = '#00FF00'
      }
      document.getElementById('latest_release').innerHTML = ` available for download is ${latest_version}`
      if (latest_version > remote.app.getVersion()) {
        show_toast(`A newer version ${latest_version} is available for download</br>Open <b>[About]</b> for more information`)
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
  if (window.__coverage__) {
    let name = '.nyc_output/coverage.json'
    //fs.writeFileSync('xyz.json', process.env.NYC_CONFIG);
    if (process.env.NYC_CONFIG) {
      let cfg = JSON.parse(process.env.NYC_CONFIG)
      if (cfg.tempDir !== undefined) {
        // Use uuid as name to allow for several runs to coexist in same coverage report
        name = `${cfg.tempDir}/${uuidv4()}.json`
      }
    }
    console.log(`Found coverage report, writing to ${name}`);
    fs.writeFileSync(name, JSON.stringify(window.__coverage__));
  }
})

function show_readme() {
  open('https://github.com/mox17/visual-reqm2-electron#readme')
}

function show_vql_help() {
  open('https://github.com/mox17/visual-reqm2-electron/blob/master/doc/VQL.md')
}
