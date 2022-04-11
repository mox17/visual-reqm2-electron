'use strict'
const { _electron: electron } = require('playwright');
const { test, expect } = require('@playwright/test');
const electronPath = require('electron')
const path = require('path')
const { mock } = require('playwright-fake-dialog')
const mkdirp = require('mkdirp')
const fs = require('fs')
const eol = require('eol')
const crypto = require('crypto');

let window, app

async function readClipboardText () {
  const clipboardContentRead = await app.evaluate(async ({clipboard}) => clipboard.readText());
  //console.log('readClipboardText:', clipboardContentRead)
  return clipboardContentRead
}

async function readClipboardImage () {
  const clipboardContentRead = await app.evaluate(async ({clipboard}) => clipboard.readImage());
  return clipboardContentRead
}

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

async function screenshot (window, title = 'screenshot') {
  const filename = `./tmp/${pad(screenshotCount, 2)}-${title}.png`
  screenshotCount += 1
  await window.screenshot({ path: filename });
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
  await expect(mainTxt).toBe(refTxt)
  return mainTxt
}

async function compareBinary (mainFile, refFile) {
  var mainHash = crypto.createHash('sha1').update(fs.readFileSync(mainFile)).digest('hex');
  var refHash = crypto.createHash('sha1').update(fs.readFileSync(refFile)).digest('hex');
  await expect(mainHash).toBe(refHash)
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
  expect((await window.$$(`.${domClass}`)).length > 0).toBeTruthy()
  const svgElements = await window.$$(`.${domClass}`)
  for (const element of svgElements) {
    const id = await element.getAttribute('id')
    idMap.set(id, element)
  }
  //console.log(idMap.keys())
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
  //console.dir(map)
  await map.get(node).click({ button: "right" })
  const menuCopyId = await window.locator(item)
  await menuCopyId.click()
}

async function clickButton (app, id) {
  await app.locator(id).click()
}

async function clickMenuItemById (electronApp, id) {
  return electronApp.evaluate(({ Menu }, menuId) => {
    const menu = Menu.getApplicationMenu()
    const menuItem = menu.getMenuItemById(menuId)
    if (menuItem) {
      return menuItem.click()
    } else {
      throw new Error(`Menu item with id ${menuId} not found`)
    }
  }, id)
}

/**
 * Several asynchronous operations indicate completion by writing 'done'
 * to this invisible text field. This is used to synchronize the tests
 * with the state of the application.
 * @param {Object} app The reder process
 */
async function waitForOperation (_app) {
  const vrm2_working = window.locator('id=vrm2_working')
  await expect(vrm2_working).toHaveText('done', {timeout: 10000})
}

async function waitVrm2Status (status) {
  const vrm2_working = window.locator('id=vrm2_working')
  await expect(vrm2_working).toHaveText(status, {timeout: 10000})
}

test.afterAll(async () => {
  //console.log('afterAll')
})

