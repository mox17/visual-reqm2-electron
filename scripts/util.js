
'use strict'
import { performance } from 'perf_hooks'
import { remote } from 'electron'

let logTiming = false

export function enableTiming (val) {
  logTiming = val
}

/**
 * Get current time
 * @returns {integer} current time in microseconds
 */
export function getTimeNow () {
    return performance.now()
}

/**
 * Get delta time
 * @param {integer} startTime in microseconds
 * @returns {integer} elapsed time in microseconds
 */
export function getDeltaTime (startTime) {
    return performance.now() - startTime
}

/**
 * Log elapsed time since startTime
 * @param {integer} startTime in milliseconds
 * @param {string} legend headline for measurement
 * @returns integer time now
 */
export function logTimeSpent (startTime, legend="elapsed time") {
    if (logTiming) {
      console.log(`Time in "${legend}": ${getDeltaTime(startTime).toFixed(3)} millisec`)
    }
    return performance.now()
}

/**
 * Show alert message
 * @param {string} msg Details of the alert
 * @param {string} title Optional title
 */
export function showAlert (msg, title="Error") {
  remote.dialog.showMessageBoxSync(
    {
      type: 'error',
      buttons: ['Dismiss'],
      defaultId: 0,
      title: title,
      message: msg
    })
}
