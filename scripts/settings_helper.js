'use strict'
const fs = require('fs')

export function settings_configure (electron_settings, directory, file) {
  if (directory !== undefined && (typeof (directory) === 'string') && fs.existsSync(directory)) {
    electron_settings.configure({ dir: directory })
  } else {
    console.error(`Invalid settings directory: ${directory}`)
  }
  if (file !== undefined && (typeof (file) === 'string')) {
    electron_settings.configure({ fileName: file })
  } else {
    console.error(`Invalid settings file: ${file}`)
  }
  electron_settings.configure({ prettify: true, numSpaces: 2 })
}
