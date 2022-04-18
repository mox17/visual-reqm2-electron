'use strict'

const { test, expect } = require('@playwright/test');
const util = _interopRequireDefault(require('../lib/util.js'))

function _interopRequireDefault (obj) {
  return obj && obj.__esModule ? obj : { default: obj }
}

function simpleAlert (msg) {
  console.log(msg)
}

// Override popup alert
global.alert = simpleAlert

// eslint-disable-next-line no-unused-vars
function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test.describe('util tests', () => {
  test('enable timing', async () => {
    util.enableTiming(true)
  })

  test('util log time', async () => {
    let now = util.getTimeNow()
    await sleep(50)
    let then = util.logTimeSpent(now)
    expect(then > now).toBeTruthy()
    expect((then-now) >= 50).toBeTruthy()
  })

  test('disable timing', async () => {
    util.enableTiming(false)
  })
})