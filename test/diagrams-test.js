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

function select_all (_node_id, rec, _node_color) {
  // Select all - no need to inspect input
  return rec.status !== 'rejected'
}

before(function () {
  mkdirp.sync('./tmp')
})

beforeEach(function () {
  color.load_colors_fs(null, './test/refdata/test_suite_palette.json')
})

describe('ReqM2Oreqm tests', function () {
  // force default settings
  settings.check_and_upgrade_settings(settings.default_program_settings)

  const test_oreqm_file_name = './testdata/oreqm_testdata_del_movement.oreqm'
  const oreqm_txt = fs.readFileSync(test_oreqm_file_name) //rq: ->(rq_read_oreqm)
  const oreqm = new ReqM2Oreqm.ReqM2Oreqm(
    test_oreqm_file_name,
    oreqm_txt,
    [],
    []
  )

  it('Verify no doctypes blocked', function () {
    // console.log(oreqm.excluded_doctypes);
    assert.strictEqual(oreqm.filename, test_oreqm_file_name)
  })

  it('Create instance', function () {
    assert.ok(oreqm.get_excluded_doctypes().length === 0)
  })

  it('Finds reqs', function () {
    const matches = oreqm.find_reqs_with_text('maze')
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
    const graph = oreqm.create_graph(
      select_all,
      [],
      'A test title',
      [],
      1000,
      true,
      true
    )
    // console.log(graph);
    assert.ok(
      graph.doctype_dict.get('swrs').includes('cc.game.location.westlands')
    )
    assert.strictEqual(graph.node_count, 26)
    assert.strictEqual(graph.edge_count, 25)
  })

  it('Check generated dot string', function () {
    const dot_str = eol.auto(oreqm.get_dot())
    fs.writeFileSync('tmp/dot_file_1_test.dot', dot_str, {
      encoding: 'utf8',
      flag: 'w'
    })
    // console.dir(expect(dot_str))
    const dot_ref = eol.auto(
      fs.readFileSync('./test/refdata/dot_file_1_test.dot', 'utf8')
    )
    expect(dot_str).to.equal(dot_ref) //rq: ->(rq_dot,rq_no_sel_show_all,rq_show_dot)
  })

  it('check pseudo needsobj for fulfilledby', function () {
    const dot_str = eol.auto(oreqm.get_dot())
    assert.ok(dot_str.includes('vaporware*')) //rq: ->(rq_ffb_needsobj)
  })

  it('doctype filtering', function () {
    const matches = oreqm.find_reqs_with_text('PLACEHOLDER')
    assert.ok(matches.includes('zork.game.location.frobozz'))
    //rq: ->(rq_ffb_placeholder)
    assert.strictEqual(
      oreqm.requirements.get('zork.game.location.frobozz').doctype,
      'vaporware'
    )
    // Now exclude this doctype
    oreqm.set_excluded_doctypes(['vaporware'])
    oreqm.create_graph(select_all, [], 'A test title', [], 1000, true, true)
    //rq: ->(rq_sel_doctype)
    assert.strictEqual(
      oreqm.get_dot().indexOf('zork.game.location.frobozz'),
      -1
    ) // node id absent from file
    oreqm.set_excluded_doctypes([])
  })

  it('Create hierarchy diagram', function () {
    const hierarchy = eol.auto(oreqm.scan_doctypes(false))
    assert.ok(hierarchy.includes('digraph'))

    fs.writeFileSync('tmp/dot_file_hierarchy_test.dot', hierarchy, {
      encoding: 'utf8',
      flag: 'w'
    })
    const dot_ref = eol.auto(
      fs.readFileSync('./test/refdata/dot_file_hierarchy_test.dot', 'utf8')
    )
    expect(hierarchy).to.equal(dot_ref)
  })

  it('Create safety diagram', function () {
    const safety = eol.auto(oreqm.scan_doctypes(true))
    assert.ok(safety.includes('digraph'))

    fs.writeFileSync('tmp/dot_file_safety_test.dot', safety, {
      encoding: 'utf8',
      flag: 'w'
    })
    const dot_ref = eol.auto(
      fs.readFileSync('./test/refdata/dot_file_safety_test.dot', 'utf8')
    )
    expect(safety).to.equal(dot_ref)
  })
})
