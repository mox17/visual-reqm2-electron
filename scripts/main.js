'use strict'
const electron = require('electron')
const app = electron.app
const globalShortcut = electron.globalShortcut
const BrowserWindow = electron.BrowserWindow
const ipcMain = electron.ipcMain
const Menu = electron.Menu

const path = require('path')
const url = require('url')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
// const { version } = require('./package.json');
const log = require('electron-log')
const { autoUpdater } = require('electron-updater')
const electronSettings = require('electron-settings')
const { settingsConfigure } = require('./settings_helper.js')
const { dialog } = require('electron')
const ProgressBar = require('electron-progressbar')
// const fs = require('fs');

// Optional logging
autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
// end optional logging

let debug = /--debug/.test(process.argv[2])
let runAutoupdater = false

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let mainWindowWidth = 1024
let mainWindowHeight = 768

let progressBar = null
let readyCalled = false

function calcIconPath (argv0) {
  // Ugly hack to deal with path differences for nodejs and electron execution env.
  // istanbul ignore else
  if (path.basename(argv0.toLowerCase()).startsWith('electron')) {
    return __dirname
  } else {
    return path.join(path.dirname(__dirname), '../')
  }
}

let iconPath
function createWindow () {
  // istanbul ignore next
  if (process.platform === 'linux') {
    // istanbul ignore next
    iconPath = path.join(calcIconPath(process.argv[0]), './build/icons/Icon-512x512.png')
  } else if (process.platform === 'win32') {
    // istanbul ignore next
    iconPath = path.join(calcIconPath(process.argv[0]), './build/icons/Icon-512x512.png')
  } else {
    // istanbul ignore next
    iconPath = path.join(__dirname, './src/icons/mac/icon.icns')
  }
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: mainWindowWidth,
    height: mainWindowHeight,
    icon: iconPath,
    show: false,
    webPreferences: {
      nodeIntegrationInWorker: true,
      contextIsolation: false,
      nodeIntegration: true,
      enableRemoteModule: true
    }
  })

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '..', 'index.html'),
    protocol: 'file:',
    slashes: true,
    backgroundColor: '#000000'
  }))

  // Open the DevTools.
  // istanbul ignore next
  if (debug) {
    mainWindow.webContents.openDevTools()
  }

  let menu = electron.Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          id: 'menu_load_main_oreqm_file',
          label: 'Load main oreqm file...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('load_main_oreqm') }
        },
        {
          id: 'menu_load_ref_oreqm',
          label: 'Load reference oreqm file...',
          enabled: false,
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('load_ref_oreqm') }
        },
        { type: 'separator' },
        {
          id: 'menu_save_color_scheme_as',
          label: 'Save color scheme as...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('save_colors') }
        },
        {
          id: 'menu_load_color_scheme',
          label: 'Load color scheme...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('load_colors') }
        },
        { type: 'separator' },
        {
          id: 'menu_load_coverage_rules',
          label: 'Load coverage rules...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('load_safety') }
        },
        { type: 'separator' },
        {
          id: 'menu_save_issues_as',
          label: 'Save issues as...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('save_issues_as') }
        },
        {
          id: 'menu_save_diagram_as',
          label: 'Save diagram as...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('save_diagram_as') }
        },
        { type: 'separator' },
        {
          id: 'menu_save_diagram_context',
          label: 'Save diagram context...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('save_diagram_ctx') }
        },
        {
          id: 'menu_load_diagram_context',
          label: 'Load diagram context...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('load_diagram_ctx') }
        },
        { type: 'separator' },
        {
          id: 'menu_save_diagram_selection',
          label: 'Save diagram selection...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('save_diagram_sel') }
        },
        { type: 'separator' },
        {
          id: 'menu_quit',
          label: 'quit',
          role: 'quit'
        }
      ]
    },
    {
      id: 'menu_edit',
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        {
          id: 'menu_doctype_attributes',
          label: 'Doctypes...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('open_doctypes') }
        },
        {
          id: 'menu_settings',
          label: 'Settings...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('open_settings') }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          id: 'menu_show_issues',
          label: 'Show issues',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('show_issues') }
        },
        {
          label: 'Full screen',
          role: 'togglefullscreen'
        },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        {
          label: 'Toggle Developer Tools',
          // istanbul ignore next
          accelerator: process.platform === 'Ctrl+Shift+I',
          // istanbul ignore next
          click (item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools()
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'README.md',
          // istanbul ignore next
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('readme') }
        },
        {
          label: 'VQL help',
          // istanbul ignore next
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('vql_help') }
        },
        {
          id: 'menu_help_about',
          label: 'About',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('about') }
        }
      ]
    }
  ])
  electron.Menu.setApplicationMenu(menu)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    // log.info("run_autoupdater:", run_autoupdater)
    // istanbul ignore next
    if (runAutoupdater) {
      //rq: ->(rq_autoupdate_win)
      // istanbul ignore next
      autoUpdater.checkForUpdatesAndNotify()
    }
  })

  // Emitted when the window is closed.
  // istanbul ignore next
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    // istanbul ignore next
    mainWindow = null
  })

  mainWindow.on('close', (_event) => {
    [mainWindowWidth, mainWindowHeight] = mainWindow.getSize()
    electronSettings.setSync('mainWindow_width', mainWindowWidth)
    electronSettings.setSync('mainWindow_height', mainWindowHeight)
  })

  mainWindow.on('focus', (_event) => {
    acceleratorsSetup()
  })

  mainWindow.on('blur', (_event) => {
    // istanbul ignore next
    globalShortcut.unregisterAll()
  })

}

