'use strict'

const { test, expect } = require('@playwright/test');
const ReqM2Specobjects = _interopRequireDefault(
  require('../lib/reqm2oreqm.js')
)
const vqlSearch = _interopRequireDefault(require('../lib/vql-search'))
const fs = require('fs')
const jsdom = require('jsdom')
const { JSDOM } = jsdom
global.DOMParser = new JSDOM().window.DOMParser

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

test.describe('vql-search tests', () => {
  //rq: ->(rq_query_language)
  const testOreqmFileName = './testdata/oreqm_testdata_del_movement.oreqm'
  const oreqmTxt = fs.readFileSync(testOreqmFileName)
  const oreqm = new ReqM2Specobjects.ReqM2Specobjects(
    testOreqmFileName,
    oreqmTxt,
    [],
    []
  )

  test('VQL validate bad expression', async () => {
    let validation = vqlSearch.vqlValidate('or is not a proper way to start a VQL search')
    expect(validation && (validation.length > 0) && validation.includes('Syntax')).toBeTruthy()
  })

  test('VQL parse bad expression', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, 'or is not a proper way to start a VQL search')
    expect(nodes === null).toBeTruthy()
  })

  test('VQL parse incomplete expression', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, 'foo and')
    expect(nodes === null).toBeTruthy()
  })

  test('VQL parse expr 1', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, 'foo and bar')
    expect(nodes.has('cc.game.location.grate')).toBeTruthy()
    expect(nodes.has('/home/foo/bar/baz/fie/impl/pirate.hpp_15')).toBeTruthy()
    expect(nodes.size === 2).toBeTruthy()
  })

  test('VQL parse expr 2', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, 'ao( de:twisting, dt:fea )')
    expect(nodes.has('cc.game.locations')).toBeTruthy()
    expect(nodes.has('cc.game.overview')).toBeTruthy()
    expect(nodes.size === 2).toBeTruthy()
  })

  test('VQL parse expr 2a', async () => {
    //rq: ->(rq_vql_ancestors)
    let nodes = vqlSearch.vqlParse(oreqm, 'an( de:twisting, dt:fea )')
    expect(nodes.has('cc.game.locations')).toBeTruthy()
    expect(nodes.has('cc.game.overview')).toBeTruthy()
    expect(nodes.size === 2).toBeTruthy()
  })

  test('VQL parse expr 2c', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, 'ancestors( de:twisting, dt:fea )')
    expect(nodes.has('cc.game.locations')).toBeTruthy()
    expect(nodes.has('cc.game.overview')).toBeTruthy()
    expect(nodes.size === 2).toBeTruthy()
  })

  test('VQL parse expr 3', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, 'sc:qm de:pirate dt:swrs')
    expect(nodes.has('cc.game.character.pirate')).toBeTruthy()
    expect(nodes.size === 1).toBeTruthy()
  })

  test('VQL parse expr 4', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, 'dt:*ware')
    expect(nodes.has('zork.game.location.frobozz')).toBeTruthy()
    expect(nodes.size === 1).toBeTruthy()
  })

  test('VQL parse expr 5', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, 'de:^\\*')
    expect(nodes.has('zork.game.location.frobozz')).toBeTruthy()
    expect(nodes.size === 1).toBeTruthy()
  })

  test('VQL parse expr 6', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, 'dt:xyzzy nottobefound')
    expect(nodes.size === 0).toBeTruthy()
  })

  test('VQL parse expr 7', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, '(   dt:xyzzy   )')
    expect(nodes.size === 0).toBeTruthy()
  })

  test('VQL parse expr 8', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, '"de:Witt\'s end"')
    expect(nodes.has('cc.game.location.witt')).toBeTruthy()
    expect(nodes.has('cc.game.locations')).toBeTruthy()
    expect(nodes.size === 2).toBeTruthy()
  })

  test('VQL parse expr 9', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, '\'Proceed at own risk\'')
    expect(nodes.has('cc.game.overview')).toBeTruthy()
    expect(nodes.size === 1).toBeTruthy()
  })

  test('VQL parse expr 10', async () => {
    //rq: ->(rq_vql_children)
    let nodes = vqlSearch.vqlParse(oreqm, 'ch( cc.game.locations, maze )')
    expect(nodes.has('cc.game.location.maze')).toBeTruthy()
    expect(nodes.size === 1).toBeTruthy()
  })

  test('VQL parse expr 10a', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, 'children( cc.game.locations, maze )')
    expect(nodes.has('cc.game.location.maze')).toBeTruthy()
    expect(nodes.size === 1).toBeTruthy()
  })

  test('VQL parse expr 11', async () => {
    //rq: ->(rq_vql_parents)
    let nodes = vqlSearch.vqlParse(oreqm, 'pa( id:cc.game.location.maze.7, maze )')
    expect(nodes.has('cc.game.location.maze')).toBeTruthy()
    expect(nodes.size === 1).toBeTruthy()
  })

  test('VQL parse expr 11a', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, 'parents( id:cc.game.location.maze.7, maze )')
    expect(nodes.has('cc.game.location.maze')).toBeTruthy()
    expect(nodes.size === 1).toBeTruthy()
  })

  test('VQL parse expr 12', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, 'co( id:cc.game.locations, . )')
    expect(nodes.has('cc.game.location.maze')).toBeTruthy()
    expect(nodes.size === 16).toBeTruthy()
  })

  test('VQL parse expr 13', async () => {
    //rq: ->(rq_vql_descendants)
    let nodes = vqlSearch.vqlParse(oreqm, 'de( id:cc.game.locations, . )')
    expect(nodes.has('cc.game.location.maze')).toBeTruthy()
    expect(nodes.size === 16).toBeTruthy()
  })

  test('VQL parse expr 13a', async () => {
    let nodes = vqlSearch.vqlParse(oreqm, 'descendants( id:cc.game.locations, . )')
    expect(nodes.has('cc.game.location.maze')).toBeTruthy()
    expect(nodes.size === 16).toBeTruthy()
  })

})
