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
const after = global.after
// const beforeEach = global.beforeEach;
// const afterEach = global.afterEach;

// const file = chaiFiles.file
// const dir = chaiFiles.dir

function remove_file (path) {
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

function copy_file (filename_from, filename_to) {
  const main_txt = fs.readFileSync(filename_from, 'utf8')
  fs.writeFileSync(filename_to, main_txt)
}

async function compare_files (main_file, ref_file) {
  holdBeforeFileExists(main_file, 10000)
  const main_txt = eol.auto(fs.readFileSync(main_file, 'utf8'))
  const ref_txt = eol.auto(fs.readFileSync(ref_file, 'utf8'))
  assert.strictEqual(main_txt, ref_txt)
  return main_txt
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
    remove_file('./tmp/settings.json')
    copy_file('./test/refdata/settings.json', './tmp/cl-settings.json')
    remove_file('./tmp/cl-test-diagram.svg')
    remove_file('./tmp/cl-test-doctypes.svg')
    remove_file('./tmp/cl-test-safety.svg')
  })

  it('launch the application', async function () {
    app = new Application({
      path: electronPath,
      args: [path.join(__dirname, '..'),
        '--settDir', './tmp', //rq: ->(rq_cl_settings_file)
        '--settFile', 'cl-settings.json',
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
    // console.log("render logs", await app.client.getRenderProcessLogs())
    // console.log("main logs", await app.client.getMainProcessLogs())
  })

  it('Check program exit', async function () {
    if (app && await app.isRunning()) {
      await app.stop()
    }
  })

  it('Check specobject diagram', async function () {
    await compare_files('./tmp/cl-test-diagram.svg', './test/refdata/cl-test-diagram.svg') //rq: ->(rq_automatic_diagram)
  })

  it('Check hierarchy diagram', async function () {
    await compare_files('./tmp/cl-test-doctypes.svg', './test/refdata/cl-test-doctypes.svg')
  })

  it('Check safetyclass diagram', async function () {
    await compare_files('./tmp/cl-test-safety.svg', './test/refdata/cl-test-safety.svg')
  })

  async function appSuccess () {
    assert.strictEqual(app.isRunning(), true)
    chaiAsPromised.transferPromiseness = app.transferPromiseness

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
    await app.client.waitUntilTextExists('#vrm2_batch', 'done', {timeout: 20200})
  }

  function appFailure (reason) {
    console.log("promise onRejected", reason)
  }

})
