const Application = require("spectron").Application;
const fakeMenu = require('spectron-fake-menu');
const fakeDialog = require('spectron-fake-dialog');
const electronPath = require("electron");
const path = require("path");
const mkdirp = require('mkdirp')
const fs = require('fs');
const chai = require("chai");
const assert = chai.assert; // Using Assert style
//const expect = chai.expect; // Using Expect style
//const should = chai.should(); // Using Should style
const chaiAsPromised = require('chai-as-promised');
const chaiRoughly = require('chai-roughly');
const describe = global.describe;
const it = global.it;
const before = global.before;
const after = global.after;
//const beforeEach = global.beforeEach;
//const afterEach = global.afterEach;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let screenshot_count = 1

function screenshot(app, title="screenshot") {
  //console.log('screenshot 1');
  app.browserWindow.capturePage().then(function (imageBuffer) {
    let filename = `./tmp/${title}-${screenshot_count}.png`;
    //console.log('screenshot 2:', filename);
    fs.writeFileSync(filename, imageBuffer);
    screenshot_count += 1;
  })
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
    fakeMenu.apply(app);
    fakeDialog.apply(app);
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
      fakeMenu.clickMenu('Edit', 'Settings...');
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

  describe('Issues dialog', function () {
    it('open modal', async function () {
      await app.client.waitUntilWindowLoaded();
      fakeMenu.clickMenu('View', 'Show issues');
      const issues_modal = await app.client.$('#problemPopup');
      let style = await issues_modal.getAttribute('style');
      assert.ok(style.includes('block')); //rq: ->(rq_issues_log)
      //await sleep(2000);
      const aboutClose = await app.client.$('#problemPopupClose');
      await aboutClose.click();
    });
  });

  describe('Load files', function () {
    it('main oreqm', async function () {
      await app.client.waitUntilWindowLoaded();
      fakeDialog.mock([ { method: 'showOpenDialogSync', value: ['./testdata/oreqm_testdata_no_ogre.oreqm'] } ]);
      const main_button = await app.client.$('#get_main_oreqm_file');
      await main_button.click();
      //rq: ->(rq_filesel_main_oreqm)
      assert.notProperty(await app.client.$('#svg_output'), 'error'); // A svg diagram was created
      await screenshot(app);
    });

    it('save main as svg', async function () {
      await app.client.waitUntilWindowLoaded();
      //let svg_filename = './tmp/main_1.svg'
      await fakeDialog.mock([ { method: 'showSaveDialogSync', value: ['./tmp/main_1.svg'] } ]);
      await fakeMenu.clickMenu('File', 'Save diagram as...');
    });

    it('ref oreqm', async function () {
      await app.client.waitUntilWindowLoaded();
      fakeDialog.mock([ { method: 'showOpenDialogSync', value: ['./testdata/oreqm_testdata_del_movement.oreqm'] } ]);
      const ref_button = await app.client.$('#get_ref_oreqm_file');
      await ref_button.click();
      assert.notProperty(await app.client.$('#svg_output'), 'error'); // A svg diagram was created
      //rq: ->(rq_filesel_ref_oreqm)
      await screenshot(app);
    });
  });

  describe('Show diagrams', function () {
    it('hierarchy diagram', async function () {
      await app.client.waitUntilWindowLoaded();
      const button = await app.client.$('#show_doctypes');
      await button.click();
      assert.notProperty(await app.client.$('#svg_output'), 'error'); // A svg diagram was created
      await screenshot(app);
    });

    it('safety diagram', async function () {
      await app.client.waitUntilWindowLoaded();
      const button = await app.client.$('#show_doctypes_safety');
      await button.click();
      assert.notProperty(await app.client.$('#svg_output'), 'error'); // A svg diagram was created
      await screenshot(app);
    });
  });


/*
  it("shows an initial window", async function () {
    const count = await app.client.getWindowCount();
    assert.equal(count, 1);
    //console.dir(await app.electron.clipboard.availableFormats())
    //app.client.click('#aboutButton');
    await app.webContents.executeJavaScript("alert('Kilroy was here');");
    await sleep(1000);
  });
*/
});
