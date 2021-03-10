const chai = require('chai')
const color = _interopRequireDefault(require('../lib/color.js'))
const fs = require('fs')
const assert = chai.assert

function _interopRequireDefault (obj) { return obj && obj.__esModule ? obj : { default: obj } }

const after = global.after
const describe = global.describe
const it = global.it

const pal_file = 'tmp/test_palette.json'

after(function () {
  color.update_color_settings({ none: '#FFFFFF' }, null)
})

describe('Color palette tests', function () {
  it('Set palette', function () {
    const mapping = { xyzzy: '#223344' }

    color.update_color_settings(mapping, null)
    const xyzzy = color.get_color('xyzzy')
    assert.strictEqual('#223344', xyzzy)
  })

  it('Generate colors', function () {
    for (let count = 0; count < 100; count += 1) {
      const rgb = color.get_color('foobar' + count.toString())
      assert.ok(rgb.length === 7)
      assert.ok(rgb[0] === '#')
    }
    if (fs.existsSync(pal_file)) {
      fs.unlinkSync(pal_file)
    }
    color.save_colors_fs(pal_file)
    assert.ok(fs.existsSync(pal_file))
    const file_content = fs.readFileSync(pal_file, 'utf8')
    // console.log(file_content);
    assert.ok(file_content.includes('"foobar0"'), true) //rq: ->(rq_doctype_color_gen,rq_doctype_color_export)
  })

  it('Load palette', function () {
    const mapping = { xyzzy: '#123456' }
    color.update_color_settings(mapping, null)
    assert.strictEqual('#123456', color.get_color('xyzzy')) // Set different color
    color.load_colors_fs(null, pal_file)
    // xyzzy definition overwritten by import
    assert.notEqual('#123456', color.get_color('xyzzy')) //rq: ->(rq_doctype_color_import)
  })
})
