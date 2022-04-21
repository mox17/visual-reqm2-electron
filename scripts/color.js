'use strict'
// eslint-disable-next-line no-redeclare
/* global localStorage */
import { ipcRenderer } from 'electron'
import fs from 'fs'

/**
 * Convert HSV values in [0..1] to RGB
 * @param  {number} hue
 * @param  {number} saturation
 * @param  {number} value
 * @return {Array<number>} [r, g, b] values from 0 to 255
 */
function _hsvToRgb (hue, saturation, value) {
  let red, green, blue
  const hueInt = Math.floor(hue * 6)
  const f = hue * 6 - hueInt
  const p = value * (1 - saturation)
  const q = value * (1 - f * saturation)
  const t = value * (1 - (1 - f) * saturation)
  if (hueInt === 0) {
    red = value
    green = t
    blue = p
  }
  if (hueInt === 1) {
    red = q
    green = value
    blue = p
  }
  if (hueInt === 2) {
    red = p
    green = value
    blue = t
  }
  if (hueInt === 3) {
    red = p
    green = q
    blue = value
  }
  if (hueInt === 4) {
    red = t
    green = p
    blue = value
  }
  if (hueInt === 5) {
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
function _getRandomColor () {
  HUE += GOLDEN_RATIO_CONJUGATE
  HUE %= 1
  return _hsvToRgb(HUE, 0.3, 0.99)
}

function _colorRandomReset () {
  HUE = HUE_START
}

/**
 * @param  {number} d number
 * @param  {number} padding amount leading zeroes
 * @return {string} hexadecimal string
 */
function _decimalToHex (d, padding) {
  return  ("00000000"+(Number(d).toString(16))).slice(-padding).toUpperCase()
}

function _getColorString () {
  // Return color as #RRGGBB string"""
  const color = _getRandomColor()
  return `#${_decimalToHex(color[0], 2)}${_decimalToHex(color[1], 2)}${_decimalToHex(color[2], 2)}`
}

/**
 * Create new color for new doctype
 * @param  {object} palette map of doctype to color
 * @param  {string} doctype
 * @return {string} html friendly color string
 */
function _addColor (palette, doctype) {
  const doctypes = Object.keys(palette)
  let newColor
  let sameColor
  do {
    newColor = _getColorString()
    sameColor = false
    for (const dt of doctypes) {
      if (newColor === palette[dt]) {
        sameColor = true
        break
      }
    }
  } while (sameColor === true)
  palette[doctype] = newColor
  return newColor
}

// Storage of the color mapping
let _myPalette =
{
  none: '#FFFFFF'
}

/**
 * public function to get color of doctype
 * @param  {string} key (doctype)
 * @return {string} html color
 */
export function getColor (key) {
  //rq: ->(rq_doctype_color_gen)
  let color
  if (key in _myPalette) {
    color = _myPalette[key]
  } else {
    color = _addColor(_myPalette, key)
    // save new color in settings
    _storeColors(_myPalette)
  }
  return color
}

/**
 * Prompt user for save location and save color palette as external file.
 */
export async function saveColorsFs (path = null) {
  //rq: ->(rq_doctype_color_export)
  let SavePath
  if (path === null) {
    SavePath = await ipcRenderer.invoke('dialog.showSaveDialogSync', null,
      {
        filters: [{ name: 'JSON files', extensions: ['json'] }],
        properties: ['openFile']
      })
  } else {
    SavePath = path
  }
  // istanbul ignore else
  if (typeof (SavePath) !== 'undefined') {
    fs.writeFileSync(SavePath, JSON.stringify(_myPalette, null, 2), 'utf8')
    _storeColors(_myPalette)
  }
}

/**
 * Prompt user for load location and load external file as color palette.
 * @param {function} updateFunction someFunction()
 * @param {string|null} path  path to color scheme json file
 */
export async function loadColorsFs (updateFunction, path = null) {
  //rq: ->(rq_doctype_color_import)
  let LoadPath = null
  if (path === null) {
    LoadPath = await ipcRenderer.invoke('dialog.showOpenDialogSync',
      {
        filters: [{ name: 'JSON files', extensions: ['json'] }],
        properties: ['openFile']
      })
  } else {
    LoadPath = [path]
  }
  // istanbul ignore else
  if (typeof (LoadPath) !== 'undefined' && (LoadPath.length === 1)) {
    const colors = JSON.parse(fs.readFileSync(LoadPath[0], { encoding: 'utf8', flag: 'r' }))
    _storeColors(colors)
    _myPalette = colors
    _colorRandomReset()
    if (updateFunction) {
      updateFunction()
    }
  }
}

/** @global {string} Name of (legacy) browser storage for color palettes */
const colorStorageName = 'Visual_ReqM2_color_palette'

function _storeColors (colors) {
  //rq: ->(rq_doctype_color_sett)
  if (colorSettingsUpdater !== null) {
    colorSettingsUpdater(colors)
  }
}

/** @global {function} callback function to update settings with updated color mapping */
let colorSettingsUpdater = null

/**
 * This is called just after settings have been read. Use defined colors (if available)
 * otherwise update settings with colors found in localStorage.
 * @param {dict} colorSettings settings (or null) from saved json settings
 * @param {function} updateFunction function to update settings with new color mappings
 */
export function updateColorSettings (colorSettings, updateFunction) {
  if (updateFunction) {
    colorSettingsUpdater = updateFunction
  }
  if (colorSettings) {
    // Settings have preference
    _myPalette = colorSettings
  } else {
    // No colors in settings, but settings read from localStorage => migrate data to settings file
    // istanbul ignore next
    if (colorsLoadedFromLocalStorage && colorSettingsUpdater !== null) {
      colorSettingsUpdater(_myPalette)
    }
  }
}

// When migrating colors to settings file, indicate if doctype colors were read
let colorsLoadedFromLocalStorage = false

// Load color palette when page loads
if (typeof (Storage) !== 'undefined') {
  // Code for localStorage/sessionStorage.
  const colorString = localStorage.getItem(colorStorageName)
  // console.log("storage:", color_string, typeof(color_string))
  // istanbul ignore next
  if (typeof (colorString) === 'string') {
    const colors = JSON.parse(colorString)
    _myPalette = colors
    colorsLoadedFromLocalStorage = true
  }
} else {
  // console.log('Storage is undefined')
}
