'use strict'

const ReqM2Specobjects = _interopRequireDefault(
  require('../lib/reqm2oreqm.js')
)
const vql_search = _interopRequireDefault(require('../lib/vql-search'))
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

function simple_alert (msg) {
  console.log(msg)
}

// Override popup alert
global.alert = simple_alert

/**
 * To test VQL parser we need to load an oreqm file because the doctypes
 * present are used in the checks.
 */

describe('vql-search tests', function () {
  const test_oreqm_file_name = './testdata/oreqm_testdata_del_movement.oreqm'
  const oreqm_txt = fs.readFileSync(test_oreqm_file_name)
  const oreqm = new ReqM2Specobjects.ReqM2Specobjects(
    test_oreqm_file_name,
    oreqm_txt,
    [],
    []
  )

  it('VQL validate bad expression', function () {
    let validation = vql_search.vql_validate('or is not a proper way to start a VQL search')
    assert(validation && (validation.length > 0) && validation.includes('Syntax'))
  })

  it('VQL parse bad expression', function () {
    let nodes = vql_search.vql_parse(oreqm, 'or is not a proper way to start a VQL search')
    assert(nodes === null)
  })

  it('VQL parse incomplete expression', function () {
    let nodes = vql_search.vql_parse(oreqm, 'foo and')
    assert(nodes === null)
  })

  it('VQL parse expr 1', function () {
    let nodes = vql_search.vql_parse(oreqm, 'foo and bar')
    assert(nodes.has('cc.game.location.grate'))
    assert(nodes.has('/home/foo/bar/baz/fie/impl/pirate.hpp_15'))
    assert(nodes.size === 2)
  })

  it('VQL parse expr 2', function () {
    let nodes = vql_search.vql_parse(oreqm, 'ao( de:twisting, dt:fea )')
    assert(nodes.has('cc.game.locations'))
    assert(nodes.has('cc.game.overview'))
    assert(nodes.size === 2)
  })

  it('VQL parse expr 3', function () {
    let nodes = vql_search.vql_parse(oreqm, 'sc:qm de:pirate dt:swrs')
    assert(nodes.has('cc.game.character.pirate'))
    assert(nodes.size === 1)
  })

  it('VQL parse expr 4', function () {
    let nodes = vql_search.vql_parse(oreqm, 'dt:*ware')
    assert(nodes.has('zork.game.location.frobozz'))
    assert(nodes.size === 1)
  })

  it('VQL parse expr 5', function () {
    let nodes = vql_search.vql_parse(oreqm, 'de:^\\*')
    assert(nodes.has('zork.game.location.frobozz'))
    assert(nodes.size === 1)
  })

  it('VQL parse expr 6', function () {
    let nodes = vql_search.vql_parse(oreqm, 'dt:xyzzy nottobefound')
    assert(nodes.size === 0)
  })

})