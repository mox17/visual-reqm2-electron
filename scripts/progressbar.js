'strict on'

const { ipcRenderer } = require("electron")

export function progressbar_start (text, detail, count=0) {
  ipcRenderer.send('pbar_start', detail, text, count)
}

export function progressbar_update (text, detail) {
  ipcRenderer.send('pbar_update', detail, text)
}

export function progressbar_update_value (count) {
  ipcRenderer.send('pbar_update_value', count)
}

export function progressbar_stop () {
  ipcRenderer.send('pbar_stop')
}

