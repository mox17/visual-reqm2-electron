const chai = require('chai')
const settings = _interopRequireDefault(require('../lib/settings.js'))

// const assert = require('assert')
const assert = chai.assert // Using Assert style
const describe = global.describe
const it = global.it

function _interopRequireDefault (obj) {
  return obj && obj.__esModule ? obj : { default: obj }
}

describe('Settings tests', function () {
  it('New settings', function () {
    // Force settings to default
    settings.checkAndUpgradeSettings(settings.defaultProgramSettings)
    assert.strictEqual(settings.programSettings.max_calc_nodes, 1000)

    const ignoredFields = settings.getIgnoredFields()
    // console.log(ignoredFields);
    assert.ok(ignoredFields.includes('violations'))

    let newSettings = {}
    newSettings = Object.assign(newSettings, settings.programSettings)

    delete newSettings.max_calc_nodes
    delete newSettings.show_coverage
    delete newSettings.top_doctypes
    delete newSettings.color_status
    delete newSettings.show_errors
    delete newSettings.check_for_updates
    delete newSettings.safety_link_rules
    delete newSettings.compare_fields

    settings.checkAndUpgradeSettings(newSettings)
    assert.strictEqual(settings.programSettings.max_calc_nodes, 1000)
    assert.strictEqual(settings.programSettings.show_coverage, true)
    assert.strictEqual(settings.programSettings.compare_fields.id, true)

    // console.dir(newSettings.safety_link_rules);
    // console.dir(JSON.stringify(newSettings.safety_link_rules, null, 2));
    newSettings.color_status = 7
    settings.checkAndUpgradeSettings(newSettings)
    assert.strictEqual(settings.programSettings.color_status, true)
  })
})
