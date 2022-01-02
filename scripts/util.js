
'use strict'
import { performance } from 'perf_hooks'

let logTiming = false

export function enableTiming(val) {
  logTiming = val
}

/**
 * Get current time
 * @returns {integer} current time in microseconds
 */
export function getTimeNow() {
    return performance.now()
}

/**
 * Get delta time
 * @param {integer} startTime in microseconds
 * @returns {integer} elapsed time in microseconds
 */
export function getDeltaTime(startTime) {
    return performance.now() - startTime
}

/**
 * Log elapsed time since startTime
 * @param {integer} startTime in milliseconds
 * @param {string} legend headline for measurement
 * @returns integer time now
 */
export function logTimeSpent(startTime, legend="elapsed time") {
    if (logTiming) {
      console.log(`Time in "${legend}": ${getDeltaTime(startTime).toFixed(3)} millisec`)
    }
    return performance.now()
}
