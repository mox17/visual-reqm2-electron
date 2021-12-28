'use strict'
import { oreqm_main } from "./main_data"
import { xml_escape } from "./diagrams"
import { remote } from "electron"
import { fs } from "fs"

export const problemPopup = document.getElementById('problemPopup')

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

  export function show_problems () {
    // Show problems colleced in oreqm_main
    const ref = document.getElementById('problem_list')
    const header_main = '\n<h2>Detected problems</h2>\n'
    let problem_txt = 'Nothing to see here...'
    if (oreqm_main) {
      problem_txt = xml_escape(oreqm_main.get_problems())
    }
    ref.innerHTML = `${header_main}<pre id="raw_problems">${problem_txt}</pre>`
    problemPopup.style.display = 'block'
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

  export function clear_problems () {
    if (oreqm_main) {
      oreqm_main.clear_problems()
      document.getElementById('issueCount').innerHTML = 0
      show_problems()
    }
  }
