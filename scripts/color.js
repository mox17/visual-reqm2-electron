"use strict";
import { remote } from 'electron'
import fs from 'fs'

function _hsv_to_rgb(hue, saturation, value) {
  // HSV values in [0..1]
  //  returns [r, g, b] values from 0 to 255
  let red, green, blue
  let hue_int = Math.floor(hue * 6)
  let f = hue * 6 - hue_int
  let p = value * (1 - saturation)
  let q = value * (1 - f * saturation)
  let t = value * (1 - (1 - f) * saturation)
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
var HUE_START = 0.314159265359 // use "random" start value
var HUE = HUE_START

function _get_random_color() {
  // Calculate next pseudo random color
  HUE += GOLDEN_RATIO_CONJUGATE
  HUE %= 1
  return _hsv_to_rgb(HUE, 0.3, 0.99)
}

function _color_random_reset() {
  HUE = HUE_START
}

function _decimalToHex(d, padding) {
  var hex = Number(d).toString(16).toUpperCase();
  padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

  while (hex.length < padding) {
      hex = "0" + hex;
  }
  return hex;
}

function _get_color_string() {
  // Return color as #RRGGBB string"""
  const color = _get_random_color()
  return "#{}{}{}".format(_decimalToHex(color[0], 2),
                          _decimalToHex(color[1], 2),
                          _decimalToHex(color[2], 2))
}

function _add_color(palette, doctype) {
  let doctypes = Object.keys(palette)
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
var _my_palette =
{
  "none": "#FFFFFF"
};

export default function get_color(key) {
  // pucblic function to get color
  let color
  if (key in _my_palette) {
    color = _my_palette[key]
  } else {
    color = _add_color(_my_palette, key)
  }
  return color
}


function _downloadObjectAsJson(exportObj, exportName){
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, 0, 2));
  var downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href",     dataStr);
  downloadAnchorNode.setAttribute("download", exportName + ".json");
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

export function save_colors_fs() {
  let SavePath = remote.dialog.showSaveDialogSync(null,
    {
      filters: [{ name: 'JSON files', extensions: ['json']}],
      properties: ['openFile']
    })
  if (typeof(SavePath) !== 'undefined') {
    fs.writeFileSync(SavePath, JSON.stringify(_my_palette, 0, 2), 'utf8')
    _store_colors(_my_palette)
  }
}

export function load_colors_fs(update_function) {
  let LoadPath = remote.dialog.showOpenDialogSync(
    {
      filters: [{ name: 'JSON files', extensions: ['json']}],
      properties: ['openFile']
    })
  if (typeof(LoadPath) !== 'undefined' && (LoadPath.length === 1)) {
    let colors = JSON.parse(fs.readFileSync(LoadPath[0], {encoding: 'utf8', flag: 'r'}))
    _store_colors(colors)
    _my_palette = colors
    _color_random_reset()
    update_function()
  }
}

const color_storage_name = 'Visual_ReqM2_color_palette'
function _store_colors(colors) {
  if (typeof(Storage) !== "undefined") {
    const color_string = JSON.stringify(colors)
    localStorage.setItem(color_storage_name, color_string);
  } else {
    console.log('Storage is undefined')
  }
}

// Load color palette when page loads
if (typeof(Storage) !== "undefined") {
  // Code for localStorage/sessionStorage.
  let color_string = localStorage.getItem(color_storage_name);
  //console.log("storage:", color_string, typeof(color_string))
  if (typeof(color_string) === 'string') {
    const colors = JSON.parse(color_string)
    _my_palette = colors
  }
} else {
  console.log('Storage is undefined')
}
