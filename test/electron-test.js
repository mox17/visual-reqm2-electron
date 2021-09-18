const Application = require('spectron').Application
const fakeMenu = require('spectron-fake-menu')
const fakeDialog = require('spectron-fake-dialog')
const electronPath = require('electron')
const path = require('path')
const mkdirp = require('mkdirp')
const fs = require('fs')
const eol = require('eol')
const chai = require('chai')
const assert = chai.assert // Using Assert style
const expect = chai.expect // Using Expect style
// const should = chai.should(); // Using Should style
const chaiAsPromised = require('chai-as-promised')
const chaiRoughly = require('chai-roughly')
const chaiFiles = require('chai-files')
const describe = global.describe
const it = global.it
const before = global.before
const after = global.after
// const beforeEach = global.beforeEach;
// const afterEach = global.afterEach;

const file = chaiFiles.file
//const dir = chaiFiles.dir

// eslint-disable-next-line no-unused-vars
function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pad (num, size) {
  num = num.toString()
  while (num.length < size) num = '0' + num
  return num
}

let screenshot_count = 1

function screenshot (app, title = 'screenshot') {
  app.browserWindow.capturePage().then(function (imageBuffer) {
    const filename = `./tmp/${pad(screenshot_count, 2)}-${title}.png`
    fs.writeFileSync(filename, imageBuffer)
    screenshot_count += 1
  })
}

function remove_file (path) {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path)
  }
}

function holdBeforeFileExists (filePath, timeout) {
  timeout = timeout < 1000 ? 1000 : timeout
  return new Promise((resolve) => {
    const timer = setTimeout(function () {
      console.log("Timeout", timeout, filePath)
      resolve()
    }, timeout)

    const inter = setInterval(function () {
      if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
        clearInterval(inter)
        clearTimeout(timer)
        resolve()
      }
    }, 100)
  })
}

