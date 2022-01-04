'use strict'
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
const chaiAsPromised = require('chai-as-promised')
const chaiRoughly = require('chai-roughly')
// const chaiFiles = require('chai-files')
const describe = global.describe
const it = global.it
const before = global.before
// const after = global.after
// const beforeEach = global.beforeEach;
// const afterEach = global.afterEach;

// const file = chaiFiles.file
// const dir = chaiFiles.dir

function removeFile (path) {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path)
  }
}

function holdBeforeFileExists (filePath, timeout) {
  timeout = timeout < 1000 ? 1000 : timeout
  return new Promise((resolve) => {
    const timer = setTimeout(function () {
      console.log("timeout", timeout, filePath)
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

function copyFile (filenameFrom, filenameTo) {
  const mainTxt = fs.readFileSync(filenameFrom, 'utf8')
  fs.writeFileSync(filenameTo, mainTxt)
}

async function compareFiles (mainFile, refFile) {
  holdBeforeFileExists(mainFile, 10000)
  const mainTxt = eol.auto(fs.readFileSync(mainFile, 'utf8'))
  const refTxt = eol.auto(fs.readFileSync(refFile, 'utf8'))
  assert.strictEqual(mainTxt, refTxt)
  return mainTxt
}

describe('command line processing', function () {
  this.timeout(120007)
  let app

  before(function () {
    chai.should()
    chai.use(chaiAsPromised)
    chai.use(chaiRoughly)
  })

  before(function () {
    mkdirp.sync('./tmp')
    removeFile('./tmp/settings.json')
    copyFile('./test/refdata/settings.json', './tmp/cl-settings.json')
    removeFile('./tmp/cl-test-diagram.svg')
    removeFile('./tmp/cl-test-doctypes.svg')
    removeFile('./tmp/cl-test-safety.svg')
  })

  it('bad filenames', async function () {
    app = new Application({
      path: electronPath,
      args: [path.join(__dirname, '..'),
        '--settDir', './tmp',
        '--settFile', 'cl-settings.json',
        '--regex',
        '--select', 'maze',
        '--exclIds', '"some_id,some_other_id"',
        '--exclDoctypes', '"foo,fie,fum"',
        '--diagram',
        '--hierarchy',
        '--safety',
        '--format', 'svg',
        '--output', 'tmp/cl-test',
        '--oreqm_main', './baddir/nosuchfile.oreqm',
        '--oreqm_ref', './testdata/thisdoesntexist.oreqm',
        '--quit'
      ],
      chromeDriverLogPath: path.join(__dirname, '..', './tmp/chromedriver-cl.log')
    })
    await app.start()
    // Check pameters read
    let exclid_field = await app.client.$('#excluded_ids')
    let exclids = await exclid_field.getValue()
    assert.ok(exclids.includes('some_id'))
    assert.ok(exclids.includes('some_other_id'))
    // Check empty main file (file not found)
    let main_file = await app.client.$('#name')
    let mf_content = await main_file.getHTML()
    assert.ok(mf_content.includes('></td>'))
    // Check empty ref file (file not found)
    let ref_file = await app.client.$('#ref_name')
    let ref_content = await ref_file.getHTML()
    assert.ok(ref_content.includes('></td>'))
    await app.stop()
  })

  it('launch the application', async function () {
    app = new Application({
      path: electronPath,
      args: [path.join(__dirname, '..'),
        '--settDir', './tmp', //rq: ->(rq_cl_settings_file)
        '--settFile', 'cl-settings.json',
        '--regex',
        '--select', 'maze',
        '--exclIds', '"some_id,some_other_id"',
        '--exclDoctypes', '"foo,fie,fum"',
        '--diagram',
        '--hierarchy',
        '--safety',
        '--format', 'svg',
        '--output', 'tmp/cl-test',
        '--oreqm_main', './testdata/oreqm_testdata_del_movement.oreqm', //rq: ->(rq_one_oreqm_cmd_line)
        '--oreqm_ref', './testdata/oreqm_testdata_no_ogre.oreqm' //rq: ->(rq_two_oreqm_cmd_line)
      ],
      chromeDriverLogPath: path.join(__dirname, '..', './tmp/chromedriver-cl.log')
    })
    fakeMenu.apply(app)
    fakeDialog.apply(app)

    await app.start().then(appSuccess, appFailure)
    await app.client.waitUntilTextExists('#vrm2_batch', 'done', {timeout: 20010})
    // Check main file
    let main_file = await app.client.$('#name')
    let mf_content = await main_file.getHTML()
    assert.ok(mf_content.includes('oreqm_testdata_del_movement.oreqm'))
    // Check ref file
    let ref_file = await app.client.$('#ref_name')
    let ref_content = await ref_file.getHTML()
    assert.ok(ref_content.includes('oreqm_testdata_no_ogre.oreqm'))
    await app.stop()
  })

  it('Check specobject diagram', async function () {
    await compareFiles('./tmp/cl-test-diagram.svg', './test/refdata/cl-test-diagram.svg') //rq: ->(rq_automatic_diagram)
  })

  it('Check hierarchy diagram', async function () {
    await compareFiles('./tmp/cl-test-doctypes.svg', './test/refdata/cl-test-doctypes.svg')
  })

  it('Check safetyclass diagram', async function () {
    await compareFiles('./tmp/cl-test-safety.svg', './test/refdata/cl-test-safety.svg')
  })

  it('Open vr2x file from cmd line', async function () {
    app = new Application({
      path: electronPath,
      args: [path.join(__dirname, '..'),
        '--settDir', './tmp',
        '--settFile', 'cl-settings.json',
        '--diagram',
        '--format', 'svg',
        '--output', 'tmp/cl-context',
        '--context', './testdata/test_context.vr2x'
      ],
      chromeDriverLogPath: path.join(__dirname, '..', './tmp/chromedriver-cl.log')
    })
    fakeMenu.apply(app)
    fakeDialog.apply(app)

    await app.start().then(appSuccess, appFailure)
    await app.client.waitUntilTextExists('#vrm2_batch', 'done', {timeout: 20010})
    // Check main file
    let main_file = await app.client.$('#name')
    let mf_content = await main_file.getHTML()
    assert.ok(mf_content.includes('oreqm_testdata_no_ogre.oreqm'))
    // Check ref file
    let ref_file = await app.client.$('#ref_name')
    let ref_content = await ref_file.getHTML()
    assert.ok(ref_content.includes('oreqm_testdata_del_movement.oreqm'))
    await app.stop()
  })

  it('Select vql from cmd line', async function () {
    app = new Application({
      path: electronPath,
      args: [path.join(__dirname, '..'),
        '--settDir', './tmp',
        '--settFile', 'cl-settings.json',
        '--oreqm_main', './testdata/oreqm_testdata_del_movement.oreqm',
        '--vql',
        '--format', 'svg'
      ],
      chromeDriverLogPath: path.join(__dirname, '..', './tmp/chromedriver-cl.log')
    })
    fakeMenu.apply(app)
    fakeDialog.apply(app)

    await app.start().then(appSuccess, appFailure)
    let vql_radio = await app.client.$('#vql_radio_input')
    let vql_value = await vql_radio.isSelected()
    assert.ok(vql_value)
    await app.stop()
  })

  it('Select idOnly from cmd line', async function () {
    app = new Application({
      path: electronPath,
      args: [path.join(__dirname, '..'),
        '--settDir', './tmp',
        '--settFile', 'cl-settings.json',
        '--idOnly',
        '--format', 'svg'
      ],
      chromeDriverLogPath: path.join(__dirname, '..', './tmp/chromedriver-cl.log')
    })
    fakeMenu.apply(app)
    fakeDialog.apply(app)

    await app.start().then(appSuccess, appFailure)
    let id_radio = await app.client.$('#id_radio_input')
    let id_value = await id_radio.isSelected()
    assert.ok(id_value)
    await app.stop()
  })

  async function appSuccess () {
    assert.strictEqual(app.isRunning(), true)
    chaiAsPromised.transferPromiseness = app.transferPromiseness

    const response = await app.client.getWindowHandles()
    // With progress bar window added, two windows may get reported
    assert.isTrue(response.length >= 1)

    await app.browserWindow
    .getBounds()
    .should.eventually.roughly(5)
    .deep.equal({
      x: 25,
      y: 35,
      width: 200,
      height: 100
    })
    await app.client.waitUntilTextExists('#vrm2_batch', 'done', {timeout: 20200})
  }

  function appFailure (reason) {
    console.log("promise onRejected", reason)
  }

})
