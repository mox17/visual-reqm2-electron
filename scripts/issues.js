'use strict'
import { oreqm_main } from "./main_data"
import { remote } from "electron"
import { fs } from "fs"


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

  export function save_problems () {
    //rq: ->(rq_issues_file_export)
    const problems = oreqm_main.get_problems()
    const SavePath = remote.dialog.showSaveDialogSync(null, {
      filters: [{ name: 'TXT files', extensions: ['txt'] }],
      properties: ['openFile']
    })
    if (typeof (SavePath) !== 'undefined') {
      fs.writeFileSync(SavePath, problems, 'utf8')
    }
  }

