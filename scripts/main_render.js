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
import showToast from 'show-toast'
import {
  settings_updated, oreqm_main, oreqm_ref, save_diagram_file, select_color,
  update_graph, svg_result, create_oreqm_main, create_oreqm_ref, dot_source,
  COLOR_UP, COLOR_DOWN, convert_svg_to_png, clear_oreqm_ref, set_action_cb
} from './main_data.js'
import { search_tooltip } from './reqm2oreqm.js'
import { vql_parse, vql_validate } from './vql-search.js'
import { get_time_now, get_delta_time, log_time_spent } from './util.js'
const open = require('open')

const mainWindow = remote.getCurrentWindow()

const beforeUnloadMessage = null

/** When true diagram is generated whenever selections or exclusions are updated */
let auto_update = true
/** When true only search ID field */
let search_language = 'reg' // search language
/** regex for matching requirements */
let search_pattern = ''
/** initial set of excluded doctypes */
let excluded_doctypes = []
/** The format for the diagram output */
let selected_format = 'svg'
/** The svg pan and zoom utility used in diagram pane */
let panZoom = null
/** parses generated svg from graphviz in preparation for display */
const parser = new DOMParser()
/** Version available on github.com */
let latest_version = 'unknown'
/** When true specobject in state 'rejected' are ignored */
let no_rejects = true // shall specobjects with status===rejected be displayed?
/** @global {string[]} Queue of operations for command line operations */
const cmd_queue = []
let diagram_format = 'svg'
let output_filename = 'diagram'

/** list of selected specobjects */
let selected_specobjects = null

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

/** Avoid flickering of toast 'killer' */
let toast_maybe_visible = false
/**
 * Show a toast when graph has been limited to max_nodes nodes
 * @param {number} max_nodes The limit
 */
// istanbul ignore next
function report_limit_as_toast (max_nodes) {
  toast_maybe_visible = true
  showToast({
    str: `More than ${max_nodes} specobjects.\nGraph is limited to 1st ${max_nodes} encountered.`,
    time: 10000,
    position: 'middle'
  })
}

function show_toast (message) {
  toast_maybe_visible = true
  showToast({
    str: message,
    time: 10000,
    position: 'middle'
  })
}

function clear_toast () {
  // istanbul ignore next
  if (toast_maybe_visible) {
    showToast({
      str: '',
      time: 0,
      position: 'middle'
    })
    toast_maybe_visible = false
  }
}

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
 * Handle command line parameters related to 'batch' execution
 * @param {object} args the input argument object
 */
function cmd_line_parameters (args) {
  if (args.select !== undefined) {
    search_pattern = args.select
    document.getElementById('search_regex').value = args.select
  }
  // Override settings search language with cmd line options
  if (args.vql) {
    document.getElementById('vql_checkbox_input').checked = true
    search_language = 'vql'
  } else if (args.regex) {
    document.getElementById('regex_checkbox_input').checked = true
    search_language = 'reg'
  } else if (args.idOnly) {
    document.getElementById('id_checkbox_input').checked = true
    search_language = 'ids'
  }
  document.getElementById('limit_depth_input').checked = args.limitDepth //rq: ->(rq_limited_walk_cl)
  if (args.exclIds !== undefined) {
    document.getElementById('excluded_ids').value = args.exclIds.replaceAll(',', '\n')
  }
  document.getElementById('no_rejects').checked = !args.inclRejected
  if (args.exclDoctypes !== undefined) {
    excluded_doctypes = args.exclDoctypes.split(',')
  }
  diagram_format = args.format
  output_filename = 'diagram'
  if (args.output !== undefined) {
    output_filename = args.output
  }
  // istanbul ignore next
  if (process.env.PORTABLE_EXECUTABLE_APP_FILENAME && (args.output !== undefined) && !path.isAbsolute(output_filename)) {
    // Add PWD as start of relative path
    if (process.env.PWD) {
      output_filename = path.join(process.env.PWD, output_filename)
      console.log('Updated output path:', output_filename)
    } else {
      alert('Define PWD in environment or specify absolute paths.')
    }
  }
  // The pending commands are pushed on a queue.
  // The asynchronous completion of diagrams will
  // trigger processing of the queue.
  if (args.diagram) {
    cmd_queue.push('save-diagram') //rq: ->(rq_automatic_diagram)
  }
  if (args.hierarchy) {
    cmd_queue.push('hierarchy')
    cmd_queue.push('save-hierarchy')
  }
  if (args.safety) {
    cmd_queue.push('safety')
    cmd_queue.push('save-safety')
  }
  if (args.diagram||args.hierarchy||args.safety) {
    cmd_queue.push('done')
    // cmd_queue.push('quit')  // TODO: consider implied quit when diagram generation is specified
  }
  if (args.quit) {
    // istanbul ignore next
    cmd_queue.push('quit')
  }
  // console.log("queue:", cmd_queue);
}

/**
 * Check for pending command line operations.
 * This function is called on completion of a diagram.
 * The next step is triggered via the main process.
 */
