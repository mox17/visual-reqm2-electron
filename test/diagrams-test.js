'use strict'

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

const chai = require('chai')
const assert = chai.assert // Using Assert style
const expect = chai.expect // Using Expect style
// var should = chai.should(); // Using Should style

function alert (txt) {
  console.log(txt)
}

global.alert = alert
const describe = global.describe
const it = global.it
const before = global.before
// const after = global.after;
const beforeEach = global.beforeEach
// const afterEach = global.afterEach;

function selectAll (_nodeId, rec, _nodeColor) {
  // Select all - no need to inspect input
  return rec.status !== 'rejected'
}

before(function () {
  mkdirp.sync('./tmp')
})

beforeEach(function () {
  color.loadColorsFs(null, './test/refdata/test_suite_palette.json')
})

describe('ReqM2Oreqm tests', function () {
  // force default settings
  settings.checkAndUpgradeSettings(settings.defaultProgramSettings, null)

  const testOreqmFileName = './testdata/oreqm_testdata_del_movement.oreqm'
  const oreqmTxt = fs.readFileSync(testOreqmFileName) //rq: ->(rq_read_oreqm)
  const oreqm = new ReqM2Oreqm.ReqM2Oreqm(
    testOreqmFileName,
    oreqmTxt,
    [],
    []
  )

  it('Verify no doctypes blocked', function () {
    // console.log(oreqm.excludedDoctypes);
    assert.strictEqual(oreqm.filename, testOreqmFileName)
  })

  it('Create instance', function () {
    assert.ok(oreqm.getExcludedDoctypes().length === 0)
  })

  it('Finds reqs', function () {
    const matches = oreqm.findReqsWithText('maze')
    // console.log(matches)
    //rq: ->(rq_sel_txt)
    assert.ok(matches.includes('cc.game.location.maze.1'))
    assert.ok(matches.includes('cc.game.location.maze.2'))
    assert.ok(matches.includes('cc.game.location.maze.3'))
    assert.ok(matches.includes('cc.game.location.maze.4'))
    assert.ok(matches.includes('cc.game.location.maze.5'))
    assert.ok(matches.includes('cc.game.location.maze.7'))
    assert.ok(matches.includes('cc.game.location.maze.8'))
    assert.ok(matches.includes('cc.game.location.maze.9'))
  })

  it('Create dot graph', function () {
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
    assert.ok(
      graph.doctypeDict.get('swrs').includes('cc.game.location.westlands')
    )
    assert.strictEqual(graph.nodeCount, 26)
    assert.strictEqual(graph.edgeCount, 25)
  })

  it('Check generated dot string', function () {
    const dotStr = eol.auto(oreqm.getDot())
    fs.writeFileSync('tmp/dot_file_1_test.dot', dotStr, {
      encoding: 'utf8',
      flag: 'w'
    })
    // console.dir(expect(dotStr))
    const dotRef = eol.auto(
      fs.readFileSync('./test/refdata/dot_file_1_test.dot', 'utf8')
    )
    expect(dotStr).to.equal(dotRef) //rq: ->(rq_dot,rq_no_sel_show_all,rq_show_dot)
  })

  it('check pseudo needsobj for fulfilledby', function () {
    const dotStr = eol.auto(oreqm.getDot())
    assert.ok(dotStr.includes('vaporware*')) //rq: ->(rq_ffb_needsobj)
  })

  it('doctype filtering', function () {
    const matches = oreqm.findReqsWithText('PLACEHOLDER')
    assert.ok(matches.includes('zork.game.location.frobozz'))
    //rq: ->(rq_ffb_placeholder)
    assert.strictEqual(
      oreqm.requirements.get('zork.game.location.frobozz').doctype,
      'vaporware'
    )
    // Now exclude this doctype
    oreqm.setExcludedDoctypes(['vaporware'])
    oreqm.createGraph(selectAll, [], 'A test title', [], 1000, true, true)
    //rq: ->(rq_sel_doctype)
    assert.strictEqual(
      oreqm.getDot().indexOf('zork.game.location.frobozz'),
      -1
    ) // node id absent from file
    oreqm.setExcludedDoctypes([])
  })

  it('Create hierarchy diagram', function () {
    const hierarchy = eol.auto(oreqm.scanDoctypes(false))
    assert.ok(hierarchy.includes('digraph'))

    fs.writeFileSync('tmp/dot_file_hierarchy_test.dot', hierarchy, {
      encoding: 'utf8',
      flag: 'w'
    })
    const dotRef = eol.auto(
      fs.readFileSync('./test/refdata/dot_file_hierarchy_test.dot', 'utf8')
    )
    expect(hierarchy).to.equal(dotRef)
  })

  it('Create safety diagram', function () {
    const safety = eol.auto(oreqm.scanDoctypes(true))
    assert.ok(safety.includes('digraph'))

    fs.writeFileSync('tmp/dot_file_safety_test.dot', safety, {
      encoding: 'utf8',
      flag: 'w'
    })
    const dotRef = eol.auto(
      fs.readFileSync('./test/refdata/dot_file_safety_test.dot', 'utf8')
    )
    expect(safety).to.equal(dotRef)
  })
})
