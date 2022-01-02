'use strict'
// eslint-disable-next-line no-redeclare
/* global Worker, alert */
import { ReqM2Oreqm } from './diagrams.js'
import Viz from 'viz.js'
import fs from 'fs'
import { ipcRenderer } from 'electron'

/**
 * Callback when updated settings are taken into use
 */
export function settingsUpdated () {
  if (oreqmMain) {
    // settings can affect the rendering, therefore cache must be flushed
    oreqmMain.clearCache()
  }
}

let actionStart = actionIndicateStart
let actionDone = actionIndicateDone

// Empty functions as fallback
// istanbul ignore next
function actionIndicateStart () { }
// istanbul ignore next
function actionIndicateDone () { }

export function setActionCb (start, done) {
  actionStart = start
  actionDone = done
}

/** worker thread running graphviz */
let vizjsWorker
/** svg output from graphviz */
export var svgResult = ''
/** Object containing internal representation of main oreqm file */
export var oreqmMain = null
/** Object containing internal representation of reference oreqm file */
export var oreqmRef = null
/** the generated 'dot' source submitted to graphviz */
export var dotSource = ''

/**
 * Start graphviz in worker thread on processing new dot graph.
 * @param {string} selectedFormat 'svg'/'png-image-element'/'dot-cource'
 * @param {function} cbSpinnerRun someFunction(string) showing progress
 * @param {function} cbSpinnerStop someFunction() remove spinner
 * @param {function} cbSuccess someFunction(result)
 * @param {function} cbError someFunction(error)
 */
export function updateGraph (selectedFormat, cbSpinnerRun, cbSpinnerStop, cbSuccess, cbError) {
  // console.log("updateGraph")
  actionStart()
  if (vizjsWorker) {
    vizjsWorker.terminate()
    vizjsWorker = null
  }
  vizjsWorker = new Worker('./lib/worker.js')
  if (cbSpinnerRun) {
    cbSpinnerRun('Processing dot')
  }
  vizjsWorker.onmessage = function (e) {
    // console.log("vizjsWorker.onmessage")
    svgResult = e.data
    if (cbSpinnerStop) {
      cbSpinnerStop()
    }
    if (cbSuccess) {
      cbSuccess(e.data)
    }
    actionDone()
  }

  // istanbul ignore next
  vizjsWorker.onerror = function (e) {
    // const message = e.message === undefined ? 'An error occurred while processing the graph input.' : e.message
    const message = 'The Graphviz library could not generate a graph from the input.\nLimit the number of shown specobjects.'
    console.error(e)
    //console.log(dotSource)
    e.preventDefault()
    if (cbError) {
      cbSpinnerStop()
      cbError(message)
    }
    actionDone()
  }

  dotSource = oreqmMain !== null ? oreqmMain.getDot() : 'digraph foo {\nfoo -> bar\nfoo -> baz\n}\n'
  const params = {
    src: dotSource,
    options: {
      engine: 'dot', // document.querySelector("#engine select").value,
      format: selectedFormat,
      totalMemory: 4 * 16 * 1024 * 1024
    }
  }

  // Instead of asking for png-image-element directly, which we can't do in a worker,
  // ask for SVG and convert when updating the output.
  if (params.options.format === 'png-image-element') {
    params.options.format = 'svg'
  }

  switch (selectedFormat) {
    case 'dot-source':
      if (cbSuccess) {
        cbSuccess(dotSource)
      }
      if (cbSpinnerStop) {
        cbSpinnerStop()
      }
      actionDone()
      break;

    case 'html-table':
      if (cbSuccess) {
        cbSuccess(null)
      }
      if (cbSpinnerStop) {
        cbSpinnerStop()
      }
      actionDone()
      break;

    case 'svg':
    case 'png-image-element':
    default:
      vizjsWorker.postMessage(params)
      if (cbSpinnerRun) {
        cbSpinnerRun('Processing dot...')
      }
  }
}

/**
 * Create oreqm object
 * @param {string} name filename
 * @param {*} data XML content of file
 */
export function createOreqmMain (name, data) {
  // Stop watching any previous file
  if (oreqmMain) {
    fs.unwatchFile(oreqmMain.filename)
  }
  oreqmMain = new ReqM2Oreqm(name, data, [], [])
  fs.watchFile(name, (_curr, _prev) => {
    // console.log("File updated: ", name)
    ipcRenderer.send('file_updated', 'Main .oreqm changed', name)
  })
  return oreqmMain
}

/**
 * Create oreqm object
 * @param {string} name filename
 * @param {*} data XML content of file
 */
export function createOreqmRef (name, data) {
  // Stop watching any previous file
  if (oreqmRef) {
    fs.unwatchFile(oreqmRef.filename)
  }
  oreqmRef = new ReqM2Oreqm(name, data, [], [])
  fs.watchFile(name, (_curr, _prev) => {
    // console.log("File updated: ", name)
    ipcRenderer.send('file_updated', 'Reference .oreqm changed', name)
  })
  return oreqmRef
}

/**
 * Convert svg to png
 * @param {string} svg diagram in string format
 * @return {object} png image
 */
export function convertSvgToPng (svg, cbDone = undefined) {
  return Viz.svgXmlToPngImageElement(svg, 1, cbDone)
}

/**
 * Save svg or png file. Format is controlled with extension of filename
 * @param {string} savePath path whre to store diagram
 */
export function saveDiagramFile (savePath) {
  actionStart()
  if (savePath.endsWith('.svg') || savePath.endsWith('.SVG')) {
    fs.writeFileSync(savePath, svgResult, 'utf8')
    actionDone()
  } else if (savePath.endsWith('.png') || savePath.endsWith('.PNG')) {
    Viz.svgXmlToPngImageElement(svgResult, 1, (ev, png) => {
      if (ev === null) {
        const dataB64 = png.src.slice(22)
        const buf = new Buffer.from(dataB64, 'base64')
        fs.writeFileSync(savePath, buf, 'utf8')
      } else {
        console.log('error generating png:', ev)
      }
      actionDone()
    })
  } else if (savePath.endsWith('.dot') || savePath.endsWith('.DOT')) {
    fs.writeFileSync(savePath, dotSource, 'utf8')
    actionDone()
  } else {
    alert('Unsupported file types in\n' + savePath)
    actionDone()
  }
}

/**
 * clean up reference oreqm object
 */
export function clearOreqmRef () {
  fs.unwatchFile(oreqmRef.filename)
  oreqmRef = null
  oreqmMain.removeGhostRequirements(true)
}

/**
 * Values for tagging nodes visited while traversing UP and DOWN the graph of specobjects
 */
export const COLOR_UP = 1
export const COLOR_DOWN = 2

/**
 * Check if node is selected
 * @param {string} nodeId key of node
 * @param {object} rec JS object for node
 * @param {Set} nodeColor color
 * @return {boolean} true if selected
 */
export function selectColor (nodeId, rec, nodeColor) {
  // Select colored nodes
  return nodeColor.has(COLOR_UP) || nodeColor.has(COLOR_DOWN)
}