function acceleratorsSetup () {
  /* istanbul ignore next */
  globalShortcut.register('Alt+Home', () => { mainWindow.webContents.send('svg_reset_zoom') })
  /* istanbul ignore next */
  globalShortcut.register('Alt+0', () => { mainWindow.webContents.send('svg_reset_zoom') })
  /* istanbul ignore next */
  globalShortcut.register('Alt+Left', () => { mainWindow.webContents.send('svg_pan_left') })
  /* istanbul ignore next */
  globalShortcut.register('Alt+Right', () => { mainWindow.webContents.send('svg_pan_right') })
  /* istanbul ignore next */
  globalShortcut.register('Alt+Up', () => { mainWindow.webContents.send('svg_pan_up') })
  /* istanbul ignore next */
  globalShortcut.register('Alt+Down', () => { mainWindow.webContents.send('svg_pan_down') })
  /* istanbul ignore next */
  globalShortcut.register('Alt+Plus', () => { mainWindow.webContents.send('svg_zoom_in') })
  /* istanbul ignore next */
  globalShortcut.register('Alt+PageUp', () => { mainWindow.webContents.send('svg_zoom_in') })
  /* istanbul ignore next */
  globalShortcut.register('Alt+-', () => { mainWindow.webContents.send('svg_zoom_out') })
  /* istanbul ignore next */
  globalShortcut.register('Alt+PageDown', () => { mainWindow.webContents.send('svg_zoom_out') })
  /* istanbul ignore next */
  globalShortcut.register('Alt+N', () => { mainWindow.webContents.send('selected_next') }) //rq: ->(rq_navigate_sel)
  /* istanbul ignore next */
  globalShortcut.register('Alt+P', () => { mainWindow.webContents.send('selected_prev') }) //rq: ->(rq_navigate_sel)
  /* istanbul ignore next */
  globalShortcut.register('Alt+Enter', () => { mainWindow.webContents.send('filter_graph') })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  const args = yargs(hideBin(process.argv))
    .scriptName('VisualReqM2')
    .options({
      version: { type: 'boolean', alias: 'v', desc: 'Show version', default: false },
      debug: { type: 'boolean', alias: 'd', desc: 'Enable debug', default: false },
      update: { type: 'boolean', alias: 'u', desc: 'Do automatic update (if available)', default: false },
      newVer: { type: 'boolean', alias: 'V', desc: 'Check for new release', default: undefined }, // has a setting
      select: { type: 'string', alias: 's', desc: 'Selection criteria', default: undefined },
      idOnly: { type: 'boolean', alias: 'i', desc: '<id> Search', default: undefined },
      regex: { type: 'boolean', alias: 'x', desc: 'Regex Search', default: undefined },
      vql: { type: 'boolean', alias: 'q', desc: 'VQL Search', default: undefined },
      limitDepth: { type: 'boolean', alias: '1', desc: 'Limit reachable nodes to 1 level', default: false }, //rq: ->(rq_limited_walk_cl)
      exclIds: { type: 'string', alias: 'e', desc: 'Excluded ids, comma separated', default: undefined },
      inclRejected: { type: 'boolean', alias: 'R', desc: 'Include rejected specobjects', default: undefined },
      exclDoctypes: { type: 'string', alias: 'T', desc: 'Excluded doctypes, comma separated', default: undefined },
      format: { type: 'string', alias: 'f', desc: 'svg, png or dot graph', default: 'svg' },
      output: { type: 'string', alias: 'o', desc: 'Name of output file (extension .svg, .png or .dot will be added)', default: undefined },
      diagram: { type: 'boolean', alias: 'g', desc: 'Generate specobject diagram', default: false },
      hierarchy: { type: 'boolean', alias: 't', desc: 'Generate hierarchy diagram', default: false },
      safety: { type: 'boolean', alias: 'S', desc: 'Generate safety check diagram', default: false },
      quit: { type: 'boolean', alias: 'Q', desc: 'Exit program after batch generation of diagrams', default: false },
      rules: { type: 'string', alias: 'r', desc: 'Safety rules json file', default: undefined },
      settFile: { type: 'string', alias: 'F', desc: 'Settings json file', default: undefined },
      settDir: { type: 'string', alias: 'D', desc: 'Settings directory', default: undefined },
      oreqm_main: { type: 'string', alias: 'm', desc: 'main oreqm file', default: undefined },
      oreqm_ref: { type: 'string', alias: 'z', desc: 'ref oreqm file (older)', default: undefined },
      context: { type: 'string', alias: 'c', desc: 'Context .vr2x file', default: undefined }
    })
    .conflicts({"idOnly": ["vql", "regex"]})
    .conflicts({"vql": ["idOnly", "regex"]})
    .conflicts({"regex": ["idOnly", "vql"]})
    .usage('$0 options [main_oreqm [ref_oreqm]]')
    .argv
  // console.dir(args);
  settingsConfigure(electronSettings, args.settDir, args.settFile)
  // Allow 1 or 2 positional parameters
  // yargs lets other arguments sneak in, which happens in test scenarios.
  // Therefore positional parameters have to end with '.oreqm' or '.vr2x' to be accepted.
  if (!args.oreqm_main && args._.length > 0) {
    // istanbul ignore next
    if (args._[0].endsWith('.oreqm')) {
      args.oreqm_main = args._[0]
      if (!args.oreqm_ref && args._.length > 1) {
        if (args._[1].endsWith('.oreqm')) {
          args.oreqm_ref = args._[1]
        }
      }
    } else if (args._[0].endsWith('.vr2x')) {
      // Handle positional context file
      args.context = args._[0]
    }
  }
  // console.dir(args);
  debug = args.debug
  runAutoupdater = args.update

  mainWindowWidth = 1920 // electronSettings.getSync('mainWindow_width', 1024);
  mainWindowHeight = 1080 // electronSettings.getSync('mainWindow_height', 768);
  createWindow()

  mainWindow.webContents.on('did-finish-load', () => {
    // console.log("did-finish-load")
    readyCalled = true
  })

  mainWindow.webContents.once('dom-ready', () => {
    // console.log("argv:", process.argv, args)
    // console.log("dom-ready")
    mainWindow.webContents.send('argv', process.argv, args)
  })
})

