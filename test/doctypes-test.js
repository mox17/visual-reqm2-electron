"use strict";
//const electron = require('electron');
const util = require("../lib/util.js");
const dt = _interopRequireDefault(require("../lib/doctypes.js"));
const assert = require("assert");
//const fs = require('fs');

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

describe("DoctypeRelations tests", function () {
  let inst = new dt.DoctypeRelations("foo");
  it("Create object", function () {
    //console.log(inst.name)
    assert.strictEqual(inst.name, "foo");
  });

  it("Add instances", function () {
    inst.add_instance("fie");
    inst.add_instance("fum");
    assert.strictEqual(inst.count, 2);
    assert.strictEqual(inst.id_list[0], "fie");
    assert.strictEqual(inst.id_list[1], "fum");
  });

  it("Add needsobj", function () {
    inst.add_needsobj("bar");
    inst.add_needsobj("bar");
    inst.add_needsobj("baz");
    assert.strictEqual(inst.needsobj.get("bar"), 2);
    assert.strictEqual(inst.needsobj.get("baz"), 1);
  });

  it("Add linksto", function () {
    inst.add_linksto("swad", [1, 2]);
    inst.add_linksto("swad", [3, 4]);
    inst.add_linksto("swdd", [5, 6]);
    assert.strictEqual(inst.linksto.get("swad").length, 2);
    assert.strictEqual(inst.linksto.get("swdd").length, 1);
    let a = inst.linksto.get("swdd")[0];
    let b = [5, 6];
    assert.strictEqual(a[0], b[0]);
    assert.strictEqual(a[1], b[1]);
  });

  it("Add fulfilledby", function () {
    inst.add_fulfilledby("swad", [1, 2]);
    inst.add_fulfilledby("swad", [3, 4]);
    inst.add_fulfilledby("swdd", [5, 6]);
    assert.strictEqual(inst.fulfilledby.get("swad").length, 2);
    assert.strictEqual(inst.fulfilledby.get("swdd").length, 1);
    let a = inst.fulfilledby.get("swdd")[0];
    let b = [5, 6];
    assert.strictEqual(a[0], b[0]);
    assert.strictEqual(a[1], b[1]);
  });
});
