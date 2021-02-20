const Application = require("spectron").Application;
var chai = require("chai");
//var chaiAsPromised = require('chai-as-promised');
const electronPath = require("electron"); // Require Electron from the binaries included in node_modules.
const path = require("path");
const mkdirp = require('mkdirp')
//const fs = require('fs');

//function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var assert = chai.assert; // Using Assert style
var expect = chai.expect; // Using Expect style
var should = chai.should(); // Using Should style

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// eslint-disable-next-line no-undef
describe("Application launch", function () {
  this.timeout(10000);
  let app, client;

  before(function () {
    mkdirp.sync("./tmp");
  });

  // eslint-disable-next-line no-undef
  beforeEach(function () {
    //console.log(path.join(__dirname, '..'))
    //console.log(electronPath)
    app = new Application({
      path: electronPath,
      env: { RUNNING_IN_SPECTRON: "1" }, // Tell special behavior needed for argument handling
      args: [path.join(__dirname, "..")],
      chromeDriverLogPath: path.join(__dirname, "..", "./tmp/chromedriver.log"),
    });
    return app.start().then(function () {
      app.isRunning().should.equal(true);
      client = app.client;
    });
  });

  // eslint-disable-next-line no-undef
  afterEach(function () {
    if (app && app.isRunning()) {
      return app.stop();
    }
  });

  // eslint-disable-next-line no-undef
  it("shows an initial window", async function () {
    const count = await client.getWindowCount();
    assert.equal(count, 1);
    //console.dir(await app.electron.clipboard.availableFormats())
    //app.client.click('#aboutButton');
    await app.webContents.executeJavaScript("alert('Kilroy was here');");
    await sleep(2000);
  });
});
