'use strict'
/* global localStorage */
import { remote } from 'electron'
import fs from 'fs'

/**
 * Convert HSV values in [0..1] to RGB
 * @param  {number} hue
 * @param  {number} saturation
 * @param  {number} value
 * @return {Array<number>} [r, g, b] values from 0 to 255
 */
function _hsv_to_rgb (hue, saturation, value) {
  let red, green, blue
  const hue_int = Math.floor(hue * 6)
  const f = hue * 6 - hue_int
  const p = value * (1 - saturation)
  const q = value * (1 - f * saturation)
  const t = value * (1 - (1 - f) * saturation)
  if (hue_int === 0) {
    red = value
    green = t
    blue = p
  }
  if (hue_int === 1) {
    red = q
    green = value
    blue = p
  }
  if (hue_int === 2) {
    red = p
    green = value
    blue = t
  }
  if (hue_int === 3) {
    red = p
    green = q
    blue = value
  }
  if (hue_int === 4) {
    red = t
    green = p
    blue = value
  }
  if (hue_int === 5) {
    red = value
    green = p
    blue = q
  }
  return [Math.floor(red * 256), Math.floor(green * 256), Math.floor(blue * 256)]
}

// use golden ratio
const GOLDEN_RATIO_CONJUGATE = 0.618033988749895
const HUE_START = 0.314159265359 // use "random" start value
let HUE = HUE_START

/**
 * Calculate next pseudo random color
 * @return {Array<number>} RGB colors
 */
function _get_random_color () {
  HUE += GOLDEN_RATIO_CONJUGATE
  HUE %= 1
  return _hsv_to_rgb(HUE, 0.3, 0.99)
}

function _color_random_reset () {
  HUE = HUE_START
}

/**
 * @param  {number} d number
 * @param  {number} padding amount leading zeroes
 * @return {string} hexadecimal string
 */
function _decimalToHex (d, padding) {
  let hex = Number(d).toString(16).toUpperCase()
  padding = typeof (padding) === 'undefined' || padding === null ? padding = 2 : padding

  while (hex.length < padding) {
    hex = '0' + hex
  }
  return hex
}

function _get_color_string () {
  // Return color as #RRGGBB string"""
  const color = _get_random_color()
  return `#${_decimalToHex(color[0], 2)}${_decimalToHex(color[1], 2)}${_decimalToHex(color[2], 2)}`
}

/**
 * Create new color for new doctype
 * @param  {object} palette map of doctype to color
 * @param  {string} doctype
 * @return {string} html friendly color string
 */
function _add_color (palette, doctype) {
  const doctypes = Object.keys(palette)
  let new_color
  let same_color
  do {
    new_color = _get_color_string()
    same_color = false
    for (const dt of doctypes) {
      if (new_color === palette[dt]) {
        same_color = true
        break
      }
    }
  } while (same_color === true)
  palette[doctype] = new_color
  return new_color
}

// Storage of the color mapping
let _my_palette =
{
  none: '#FFFFFF'
}

/**
 * public function to get color of doctype
 * @param  {string} key (doctype)
 * @return {string} html color
 */
export function get_color (key) {
  //rq: ->(rq_doctype_color_gen)
  let color
  if (key in _my_palette) {
    color = _my_palette[key]
  } else {
    color = _add_color(_my_palette, key)
  }
  return color
}

/**
 * Prompt user for save location and save color palette as external file.
 */
export function save_colors_fs (path = null) {
  //rq: ->(rq_doctype_color_export)
  let SavePath
  if (path === null) {
    SavePath = remote.dialog.showSaveDialogSync(null,
      {
        filters: [{ name: 'JSON files', extensions: ['json'] }],
        properties: ['openFile']
      })
  } else {
    SavePath = path
  }
  if (typeof (SavePath) !== 'undefined') {
    fs.writeFileSync(SavePath, JSON.stringify(_my_palette, null, 2), 'utf8')
    _store_colors(_my_palette)
  }
}

/**
 * Prompt user for load location and load external file as color palette.
 * @param {function} update_function some_function()
 * @param {string|null} path  path to color scheme json file
 */
export function load_colors_fs (update_function, path = null) {
  //rq: ->(rq_doctype_color_import)
  let LoadPath = null
  if (path === null) {
    LoadPath = remote.dialog.showOpenDialogSync(
      {
        filters: [{ name: 'JSON files', extensions: ['json'] }],
        properties: ['openFile']
      })
  } else {
    LoadPath = [path]
  }
  if (typeof (LoadPath) !== 'undefined' && (LoadPath.length === 1)) {
    const colors = JSON.parse(fs.readFileSync(LoadPath[0], { encoding: 'utf8', flag: 'r' }))
    _store_colors(colors)
    _my_palette = colors
    _color_random_reset()
    if (update_function) {
      update_function()
    }
  }
}

/** @global {string} Name of (legacy) browser storage for color palettes */
const color_storage_name = 'Visual_ReqM2_color_palette'

function _store_colors (colors) {
  //rq: ->(rq_doctype_color_sett)
  if (color_settings_updater !== null) {
    color_settings_updater(colors)
  }
  /*
  if (typeof(Storage) !== "undefined") {
    const color_string = JSON.stringify(colors)
    localStorage.setItem(color_storage_name, color_string);
  } else {
    console.log('Storage is undefined')
  }
  */
}

/** @global {function} callback function to update settings with updated color mapping */
let color_settings_updater = null

/**
 * This is called just after settings have been read. Use defined colors (if available)
 * otherwise update settings with colors found in localStorage.
 * @param {dict} color_settings settings (or null) from saved json settings
 * @param {function} update_function function to update settings with new color mappings
 */
export function update_color_settings (color_settings, update_function) {
  color_settings_updater = update_function
  if (color_settings) {
    // Settings have preference
    _my_palette = color_settings
  } else {
    // No colors in settings, but settings read from localStorage => migrate data to settings file
    if (colors_loaded_from_localStorage && color_settings_updater !== null) {
      color_settings_updater(_my_palette)
    }
  }
}

// When migrating colors to settings file, indicate if doctype colors were read
let colors_loaded_from_localStorage = false

// Load color palette when page loads
if (typeof (Storage) !== 'undefined') {
  // Code for localStorage/sessionStorage.
  const color_string = localStorage.getItem(color_storage_name)
  // console.log("storage:", color_string, typeof(color_string))
  if (typeof (color_string) === 'string') {
    const colors = JSON.parse(color_string)
    _my_palette = colors
    colors_loaded_from_localStorage = true
  }
} else {
  // console.log('Storage is undefined')
}