// Quit when all windows are closed.
// istanbul ignore next
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  // istanbul ignore next
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// istanbul ignore next
app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  // istanbul ignore next
  if (mainWindow === null) {
    createWindow()
  }
})

// workaround for security alert "Renderers can obtain access to random bluetooth device without permission in Electron"
// istanbul ignore next
app.on('web-contents-created', (event, webContents) => {
  webContents.on('select-bluetooth-device', (event, devices, callback) => {
    // Prevent default behavior
    event.preventDefault();
    // Cancel the request
    callback('');
  });
});

// istanbul ignore next
ipcMain.on('cmd_quit', (_evt, _arg) => {
  app.quit()
})

ipcMain.on('cmd_echo', (evt, arg) => {
  mainWindow.webContents.send('cl_cmd', arg)
})

ipcMain.on('cmd_show_error', (_evt, title, msg) => {
  dialog.showErrorBox(title, msg)
})

ipcMain.on('menu_load_ref', (_evt, enable) => {
  Menu.getApplicationMenu().getMenuItemById('menu_load_ref_oreqm').enabled = enable
})

/**
 * This handler is called from fs.watchFile() logic in render thread
 */
ipcMain.on('file_updated', (_evt, title, path) => {
  const choice = dialog.showMessageBoxSync(
    {
      type: 'question',
      buttons: ['Ignore', 'Reload'],
      defaultId: 0,
      title: title,
      message: `File updated:\n${path}`
    })
    if (choice === 1) {
      mainWindow.webContents.send('file_updated', title, path)
    }
})

