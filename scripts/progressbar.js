'strict on'

const { ipcRenderer } = require("electron")

export function progressbarStart (text, detail, count=0) {
  ipcRenderer.send('pbar_start', detail, text, count)
}

export function progressbarUpdate (text, detail) {
  ipcRenderer.send('pbar_update', detail, text)
}

export function progressbarUpdateValue (count) {
  ipcRenderer.send('pbar_update_value', count)
}

export function progressbarStop () {
  ipcRenderer.send('pbar_stop')
}

