"use strict";
const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const ipcMain = electron.ipcMain;

const path = require('path');
const url = require('url');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { ArgumentParser } = require('argparse');
const { version } = require('./package.json');
const log = require('electron-log');
const {autoUpdater} = require('electron-updater');
const {settings} = require('./lib/settings_dialog.js')
const ProgressBar = require('electron-progressbar');

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
let cmd_line_only = false

let mainWindow_width = 1024
let mainWindow_height = 768

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

let icon_path
function createWindow() {
  if (process.platform === 'linux') {
    //icon_path = path.join(__dirname, '/build/icons/Icon-512x512.png')
    icon_path = path.join(calc_icon_path(process.argv[0]), './build/icons/Icon-512x512.png')
  } else if (process.platform === 'win32') {
    // TODO: There must be a better way to determine the path to main icon file
    //icon_path = './build/icon.png'
    //icon_path = 'C:\\Users\\erlin\\Documents\\src\\visual-reqm2-electron\\build\\icon.png'
    icon_path = path.join(calc_icon_path(process.argv[0]), './build/icons/Icon-512x512.png')
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

  ipcMain.on('progress_start', progressbar_start);
  ipcMain.on('progress_stop', progressbar_stop);

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
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('save_colors')}
        },
        {
          label:'Load color scheme...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('load_colors')}
        },
        {type: 'separator'},
        {
          label:'Load coverage rules...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('load_safety')}
        },
        {type: 'separator'},
        {
          label:'Save issues as...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('save_issues_as')}
        },
        {
          label:'Save diagram as...',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('save_diagram_as')}
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
          id: 'menu_settings',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('open_settings')}
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Show issues',
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('show_issues')}
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
          click (_item, _focusedWindow, _ev) { mainWindow.webContents.send('about')}
        }
      ]
    }
  ])
  electron.Menu.setApplicationMenu(menu);

  mainWindow.once('ready-to-show', () => {
    if (!cmd_line_only) {
      mainWindow.show()
      //log.info("run_autoupdater:", run_autoupdater)
      if (run_autoupdater) {
        //rq: ->(rq_autoupdate_win)
        autoUpdater.checkForUpdatesAndNotify();
      }
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
      settings.set('mainWindow_width', mainWindow_width, {prettify: true});
      settings.set('mainWindow_height', mainWindow_height, {prettify: true});
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
  let xx = yargs(hideBin(process.argv))
    .scriptName('VisualReqM2')
    .options({
      version:          { type: 'boolean', alias: 'v', desc: 'Show version', default: false },
      debug:            { type: 'boolean', alias: 'd', desc: 'Enable debug', default: false },
      update:           { type: 'boolean', alias: 'u', desc: 'Check for updates', default: false },
      select:           { type: 'string',  alias: 's', desc: 'Selection criteria', default: undefined },
      idOnly:           { type: 'boolean', alias: 'i', desc: 'Search id only', default: false },
      excludedIds:      { type: 'string',  alias: 'e', desc: 'Excluded ids, comma separated', default: undefined },
      excludedDoctypes: { type: 'string',  alias: 'c', desc: 'Excluded doctypes, comma separated', default: undefined },
      format:           { type: 'string',  alias: 'f', desc: 'svg, png or dot graph', default: 'svg' },
      output:           { type: 'string',  alias: 'o', desc: 'Name of output file (extension .svg, .png or .dot will be added)', default: undefined },
      diagram:          { type: 'boolean', alias: 'g', desc: 'Generate specobject diagram', default: false },
      hierarchy:        { type: 'boolean', alias: 't', desc: 'Generate hierarchy diagram', default: false },
      safety:           { type: 'boolean', alias: 'a', desc: 'Generate safety check diagram', default: false },
      rules:            { type: 'string',  alias: 'r', desc: 'Safety rules json file', default: undefined },
      oreqm_main:       { type: 'string',  alias: 'm', desc: 'main oreqm file', default: undefined },
      oreqm_ref:        { type: 'string',  alias: 'z', desc: 'ref oreqm file (older)', default: undefined }
    })
     /*
    .usage('$0 [<options>] [<main oreqm> [<ref oreqm>]]', 'Visualize oreqm data', (yargs) => {
      yargs.positional({
        oreqm_main: { type: 'string', desc: 'main oreqm file'},
        oreqm_ref: { type: 'string', desc: 'reference oreqm file (older)'}
      })
    })
    .showHelp() */
    .argv;
  if (!xx.oreqm_main && xx._.length > 0) {
    xx.oreqm_main = xx._[0];
    if (!xx.oreqm_ref && xx._.length > 1) {
      xx.oreqm_ref = xx._[1];
    }
  }
  console.dir(xx);

  parser.add_argument('-v', '--version',           { action: 'version', version });
  parser.add_argument('-d', '--debug',             { help: 'Enable debug', action: 'store_true' });
  parser.add_argument('-u', '--update',            { help: 'Check for updates', action: 'store_true' });
  parser.add_argument('-s', '--select',            { help: 'selection criteria', type: 'str' });
  parser.add_argument('-i', '--id-only',           { help: 'search id only', action: 'store_true' });
  parser.add_argument('-e', '--excluded-ids',      { help: 'excluded ids, comma separated', type: 'str' });
  parser.add_argument('-c', '--excluded-doctypes', { help: 'excluded doctypes, comma separated', type: 'str' });
  parser.add_argument('-f', '--format',            { help: 'svg, png or dot graph', type: 'str' });
  parser.add_argument('-o', '--output',            { help: 'name of ouput', type: 'str' });
  parser.add_argument('-a', '--safety',            { help: 'Generate safety check diagram', action: 'store_true' });
  parser.add_argument('-t', '--hierarchy',         { help: 'Generate hierarchy diagram', action: 'store_true' });
  parser.add_argument('-g', '--diagram',           { help: 'Generate specobject diagram', action: 'store_true' });
  parser.add_argument('-r', '--rules',             { help: 'Safety rules json file', type: 'str' });
  parser.add_argument('oreqm_main',                { help: 'main oreqm', nargs: '?' });
  parser.add_argument('oreqm_ref',                 { help: 'ref. oreqm', nargs: '?' });

  let argv = process.argv.slice() // Manipulate a copy in following
  //console.log("The options are:", argv)
  //console.log("spectron env setting", process.env.RUNNING_IN_SPECTRON)
  let args
  // TODO: Current parameter handling conflicts with spectron testing, so as a work-around
  // command line parameter handling is disabled when automated testing is detected.

  // eslint-disable-next-line no-prototype-builtins
  var isInTest = process.env.hasOwnProperty('RUNNING_IN_SPECTRON')
  if (isInTest) {
    args = parser.parse_args([]);
  } else {
    // Ugly work-around for command line difference when compiled to app compared to pure nodejs
    if ((argv.length > 1) && argv[1] !== '.') {
      argv.splice(1, 0, '.');
    }
    argv.splice(0,2) // remove ['electron', '.']
    //console.log("Effective options are:", argv)
    args = parser.parse_args(argv)
  }
  console.log('argparse args')
  console.dir(args)

  debug = args.debug
  run_autoupdater = args.update
  // Check if a command-line only action requested
  if (args.safety || args.hierarchy || args.diagram) {
    cmd_line_only = true
    console.log("command-line only")
    app.quit()
  }

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

autoUpdater.on('update-not-available', (_info) => {
  //log.info('Update not available.');
})

autoUpdater.on('error', (_err) => {
  //log.info('Error in auto-updater. ' + _err);
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

// ProgressBar handling

  /**  */
  let progressBar = null;

  /**
   * Start or update a progress bar
   * @param {string} text to be displayed
   */
  function progressbar_start(_text) {
    //console.log(text)
    if (progressBar === null) {
      progressBar = new ProgressBar({
        /*
        title: 'Diagram being calculated',
        text: 'Processing...',
        detail: text,
        indeterminate: true,
        */
        browserWindow: {
          icon: icon_path,
          webPreferences: {
            nodeIntegration: true
          }
        }
      });

      progressBar.on('completed', function() {
        //progressBar.text = '';
        //progressBar.detail = 'Task completed. Exiting...';
        progressBar = null;
      });

    } else {
      //progressBar.detail = text;
    }
  }

  function progressbar_stop() {
    if (progressBar) {
      progressBar.setCompleted();
    }
  }

