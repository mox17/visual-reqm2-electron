const Application = require('spectron').Application
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
const electronPath = require('electron') // Require Electron from the binaries included in node_modules.
const path = require('path')
//const main_render = _interopRequireDefault(require('../lib/main_render.js'));
//const fs = require('fs');

//function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

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
    //console.log(path.join(__dirname, '..'))
    //console.log(electronPath)
    app = new Application({
      path: electronPath,
      env: { RUNNING_IN_SPECTRON: '1' }, // Tell special behavior needed for argument handling
      args: [path.join(__dirname, '..', 'main.js')],
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
    await app.webContents.executeJavaScript("alert('Killroy was here');")
    await sleep(2000);
  })

})
