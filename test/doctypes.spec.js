'use strict'
const { test, expect } = require('@playwright/test');
const dt = _interopRequireDefault(require('../lib/doctypes.js'))

function _interopRequireDefault (obj) {
  return obj && obj.__esModule ? obj : { default: obj }
}

test.describe('DoctypeRelations tests', () => {
  const inst = new dt.DoctypeRelations('foo')
  test('Create object', async () => {
    // console.log(inst.name)
    expect(inst.name).toBe('foo')
  })

  test('Add instances', async () => {
    inst.addInstance('fie')
    inst.addInstance('fum')
    expect(inst.count).toBe(2)
    expect(inst.idList[0]).toBe('fie')
    expect(inst.idList[1]).toBe('fum')
  })

  test('Add needsobj', async () => {
    inst.addNeedsobj('bar')
    inst.addNeedsobj('bar')
    inst.addNeedsobj('baz')
    expect(inst.needsobj.get('bar')).toBe(2)
    expect(inst.needsobj.get('baz')).toBe(1)
  })

  test('Add linksto', async () => {
    inst.addLinksto('swad', [1, 2])
    inst.addLinksto('swad', [3, 4])
    inst.addLinksto('swdd', [5, 6])
    expect(inst.linksto.get('swad').length).toBe(2)
    expect(inst.linksto.get('swdd').length).toBe(1)
    const a = inst.linksto.get('swdd')[0]
    const b = [5, 6]
    expect(a[0]).toBe(b[0])
    expect(a[1]).toBe(b[1])
  })

  test('Add fulfilledby', async () => {
    inst.addFulfilledby('swad', [1, 2])
    inst.addFulfilledby('swad', [3, 4])
    inst.addFulfilledby('swdd', [5, 6])
    expect(inst.fulfilledby.get('swad').length).toBe(2)
    expect(inst.fulfilledby.get('swdd').length).toBe(1)
    const a = inst.fulfilledby.get('swdd')[0]
    const b = [5, 6]
    expect(a[0]).toBe(b[0])
    expect(a[1]).toBe(b[1])
  })
})