function check_cmd_line_steps () {
  // console.log("Check queue:", cmd_queue);
  if (cmd_queue.length) {
    const next_operation = cmd_queue.shift()
    // console.log(`Next operation '${next_operation}'`);
    const filename = output_filename
    let diagram_file = ''
    let problems = ''
    switch (next_operation) {
      case 'save-diagram':
        diagram_file = `${filename}-diagram.${diagram_format}`
        // console.log(diagram_file);
        save_diagram_file(diagram_file)
        ipcRenderer.send('cmd_echo', 'next')
        break

      case 'hierarchy':
        // Trigger generation of doctype diagram
        show_doctypes()
        break

      case 'save-hierarchy':
        diagram_file = `${filename}-doctypes.${diagram_format}`
        // console.log(diagram_file);
        save_diagram_file(diagram_file)
        ipcRenderer.send('cmd_echo', 'next')
        break

      case 'safety':
        // Trigger generation of safety diagram
        show_doctypes_safety()
        break

      case 'save-safety':
        diagram_file = `${filename}-safety.${diagram_format}`
        // console.log(diagram_file);
        save_diagram_file(diagram_file)
        ipcRenderer.send('cmd_echo', 'next')
        break

      case 'done':
        document.getElementById('vrm2_batch').innerHTML = 'done'
        ipcRenderer.send('cmd_echo', 'next')
        break;

      // istanbul ignore next
      case 'quit':
        diagram_file = `${filename}-issues.txt`
        problems = oreqm_main.get_problems()
        fs.writeFileSync(diagram_file, problems, 'utf8')
        ipcRenderer.send('cmd_quit')
        break

      // istanbul ignore next
      default:
        // istanbul ignore next
        console.log(`Unknown operation '${next_operation}'`)
    }
    document.getElementById('vrm2_batch').innerHTML = next_operation
  }
}

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

function spinner_show () {
  document.querySelector('#spinner').classList.add('loader')
  document.querySelector('#output').classList.remove('error')
}

function spinner_clear () {
  document.querySelector('#spinner').classList.remove('loader')
  document.querySelector('#output').classList.remove('error')
}

function action_busy () {
  document.getElementById('vrm2_working').innerHTML = 'working'
}

function action_done () {
  document.getElementById('vrm2_working').innerHTML = 'done'
}

/** install callbacks for progress tracking */
set_action_cb(action_busy, action_done)

/**
 * Display error messages from worker
 * @param {string} message error message from Viz.js
 */
// istanbul ignore next
function error_show (message) {
  spinner_clear()
  const error = document.querySelector('#error')
  while (error.firstChild) {
    error.removeChild(error.firstChild)
  }
  document.querySelector('#error').appendChild(document.createTextNode(message))
  document.querySelector('#output').classList.add('error')
}

/** svg element parsed from graphviz svg output */
let svg_element = null

/** Has html table been generated */
let html_element = null

/**
 * Remove currently displayed graph
 */
function clear_diagram () {
  const graph = document.querySelector('#output')

  const svg = graph.querySelector('svg')
  if (svg && graph.contains(svg)) {
    graph.removeChild(svg)
  }

  const text = graph.querySelector('#text')
  if (text && graph.contains(text)) {
    graph.removeChild(text)
  }

  const img = graph.querySelector('img')
  if (img && graph.contains(img)) {
    graph.removeChild(img)
  }

  if (html_element) {
    html_element.style.display = 'none'
    html_element.style.overflow = 'hidden'
  }
}

function svg_keyboard_shortcut_event(e) {
  //rq: ->(rq_navigate_sel)
  switch (e.key) {
    case 'n':
      next_selected()
      break
    case 'p':
      prev_selected()
      break
    case ' ':
      panZoom.reset()
      break
    case '+':
      panZoom.zoomIn()
      break
    case '-':
      panZoom.zoomOut()
      break
    case '?':
      console.dir(panZoom.getPan())
      break
    case 'a':
    case 'ArrowLeft':
      panZoom.panBy({ x: 100, y: 0 })
      break
    case 'd':
    case 'ArrowRight':
      panZoom.panBy({ x: -100, y: 0 })
      break
    case 'w':
    case 'ArrowUp':
      panZoom.panBy({ x: 0, y: 100 })
      break
    case 's':
    case 'ArrowDown':
      panZoom.panBy({ x: 0, y: -100 })
      break
    default:
      // console.log(e)
      break
  }
}

function context_menu_event (event) {
  const menuNode = document.getElementById('node-menu')
  let str = ''
  event.preventDefault()
  // Grab all the siblings of the element that was actually clicked on
  for (const sibling of event.target.parentElement.children) {
    // Check if they're the title
    if (sibling.nodeName !== 'title') continue
    str = sibling.innerHTML
    break
  }
  selected_node = str
  if ((menuNode.style.display === '') ||
        (menuNode.style.display === 'none') ||
        (menuNode.style.display === 'initial')) {
    // show context menu
    const stage = document.getElementById('output')
    const containerRect = stage.getBoundingClientRect()
    menuNode.style.display = 'initial'
    menuNode.style.top = '0'
    menuNode.style.left = '0'
    update_menu_options(selected_node)
    const menu_width = menuNode.clientWidth
    const menu_height = menuNode.clientHeight
    let menu_rel_x = 2
    let menu_rel_y = 2
    if ((event.pageX + menu_width + menu_rel_x + 20) >= containerRect.right) {
      menu_rel_x = -menu_rel_x - menu_width
    }
    if ((event.pageY + menu_height + menu_rel_y + 28) >= containerRect.bottom) {
      menu_rel_y = -menu_rel_y - menu_height - 16 // compensate height of a row
    }
    menuNode.style.top = /* containerRect.top  + */ event.pageY + menu_rel_y + 'px'
    menuNode.style.left = /* containerRect.left + */ event.pageX + menu_rel_x + 'px'
  } else {
    // Remove on 2nd right-click
    menuNode.style.display = 'none'
  }
}

