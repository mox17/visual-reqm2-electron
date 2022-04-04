'use strict'

const { test, expect } = require('@playwright/test');
const ReqM2Specobjects = _interopRequireDefault(
  require('../lib/reqm2oreqm.js')
)
const fs = require('fs')
const jsdom = require('jsdom')
const { JSDOM } = jsdom
global.DOMParser = new JSDOM().window.DOMParser
global.__myAlertMsg = ''

function _interopRequireDefault (obj) {
  return obj && obj.__esModule ? obj : { default: obj }
}

global.__myAlertMsg = ''
function simpleAlert (msg) {
  //console.log('simpleAlert:', msg, '\nend simpleAlert')
  global.__myAlertMsg = msg.toString()
}

// Override popup alert
global.alert = simpleAlert

test.describe('ReqM2Specobjects tests', () => {
  const testOreqmFileName = './testdata/oreqm_testdata_del_movement.oreqm'
  const oreqmTxt = fs.readFileSync(testOreqmFileName)
  const oreqm = new ReqM2Specobjects.ReqM2Specobjects(
    testOreqmFileName,
    oreqmTxt,
    [],
    []
  )

  test('Create instance', async () => {
    expect(oreqm.filename).toBe(testOreqmFileName)
  })

  test('Finds reqs', async () => {
    const matches = oreqm.findReqsWithText('maze')
    // console.log(matches)
    expect(matches.includes('cc.game.location.maze.1')).toBeTruthy()
    expect(matches.includes('cc.game.location.maze.2')).toBeTruthy()
    expect(matches.includes('cc.game.location.maze.3')).toBeTruthy()
    expect(matches.includes('cc.game.location.maze.4')).toBeTruthy()
    expect(matches.includes('cc.game.location.maze.5')).toBeTruthy()
  })
})

test.describe('Bad oreqm file', () => {
  test('Load bad oreqm file', async () => {
    global.__myAlertMsg = ''
    ReqM2Specobjects.setAlert(simpleAlert)
    const filename = './testdata/bad_file.oreqm'
    const oreqmTxt = fs.readFileSync(filename)
    const oreqm = new ReqM2Specobjects.ReqM2Specobjects(
      filename,
      oreqmTxt,
      [],
      []
    )
    expect(!oreqm.getErrorStatusOK()).toBeTruthy()
    expect(oreqm.getErrorMsg().length > 0).toBeTruthy()
    //console.log("error message:", oreqm.getErrorMsg())
  })
})