var chai = require('chai');
//var chaiAsPromised = require('chai-as-promised');
const color = _interopRequireDefault(require('../lib/color.js'));
const fs = require('fs');

var assert = chai.assert;    // Using Assert style

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

const describe = global.describe;
const it = global.it;

const pal_file = "tmp/test_palette.json";

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
        assert.ok(fs.existsSync(pal_file));
        let file_content = fs.readFileSync(pal_file, 'utf8');
        //console.log(file_content);
        assert.ok(file_content.includes('"foobar0"'), true); //rq: ->(rq_doctype_color_gen)
    });

    it('Load palette', function() {
        color.load_colors_fs(null, pal_file);
        assert.ok(true);
    });

    it('Set palette', function() {
        let mapping = {"xyzzy": "#223344"}

        color.update_color_settings(mapping, null);
        let xyzzy = color.get_color("xyzzy");
        assert.strictEqual("#223344", xyzzy);
    });

});