// ProgressBar messages
ipcMain.on('pbar_start', (_evt, detail, text, count) => {
  // istanbul ignore else
  if (readyCalled) {
    progressBar = new ProgressBar({
      text: text,
      detail: detail,
      indeterminate: count === 0,
      maxValue: count > 0 ? count-1 : 100
    }, app)
  }
})

ipcMain.on('pbar_update', (_evt, detail, text) => {
  // istanbul ignore else
  if (progressBar && progressBar.isInProgress()) {
    progressBar.detail = detail
    progressBar.text = text
  }
})

ipcMain.on('pbar_update_value', (_evt, count) => {
  // istanbul ignore else
  if (progressBar && progressBar.isInProgress()) {
    progressBar.value = count
  }
})

ipcMain.on('pbar_stop', (_evt) => {
  // istanbul ignore else
  if (progressBar && progressBar.isInProgress()) {
    progressBar.setCompleted()
  }
})

ipcMain.handle('settingsSetSync', async (_event, key, value) => {
  electronSettings.setSync(key, value)
})

ipcMain.handle('settingsGetSync', async (_event, key) => {
  let res = electronSettings.getSync(key)
  return res
})

ipcMain.handle('settingsHasSync', async (_event, key) => {
  let res = electronSettings.hasSync(key)
  return res
})

ipcMain.handle('settingsUnsetSync', async (_event, key) => {
  let res = electronSettings.unsetSync(key)
  return res
})

ipcMain.handle('settingsFile', async (_event) => {
  let res = electronSettings.file()
  return res
})

ipcMain.handle('dialog.showSaveDialogSync', async (_event, win, options) => {
  return dialog.showSaveDialogSync(win, options)
})

ipcMain.handle('dialog.showOpenDialogSync', async (_event, options) => {
  return dialog.showOpenDialogSync(options)
})

ipcMain.handle('window.focus', async (_event) => {
  app.focus()
})

ipcMain.handle('dialog.showMessageBoxSync', async (_event, options) => {
  return dialog.showMessageBoxSync(options)
})

ipcMain.handle('app.getVersion', async (_event) => {
  return app.getVersion()
})

// Handle automatic updates
// istanbul ignore next
autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available')
})

// istanbul ignore next
autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update_downloaded')
})

// istanbul ignore next
autoUpdater.on('checking-for-update', () => {
  // log.info('Checking for update...');
})

// istanbul ignore next
autoUpdater.on('update-not-available', (_info) => {
  // log.info('Update not available.');
})

// istanbul ignore next
autoUpdater.on('error', (_err) => {
  // log.info('Error in auto-updater. ' + _err);
})

// istanbul ignore next
autoUpdater.on('download-progress', (progressObj) => {
  let logMessage = 'Download speed: ' + progressObj.bytesPerSecond
  logMessage = logMessage + ' - Downloaded ' + progressObj.percent + '%'
  logMessage = logMessage + ' (' + progressObj.transferred + '/' + progressObj.total + ')'
  log.info(logMessage)
})

// istanbul ignore next
ipcMain.on('restart_app', () => {
  // istanbul ignore next
  autoUpdater.quitAndInstall()
})
