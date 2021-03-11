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

describe('command line processing', function () {
  this.timeout(10000)
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
      args: [path.join(__dirname, '..'),
        '--settDir', './test/refdata',
        '--settFile', 'settings.json',
        '--select', 'maze',
        '--exclIds', '"some_id,some_other_id"',
        '--exclDoctypes', '"foo,fie,fum"',
        '--diagram',
        '--hierarchy',
        '--safety',
        '--format', 'svg',
        '--output', 'tmp/cl-test',
        '--oreqm_main', './testdata/oreqm_testdata_del_movement.oreqm',
        '--oreqm_ref', './testdata/oreqm_testdata_no_ogre.oreqm'
      ],
      chromeDriverLogPath: path.join(__dirname, '..', './tmp/chromedriver-cl.log')
    })
    fakeMenu.apply(app)
    fakeDialog.apply(app)
    return app.start().then(function () {
      assert.strictEqual(app.isRunning(), true)
      chaiAsPromised.transferPromiseness = app.transferPromiseness
    })
  })

  after(async function () {
    await compare_files('./tmp/cl-test-diagram.svg', './test/refdata/cl-test-diagram.svg')
    await compare_files('./tmp/cl-test-doctypes.svg', './test/refdata/cl-test-doctypes.svg')
    await compare_files('./tmp/cl-test-safety.svg', './test/refdata/cl-test-safety.svg')
    if (app && await app.isRunning()) {
      return await app.stop()
    }
  })

  it('launch the application', async function () {
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
    // await app.client.waitUntilTextExists('html', 'ReqM2')
    // assert.strictEqual(await app.client.getTitle(), 'Visual ReqM2')
    await app.client.waitUntilTextExists('#vrm2_batch', 'done')
  })

})
