'use strict'

const { test, expect } = require('@playwright/test');
const settings = _interopRequireDefault(require('../lib/settings.js'))
const ReqM2Oreqm = _interopRequireDefault(require('../lib/diagrams.js'))
const color = _interopRequireDefault(require('../lib/color.js'))
const fs = require('fs')
const eol = require('eol')
const mkdirp = require('mkdirp')

// Provide DOMParser for testing
const jsdom = require('jsdom')
const { JSDOM } = jsdom
global.DOMParser = new JSDOM().window.DOMParser

function _interopRequireDefault (obj) {
  return obj && obj.__esModule ? obj : { default: obj }
}

function alert (txt) {
  console.log(txt)
}

global.alert = alert

function selectAll (_nodeId, rec, _nodeColor) {
  // Select all - no need to inspect input
  return rec.status !== 'rejected'
}

test.beforeAll(async () => {
  mkdirp.sync('./tmp')
})

test.beforeEach(async () => {
  color.loadColorsFs(null, './test/refdata/test_suite_palette.json')
})

test.describe('ReqM2Oreqm tests', () => {
  // force default settings
  settings.checkAndUpgradeSettings(settings.defaultProgramSettings)

  const testOreqmFileName = './testdata/oreqm_testdata_del_movement.oreqm'
  const oreqmTxt = fs.readFileSync(testOreqmFileName) //rq: ->(rq_read_oreqm)
  const oreqm = new ReqM2Oreqm.ReqM2Oreqm(
    testOreqmFileName,
    oreqmTxt,
    [],
    []
  )

  test('Verify no doctypes blocked', async () => {
    // console.log(oreqm.excludedDoctypes);
    expect(oreqm.filename).toBe(testOreqmFileName)
  })

  test('Create instance', async () => {
    expect(oreqm.getExcludedDoctypes().length === 0).toBeTruthy()
  })

  test('Finds reqs', async () => {
    const matches = oreqm.findReqsWithText('maze')
    // console.log(matches)
    //rq: ->(rq_sel_txt)
    expect(matches.includes('cc.game.location.maze.1')).toBeTruthy()
    expect(matches.includes('cc.game.location.maze.2')).toBeTruthy()
    expect(matches.includes('cc.game.location.maze.3')).toBeTruthy()
    expect(matches.includes('cc.game.location.maze.4')).toBeTruthy()
    expect(matches.includes('cc.game.location.maze.5')).toBeTruthy()
    expect(matches.includes('cc.game.location.maze.7')).toBeTruthy()
    expect(matches.includes('cc.game.location.maze.8')).toBeTruthy()
    expect(matches.includes('cc.game.location.maze.9')).toBeTruthy()
  })

  test('Create dot graph', async () => {
    const graph = oreqm.createGraph(
      selectAll,
      [],
      'A test title',
      [],
      1000,
      true,
      true
    )
    // console.log(graph);
    expect(
      graph.doctypeDict.get('swrs').includes('cc.game.location.westlands')
    )
    expect(graph.nodeCount).toBe(26)
    expect(graph.edgeCount).toBe(25)
  })

  test('Check generated dot string', async () => {
    const dotStr = eol.auto(oreqm.getDot())
    fs.writeFileSync('tmp/dot_file_1_test.dot', dotStr, {
      encoding: 'utf8',
      flag: 'w'
    })
    // console.dir(expect(dotStr))
    const dotRef = eol.auto(
      fs.readFileSync('./test/refdata/dot_file_1_test.dot', 'utf8')
    )
    expect(dotStr).toBe(dotRef) //rq: ->(rq_dot,rq_no_sel_show_all,rq_show_dot)
  })

  test('check pseudo needsobj for fulfilledby', async () => {
    const dotStr = eol.auto(oreqm.getDot())
    expect(dotStr.includes('vaporware*')).toBeTruthy() //rq: ->(rq_ffb_needsobj)
  })

  test('doctype filtering', async () => {
    const matches = oreqm.findReqsWithText('PLACEHOLDER')
    expect(matches.includes('zork.game.location.frobozz'))
    //rq: ->(rq_ffb_placeholder)
    expect(oreqm.requirements.get('zork.game.location.frobozz').doctype).toBe('vaporware')
    // Now exclude this doctype
    oreqm.setExcludedDoctypes(['vaporware'])
    oreqm.createGraph(selectAll, [], 'A test title', [], 1000, true, true)
    //rq: ->(rq_sel_doctype)
    expect(oreqm.getDot().indexOf('zork.game.location.frobozz')).toBe(-1)
    // node id absent from file
    oreqm.setExcludedDoctypes([])
  })

  test('Create hierarchy diagram', async () => {
    const hierarchy = eol.auto(oreqm.scanDoctypes(false))
    expect(hierarchy.includes('digraph')).toBeTruthy()

    fs.writeFileSync('tmp/dot_file_hierarchy_test.dot', hierarchy, {
      encoding: 'utf8',
      flag: 'w'
    })
    const dotRef = eol.auto(
      fs.readFileSync('./test/refdata/dot_file_hierarchy_test.dot', 'utf8')
    )
    expect(hierarchy).toBe(dotRef)
  })

  test('Create safety diagram', async () => {
    const safety = eol.auto(oreqm.scanDoctypes(true))
    expect(safety.includes('digraph')).toBeTruthy()

    fs.writeFileSync('tmp/dot_file_safety_test.dot', safety, {
      encoding: 'utf8',
      flag: 'w'
    })
    const dotRef = eol.auto(
      fs.readFileSync('./test/refdata/dot_file_safety_test.dot', 'utf8')
    )
    expect(safety).toBe(dotRef)
  })

})