'use strict'
const { _electron: electron } = require('playwright');
const { test, expect } = require('@playwright/test');
const electronPath = require('electron')
const mkdirp = require('mkdirp')
const fs = require('fs')
const eol = require('eol')
const v4 = require('uuid')

let window, app

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
  await expect(mainTxt).toBe(refTxt)
  return mainTxt
}

async function waitVrm2Ready () {
  const vrm2_batch = window.locator('id=vrm2_batch')
  await expect(vrm2_batch).not.toHaveText('btc', {timeout: 8000})
}

async function waitVrm2Done () {
  const vrm2_batch = window.locator('id=vrm2_batch')
  await expect(vrm2_batch).toHaveText('done', {timeout: 8000})
}

test.afterAll(async () => {
  // console.log('afterAll')
  // const coverage = await window.coverage.stopJSCoverage();
  // for (const entry of coverage) {
  //   console.dir(entry)
  //   //let name = `.nyc_output/${v4()}.json`
  //   //const converter = new v8toIstanbul('', 0, { source: entry.source });
  //   //await converter.load();
  //   //converter.applyCoverage(entry.functions);
  //   //console.log('electron.spec', name)
  //   //fs.writeFileSync(name, JSON.stringify(JSON.stringify(converter.toIstanbul())));
  // }
})

test.afterEach(async ({page}, testInfo) => {
  // console.log(`closing ${testInfo.title}`)
  // const coverage = await window.coverage.stopJSCoverage();
  // for (const entry of coverage) {
  //   let name = `.nyc_output/cl-${v4()}.json`
  //   console.log('electron.spec', name)
  //   console.dir(entry.functions)
  //   fs.writeFileSync(name, JSON.stringify(entry.functions));
  // }
  await page.close()
})

test.describe('command line processing', () => {

  test.beforeAll(async () => {
    mkdirp.sync('./tmp')
    removeFile('./tmp/settings.json')
    copyFile('./test/refdata/settings.json', './tmp/cl-settings.json')
    removeFile('./tmp/cl-test-diagram.svg')
    removeFile('./tmp/cl-test-doctypes.svg')
    removeFile('./tmp/cl-test-safety.svg')
  })

  test('bad filenames', async () => {
    //rq: ->(rq_cl_settings_file)
    app = await electron.launch({
      path: electronPath,
      args: ['lib/main.js',
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
      ]
    })

    /*
    // Evaluation expression in the Electron context.
    const appPath = await app.evaluate(async ({ app }) => {
      // This runs in the main Electron process, parameter here is always
      // the result of the require('electron') in the main app script.
      return app.getAppPath();
    });
    //console.log(appPath);
    */

    // Get the first window that the app opens, wait if necessary.
    window = await app.firstWindow();
    await window.coverage.startJSCoverage({reportAnonymousScripts: true});

    // Check cmd line parameters have been read
    await waitVrm2Ready()
    let exclids = await window.locator('id=excluded_ids').inputValue()
    await expect(exclids.includes('some_id')).toBeTruthy()
    await expect(exclids.includes('some_other_id')).toBeTruthy()

    // Check empty main file (file not found)
    await expect(await window.locator('id=name').innerHTML()).toBe('')
    // Check empty ref file (file not found)
    await expect(await window.locator('#ref_name').innerHTML()).toBe('')
  })

  test('launch the application', async () => {
    app = await electron.launch({
      path: electronPath,
      args: ['lib/main.js',
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
      ]
    })

    window = await app.firstWindow();
    await window.coverage.startJSCoverage({reportAnonymousScripts: true});
    await waitVrm2Ready()
    // Check main file
    await expect((await window.locator('id=name').innerHTML()).includes('./testdata/oreqm_testdata_del_movement.oreqm')).toBe(true)
    // Check ref file
    await expect((await window.locator('#ref_name').innerHTML())).toBe('./testdata/oreqm_testdata_no_ogre.oreqm')
    // Wait for operations from command line to complete
    await waitVrm2Done()
    //test('Check specobject diagram', async () => {
    await compareFiles('./tmp/cl-test-diagram.svg', './test/refdata/cl-test-diagram.svg') //rq: ->(rq_automatic_diagram)
    //test('Check hierarchy diagram', async () => {
    await compareFiles('./tmp/cl-test-doctypes.svg', './test/refdata/cl-test-doctypes.svg')
    // test('Check safetyclass diagram', async () => {
    await compareFiles('./tmp/cl-test-safety.svg', './test/refdata/cl-test-safety.svg')
  })

  test('Open vr2x file from cmd line', async () => {
    app = await electron.launch({
      path: electronPath,
      args: ['lib/main.js',
        '--settDir', './tmp',
        '--settFile', 'cl-settings.json',
        '--diagram',
        '--format', 'svg',
        '--output', 'tmp/cl-context',
        '--context', './testdata/test_context.vr2x'
      ]
    })

    window = await app.firstWindow();
    await window.coverage.startJSCoverage({reportAnonymousScripts: true});
    await waitVrm2Done()
    // Check main file
    await expect((await window.locator('id=name').innerHTML()).includes('oreqm_testdata_no_ogre')).toBe(true)
    // Check ref file
    await expect((await window.locator('id=ref_name').innerHTML()).includes('oreqm_testdata_del_movement')).toBe(true)
  })

  test('Open non-existing vr2x file from cmd line', async () => {
    app = await electron.launch({
      path: electronPath,
      args: ['lib/main.js',
        '--settDir', './tmp',
        '--settFile', 'cl-settings.json',
        '--context', './testdata/thisdoesnotexist.vr2x'
      ]
    })

    window = await app.firstWindow();
    await window.coverage.startJSCoverage({reportAnonymousScripts: true});
    await waitVrm2Done()
    // Check main file
    await expect(await window.locator('id=name').innerHTML()).toBe('')
    // Check ref file
    await expect(await window.locator('id=ref_name').innerHTML()).toBe('')
  })

  test('Select vql from cmd line', async () => {
    app = await electron.launch({
      path: electronPath,
      args: ['lib/main.js',
        '--settDir', './tmp',
        '--settFile', 'cl-settings.json',
        '--oreqm_main', './testdata/oreqm_testdata_del_movement.oreqm',
        '--vql',
        '--format', 'svg'
      ]
    })

    window = await app.firstWindow();
    await window.coverage.startJSCoverage({reportAnonymousScripts: true});
    await waitVrm2Done()
    await expect(window.locator('#vql_radio_input')).toBeChecked()
  })

  test('Select idOnly from cmd line', async () => {
    app = await electron.launch({
      path: electronPath,
      args: ['lib/main.js',
        '--settDir', './tmp',
        '--settFile', 'cl-settings.json',
        '--idOnly',
        '--format', 'svg'
      ]
    })

    window = await app.firstWindow();
    await window.coverage.startJSCoverage({reportAnonymousScripts: true});
    await waitVrm2Done()
    await expect(window.locator('#id_radio_input')).toBeChecked()
  })

})
