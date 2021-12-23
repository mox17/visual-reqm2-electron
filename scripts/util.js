
import { performance } from 'perf_hooks'

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

export function log_time_spent(start_time, legend="elapsed time") {
    console.log(`Time in "${legend}": ${get_delta_time(start_time).toFixed(3)} millisec`)
    return performance.now()
}


export function log_time_spent_in(callback, legend=`${callback.name}`) {
    const now = get_time_now()
    callback()
    console.log(`Time in "${legend}": ${get_delta_time(now).toFixed(3)} millisec`)
    return now
}
