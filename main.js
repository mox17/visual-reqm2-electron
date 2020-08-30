const electron = require('electron')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow
const ipcMain = electron.ipcMain;

const path = require('path');
const url = require('url');
const settings = require('electron-settings');

const debug = /--debug/.test(process.argv[2]);

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

let newwin;

function open_module_select_window() {
    newwin = new BrowserWindow({
        useContentSize: true,
        resizable: false,
        fullscreenable: false,
        frame: false,
        parent: mainWindow,
        modal: !debug,
        show: false
    });
    newwin.loadURL(path.join('file:', __dirname, 'src/template_select.html'));

    if (debug) {
        newwin.webContents.openDevTools();
    }

    newwin.once('ready-to-show', () => {
        newwin.show();
    });

    newwin.on('closed', () => {
        newwin = null
    });
}

ipcMain.on('open_module_select_window', () => {
    open_module_select_window();
});

ipcMain.on('close_module_select_window', () => {
    newwin.close();
});

ipcMain.on('proxy_create_new_dot', (event, message) => {
    mainWindow.webContents.send('create_new_dot', message);
});

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: mainWindow_width,
        height: mainWindow_height,
        icon: 'src/img/ico.png',
        webPreferences: {
            nodeIntegrationInWorker: true
        }
    });

    // and load the index.html of the app.
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'src/index.html'),
        protocol: 'file:',
        slashes: true,
        backgroundColor: '#000000'
    }));

    // Open the DevTools.
    if (debug) {
        mainWindow.webContents.openDevTools();
    }

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });

    mainWindow.on('close', (event) => {
        if (can_close === false) {
            mainWindow.webContents.send('save_dot_file');
            event.preventDefault();
        } else {
            [mainWindow_width, mainWindow_height] = mainWindow.getSize();
            settings.set('mainWindow_width', mainWindow_width);
            settings.set('mainWindow_height', mainWindow_height);
            //mainWindow.webContents.send('save_dot_file');
        }
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    mainWindow_width = settings.get('mainWindow_width', 1024);
    mainWindow_height = settings.get('mainWindow_height', 768);
    createWindow();
    mainWindow.webContents.on('did-finish-load', () => {
        if (process.argv.length > 1) 
            mainWindow.webContents.send('argv', process.argv[1]);
        else open_module_select_window();
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
