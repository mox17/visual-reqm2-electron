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
  //rq: ->(rq_query_language)
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

  it('VQL parse expr 2a', function () {
    //rq: ->(rq_vql_ancestors)
    let nodes = vqlSearch.vqlParse(oreqm, 'an( de:twisting, dt:fea )')
    assert(nodes.has('cc.game.locations'))
    assert(nodes.has('cc.game.overview'))
    assert(nodes.size === 2)
  })

  it('VQL parse expr 2c', function () {
    let nodes = vqlSearch.vqlParse(oreqm, 'ancestors( de:twisting, dt:fea )')
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

  it('VQL parse expr 8', function () {
    let nodes = vqlSearch.vqlParse(oreqm, '"de:Witt\'s end"')
    assert(nodes.has('cc.game.location.witt'))
    assert(nodes.has('cc.game.locations'))
    assert(nodes.size === 2)
  })

  it('VQL parse expr 9', function () {
    let nodes = vqlSearch.vqlParse(oreqm, '\'Proceed at own risk\'')
    assert(nodes.has('cc.game.overview'))
    assert(nodes.size === 1)
  })

  it('VQL parse expr 10', function () {
    //rq: ->(rq_vql_children)
    let nodes = vqlSearch.vqlParse(oreqm, 'ch( cc.game.locations, maze )')
    assert(nodes.has('cc.game.location.maze'))
    assert(nodes.size === 1)
  })

  it('VQL parse expr 10a', function () {
    let nodes = vqlSearch.vqlParse(oreqm, 'children( cc.game.locations, maze )')
    assert(nodes.has('cc.game.location.maze'))
    assert(nodes.size === 1)
  })

  it('VQL parse expr 11', function () {
    //rq: ->(rq_vql_parents)
    let nodes = vqlSearch.vqlParse(oreqm, 'pa( id:cc.game.location.maze.7, maze )')
    assert(nodes.has('cc.game.location.maze'))
    assert(nodes.size === 1)
  })

  it('VQL parse expr 11a', function () {
    let nodes = vqlSearch.vqlParse(oreqm, 'parents( id:cc.game.location.maze.7, maze )')
    assert(nodes.has('cc.game.location.maze'))
    assert(nodes.size === 1)
  })

  it('VQL parse expr 12', function () {
    let nodes = vqlSearch.vqlParse(oreqm, 'co( id:cc.game.locations, . )')
    assert(nodes.has('cc.game.location.maze'))
    assert(nodes.size === 16)
  })

  it('VQL parse expr 13', function () {
    //rq: ->(rq_vql_descendants)
    let nodes = vqlSearch.vqlParse(oreqm, 'de( id:cc.game.locations, . )')
    assert(nodes.has('cc.game.location.maze'))
    assert(nodes.size === 16)
  })

  it('VQL parse expr 13a', function () {
    let nodes = vqlSearch.vqlParse(oreqm, 'descendants( id:cc.game.locations, . )')
    assert(nodes.has('cc.game.location.maze'))
    assert(nodes.size === 16)
  })

})