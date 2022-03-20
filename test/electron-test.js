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
const crypto = require('crypto');
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

let screenshotCount = 1

function screenshot (app, title = 'screenshot') {
  app.browserWindow.capturePage().then(function (imageBuffer) {
    const filename = `./tmp/${pad(screenshotCount, 2)}-${title}.png`
    fs.writeFileSync(filename, imageBuffer)
    screenshotCount += 1
  })
}

function removeFile (path) {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path)
  }
}

function touchFile (path) {
  const time = new Date()
  try {
    fs.utimesSync(path, time, time)
  } catch (err) {
    fs.closeSync(fs.openSync(path, 'w'))
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

async function compareFiles (mainFile, refFile) {
  await holdBeforeFileExists(mainFile, 10000)
  const mainTxt = eol.auto(fs.readFileSync(mainFile, 'utf8'))
  const refTxt = eol.auto(fs.readFileSync(refFile, 'utf8'))
  assert.strictEqual(mainTxt, refTxt)
  return mainTxt
}

async function compareBinary (mainFile, refFile) {
  var mainHash = crypto.createHash('sha1').update(fs.readFileSync(mainFile)).digest('hex');
  var refHash = crypto.createHash('sha1').update(fs.readFileSync(refFile)).digest('hex');
  assert.strictEqual(mainHash, refHash)
}

/**
 * Searching for ids defined in the svg seems not to work with Webdriver,
 * but is it possible to look for a list of elements with a particular class
 * and then ask for the id attribtute. So this work-around provides named
 * lookup of svg diagram elements.
 * @param {Object} app Application
 * @param {string} domClass looking for class="<domClass>"
 * @return Map<id,element>
 */
async function getSvgNodeMap (app, domClass = 'node') {
  const idMap = new Map()
  const svgElements = await app.client.$$(`.${domClass}`)
  for (const element of svgElements) {
    const id = await element.getAttribute('id')
    idMap.set(id, element)
  }
  return idMap
}

/**
 * Click context menu item
 * @param {object} app Application
 * @param {Map<id, element>} map id mapping to svg elements
 * @param {string} node Name of specobject
 * @param {string} item Name of context menu item
 */
async function contextMenuClick (app, node, item) {
  const map = await getSvgNodeMap(app)
  await map.get(node).click({ button: 2 })
  const menuCopyId = await app.client.$(item)
  await menuCopyId.click()
}

async function clickButton (app, id) {
  const button = await app.client.$(id)
  await button.click()
}

async function showSettings (app) {
  await fakeMenu.clickMenu('Edit', 'Settings...')
  await screenshot(app, 'settingsdialog')
  await clickButton(app, '#settingsPopupClose')
}

/**
 * Several asynchronous operations indicate completion by writing 'done'
 * to this invisible text field. This is used to synchronize the tests
 * with the state of the application.
 * @param {Object} app The reder process
 */
async function waitForOperation (app) {
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
    removeFile('./tmp/settings.json')
    app = new Application({
      path: electronPath,
      //env: { RUNNING_IN_SPECTRON: '1' },
      args: [path.join(__dirname, '..'), '-D', './tmp', '-F', 'settings.json', '--regex'], //rq: ->(rq_cl_settings_file,rq_settings_file)
      chromeDriverLogPath: path.join(__dirname, '..', './tmp/chromedriver.log')
    })
    fakeMenu.apply(app)
    fakeDialog.apply(app)
    return app.start().then(function () {
      assert.strictEqual(app.isRunning(), true)
      chaiAsPromised.transferPromiseness = app.transferPromiseness
    })
  })

  function filterLog (proc, logArr) {
    for (let lm of logArr) {
      if (lm && !lm.message.includes("Function definition doesn't match use") &&
          !lm.message.includes("(Insecure Content-Security-Policy)")) {
        console.log(`${proc} ${lm.level}: `, lm.message)
      }
    }
  }

  after(async function () {
    filterLog('Render', await app.client.getRenderProcessLogs())
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
      await clickButton(app, '#aboutButton')
      expect(aboutpane.getAttribute('style')).to.eventually.include('block')
    })

    it('close about again', async function () {
      const aboutpane = await app.client.$('#aboutPane')
      await clickButton(app, '#aboutPaneClose')
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
        'id', 'comment', 'covstatus', 'dependson', 'description', 'doctype', 'fulfilledby', 'furtherinfo',
        'linksto', 'needsobj', 'platform', 'rationale', 'safetyclass', 'safetyrationale',
        'shortdesc', 'source', 'sourcefile', 'sourceline', 'sourcerevision', 'creationdate', 'category',
        'priority', 'securityclass', 'securityrationale', 'verifymethods', 'verifycond', 'testin', 'testexec',
        'testout', 'testpasscrit', 'releases', 'conflicts', 'status', 'tags', 'usecase',
        'verifycrit', 'version', 'violations', 'errors', 'ffberrors', 'miscov']
      for (const field of fields) {
        const checkbox = await app.client.$(`#sett_ignore_${field}`)
        // console.dir(checkbox)
        assert.notProperty(checkbox, 'error') //rq: ->(rq_tag_ignore_diff)
      }
      const settingsMenu = await app.client.$('#settingsPopup')
      const style = await settingsMenu.getAttribute('style')
      assert.ok(style.includes('block'))
    })

    it('close settings with OK', async function () {
      const settingsMenu = await app.client.$('#settingsPopup')
      await clickButton(app, '#sett_ok')
      let style = await settingsMenu.getAttribute('style')
      assert.ok(!style.includes('block;'))
    })

    it('Reopen settings', async function () {
      const settingsMenu = await app.client.$('#settingsPopup')
      await fakeMenu.clickMenu('Edit', 'Settings...')
      const style = await settingsMenu.getAttribute('style')
      assert.ok(style.includes('block'))
    })

    it('Safety rules validation', async function () {
      const settingsMenu = await app.client.$('#settingsPopup')
      const safetyRules = await app.client.$('#safety_rules')
      // console.log("Safety rules are:", rules_txt);
      // Test validation of well-formed regular expressions
      await safetyRules.setValue('Not a [ valid( regex')
      await clickButton(app, '#sett_ok')
      let style = await settingsMenu.getAttribute('style')
      assert.ok(style.includes('display: block;')) //rq: ->(rq_safety_rules_config)
      await screenshot(app, 'bad_settings')
    })

    it('Semantic safety check errors', async function () {
      const settingsMenu = await app.client.$('#settingsPopup')
      const safetyRules = await app.client.$('#safety_rules')

      const check1 = `[]`

      await safetyRules.setValue(check1)
      await clickButton(app, '#sett_ok')
      let style = await settingsMenu.getAttribute('style')
      assert.ok(style.includes('display: block;')) //rq: ->(rq_safety_rules_config)
      await screenshot(app, 'bad_settings')

      const check2 = `[ "^\\w+:\\w+:$" ]`

      await safetyRules.setValue(check2)
      await clickButton(app, '#sett_ok')
      style = await settingsMenu.getAttribute('style')
      assert.ok(style.includes('display: block;')) //rq: ->(rq_safety_rules_config)
      await screenshot(app, 'bad_settings')

      const check3 = `[ 7 ]`

      await safetyRules.setValue(check3)
      await clickButton(app, '#sett_ok')
      style = await settingsMenu.getAttribute('style')
      assert.ok(style.includes('display: block;')) //rq: ->(rq_safety_rules_config)
      await screenshot(app, 'bad_settings')

      const check4 = `[ ")>" ]`

      await safetyRules.setValue(check4)
      await clickButton(app, '#sett_ok')
      style = await settingsMenu.getAttribute('style')
      assert.ok(style.includes('display: block;')) //rq: ->(rq_safety_rules_config)
      await screenshot(app, 'bad_settings')

      const check5 = `[ ")" ]`

      await safetyRules.setValue(check5)
      await clickButton(app, '#sett_ok')
      style = await settingsMenu.getAttribute('style')
      assert.ok(style.includes('display: block;')) //rq: ->(rq_safety_rules_config)
      await screenshot(app, 'bad_settings')
    })

    it('cancel settings', async function () {
      const settingsMenu = await app.client.$('#settingsPopup')
      await clickButton(app, '#sett_cancel')
      let style = await settingsMenu.getAttribute('style')
      assert.ok(!style.includes('block;'))
    })
  })

  describe('Issues dialog', function () {
    it('open issues modal', async function () {
      await app.client.waitUntilWindowLoaded()
      await fakeMenu.clickMenu('View', 'Show issues')
      const issuesModal = await app.client.$('#problemPopup')
      const style = await issuesModal.getAttribute('style')
      assert.ok(style.includes('block')) //rq: ->(rq_issues_log)
    })

    it('close issues modal', async function () {
      await clickButton(app, '#problemPopupClose')
      const issuesModal = await app.client.$('#problemPopup')
      const style = await issuesModal.getAttribute('style')
      assert.ok(!style.includes('block'))
    })
  })

  describe('Diagram w. no data', function () {
    it('Diagram, no oreqm', async function () {
      await clickButton(app, '#filter_graph')

    })
  })

  describe('Import doctype colors', function () {
    it('color palette', async function () {
      const colorsFilename = './test/refdata/test_suite_palette.json'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [colorsFilename] }])
      await fakeMenu.clickMenu('File', 'Load color scheme...') //rq: ->(rq_doctype_color_import)
    })
  })

  describe('Navigate UI', function () {
    it('jump between selected nodes (no nodes present)', async function () {
      await clickButton(app, '#next_selected')
      await clickButton(app, '#prev_selected')
    })

    it('easter egg diagram', async function () {
      const formatSelect = await app.client.$('#format_select')
      await formatSelect.selectByAttribute('value', 'dot-source')
      await formatSelect.selectByAttribute('value', 'svg')
      await waitForOperation(app)
      screenshot(app, 'foobarbaz')
    })

    it('autoupdate off', async function () {
      await clickButton(app, '#auto_update')
      await waitForOperation(app)
    })
  })

  describe('Load files', function () {
    it('main oreqm', async function () {
      await app.client.waitUntilWindowLoaded()
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: ['./testdata/oreqm_testdata_no_ogre.oreqm'] }]) //rq: ->(rq_filesel_main_oreqm)
      await clickButton(app, '#get_main_oreqm_file')

      await waitForOperation(app)
      //screenshot(app, 'guide')
      await clickButton(app, '#auto_update')
      await waitForOperation(app)

      const panZoom = await app.client.$('.svg-pan-zoom_viewport #graph0')
      assert.ok(panZoom !== undefined) //rq: ->(rq_svg_pan_zoom)

      await contextMenuClick(app, 'cc.game.overview', '#menu_copy_id')
      assert.strictEqual(await app.electron.clipboard.readText(), 'cc.game.overview') //rq: ->(rq_ctx_copy_id,rq_svg_context_menu,rq_show_svg,rq_filesel_main_oreqm)

      await contextMenuClick(app, 'cc.game.overview', '#menu_copy_ffb')
      assert.strictEqual(await app.electron.clipboard.readText(), 'cc.game.overview:fea:1') //rq: ->(rq_ctx_copy_id_dt_ver)

      await contextMenuClick(app, 'cc.game.overview', '#menu_copy_png')
      await waitForOperation(app)
      const png = await app.electron.clipboard.readImage()
      assert.property(png, 'toPNG') //rq: ->(rq_ctx_copy_png)

      const doctypeShownTotals = await app.client.$('#doctype_shown_totals')
      assert.strictEqual(await doctypeShownTotals.getAttribute('innerHTML'), '26') //rq: ->(rq_dt_shown_stat)

      const doctypeSelectTotals = await app.client.$('#doctype_select_totals')
      assert.strictEqual(await doctypeSelectTotals.getAttribute('innerHTML'), '0') //rq: ->(rq_dt_sel_stat)

      const doctypeTotals = await app.client.$('#doctype_totals')
      assert.strictEqual(await doctypeTotals.getAttribute('innerHTML'), '26') //rq: ->(rq_totals_stat)
    })

    it('Cancel context menu', async function () {
      let edgeMap = await getSvgNodeMap(app, 'edge')
      let nodeMap = await getSvgNodeMap(app, 'node')
      // A non-node named item to right-click on is needed, conveniently edges also have names
      await edgeMap.get('edge3').click({ button: 2 })
      screenshot(app, 'context-menu')
      const overviewNode = nodeMap.get('cc.game.overview')
      await overviewNode.click()
      screenshot(app, 'context-menu')
      // TODO: add assert
    })

    it('HTML table', async function () {
      const formatSelect = await app.client.$('#format_select')
      await formatSelect.selectByAttribute('value', 'html-table')
      await waitForOperation(app)
      await screenshot(app, 'table-format')
    })

    it('Back to SVG', async function () {
      const formatSelect = await app.client.$('#format_select')
      await formatSelect.selectByAttribute('value', 'svg')
      await waitForOperation(app)
    })

    it('save main as dot', async function () {
      const dotFilename = './tmp/main_1.dot'
      await removeFile(dotFilename)
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      const mainTxt = await compareFiles(dotFilename, './test/refdata/main_1.dot') //rq: ->(rq_edge_pcov_ffb)
      assert.ok(mainTxt.includes('BGCOLOR="#')) //rq: ->(rq_doctype_color)
    })

    it('select node', async function () {
      const dotFilename = './tmp/main_select_1.dot'
      await removeFile(dotFilename)
      // console.dir(await app.client.getRenderProcessLogs())
      await contextMenuClick(app, 'cc.game.locations', '#menu_select') //rq: ->(rq_ctx_add_selection)
      await waitForOperation(app)
      const searchRegex = await app.client.$('#search_regex')
      const val1 = await searchRegex.getValue()
      // Check that selecting same node again is handled (i.e. ignored)
      await contextMenuClick(app, 'cc.game.locations', '#menu_select')
      await waitForOperation(app)
      const val2 = await searchRegex.getValue()
      // console.log(val1, val2)
      assert.ok(val1 === val2)
      await screenshot(app, 'select_game_locations')
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      const txt = await compareFiles(dotFilename, './test/refdata/main_select_1.dot') //rq: ->(rq_calc_shown_graph)
      assert.ok(txt.includes('subgraph "cluster_cc.game.locations"')) //rq: ->(rq_highlight_sel)
    })

    it('exclude node', async function () {
      const dotFilename = './tmp/main_exclude_1.dot'
      await contextMenuClick(app, 'zork.game.location.frobozz', '#menu_exclude') //rq: ->(rq_ctx_excl)
      await waitForOperation(app)
      await screenshot(app, 'exclude_frobozz')
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/main_exclude_1.dot') //rq: ->(rq_excl_id)
    })

    it('deselect node', async function () {
      const dotFilename = './tmp/main_deselect_1.dot'
      await contextMenuClick(app, 'cc.game.locations', '#menu_deselect') //rq: ->(rq_ctx_deselect)
      await waitForOperation(app)
      await screenshot(app, 'deselect_locations')
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/main_deselect_1.dot')
      await clickButton(app, '#clear_excluded_ids')
      await clickButton(app, '#clear_search_regex')
      await waitForOperation(app)
    })

    it('select two nodes', async function () {
      await contextMenuClick(app, 'cc.game.locations', '#menu_select')
      await waitForOperation(app)
      await contextMenuClick(app, 'cc.game.location.witt', '#menu_select')
      await waitForOperation(app)
      const searchRegex = await app.client.$('#search_regex')
      let val1 = await searchRegex.getValue()
      // console.log(val1)
      assert.ok(val1 === 'cc.game.locations$\n|cc.game.location.witt$')
    })

    it('ref oreqm', async function () {
      await clickButton(app, '#clear_excluded_ids')
      await clickButton(app, '#clear_search_regex')
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: ['./testdata/oreqm_testdata_del_movement.oreqm'] }])
      await clickButton(app, '#get_ref_oreqm_file') //rq: ->(rq_filesel_ref_oreqm)
      await waitForOperation(app)
      await screenshot(app, 'ref-oreqm')
    })
  })

  describe('Update files on disk', function () {
    //rq: ->(rq_watch_files)
    it('Touch main file - ignore', async function () {
      await fakeDialog.mock([{ method: 'showMessageBoxSync', value: 0 }])
      touchFile('./testdata/oreqm_testdata_no_ogre.oreqm')
    })

    it('Touch ref file - ignore', async function () {
      await fakeDialog.mock([{ method: 'showMessageBoxSync', value: 0 }])
      touchFile('./testdata/oreqm_testdata_del_movement.oreqm')
    })

    it('Touch main file - reload', async function () {
      await sleep(2000)
      await fakeDialog.mock([{ method: 'showMessageBoxSync', value: 1 }])
      touchFile('./testdata/oreqm_testdata_no_ogre.oreqm')
      await sleep(1000)
      await waitForOperation(app)
    })

    it('Touch ref file - reload', async function () {
      await fakeDialog.mock([{ method: 'showMessageBoxSync', value: 1 }])
      touchFile('./testdata/oreqm_testdata_del_movement.oreqm')
      await sleep(1000)
      await waitForOperation(app)
    })
  })

  describe('Save files', function () {
    it('save comparison as dot', async function () {
      const dotFilename = './tmp/main_ref_1.dot'
      await removeFile(dotFilename)
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      //expect(file(dotFilename)).to.exist
      await compareFiles(dotFilename, './test/refdata/main_ref_1.dot') //rq: ->(rq_oreqm_diff_calc,rq_req_diff_show)
    })

    it('save comparison as png', async function () {
      const pngFilename = './tmp/main_ref_1.png'
      await removeFile(pngFilename)
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: pngFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      assert.ok(fs.existsSync(pngFilename)) //rq: ->(rq_save_png_file)
    })

    it('save diagram context', async function () {
      const contextFilename = './tmp/main_ref_1.vr2x'
      await removeFile(contextFilename)
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: contextFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram context...')
      await waitForOperation(app)
      assert.ok(fs.existsSync(contextFilename))
      await compareFiles(contextFilename, './test/refdata/main_ref_1.vr2x')
    })

    it('save comparison as svg', async function () {
      const svgFilename = './tmp/main_ref_1.svg'
      await removeFile(svgFilename)
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: svgFilename }])
      await contextMenuClick(app, 'cc.game.characters', '#menu_save_as')
      await waitForOperation(app)
      await compareFiles(svgFilename, './test/refdata/main_ref_1.svg') //rq: ->(rq_save_svg_file)
    })

    it('show xml changed', async function () {
    //rq: ->(rq_ctx_show_xml)
    await contextMenuClick(app, 'cc.game.characters', '#menu_xml_txt')
      let req_src = await app.client.$('#req_src')
      let req_src_html = await req_src.getHTML()
      assert.ok(req_src_html.includes('<h2>XML format (changed specobject)</h2>'))
      await clickButton(app, '#nodeSourceClose') //rq: ->(rq_ctx_show_diff)
      await waitForOperation(app)
    })

    it('show xml removed', async function () {
      await contextMenuClick(app, 'cc.game.character.ogre', '#menu_xml_txt')
      let req_src = await app.client.$('#req_src')
      let req_src_html = await req_src.getHTML()
      assert.ok(req_src_html.includes('<h2>XML format (removed specobject)</h2>'))
      await clickButton(app, '#nodeSourceClose')
      await waitForOperation(app)
    })

    it('show xml new', async function () {
      await contextMenuClick(app, 'cc.game.movement', '#menu_xml_txt')
      let req_src = await app.client.$('#req_src')
      let req_src_html = await req_src.getHTML()
      assert.ok(req_src_html.includes('<h2>XML format (new specobject)</h2>'))
      await clickButton(app, '#nodeSourceClose')
    })

    it('show xml normal', async function () {
      await contextMenuClick(app, 'cc.game.overview', '#menu_xml_txt')
      let req_src = await app.client.$('#req_src')
      let req_src_html = await req_src.getHTML()
      assert.ok(req_src_html.includes('<h2>XML format</h2>'))
      await clickButton(app, '#nodeSourceClose')
      await waitForOperation(app)
    })

    it('show tagged search text', async function () {
      await contextMenuClick(app, 'cc.game.characters', '#menu_search_txt')
      let req_src = await app.client.$('#req_src')
      let req_src_html = await req_src.getHTML()
      assert.ok(req_src_html.includes('<h2>Internal tagged \'search\' format</h2>'))
      await clickButton(app, '#nodeSourceClose')
    })

    it('show diagram as png', async function () {
      const formatSelect = await app.client.$('#format_select')
      await formatSelect.selectByAttribute('value', 'png-image-element')
      await waitForOperation(app)
      await screenshot(app, 'png-format') //rq: ->(rq_show_png)
    })

    it('show diagram as table', async function () {
      const formatSelect = await app.client.$('#format_select')
      await formatSelect.selectByAttribute('value', 'html-table')
      await waitForOperation(app)
      await screenshot(app, 'table-format')
      const doctypeTotals = await app.client.$('#html_table')
      const table = await doctypeTotals.getAttribute('innerHTML')
      const htmlFilename = './tmp/table-1.html'
      fs.writeFileSync(htmlFilename, table)
      await compareFiles(htmlFilename, './test/refdata/table-1.html')
      //rq: ->(rq_table_view)
    })

    it('show diagram as dot', async function () {
      const formatSelect = await app.client.$('#format_select')
      await formatSelect.selectByAttribute('value', 'dot-source')
      await waitForOperation(app)
      await screenshot(app, 'dot-format') //rq: ->(rq_show_dot)
      // back to svg format
      await formatSelect.selectByAttribute('value', 'svg')
      await waitForOperation(app)
    })

    it('jump between selected nodes', async function () {
      await clickButton(app, '#next_selected') //rq: ->(rq_navigate_sel)
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await clickButton(app, '#next_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await clickButton(app, '#next_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await clickButton(app, '#next_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await clickButton(app, '#next_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await clickButton(app, '#prev_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await clickButton(app, '#prev_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await clickButton(app, '#prev_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await clickButton(app, '#prev_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
      await clickButton(app, '#prev_selected')
      await app.client.waitUntilTextExists('#vrm2_working', 'centered')
    })

    it('nodeSelect 1', async function () {
      const nodeSelect = await app.client.$('#nodeSelect')
      // console.log('selectedValue:', await nodeSelect.getValue())
      await nodeSelect.selectByIndex(1)
      // console.log('selectedValue:', await nodeSelect.getValue())
    })

    it('nodeSelect 2', async function () {
      await clickButton(app, '#single_select')
      await waitForOperation(app)

      const dotFilename = './tmp/single_select_1.dot'
      await removeFile(dotFilename)
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      //rq: ->(rq_diagram_legend)
      await compareFiles(dotFilename, './test/refdata/single_select_1.dot')

      const nodeSelect = await app.client.$('#nodeSelect')
      // console.log(await nodeSelect.getValue())
      await nodeSelect.selectByIndex(2)
      // console.log('selectedValue:', await nodeSelect.getValue())
      await waitForOperation(app)
    })

    it('single off', async function () {
      await clickButton(app, '#single_select')
      await waitForOperation(app)
    })

    // it('Cancel context menu', async function () {
    //   // Open and cancel context menu
    //   const svgMap = await getSvgNodeMap(app)
    //   await svgMap.get('cc.game.characters').click({ button: 2 })
    //   await clickButton(app, '#filter_graph')
    // })

    it('Toggle doctypes', async function () {
      await clickButton(app, '#invert_exclude')
      await waitForOperation(app)
    })

    it('Toggle doctypes 2', async function () {
      await clickButton(app, '#doctype_all')
      await waitForOperation(app)
    })

    it('Redraw', async function () {
      await clickButton(app, '#filter_graph')
      await waitForOperation(app)
    })

  })

  describe('Menu operations', function () {
    it('Open about from menu', async function () {
      const aboutpane = await app.client.$('#aboutPane')
      await fakeMenu.clickMenu('Help', 'About')
      expect(aboutpane.getAttribute('style')).to.eventually.include('block')
      await waitForOperation(app)
    })

    it('close about once more', async function () {
      const aboutpane = await app.client.$('#aboutPane')
      await clickButton(app, '#aboutPaneClose')
      expect(aboutpane.getAttribute('style')).to.eventually.not.include('block')
      await waitForOperation(app)
    })

    it('Load too many safety rules', async function () {
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: ['abc', 'xyz'] }])
      await fakeMenu.clickMenu('File', 'Load coverage rules...')
      await waitForOperation(app)
    })

    it('Load bad safety rules', async function () {
      const safetyRulesFilename = './testdata/sample_safety_rules-broken.json'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [safetyRulesFilename] }])
      await fakeDialog.mock([{ method: 'showMessageBoxSync', value: 0 }])
      await fakeMenu.clickMenu('File', 'Load coverage rules...')
      await waitForOperation(app)
    })

    it('Load safety rules', async function () {
      const safetyRulesFilename = './testdata/sample_safety_rules.json'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [safetyRulesFilename] }])
      await fakeMenu.clickMenu('File', 'Load coverage rules...')
      await waitForOperation(app)
      //rq: ->(rq_safety_rules_import)
      // TODO: add asserts
    })

    it('Save issues file - cancel', async function () {
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: undefined }])
      await fakeMenu.clickMenu('File', 'Save issues as...')
      await waitForOperation(app)
    })

    it('Save issues file', async function () {
      const issuesFilename = './tmp/my_issues.txt'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: issuesFilename }])
      await fakeMenu.clickMenu('File', 'Save issues as...')
      //await holdBeforeFileExists(issuesFilename, 6000)
      await waitForOperation(app)
      await compareFiles(issuesFilename, './test/refdata/my_issues.txt') //rq: ->(rq_issues_file_export)
    })
  })

  describe('Show special diagrams', function () {
    it('doctype hierarchy diagram', async function () {
      await clickButton(app, '#show_doctypes')
      await waitForOperation(app)
      await screenshot(app, 'hierarchy-diagram')
    })

    it('save doctype hierarchy diagram as dot', async function () {
      const dotFilename = './tmp/doctypes_1.dot'
      await removeFile(dotFilename)
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/doctypes_1.dot') //rq: ->(rq_doctype_hierarchy)
    })

    it('Safety diagram', async function () {
      await clickButton(app, '#show_doctypes_safety')
      await waitForOperation(app)
      await screenshot(app, 'safety-diagram')
    })

    it('Save safety diagram as dot', async function () {
      const dotFilename = './tmp/safety_1.dot'
      await removeFile(dotFilename)
      showSettings(app) // debug
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/safety_1.dot') //rq: ->(rq_doctype_aggr_safety)
    })
  })

  describe('ID search', function () {
    it('select ID search', async function () {
      //rq: ->(rq_search_id_only)
      let searchRegex = await app.client.$('#search_regex')
      await clickButton(app, '#clear_search_regex')
      await clickButton(app, '#clear_excluded_ids')
      await clickButton(app, '#id_radio_input')
      // Find nodes with 'maze' in id
      await searchRegex.setValue('maze')
      await clickButton(app, '#filter_graph')
      await waitForOperation(app)
      await clickButton(app, '#copy_selected')
      let selected = await app.electron.clipboard.readText()
      //rq: ->(rq_selected_clipboard)
      assert.ok(selected.includes('cc.game.location.maze.9\n'))
      assert.ok(selected.includes('cc.game.location.maze\n'))
      let excludeIds = await app.client.$('#excluded_ids')
      await excludeIds.setValue('cc.game.location.maze.9')
      await clickButton(app, '#filter_graph')
      await waitForOperation(app)
      await clickButton(app, '#copy_selected')
      selected = await app.electron.clipboard.readText()
      assert.ok(!selected.includes('cc.game.location.maze.9\n'))
      await clickButton(app, '#clear_excluded_ids')
    })

    it('Back to regex filter', async function () {
      await clickButton(app, '#regex_radio_input')
      //let searchRegex = await app.client.$('#search_regex')
      await clickButton(app, '#filter_graph')
      await waitForOperation(app)
    })
  })

  describe('Keyboard navigation', function () {
    it('Set focus and move with keys', async function () {
      let pane = await app.client.$('#graph')
      //console.log(pane)
      await clickButton(app, '#graph')
      await pane.keys(['a'])
      // TODO: check screen coordinate changes
      await screenshot(app, 'key-a')
      await pane.keys(['d'])
      await screenshot(app, 'key-d')
      await pane.keys(['s'])
      await screenshot(app, 'key-s')
      await pane.keys(['w'])
      await screenshot(app, 'key-w')
      await pane.keys(['n'])
      await pane.keys(['p'])
      await pane.keys([' '])
      await pane.keys(['+'])
      await pane.keys(['+'])
      await pane.keys(['-'])
      await pane.keys(['-'])
      await pane.keys(['?'])
      await pane.keys(['æ'])
    })
  })

  describe('Context diagram save main only',  () => {
    it('Load main oreqm with absolute path', async function () {
      let oPath = path.join(process.cwd(), './testdata/oreqm_testdata_no_ogre.oreqm')
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oPath] }])
      await clickButton(app, '#get_main_oreqm_file')
      await waitForOperation(app)
      let searchRegex = await app.client.$('#search_regex')
      await searchRegex.setValue('maze')
      await clickButton(app, '#filter_graph')
      await waitForOperation(app)
    })

    it('save diagram context without reference file', async () => {
      const contextFilename = './tmp/main_ref_2.vr2x'
      await removeFile(contextFilename)
      await clickButton(app, '#clear_ref_oreqm')
      await waitForOperation(app)
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: contextFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram context...')
      await waitForOperation(app)
      assert.ok(fs.existsSync(contextFilename))
      await compareFiles(contextFilename, './test/refdata/main_ref_2.vr2x')
    })
  })

  describe('Handling of duplicate specobjects', function () {
    it('Duplicates with unique versions', async function () {
      await clickButton(app, '#clear_search_regex')
      await clickButton(app, '#clear_ref_oreqm')
      // Clear any previous issues
      await clickButton(app, '#issuesButton')
      await clickButton(app, '#clear_problems')
      await clickButton(app, '#problemPopupClose')
      const oreqmName = './test/sample_oreqm/0007_violations.oreqm'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqmName] }])
      await clickButton(app, '#get_main_oreqm_file')
      await waitForOperation(app)
      await clickButton(app, '#issuesButton')
      const problemDiv = await app.client.$('#raw_problems')
      const problemTxt = await problemDiv.getAttribute('innerHTML')
      assert.ok(!problemTxt.includes('duplicated'))
      await clickButton(app, '#problemPopupClose')
      const dotFilename = './tmp/0007_violations.dot'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/0007_violations.dot') //rq: ->(rq_dup_req)
    })

    it('Duplicates with same versions', async function () {
      // Clear any previous issues
      await clickButton(app, '#issuesButton')
      await clickButton(app, '#clear_problems')
      await clickButton(app, '#problemPopupClose')
      const oreqmName = './test/sample_oreqm/0007_dup-same-version.oreqm'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqmName] }])
      await clickButton(app, '#get_main_oreqm_file')
      await waitForOperation(app)
      await clickButton(app, '#issuesButton')
      const problemDiv = await app.client.$('#raw_problems')
      const problemTxt = await problemDiv.getAttribute('innerHTML')
      // console.log(problemTxt);
      assert.ok(problemTxt.includes('duplicated')) //rq: ->(rq_dup_same_version)
      await clickButton(app, '#problemPopupClose')
      const dotFilename = './tmp/0007_dup-same-version.dot'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/0007_dup-same-version.dot') //rq: ->(rq_dup_req_display,rq_dup_id_ver_disp,rq_edge_probs)
      await clickButton(app, '#issuesButton')
      const issueFile = './tmp/0007_dup-same-version.txt'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: issueFile }])
      await clickButton(app, '#save_problems')
      await clickButton(app, '#clear_problems')
      await clickButton(app, '#problemPopupClose')
      await waitForOperation(app)
      assert.ok(fs.existsSync(issueFile)) //rq: ->(rq_issues_file_export)
    })

    it('Search for duplicates', async function () {
      const searchRegex = await app.client.$('#search_regex')
      await searchRegex.setValue('dup:')
      await clickButton(app, '#filter_graph')
      await waitForOperation(app)
      await screenshot(app, 'search-for-dups')
      const dotFilename = './tmp/search_for_dups.dot'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/search_for_dups.dot') //rq: ->(rq_dup_req_search,rq_node_probs)
      await clickButton(app, '#clear_search_regex')
    })
  })

  describe('Export doctype colors', function () {
    it('color palette export', async function () {
      const colorsFilename = './tmp/test_suite_palette.json'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: colorsFilename }])
      await fakeMenu.clickMenu('File', 'Save color scheme as...')
      await holdBeforeFileExists(colorsFilename, 5000)
      assert.ok(fs.existsSync(colorsFilename)) //rq: ->(rq_doctype_color_export)
    })
  })

  // describe('Import doctype colors again', function () {
  //   it('color palette', async function () {
  //     const colorsFilename = './tmp/test_suite_palette.json'
  //     await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [colorsFilename] }])
  //     await fakeMenu.clickMenu('File', 'Load color scheme...') //rq: ->(rq_doctype_color_import)
  //   })
  // })

  describe('ffb diff display', function () {
    it('Clear old data', async function () {
      await clickButton(app, '#clear_ref_oreqm')
      await waitForOperation(app)
      await clickButton(app, '#clear_search_regex')
      await waitForOperation(app)
      await clickButton(app, '#limit_depth_input')
      await waitForOperation(app)
    })

    it ('Load ffb test 1', async function () {
      const oreqmMain = './testdata/ffbtest_3.oreqm'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqmMain] }])
      await clickButton(app, '#get_main_oreqm_file')
      await waitForOperation(app)
      const dotFilename = './tmp/ffbtest_3.dot'
      const refFile = './test/refdata/ffbtest_3.dot'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      await compareFiles(dotFilename, refFile)
      //rq: ->(rq_limited_walk)
    })

    it ('Load ffb test 2', async function () {
      const oreqmMain = './testdata/ffbtest_2.oreqm'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqmMain] }])
      await clickButton(app, '#get_main_oreqm_file')
      await waitForOperation(app)
      await clickButton(app, '#limit_depth_input')
      const oreqmRef = './testdata/ffbtest_1.oreqm'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqmRef] }])
      //await clickButton(app, '#get_ref_oreqm_file')
      await fakeMenu.clickMenu('File', 'Load reference oreqm file...')
      await waitForOperation(app)
      const dotFilename = './tmp/ffb_diff.dot'
      const refFile = './test/refdata/ffb_diff.dot'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      await compareFiles(dotFilename, refFile)
    })
  })

  describe('Coverage settings', function () {
    it('Clear options - ', async function () {
      //rq: ->(rq_status_color,rq_cov_color)
      const settingsMenu = await app.client.$('#settingsPopup')
      await fakeMenu.clickMenu('Edit', 'Settings...')
      const style = await settingsMenu.getAttribute('style')
      assert.ok(style.includes('block'))

      await clickButton(app, '#sett_show_coverage')
      await clickButton(app, '#sett_color_status')
      await clickButton(app, '#sett_show_errors')

      let sett_show_coverage = await app.client.$('#sett_show_coverage')
      assert.ok(! await sett_show_coverage.isSelected())
      let sett_color_status = await app.client.$('#sett_color_status')
      assert.ok(! await sett_color_status.isSelected())
      let sett_show_errors = await app.client.$('#sett_show_errors')
      assert.ok(! await sett_show_errors.isSelected())

      await clickButton(app, '#sett_ok')
      await waitForOperation(app)
      await clickButton(app, '#filter_graph')
      await waitForOperation(app)

      const dotFilename = './tmp/ffb_diff_2.dot'
      const refFile = './test/refdata/ffb_diff_2.dot'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      await compareFiles(dotFilename, refFile)
    })

    it('Set options - ', async function () {
      const settingsMenu = await app.client.$('#settingsPopup')
      await fakeMenu.clickMenu('Edit', 'Settings...')
      const style = await settingsMenu.getAttribute('style')
      assert.ok(style.includes('block'))

      await clickButton(app, '#sett_show_coverage')
      await clickButton(app, '#sett_color_status')
      await clickButton(app, '#sett_show_errors')

      let sett_show_coverage = await app.client.$('#sett_show_coverage')
      assert.ok(await sett_show_coverage.isSelected())
      let sett_color_status = await app.client.$('#sett_color_status')
      assert.ok(await sett_color_status.isSelected())
      let sett_show_errors = await app.client.$('#sett_show_errors')
      assert.ok(await sett_show_errors.isSelected())

      await clickButton(app, '#sett_ok')
      await waitForOperation(app)
      await clickButton(app, '#filter_graph')
      await waitForOperation(app)
      await clickButton(app, '#clear_ref_oreqm')
      await waitForOperation(app)
    })
  })

  describe('all tags', function () {
    it('Clear old data', async function () {
      await clickButton(app, '#clear_ref_oreqm')
      await waitForOperation(app)
      await clickButton(app, '#clear_search_regex')
      await waitForOperation(app)
      await clickButton(app, '#limit_depth_input')
      await waitForOperation(app)
    })

    it ('allReqmTags', async function () {
      const oreqmMain = './testdata/0002_allReqmTags.oreqm'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqmMain] }])
      await clickButton(app, '#get_main_oreqm_file')
      await waitForOperation(app)
      const dotFilename = './tmp/0002_allReqmTags.dot'
      const refFile = './test/refdata/0002_allReqmTags.dot'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      await compareFiles(dotFilename, refFile)
    })
  })

  describe('Load and verify a directory of oreqm files', function () {
    it('main oreqm', async function () {
      await app.client.waitUntilWindowLoaded()
      await clickButton(app, '#clear_search_regex')
      await clickButton(app, '#clear_ref_oreqm')
      const sampleDir = './test/sample_oreqm'
      if (fs.existsSync(sampleDir)) {
        const oreqmList = fs.readdirSync(sampleDir)
        // console.dir(oreqmList);
        for (const filename of oreqmList) {
          if (filename.endsWith('.oreqm')) {
            const oreqmName = `${sampleDir}/${filename}`
            // console.log('        loading:', oreqmName)
            await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqmName] }])
            await clickButton(app, '#get_main_oreqm_file')
            await waitForOperation(app)
            // await clickButton(app, '#filter_graph');
            // await waitForOperation(app);
            const basename = path.basename(filename, '.oreqm')
            const dotFilename = `./tmp/${basename}.dot`
            const refFile = `./test/refdata/${basename}.dot`
            // console.log(basename, dotFilename);
            await screenshot(app, basename)
            await removeFile(dotFilename)
            await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
            await fakeMenu.clickMenu('File', 'Save diagram as...')
            await waitForOperation(app)
            // console.log('        saving: ', dotFilename)
            await expect(file(dotFilename)).to.exist
            if (fs.existsSync(refFile)) {
              // console.log(`        Checking: ${refFile}`)
              await waitForOperation(app)
              await compareFiles(dotFilename, refFile)
            }
          }
        }
      }
    })
  })

  describe('Load context', function () {
    it('Load diagram context w. id', async function () {
      const contextFilename = './testdata/bird-id-context.vr2x'
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [contextFilename] }])
      await fakeMenu.clickMenu('File', 'Load diagram context...')
      await waitForOperation(app)

      // This context file is using <id> search - check status
      let id_radio = await app.client.$('#id_radio_input')
      assert.ok(await id_radio.isSelected())
    })

    /**
     * Load previous saved context and check the save diagram is created
     * by saving a new .dot
     */
     it('Load diagram context', async function () {
      const contextFilename = './tmp/main_ref_1.vr2x'
      const dotFilename = './tmp/context.dot'
      assert.ok(fs.existsSync(contextFilename))
      await removeFile(dotFilename)

      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [contextFilename] }])
      await fakeMenu.clickMenu('File', 'Load diagram context...')
      await waitForOperation(app)

      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: dotFilename }])
      await fakeMenu.clickMenu('File', 'Save diagram as...')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/main_ref_1.dot')
    })
  })

  // Switch to VQL
  describe('Select VQL', function () {
    /**
     * Click on VQL radio button
     */
    it('Click VQL', async function () {
      const searchRegex = await app.client.$('#search_regex')
      await clickButton(app, '#vql_radio_input')
      await clickButton(app, '#clear_search_regex')
      await searchRegex.setValue('ao( twisty little or passage, . )')
      await clickButton(app, '#filter_graph')
      await waitForOperation(app)
      await screenshot(app, 'vql')
      // Verify result by the selected node ids
      await clickButton(app, '#copy_selected')
      let selected = await app.electron.clipboard.readText()
      assert.strictEqual(selected, 'cc.game.location.maze\ncc.game.locations\ncc.game.overview\n')
    })

    it('VQL ancestors_of', async function () {
      // again with long form of ancestor_of
      const searchRegex = await app.client.$('#search_regex')
      await clickButton(app, '#clear_search_regex')
      await searchRegex.setValue('ancestors_of( twisty little or passage, . )')
      await clickButton(app, '#filter_graph')
      await waitForOperation(app)
      await screenshot(app, 'vql')
      // Verify result by the selected node ids
      await clickButton(app, '#copy_selected')
      let selected = await app.electron.clipboard.readText()
      assert.strictEqual(selected, 'cc.game.location.maze\ncc.game.locations\ncc.game.overview\n')
    })

    it('VQL children_of', async function () {
      const searchRegex = await app.client.$('#search_regex')
      await clickButton(app, '#clear_search_regex')
      await searchRegex.setValue('co( @id:cc.game.locations$, dt:swdd and not twisting )')
      await clickButton(app, '#filter_graph')
      await waitForOperation(app)
      await screenshot(app, 'vql')
      // Verify result by the selected node ids
      await clickButton(app, '#copy_selected')
      let selected = await app.electron.clipboard.readText()
      assert.strictEqual(selected,
        'cc.game.location.maze.2\ncc.game.location.maze.5\ncc.game.location.maze.6\ncc.game.location.maze.8\ncc.game.location.maze.9\n')
      // again with long form of children_of
      await clickButton(app, '#clear_search_regex')
      await searchRegex.setValue('children_of( @id:cc.game.locations$, dt:swdd and not twisting )')
      await clickButton(app, '#filter_graph')
      await waitForOperation(app)
      await screenshot(app, 'vql')
      // Verify result by the selected node ids
      await clickButton(app, '#copy_selected')
      selected = await app.electron.clipboard.readText()
      assert.strictEqual(selected,
        'cc.game.location.maze.2\ncc.game.location.maze.5\ncc.game.location.maze.6\ncc.game.location.maze.8\ncc.game.location.maze.9\n')
    })

    /*
    it('VQL multiple tagged terms', async function () {
      const searchRegex = await app.client.$('#search_regex')
      await clickButton(app, '#clear_search_regex')
      await searchRegex.setValue('de:\S+witt ')
      await clickButton(app, '#filter_graph')
      await waitForOperation(app)
      await screenshot(app, 'vql')
      // Verify result by the selected node ids
      await clickButton(app, '#copy_selected')
      let selected = await app.electron.clipboard.readText()
    })
*/
  })

  describe('Select duplicate', function () {
    it('load file and select', async function () {
      const oreqmMain = './test/sample_oreqm/0007_dup-same-version.oreqm'
      const searchRegex = await app.client.$('#search_regex')
      await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [oreqmMain] }])
      await fakeMenu.clickMenu('File', 'Load main oreqm file...')
      await waitForOperation(app)

      await clickButton(app, '#clear_search_regex')
      await contextMenuClick(app, 'TestDemoSpec.Object004:1', '#menu_select')
      await waitForOperation(app)
      let search = await searchRegex.getValue()
      assert.ok(search === '@id:TestDemoSpec.Object004$')

      await clickButton(app, '#clear_search_regex')
      await searchRegex.setValue('demo')
      await clickButton(app, '#filter_graph')
      await waitForOperation(app)
      // Now select duplicate specobject TestDemoSpec.Object004:1
      await contextMenuClick(app, 'TestDemoSpec.Object004:1', '#menu_select')
      await waitForOperation(app)
      // twice - no double entry
      await contextMenuClick(app, 'TestDemoSpec.Object004:1', '#menu_select')
      await waitForOperation(app)
      search = await searchRegex.getValue()
      //console.log("search:", search)
      assert.strictEqual(search, 'demo\nor @id:TestDemoSpec.Object004$')
      await contextMenuClick(app, 'TestDemoSpec.Object004:1', '#menu_select')
      await waitForOperation(app)
    })

    it('deselect', async function () {
      const searchRegex = await app.client.$('#search_regex')
      // Deselect duplicate specobject TestDemoSpec.Object004:1
      await contextMenuClick(app, 'TestDemoSpec.Object004:1', '#menu_deselect')
      await waitForOperation(app)
      let search = await searchRegex.getValue()
      //console.log("search:", search)
      assert.strictEqual(search, 'demo')
    })

    it('save selection xlsx multi', async function () {
      let xlsxName = './tmp/selection_save_multi.xlsx'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: xlsxName }])
      await fakeMenu.clickMenu('File', 'Save diagram selection...')
      // Select multi export
      let sheetExportMulti = await app.client.$('#sheet_export_multi')
      let multi = await sheetExportMulti.isSelected()
      if (!multi) {
        await clickButton(app, '#sheet_export_multi')
      }
      await clickButton(app, '#sheet_export_ok')
      await waitForOperation(app)
      await compareBinary(xlsxName, './test/refdata/selection_save_multi.xlsx')
    })

    it('save selection xlsx single', async function () {
      let xlsxName = './tmp/selection_save_single.xlsx'
      await fakeDialog.mock([{ method: 'showSaveDialogSync', value: xlsxName }])
      await fakeMenu.clickMenu('File', 'Save diagram selection...')
      // Select single export
      let sheetExportMulti = await app.client.$('#sheet_export_multi')
      let multi = await sheetExportMulti.isSelected()
      if (multi) {
        await clickButton(app, '#sheet_export_multi')
      }
      await clickButton(app, '#sheet_export_ok')
      await waitForOperation(app)
      await compareBinary(xlsxName, './test/refdata/selection_save_single.xlsx')
    })

    it('De-select unspecific', async function () {
      const searchRegex = await app.client.$('#search_regex')
      await fakeDialog.mock([{ method: 'showMessageBoxSync', value: 0 }])
      await contextMenuClick(app, 'DemoSpec.Object001', '#menu_deselect')
      await waitForOperation(app)
      let search = await searchRegex.getValue()
      //console.log("search:", search)
      assert.strictEqual(search, 'demo')
    })

    it('De-select two specobject - VQL syntax', async function () {
      const searchRegex = await app.client.$('#search_regex')
      await clickButton(app, '#clear_search_regex')
      await waitForOperation(app)
      await contextMenuClick(app, 'TestDemoSpec.Object004', '#menu_select')
      await waitForOperation(app)
      await contextMenuClick(app, 'DemoSpec.Object001a', '#menu_select')
      await waitForOperation(app)
      let search = await searchRegex.getValue()
      assert.strictEqual(search, '@id:TestDemoSpec.Object004$\nor @id:DemoSpec.Object001a$')

      await contextMenuClick(app, 'TestDemoSpec.Object004', '#menu_deselect')
      await waitForOperation(app)
      search = await searchRegex.getValue()
      assert.strictEqual(search, '@id:DemoSpec.Object001a$')

      // remove last entry
      await contextMenuClick(app, 'DemoSpec.Object001a', '#menu_deselect')
      await waitForOperation(app)
      search = await searchRegex.getValue()
      assert.strictEqual(search, '')
    })

    it('De-select two specobject - regex syntax', async function () {
      const searchRegex = await app.client.$('#search_regex')
      await clickButton(app, '#clear_search_regex')
      await waitForOperation(app)
      await clickButton(app, '#regex_radio_input')
      await waitForOperation(app)
      await contextMenuClick(app, 'TestDemoSpec.Object004', '#menu_select')
      await waitForOperation(app)
      await contextMenuClick(app, 'DemoSpec.Object001a', '#menu_select')
      await waitForOperation(app)
      let search = await searchRegex.getValue()
      assert.strictEqual(search, 'TestDemoSpec.Object004$\n|DemoSpec.Object001a$')

      await contextMenuClick(app, 'TestDemoSpec.Object004', '#menu_deselect')
      await waitForOperation(app)
      search = await searchRegex.getValue()
      assert.strictEqual(search, 'DemoSpec.Object001a$')
    })

    it('Exclude two specobjects', async function () {
      await clickButton(app, '#clear_search_regex')
      await waitForOperation(app)
      const exclIds = await app.client.$('#excluded_ids')
      await contextMenuClick(app, 'TestDemoSpec.Object002', '#menu_exclude')
      await waitForOperation(app)
      await contextMenuClick(app, 'TestDemoSpec.Object003', '#menu_exclude')
      await waitForOperation(app)
      let excl = await exclIds.getValue()
      assert.strictEqual(excl, 'TestDemoSpec.Object002\nTestDemoSpec.Object003')
    })
  })
})
