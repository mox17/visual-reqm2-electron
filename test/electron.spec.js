const Application = require('spectron').Application
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
const electronPath = require('electron') // Require Electron from the binaries included in node_modules.
const path = require('path')

const util = require('../lib/util.js');
const color = _interopRequireDefault(require('../lib/color.js'));
//const main_render = _interopRequireDefault(require('../lib/main_render.js'));
const fs = require('fs');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

//const assert = require('assert')
var assert = chai.assert;    // Using Assert style
var expect = chai.expect;    // Using Expect style
var should = chai.should();  // Using Should style

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Application launch', function () {
  this.timeout(10000)
  let app, client

  beforeEach(function () {
    app = new Application({
      path: electronPath,
      env: { RUNNING_IN_SPECTRON: '1' }, // Tell special behavior needed for argument handling
      args: [path.join(__dirname, '..')],
      chromeDriverLogPath: path.join(__dirname, '..', 'cd.log')
    })
    return app.start().then(function () {
      app.isRunning().should.equal(true);
      client = app.client;
    })
  })

  afterEach(function () {
    if (app && app.isRunning()) {
      return app.stop()
    }
  })

  it('shows an initial window', async function () {
    const count = await client.getWindowCount()
    assert.equal(count, 1);
    //sleep(2000);
    //console.dir(client)
    //console.dir(app)
    //console.dir(app.webContents.executeJavaScript)
    //await app.webContents.executeJavaScript("load_file_main('./testdata/oreqm_testdata_del_movement.oreqm');")
    await app.webContents.executeJavaScript("alert('Killroy was here');")
    await sleep(2000);

    //client.setValue('#issueCount', '7');
    //const cnt = await client.getHTML('#issueCount')
    //assert.ok(cnt.length > 0)
    //sleep(5000)
  })

  /*
  it('Window title', async function () {
    await client.waitUntilWindowLoaded()
    const title = await app.client.getTitle();
    assert.equal(title, "Visual ReqM2");
    app.webContents.executeJavaScript(' 7;').then(function (result) {
      console.log(result) // prints 3
      sleep(3000)
    })
    app.browserWindow.capturePage().then(function (imageBuffer) {
      fs.writeFile('page.png', imageBuffer)
    })
  })

  it('Open "About"', async () => {
    await client.waitUntilWindowLoaded()
    //await sleep(1000)
    const btnH = await app.client.$('#aboutButton')
    await btnH.click()
    await sleep(1000)
    const clsbtn = await app.client.$('#aboutPaneClose')
    await clsbtn.click()
    await sleep(1000)
    //const txt = await app.client.$('#click-counter').getText()
    return assert.equal(1,1)

  })
  */

})
