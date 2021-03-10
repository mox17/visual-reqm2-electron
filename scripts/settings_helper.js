'use strict'
const fs = require('fs')

export function settings_configure (electron_settings, directory, file) {
  // istanbul ignore else
  if (directory !== undefined && (typeof (directory) === 'string') && fs.existsSync(directory)) {
    electron_settings.configure({ dir: directory })
  }
  // istanbul ignore else
  if (file !== undefined && (typeof (file) === 'string')) {
    electron_settings.configure({ fileName: file })
  }
  electron_settings.configure({ prettify: true, numSpaces: 2 })
}
