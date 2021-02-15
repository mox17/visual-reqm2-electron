"use strict";

//const electron = require('electron');
const util = require('../lib/util.js');
const settings = _interopRequireDefault(require('../lib/settings.js'));
const ReqM2Oreqm = _interopRequireDefault(require('../lib/diagrams.js'));
const assert = require('assert');
const fs = require('fs');

const jsdom = require("jsdom")
const { JSDOM } = jsdom
global.DOMParser = new JSDOM().window.DOMParser

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function alert(txt) {
    console.log(txt);
}

global.alert = alert

function select_all(_node_id, rec, _node_color) {
    // Select all - no need to inspect input
    return rec.status !== 'rejected'
  }

describe('ReqM2Oreqm tests', function() {

    // force default settings
    settings.check_and_upgrade_settings(null); 

    const test_oreqm_file_name = "./testdata/oreqm_testdata_del_movement.oreqm"
    let oreqm_txt = fs.readFileSync(test_oreqm_file_name);
    let oreqm = new ReqM2Oreqm.ReqM2Oreqm(test_oreqm_file_name, oreqm_txt, [], [])

    it('Create instance', function() {
        assert.strictEqual(oreqm.filename, test_oreqm_file_name);
    });

    it('Finds reqs', function() {
        let matches = oreqm.find_reqs_with_text("maze");
        //console.log(matches)
        assert.strictEqual( matches.includes('cc.game.location.maze.1'), true);
        assert.strictEqual( matches.includes('cc.game.location.maze.2'), true);
        assert.strictEqual( matches.includes('cc.game.location.maze.3'), true);
        assert.strictEqual( matches.includes('cc.game.location.maze.4'), true);
        assert.strictEqual( matches.includes('cc.game.location.maze.5'), true);
        assert.strictEqual( matches.includes('cc.game.location.maze.7'), true);
        assert.strictEqual( matches.includes('cc.game.location.maze.8'), true);
        assert.strictEqual( matches.includes('cc.game.location.maze.9'), true);
    });

    it('Create graph', function() {
        const graph = oreqm.create_graph(
            select_all,
            [],
            "A test title",
            [],
            1000,
            true,
            true);
        //console.log(graph);
        assert.ok(graph.doctype_dict.get('swrs').includes("cc.game.location.westlands"));
        assert.strictEqual(graph.node_count, 26);
        assert.strictEqual(graph.edge_count, 25);
    });

});
