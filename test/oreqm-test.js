"use strict";

//const electron = require('electron');
const util = require("../lib/util.js");
const ReqM2Specobjects = _interopRequireDefault(
  require("../lib/reqm2oreqm.js")
);
const assert = require("assert");
const fs = require("fs");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
global.DOMParser = new JSDOM().window.DOMParser;

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

function simple_alert(msg) {
  console.log(msg);
}

// Override popup alert
global.alert = simple_alert;

describe("ReqM2Specobjects tests", function () {
  const test_oreqm_file_name = "./testdata/oreqm_testdata_del_movement.oreqm";
  let oreqm_txt = fs.readFileSync(test_oreqm_file_name);
  let oreqm = new ReqM2Specobjects.ReqM2Specobjects(
    test_oreqm_file_name,
    oreqm_txt,
    [],
    []
  );

  it("Create instance", function () {
    assert.strictEqual(oreqm.filename, test_oreqm_file_name);
  });

  it("Finds reqs", function () {
    let matches = oreqm.find_reqs_with_text("maze");
    //console.log(matches)
    assert.ok(matches.includes("cc.game.location.maze.1"));
    assert.ok(matches.includes("cc.game.location.maze.2"));
    assert.ok(matches.includes("cc.game.location.maze.3"));
    assert.ok(matches.includes("cc.game.location.maze.4"));
    assert.ok(matches.includes("cc.game.location.maze.5"));
  });
});
