'use strict'
const fs = require('fs')

export function settingsConfigure (electronSettings, directory, file) {
  // istanbul ignore else
  if (directory !== undefined && (typeof (directory) === 'string') && fs.existsSync(directory)) {
    electronSettings.configure({ dir: directory })
  }
  // istanbul ignore else
  if (file !== undefined && (typeof (file) === 'string')) {
    electronSettings.configure({ fileName: file })
  }
  electronSettings.configure({ prettify: true, numSpaces: 2 })
}
