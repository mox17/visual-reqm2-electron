'use strict'
import showToast from 'show-toast'
import { oreqmMain, oreqmRef, svgResult, convertSvgToPng, dotSource,
         COLOR_UP, COLOR_DOWN, selectColor, setActionCb } from "./main_data"
import { setIssueCount } from "./issues"
import { updateGraph } from "./main_data"
import { checkCmdLineSteps } from './cmdline'
import { programSettings } from "./settings"
import { searchLanguage, searchPattern, setSearchPattern, getSearchRegexClean } from "./search"
import { vqlParse } from './vql-search'
import { xmlEscape, xmlUnescape } from './diagrams'

/** parses generated svg from graphviz in preparation for display */
const parser = new DOMParser()
/** Has html table been generated */
let htmlElement = null
/** svg element parsed from graphviz svg output */
let svgElement = null
/** The format for the diagram output */
export let selectedFormat = 'svg'
/** list of selected specobjects */
export let selectedSpecobjects = null
/** List of id's matching search criteria */
export let selectedNodes = []
/** \<id> of currently selected node */
export let selectedNode = null
/** The svg pan and zoom utility used in diagram pane */
export let panZoom = null
/** Currently selected \<id> */
export let selectedIndex = 0
/** When true diagram is generated whenever selections or exclusions are updated */
export let autoUpdate = true

// Manage selection highlight in diagram (extra bright red outline around selected specobject)
/** The svg id of the rectangle around a selected specobject in diagram */
let selectedPolygon = null
/** width of svg outline as a string */
let selectedWidth = ''
/** color of svg outline as #RRGGBB string */
let selectedColor = ''

export function setAutoUpdate (val) {
  autoUpdate = val
}

export function setSelectedIndex (idx) {
  selectedIndex = idx
}

export function setSelectedNodes (nodes) {
  selectedNodes = nodes
}

export function setSelectedSpecobjects (spo) {
  selectedSpecobjects = spo
}

export function setSelectedFormat (format) {
  selectedFormat = format
}

export function showDoctypesSafety () {
  // Show the graph of doctype relationships
  // istanbul ignore else
  if (oreqmMain) {
    oreqmMain.scanDoctypes(true)
    setIssueCount()
    updateDiagram(selectedFormat)
  }
}

export function showDoctypes () {
  // Show the graph of doctype relationships
  // istanbul ignore else
  if (oreqmMain) {
    oreqmMain.scanDoctypes(false)
    setIssueCount()
    updateDiagram(selectedFormat)
  }
}

export function updateDiagram (selectedFormat) {
  // console.log("update_diagram")
  clearDiagram()
  updateGraph(selectedFormat, spinnerShow, spinnerClear, updateOutput, diagramError)
}

function diagramError (message) {
  errorShow(message)
}

/**
 * Display error messages from worker
 * @param {string} message error message from Viz.js
 */
