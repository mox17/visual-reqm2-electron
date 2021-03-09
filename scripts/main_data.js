'use strict'
/* global Worker, alert */
import _ from './util.js'
import { ReqM2Oreqm } from './diagrams.js'
import Viz from 'viz.js'
import fs from 'fs'

/**
 * Callback when updated settings are taken into use
 */
export function settings_updated () {
  if (oreqm_main) {
    // settings can affect the rendering, therefore cache must be flushed
    oreqm_main.clear_cache()
  }
}

let action_start = action_indicate_start
let action_done = action_indicate_done

// Empty functions as fallback
function action_indicate_start () { }
function action_indicate_done () { }

export function set_action_cb (start, done) {
  action_start = start
  action_done = done
}

/** worker thread running graphviz */
let vizjs_worker
/** svg output from graphviz */
export var svg_result
/** Object containing internal representation of main oreqm file */
export var oreqm_main
/** Object containing internal representation of reference oreqm file */
export var oreqm_ref
/** \n separated list of excluded ids */
// var excluded_ids = ''
/** the generated 'dot' source submitted to graphviz */
export var dot_source = ''

/**
 * Start graphviz in worker thread on processing new dot graph.
 * @param {string} selected_format 'svg'/'png-image-element'/'dot-cource'
 * @param {function} cb_spinner_run some_function(string) showing progress
 * @param {function} cb_spinner_stop some_function() remove spinner
 * @param {function} cb_success some_function(result)
 * @param {function} cb_error some_function(error)
 */
export function update_graph (selected_format, cb_spinner_run, cb_spinner_stop, cb_success, cb_error) {
  action_start()
  if (vizjs_worker) {
    vizjs_worker.terminate()
    vizjs_worker = null
  }
  vizjs_worker = new Worker('./lib/worker.js')
  if (cb_spinner_run) {
    cb_spinner_run('Processing dot')
  }
  vizjs_worker.onmessage = function (e) {
    svg_result = e.data
    if (cb_spinner_stop) {
      cb_spinner_stop()
    }
    if (cb_success) {
      cb_success(e.data)
    }
    action_done()
  }

  vizjs_worker.onerror = function (e) {
    const message = e.message === undefined ? 'An error occurred while processing the graph input.' : e.message
    console.error(e)
    console.log(dot_source)
    e.preventDefault()
    if (cb_error) {
      cb_error(message)
    }
    action_done()
  }

  dot_source = oreqm_main !== null ? oreqm_main.get_dot() : 'digraph foo {\nfoo -> bar\nfoo -> baz\n}\n'
  const params = {
    src: dot_source,
    options: {
      engine: 'dot', // document.querySelector("#engine select").value,
      format: selected_format,
      totalMemory: 4 * 16 * 1024 * 1024
    }
  }

  // Instead of asking for png-image-element directly, which we can't do in a worker,
  // ask for SVG and convert when updating the output.
  if (params.options.format === 'png-image-element') {
    params.options.format = 'svg'
  }

  if (selected_format === 'dot-source') {
    if (cb_success) {
      cb_success(dot_source)
    }
    if (cb_spinner_stop) {
      cb_spinner_stop()
    }
    action_done()
  } else {
    vizjs_worker.postMessage(params)
    if (cb_spinner_run) {
      cb_spinner_run('Processing dot...')
    }
  }
}

/**
 * Create oreqm object
 * @param {string} name filename
 * @param {*} data XML content of file
 */
export function create_oreqm_main (name, data) {
  oreqm_main = new ReqM2Oreqm(name, data, [], [])
  return oreqm_main
}

/**
 * Create oreqm object
 * @param {string} name filename
 * @param {*} data XML content of file
 */
export function create_oreqm_ref (name, data) {
  oreqm_ref = new ReqM2Oreqm(name, data, [], [])
  return oreqm_ref
}

/**
 * Convert svg to png
 * @param {string} svg diagram in string format
 * @return {object} png image
 */
export function convert_svg_to_png (svg, cb_done = undefined) {
  return Viz.svgXmlToPngImageElement(svg, 1, cb_done)
}

/**
 * Save svg or png file. Format is controlled with extension of filename
 * @param {string} savePath path whre to store diagram
 */
export function save_diagram_file (savePath) {
  action_start()
  if (savePath.endsWith('.svg') || savePath.endsWith('.SVG')) {
    fs.writeFileSync(savePath, svg_result, 'utf8')
    action_done()
  } else if (savePath.endsWith('.png') || savePath.endsWith('.PNG')) {
    Viz.svgXmlToPngImageElement(svg_result, 1, (ev, png) => {
      if (ev === null) {
        const data_b64 = png.src.slice(22)
        const buf = new Buffer.from(data_b64, 'base64')
        fs.writeFileSync(savePath, buf, 'utf8')
      } else {
        console.log('error generating png:', ev)
      }
      action_done()
    })
  } else if (savePath.endsWith('.dot') || savePath.endsWith('.DOT')) {
    fs.writeFileSync(savePath, dot_source, 'utf8')
    action_done()
  } else {
    alert('Unsupported file types in\n' + savePath)
    action_done()
  }
}

/**
 * clean up reference oreqm object
 */
export function clear_oreqm_ref () {
  oreqm_ref = null
  oreqm_main.remove_ghost_requirements(true)
}

/**
 * Values for tagging nodes visited while traversing UP and DOWN the graph of specobjects
 */
export const COLOR_UP = 1
export const COLOR_DOWN = 2

export function select_color (node_id, rec, node_color) {
  // Select colored nodes
  return node_color.has(COLOR_UP) || node_color.has(COLOR_DOWN)
}
