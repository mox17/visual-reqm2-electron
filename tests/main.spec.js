"use strict";

const electron = require('electron');
const util = require('../lib/util.js');
//const main = _interopRequireDefault(require('../lib/main.js'));
const assert = require('assert');
const fs = require('fs');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

describe('main', function() {

    it('should be able to copy text to the clipboard', function() {
        electron.clipboard.writeText('Hello!');
        assert.strictEqual(electron.clipboard.readText(), 'Hello!');
    });


});
