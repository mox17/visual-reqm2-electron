var chai = require('chai');
//const util = require('../lib/util.js');
const settings = _interopRequireDefault(require('../lib/settings.js'));
//const fs = require('fs');

//const assert = require('assert')
var assert = chai.assert;    // Using Assert style

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// eslint-disable-next-line no-undef
it('New settings', function() {
    assert.strictEqual(settings.program_settings, null);

    settings.check_and_upgrade_settings(null);
    assert.strictEqual(settings.program_settings.max_calc_nodes, 1000);

    let ignored_fields = settings.get_ignored_fields();
    //console.log(ignored_fields);
    assert.ok(ignored_fields.includes('violations'));

    let new_settings = {};
    new_settings = Object.assign(new_settings, settings.program_settings);

    delete new_settings.max_calc_nodes;
    delete new_settings.show_coverage;
    delete new_settings.top_doctypes;
    delete new_settings.color_status;
    delete new_settings.show_errors;
    delete new_settings.check_for_updates;
    delete new_settings.safety_link_rules;

    settings.check_and_upgrade_settings(new_settings);
    assert.strictEqual(settings.program_settings.max_calc_nodes, 1000);
    assert.strictEqual(settings.program_settings.show_coverage, false);

    new_settings.color_status = 7;
    settings.check_and_upgrade_settings(new_settings);
    assert.strictEqual(settings.program_settings.color_status, false);

});


