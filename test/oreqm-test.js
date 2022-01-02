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

function simpleAlert (msg) {
  console.log(msg)
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