function updateSvgOutput (graph) {
  //rq: ->(rq_show_svg)
  svg_element = parser.parseFromString(svg_result, 'image/svg+xml').documentElement
  svg_element.id = 'svg_output'
  graph.appendChild(svg_element)

  //rq: ->(rq_svg_pan_zoom)
  panZoom = svgPanZoom(svg_element, {
    panEnabled: true,
    zoomEnabled: true,
    dblClickZoomEnabled: false,
    controlIconsEnabled: true,
    preventMouseEventsDefault: false,
    fit: true,
    center: true,
    minZoom: 0.02,
    maxZoom: 200,
    zoomScaleSensitivity: 0.3
  })

  svg_element.addEventListener('paneresize', function () {
    panZoom.resize()
  }, false)

  window.addEventListener('resize', function () {
    panZoom.resize()
  })

  svg_element.addEventListener('focus', function () {
    this.addEventListener('keypress', function () {
      // console.log(e.keyCode);
    })
  }, svg_element)

  // Keyboard shortcuts when focus on graph pane
  document.getElementById('graph').onkeydown = svg_keyboard_shortcut_event

  // context menu setup
  //rq: ->(rq_svg_context_menu)
  const menuNode = document.getElementById('node-menu')
  svg_element.addEventListener('contextmenu', context_menu_event)

  window.addEventListener('click', function (e) {
    // hide context menu
    if (menuNode.style.display !== 'none' && menuNode.style.display !== '') {
      menuNode.style.display = 'none'
      e.preventDefault()
    }
  })
}

/**
 * Render generated diagram in window, considering the selected output format
 * and set up event handlers for resizing, pan/zoom and context menu
 */
function updateOutput (_result) {
  const graph = document.querySelector('#output')
  clear_diagram()
  // istanbul ignore next
  if ((selected_format === 'svg') && !svg_result) {
    // This is when creation of a diagram fails
    console.log("svg generation failed")
    return
  }

  switch (selected_format) {
    case 'svg':
      updateSvgOutput(graph)
      break

    case 'png-image-element': {
      //rq: ->(rq_show_png)
      const image = convert_svg_to_png(svg_result)
      graph.appendChild(image)
      break
    }

    case 'dot-source': {
      //rq: ->(rq_show_dot)
      const dot_text = document.createElement('div')
      dot_text.id = 'text'
      dot_text.appendChild(document.createTextNode(dot_source))
      graph.appendChild(dot_text)
      break
    }

    case 'html-table': {
      show_html_table()
      break
    }
  }
  check_cmd_line_steps()
}

function show_html_table() {
  let ids = selected_specobjects ? selected_specobjects : oreqm_main.get_id_list()
  if (!html_element) {
    // Create table 1st time
    let table = oreqm_main.generate_html_table()
    html_element = document.getElementById('html_table')
    html_element.innerHTML = table
  }
  html_element.style.overflow = 'visible'
  // Update visibility of selected specobjects
  let all_divs = html_element.getElementsByTagName('div')
  for (let div of all_divs) {
      if (div.id.startsWith('spec_')) {
        let test_id = div.id.replace(/^spec_/, '')
        div.style.display = (ids.includes(test_id) &&
                             oreqm_main.is_req_visible(test_id)) ? 'block' : 'none'
      }
  }
  html_element.style.display = 'block'
}

/**
 * Removes the html table  from the DOM and clears helper variables
 */
function clear_html_table () {
  if (html_element) {
    html_element.innerHTML = ''
    html_element.style.display = 'none'
    html_element.style.overflow = 'hidden'
    html_element = null
  }
}

window.addEventListener('beforeunload', function () {
  return beforeUnloadMessage
})

// Context menu handler
document.getElementById('menu_copy_id').addEventListener('click', function () {
  copy_id_node(false)
})

// Context menu handler
document.getElementById('menu_copy_ffb').addEventListener('click', function () {
  copy_id_node(true)
})

/**
 * Put id of selected specobject on clipboard in selected format
 * @param {boolean} ffb_format true: id:doctype:version ; false: id
 */
