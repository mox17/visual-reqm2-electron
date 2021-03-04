const Application = require("spectron").Application;
const fakeMenu = require('spectron-fake-menu');
const fakeDialog = require('spectron-fake-dialog');
const electronPath = require("electron");
const path = require("path");
const mkdirp = require('mkdirp')
const fs = require('fs');
const eol = require("eol");
const chai = require("chai");
const assert = chai.assert; // Using Assert style
const expect = chai.expect; // Using Expect style
//const should = chai.should(); // Using Should style
const chaiAsPromised = require('chai-as-promised');
const chaiRoughly = require('chai-roughly');
var chaiFiles = require('chai-files');
const describe = global.describe;
const it = global.it;
const before = global.before;
const after = global.after;
//const beforeEach = global.beforeEach;
//const afterEach = global.afterEach;

const file = chaiFiles.file;
const dir = chaiFiles.dir;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let screenshot_count = 1

function screenshot(app, title="screenshot") {
  app.browserWindow.capturePage().then(function (imageBuffer) {
    let filename = `./tmp/${title}-${screenshot_count}.png`;
    fs.writeFileSync(filename, imageBuffer);
    screenshot_count += 1;
  })
}

function remove_file(path) {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
}

function holdBeforeFileExists(filePath, timeout) {
  timeout = timeout < 1000 ? 1000 : timeout;
  return new Promise((resolve)=>{
    const timer = setTimeout(function () {
      resolve();
    }, timeout);

    const inter = setInterval(function () {
      if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
        clearInterval(inter);
        clearTimeout(timer);
        resolve();
      }
    }, 100);
  });
}

async function compare_files(main_file, ref_file) {
  await holdBeforeFileExists(main_file, 5000);
  await sleep(500); // Allow content to be written
  let main_txt = eol.auto(fs.readFileSync(main_file, "utf8"));
  let ref_txt = eol.auto(fs.readFileSync(ref_file, "utf8"));
  assert.strictEqual(main_txt, ref_txt);
  return main_txt;
}

/**
 * Searching for ids defined in the svg seems not to work with Webdriver,
 * but is it possible to look for a list of elements with a particular class
 * and then ask for the id attribtute. So this work-around provides named
 * lookup of svg diagram elements.
 * @param {Object} app Application
 * @param {string} dom_class looking for class="<dom_class>"
 * @return Map<id,element>
 */
async function get_svg_node_map(app, dom_class='node') {
  let id_map = new Map();
  let svg_elements = await app.client.$$(`.${dom_class}`);
  for (const element of svg_elements) {
    const id = await element.getAttribute('id');
    id_map.set(id, element);
  }
  return id_map;
}

/**
 * Click context menu item
 * @param {object} app Application
 * @param {Map<id, element>} map id mapping to svg elements
 * @param {String} node Name of specobject
 * @param {String} item Name of context menu item
 */
async function context_menu_click(app, map, node, item) {
  await map.get(node).click({ button: 2 });
  let menu_copy_id = await app.client.$(item);
  await menu_copy_id.click();
}

async function click_button(app, id) {
  const button = await app.client.$(id);
  await button.click();
}

async function show_settings(app) {
  await fakeMenu.clickMenu('Edit', 'Settings...');
  await screenshot(app, 'settingsdialog');
  await click_button(app, '#settingsPopupClose');
}

async function wait_for_operation(app) {
  await app.client.waitUntilTextExists('#vrm2_working', 'done')
}

