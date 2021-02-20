const Application = require("spectron").Application;
const fakeMenu = require('spectron-fake-menu');
const electronPath = require("electron");
const path = require("path");
const mkdirp = require('mkdirp')
//const fs = require('fs');
const chai = require("chai");
const assert = chai.assert; // Using Assert style
const expect = chai.expect; // Using Expect style
const should = chai.should(); // Using Should style
const chaiAsPromised = require('chai-as-promised');
const chaiRoughly = require('chai-roughly');
const describe = global.describe;
const it = global.it;
const before = global.before;
const after = global.after;
const beforeEach = global.beforeEach;
const afterEach = global.afterEach;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Application launch", function () {
  this.timeout(10000);
  let app;

  before(function () {
    mkdirp.sync("./tmp");
    chai.should();
    chai.use(chaiAsPromised);
    chai.use(chaiRoughly);
    });

  before(function () {
    app = new Application({
      path: electronPath,
      env: { RUNNING_IN_SPECTRON: "1" }, // Tell special behavior needed for argument handling
      args: [path.join(__dirname, "..")],
      chromeDriverLogPath: path.join(__dirname, "..", "./tmp/chromedriver.log"),
    });
    fakeMenu.apply(app); // apply fake menu
    return app.start().then(function () {
      assert.strictEqual(app.isRunning(), true);
      chaiAsPromised.transferPromiseness = app.transferPromiseness;
    });
  });

  after(function () {
    if (app && app.isRunning()) {
      return app.stop();
    }
  });

  it('launches the application', async function () {
    const response = await app.client.getWindowHandles();
    assert.strictEqual(response.length, 1);

    await app.browserWindow
      .getBounds()
      .should.eventually.roughly(5)
      .deep.equal({
        x: 25,
        y: 35,
        width: 200,
        height: 100
      });
    await app.client.waitUntilTextExists('html', 'ReqM2');
    //console.log("The window title is:", await app.client.getTitle());
    assert.strictEqual(await app.client.getTitle(), 'Visual ReqM2');
  });

  describe('Click about button', function () {
    it('should open about modal', async function () {
      await app.client.waitUntilWindowLoaded();
      const aboutpane = await app.client.$('#aboutPane');
      let style = await aboutpane.getAttribute('style');
      //console.log(typeof style, style);
      assert.ok(!style.includes('block'));
      const about = await app.client.$('#aboutButton');
      await about.click();
      //console.dir(aboutpane);
      style = await aboutpane.getAttribute('style');
      assert.ok(style.includes('display: block;'));
      await sleep(500);
    });

    it('close about again', async function () {
      const aboutpane = await app.client.$('#aboutPane');
      const aboutClose = await app.client.$('#aboutPaneClose');
      await aboutClose.click();
      await sleep(500);
      //aboutpane.should.have.property('style', 'block');
      let style = await aboutpane.getAttribute('style');
      //console.log(typeof style, style);
      assert.ok(!style.includes('block'));
    });
  });

  describe('Settings dialog', function () {
    it('open modal', async function () {
      await app.client.waitUntilWindowLoaded();
      fakeMenu.clickMenu('Edit', 'Settings...'); // File->CloseTab Menu click
      const settings_menu = await app.client.$('#settingsPopup');
      let style = await settings_menu.getAttribute('style');
      assert.ok(style.includes('block'));
    });

    it('Safety rules validation', async function () {
      const settings_menu = await app.client.$('#settingsPopup');
      const safety_rules = await app.client.$('#safety_rules');
      const rules_txt = await safety_rules.getValue()
      //console.log("Safety rules are:", rules_txt);
      await safety_rules.setValue("Not a [ valid( regex");
      let ok_button = await app.client.$("#sett_ok");
      await ok_button.click();
      let style = await settings_menu.getAttribute('style');
      assert.ok(style.includes('display: block;'));
      // restore values
      await safety_rules.setValue(rules_txt);
      await ok_button.click();
      style = await settings_menu.getAttribute('style');
      //console.log(style);
      //await sleep(5000);
      assert.ok(!style.includes('block;'));
    });
  });

/*
  it("shows an initial window", async function () {
    const count = await app.client.getWindowCount();
    assert.equal(count, 1);
    //console.dir(await app.electron.clipboard.availableFormats())
    //app.client.click('#aboutButton');
    await app.webContents.executeJavaScript("alert('Kilroy was here');");
    await sleep(2000);
  });
*/
});
