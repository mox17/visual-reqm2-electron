'use strict'
import { oreqm_main } from "./main_data"

/**
 * Update count in 'issues' button
 */
export function set_issue_count () {
    let count = 0
    if (oreqm_main) {
      count = oreqm_main.get_problem_count()
    }
    document.getElementById('issueCount').innerHTML = count
  }
