'use strict'

const { assert } = require('chai')

const util = _interopRequireDefault(require('../lib/util.js'))

const describe = global.describe
const it = global.it

function _interopRequireDefault (obj) {
  return obj && obj.__esModule ? obj : { default: obj }
}

function simple_alert (msg) {
  console.log(msg)
}

// Override popup alert
global.alert = simple_alert

// eslint-disable-next-line no-unused-vars
function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('util tests', function () {
  it('enable timing', function () {
    util.enable_timing(true)
  })

  it('util log time', async function () {
    let now = util.get_time_now()
    await sleep(50)
    let then = util.log_time_spent(now)
    assert(then > now)
    assert((then-now) >= 50)
  })

  it('disable timing', function () {
    util.enable_timing(false)
  })
})