// istanbul ignore next
function errorShow (message) {
  spinnerClear()
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
export function clearDiagram () {
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

  if (htmlElement) {
    htmlElement.style.display = 'none'
    htmlElement.style.overflow = 'hidden'
  }
}

function showHtmlTable() {
  //rq: ->(rq_table_view)
  let ids = selectedSpecobjects ? selectedSpecobjects : oreqmMain.getIdList()
  if (!htmlElement) {
    // Create table 1st time
    let table = oreqmMain.generateHtmlTable()
    htmlElement = document.getElementById('html_table')
    htmlElement.innerHTML = table
  }
  htmlElement.style.overflow = 'visible'
  // Update visibility of selected specobjects
  let allDivs = htmlElement.getElementsByTagName('div')
  for (let div of allDivs) {
    if (div.id.startsWith('spec_')) {
      let testId = div.id.replace(/^spec_/, '')
      div.style.display = (ids.includes(testId) &&
                            oreqmMain.isReqVisible(testId)) ? 'block' : 'none'
    }
  }
  htmlElement.style.display = 'block'
}

/**
 * Removes the html table  from the DOM and clears helper variables
 */
export function clearHtmlTable () {
  if (htmlElement) {
    htmlElement.innerHTML = ''
    htmlElement.style.display = 'none'
    htmlElement.style.overflow = 'hidden'
    htmlElement = null
  }
}

/**
 * Render generated diagram in window, considering the selected output format
 * and set up event handlers for resizing, pan/zoom and context menu
 */
function updateOutput (_result) {
  const graph = document.querySelector('#output')
  clearDiagram()
  // istanbul ignore next
  if ((selectedFormat === 'svg') && !svgResult) {
    // This is when creation of a diagram fails
    console.log("svg generation failed")
    return
  }

  switch (selectedFormat) {
    case 'svg':
      updateSvgOutput(graph)
      break

    case 'png-image-element': {
      //rq: ->(rq_show_png)
      const image = convertSvgToPng(svgResult)
      graph.appendChild(image)
      break
    }

    case 'dot-source': {
      //rq: ->(rq_show_dot)
      const dotText = document.createElement('div')
      dotText.id = 'text'
      dotText.appendChild(document.createTextNode(dotSource))
      graph.appendChild(dotText)
      break
    }

    case 'html-table': {
      showHtmlTable()
      break
    }
  }
  checkCmdLineSteps()
}

function updateSvgOutput (graph) {
  //rq: ->(rq_show_svg)
  svgElement = parser.parseFromString(svgResult, 'image/svg+xml').documentElement
  svgElement.id = 'svg_output'
  graph.appendChild(svgElement)

  //rq: ->(rq_svg_pan_zoom)
  panZoom = svgPanZoom(svgElement, {
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

  svgElement.addEventListener('paneresize', function () {
    panZoom.resize()
  }, false)

  window.addEventListener('resize', function () {
    panZoom.resize()
  })

  svgElement.addEventListener('focus', function () {
    this.addEventListener('keypress', function () {
      // console.log(e.keyCode);
    })
  }, svgElement)

  // Keyboard shortcuts when focus on graph pane
  document.getElementById('graph').onkeydown = svgKeyboardShortcutEvent

  // context menu setup
  //rq: ->(rq_svg_context_menu)
  const menuNode = document.getElementById('node-menu')
  svgElement.addEventListener('contextmenu', contextMenuEvent)

  window.addEventListener('click', function (e) {
    // hide context menu
    if (menuNode.style.display !== 'none' && menuNode.style.display !== '') {
      menuNode.style.display = 'none'
      e.preventDefault()
    }
  })
}

function svgKeyboardShortcutEvent(e) {
  //rq: ->(rq_navigate_sel)
  switch (e.key) {
    case 'n':
      nextSelected()
      break
    case 'p':
      prevSelected()
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

export function spinnerShow () {
  document.querySelector('#spinner').classList.add('loader')
  document.querySelector('#output').classList.remove('error')
}

function spinnerClear () {
  document.querySelector('#spinner').classList.remove('loader')
  document.querySelector('#output').classList.remove('error')
}

function contextMenuEvent (event) {
  const menuNode = document.getElementById('node-menu')
  let str = ''
  event.preventDefault()
  // Grab all the siblings of the element that was actually clicked on
  for (const sibling of event.target.parentElement.children) {
    // Check if they're the title
    if (sibling.nodeName !== 'title') continue
    str = xmlUnescape(sibling.innerHTML)
    break
  }
  selectedNode = str
  if ((menuNode.style.display === '') ||
        (menuNode.style.display === 'none') ||
        (menuNode.style.display === 'initial')) {
    // show context menu
    const stage = document.getElementById('output')
    const containerRect = stage.getBoundingClientRect()
    menuNode.style.display = 'initial'
    menuNode.style.top = '0'
    menuNode.style.left = '0'
    updateMenuOptions(selectedNode)
    const menuWidth = menuNode.clientWidth
    const menuHeight = menuNode.clientHeight
    let menuRelX = 2
    let menuRelY = 2
    if ((event.pageX + menuWidth + menuRelX + 20) >= containerRect.right) {
      menuRelX = -menuRelX - menuWidth
    }
    if ((event.pageY + menuHeight + menuRelY + 28) >= containerRect.bottom) {
      menuRelY = -menuRelY - menuHeight - 16 // compensate height of a row
    }
    menuNode.style.top = /* containerRect.top  + */ event.pageY + menuRelY + 'px'
    menuNode.style.left = /* containerRect.left + */ event.pageX + menuRelX + 'px'
  } else {
    // Remove on 2nd right-click
    menuNode.style.display = 'none'
  }
}

document.querySelector('#format select').addEventListener('change', function () {
  setSelectedFormat(document.querySelector('#format select').value)
  updateDiagram(selectedFormat)
})

/**
 * Update context menu for selected node
 * @param {string} nodeId
 */
 function updateMenuOptions (nodeId) {
  // get individual context menu options as appropriate
  if (oreqmMain && oreqmMain.checkNodeId(nodeId)) {
    // a node was right-clicked
    document.getElementById('menu_select').classList.remove('custom-menu_disabled')
    document.getElementById('menu_copy_id').classList.remove('custom-menu_disabled')
    document.getElementById('menu_copy_ffb').classList.remove('custom-menu_disabled')
    document.getElementById('menu_exclude').classList.remove('custom-menu_disabled')
    document.getElementById('menu_xml_txt').classList.remove('custom-menu_disabled')
    document.getElementById('menu_search_txt').classList.remove('custom-menu_disabled')
    if (selectedNodeCheck(nodeId)) {
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
 function selectedNodeCheck (node) {
  return selectedNodes.includes(node)
}

export function nextSelected () {
  // Create next diagram with a single selected node
  if (oreqmMain && selectedNodes.length) {
    // istanbul ignore next
    if (selectedIndex > selectedNodes.length) selectedIndex = 0
    selectedIndex++
    if (selectedIndex >= selectedNodes.length) selectedIndex = 0
    document.getElementById('nodeSelect').selectedIndex = selectedIndex

    if (document.getElementById('single_select').checked) {
      // Generate new diagram with *single* selected node
      graphResults([selectedNodes[selectedIndex]], false)
      updateDiagram(selectedFormat)
    } else {
      // Center diagram on next node
      centerNode(selectedNodes[selectedIndex])
    }
  }
}

export function prevSelected () {
  // step backwards through nodes and center display
  if (oreqmMain && selectedNodes.length) {
    // istanbul ignore next
    if (selectedIndex > selectedNodes.length) selectedIndex = 0
    selectedIndex--
    if (selectedIndex < 0) selectedIndex = selectedNodes.length - 1
    document.getElementById('nodeSelect').selectedIndex = selectedIndex
    if (document.getElementById('single_select').checked) {
      // Generate new diagram with *single* selected node
      graphResults([selectedNodes[selectedIndex]], false)
      updateDiagram(selectedFormat)
    } else {
      centerNode(selectedNodes[selectedIndex])
    }
  }
}

/**
 * Create dot diagram from list of selected nods
 * @param {string[]} results list of selected nodes
 * @param {boolean} updateSelection update node navigation selection box
 */
 export function graphResults (results, updateSelection=true) {
  oreqmMain.clearColorMarks()
  let depth = document.getElementById('limit_depth_input').checked ? 1 : 99 //rq: ->(rq_limited_walk)
  oreqmMain.markAndFloodUpDown(results, COLOR_UP, COLOR_DOWN, depth)
  const graph = oreqmMain.createGraph(selectColor,
    programSettings.top_doctypes,
    oreqmMain.constructGraphTitle(true, null, oreqmRef, searchLanguage, searchPattern),
    results,
    programSettings.max_calc_nodes,
    programSettings.show_coverage,
    programSettings.color_status)
  setDoctypeCountShown(graph.doctypeDict, oreqmMain.getDoctypeDict(results))
  //setDoctypeCountShown(graph.doctypeDict, graph.selectedDict)
  setIssueCount()
  if (updateSelection) {
    setSelection(graph.selectedNodes)
  }
}

/**
 * Center svg diagram around the selected specobject
 * @param {string} nodeName
 */
 export function centerNode (nodeName) {
  let found = false
  // Get translation applied to svg coordinates by Graphviz
  const graph0 = document.querySelectorAll('.graph')[0]
  const transX = graph0.transform.baseVal[2].matrix.e
  const transY = graph0.transform.baseVal[2].matrix.f
  // Grab all the siblings of the element that was actually clicked on
  const titles = document.querySelectorAll('.node > title')
  let bb
  let node
  for (node of titles) {
    if (node.innerHTML === nodeName) {
      found = true
      bb = node.parentNode.getBBox()
      break
    }
  }
  if (found) {
    setSelectionHighlight(document.getElementById(`sel_${nodeName}`))
    let here = panZoom.getPan()
    const output = document.getElementById('output')
    const sizes = panZoom.getSizes()
    const rz = sizes.realZoom
    const windowWidth = output.clientWidth / rz
    const windowHeight = output.clientHeight / rz
    const reqCenterX = bb.x + bb.width * 0.5
    let reqCenterY = bb.y

    let centerposX = sizes.viewBox.width * 0.5
    let centerposY = sizes.viewBox.height * 0.3
    if (windowWidth > sizes.viewBox.width) {
      centerposX += (windowWidth - sizes.viewBox.width) * 0.5
    }
    if (windowWidth < sizes.viewBox.width) {
      centerposX -= (sizes.viewBox.width - windowWidth) * 0.5
    }
    if (windowHeight > sizes.viewBox.height) {
      reqCenterY -= (windowHeight - sizes.viewBox.height) * 0.3
    }
    if (windowHeight < sizes.viewBox.height) {
      centerposY -= (sizes.viewBox.height - windowHeight) * 0.3
    }
    // console.log(centerposX, centerposY)
    const panVectorX = (centerposX - reqCenterX - transX) * rz
    const panVectorY = (centerposY - reqCenterY - transY) * rz
    // console.log(panVectorX, panVectorY)
    let steps = 15
    let there = { x: panVectorX, y: panVectorY }
    let delta = { x: (there.x-here.x)/steps, y: (there.y-here.y)/steps }
    //console.log('Pan: ', here, there, delta)
    //panZoom.pan(there)
    actionBusy()
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
 function setSelection (selection) {
  setSelectedNodes(selection)
  setSelectedIndex(0)
  let htmlStr = ''
  for (let sn of selectedNodes) {
    htmlStr += `<option value="${sn}">${xmlEscape(sn)}</option>\n`
  }
  document.getElementById('nodeSelect').innerHTML = htmlStr
}

/**
 * Set highlight in svg around specified node
 * @param {DOMobject} node SVG object. Naming is 'sel_'+id
 */
 function setSelectionHighlight (node) {
  clearSelectionHighlight()
  const outline = node.querySelector('.cluster > path')
  if (outline) {
    selectedPolygon = outline
    selectedWidth = selectedPolygon.getAttribute('stroke-width')
    selectedColor = selectedPolygon.getAttribute('stroke')
    selectedPolygon.setAttribute('stroke-width', '8')
    selectedPolygon.setAttribute('stroke', '#FF0000')
  }
}

/**
 * Update doctype table with counts of nodes actually displayed
 * @param {Map<string,string[]>} visibleNodes mapping from doctypes to list of visible nodes of each doctype
 * @param {string[]} selectedNodes list of id's
 */
 export function setDoctypeCountShown (visibleNodes, selectedNodes) {
  let doctypes = visibleNodes.keys()
  let shownCount = 0
  for (const doctype of doctypes) {
    const shownCell = document.getElementById(`doctype_shown_${doctype}`)
    if (shownCell) {
      shownCell.innerHTML = visibleNodes.get(doctype).length //rq: ->(rq_dt_shown_stat)
      shownCount += visibleNodes.get(doctype).length
    }
  }
  const shownCellTotals = document.getElementById('doctype_shown_totals')
  if (shownCellTotals) {
    shownCellTotals.innerHTML = shownCount
  }
  doctypes = selectedNodes.keys()
  let selectedCount = 0
  for (const doctype of doctypes) {
    const selectedCell = document.getElementById(`doctype_select_${doctype}`)
    if (selectedCell) {
      selectedCell.innerHTML = selectedNodes.get(doctype).length //rq: ->(rq_dt_exist_stat)
      selectedCount += selectedNodes.get(doctype).length
    }
  }
  const selectedCellTotals = document.getElementById('doctype_select_totals')
  if (selectedCellTotals) {
    //rq: ->(rq_dt_sel_stat)
    selectedCellTotals.innerHTML = selectedCount
  }
}

/** Remove doctype table */
export function clearDoctypesTable () {
  const element = document.getElementById('dyn_doctype_table')
  if (element) {
    element.parentNode.removeChild(element)
  }
}

function actionBusy () {
  document.getElementById('vrm2_working').innerHTML = 'working'
}

function actionDone () {
  document.getElementById('vrm2_working').innerHTML = 'done'
}

/** install callbacks for progress tracking */
setActionCb(actionBusy, actionDone)

/**
 * Update svg outline around selected specobject
 */
 export function clearSelectionHighlight () {
  if (selectedPolygon) {
    selectedPolygon.setAttribute('stroke-width', selectedWidth)
    selectedPolygon.setAttribute('stroke', selectedColor)
    selectedPolygon = null
  }
}

export function filterChange () {
  if (autoUpdate) {
    filterGraph()
  }
}

/**
 * Update diagram with current selection and exclusion parameters
 */
 export function filterGraph () {
  // console.log("filter_graph")
  resetSelection()
  clearToast()
  if (oreqmMain) {
    spinnerShow()
    oreqmMain.setNoRejects(programSettings.no_rejects)
    handlePruning()
    // Collect filter criteria and generate .dot data
    setSearchPattern(getSearchRegexClean())
    // console.log("filter_graph()", search_pattern)
    if (searchPattern) {
      switch (searchLanguage) {
        case 'ids':
          idSearch(searchPattern)
          break
        case  'reg':
          txtSearch(searchPattern)
          break
        case 'vql':
          vqlSearch(searchPattern)
          break
      }
      updateDiagram(selectedFormat)
    } else {
      //rq: ->(rq_no_sel_show_all)
      // no pattern specified
      setSelectedSpecobjects(null)
      const title = oreqmMain.constructGraphTitle(true, null, oreqmRef, false, '')
      const graph = oreqmMain.createGraph(
        selectAll,
        programSettings.top_doctypes,
        title,
        [],
        programSettings.max_calc_nodes,
        programSettings.show_coverage,
        programSettings.color_status)
      setDoctypeCountShown(graph.doctypeDict, graph.selectedDict)
      setIssueCount()
      updateDiagram(selectedFormat)
    }
  }
}

/** Avoid flickering of toast 'killer' */
let toastMaybeVisible = false

export function myShowToast (message) {
  toastMaybeVisible = true
  showToast({
    str: message,
    time: 10000,
    position: 'middle'
  })
}


/**
 * Show a toast when graph has been limited to maxNodes nodes
 * @param {number} maxNodes The limit
 */
// istanbul ignore next
export function reportLimitAsToast (maxNodes) {
  toastMaybeVisible = true
  showToast({
    str: `More than ${maxNodes} specobjects.\nGraph is limited to 1st ${maxNodes} encountered.`,
    time: 10000,
    position: 'middle'
  })
}

function clearToast () {
  // istanbul ignore next
  if (toastMaybeVisible) {
    showToast({
      str: '',
      time: 0,
      position: 'middle'
    })
    toastMaybeVisible = false
  }
}

/**
 * Clear node selection list and visible combobox
 */
 function resetSelection () {
  setSelectedNodes([])
  setSelectedIndex(0)
  const nodeSelectEntries = document.getElementById('nodeSelect')
  nodeSelectEntries.innerHTML = ''
}

// some ways to select a subset of specobjects
function selectAll (_nodeId, rec, _nodeColor) {
  // Select all - no need to inspect input
  if (programSettings.no_rejects) {
    return rec.status !== 'rejected'
  }
  return true
}

/**
 * Handle display (or not) of rejected specobjects
 */
 document.getElementById('no_rejects').addEventListener('change', function () {
  noRejectsClick()
})

function noRejectsClick () {
  programSettings.no_rejects = document.getElementById('no_rejects').checked
  filterChange()
}

/**
 * Take exclusion parameters (excluded doctypes and excluded <id>s) from UI and transfer to oreqm object
 */
function handlePruning () {
  if (oreqmMain) {
    let exIdList = []
    const excludedIds = document.getElementById('excluded_ids').value.trim()
    if (excludedIds.length) {
      exIdList = excludedIds.split(/[\n,]+/)
    }
    oreqmMain.setExcludedIds(exIdList)
    const exDtList = getExcludedDoctypes()
    oreqmMain.setExcludedDoctypes(exDtList)
  }
}

/**
 * Search all id strings for a match to regex and create selection list
 * @param {string} regex regular expression
 */
function idSearch (regex) { //rq: ->(rq_search_id_only)
  setSelectedSpecobjects(oreqmMain.findReqsWithName(regex))
  graphResults(selectedSpecobjects)
}

/**
 * Parse VQL string and generate dot graph
 * @param {string} vqlStr search expression
 */
function vqlSearch (vqlStr) {
  let result = vqlParse(oreqmMain, vqlStr)
  if (result) {
    setSelectedSpecobjects(Array.from(result))
    graphResults(selectedSpecobjects)
  }
}

/**
 * Search combined tagged string for a match to regex and create selection list `results`
 * Show digram with the matching nodes and reacable nodes.
 * @param {string} regex search criteria
 */
function txtSearch (regex) { //rq: ->(rq_sel_txt)
  setSelectedSpecobjects(oreqmMain.findReqsWithText(regex))
  graphResults(selectedSpecobjects)
}

/**
 * Get the list of doctypes with checked 'excluded' status from html
 * @return {string[]} list of doctypes
 */
export function getExcludedDoctypes () {
  const excludedList = []
  if (oreqmMain) {
    const doctypes = oreqmMain.getDoctypes()
    const names = doctypes.keys()
    for (const doctype of names) {
      const cbName = `doctype_${doctype}`
      const status = document.getElementById(cbName)
      if (status && status.checked) {
        excludedList.push(doctype)
      }
      // console.log(doctype, status, status.checked)
    }
  }
  return excludedList
}

/**
 * Set checkboxes according to excluded doctypes
 */
 export function setExcludedDoctypeCheckboxes () {
  // istanbul ignore else
  if (oreqmMain) {
    const doctypes = oreqmMain.getDoctypes()
    const names = doctypes.keys()
    const exList = oreqmMain.getExcludedDoctypes()
    for (const doctype of names) {
      const box = document.getElementById(`doctype_${doctype}`)
      box.checked = exList.includes(doctype)
    }
    doctypeFilterChange()
  }
}


/**
 * Set all doctypes to excluded/included
 */
export function toggleExclude () {
  // istanbul ignore else
  if (oreqmMain) {
    const doctypes = oreqmMain.getDoctypes()
    const names = doctypes.keys()
    const exList = getExcludedDoctypes()
    const newState = exList.length === 0
    for (const doctype of names) {
      const box = document.getElementById(`doctype_${doctype}`)
      // istanbul ignore else
      if (newState !== box.checked) {
        box.checked = newState
      }
    }
    doctypeFilterChange()
  }
}

/** doctype exclusion was toggled */
export function doctypeFilterChange () {
  setDoctypeAllCheckbox()
  // console.log("doctypeFilterChange (click)")
  filterChange()
}

function setDoctypeAllCheckbox () {
  // Set the checkbox to reflect overall status
  const doctypes = oreqmMain.getDoctypes()
  const names = doctypes.keys()
  const exList = getExcludedDoctypes()
  const dtAll = document.getElementById('doctype_all')
  if (exList.length === 0) {
    dtAll.indeterminate = false
    dtAll.checked = false
  } else if (exList.length === Array.from(names).length) {
    dtAll.indeterminate = false
    dtAll.checked = true
  } else {
    dtAll.indeterminate = true
    dtAll.checked = true
  }
}

