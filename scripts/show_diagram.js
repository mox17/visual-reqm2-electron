'use strict'
import { showToast } from 'show-toast'
import { oreqm_main, oreqm_ref, svg_result, convert_svg_to_png, dot_source,
         COLOR_UP, COLOR_DOWN, select_color, set_action_cb } from "./main_data"
import { set_issue_count } from "./issues"
import { update_graph } from "./main_data"
import { check_cmd_line_steps } from './cmdline'
import { program_settings } from "./settings"
import { search_language, search_pattern, set_search_pattern, get_search_regex_clean } from "./search"
import { vql_parse } from './vql-search'
import { xml_escape, xml_unescape } from './diagrams'

/** parses generated svg from graphviz in preparation for display */
const parser = new DOMParser()
/** Has html table been generated */
let html_element = null
/** svg element parsed from graphviz svg output */
let svg_element = null
/** The format for the diagram output */
export let selected_format = 'svg'
/** list of selected specobjects */
export let selected_specobjects = null
/** List of id's matching search criteria */
export let selected_nodes = []
/** \<id> of currently selected node */
export let selected_node = null
/** The svg pan and zoom utility used in diagram pane */
export let panZoom = null
/** Currently selected \<id> */
export let selected_index = 0
/** When true diagram is generated whenever selections or exclusions are updated */
export let auto_update = true
/** When true specobject in state 'rejected' are ignored */
let no_rejects = true // shall specobjects with status===rejected be displayed?

// Manage selection highlight in diagram (extra bright red outline around selected specobject)
/** The svg id of the rectangle around a selected specobject in diagram */
let selected_polygon = null
/** width of svg outline as a string */
let selected_width = ''
/** color of svg outline as #RRGGBB string */
let selected_color = ''

export function set_auto_update (val) {
  auto_update = val
}

export function set_selected_index (idx) {
  selected_index = idx
}

export function set_selected_nodes (nodes) {
  selected_nodes = nodes
}

export function set_selected_specobjects (spo) {
  selected_specobjects = spo
}

export function set_selected_format (format) {
  selected_format = format
}

export function show_doctypes_safety () {
  // Show the graph of doctype relationships
  if (oreqm_main) {
    oreqm_main.scan_doctypes(true)
    set_issue_count()
    update_diagram(selected_format)
  }
}

export function show_doctypes () {
  // Show the graph of doctype relationships
  if (oreqm_main) {
    oreqm_main.scan_doctypes(false)
    set_issue_count()
    update_diagram(selected_format)
  }
}

export function update_diagram (selected_format) {
  // console.log("update_diagram")
  clear_diagram()
  update_graph(selected_format, spinner_show, spinner_clear, updateOutput, diagram_error)
}

function diagram_error (message) {
  error_show(message)
}

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

/**
 * Remove currently displayed graph
 */
