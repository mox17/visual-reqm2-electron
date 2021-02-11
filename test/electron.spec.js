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
      env: { RUNNING_IN_SPECTRON: '1' },
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

  it('shows an initial window', function () {
    return client.getWindowCount().then(function (count) {
      assert.equal(count, 1);
      // Please note that getWindowCount() will return 2 if `dev tools` are opened.
      // assert.equal(count, 2)
    })
  })

  it('Window title', async function () {
    const title = await app.client.getTitle();
    assert.equal(title, "Visual ReqM2");
  })

  it('Generate color', function() {
    for (let count=0; count < 100; count += 1) {
        let rgb = color.get_color('foobar'+count.toString());
        assert.ok(rgb.length === 7);
        assert.ok(rgb[0] === '#');
    }
  });


  it('Load oreqm', async function() {
    await client.waitUntilWindowLoaded()
    await sleep(1000)
    const title = await app.client.getTitle();
    const main_render = _interopRequireDefault(require('../lib/main_render.js'));
    main_render.load_file_main('./testdata/oreqm_testdata_no_ogre.oreqm');
    await sleep(2000);
    assert.strictEqual(main_render.oreqm.main != null, true);
  });

  const pal_file = "test_palette.json";
  it('Save palette', function() {
      if (fs.existsSync(pal_file)) {
          fs.unlinkSync(pal_file);
      }    
      color.save_colors_fs(pal_file);
      //console.log(fs.statSync(pal_file, {throwIfNoEntry: false, bigint: true}) );
      assert.ok(fs.existsSync(pal_file));
      let file_content = fs.readFileSync(pal_file, 'utf8');
      //console.log(file_content);
      //assert.strictEqual(file_content.includes('"fxoobar"'), true);
      assert.ok(file_content.includes('"foobar0"'), true);
  });    

  it('Load palette', function() {
      color.load_colors_fs(null, "test_palette.json");
      assert.ok(true);
  });    

  it('Set palette', function() {
      let mapping = {"xyzzy": "#223344"}
  
      color.update_color_settings(mapping, null);
      let xyzzy = color.get_color("xyzzy");
      assert.strictEqual("#223344", xyzzy);
  });    
  
/*
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

  }) */

})
