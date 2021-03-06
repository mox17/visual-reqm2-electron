'use strict'
const electron = require('electron')
const app = electron.app
const globalShortcut = electron.globalShortcut
const BrowserWindow = electron.BrowserWindow
const ipcMain = electron.ipcMain

const path = require('path')
const url = require('url')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
// const { version } = require('./package.json');
const log = require('electron-log')
const { autoUpdater } = require('electron-updater')
const electron_settings = require('electron-settings')
const { settings_configure } = require('./settings_helper.js')
// const fs = require('fs');

// Optional logging
autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
// end optional logging

let debug = /--debug/.test(process.argv[2])
let run_autoupdater = false

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let mainWindow_width = 1024
let mainWindow_height = 768

function calc_icon_path (argv0) {
  // Ugly hack to deal with path differences for nodejs and electron execution env.
  // istanbul ignore else
  if (path.basename(argv0.toLowerCase()).startsWith('electron')) {
    return __dirname
  } else {
    return path.join(path.dirname(__dirname), '../')
  }
}

let icon_path
function createWindow () {
  // istanbul ignore next
  if (process.platform === 'linux') {
    // istanbul ignore next
    icon_path = path.join(calc_icon_path(process.argv[0]), './build/icons/Icon-512x512.png')
  } else if (process.platform === 'win32') {
    // istanbul ignore next
    icon_path = path.join(calc_icon_path(process.argv[0]), './build/icons/Icon-512x512.png')
  } else {
    // istanbul ignore next
    icon_path = path.join(__dirname, './src/icons/mac/icon.icns')
  }
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: mainWindow_width,
    height: mainWindow_height,
    icon: icon_path,
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

  const menu = electron.Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Save color scheme as...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('save_colors') }
        },
        {
          label: 'Load color scheme...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('load_colors') }
        },
        { type: 'separator' },
        {
          label: 'Load coverage rules...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('load_safety') }
        },
        { type: 'separator' },
        {
          label: 'Save issues as...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('save_issues_as') }
        },
        {
          label: 'Save diagram as...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('save_diagram_as') }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
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
          label: 'Settings...',
          id: 'menu_settings',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('open_settings') }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
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
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
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
    if (run_autoupdater) {
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
    [mainWindow_width, mainWindow_height] = mainWindow.getSize()
    electron_settings.setSync('mainWindow_width', mainWindow_width)
    electron_settings.setSync('mainWindow_height', mainWindow_height)
  })

  mainWindow.on('focus', (_event) => {
    accelerators_setup()
  })

  mainWindow.on('blur', (_event) => {
    globalShortcut.unregisterAll()
  })

}

function accelerators_setup () {
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
      idOnly: { type: 'boolean', alias: 'i', desc: 'Search id only', default: false },
      limitDepth: { type: 'boolean', alias: '1', desc: 'Limit reachable nodes to 1 level', default: false }, //rq: ->(rq_limited_walk_cl)
      exclIds: { type: 'string', alias: 'e', desc: 'Excluded ids, comma separated', default: undefined },
      inclRejected: { type: 'boolean', alias: 'R', desc: 'Include rejected specobjects', default: false },
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
      oreqm_ref: { type: 'string', alias: 'z', desc: 'ref oreqm file (older)', default: undefined }
    })
    .usage('$0 options [main_oreqm [ref_oreqm]]')
    .argv
  // console.dir(args);
  settings_configure(electron_settings, args.settDir, args.settFile)
  // Allow 1 or 2 positional parameters
  // yargs lets other arguments sneak in, which happens in test scenarios.
  // Therefore positional parameters have to end with '.oreqm' to be accepted.
  if (!args.oreqm_main && args._.length > 0) {
    // istanbul ignore next
    if (args._[0].endsWith('.oreqm')) {
      args.oreqm_main = args._[0]
      if (!args.oreqm_ref && args._.length > 1) {
        if (args._[1].endsWith('.oreqm')) {
          args.oreqm_ref = args._[1]
        }
      }
    }
  }
  // console.dir(args);
  debug = args.debug
  run_autoupdater = args.update

  mainWindow_width = 1920 // electron_settings.getSync('mainWindow_width', 1024);
  mainWindow_height = 1080 // electron_settings.getSync('mainWindow_height', 768);
  createWindow()

  mainWindow.webContents.on('did-finish-load', () => {
    // console.log("argv:", process.argv, args)
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

ipcMain.on('cmd_quit', (_evt, _arg) => {
  app.quit()
})

ipcMain.on('cmd_echo', (evt, arg) => {
  mainWindow.webContents.send('cl_cmd', arg)
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
  let log_message = 'Download speed: ' + progressObj.bytesPerSecond
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
  log_message = log_message + ' (' + progressObj.transferred + '/' + progressObj.total + ')'
  log.info(log_message)
})

// istanbul ignore next
ipcMain.on('restart_app', () => {
  // istanbul ignore next
  autoUpdater.quitAndInstall()
})
