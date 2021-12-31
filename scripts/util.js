
'use strict'
import { performance } from 'perf_hooks'

let log_timing = false

export function enable_timing(val) {
  log_timing = val
}

/**
 * Get current time
 * @returns {integer} current time in microseconds
 */
export function get_time_now() {
    return performance.now()
}

/**
 * Get delta time
 * @param {integer} start_time in microseconds
 * @returns {integer} elapsed time in microseconds
 */
export function get_delta_time(start_time) {
    return performance.now() - start_time
}

/**
 * Log elapsed time since start_time
 * @param {integer} start_time in milliseconds
 * @param {string} legend headline for measurement
 * @returns integer time now
 */
export function log_time_spent(start_time, legend="elapsed time") {
    if (log_timing) {
      console.log(`Time in "${legend}": ${get_delta_time(start_time).toFixed(3)} millisec`)
    }
    return performance.now()
}
