'use strict'

const ReqM2Specobjects = _interopRequireDefault(
  require('../lib/reqm2oreqm.js')
)
const assert = require('assert')
const fs = require('fs')
const jsdom = require('jsdom')
const { JSDOM } = jsdom
global.DOMParser = new JSDOM().window.DOMParser

const describe = global.describe
const it = global.it

function _interopRequireDefault (obj) {
  return obj && obj.__esModule ? obj : { default: obj }
}

let alertMsg = ''
function simpleAlert (msg) {
  //console.log('simpleAlert:', msg, '\nend simpleAlert')
  alertMsg = msg.toString()
}

// Override popup alert
global.alert = simpleAlert

describe('ReqM2Specobjects tests', function () {
  const testOreqmFileName = './testdata/oreqm_testdata_del_movement.oreqm'
  const oreqmTxt = fs.readFileSync(testOreqmFileName)
  const oreqm = new ReqM2Specobjects.ReqM2Specobjects(
    testOreqmFileName,
    oreqmTxt,
    [],
    []
  )

  it('Create instance', function () {
    assert.strictEqual(oreqm.filename, testOreqmFileName)
  })

  it('Finds reqs', function () {
    const matches = oreqm.findReqsWithText('maze')
    // console.log(matches)
    assert.ok(matches.includes('cc.game.location.maze.1'))
    assert.ok(matches.includes('cc.game.location.maze.2'))
    assert.ok(matches.includes('cc.game.location.maze.3'))
    assert.ok(matches.includes('cc.game.location.maze.4'))
    assert.ok(matches.includes('cc.game.location.maze.5'))
  })
})

describe('Bad oreqm file', function () {
  it('Load bad oreqm file', async function () {
    alertMsg = ''
    ReqM2Specobjects.setAlert(simpleAlert)
    const filename = './testdata/bad_file.oreqm'
    const oreqmTxt = fs.readFileSync(filename)
    const oreqm = new ReqM2Specobjects.ReqM2Specobjects(
      filename,
      oreqmTxt,
      [],
      []
    )
    assert.ok(!oreqm.getErrorStatusOK())
    assert.ok(oreqm.getErrorMsg().length > 0)
    //console.log("error message:", oreqm.getErrorMsg())
  })
})