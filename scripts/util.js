'use strict'

// ------ utility functions and extensions --------
// String.prototype.format = function () {
//   let i = 0; const args = arguments
//   return this.replace(/{}/g, function () {
//     return typeof args[i] !== 'undefined' ? args[i++] : ''
//   })
// }

// Define trim() operation if not existing
// if (typeof (String.prototype.trim) === 'undefined') {
//   String.prototype.trim = function () {
//     return String(this).replace(/^\s+|\s+$/g, '')
//   }
// }

// Define remove() operation if not existing
if (typeof (Array.prototype.remove) === 'undefined') {
  Array.prototype.remove = function () {
    let what; const a = arguments; let L = a.length; let ax
    while (L && this.length) {
      what = a[--L]
      while ((ax = this.indexOf(what)) !== -1) {
        this.splice(ax, 1)
      }
    }
    return this
  }
}

// Helper for exporting ReqExp to JSON
// RegExp.prototype.toJSON = function () { return this.source }
