"use strict";
const electron = require('electron')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow
const ipcMain = electron.ipcMain;

const path = require('path');
const url = require('url');
const settings = require('electron-settings');
const { ArgumentParser } = require('argparse');
const { version } = require('./package.json');
const log = require('electron-log');
const {autoUpdater} = require("electron-updater");

// Optional logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
// end optional logging

let debug = /--debug/.test(process.argv[2]);
let run_autoupdater = false;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let can_close = true

let mainWindow_width = 1024
let mainWindow_height = 768
let mainWindow_x
let mainWindow_y

ipcMain.on('cannot_close', () => {
  can_close = false;
});

ipcMain.on('can_close', () => {
  can_close = true;
});

function calc_icon_path(argv0) {
  // Ugly hack to deal with path differences for nodejs and electron execution env.
  if (path.basename(argv0.toLowerCase()).startsWith('electron')) {
    return __dirname
  } else {
    return path.join(path.dirname(__dirname), '../')
  }
}

function createWindow() {
  let icon_path
  if (process.platform === 'linux') {
    //icon_path = path.join(__dirname, '/build/icons/Icon-512x512.png')
    icon_path = path.join(calc_icon_path(process.argv[0]), './build/icons/Icon-512x512.png')
  } else if (process.platform === 'win32') {
    // TODO: There must be a better way to determine the path to man icon file
    //icon_path = './build/icon.png'
    //icon_path = 'C:\\Users\\erlin\\Documents\\src\\visual-reqm2-electron\\build\\icon.png'
    icon_path = path.join(calc_icon_path(process.argv[0]), './build/icon.png')
    //console.log("process.resourcesPath: ",process.resourcesPath)
    //console.log("__dirname: ", __dirname)
    //console.log("calc_icon_path: ", calc_icon_path(process.argv[0]))
  } else {
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
      nodeIntegration: true,
      enableRemoteModule: true,
    }
  });

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true,
    backgroundColor: '#000000'
  }));

  // Open the DevTools.
  if (debug) {
    mainWindow.webContents.openDevTools();
  }

  var menu = electron.Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label:'Save color scheme as...',
          click (item, focusedWindow, ev) { mainWindow.webContents.send('save_colors')}
        },
        {
          label:'Load color scheme',
          click (item, focusedWindow, ev) { mainWindow.webContents.send('load_colors')}
        },
        {type: 'separator'},
        {
          label:'Load coverage rules',
          click (item, focusedWindow, ev) { mainWindow.webContents.send('load_safety')}
        },
        {type: 'separator'},
        {
          label:'Save issues as...',
          click (item, focusedWindow, ev) { mainWindow.webContents.send('save_issues_as')}
        },
        {
          label:'Save diagram as...',
          click (item, focusedWindow, ev) { mainWindow.webContents.send('save_diagram_as')}
        },
        {type: 'separator'},
        {role:'quit'}
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
        {type: 'separator'},
        {
          label:'Settings...',
          click (item, focusedWindow, ev) { mainWindow.webContents.send('open_settings')}
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Show issues',
          click (item, focusedWindow, ev) { mainWindow.webContents.send('show_issues')}
        },
        {
          label: 'Full screen',
          role: 'togglefullscreen',
        },
        {role: 'resetzoom'},
        {role: 'zoomin'},
        {role: 'zoomout'},
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click (item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools()
          }
        },
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label:'About',
          click (item, focusedWindow, ev) { mainWindow.webContents.send('about')}
        }
      ]
    }
  ])
  electron.Menu.setApplicationMenu(menu);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    //log.info("run_autoupdater:", run_autoupdater)
    if (run_autoupdater) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  mainWindow.on('close', (event) => {
    if (can_close === false) {
      event.preventDefault();
    } else {
      [mainWindow_width, mainWindow_height] = mainWindow.getSize();
      settings.set('mainWindow_width', mainWindow_width);
      settings.set('mainWindow_height', mainWindow_height);
    }
  });
}

const parser = new ArgumentParser({
  description: 'Visual ReqM2\nShow specobjects as diagrams.'
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  parser.add_argument('-v', '--version', { action: 'version', version });
  parser.add_argument('-d', '--debug', { help: 'Enable debug', action: 'store_true' });
  parser.add_argument('-u', '--update', { help: 'Check for updates', action: 'store_true' });
  parser.add_argument('oreqm_main',  { help: 'main oreqm', nargs: '?' });
  parser.add_argument('oreqm_ref',  { help: 'ref. oreqm', nargs: '?' });

    // Ugly work-around for command line difference when compiled to app compared to pure nodejs
  if (process.argv[1] != '.') {
    process.argv.splice(1, 0, '.');
  }
  let args = parser.parse_args()
  debug = args.debug
  run_autoupdater = args.update
  //console.log(process.argv);
  //console.log(args);
  mainWindow_width = settings.get('mainWindow_width', 1024);
  mainWindow_height = settings.get('mainWindow_height', 768);
  createWindow();
  mainWindow.webContents.on('did-finish-load', () => {
    //console.log("argv:", process.argv, args)
    if (process.argv.length > 1) {
      mainWindow.webContents.send('argv', process.argv, args);
    }
  });
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.


autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update_downloaded');
});

autoUpdater.on('checking-for-update', () => {
  //log.info('Checking for update...');
})

autoUpdater.on('update-not-available', (info) => {
  //log.info('Update not available.');
})

autoUpdater.on('error', (err) => {
  //log.info('Error in auto-updater. ' + err);
})

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  log.info(log_message);
})

ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});