test.describe('Application launch', () => {

  test.describe.configure({ mode: 'serial' });

  test('Launch Visual ReqM2', async () => {
    mkdirp.sync('./tmp')
    removeFile('./tmp/settings.json')
    app = await electron.launch({
      path: electronPath,
      args: ['lib/main.js', '-D', './tmp', '-F', 'settings.json', '--regex'] //rq: ->(rq_cl_settings_file,rq_settings_file)
    })
    window = await app.firstWindow();
    await window.coverage.startJSCoverage({reportAnonymousScripts: true});

    window.on('console', async (msg) => {
      const values = [];
      for (const arg of msg.args()) {
        try {
          values.push(await arg.jsonValue());
        } catch (err) {
          console.log("error copying log messages: ", err)
        }
      }
      console.dir(...values);
    })
  })

  // function filterLog (proc, logArr) {
  //   for (let lm of logArr) {
  //     if (lm && !lm.message.includes("Function definition doesn't match use") &&
  //         !lm.message.includes("(Insecure Content-Security-Policy)")) {
  //       console.log(`${proc} ${lm.level}: `, lm.message)
  //     }
  //   }
  // }

  test('launches the application', async () => {
    const title = await window.title()
    await expect(title).toBe('Visual ReqM2')
  })

  test.describe('Click about button', () => {
    test('should open about modal', async () => {
      await window.waitForLoadState('domcontentloaded');
      await clickButton(window, '#aboutButton')
      await window.locator('#aboutPane').waitFor()
    })

    test('close about again', async () => {
      await screenshot(window, 'about-1')
      await clickButton(window, '#aboutPaneClose')
      await screenshot(window, 'about-2')
      // await window.locator('#aboutPane').waitFor('hidden')
      // await screenshot(window, 'about-3')
    })

  })

  test.describe('Settings dialog', () => {
    test('open modal', async () => {
      await window.waitForLoadState('domcontentloaded');
      await clickMenuItemById(app, 'menu_settings')
      await window.locator('#settingsPopup').waitFor()
      await screenshot(window, 'sett-1')
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
        const checkbox = await window.locator(`#sett_ignore_${field}`)
        // console.dir(checkbox)
        let slicedField = String(checkbox).slice(21)
        //console.log(slicedField)
        await expect(fields.includes(slicedField)).toBe(true) //rq: ->(rq_tag_ignore_diff)
      }
    })

    test('close settings with OK', async () => {
      await clickButton(window, '#sett_ok')
      let style = await window.locator('#settingsPopup').getAttribute('style')
      await expect(style.includes('none')).toBeTruthy()
    })

    test('Reopen settings', async () => {
      const settingsMenu = window.locator('#settingsPopup')
      await clickMenuItemById(app, 'menu_settings')
      const style = String(await settingsMenu.getAttribute('style'))
      //console.dir(style)
      await expect(style.includes('block')).toBeTruthy()
    })

    test('Safety rules validation', async () => {
      const settingsMenu = await window.locator('#settingsPopup')
      const safetyRules = await window.locator('#safety_rules')
      // console.log("Safety rules are:", rules_txt);
      // Test validation of well-formed regular expressions
      await safetyRules.fill('Not a [ valid( regex')
      await clickButton(window, '#sett_ok')
      let style = String(await settingsMenu.getAttribute('style'))
      await expect(style.includes('block')).toBeTruthy() //rq: ->(rq_safety_rules_config)
      await screenshot(window, 'bad_settings')
    })

    test('Semantic safety check errors', async () => {
      const settingsMenu = await window.locator('#settingsPopup')
      const safetyRules = await window.locator('#safety_rules')

      const check1 = `[]`

      await safetyRules.fill(check1)
      await clickButton(window, '#sett_ok')
      await expect((await settingsMenu.getAttribute('style')).includes('block')).toBeTruthy() //rq: ->(rq_safety_rules_config)
      //assert.ok(style.includes('display: block;')) //rq: ->(rq_safety_rules_config)
      await screenshot(window, 'bad_settings')

      const check2 = `[ "^\\w+:\\w+:$" ]`

      await safetyRules.fill(check2)
      await clickButton(window, '#sett_ok')
      await expect((await settingsMenu.getAttribute('style')).includes('block')).toBeTruthy() //rq: ->(rq_safety_rules_config)
      //assert.ok(style.includes('display: block;')) //rq: ->(rq_safety_rules_config)
      await screenshot(window, 'bad_settings')

      const check3 = `[ 7 ]`

      await safetyRules.fill(check3)
      await clickButton(window, '#sett_ok')
      await expect((await settingsMenu.getAttribute('style')).includes('block')).toBeTruthy() //rq: ->(rq_safety_rules_config)
      //assert.ok(style.includes('display: block;')) //rq: ->(rq_safety_rules_config)
      await screenshot(window, 'bad_settings')

      const check4 = `[ ")>" ]`

      await safetyRules.fill(check4)
      await clickButton(window, '#sett_ok')
      await expect((await settingsMenu.getAttribute('style')).includes('block')).toBeTruthy() //rq: ->(rq_safety_rules_config)
      //assert.ok(style.includes('display: block;')) //rq: ->(rq_safety_rules_config)
      await screenshot(window, 'bad_settings')

      const check5 = `[ ")" ]`

      await safetyRules.fill(check5)
      await clickButton(window, '#sett_ok')
      await expect((await settingsMenu.getAttribute('style')).includes('block')).toBeTruthy() //rq: ->(rq_safety_rules_config)
      //assert.ok(style.includes('display: block;')) //rq: ->(rq_safety_rules_config)
      await screenshot(window, 'bad_settings')
    })

    test('cancel settings', async () => {
      const settingsMenu = await window.locator('#settingsPopup')
      await clickButton(window, '#sett_cancel')
      await expect((await settingsMenu.getAttribute('style')).includes('block')).toBeFalsy()
      //assert.ok(!style.includes('block;'))
    })
  })

  test.describe('Issues dialog', () => {
    test('open issues modal', async () => {
      await window.waitForLoadState('domcontentloaded');
      await clickMenuItemById(app, 'menu_show_issues')
      const issuesModal = await window.locator('#problemPopup')
      await expect((await issuesModal.getAttribute('style')).includes('block')).toBeTruthy() //rq: ->(rq_issues_log)
      //assert.ok(style.includes('block')) //rq: ->(rq_issues_log)
    })

    test('close issues modal', async () => {
      await clickButton(window, '#problemPopupClose')
      const issuesModal = await window.locator('#problemPopup')
      await expect((await issuesModal.getAttribute('style')).includes('block')).toBeFalsy()
      //assert.ok(!style.includes('block'))
    })
  })

  test.describe('Diagram w. no data', () => {
    test('Diagram, no oreqm', async () => {
      await clickButton(window, '#filter_graph')
      // TODO: add a check
    })
  })

  test.describe('Import doctype colors', () => {
    test('color palette', async () => {
      const colorsFilename = './test/refdata/test_suite_palette.json'
      await mock(app, [ { method: 'showOpenDialogSync', value: [colorsFilename] } ])
      await clickMenuItemById(app, 'menu_load_color_scheme') //rq: ->(rq_doctype_color_import)
    })
  })

  test.describe('Navigate UI', () => {
    test('jump between selected nodes (no nodes present)', async () => {
      await clickButton(window, '#next_selected')
      await clickButton(window, '#prev_selected')
    })

    test('easter egg diagram', async () => {
      const dropdown = await window.$('#format_select')
      await dropdown.selectOption({value: 'dot-source'})
      await dropdown.selectOption({value: 'svg'})
      await waitForOperation(app)
      await screenshot(window, 'foobarbaz')
    })

    test('autoupdate off', async () => {
      await clickButton(window, '#auto_update')
      await waitForOperation(app)
    })
  })

  test.describe('Load files', () => {
    test('main oreqm', async () => {
      await mock(app, [ { method: 'showOpenDialogSync', value: ['./testdata/oreqm_testdata_no_ogre.oreqm'] } ]) //rq: ->(rq_filesel_main_oreqm)
      await clickButton(window, '#get_main_oreqm_file')

      await waitForOperation(app)
      //screenshot(window, 'guide')
      await clickButton(window, '#auto_update')
      await waitForOperation(app)
      const panZoom = await window.locator('.svg-pan-zoom_viewport #graph0')
      await expect(panZoom !== undefined).toBeTruthy() //rq: ->(rq_svg_pan_zoom)

      await contextMenuClick(app, 'cc.game.overview', '#menu_copy_id')
      //console.log('clipboard', await readClipboardText())
      await expect(await readClipboardText()).toBe('cc.game.overview') //rq: ->(rq_ctx_copy_id,rq_svg_context_menu,rq_show_svg,rq_filesel_main_oreqm)

      await contextMenuClick(app, 'cc.game.overview', '#menu_copy_ffb')
      await expect(await readClipboardText()).toBe('cc.game.overview:fea:1') //rq: ->(rq_ctx_copy_id_dt_ver)

      await contextMenuClick(app, 'cc.game.overview', '#menu_copy_png')
      await waitForOperation(app)
      //sleep(3000)
      const png = await readClipboardImage()
      //console.dir(png)
      await expect(Object.keys(png).includes('toPNG')).toBeTruthy() //rq: ->(rq_ctx_copy_png)
      await screenshot(window, 'qwerty')
      const doctypeShownTotals = await window.locator('#doctype_shown_totals')
      await expect(await doctypeShownTotals.innerHTML()).toBe('26') //rq: ->(rq_dt_shown_stat)

      const doctypeSelectTotals = await window.locator('#doctype_select_totals')
      await expect(await doctypeSelectTotals.innerHTML()).toBe('0') //rq: ->(rq_dt_sel_stat)

      const doctypeTotals = await window.locator('#doctype_totals')
      await expect(await doctypeTotals.innerHTML()).toBe('26') //rq: ->(rq_totals_stat)
    })

    test('Cancel context menu', async () => {
      let edgeMap = await getSvgNodeMap(app, 'edge')
      let nodeMap = await getSvgNodeMap(app, 'node')
      // A non-node named item to right-click on is needed, conveniently edges also have names
      await edgeMap.get('edge3').click({ button: "right" })
      await screenshot(window, 'context-menu')
      const overviewNode = nodeMap.get('cc.game.overview')
      await overviewNode.click()
      await screenshot(window, 'context-menu')
      // TODO: add assert that context menu not visible
    })

    test('HTML table', async () => {
      const formatSelect = await window.$('#format_select')
      await formatSelect.selectOption( {value: 'html-table'})
      await waitForOperation(app)
      await screenshot(window, 'table-format')
    })

    test('Back to SVG', async () => {
      const formatSelect = await window.$('#format_select')
      await formatSelect.selectOption( {value: 'svg'})
      await waitForOperation(app)
    })

    test('save main as dot', async () => {
      const dotFilename = './tmp/main_1.dot'
      removeFile(dotFilename)
      await mock(app, [{ method: 'showSaveDialogSync', value: dotFilename }])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      const mainTxt = await compareFiles(dotFilename, './test/refdata/main_1.dot') //rq: ->(rq_edge_pcov_ffb)
      await expect(mainTxt.includes('BGCOLOR="#')).toBeTruthy() //rq: ->(rq_doctype_color)
    })

    test('select node', async () => {
      const dotFilename = './tmp/main_select_1.dot'
      removeFile(dotFilename)
      await contextMenuClick(app, 'cc.game.locations', '#menu_select') //rq: ->(rq_ctx_add_selection)
      await waitForOperation(app)
      const searchRegex = await window.locator('#search_regex')
      const val1 = await searchRegex.inputValue()
      // Check that selecting same node again is handled (i.e. ignored)
      await contextMenuClick(app, 'cc.game.locations', '#menu_select')
      await waitForOperation(app)
      const val2 = await searchRegex.inputValue()
      // console.log(val1, val2)
      await expect(val1).toBe(val2)
      await screenshot(window, 'select_game_locations')
      await mock(app, [{ method: 'showSaveDialogSync', value: dotFilename }])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      const txt = await compareFiles(dotFilename, './test/refdata/main_select_1.dot') //rq: ->(rq_calc_shown_graph)
      await expect(txt.includes('subgraph "cluster_cc.game.locations"')).toBeTruthy() //rq: ->(rq_highlight_sel)
    })

    test('exclude node', async () => {
      const dotFilename = './tmp/main_exclude_1.dot'
      await contextMenuClick(app, 'zork.game.location.frobozz', '#menu_exclude') //rq: ->(rq_ctx_excl)
      await waitForOperation(app)
      await screenshot(window, 'exclude_frobozz')
      await mock(app, [{ method: 'showSaveDialogSync', value: dotFilename }])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/main_exclude_1.dot') //rq: ->(rq_excl_id)
    })

    test('deselect node', async () => {
      const dotFilename = './tmp/main_deselect_1.dot'
      await contextMenuClick(app, 'cc.game.locations', '#menu_deselect') //rq: ->(rq_ctx_deselect)
      await waitForOperation(app)
      await screenshot(window, 'deselect_locations')
      await mock(app, [{ method: 'showSaveDialogSync', value: dotFilename }])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/main_deselect_1.dot')
      await clickButton(window, '#clear_excluded_ids')
      await clickButton(window, '#clear_search_regex')
      await waitForOperation(app)
    })

    test('select two nodes', async () => {
      await contextMenuClick(app, 'cc.game.locations', '#menu_select')
      await waitForOperation(app)
      await contextMenuClick(app, 'cc.game.location.witt', '#menu_select')
      await waitForOperation(app)
      const searchRegex = await window.locator('#search_regex')
      await expect(await searchRegex.inputValue()).toBe('cc.game.locations$\n|cc.game.location.witt$')
    })

    test('ref oreqm', async () => {
      await clickButton(window, '#clear_excluded_ids')
      await clickButton(window, '#clear_search_regex')
      await mock(app, [{ method: 'showOpenDialogSync', value: ['./testdata/oreqm_testdata_del_movement.oreqm'] }])
      await clickButton(window, '#get_ref_oreqm_file') //rq: ->(rq_filesel_ref_oreqm)
      await waitForOperation(app)
      await screenshot(window, 'ref-oreqm')
    })
  })

  test.describe('Update files on disk', () => {
    //rq: ->(rq_watch_files)
    test('Touch main file - ignore', async () => {
      await mock(app, [ { method: 'showMessageBoxSync', value: 0 } ])
      touchFile('./testdata/oreqm_testdata_no_ogre.oreqm')
    })

    test('Touch ref file - ignore', async () => {
      await mock(app, [ { method: 'showMessageBoxSync', value: 0 } ])
      touchFile('./testdata/oreqm_testdata_del_movement.oreqm')
    })

    test('Touch main file - reload', async () => {
      await sleep(2000)
      await mock(app, [ { method: 'showMessageBoxSync', value: 1 } ])
      touchFile('./testdata/oreqm_testdata_no_ogre.oreqm')
      await sleep(1000)
      await waitForOperation(app)
    })

    test('Touch ref file - reload', async () => {
      await mock(app, [ { method: 'showMessageBoxSync', value: 1 } ])
      touchFile('./testdata/oreqm_testdata_del_movement.oreqm')
      await sleep(1000)
      await waitForOperation(app)
    })
  })

  test.describe('Save files', () => {
    test('save comparison as dot', async () => {
      const dotFilename = './tmp/main_ref_1.dot'
      removeFile(dotFilename)
      await mock(app, [ { method: 'showSaveDialogSync', value: dotFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/main_ref_1.dot') //rq: ->(rq_oreqm_diff_calc,rq_req_diff_show)
    })

    test('save comparison as png', async () => {
      const pngFilename = './tmp/main_ref_1.png'
      removeFile(pngFilename)
      await mock(app, [ { method: 'showSaveDialogSync', value: pngFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      await expect(fs.existsSync(pngFilename)).toBeTruthy() //rq: ->(rq_save_png_file)
    })

    test('save diagram context', async () => {
      const contextFilename = './tmp/main_ref_1.vr2x'
      removeFile(contextFilename)
      await mock(app, [ { method: 'showSaveDialogSync', value: contextFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_context')
      await waitForOperation(app)
      await expect(fs.existsSync(contextFilename)).toBeTruthy()
      await compareFiles(contextFilename, './test/refdata/main_ref_1.vr2x')
    })

    test('save comparison as svg', async () => {
      const svgFilename = './tmp/main_ref_1.svg'
      removeFile(svgFilename)
      await mock(app, [ { method: 'showSaveDialogSync', value: svgFilename } ])
      await contextMenuClick(app, 'cc.game.characters', '#menu_save_as')
      await waitForOperation(app)
      await compareFiles(svgFilename, './test/refdata/main_ref_1.svg') //rq: ->(rq_save_svg_file)
    })

    test('show xml changed', async () => {
      //rq: ->(rq_ctx_show_xml)
      await contextMenuClick(app, 'cc.game.characters', '#menu_xml_txt')
      const nodeSource = await window.locator('#nodeSource')
      await expect(String(await nodeSource.getAttribute('style')).includes('block')).toBeTruthy()
      let req_src = await window.locator('#req_src')
      let req_src_html = await req_src.innerHTML()
      await expect(req_src_html.includes('<h2>XML format (changed specobject)</h2>')).toBeTruthy()
      await clickButton(window, '#nodeSourceClose') //rq: ->(rq_ctx_show_diff)
      await waitForOperation(app)
    })

    test('show xml removed', async () => {
      await screenshot(window, 'show xml removed')
      await contextMenuClick(app, 'cc.game.character.ogre', '#menu_xml_txt')
      const nodeSource = await window.locator('#nodeSource')
      await expect(String(await nodeSource.getAttribute('style')).includes('block')).toBeTruthy()
      let req_src = await window.locator('#req_src')
      let req_src_html = await req_src.innerHTML()
      await expect(req_src_html.includes('<h2>XML format (removed specobject)</h2>')).toBeTruthy()
      await clickButton(window, '#nodeSourceClose')
      await waitForOperation(app)
    })

    test('show xml new', async () => {
      await contextMenuClick(app, 'cc.game.movement', '#menu_xml_txt')
      const nodeSource = await window.locator('#nodeSource')
      await expect(String(await nodeSource.getAttribute('style')).includes('block')).toBeTruthy()
      let req_src = await window.locator('#req_src')
      let req_src_html = await req_src.innerHTML()
      await expect(req_src_html.includes('<h2>XML format (new specobject)</h2>')).toBeTruthy()
      await clickButton(window, '#nodeSourceClose')
    })

    test('show xml normal', async () => {
      await contextMenuClick(app, 'cc.game.overview', '#menu_xml_txt')
      const nodeSource = await window.locator('#nodeSource')
      await expect(String(await nodeSource.getAttribute('style')).includes('block')).toBeTruthy()
      let req_src = await window.locator('#req_src')
      let req_src_html = await req_src.innerHTML()
      await expect(req_src_html.includes('<h2>XML format</h2>')).toBeTruthy()
      await clickButton(window, '#nodeSourceClose')
      await waitForOperation(app)
    })

    test('show tagged search text', async () => {
      await contextMenuClick(app, 'cc.game.characters', '#menu_search_txt')
      const nodeSource = await window.locator('#nodeSource')
      await expect(String(await nodeSource.getAttribute('style')).includes('block')).toBeTruthy()
      let req_src = await window.locator('#req_src')
      let req_src_html = await req_src.innerHTML()
      await expect(req_src_html.includes('<h2>Internal tagged \'search\' format</h2>')).toBeTruthy()
      await clickButton(window, '#nodeSourceClose')
    })

    test('show diagram as png', async () => {
      const formatSelect = await window.$('#format_select')
      await formatSelect.selectOption({value: 'png-image-element'})
      await waitForOperation(app)
      await screenshot(window, 'png-format') //rq: ->(rq_show_png)
    })

    test('Verify cc.game.character.ogre in nodeSelect', async () => {
      let nodeSelect = await window.locator('#nodeSelect')
      let str = await nodeSelect.innerHTML()
      await expect(str.includes('cc.game.character.ogre')).toBeTruthy()
    })

    test('show diagram as table', async () => {
      const htmlTable = await window.locator('#html_table')
      await screenshot(window, 'table-format')
      const formatSelect = await window.$('#format_select')
      await screenshot(window, 'table-format')
      await formatSelect.selectOption({value: 'html-table'})
      await screenshot(window, 'table-format')
      await waitForOperation(app)
      await screenshot(window, 'table-format')
      await expect((await htmlTable.innerHTML()).includes('spec_cc.game.character.ogre')).toBeTruthy()
      await screenshot(window, 'table-format')
      const table = await htmlTable.innerHTML()
      const htmlFilename = './tmp/table-1.html'
      fs.writeFileSync(htmlFilename, table)
      await compareFiles(htmlFilename, './test/refdata/table-1.html')
      //rq: ->(rq_table_view)
    })

    test('show diagram as dot', async () => {
      const formatSelect = await window.$('#format_select')
      await formatSelect.selectOption({value: 'dot-source'})
      await waitForOperation(app)
      await screenshot(window, 'dot-format') //rq: ->(rq_show_dot)
      // back to svg format
      await formatSelect.selectOption({value: 'svg'})
      await waitForOperation(app)
    })

    test('jump between selected nodes', async () => {
      await clickButton(window, '#next_selected') //rq: ->(rq_navigate_sel)
      await waitVrm2Status('centered')
      await clickButton(window, '#next_selected')
      await waitVrm2Status('centered')
      await clickButton(window, '#next_selected')
      await waitVrm2Status('centered')
      await clickButton(window, '#next_selected')
      await waitVrm2Status('centered')
      await clickButton(window, '#next_selected')
      await waitVrm2Status('centered')
      await clickButton(window, '#prev_selected')
      await waitVrm2Status('centered')
      await clickButton(window, '#prev_selected')
      await waitVrm2Status('centered')
      await clickButton(window, '#prev_selected')
      await waitVrm2Status('centered')
      await clickButton(window, '#prev_selected')
      await waitVrm2Status('centered')
      await clickButton(window, '#prev_selected')
      await waitVrm2Status('centered')
    })

    test('nodeSelect 1', async () => {
      const nodeSelect = await window.$('#nodeSelect')
      // console.log('selectedValue:', await nodeSelect.inputValue())
      await nodeSelect.selectOption({index: 1})
      // console.log('selectedValue:', await nodeSelect.inputValue())
    })

    test('nodeSelect 2', async () => {
      await clickButton(window, '#single_select')
      await waitForOperation(app)

      const dotFilename = './tmp/single_select_1.dot'
      removeFile(dotFilename)
      await mock(app, [ { method: 'showSaveDialogSync', value: dotFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      //rq: ->(rq_diagram_legend)
      await compareFiles(dotFilename, './test/refdata/single_select_1.dot')

      const nodeSelect = await window.$('#nodeSelect')
      // console.log(await nodeSelect.inputValue())
      await nodeSelect.selectOption({index: 2})
      // console.log('selectedValue:', await nodeSelect.inputValue())
      await waitForOperation(app)
      // TODO: add expect
    })

    test('single off', async () => {
      await clickButton(window, '#single_select')
      await waitForOperation(app)
    })

    // test('Cancel context menu', async () => {
    //   // Open and cancel context menu
    //   const svgMap = await getSvgNodeMap(app)
    //   await svgMap.get('cc.game.characters').click({ button: "right" })
    //   await clickButton(window, '#filter_graph')
    // })

    test('Toggle doctypes', async () => {
      await clickButton(window, '#invert_exclude')
      await waitForOperation(app)
    })

    test('Toggle doctypes 2', async () => {
      await clickButton(window, '#doctype_all')
      await waitForOperation(app)
    })

    test('Redraw', async () => {
      await clickButton(window, '#filter_graph')
      await waitForOperation(app)
    })

  })

  test.describe('Menu operations', () => {
    test('Open about from menu', async () => {
      const aboutpane = await window.locator('#aboutPane')
      await clickMenuItemById(app, 'menu_help_about')
      await expect(String(await aboutpane.getAttribute('style')).includes('block')).toBeTruthy()
      await waitForOperation(app)
    })

    test('close about once more', async () => {
      const aboutpane = await window.locator('#aboutPane')
      await clickButton(window, '#aboutPaneClose')
      await expect(String(await aboutpane.getAttribute('style')).includes('block')).toBeFalsy()
      await waitForOperation(app)
    })

    test('Load too many safety rules', async () => {
      await mock(app, [ { method: 'showOpenDialogSync', value: ['abc', 'xyz'] } ])
      await clickMenuItemById(app, 'menu_load_coverage_rules')
      await waitForOperation(app)
    })

    test('Load bad safety rules', async () => {
      const safetyRulesFilename = './testdata/sample_safety_rules-broken.json'
      await mock(app, [ { method: 'showOpenDialogSync', value: [safetyRulesFilename] } ])
      await mock(app, [ { method: 'showMessageBoxSync', value: 0 } ])
      await clickMenuItemById(app, 'menu_load_coverage_rules')
      await waitForOperation(app)
    })

    test('Load safety rules', async () => {
      const safetyRulesFilename = './testdata/sample_safety_rules.json'
      await mock(app, [ { method: 'showOpenDialogSync', value: [safetyRulesFilename] } ])
      await clickMenuItemById(app, 'menu_load_coverage_rules')
      await waitForOperation(app)
      //rq: ->(rq_safety_rules_import)
      // TODO: add asserts
    })

    test('Save issues file - cancel', async () => {
      await mock(app, [ { method: 'showSaveDialogSync', value: undefined } ])
      await clickMenuItemById(app, 'menu_save_issues_as')
      await waitForOperation(app)
    })

    test('Save issues file', async () => {
      const issuesFilename = './tmp/my_issues.txt'
      await mock(app, [ { method: 'showSaveDialogSync', value: issuesFilename } ])
      await clickMenuItemById(app, 'menu_save_issues_as')
      await waitForOperation(app)
      await compareFiles(issuesFilename, './test/refdata/my_issues.txt') //rq: ->(rq_issues_file_export)
    })
  })

  test.describe('Show special diagrams', () => {
    test('doctype hierarchy diagram', async () => {
      await clickButton(window, '#show_doctypes')
      await waitForOperation(app)
      await screenshot(window, 'hierarchy-diagram')
    })

    test('save doctype hierarchy diagram as dot', async () => {
      const dotFilename = './tmp/doctypes_1.dot'
      removeFile(dotFilename)
      await mock(app, [ { method: 'showSaveDialogSync', value: dotFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/doctypes_1.dot') //rq: ->(rq_doctype_hierarchy)
    })

    test('Safety diagram', async () => {
      await clickButton(window, '#show_doctypes_safety')
      await waitForOperation(app)
      await screenshot(window, 'safety-diagram')
    })

    test('Save safety diagram as dot', async () => {
      const dotFilename = './tmp/safety_1.dot'
      removeFile(dotFilename)
      await mock(app, [ { method: 'showSaveDialogSync', value: dotFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/safety_1.dot') //rq: ->(rq_doctype_aggr_safety)
    })
  })

  test.describe('ID search', () => {
    test('select ID search', async () => {
      //rq: ->(rq_search_id_only)
      let searchRegex = await window.locator('#search_regex')
      await clickButton(window, '#clear_search_regex')
      await clickButton(window, '#clear_excluded_ids')
      await clickButton(window, '#id_radio_input')
      // Find nodes with 'maze' in id
      await searchRegex.fill('maze')
      await clickButton(window, '#filter_graph')
      await waitForOperation(app)
      await clickButton(window, '#copy_selected')
      let selected = await readClipboardText()
      //rq: ->(rq_selected_clipboard)
      await expect(selected.includes('cc.game.location.maze.9\n')).toBeTruthy()
      await expect(selected.includes('cc.game.location.maze\n')).toBeTruthy()
      let excludeIds = await window.locator('#excluded_ids')
      await excludeIds.fill('cc.game.location.maze.9')
      await clickButton(window, '#filter_graph')
      await waitForOperation(app)
      await clickButton(window, '#copy_selected')
      selected = await readClipboardText()
      await expect(!selected.includes('cc.game.location.maze.9\n')).toBeTruthy()
      await clickButton(window, '#clear_excluded_ids')
    })

    test('Back to regex filter', async () => {
      await clickButton(window, '#regex_radio_input')
      await clickButton(window, '#filter_graph')
      await waitForOperation(app)
    })
  })

  test.describe('Keyboard navigation', () => {
    test('Set focus and move with keys', async () => {
      let pane = await window.$('#graph')
      await clickButton(window, '#graph')
      await pane.type('a')
      // TODO: check screen coordinate changes
      await screenshot(window, 'key-a')
      await pane.type('d')
      await screenshot(window, 'key-d')
      await pane.type('s')
      await screenshot(window, 'key-s')
      await pane.type('w')
      await screenshot(window, 'key-w')
      await pane.type('n')
      await pane.type('p')
      await pane.type(' ')
      await pane.type('+')
      await pane.type('+')
      await pane.type('-')
      await pane.type('-')
      await pane.type('?')
      await pane.type('æ')
    })
  })

  test.describe('Context diagram save main only',  () => {
    test('Load main oreqm with absolute path', async () => {
      let oPath = path.join(process.cwd(), './testdata/oreqm_testdata_no_ogre.oreqm')
      await mock(app, [ { method: 'showOpenDialogSync', value: [oPath] } ])
      await clickButton(window, '#get_main_oreqm_file')
      await waitForOperation(app)
      let searchRegex = await window.locator('#search_regex')
      await searchRegex.fill('maze')
      await clickButton(window, '#filter_graph')
      await waitForOperation(app)
    })

    test('save diagram context without reference file', async () => {
      const contextFilename = './tmp/main_ref_2.vr2x'
      removeFile(contextFilename)
      await clickButton(window, '#clear_ref_oreqm')
      await waitForOperation(app)
      await mock(app, [ { method: 'showSaveDialogSync', value: contextFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_context')
      await waitForOperation(app)
      await expect(fs.existsSync(contextFilename)).toBeTruthy()
      await compareFiles(contextFilename, './test/refdata/main_ref_2.vr2x')
    })
  })

  test.describe('Handling of duplicate specobjects', () => {
    test('Duplicates with unique versions', async () => {
      await clickButton(window, '#clear_search_regex')
      await clickButton(window, '#clear_ref_oreqm')
      // Clear any previous issues
      await clickButton(window, '#issuesButton')
      await clickButton(window, '#clear_problems')
      await clickButton(window, '#problemPopupClose')
      const oreqmName = './test/sample_oreqm/0007_violations.oreqm'
      await mock(app, [ { method: 'showOpenDialogSync', value: [oreqmName] } ])
      await clickButton(window, '#get_main_oreqm_file')
      await waitForOperation(app)
      await clickButton(window, '#issuesButton')
      const problemDiv = await window.locator('#raw_problems')
      const problemTxt = await problemDiv.innerHTML()
      await expect(!problemTxt.includes('duplicated')).toBeTruthy()
      await clickButton(window, '#problemPopupClose')
      const dotFilename = './tmp/0007_violations.dot'
      await mock(app, [ { method: 'showSaveDialogSync', value: dotFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/0007_violations.dot') //rq: ->(rq_dup_req)
    })

    test('Duplicates with same versions', async () => {
      // Clear any previous issues
      await clickButton(window, '#issuesButton')
      await clickButton(window, '#clear_problems')
      await clickButton(window, '#problemPopupClose')
      const oreqmName = './test/sample_oreqm/0007_dup-same-version.oreqm'
      await mock(app, [ { method: 'showOpenDialogSync', value: [oreqmName] } ])
      await clickButton(window, '#get_main_oreqm_file')
      await waitForOperation(app)
      await clickButton(window, '#issuesButton')
      const problemDiv = await window.locator('#raw_problems')
      const problemTxt = await problemDiv.innerHTML()
      // console.log(problemTxt);
      await expect(problemTxt.includes('duplicated')).toBeTruthy() //rq: ->(rq_dup_same_version)
      await clickButton(window, '#problemPopupClose')
      const dotFilename = './tmp/0007_dup-same-version.dot'
      await mock(app, [ { method: 'showSaveDialogSync', value: dotFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/0007_dup-same-version.dot') //rq: ->(rq_dup_req_display,rq_dup_id_ver_disp,rq_edge_probs)
      await clickButton(window, '#issuesButton')
      const issueFile = './tmp/0007_dup-same-version.txt'
      await mock(app, [ { method: 'showSaveDialogSync', value: issueFile } ])
      await clickButton(window, '#save_problems')
      await clickButton(window, '#clear_problems')
      await clickButton(window, '#problemPopupClose')
      await waitForOperation(app)
      await expect(fs.existsSync(issueFile)).toBeTruthy() //rq: ->(rq_issues_file_export)
    })

    test('Search for duplicates', async () => {
      const searchRegex = await window.locator('#search_regex')
      await searchRegex.fill('dup:')
      await clickButton(window, '#filter_graph')
      await waitForOperation(app)
      await screenshot(window, 'search-for-dups')
      const dotFilename = './tmp/search_for_dups.dot'
      await mock(app, [ { method: 'showSaveDialogSync', value: dotFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/search_for_dups.dot') //rq: ->(rq_dup_req_search,rq_node_probs)
      await clickButton(window, '#clear_search_regex')
    })
  })

  test.describe('Export doctype colors', () => {
    test('color palette export', async () => {
      const colorsFilename = './tmp/test_suite_palette.json'
      await mock(app, [ { method: 'showSaveDialogSync', value: colorsFilename } ])
      await clickMenuItemById(app, 'menu_save_color_scheme_as')
      await holdBeforeFileExists(colorsFilename, 5000)
      await expect(fs.existsSync(colorsFilename)).toBeTruthy() //rq: ->(rq_doctype_color_export)
    })
  })

  // test.describe('Import doctype colors again', () => {
  //   test('color palette', async () => {
  //     const colorsFilename = './tmp/test_suite_palette.json'
  //     await fakeDialog.mock([{ method: 'showOpenDialogSync', value: [colorsFilename] }])
  //     await fakeMenu.clickMenu('File', 'Load color scheme...') //rq: ->(rq_doctype_color_import)
  //   })
  // })

  test.describe('ffb diff display', () => {
    test('Clear old data', async () => {
      await clickButton(window, '#clear_ref_oreqm')
      await waitForOperation(app)
      await clickButton(window, '#clear_search_regex')
      await waitForOperation(app)
      await clickButton(window, '#limit_depth_input')
      await waitForOperation(app)
    })

    test('Load ffb test 1', async () => {
      const oreqmMain = './testdata/ffbtest_3.oreqm'
      await mock(app, [ { method: 'showOpenDialogSync', value: [oreqmMain] } ])
      await clickButton(window, '#get_main_oreqm_file')
      await waitForOperation(app)
      const dotFilename = './tmp/ffbtest_3.dot'
      const refFile = './test/refdata/ffbtest_3.dot'
      await mock(app, [ { method: 'showSaveDialogSync', value: dotFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      await compareFiles(dotFilename, refFile)
      //rq: ->(rq_limited_walk)
    })

    test('Load ffb test 2', async () => {
      const oreqmMain = './testdata/ffbtest_2.oreqm'
      await mock(app, [ { method: 'showOpenDialogSync', value: [oreqmMain] } ])
      await clickButton(window, '#get_main_oreqm_file')
      await waitForOperation(app)
      await clickButton(window, '#limit_depth_input')
      const oreqmRef = './testdata/ffbtest_1.oreqm'
      await mock(app, [ { method: 'showOpenDialogSync', value: [oreqmRef] } ])
      await clickMenuItemById(app, 'menu_load_ref_oreqm')
      await waitForOperation(app)
      const dotFilename = './tmp/ffb_diff.dot'
      const refFile = './test/refdata/ffb_diff.dot'
      await mock(app, [ { method: 'showSaveDialogSync', value: dotFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      await compareFiles(dotFilename, refFile)
    })
  })

  test.describe('Coverage settings', () => {
    test('Clear options - ', async () => {
      //rq: ->(rq_status_color,rq_cov_color)
      const settingsMenu = await window.locator('#settingsPopup')
      await clickMenuItemById(app, 'menu_settings')
      const style = await settingsMenu.getAttribute('style')
      await expect(style.includes('block')).toBeTruthy()

      await clickButton(window, '#sett_show_coverage')
      await clickButton(window, '#sett_color_status')
      await clickButton(window, '#sett_show_errors')

      await expect(await window.locator('#sett_show_coverage')).not.toBeChecked()
      await expect(await window.locator('#sett_color_status')).not.toBeChecked()
      await expect(await window.locator('#sett_show_errors')).not.toBeChecked()

      await clickButton(window, '#sett_ok')
      await waitForOperation(app)
      await clickButton(window, '#filter_graph')
      await waitForOperation(app)

      const dotFilename = './tmp/ffb_diff_2.dot'
      const refFile = './test/refdata/ffb_diff_2.dot'
      await mock(app, [ { method: 'showSaveDialogSync', value: dotFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      await compareFiles(dotFilename, refFile)
    })

    test('Set options - ', async () => {
      const settingsMenu = await window.locator('#settingsPopup')
      await clickMenuItemById(app, 'menu_settings')
      await expect(String(await settingsMenu.getAttribute('style')).includes('block')).toBeTruthy()
      await clickButton(window, '#sett_show_coverage')
      await clickButton(window, '#sett_color_status')
      await clickButton(window, '#sett_show_errors')

      await expect(await window.locator('#sett_show_coverage')).toBeChecked()
      await expect(await window.locator('#sett_color_status')).toBeChecked()
      await expect(await window.locator('#sett_show_errors')).toBeChecked()

      await clickButton(window, '#sett_ok')
      await waitForOperation(app)
      await clickButton(window, '#filter_graph')
      await waitForOperation(app)
      await clickButton(window, '#clear_ref_oreqm')
      await waitForOperation(app)
    })
  })

  test.describe('all tags', () => {
    test('Clear old data', async () => {
      await clickButton(window, '#clear_ref_oreqm')
      await waitForOperation(app)
      await clickButton(window, '#clear_search_regex')
      await waitForOperation(app)
      await clickButton(window, '#limit_depth_input')
      await waitForOperation(app)
    })

    test('allReqmTags', async () => {
      const oreqmMain = './testdata/0002_allReqmTags.oreqm'
      await mock(app, [ { method: 'showOpenDialogSync', value: [oreqmMain] } ])
      await clickButton(window, '#get_main_oreqm_file')
      await waitForOperation(app)
      const dotFilename = './tmp/0002_allReqmTags.dot'
      const refFile = './test/refdata/0002_allReqmTags.dot'
      await mock(app, [ { method: 'showSaveDialogSync', value: dotFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      await compareFiles(dotFilename, refFile)
    })
  })

  test.describe('Load and verify a directory of oreqm files', () => {
    test('main oreqm', async () => {
      await clickButton(window, '#clear_search_regex')
      await clickButton(window, '#clear_ref_oreqm')
      const sampleDir = './test/sample_oreqm'
      if (fs.existsSync(sampleDir)) {
        const oreqmList = fs.readdirSync(sampleDir)
        // console.dir(oreqmList);
        for (const filename of oreqmList) {
          if (filename.endsWith('.oreqm')) {
            const oreqmName = `${sampleDir}/${filename}`
            // console.log('        loading:', oreqmName)
            await mock(app, [ { method: 'showOpenDialogSync', value: [oreqmName] } ])
            await clickButton(window, '#get_main_oreqm_file')
            await waitForOperation(app)
            // await clickButton(window, '#filter_graph');
            // await waitForOperation(app);
            const basename = path.basename(filename, '.oreqm')
            const dotFilename = `./tmp/${basename}.dot`
            const refFile = `./test/refdata/${basename}.dot`
            // console.log(basename, dotFilename);
            await screenshot(window, basename)
            removeFile(dotFilename)
            await mock(app, [ { method: 'showSaveDialogSync', value: dotFilename } ])
            await clickMenuItemById(app, 'menu_save_diagram_as')
            await waitForOperation(app)
            // console.log('        saving: ', dotFilename)
            await expect(fs.existsSync(dotFilename)).toBeTruthy()
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

  test.describe('Load context', () => {

    test('Load diagram context w. bad oreqm refs', async () => {
      const contextFilename = './testdata/test_context_missing_oreqm.vr2x'
      await mock(app, [
        { method: 'showOpenDialogSync', value: [contextFilename] },
        { method: 'showErrorBox', value: 0 }
      ])
      await clickMenuItemById(app, 'menu_load_diagram_context')
      await waitForOperation(app)
      // TODO: check that messagebox was shown
    })

    test('Load diagram context w. bad oreqm refs2', async () => {
      const contextFilename = './testdata/test_context_missing_oreqm2.vr2x'
      await mock(app, [
        { method: 'showOpenDialogSync', value: [contextFilename] },
        { method: 'showErrorBox', value: 0 }
      ])
      await clickMenuItemById(app, 'menu_load_diagram_context')
      await waitForOperation(app)
      // TODO: check that messagebox was shown
    })

    test('Load diagram context w. id', async () => {
      const contextFilename = './testdata/bird-id-context.vr2x'
      await mock(app, [ { method: 'showOpenDialogSync', value: [contextFilename] } ])
      await clickMenuItemById(app, 'menu_load_diagram_context')
      await waitForOperation(app)
      await screenshot(window, 'load-context-bird')
      // This context file is using <id> search - check status was set
      //expect(await window.locator('#id_radio_input')).toBeChecked()
      await expect(await window.locator('#search_regex').inputValue()).toBe('bird')
    })

    /**
     * Load previous saved context and check the save diagram is created
     * by saving a new .dot
     */
     test('Load diagram context', async () => {
      const contextFilename = './tmp/main_ref_1.vr2x'
      const dotFilename = './tmp/context.dot'
      await expect(fs.existsSync(contextFilename)).toBeTruthy()
      removeFile(dotFilename)

      await mock(app, [ { method: 'showOpenDialogSync', value: [contextFilename] } ])
      await clickMenuItemById(app, 'menu_load_diagram_context')
      await waitForOperation(app)

      await mock(app, [ { method: 'showSaveDialogSync', value: dotFilename } ])
      await clickMenuItemById(app, 'menu_save_diagram_as')
      await waitForOperation(app)
      await compareFiles(dotFilename, './test/refdata/main_ref_1.dot')
    })
  })

  // Switch to VQL
  test.describe('Select VQL', () => {
    /**
     * Click on VQL radio button
     */
    test('Click VQL', async () => {
      const searchRegex = await window.locator('#search_regex')
      await clickButton(window, '#vql_radio_input')
      await clickButton(window, '#clear_search_regex')
      await searchRegex.fill('ao( twisty little or passage, . )')
      await clickButton(window, '#filter_graph')
      await waitForOperation(app)
      await screenshot(window, 'vql')
      // Verify result by the selected node ids
      await clickButton(window, '#copy_selected')
      let selected = await readClipboardText()
      await expect(selected).toBe('cc.game.location.maze\ncc.game.locations\ncc.game.overview\n')
    })

    test('VQL ancestors_of', async () => {
      // again with long form of ancestor_of
      const searchRegex = await window.locator('#search_regex')
      await clickButton(window, '#clear_search_regex')
      await searchRegex.fill('ancestors_of( twisty little or passage, . )')
      await clickButton(window, '#filter_graph')
      await waitForOperation(app)
      await screenshot(window, 'vql')
      // Verify result by the selected node ids
      await clickButton(window, '#copy_selected')
      let selected = await readClipboardText()
      await expect(selected).toBe('cc.game.location.maze\ncc.game.locations\ncc.game.overview\n')
    })

    test('VQL children_of', async () => {
      const searchRegex = await window.locator('#search_regex')
      await clickButton(window, '#clear_search_regex')
      await searchRegex.fill('co( @id:cc.game.locations$, dt:swdd and not twisting )')
      await clickButton(window, '#filter_graph')
      await waitForOperation(app)
      await screenshot(window, 'vql')
      // Verify result by the selected node ids
      await clickButton(window, '#copy_selected')
      let selected = await readClipboardText()
      await expect(selected).toBe(
        'cc.game.location.maze.2\ncc.game.location.maze.5\ncc.game.location.maze.6\ncc.game.location.maze.8\ncc.game.location.maze.9\n')
      // again with long form of children_of
      await clickButton(window, '#clear_search_regex')
      await searchRegex.fill('children_of( @id:cc.game.locations$, dt:swdd and not twisting )')
      await clickButton(window, '#filter_graph')
      await waitForOperation(app)
      await screenshot(window, 'vql')
      // Verify result by the selected node ids
      await clickButton(window, '#copy_selected')
      selected = await readClipboardText()
      await expect(selected).toBe(
        'cc.game.location.maze.2\ncc.game.location.maze.5\ncc.game.location.maze.6\ncc.game.location.maze.8\ncc.game.location.maze.9\n')
    })

    /*
    test('VQL multiple tagged terms', async () => {
      const searchRegex = await window.locator('#search_regex')
      await clickButton(window, '#clear_search_regex')
      await searchRegex.fill('de:\S+witt ')
      await clickButton(window, '#filter_graph')
      await waitForOperation(app)
      await screenshot(window, 'vql')
      // Verify result by the selected node ids
      await clickButton(window, '#copy_selected')
      let selected = await readClipboard()
    })
*/
  })

  test.describe('Select duplicate', () => {
    test('load file and select', async () => {
      const oreqmMain = './test/sample_oreqm/0007_dup-same-version.oreqm'
      const searchRegex = await window.locator('#search_regex')
      await mock(app, [ { method: 'showOpenDialogSync', value: [oreqmMain] } ])
      await clickMenuItemById(app, 'menu_load_main_oreqm_file')
      await waitForOperation(app)

      await clickButton(window, '#clear_search_regex')
      await waitForOperation(app)
      await contextMenuClick(app, 'TestDemoSpec.Object004:1', '#menu_select')
      await waitForOperation(app)
      let search = await searchRegex.inputValue()
      await expect(search).toBe('@id:TestDemoSpec.Object004$')

      await clickButton(window, '#clear_search_regex')
      await searchRegex.fill('demo')
      await clickButton(window, '#filter_graph')
      await waitForOperation(app)
      // Now select duplicate specobject TestDemoSpec.Object004:1
      await contextMenuClick(app, 'TestDemoSpec.Object004:1', '#menu_select')
      await waitForOperation(app)
      // twice - no double entry
      await contextMenuClick(app, 'TestDemoSpec.Object004:1', '#menu_select')
      await waitForOperation(app)
      search = await searchRegex.inputValue()
      //console.log("search:", search)
      await expect(search).toBe('demo\nor @id:TestDemoSpec.Object004$')
      await contextMenuClick(app, 'TestDemoSpec.Object004:1', '#menu_select')
      await waitForOperation(app)
    })

    test('deselect', async () => {
      const searchRegex = await window.locator('#search_regex')
      // Deselect duplicate specobject TestDemoSpec.Object004:1
      await contextMenuClick(app, 'TestDemoSpec.Object004:1', '#menu_deselect')
      await waitForOperation(app)
      let search = await searchRegex.inputValue()
      //console.log("search:", search)
      await expect(search).toBe('demo')
    })

    test('open and close save selection field', async () => {
      await clickMenuItemById(app, 'menu_save_diagram_selection')
      const sheetExportPopup = await window.locator('#sheetExportPopup')
      let style = await sheetExportPopup.getAttribute('style')
      expect(style.includes('block')).toBeTruthy()
      // cancel dialog with upper-right close button
      await clickButton(window, '#sheetExportPopupClose')
      style = await sheetExportPopup.getAttribute('style')
      expect(!style.includes('block')).toBeTruthy()
    })

    test('save selection field chooser', async () => {
      await clickMenuItemById(app, 'menu_save_diagram_selection')
      // de-select 'miscov' field
      const sheetUlExported = await window.locator('#sheet_ul_exported')
      const miscov = await sheetUlExported.locator('#export_field_miscov')
      expect(miscov).toBeTruthy()
      // Move to bottom of other list with double click
      await miscov.dblclick()
      const sheetUlNotExported = await window.locator('#sheet_ul_not_exported')
      const miscovMoved = await sheetUlNotExported.locator('#export_field_miscov')
      await screenshot(window, 'miscov-moved')
      expect(miscovMoved).toBeTruthy()
      await miscovMoved.dblclick()
      const miscovBack = await sheetUlNotExported.locator('#export_field_miscov')
      expect(miscovBack).toBeTruthy()
      await screenshot(window, 'miscov-moved-back')
      // cancel dialog
      await clickButton(window, '#sheet_export_cancel')
    })

    test('save selection xlsx multi', async () => {
      let xlsxName = './tmp/selection_save_multi.xlsx'
      await mock(app, [ { method: 'showSaveDialogSync', value: xlsxName } ])
      await clickMenuItemById(app, 'menu_save_diagram_selection')
      // Select multi export
      let sheetExportMulti = await window.locator('#sheet_export_multi')
      let multi = await sheetExportMulti.isChecked()
      if (!multi) {
        await clickButton(window, '#sheet_export_multi')
      }
      await clickButton(window, '#sheet_export_ok')
      await waitForOperation(app)
      if (process.platform === "___win32") {
        // TODO: Not ideal but sheetjs outputs slightly different file on linux
        await compareBinary(xlsxName, './test/refdata/selection_save_multi.xlsx')
      }
    })

    test('save selection xlsx single', async () => {
      let xlsxName = './tmp/selection_save_single.xlsx'
      await mock(app, [ { method: 'showSaveDialogSync', value: xlsxName } ])
      await clickMenuItemById(app, 'menu_save_diagram_selection')
      // Select single export
      let sheetExportMulti = await window.locator('#sheet_export_multi')
      let multi = await sheetExportMulti.isChecked()
      if (multi) {
        await clickButton(window, '#sheet_export_multi')
      }
      await clickButton(window, '#sheet_export_ok')
      await waitForOperation(app)
      if (process.platform === "___win32") {
        // TODO: Not ideal but sheetjs outputs slightly different file on linux
        await compareBinary(xlsxName, './test/refdata/selection_save_single.xlsx')
      }
    })

    test('De-select unspecific', async () => {
      const searchRegex = await window.locator('#search_regex')
      await mock(app, [ { method: 'showMessageBoxSync', value: 0 } ])
      await contextMenuClick(app, 'DemoSpec.Object001', '#menu_deselect')
      await waitForOperation(app)
      let search = await searchRegex.inputValue()
      //console.log("search:", search)
      await expect(search).toBe('demo')
    })

    test('De-select two specobject - VQL syntax', async () => {
      const searchRegex = await window.locator('#search_regex')
      await clickButton(window, '#clear_search_regex')
      await waitForOperation(app)
      await contextMenuClick(app, 'TestDemoSpec.Object004', '#menu_select')
      await waitForOperation(app)
      await contextMenuClick(app, 'DemoSpec.Object001a', '#menu_select')
      await waitForOperation(app)
      let search = await searchRegex.inputValue()
      await expect(search).toBe('@id:TestDemoSpec.Object004$\nor @id:DemoSpec.Object001a$')

      await contextMenuClick(app, 'TestDemoSpec.Object004', '#menu_deselect')
      await waitForOperation(app)
      search = await searchRegex.inputValue()
      await expect(search).toBe('@id:DemoSpec.Object001a$')

      // remove last entry
      await contextMenuClick(app, 'DemoSpec.Object001a', '#menu_deselect')
      await waitForOperation(app)
      search = await searchRegex.inputValue()
      await expect(search).toBe('')
    })

    test('De-select two specobject - regex syntax', async () => {
      const searchRegex = await window.locator('#search_regex')
      await clickButton(window, '#clear_search_regex')
      await waitForOperation(app)
      await clickButton(window, '#regex_radio_input')
      await waitForOperation(app)
      await contextMenuClick(app, 'TestDemoSpec.Object004', '#menu_select')
      await waitForOperation(app)
      await contextMenuClick(app, 'DemoSpec.Object001a', '#menu_select')
      await waitForOperation(app)
      let search = await searchRegex.inputValue()
      await expect(search).toBe('TestDemoSpec.Object004$\n|DemoSpec.Object001a$')

      await contextMenuClick(app, 'TestDemoSpec.Object004', '#menu_deselect')
      await waitForOperation(app)
      search = await searchRegex.inputValue()
      await expect(search).toBe('DemoSpec.Object001a$')
    })

    test('Exclude two specobjects', async () => {
      await clickButton(window, '#clear_search_regex')
      await waitForOperation(app)
      const exclIds = await window.locator('#excluded_ids')
      await contextMenuClick(app, 'TestDemoSpec.Object002', '#menu_exclude')
      await waitForOperation(app)
      await contextMenuClick(app, 'TestDemoSpec.Object003', '#menu_exclude')
      await waitForOperation(app)
      let excl = await exclIds.inputValue()
      await expect(excl).toBe('TestDemoSpec.Object002\nTestDemoSpec.Object003')
    })
  })
})
