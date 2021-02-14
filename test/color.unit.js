var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
const util = require('../lib/util.js');
const color = _interopRequireDefault(require('../lib/color.js'));
const fs = require('fs');

//const assert = require('assert')
var assert = chai.assert;    // Using Assert style

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

const pal_file = "test_palette.json";

describe('Color palette tests', function() {

    it('Generate color', function() {
        for (let count=0; count < 100; count += 1) {
            let rgb = color.get_color('foobar'+count.toString());
            assert.ok(rgb.length === 7);
            assert.ok(rgb[0] === '#');
        }
    });

    it('Save palette', function() {
        if (fs.existsSync(pal_file)) {
            fs.unlinkSync(pal_file);
        }
        color.save_colors_fs(pal_file);
        //console.log(fs.statSync(pal_file, {throwIfNoEntry: false, bigint: true}) );
        assert.ok(fs.existsSync(pal_file));
        let file_content = fs.readFileSync(pal_file, 'utf8');
        //console.log(file_content);
        //assert.strictEqual(file_content.includes('"fxoobar"'), true);
        assert.ok(file_content.includes('"foobar0"'), true);
    });

    it('Load palette', function() {
        color.load_colors_fs(null, "test_palette.json");
        assert.ok(true);
    });

    it('Set palette', function() {
        let mapping = {"xyzzy": "#223344"}

        color.update_color_settings(mapping, null);
        let xyzzy = color.get_color("xyzzy");
        assert.strictEqual("#223344", xyzzy);
    });

});