describe("Application launch", function () {
  this.timeout(12000);
  let app;

  before(function () {
    chai.should();
    chai.use(chaiAsPromised);
    chai.use(chaiRoughly);
  });
  
  before(function () {
    mkdirp.sync("./tmp");
    remove_file("./tmp/settings.json");
    app = new Application({
      path: electronPath,
      env: { RUNNING_IN_SPECTRON: "1" }, // Tell special behavior needed for argument handling
      args: [path.join(__dirname, ".."), '-D', './tmp', '-F', 'settings.json'], //rq: ->(rq_cl_settings_file,rq_settings_file)
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
    assert.strictEqual(await app.client.getTitle(), 'Visual ReqM2');
  });

  describe('Click about button', function () {
    it('should open about modal', async function () {
      await app.client.waitUntilWindowLoaded();
      const aboutpane = await app.client.$('#aboutPane');
      let style = await aboutpane.getAttribute('style');
      //console.log(typeof style, style);
      assert.ok(!style.includes('block'));
      await click_button(app, '#aboutButton');
      expect(aboutpane.getAttribute('style')).to.eventually.include('block');
    });

    it('close about again', async function () {
      const aboutpane = await app.client.$('#aboutPane');
      await click_button(app, '#aboutPaneClose');
      expect(aboutpane.getAttribute('style')).to.eventually.not.include('block');
    });
  });

  describe('Settings dialog', function () {
    it('open modal', async function () {
      await app.client.waitUntilWindowLoaded();
      await fakeMenu.clickMenu('Edit', 'Settings...');
      await screenshot(app, 'sett-1');
      // This is the list of fields that can be compared. Keep coordinated with settings.js
      // Check that all are present in settings dialog.
      let fields = [
        'id', 'comment', 'dependson', 'description', 'doctype', 'fulfilledby', 'furtherinfo',
        'linksto', 'needsobj', 'platform', 'rationale', 'safetyclass', 'safetyrationale',
        'shortdesc', 'source', 'sourcefile', 'sourceline', 'status', 'tags', 'usecase',
        'verifycrit', 'version', 'violations'];
      for (const field of fields) {
        let checkbox = await app.client.$(`#sett_ignore_${field}`);
        //console.dir(checkbox)
        assert.notProperty(checkbox, 'error'); //rq: ->(rq_tag_ignore_diff)
      }
      const settings_menu = await app.client.$('#settingsPopup');
      let style = await settings_menu.getAttribute('style');
      assert.ok(style.includes('block'));
    });

    it('Safety rules validation', async function () {
      const settings_menu = await app.client.$('#settingsPopup');
      const safety_rules = await app.client.$('#safety_rules');
      //console.log("Safety rules are:", rules_txt);
      // Test validation of well-formed regular expressions
      await safety_rules.setValue("Not a [ valid( regex");
      await click_button(app, '#sett_ok');
      let style = await settings_menu.getAttribute('style');
      assert.ok(style.includes('display: block;')); //rq: ->(rq_safety_rules_config)
      await click_button(app, '#sett_cancel');
      style = await settings_menu.getAttribute('style');
      assert.ok(!style.includes('block;'));
    });
  });

  describe('Issues dialog', function () {
    it('open issues modal', async function () {
      await app.client.waitUntilWindowLoaded();
      await fakeMenu.clickMenu('View', 'Show issues');
      const issues_modal = await app.client.$('#problemPopup');
      let style = await issues_modal.getAttribute('style');
      assert.ok(style.includes('block')); //rq: ->(rq_issues_log)
    });

    it('close issues modal', async function () {
      await click_button(app, '#problemPopupClose');
      const issues_modal = await app.client.$('#problemPopup');
      let style = await issues_modal.getAttribute('style');
      assert.ok(!style.includes('block'));
    });
  });

  describe('Import doctype colors', function () {
    it('color palette', async function () {
      let colors_filename = './test/refdata/test_suite_palette.json'
      await fakeDialog.mock([ { method: 'showOpenDialogSync', value: [colors_filename] } ]);
      await fakeMenu.clickMenu('File', 'Load color scheme...'); //rq: ->(rq_doctype_color_import)
    });
  });

  describe('Load files', function () {
    it('main oreqm', async function () {
      await app.client.waitUntilWindowLoaded();
      await fakeDialog.mock([ { method: 'showOpenDialogSync', value: ['./testdata/oreqm_testdata_no_ogre.oreqm'] } ]); //rq: ->(rq_filesel_main_oreqm)
      await click_button(app, '#get_main_oreqm_file');
      //rq: ->(rq_filesel_main_oreqm,rq_show_svg)
      await wait_for_operation(app);

      let pan_zoom = await app.client.$('.svg-pan-zoom_viewport #graph0');
      assert.ok(pan_zoom !== undefined); //rq: ->(rq_svg_pan_zoom)

      let svg_map = await get_svg_node_map(app);

      await context_menu_click(app, svg_map, 'cc.game.overview', '#menu_copy_id');
      assert.strictEqual(await app.electron.clipboard.readText(), 'cc.game.overview'); //rq: ->(rq_ctx_copy_id,rq_svg_context_menu)

      await context_menu_click(app, svg_map, 'cc.game.overview', '#menu_copy_ffb');
      assert.strictEqual(await app.electron.clipboard.readText(), 'cc.game.overview:fea:1'); //rq: ->(rq_ctx_copy_id_dt_ver)

      await context_menu_click(app, svg_map, 'cc.game.overview', '#menu_copy_png');
      await wait_for_operation(app);
      let png = await app.electron.clipboard.readImage();
      assert.property(png, 'toPNG'); //rq: ->(rq_ctx_copy_png)
    });

    it('save main as dot', async function () {
      let dot_filename = './tmp/main_1.dot'
      await remove_file(dot_filename);
      await fakeDialog.mock([ { method: 'showSaveDialogSync', value: dot_filename } ]);
      await fakeMenu.clickMenu('File', 'Save diagram as...');
      await wait_for_operation(app);
      let main_txt = await compare_files(dot_filename, './test/refdata/main_1.dot');
      assert.ok(main_txt.includes('BGCOLOR="#')); //rq: ->(rq_doctype_color)
    });

    it('select node', async function () {
      let dot_filename = './tmp/main_select_1.dot';
      await remove_file(dot_filename);
      //console.dir(await app.client.getRenderProcessLogs())
      let svg_map = await get_svg_node_map(app);
      await context_menu_click(app, svg_map, 'cc.game.locations', '#menu_select');
      await wait_for_operation(app);
      await screenshot(app, "select_game_locations");
      await fakeDialog.mock([ { method: 'showSaveDialogSync', value: dot_filename } ]);
      await fakeMenu.clickMenu('File', 'Save diagram as...');
      await wait_for_operation(app);
      let txt = await compare_files(dot_filename, './test/refdata/main_select_1.dot'); //rq: ->(rq_calc_shown_graph)
      assert.ok(txt.includes('subgraph "cluster_cc.game.locations"')); //rq: ->(rq_highlight_sel)
    });

    it('exclude node', async function () {
      let dot_filename = './tmp/main_exclude_1.dot';
      let svg_map = await get_svg_node_map(app);
      await context_menu_click(app, svg_map, 'zork.game.location.frobozz', '#menu_exclude');
      await wait_for_operation(app);
      await screenshot(app, "exclude_frobozz");
      await fakeDialog.mock([ { method: 'showSaveDialogSync', value: dot_filename } ]);
      await fakeMenu.clickMenu('File', 'Save diagram as...');
      await wait_for_operation(app);
      await compare_files(dot_filename, './test/refdata/main_exclude_1.dot'); //rq: ->(rq_excl_id)
      await click_button(app, '#clear_excluded_ids');
      await click_button(app, '#clear_search_regex');
    });

    it('ref oreqm', async function () {
      await click_button(app, '#clear_excluded_ids');
      await click_button(app, '#clear_search_regex');
      await fakeDialog.mock([ { method: 'showOpenDialogSync', value: ['./testdata/oreqm_testdata_del_movement.oreqm'] } ]);
      await click_button(app, '#get_ref_oreqm_file');
      await wait_for_operation(app);
      //rq: ->(rq_filesel_ref_oreqm)
      await screenshot(app, 'ref-oreqm');
    });

    it('save comparison as dot', async function () {
      let dot_filename = './tmp/main_ref_1.dot';
      await remove_file(dot_filename);
      await fakeDialog.mock([ { method: 'showSaveDialogSync', value: dot_filename } ]);
      await fakeMenu.clickMenu('File', 'Save diagram as...');
      await wait_for_operation(app);
      expect(file(dot_filename)).to.exist;
      await compare_files(dot_filename, './test/refdata/main_ref_1.dot'); //rq: ->(rq_oreqm_diff_calc,rq_req_diff_show)
    });

    it('save comparison as png', async function () {
      let png_filename = './tmp/main_ref_1.png';
      await remove_file(png_filename);
      await fakeDialog.mock([ { method: 'showSaveDialogSync', value: png_filename } ]);
      await fakeMenu.clickMenu('File', 'Save diagram as...');
      await wait_for_operation(app);
      assert.ok(fs.existsSync(png_filename)); //rq: ->(rq_save_png_file)
    });

  });

  describe('Show special diagrams', function () {
    it('doctype hierarchy diagram', async function () {
      await click_button(app, '#show_doctypes');
      await wait_for_operation(app);
      await screenshot(app, 'hierarchy-diagram');
    });

    it('save doctype hierarchy diagram as dot', async function () {
      let dot_filename = './tmp/doctypes_1.dot';
      await remove_file(dot_filename);
      await fakeDialog.mock([ { method: 'showSaveDialogSync', value: dot_filename } ]);
      await fakeMenu.clickMenu('File', 'Save diagram as...');
      await wait_for_operation(app);
      compare_files(dot_filename, './test/refdata/doctypes_1.dot'); //rq: ->(rq_doctype_hierarchy)
    });

    it('Safety diagram', async function () {
      await click_button(app, '#show_doctypes_safety');
      await wait_for_operation(app);
      await screenshot(app, 'safety-diagram');
    });

    it('Save safety diagram as dot', async function () {
      let dot_filename = './tmp/safety_1.dot';
      await remove_file(dot_filename);
      show_settings(app);  // debug
      await fakeDialog.mock([ { method: 'showSaveDialogSync', value: dot_filename } ]);
      await fakeMenu.clickMenu('File', 'Save diagram as...');
      await wait_for_operation(app);
      await compare_files(dot_filename, './test/refdata/safety_1.dot'); //rq: ->(rq_doctype_aggr_safety)
    });

  });

  describe('Handling of duplicate specobjects', function () {
    it('Duplicates with unique versions', async function () {
      await click_button(app, '#clear_search_regex');
      await click_button(app, '#clear_ref_oreqm');
      // Clear any previous issues
      await click_button(app, '#issuesButton');
      await click_button(app, '#clear_problems');
      await click_button(app, '#problemPopupClose');
      let oreqm_name = './test/sample_oreqm/0007_violations.oreqm';
      await fakeDialog.mock([ { method: 'showOpenDialogSync', value: [oreqm_name] } ]);
      await click_button(app, '#get_main_oreqm_file');
      await wait_for_operation(app);
      await click_button(app, '#issuesButton');
      let problem_div = await app.client.$('#raw_problems');
      let problem_txt = await problem_div.getAttribute('innerHTML');
      assert.ok(!problem_txt.includes('duplicated'));
      await click_button(app, '#problemPopupClose');
      let dot_filename = './tmp/0007_violations.dot'
      await fakeDialog.mock([ { method: 'showSaveDialogSync', value: dot_filename } ]);
      await fakeMenu.clickMenu('File', 'Save diagram as...');
      await wait_for_operation(app);
      await compare_files(dot_filename, './test/refdata/0007_violations.dot'); //rq: ->(rq_dup_req)
    });

    it('Duplicates with same versions', async function () {
      // Clear any previous issues
      await click_button(app, '#issuesButton');
      await click_button(app, '#clear_problems');
      await click_button(app, '#problemPopupClose');
      let oreqm_name = './test/sample_oreqm/0007_dup-same-version.oreqm';
      await fakeDialog.mock([ { method: 'showOpenDialogSync', value: [oreqm_name] } ]);
      await click_button(app, '#get_main_oreqm_file');
      await wait_for_operation(app);
      await click_button(app, '#issuesButton');
      let problem_div = await app.client.$('#raw_problems');
      let problem_txt = await problem_div.getAttribute('innerHTML');
      //console.log(problem_txt);
      assert.ok(problem_txt.includes('duplicated')); //rq: ->(rq_dup_same_version)
      await click_button(app, '#problemPopupClose');
      let dot_filename = './tmp/0007_dup-same-version.dot'
      await fakeDialog.mock([ { method: 'showSaveDialogSync', value: dot_filename } ]);
      await fakeMenu.clickMenu('File', 'Save diagram as...');
      await compare_files(dot_filename, './test/refdata/0007_dup-same-version.dot'); //rq: ->(rq_dup_req_display)
      await click_button(app, '#issuesButton');
      let issue_file = './tmp/0007_dup-same-version.txt';
      await fakeDialog.mock([ { method: 'showSaveDialogSync', value: issue_file } ]);
      await click_button(app, '#save_problems');
      await click_button(app, '#clear_problems');
      await click_button(app, '#problemPopupClose');
      await wait_for_operation(app);
      assert.ok(fs.existsSync(issue_file)); //rq: ->(rq_issues_file_export)
    });
  });

  describe('Load and verify a directory of oreqm files', function () {
    it('main oreqm', async function () {
      await app.client.waitUntilWindowLoaded();
      await click_button(app, '#clear_search_regex');
      await click_button(app, '#clear_ref_oreqm');
      const sample_dir = './test/sample_oreqm';
      if (fs.existsSync(sample_dir)) {
        const oreqm_list = fs.readdirSync(sample_dir);
        //console.dir(oreqm_list);
        for (const filename of oreqm_list) {
          if (filename.endsWith('.oreqm')) {
            const oreqm_name = `${sample_dir}/${filename}`
            console.log("        loading:", oreqm_name)
            await fakeDialog.mock([ { method: 'showOpenDialogSync', value: [oreqm_name] } ]);
            await click_button(app, '#get_main_oreqm_file');
            await wait_for_operation(app);
            // await click_button(app, '#filter_graph');
            // await wait_for_operation(app);
            const basename = path.basename(filename, '.oreqm');
            const dot_filename = `./tmp/${basename}.dot`;
            const ref_file = `./test/refdata/${basename}.dot`;
            //console.log(basename, dot_filename);
            await screenshot(app, basename);
            await remove_file(dot_filename);
            await fakeDialog.mock([ { method: 'showSaveDialogSync', value: dot_filename } ]);
            await fakeMenu.clickMenu('File', 'Save diagram as...');
            await wait_for_operation(app);
            console.log("        saving: ", dot_filename);
            await expect(file(dot_filename)).to.exist;
            if (fs.existsSync(ref_file)) {
              console.log(`        Checking: ${ref_file}`)
              await compare_files(dot_filename, ref_file);
            }
          }
        }
      }
    });
  });

  describe('Export doctype colors', function () {
    it('color palette', async function () {
      let colors_filename = './tmp/test_suite_palette.json'
      await fakeDialog.mock([ { method: 'showSaveDialogSync', value: colors_filename } ]);
      await fakeMenu.clickMenu('File', 'Save color scheme as...');
      await holdBeforeFileExists(colors_filename, 5000);
      assert.ok(fs.existsSync(colors_filename)); //rq: ->(rq_doctype_color_export)
    });
  });

});