export function clear_diagram () {
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
export function clear_html_table () {
  if (html_element) {
    html_element.innerHTML = ''
    html_element.style.display = 'none'
    html_element.style.overflow = 'hidden'
    html_element = null
  }
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

export function spinner_show () {
  document.querySelector('#spinner').classList.add('loader')
  document.querySelector('#output').classList.remove('error')
}

function spinner_clear () {
  document.querySelector('#spinner').classList.remove('loader')
  document.querySelector('#output').classList.remove('error')
}

function context_menu_event (event) {
  const menuNode = document.getElementById('node-menu')
  let str = ''
  event.preventDefault()
  // Grab all the siblings of the element that was actually clicked on
  for (const sibling of event.target.parentElement.children) {
    // Check if they're the title
    if (sibling.nodeName !== 'title') continue
    str = xml_unescape(sibling.innerHTML)
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

document.querySelector('#format select').addEventListener('change', function () {
  set_selected_format(document.querySelector('#format select').value)
  update_diagram(selected_format)
})

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
 * Checks if a node is explicitly selected, i.e. whole id is present in selection string.
 * @param {string} node id string
 */
 function selected_node_check (node) {
  return selected_nodes.includes(node)
}

export function next_selected () {
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

export function prev_selected () {
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

/**
 * Create dot diagram from list of selected nods
 * @param {string[]} results list of selected nodes
 * @param {boolean} update_selection update node navigation selection box
 */
 export function graph_results (results, update_selection=true) {
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
 * Center svg diagram around the selected specobject
 * @param {string} node_name
 */
 export function center_node (node_name) {
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

/**
 * Set list of selected <id>'s in combobox above diagram
 * @param {list} selection list of \<id>'s
 */
 function set_selection (selection) {
  set_selected_nodes(selection)
  set_selected_index(0)
  let html_str = ''
  for (let sn of selected_nodes) {
    html_str += `<option value="${sn}">${xml_escape(sn)}</option>\n`
  }
  document.getElementById('nodeSelect').innerHTML = html_str
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

/**
 * Update doctype table with counts of nodes actually displayed
 * @param {Map<string,string[]>} visible_nodes mapping from doctypes to list of visible nodes of each doctype
 * @param {string[]} selected_nodes list of id's
 */
 export function set_doctype_count_shown (visible_nodes, selected_nodes) {
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
export function clear_doctypes_table () {
  const element = document.getElementById('dyn_doctype_table')
  if (element) {
    element.parentNode.removeChild(element)
  }
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
 * Update svg outline around selected specobject
 */
 export function clear_selection_highlight () {
  if (selected_polygon) {
    selected_polygon.setAttribute('stroke-width', selected_width)
    selected_polygon.setAttribute('stroke', selected_color)
    selected_polygon = null
  }
}

export function filter_change () {
  if (auto_update) {
    filter_graph()
  }
}

/**
 * Update diagram with current selection and exclusion parameters
 */
 export function filter_graph () {
  // console.log("filter_graph")
  reset_selection()
  clear_toast()
  if (oreqm_main) {
    spinner_show()
    oreqm_main.set_no_rejects(no_rejects)
    handle_pruning()
    // Collect filter criteria and generate .dot data
    set_search_pattern(get_search_regex_clean())
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
      set_selected_specobjects(null)
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

/** Avoid flickering of toast 'killer' */
let toast_maybe_visible = false

export function show_toast (message) {
  toast_maybe_visible = true
  showToast({
    str: message,
    time: 10000,
    position: 'middle'
  })
}


/**
 * Show a toast when graph has been limited to max_nodes nodes
 * @param {number} max_nodes The limit
 */
// istanbul ignore next
export function report_limit_as_toast (max_nodes) {
  toast_maybe_visible = true
  showToast({
    str: `More than ${max_nodes} specobjects.\nGraph is limited to 1st ${max_nodes} encountered.`,
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
 * Clear node selection list and visible combobox
 */
 function reset_selection () {
  set_selected_nodes([])
  set_selected_index(0)
  const nodeSelectEntries = document.getElementById('nodeSelect')
  nodeSelectEntries.innerHTML = ''
}

// some ways to select a subset of specobjects
function select_all (_node_id, rec, _node_color) {
  // Select all - no need to inspect input
  if (no_rejects) {
    return rec.status !== 'rejected'
  }
  return true
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

/**
 * Search all id strings for a match to regex and create selection list
 * @param {string} regex regular expression
 */
 function id_search (regex) { //rq: ->(rq_search_id_only)
  set_selected_specobjects(oreqm_main.find_reqs_with_name(regex))
  graph_results(selected_specobjects)
}

/**
 * Parse VQL string and generate dot graph
 * @param {string} vql_str search expression
 */
function vql_search (vql_str) {
  let result = vql_parse(oreqm_main, vql_str)
  if (result) {
    set_selected_specobjects(Array.from(result))
    graph_results(selected_specobjects)
  }
}

/**
 * Search combined tagged string for a match to regex and create selection list `results`
 * Show digram with the matching nodes and reacable nodes.
 * @param {string} regex search criteria
 */
function txt_search (regex) { //rq: ->(rq_sel_txt)
  set_selected_specobjects(oreqm_main.find_reqs_with_text(regex))
  graph_results(selected_specobjects)
}

/**
 * Get the list of doctypes with checked 'excluded' status from html
 * @return {string[]} list of doctypes
 */
 export function get_excluded_doctypes () {
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
 export function set_excluded_doctype_checkboxes () {
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
export function toggle_exclude () {
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

/** doctype exclusion was toggled */
export function doctype_filter_change () {
  set_doctype_all_checkbox()
  // console.log("doctype_filter_change (click)")
  filter_change()
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

