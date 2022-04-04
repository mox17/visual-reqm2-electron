const { test, expect } = require('@playwright/test');
const settings = _interopRequireDefault(require('../lib/settings.js'))

function _interopRequireDefault (obj) {
  return obj && obj.__esModule ? obj : { default: obj }
}

test.describe('Settings tests', () => {
  test('New settings', async () => {
    // Force settings to default
    settings.checkAndUpgradeSettings(settings.defaultProgramSettings)
    expect(settings.programSettings.max_calc_nodes).toBe(0)

    const ignoredFields = settings.getIgnoredFields()
    // console.log(ignoredFields);
    expect(ignoredFields.includes('violations')).toBeTruthy()

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
    expect(settings.programSettings.max_calc_nodes).toBe(0)
    expect(settings.programSettings.show_coverage).toBe(true)
    expect(settings.programSettings.compare_fields.id).toBe(true)

    // console.dir(newSettings.safety_link_rules);
    // console.dir(JSON.stringify(newSettings.safety_link_rules, null, 2));
    newSettings.color_status = 7
    settings.checkAndUpgradeSettings(newSettings)
    expect(settings.programSettings.color_status).toBe(true)
  })
})
