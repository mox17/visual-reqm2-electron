"use strict";

const settings = _interopRequireDefault(require("../lib/settings.js"));
const ReqM2Oreqm = _interopRequireDefault(require("../lib/diagrams.js"));
const main_data = _interopRequireDefault(require("../lib/main_data.js"));
const fs = require("fs");
const eol = require('eol')

// Provide DOMParser for testing
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
global.DOMParser = new JSDOM().window.DOMParser;

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

var chai = require("chai");
//var chaiAsPromised = require("chai-as-promised");
var assert = chai.assert; // Using Assert style
var expect = chai.expect; // Using Expect style
//var should = chai.should(); // Using Should style

function alert(txt) {
  console.log(txt);
}

global.alert = alert;

function select_all(_node_id, rec, _node_color) {
  // Select all - no need to inspect input
  return rec.status !== "rejected";
}

// eslint-disable-next-line no-undef
describe("ReqM2Oreqm tests", function () {
  // force default settings
  settings.check_and_upgrade_settings(null);

  const test_oreqm_file_name = "./testdata/oreqm_testdata_del_movement.oreqm";
  let oreqm_txt = fs.readFileSync(test_oreqm_file_name); //rq: ->(rq_read_oreqm)
  let oreqm = new ReqM2Oreqm.ReqM2Oreqm(
    test_oreqm_file_name,
    oreqm_txt,
    [],
    []
  );

  // eslint-disable-next-line no-undef
  it("Create instance", function () {
    assert.strictEqual(oreqm.filename, test_oreqm_file_name);
  });

  // eslint-disable-next-line no-undef
  it("Finds reqs", function () {
    let matches = oreqm.find_reqs_with_text("maze");
    //console.log(matches)
    assert.strictEqual(matches.includes("cc.game.location.maze.1"), true);
    assert.strictEqual(matches.includes("cc.game.location.maze.2"), true);
    assert.strictEqual(matches.includes("cc.game.location.maze.3"), true);
    assert.strictEqual(matches.includes("cc.game.location.maze.4"), true);
    assert.strictEqual(matches.includes("cc.game.location.maze.5"), true);
    assert.strictEqual(matches.includes("cc.game.location.maze.7"), true);
    assert.strictEqual(matches.includes("cc.game.location.maze.8"), true);
    assert.strictEqual(matches.includes("cc.game.location.maze.9"), true);
  });

  // eslint-disable-next-line no-undef
  it("Create dot graph", function () {
    const graph = oreqm.create_graph(
      select_all,
      [],
      "A test title",
      [],
      1000,
      true,
      true
    );
    //console.log(graph);
    assert.ok(
      graph.doctype_dict.get("swrs").includes("cc.game.location.westlands")
    );
    assert.strictEqual(graph.node_count, 26);
    assert.strictEqual(graph.edge_count, 25);
  });
  
  // eslint-disable-next-line no-undef
  it("Check generated dot string", function () {
    let dot_str = eol.auto(oreqm.get_dot());
    fs.writeFileSync("dot_file_1_test.dot", dot_str, {
      encoding: "utf8",
      flag: "w",
    });
    //console.dir(expect(dot_str))
    let dot_ref = eol.auto(fs.readFileSync("./test/refdata/dot_file_1_ref.dot", "utf8"));
    expect(dot_str).to.equal(dot_ref); //rq: ->(rq_dot)
  });

  // eslint-disable-next-line no-undef
  it('Create hierarchy diagram', function () {
    const hierarchy = eol.auto(oreqm.scan_doctypes(false));
    assert.ok(hierarchy.includes('digraph'));

    fs.writeFileSync("dot_file_hierarchy_test.dot", hierarchy, {
      encoding: "utf8",
      flag: "w",
    });
    let dot_ref = eol.auto(fs.readFileSync("./test/refdata/dot_file_hierarchy_ref.dot", "utf8"));
    expect(hierarchy).to.equal(dot_ref);
  });

  // eslint-disable-next-line no-undef
  it('Create safety diagram', function () {
    const safety = eol.auto(oreqm.scan_doctypes(true));
    assert.ok(safety.includes('digraph'));

    fs.writeFileSync("dot_file_safety_test.dot", safety, {
      encoding: "utf8",
      flag: "w",
    });
    let dot_ref = eol.auto(fs.readFileSync("./test/refdata/dot_file_safety_ref.dot", "utf8"));
    expect(safety).to.equal(dot_ref);
  });

});
