'use strict'

const { test, expect } = require('@playwright/test');
const color = _interopRequireDefault(require('../lib/color.js'))
const fs = require('fs')

function _interopRequireDefault (obj) { return obj && obj.__esModule ? obj : { default: obj } }

const palFile = 'tmp/test_palette.json'

test.afterEach(async () => {
  color.updateColorSettings({ none: '#FFFFFF' }, null)
})

let colorCallback = false
// dummy callback
function colorSettingsUpdate (_palette) {
  colorCallback = true
}

test.describe('Color palette tests', () => {
  test('Set palette', async () => {
    const mapping = { xyzzy: '#223344' }

    color.updateColorSettings(mapping, null)
    const xyzzy = color.getColor('xyzzy')
    expect(xyzzy).toBe('#223344')
  })

  test('Generate colors', async () => {
    for (let count = 0; count < 100; count += 1) {
      const rgb = color.getColor('foobar' + count.toString())
      expect(rgb.length).toBe(7)
      expect(rgb[0]).toBe('#')
    }
    if (fs.existsSync(palFile)) {
      fs.unlinkSync(palFile)
    }
    await color.saveColorsFs(palFile)
    expect(fs.existsSync(palFile)).toBeTruthy()
    const fileContent = fs.readFileSync(palFile, 'utf8')
    // console.log(fileContent);
    expect(fileContent.includes('"foobar0"')).toBeTruthy() //rq: ->(rq_doctype_color_gen,rq_doctype_color_export)
  })

  test('Load palette', async () => {
    const mapping = { xyzzy: '#123456' }
    color.updateColorSettings(mapping, colorSettingsUpdate)
    expect(color.getColor('xyzzy')).toBe('#123456')
    // Set different color
    await color.loadColorsFs(null, palFile)
    // xyzzy definition overwritten by import
    expect(color.getColor('xyzzy')).not.toBe('#123456') //rq: ->(rq_doctype_color_import)
    expect(colorCallback).toBeTruthy()
  })
})