async function compare_files (main_file, ref_file) {
  await holdBeforeFileExists(main_file, 10000)
  const main_txt = eol.auto(fs.readFileSync(main_file, 'utf8'))
  const ref_txt = eol.auto(fs.readFileSync(ref_file, 'utf8'))
  assert.strictEqual(main_txt, ref_txt)
  return main_txt
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
async function get_svg_node_map (app, dom_class = 'node') {
  const id_map = new Map()
  const svg_elements = await app.client.$$(`.${dom_class}`)
  for (const element of svg_elements) {
    const id = await element.getAttribute('id')
    id_map.set(id, element)
  }
  return id_map
}

/**
 * Click context menu item
 * @param {object} app Application
 * @param {Map<id, element>} map id mapping to svg elements
 * @param {string} node Name of specobject
 * @param {string} item Name of context menu item
 */
async function context_menu_click (app, map, node, item) {
  await map.get(node).click({ button: 2 })
  const menu_copy_id = await app.client.$(item)
  await menu_copy_id.click()
}

async function click_button (app, id) {
  const button = await app.client.$(id)
  await button.click()
}

async function show_settings (app) {
  await fakeMenu.clickMenu('Edit', 'Settings...')
  await screenshot(app, 'settingsdialog')
  await click_button(app, '#settingsPopupClose')
}

/**
 * Several asynchronous operations indicate completion by writing 'done'
 * to this invisible text field. This is used to synchronize the tests
 * with the state of the application.
 * @param {Object} app The reder process
 */
async function wait_for_operation (app) {
  await app.client.waitUntilTextExists('#vrm2_working', 'done')
}

describe('Application launch', function () {
  this.timeout(30000)
  let app

  before(function () {
    chai.should()
    chai.use(chaiAsPromised)
    chai.use(chaiRoughly)
  })

  before(function () {
    mkdirp.sync('./tmp')
    remove_file('./tmp/settings.json')
    app = new Application({
      path: electronPath,
      //env: { RUNNING_IN_SPECTRON: '1' },
      args: [path.join(__dirname, '..'), '-D', './tmp', '-F', 'settings.json'], //rq: ->(rq_cl_settings_file,rq_settings_file)
      chromeDriverLogPath: path.join(__dirname, '..', './tmp/chromedriver.log')
    })
    fakeMenu.apply(app)
    fakeDialog.apply(app)
    return app.start().then(function () {
      assert.strictEqual(app.isRunning(), true)
      chaiAsPromised.transferPromiseness = app.transferPromiseness
    })
  })

  after(function () {
    if (app && app.isRunning()) {
      return app.stop()
    }
  })

  it('launches the application', async function () {
    const response = await app.client.getWindowHandles()
    assert.strictEqual(response.length, 1)

    await app.browserWindow
      .getBounds()
      .should.eventually.roughly(5)
      .deep.equal({
        x: 25,
        y: 35,
        width: 200,
        height: 100
      })
    await app.client.waitUntilTextExists('html', 'ReqM2')
    assert.strictEqual(await app.client.getTitle(), 'Visual ReqM2')
  })

  describe('Click about button', function () {
    it('should open about modal', async function () {
      await app.client.waitUntilWindowLoaded()
      const aboutpane = await app.client.$('#aboutPane')
      const style = await aboutpane.getAttribute('style')
      // console.log(typeof style, style);
      assert.ok(!style.includes('block'))
      await click_button(app, '#aboutButton')
      expect(aboutpane.getAttribute('style')).to.eventually.include('block')
    })

    it('close about again', async function () {
      const aboutpane = await app.client.$('#aboutPane')
      await click_button(app, '#aboutPaneClose')
      expect(aboutpane.getAttribute('style')).to.eventually.not.include('block')
    })

  })

  describe('Settings dialog', function () {
    it('open modal', async function () {
      await app.client.waitUntilWindowLoaded()
      await fakeMenu.clickMenu('Edit', 'Settings...')
      await screenshot(app, 'sett-1')
      // This is the list of fields that can be compared. Keep coordinated with settings.js
      // Check that all are present in settings dialog.
      const fields = [
        'id', 'comment', 'dependson', 'description', 'doctype', 'fulfilledby', 'furtherinfo',
        'linksto', 'needsobj', 'platform', 'rationale', 'safetyclass', 'safetyrationale',
        'shortdesc', 'source', 'sourcefile', 'sourceline', 'status', 'tags', 'usecase',
        'verifycrit', 'version', 'violations']
      for (const field of fields) {
        const checkbox = await app.client.$(`#sett_ignore_${field}`)
        // console.dir(checkbox)
        assert.notProperty(checkbox, 'error') //rq: ->(rq_tag_ignore_diff)
      }
      const settings_menu = await app.client.$('#settingsPopup')
      const style = await settings_menu.getAttribute('style')
      assert.ok(style.includes('block'))
    })

    it('Safety rules validation', async function () {
      const settings_menu = await app.client.$('#settingsPopup')
      const safety_rules = await app.client.$('#safety_rules')
      // console.log("Safety rules are:", rules_txt);
      // Test validation of well-formed regular expressions
      await safety_rules.setValue('Not a [ valid( regex')
      await click_button(app, '#sett_ok')
      let style = await settings_menu.getAttribute('style')
      assert.ok(style.includes('display: block;')) //rq: ->(rq_safety_rules_config)
      await click_button(app, '#sett_cancel')
      style = await settings_menu.getAttribute('style')
      assert.ok(!style.includes('block;'))
    })
  })

  describe('Issues dialog', function () {
    it('open issues modal', async function () {
      await app.client.waitUntilWindowLoaded()
      await fakeMenu.clickMenu('View', 'Show issues')
      const issues_modal = await app.client.$('#problemPopup')
      const style = await issues_modal.getAttribute('style')
      assert.ok(style.includes('block')) //rq: ->(rq_issues_log)
    })

    it('close issues modal', async function () {
      await click_button(app, '#problemPopupClose')
      const issues_modal = await app.client.$('#problemPopup')
      const style = await issues_modal.getAttribute('style')
      assert.ok(!style.includes('block'))
    })
  })

  describe('Import doctype colors', function () {
    it('color palette', async function () {
      const colors_filename = './test/refdata/test_suite_palette.json'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [colors_filename] }])
      await fakeMenu.clickMenu('File', 'Load color scheme...') //rq: ->(rq_doctype_color_import)
    })
  })

  it('jump between selected nodes (no nodes present)', async function () {
    await click_button(app, '#next_selected')
    await click_button(app, '#next_selected')
    await click_button(app, '#next_selected')
    await click_button(app, '#next_selected')
    await click_button(app, '#next_selected')
    await click_button(app, '#prev_selected')
    await click_button(app, '#prev_selected')
    await click_button(app, '#prev_selected')
    await click_button(app, '#prev_selected')
    await click_button(app, '#prev_selected')
  })

  it('autoupdate off', async function () {
    await click_button(app, '#auto_update')
  })

  describe('Load files', function () {
    it('main oreqm', async function () {
      await app.client.waitUntilWindowLoaded()
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: ['./testdata/oreqm_testdata_no_ogre.oreqm'] }]) //rq: ->(rq_filesel_main_oreqm)
      await click_button(app, '#get_main_oreqm_file')

      await wait_for_operation(app)
      //screenshot(app, 'guide')
      await click_button(app, '#auto_update')
      await wait_for_operation(app)

      const pan_zoom = await app.client.$('.svg-pan-zoom_viewport #graph0')
      assert.ok(pan_zoom !== undefined) //rq: ->(rq_svg_pan_zoom)

      const svg_map = await get_svg_node_map(app)

      await context_menu_click(app, svg_map, 'cc.game.overview', '#menu_copy_id')
      assert.strictEqual(await app.electron.clipboard.readText(), 'cc.game.overview') //rq: ->(rq_ctx_copy_id,rq_svg_context_menu,rq_show_svg,rq_filesel_main_oreqm)

      await context_menu_click(app, svg_map, 'cc.game.overview', '#menu_copy_ffb')
      assert.strictEqual(await app.electron.clipboard.readText(), 'cc.game.overview:fea:1') //rq: ->(rq_ctx_copy_id_dt_ver)

      await context_menu_click(app, svg_map, 'cc.game.overview', '#menu_copy_png')
      await wait_for_operation(app)
      const png = await app.electron.clipboard.readImage()
      assert.property(png, 'toPNG') //rq: ->(rq_ctx_copy_png)

      const doctype_shown_totals = await app.client.$('#doctype_shown_totals')
      assert.strictEqual(await doctype_shown_totals.getAttribute('innerHTML'), '26') //rq: ->(rq_dt_shown_stat)

      const doctype_select_totals = await app.client.$('#doctype_select_totals')
      assert.strictEqual(await doctype_select_totals.getAttribute('innerHTML'), '0') //rq: ->(rq_dt_sel_stat)

      const doctype_totals = await app.client.$('#doctype_totals')
      assert.strictEqual(await doctype_totals.getAttribute('innerHTML'), '26') //rq: ->(rq_totals_stat)
    })

    it('save main as dot', async function () {
      const dot_filename = './tmp/main_1.dot'
      await remove_file(dot_filename)
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      const main_txt = await compare_files(dot_filename, './test/refdata/main_1.dot') //rq: ->(rq_edge_pcov_ffb)
      assert.ok(main_txt.includes('BGCOLOR="#')) //rq: ->(rq_doctype_color)
    })

    it('select node', async function () {
      const dot_filename = './tmp/main_select_1.dot'
      await remove_file(dot_filename)
      // console.dir(await app.client.getRenderProcessLogs())
      const svg_map = await get_svg_node_map(app)
      await context_menu_click(app, svg_map, 'cc.game.locations', '#menu_select') //rq: ->(rq_ctx_add_selection)
      await wait_for_operation(app)
      await screenshot(app, 'select_game_locations')
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      const txt = await compare_files(dot_filename, './test/refdata/main_select_1.dot') //rq: ->(rq_calc_shown_graph)
      assert.ok(txt.includes('subgraph "cluster_cc.game.locations"')) //rq: ->(rq_highlight_sel)
    })

    it('exclude node', async function () {
      const dot_filename = './tmp/main_exclude_1.dot'
      const svg_map = await get_svg_node_map(app)
      await context_menu_click(app, svg_map, 'zork.game.location.frobozz', '#menu_exclude') //rq: ->(rq_ctx_excl)
      await wait_for_operation(app)
      await screenshot(app, 'exclude_frobozz')
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      await compare_files(dot_filename, './test/refdata/main_exclude_1.dot') //rq: ->(rq_excl_id)
    })

    it('deselect node', async function () {
      const dot_filename = './tmp/main_deselect_1.dot'
      const svg_map = await get_svg_node_map(app)
      await context_menu_click(app, svg_map, 'cc.game.locations', '#menu_deselect') //rq: ->(rq_ctx_deselect)
      await wait_for_operation(app)
      await screenshot(app, 'deselect_locations')
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      await compare_files(dot_filename, './test/refdata/main_deselect_1.dot')
      await click_button(app, '#clear_excluded_ids')
      await click_button(app, '#clear_search_regex')
    })

    it('ref oreqm', async function () {
      await click_button(app, '#clear_excluded_ids')
      await click_button(app, '#clear_search_regex')
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: ['./testdata/oreqm_testdata_del_movement.oreqm'] }])
      await click_button(app, '#get_ref_oreqm_file') //rq: ->(rq_filesel_ref_oreqm)
      await wait_for_operation(app)
      await screenshot(app, 'ref-oreqm')
    })
  })

  describe('Save files', function () {
    it('save comparison as dot', async function () {
      const dot_filename = './tmp/main_ref_1.dot'
      await remove_file(dot_filename)
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      //expect(file(dot_filename)).to.exist
      await compare_files(dot_filename, './test/refdata/main_ref_1.dot') //rq: ->(rq_oreqm_diff_calc,rq_req_diff_show)
    })

    it('save comparison as png', async function () {
      const png_filename = './tmp/main_ref_1.png'
      await remove_file(png_filename)
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: png_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      assert.ok(fs.existsSync(png_filename)) //rq: ->(rq_save_png_file)
    })

    it('save diagram context', async function () {
      const context_filename = './tmp/main_ref_1.vr2x'
      await remove_file(context_filename)
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: context_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram context...')
      await wait_for_operation(app)
      assert.ok(fs.existsSync(context_filename))
      await compare_files(context_filename, './test/refdata/main_ref_1.vr2x')
    })

    it('save comparison as svg', async function () {
      const svg_filename = './tmp/main_ref_1.svg'
      const svg_map = await get_svg_node_map(app)
      await remove_file(svg_filename)
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: svg_filename }])
      await context_menu_click(app, svg_map, 'cc.game.characters', '#menu_save_as')
      await wait_for_operation(app)
      await compare_files(svg_filename, './test/refdata/main_ref_1.svg') //rq: ->(rq_save_svg_file)
    })

    it('show xml', async function () {
      const svg_map = await get_svg_node_map(app)
      await context_menu_click(app, svg_map, 'cc.game.characters', '#menu_xml_txt')
      await click_button(app, '#nodeSourceClose') //rq: ->(rq_ctx_show_diff)
      // TODO: Extract text from popup, save as file and compare to reference
    })

    it('show tagged search text', async function () {
      const svg_map = await get_svg_node_map(app)
      await context_menu_click(app, svg_map, 'cc.game.characters', '#menu_search_txt')
      await click_button(app, '#nodeSourceClose')
    })

    it('show diagram as png', async function () {
      const format_select = await app.client.$('#format_select')
      await format_select.selectByAttribute('value', 'png-image-element')
      await wait_for_operation(app)
      await screenshot(app, 'png-format') //rq: ->(rq_show_png)
    })

    it('show diagram as dot', async function () {
      const format_select = await app.client.$('#format_select')
      await format_select.selectByAttribute('value', 'dot-source')
      await wait_for_operation(app)
      await screenshot(app, 'dot-format') //rq: ->(rq_show_dot)
      // back to svg format
      await format_select.selectByAttribute('value', 'svg')
      await wait_for_operation(app)
    })

    it('jump between selected nodes', async function () {
      await click_button(app, '#next_selected') //rq: ->(rq_navigate_sel)
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await click_button(app, '#next_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await click_button(app, '#next_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await click_button(app, '#next_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await click_button(app, '#next_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await click_button(app, '#prev_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await click_button(app, '#prev_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await click_button(app, '#prev_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await click_button(app, '#prev_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await click_button(app, '#prev_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
    })

    // it('Cancel context menu', async function () {
    //   // Open and cancel context menu
    //   const svg_map = await get_svg_node_map(app)
    //   await svg_map.get('cc.game.characters').click({ button: 2 })
    //   await click_button(app, '#filter_graph')
    // })

    // it('Toggle doctypes', async function () {
    //   await click_button(app, '#invert_exclude')
    //   await wait_for_operation(app)
    // })

    // it('Toggle doctypes 2', async function () {
    //   await click_button(app, '#doctype_all')
    //   await wait_for_operation(app)
    // })

    it('Redraw', async function () {
      await click_button(app, '#filter_graph')
      await wait_for_operation(app)
    })

  })

  describe('Menu operations', function () {
    it('Open about from menu', async function () {
      const aboutpane = await app.client.$('#aboutPane')
      await fakeMenu.clickMenu('Help', 'About')
      expect(aboutpane.getAttribute('style')).to.eventually.include('block')
    })

    it('close about once more', async function () {
      const aboutpane = await app.client.$('#aboutPane')
      await click_button(app, '#aboutPaneClose')
      expect(aboutpane.getAttribute('style')).to.eventually.not.include('block')
      await wait_for_operation(app)
    })

    it('Load safety rules', async function () {
      const safety_rules_filename = './testdata/sample_safety_rules.json'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [safety_rules_filename] }])
      await fakeMenu.clickMenu('File', 'Load coverage rules...')
      await wait_for_operation(app)
    })

    it('Save issues file', async function () {
      const issues_filename = './tmp/my_issues.txt'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: issues_filename }])
      await fakeMenu.clickMenu('File', 'Save issues as...')
      await holdBeforeFileExists(issues_filename, 1000)
      //await wait_for_operation(app)
      await compare_files(issues_filename, './test/refdata/my_issues.txt') //rq: ->(rq_issues_file_export)
    })
  })

  describe('Show special diagrams', function () {
    it('doctype hierarchy diagram', async function () {
      await click_button(app, '#show_doctypes')
      await wait_for_operation(app)
      await screenshot(app, 'hierarchy-diagram')
    })

    it('save doctype hierarchy diagram as dot', async function () {
      const dot_filename = './tmp/doctypes_1.dot'
      await remove_file(dot_filename)
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      await compare_files(dot_filename, './test/refdata/doctypes_1.dot') //rq: ->(rq_doctype_hierarchy)
    })

    it('Safety diagram', async function () {
      await click_button(app, '#show_doctypes_safety')
      await wait_for_operation(app)
      await screenshot(app, 'safety-diagram')
    })

    it('Save safety diagram as dot', async function () {
      const dot_filename = './tmp/safety_1.dot'
      await remove_file(dot_filename)
      show_settings(app) // debug
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      await compare_files(dot_filename, './test/refdata/safety_1.dot') //rq: ->(rq_doctype_aggr_safety)
    })
  })

  describe('Handling of duplicate specobjects', function () {
    it('Duplicates with unique versions', async function () {
      await click_button(app, '#clear_search_regex')
      await click_button(app, '#clear_ref_oreqm')
      // Clear any previous issues
      await click_button(app, '#issuesButton')
      await click_button(app, '#clear_problems')
      await click_button(app, '#problemPopupClose')
      const oreqm_name = './test/sample_oreqm/0007_violations.oreqm'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqm_name] }])
      await click_button(app, '#get_main_oreqm_file')
      await wait_for_operation(app)
      await click_button(app, '#issuesButton')
      const problem_div = await app.client.$('#raw_problems')
      const problem_txt = await problem_div.getAttribute('innerHTML')
      assert.ok(!problem_txt.includes('duplicated'))
      await click_button(app, '#problemPopupClose')
      const dot_filename = './tmp/0007_violations.dot'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      await compare_files(dot_filename, './test/refdata/0007_violations.dot') //rq: ->(rq_dup_req)
    })

    it('Duplicates with same versions', async function () {
      // Clear any previous issues
      await click_button(app, '#issuesButton')
      await click_button(app, '#clear_problems')
      await click_button(app, '#problemPopupClose')
      const oreqm_name = './test/sample_oreqm/0007_dup-same-version.oreqm'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqm_name] }])
      await click_button(app, '#get_main_oreqm_file')
      await wait_for_operation(app)
      await click_button(app, '#issuesButton')
      const problem_div = await app.client.$('#raw_problems')
      const problem_txt = await problem_div.getAttribute('innerHTML')
      // console.log(problem_txt);
      assert.ok(problem_txt.includes('duplicated')) //rq: ->(rq_dup_same_version)
      await click_button(app, '#problemPopupClose')
      const dot_filename = './tmp/0007_dup-same-version.dot'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      await compare_files(dot_filename, './test/refdata/0007_dup-same-version.dot') //rq: ->(rq_dup_req_display,rq_dup_id_ver_disp,rq_edge_probs)
      await click_button(app, '#issuesButton')
      const issue_file = './tmp/0007_dup-same-version.txt'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: issue_file }])
      await click_button(app, '#save_problems')
      await click_button(app, '#clear_problems')
      await click_button(app, '#problemPopupClose')
      await wait_for_operation(app)
      assert.ok(fs.existsSync(issue_file)) //rq: ->(rq_issues_file_export)
    })

    it('Search for duplicates', async function () {
      const search_regex = await app.client.$('#search_regex')
      await search_regex.setValue('dup:')
      await click_button(app, '#filter_graph')
      await wait_for_operation(app)
      await screenshot(app, 'search-for-dups')
      const dot_filename = './tmp/search_for_dups.dot'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      await compare_files(dot_filename, './test/refdata/search_for_dups.dot') //rq: ->(rq_dup_req_search,rq_node_probs)
      await click_button(app, '#clear_search_regex')
    })
  })

  describe('Load and verify a directory of oreqm files', function () {
    it('main oreqm', async function () {
      await app.client.waitUntilWindowLoaded()
      await click_button(app, '#clear_search_regex')
      await click_button(app, '#clear_ref_oreqm')
      const sample_dir = './test/sample_oreqm'
      if (fs.existsSync(sample_dir)) {
        const oreqm_list = fs.readdirSync(sample_dir)
        // console.dir(oreqm_list);
        for (const filename of oreqm_list) {
          if (filename.endsWith('.oreqm')) {
            const oreqm_name = `${sample_dir}/${filename}`
            // console.log('        loading:', oreqm_name)
            await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqm_name] }])
            await click_button(app, '#get_main_oreqm_file')
            await wait_for_operation(app)
            // await click_button(app, '#filter_graph');
            // await wait_for_operation(app);
            const basename = path.basename(filename, '.oreqm')
            const dot_filename = `./tmp/${basename}.dot`
            const ref_file = `./test/refdata/${basename}.dot`
            // console.log(basename, dot_filename);
            await screenshot(app, basename)
            await remove_file(dot_filename)
            await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
            await fakeMenu.clickMenu('File', 'Save diagram as...')
            await wait_for_operation(app)
            // console.log('        saving: ', dot_filename)
            await expect(file(dot_filename)).to.exist
            if (fs.existsSync(ref_file)) {
              // console.log(`        Checking: ${ref_file}`)
              await wait_for_operation(app)
              await compare_files(dot_filename, ref_file)
            }
          }
        }
      }
    })
  })

  describe('Export doctype colors', function () {
    it('color palette', async function () {
      const colors_filename = './tmp/test_suite_palette.json'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: colors_filename }])
      await fakeMenu.clickMenu('File', 'Save color scheme as...')
      await holdBeforeFileExists(colors_filename, 5000)
      assert.ok(fs.existsSync(colors_filename)) //rq: ->(rq_doctype_color_export)
    })
  })

  describe('ffb diff display', function () {
    it('Clear old data', async function () {
      await click_button(app, '#clear_ref_oreqm')
      await wait_for_operation(app)
      await click_button(app, '#clear_search_regex')
      await wait_for_operation(app)
      await click_button(app, '#limit_depth_input')
      await wait_for_operation(app)
    })

    it ('Load ffb test 1', async function () {
      const oreqm_main = './testdata/ffbtest_3.oreqm'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqm_main] }])
      await click_button(app, '#get_main_oreqm_file')
      await wait_for_operation(app)
      const dot_filename = './tmp/ffbtest_3.dot'
      const ref_file = './test/refdata/ffbtest_3.dot'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      await compare_files(dot_filename, ref_file)
    })

    it ('Load ffb test 2', async function () {
      const oreqm_main = './testdata/ffbtest_2.oreqm'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqm_main] }])
      await click_button(app, '#get_main_oreqm_file')
      await wait_for_operation(app)
      await click_button(app, '#limit_depth_input')
      const oreqm_ref = './testdata/ffbtest_1.oreqm'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqm_ref] }])
      await click_button(app, '#get_ref_oreqm_file')
      await wait_for_operation(app)
      const dot_filename = './tmp/ffb_diff.dot'
      const ref_file = './test/refdata/ffb_diff.dot'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      await compare_files(dot_filename, ref_file)
      await click_button(app, '#clear_ref_oreqm')
      await wait_for_operation(app)
    })
  })

  describe('all tags', function () {
    it('Clear old data', async function () {
      await click_button(app, '#clear_ref_oreqm')
      await wait_for_operation(app)
      await click_button(app, '#clear_search_regex')
      await wait_for_operation(app)
      await click_button(app, '#limit_depth_input')
      await wait_for_operation(app)
    })

    it ('allReqmTags', async function () {
      const oreqm_main = './testdata/0002_allReqmTags.oreqm'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqm_main] }])
      await click_button(app, '#get_main_oreqm_file')
      await wait_for_operation(app)
      const dot_filename = './tmp/0002_allReqmTags.dot'
      const ref_file = './test/refdata/0002_allReqmTags.dot'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      await compare_files(dot_filename, ref_file)
    })
  })

  describe('Load context', function () {
    /**
     * Load previous saved context and check the save diagram is created
     * by saving a new .dot
     */
     it('Load diagram context', async function () {
      const context_filename = './tmp/main_ref_1.vr2x'
      const dot_filename = './tmp/context.dot'
      assert.ok(fs.existsSync(context_filename))
      await remove_file(dot_filename)

      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [context_filename] }])
      await fakeMenu.clickMenu('File', 'Load diagram context...')
      await wait_for_operation(app)

      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dot_filename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await wait_for_operation(app)
      // TODO: Details of pathnames need handling here
      // await compare_files(dot_filename, './test/refdata/main_ref_1.dot')
    })
  })
})
