const chai = require('chai')
const color = _interopRequireDefault(require('../lib/color.js'))
const fs = require('fs')
const assert = chai.assert

function _interopRequireDefault (obj) { return obj && obj.__esModule ? obj : { default: obj } }

const after = global.after
const describe = global.describe
const it = global.it

const palFile = 'tmp/test_palette.json'

after(function () {
  color.updateColorSettings({ none: '#FFFFFF' }, null)
})

let colorCallback = false
// dummy callback
function colorSettingsUpdate (_palette) {
  colorCallback = true
}

describe('Color palette tests', function () {
  it('Set palette', function () {
    const mapping = { xyzzy: '#223344' }

    color.updateColorSettings(mapping, null)
    const xyzzy = color.getColor('xyzzy')
    assert.strictEqual('#223344', xyzzy)
  })

  it('Generate colors', function () {
    for (let count = 0; count < 100; count += 1) {
      const rgb = color.getColor('foobar' + count.toString())
      assert.ok(rgb.length === 7)
      assert.ok(rgb[0] === '#')
    }
    if (fs.existsSync(palFile)) {
      fs.unlinkSync(palFile)
    }
    color.saveColorsFs(palFile)
    assert.ok(fs.existsSync(palFile))
    const fileContent = fs.readFileSync(palFile, 'utf8')
    // console.log(fileContent);
    assert.ok(fileContent.includes('"foobar0"'), true) //rq: ->(rq_doctype_color_gen,rq_doctype_color_export)
  })

  it('Load palette', function () {
    const mapping = { xyzzy: '#123456' }
    color.updateColorSettings(mapping, colorSettingsUpdate)
    assert.strictEqual('#123456', color.getColor('xyzzy')) // Set different color
    color.loadColorsFs(null, palFile)
    // xyzzy definition overwritten by import
    assert.notEqual('#123456', color.getColor('xyzzy')) //rq: ->(rq_doctype_color_import)
    assert.ok(colorCallback)
  })
})
