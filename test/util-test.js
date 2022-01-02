'use strict'

const { assert } = require('chai')

const util = _interopRequireDefault(require('../lib/util.js'))

const describe = global.describe
const it = global.it

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

describe('util tests', function () {
  it('enable timing', function () {
    util.enableTiming(true)
  })

  it('util log time', async function () {
    let now = util.getTimeNow()
    await sleep(50)
    let then = util.logTimeSpent(now)
    assert(then > now)
    assert((then-now) >= 50)
  })

  it('disable timing', function () {
    util.enableTiming(false)
  })
})
