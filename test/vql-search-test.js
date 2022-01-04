'use strict'

const ReqM2Specobjects = _interopRequireDefault(
  require('../lib/reqm2oreqm.js')
)
const vqlSearch = _interopRequireDefault(require('../lib/vql-search'))
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

/**
 * To test VQL parser we need to load an oreqm file because the doctypes
 * present are used in the checks.
 */

describe('vql-search tests', function () {
  const testOreqmFileName = './testdata/oreqm_testdata_del_movement.oreqm'
  const oreqmTxt = fs.readFileSync(testOreqmFileName)
  const oreqm = new ReqM2Specobjects.ReqM2Specobjects(
    testOreqmFileName,
    oreqmTxt,
    [],
    []
  )

  it('VQL validate bad expression', function () {
    let validation = vqlSearch.vqlValidate('or is not a proper way to start a VQL search')
    assert(validation && (validation.length > 0) && validation.includes('Syntax'))
  })

  it('VQL parse bad expression', function () {
    let nodes = vqlSearch.vqlParse(oreqm, 'or is not a proper way to start a VQL search')
    assert(nodes === null)
  })

  it('VQL parse incomplete expression', function () {
    let nodes = vqlSearch.vqlParse(oreqm, 'foo and')
    assert(nodes === null)
  })

  it('VQL parse expr 1', function () {
    let nodes = vqlSearch.vqlParse(oreqm, 'foo and bar')
    assert(nodes.has('cc.game.location.grate'))
    assert(nodes.has('/home/foo/bar/baz/fie/impl/pirate.hpp_15'))
    assert(nodes.size === 2)
  })

  it('VQL parse expr 2', function () {
    let nodes = vqlSearch.vqlParse(oreqm, 'ao( de:twisting, dt:fea )')
    assert(nodes.has('cc.game.locations'))
    assert(nodes.has('cc.game.overview'))
    assert(nodes.size === 2)
  })

  it('VQL parse expr 3', function () {
    let nodes = vqlSearch.vqlParse(oreqm, 'sc:qm de:pirate dt:swrs')
    assert(nodes.has('cc.game.character.pirate'))
    assert(nodes.size === 1)
  })

  it('VQL parse expr 4', function () {
    let nodes = vqlSearch.vqlParse(oreqm, 'dt:*ware')
    assert(nodes.has('zork.game.location.frobozz'))
    assert(nodes.size === 1)
  })

  it('VQL parse expr 5', function () {
    let nodes = vqlSearch.vqlParse(oreqm, 'de:^\\*')
    assert(nodes.has('zork.game.location.frobozz'))
    assert(nodes.size === 1)
  })

  it('VQL parse expr 6', function () {
    let nodes = vqlSearch.vqlParse(oreqm, 'dt:xyzzy nottobefound')
    assert(nodes.size === 0)
  })

  it('VQL parse expr 7', function () {
    let nodes = vqlSearch.vqlParse(oreqm, '(   dt:xyzzy   )')
    assert(nodes.size === 0)
  })

})