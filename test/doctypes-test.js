'use strict'
const dt = _interopRequireDefault(require('../lib/doctypes.js'))
const assert = require('assert')

const describe = global.describe
const it = global.it

function _interopRequireDefault (obj) {
  return obj && obj.__esModule ? obj : { default: obj }
}

describe('DoctypeRelations tests', function () {
  const inst = new dt.DoctypeRelations('foo')
  it('Create object', function () {
    // console.log(inst.name)
    assert.strictEqual(inst.name, 'foo')
  })

  it('Add instances', function () {
    inst.addInstance('fie')
    inst.addInstance('fum')
    assert.strictEqual(inst.count, 2)
    assert.strictEqual(inst.idList[0], 'fie')
    assert.strictEqual(inst.idList[1], 'fum')
  })

  it('Add needsobj', function () {
    inst.addNeedsobj('bar')
    inst.addNeedsobj('bar')
    inst.addNeedsobj('baz')
    assert.strictEqual(inst.needsobj.get('bar'), 2)
    assert.strictEqual(inst.needsobj.get('baz'), 1)
  })

  it('Add linksto', function () {
    inst.addLinksto('swad', [1, 2])
    inst.addLinksto('swad', [3, 4])
    inst.addLinksto('swdd', [5, 6])
    assert.strictEqual(inst.linksto.get('swad').length, 2)
    assert.strictEqual(inst.linksto.get('swdd').length, 1)
    const a = inst.linksto.get('swdd')[0]
    const b = [5, 6]
    assert.strictEqual(a[0], b[0])
    assert.strictEqual(a[1], b[1])
  })

  it('Add fulfilledby', function () {
    inst.addFulfilledby('swad', [1, 2])
    inst.addFulfilledby('swad', [3, 4])
    inst.addFulfilledby('swdd', [5, 6])
    assert.strictEqual(inst.fulfilledby.get('swad').length, 2)
    assert.strictEqual(inst.fulfilledby.get('swdd').length, 1)
    const a = inst.fulfilledby.get('swdd')[0]
    const b = [5, 6]
    assert.strictEqual(a[0], b[0])
    assert.strictEqual(a[1], b[1])
  })
})