function copy_id_node (ffb_format) {
  let txt
  const rec = oreqm_main.requirements.get(selected_node)
  if (ffb_format) {
    txt = `${rec.id}:${rec.doctype}:${rec.version}` //rq: ->(rq_ctx_copy_id_dt_ver)
  } else {
    txt = rec.id //rq: ->(rq_ctx_copy_id)
  }
  clipboard.writeText(txt)
}

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
  auto_update = false
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
    auto_update = save_auto
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
  auto_update = vr2x_ctx.auto_update
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
    search_language = document.getElementById('id_checkbox_input').checked ? 'ids' : 'reg'
  } else if (ctx.version === 2) {
    search_language = ctx.search_language
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

document.querySelector('#format select').addEventListener('change', function () {
  selected_format = document.querySelector('#format select').value
  update_diagram(selected_format)
})

function diagram_error (message) {
  error_show(message)
}

function update_diagram (selected_format) {
  // console.log("update_diagram")
  clear_diagram()
  update_graph(selected_format, spinner_show, spinner_clear, updateOutput, diagram_error)
}

/**
 * Update context menu for selected node
 * @param {string} node_id
 */
function update_menu_options (node_id) {
  // get individual context menu options as appropriate
  if (oreqm_main && oreqm_main.check_node_id(node_id)) {
    // a node was right-clicked
    document.getElementById('menu_select').classList.remove('custom-menu_disabled')
    document.getElementById('menu_copy_id').classList.remove('custom-menu_disabled')
    document.getElementById('menu_copy_ffb').classList.remove('custom-menu_disabled')
    document.getElementById('menu_exclude').classList.remove('custom-menu_disabled')
    document.getElementById('menu_xml_txt').classList.remove('custom-menu_disabled')
    document.getElementById('menu_search_txt').classList.remove('custom-menu_disabled')
    if (selected_node_check(node_id)) {
      document.getElementById('menu_deselect').classList.remove('custom-menu_disabled')
    } else {
      document.getElementById('menu_deselect').classList.add('custom-menu_disabled')
    }
  } else {
    // click not on nodes
    document.getElementById('menu_select').classList.add('custom-menu_disabled')
    document.getElementById('menu_deselect').classList.add('custom-menu_disabled')
    document.getElementById('menu_exclude').classList.add('custom-menu_disabled')
    document.getElementById('menu_copy_id').classList.add('custom-menu_disabled')
    document.getElementById('menu_copy_ffb').classList.add('custom-menu_disabled')
    document.getElementById('menu_xml_txt').classList.add('custom-menu_disabled')
    document.getElementById('menu_search_txt').classList.add('custom-menu_disabled')
  }
}

/**
 * Update doctype table with counts of nodes actually displayed
 * @param {Map<string,string[]>} visible_nodes mapping from doctypes to list of visible nodes of each doctype
 * @param {string[]} selected_nodes list of id's
 */
function set_doctype_count_shown (visible_nodes, selected_nodes) {
  let doctypes = visible_nodes.keys()
  let shown_count = 0
  for (const doctype of doctypes) {
    const shown_cell = document.getElementById(`doctype_shown_${doctype}`)
    if (shown_cell) {
      shown_cell.innerHTML = visible_nodes.get(doctype).length //rq: ->(rq_dt_shown_stat)
      shown_count += visible_nodes.get(doctype).length
    }
  }
  const shown_cell_totals = document.getElementById('doctype_shown_totals')
  if (shown_cell_totals) {
    shown_cell_totals.innerHTML = shown_count
  }
  doctypes = selected_nodes.keys()
  let selected_count = 0
  for (const doctype of doctypes) {
    const selected_cell = document.getElementById(`doctype_select_${doctype}`)
    if (selected_cell) {
      selected_cell.innerHTML = selected_nodes.get(doctype).length //rq: ->(rq_dt_exist_stat)
      selected_count += selected_nodes.get(doctype).length
    }
  }
  const selected_cell_totals = document.getElementById('doctype_select_totals')
  if (selected_cell_totals) {
    //rq: ->(rq_dt_sel_stat)
    selected_cell_totals.innerHTML = selected_count
  }
}

/** Remove doctype table */
function clear_doctypes_table () {
  const element = document.getElementById('dyn_doctype_table')
  if (element) {
    element.parentNode.removeChild(element)
  }
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

/** doctype exclusion was toggled */
function doctype_filter_change () {
  set_doctype_all_checkbox()
  // console.log("doctype_filter_change (click)")
  filter_change()
}

/** Invert all doctype exclusions and update */
function doctype_filter_all_change () {
  toggle_exclude()
}

document.getElementById('auto_update').addEventListener('click', function () {
  // console.log("auto_update_click")
  auto_update = document.getElementById('auto_update').checked
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

function search_validate(str) {
  switch(search_language) {
    case 'ids':
    case 'reg':
      try {
        // eslint-disable-next-line no-unused-vars
        let _regex_rule = new RegExp(str)
      } catch (err) {
        return err.message
      }
      return null

    case 'vql':
      return vql_validate(str)
  }
  return null
}

document.getElementById('search_regex').addEventListener('keyup', function(_ev) {
  search_regex_validate(this)
})

/**
 * Check if content of field is OK
 * @param {DOM object} field 
 * @returns true if field OK
 */
function search_regex_validate(field) {
  let text = field.value
  let validation_error = search_validate(text)
  if (text && validation_error) {
    if (!field.errorbox) {
      const rect = field.getBoundingClientRect();
      const left = rect.left;
      const top = rect.bottom;
      const width = field.clientWidth
      field.errorbox = document.createElement('div');
      field.errorbox.innerHTML = validation_error
      field.errorbox.classList.add('search_terms')
      field.errorbox.setAttribute('style', `background: #f0a0a0;
                                            padding: 6px;
                                            position: absolute;
                                            top: ${top}px;
                                            left: ${left}px;
                                            width: ${width}px;
                                            border: 2px solid #ff0000;
                                            font-family: 'Courier New', monospace;
                                            `);
      field.errorbox.style.fontSize = "75%"
      field.parentNode.appendChild(field.errorbox);
    } else {
      field.errorbox.innerHTML = validation_error;
      field.errorbox.style.display = 'block';
    }
  } else if (field.errorbox) {
    field.errorbox.style.display = 'none';
  }
  return !(text && validation_error)
}

document.getElementById('search_regex').addEventListener('blur', function(_event) {
  if (this.errorbox) {
    this.errorbox.style.display = 'none';
  }
});

document.getElementById('excluded_ids').addEventListener('change', function () {
  filter_change()
})

function filter_change () {
  if (auto_update) {
    filter_graph()
  }
}

function set_search_language_hints(lang) {
  let input = document.getElementById('search_regex')
  switch (lang) {
    case 'vql':
      input.placeholder = "VQL search\nrem: or chg: or new: select changes\nAND, OR, NOT and ( ) operators\nand ao() co() selections supported"
      break
    case 'reg':
    case 'ids':
      input.placeholder = "Regex search\nnewlines are ignored\nrem:|chg:|new: select changes"
      break
  }
  document.getElementById('search_tooltip').innerHTML = search_tooltip(lang)
}

/**
 * Handle UI selection of search language
 * @param {string} lang 'ids', 'req' or 'vql' selected in UI
 */
function select_search_language (lang) {
  set_search_language_hints(lang)
  search_language = lang
  program_settings.search_language = search_language
  save_program_settings()
  filter_change()
}

/**
 * Update radio-button for language selection as well as search_language variable
 * @param {string} lang 'ids', 'req' or 'vql' from cmd line, settings or context file
 */
function set_search_language_buttons (lang) {
  switch (lang) {
    case 'ids':
      document.getElementById('id_checkbox_input').checked = true
      break
    case 'reg':
      document.getElementById('regex_checkbox_input').checked = true
      break
    case 'vql':
      document.getElementById('vql_checkbox_input').checked = true
      break
    }
    search_language = lang
    set_search_language_hints(lang)
  }

/**
 * Set auto-update status
 * @param {boolean} state true: do auto update, false: user has to trigger update
 */
// eslint-disable-next-line no-unused-vars
function set_auto_update (state) {
  document.getElementById('auto_update').checked = state
  auto_update = state
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
    excluded_doctypes = []
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

/**
 * Get the list of doctypes with checked 'excluded' status from html
 * @return {string[]} list of doctypes
 */
function get_excluded_doctypes () {
  const excluded_list = []
  if (oreqm_main) {
    const doctypes = oreqm_main.get_doctypes()
    const names = doctypes.keys()
    for (const doctype of names) {
      const cb_name = `doctype_${doctype}`
      const status = document.getElementById(cb_name)
      if (status && status.checked) {
        excluded_list.push(doctype)
      }
      // console.log(doctype, status, status.checked)
    }
  }
  return excluded_list
}

/**
 * Set checkboxes according to excluded doctypes
 */
 function set_excluded_doctype_checkboxes () {
  // istanbul ignore else
  if (oreqm_main) {
    const doctypes = oreqm_main.get_doctypes()
    const names = doctypes.keys()
    const ex_list = oreqm_main.get_excluded_doctypes()
    for (const doctype of names) {
      const box = document.getElementById(`doctype_${doctype}`)
      box.checked = ex_list.includes(doctype)
    }
    doctype_filter_change()
  }
}


/**
 * Set all doctypes to excluded/included
 */
function toggle_exclude () {
  // istanbul ignore else
  if (oreqm_main) {
    const doctypes = oreqm_main.get_doctypes()
    const names = doctypes.keys()
    const ex_list = get_excluded_doctypes()
    const new_state = ex_list.length === 0
    for (const doctype of names) {
      const box = document.getElementById(`doctype_${doctype}`)
      // istanbul ignore else
      if (new_state !== box.checked) {
        box.checked = new_state
      }
    }
    doctype_filter_change()
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

function set_doctype_all_checkbox () {
  // Set the checkbox to reflect overall status
  const doctypes = oreqm_main.get_doctypes()
  const names = doctypes.keys()
  const ex_list = get_excluded_doctypes()
  const dt_all = document.getElementById('doctype_all')
  if (ex_list.length === 0) {
    dt_all.indeterminate = false
    dt_all.checked = false
  } else if (ex_list.length === Array.from(names).length) {
    dt_all.indeterminate = false
    dt_all.checked = true
  } else {
    dt_all.indeterminate = true
    dt_all.checked = true
  }
}

/**
 * Get the regular expression from "Selection criteria" box
 * @return {string} regular expression
 */
function get_search_regex_clean () {
  const raw_search = document.getElementById('search_regex').value
  let clean_search
  if (search_language === 'vql') {
    clean_search = raw_search
  } else {
    clean_search = raw_search.replace(/\n/g, '') // ignore all newlines in regex
  }
  return clean_search
}

document.getElementById('filter_graph').addEventListener('click', function () {
  filter_graph()
})

/**
 * Update diagram with current selection and exclusion parameters
 */
function filter_graph () {
  // console.log("filter_graph")
  reset_selection()
  clear_toast()
  if (oreqm_main) {
    spinner_show()
    oreqm_main.set_no_rejects(no_rejects)
    handle_pruning()
    // Collect filter criteria and generate .dot data
    search_pattern = get_search_regex_clean()
    // console.log("filter_graph()", search_pattern)
    if (search_pattern) {
      switch (search_language) {
        case 'ids':
          id_search(search_pattern)
          break
        case  'reg':
          txt_search(search_pattern)
          break
        case 'vql':
          vql_search(search_pattern)
          break
      }
      update_diagram(selected_format)
    } else {
      //rq: ->(rq_no_sel_show_all)
      // no pattern specified
      selected_specobjects = null
      const title = oreqm_main.construct_graph_title(true, null, oreqm_ref, false, '')
      const graph = oreqm_main.create_graph(
        select_all,
        program_settings.top_doctypes,
        title,
        [],
        program_settings.max_calc_nodes,
        program_settings.show_coverage,
        program_settings.color_status)
      set_doctype_count_shown(graph.doctype_dict, graph.selected_dict)
      set_issue_count()
      update_diagram(selected_format)
    }
  }
}

/**
 * Take exclusion parameters (excluded doctypes and excluded <id>s) from UI and transfer to oreqm object
 */
function handle_pruning () {
  if (oreqm_main) {
    let ex_id_list = []
    const excluded_ids = document.getElementById('excluded_ids').value.trim()
    if (excluded_ids.length) {
      ex_id_list = excluded_ids.split(/[\n,]+/)
    }
    oreqm_main.set_excluded_ids(ex_id_list)
    const ex_dt_list = get_excluded_doctypes()
    oreqm_main.set_excluded_doctypes(ex_dt_list)
  }
}

/** List of id's matching search criteria */
let selected_nodes = []
/** Currently selected \<id> */
let selected_index = 0
/** \<id> of currently selected node */
let selected_node = null
// Manage selection highlight in diagram (extra bright red outline around selected specobject)
/** The svg id of the rectangle around a selected specobject in diagram */
let selected_polygon = null
/** width of svg outline as a string */
let selected_width = ''
/** color of svg outline as #RRGGBB string */
let selected_color = ''

/**
 * Clear node selection list and visible combobox
 */
function reset_selection () {
  selected_nodes = []
  selected_index = 0
  const nodeSelectEntries = document.getElementById('nodeSelect')
  nodeSelectEntries.innerHTML = ''
}

/**
 * Set list of selected <id>'s in combobox above diagram
 * @param {list} selection list of \<id>'s
 */
function set_selection (selection) {
  selected_nodes = selection
  selected_index = 0
  const nodeSelectEntries = document.getElementById('nodeSelect')
  nodeSelectEntries.innerHTML = '<option>' + selected_nodes.join('</option>\n<option>') + '</option>'
}

/**
 * Checks if a node is explicitly selected, i.e. whole id is present in selection string.
 * @param {string} node id string
 */
function selected_node_check (node) {
  return selected_nodes.includes(node)
}

/**
 * Update svg outline around selected specobject
 */
function clear_selection_highlight () {
  if (selected_polygon) {
    selected_polygon.setAttribute('stroke-width', selected_width)
    selected_polygon.setAttribute('stroke', selected_color)
    selected_polygon = null
  }
}

/**
 * Set highlight in svg around specified node
 * @param {DOMobject} node SVG object. Naming is 'sel_'+id
 */
function set_selection_highlight (node) {
  clear_selection_highlight()
  const outline = node.querySelector('.cluster > path')
  if (outline) {
    selected_polygon = outline
    selected_width = selected_polygon.getAttribute('stroke-width')
    selected_color = selected_polygon.getAttribute('stroke')
    selected_polygon.setAttribute('stroke-width', '8')
    selected_polygon.setAttribute('stroke', '#FF0000')
  }
}

// Combobox handler
document.getElementById('nodeSelect').addEventListener('change', function () {
  // Select node from drop-down
  selected_index = document.getElementById('nodeSelect').selectedIndex
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

function prev_selected () {
  // step backwards through nodes and center display
  if (oreqm_main && selected_nodes.length) {
    // istanbul ignore next
    if (selected_index > selected_nodes.length) selected_index = 0
    selected_index--
    if (selected_index < 0) selected_index = selected_nodes.length - 1
    document.getElementById('nodeSelect').selectedIndex = selected_index
    if (document.getElementById('single_select').checked) {
      // Generate new diagram with *single* selected node
      graph_results([selected_nodes[selected_index]], false)
      update_diagram(selected_format)
    } else {
      center_node(selected_nodes[selected_index])
    }
  }
}

document.getElementById('next_selected').addEventListener('click', function () {
  //rq: ->(rq_navigate_sel)
  next_selected()
})

function next_selected () {
  // Create next diagram with a single selected node
  if (oreqm_main && selected_nodes.length) {
    // istanbul ignore next
    if (selected_index > selected_nodes.length) selected_index = 0
    selected_index++
    if (selected_index >= selected_nodes.length) selected_index = 0
    document.getElementById('nodeSelect').selectedIndex = selected_index

    if (document.getElementById('single_select').checked) {
      // Generate new diagram with *single* selected node
      graph_results([selected_nodes[selected_index]], false)
      update_diagram(selected_format)
    } else {
      // Center diagram on next node
      center_node(selected_nodes[selected_index])
    }
  }
}

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

/**
 * Search all id strings for a match to regex and create selection list
 * @param {string} regex regular expression
 */
function id_search (regex) { //rq: ->(rq_search_id_only)
  selected_specobjects = oreqm_main.find_reqs_with_name(regex)
  graph_results(selected_specobjects)
}

/**
 * Greate dot diagram from list of selected nods
 * @param {string[]} results list of selected nodes
 * @param {boolean} update_selection update node navigation selection box
 */
function graph_results (results, update_selection=true) {
  oreqm_main.clear_color_marks()
  let depth = document.getElementById('limit_depth_input').checked ? 1 : 99 //rq: ->(rq_limited_walk)
  oreqm_main.mark_and_flood_up_down(results, COLOR_UP, COLOR_DOWN, depth)
  const graph = oreqm_main.create_graph(select_color,
    program_settings.top_doctypes,
    oreqm_main.construct_graph_title(true, null, oreqm_ref, search_language, search_pattern),
    results,
    program_settings.max_calc_nodes,
    program_settings.show_coverage,
    program_settings.color_status)
  set_doctype_count_shown(graph.doctype_dict, oreqm_main.get_doctype_dict(results))
  //set_doctype_count_shown(graph.doctype_dict, graph.selected_dict)
  set_issue_count()
  if (update_selection) {
    set_selection(graph.selected_nodes)
  }
}

/**
 * Parse VQL string and generate dot graph
 * @param {string} vql_str search expression
 */
function vql_search (vql_str) {
  let result = vql_parse(vql_str)
  if (result) {
    selected_specobjects = Array.from(result)
    graph_results(selected_specobjects)
  }
}

/**
 * Search combined tagged string for a match to regex and create selection list `results`
 * Show digram with the matching nodes and reacable nodes.
 * @param {string} regex search criteria
 */
function txt_search (regex) { //rq: ->(rq_sel_txt)
  selected_specobjects = oreqm_main.find_reqs_with_text(regex)
  graph_results(selected_specobjects)
}

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

function escRegexMetaChars (str) {
  return str.replaceAll('\\', '\\\\')
            .replaceAll('^', '\\^')
            .replaceAll('$', '\\$')
//            .replaceAll('.', '\\.') // strictly speaking this should be included, but may confuse users not consciously using regex
            .replaceAll('|', '\\|')
            .replaceAll('?', '\\?')
            .replaceAll('*', '\\*')
            .replaceAll('+', '\\+')
            .replaceAll('(', '\\(')
            .replaceAll(')', '\\)')
            .replaceAll('[', '\\[')
            .replaceAll('{', '\\{')
}

// For duplicates remove the disambiguating id suffix of :\d and check if it is valid
function remDupSuffix (str) {
  const pureId = str.replace(/:\d+$/, '')
  if (oreqm_main.duplicates.has(pureId)) {
    str = pureId;
  }
  return str
}

// Selection/deselection of nodes by right-clicking the diagram
document.getElementById('menu_select').addEventListener('click', function () {
  // Add node to the selection criteria (if not already selected)
  //rq: ->(rq_ctx_add_selection)
  const node = selected_node
  add_node_to_selection(node)
})

function add_node_to_selection (node) {
  if (oreqm_main && oreqm_main.check_node_id(node)) {
    let search_pattern = document.getElementById('search_regex').value.trim()

    if (search_language === 'vql') {
      // For VQL the '@' prefixed string allows () and [] in name
      // Prefix with id: and end with '$'
      let id_str = `@id:${remDupSuffix(node)}$`
      if (!search_pattern.includes(id_str)) {
        if (search_pattern.length) {
          id_str = '\nor ' + id_str
        }
        search_pattern += id_str
        document.getElementById('search_regex').value = search_pattern
        filter_change()
      }
    } else {
      let node_select_str = escRegexMetaChars(remDupSuffix(node))+'$'
      if (!search_pattern.includes(node_select_str)) {
        if (search_pattern.length) {
          node_select_str = '\n|' + node_select_str
        }
        search_pattern += node_select_str
        document.getElementById('search_regex').value = search_pattern
        filter_change()
      }
    }
  }
}

/** Context menu handler  */
document.getElementById('menu_deselect').addEventListener('click', function () {
  // Remove node to the selection criteria (if not already selected)
  //rq: ->(rq_ctx_deselect)
  if (oreqm_main && oreqm_main.check_node_id(selected_node)) {
    let new_search_pattern
    let search_pattern
    const org_search_pattern = document.getElementById('search_regex').value.trim()
    if (search_language === 'vql') {
      let id_str = `@id:${remDupSuffix(selected_node)}$`
      let id_str_or = '\nor ' + id_str
      new_search_pattern = org_search_pattern
      search_pattern = org_search_pattern
      if (org_search_pattern.includes(id_str_or)) {
        new_search_pattern = org_search_pattern.replace(id_str_or, '')
      } else if (org_search_pattern.includes(id_str)) {
        // Check if removing the 1st of several selected nodes, i.e. remove separating 'or'
        let trailing_or = id_str + '\nor '
        if (org_search_pattern.includes(trailing_or)) {
          new_search_pattern = org_search_pattern.replace(trailing_or, '')
        } else {
          new_search_pattern = org_search_pattern.replace(id_str, '')
        }
      }
    } else {
      const node = escRegexMetaChars(escRegexMetaChars(remDupSuffix(selected_node)))
      const node_select_str = new RegExp(`(^|\\|)${node}\\$`)
      search_pattern = org_search_pattern.replace(/\n/g, '')
      new_search_pattern = search_pattern.replace(node_select_str, '')
      if (new_search_pattern[0] === '|') {
        new_search_pattern = new_search_pattern.slice(1)
      }
      new_search_pattern = new_search_pattern.replace(/\|/g, '\n|')
    }
    if (new_search_pattern !== search_pattern) {
      document.getElementById('search_regex').value = new_search_pattern
      // console.log("deselect_node() - search ", node, search_pattern, new_search_pattern)
      filter_change()
    } else {
      const alert_text = `'${selected_node}' is not a selected node\nPerhaps try 'Exclude'?`
      alert(alert_text)
    }
  }
})

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

/**
 * Center svg diagram around the selected specobject
 * @param {string} node_name
 */
function center_node (node_name) {
  let found = false
  // Get translation applied to svg coordinates by Graphviz
  const graph0 = document.querySelectorAll('.graph')[0]
  const trans_x = graph0.transform.baseVal[2].matrix.e
  const trans_y = graph0.transform.baseVal[2].matrix.f
  // Grab all the siblings of the element that was actually clicked on
  const titles = document.querySelectorAll('.node > title')
  let bb
  let node
  for (node of titles) {
    if (node.innerHTML === node_name) {
      found = true
      bb = node.parentNode.getBBox()
      break
    }
  }
  if (found) {
    set_selection_highlight(document.getElementById(`sel_${node_name}`))
    let here = panZoom.getPan()
    const output = document.getElementById('output')
    const sizes = panZoom.getSizes()
    const rz = sizes.realZoom
    const window_width = output.clientWidth / rz
    const window_height = output.clientHeight / rz
    const req_center_x = bb.x + bb.width * 0.5
    let req_center_y = bb.y

    let centerpos_x = sizes.viewBox.width * 0.5
    let centerpos_y = sizes.viewBox.height * 0.3
    if (window_width > sizes.viewBox.width) {
      centerpos_x += (window_width - sizes.viewBox.width) * 0.5
    }
    if (window_width < sizes.viewBox.width) {
      centerpos_x -= (sizes.viewBox.width - window_width) * 0.5
    }
    if (window_height > sizes.viewBox.height) {
      req_center_y -= (window_height - sizes.viewBox.height) * 0.3
    }
    if (window_height < sizes.viewBox.height) {
      centerpos_y -= (sizes.viewBox.height - window_height) * 0.3
    }
    // console.log(centerpos_x, centerpos_y)
    const pan_vector_x = (centerpos_x - req_center_x - trans_x) * rz
    const pan_vector_y = (centerpos_y - req_center_y - trans_y) * rz
    // console.log(pan_vector_x, pan_vector_y)
    let steps = 15
    let there = { x: pan_vector_x, y: pan_vector_y }
    let delta = { x: (there.x-here.x)/steps, y: (there.y-here.y)/steps }
    //console.log('Pan: ', here, there, delta)
    //panZoom.pan(there)
    action_busy()
    return new Promise((resolve) => {
      let step = 0
      const interval = setInterval(function () {
        panZoom.panBy(delta)
        step += 1
        if (step > steps) {
          clearInterval(interval)
          document.getElementById('vrm2_working').innerHTML = 'centered' // sync tests
          resolve()
        }
      }, 16.666)
    })
  }
  //document.getElementById('vrm2_working').innerHTML = 'centered'
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

function show_doctypes () {
  // Show the graph of doctype relationships
  if (oreqm_main) {
    oreqm_main.scan_doctypes(false)
    set_issue_count()
    update_diagram(selected_format)
  }
}

// Safety button handler
document.getElementById('show_doctypes_safety').addEventListener('click', function () {
  show_doctypes_safety()
})

function show_doctypes_safety () {
  // Show the graph of doctype relationships
  if (oreqm_main) {
    oreqm_main.scan_doctypes(true)
    set_issue_count()
    update_diagram(selected_format)
  }
}

/**
 * Update count in 'issues' button
 */
function set_issue_count () {
  let count = 0
  if (oreqm_main) {
    count = oreqm_main.get_problem_count()
  }
  document.getElementById('issueCount').innerHTML = count
}

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
 * Handle display (or not) of rejected specobjects
 */
document.getElementById('no_rejects').addEventListener('change', function () {
  no_rejects_click()
})

function no_rejects_click () {
  no_rejects = document.getElementById('no_rejects').checked
  filter_change()
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

// some ways to select a subset of specobjects
function select_all (_node_id, rec, _node_color) {
  // Select all - no need to inspect input
  if (no_rejects) {
    return rec.status !== 'rejected'
  }
  return true
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
