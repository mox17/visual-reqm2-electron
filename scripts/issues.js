'use strict'
import { oreqmMain } from "./main_data"
import { remote } from "electron"
import fs from 'fs'


/**
 * Update count in 'issues' button
 */
export function setIssueCount () {
  let count = 0
  // istanbul ignore else
  if (oreqmMain) {
    count = oreqmMain.getProblemCount()
  }
  document.getElementById('issueCount').innerHTML = count
}

export function saveProblems () {
  //rq: ->(rq_issues_file_export)
  const problems = oreqmMain.getProblems()
  const SavePath = remote.dialog.showSaveDialogSync(null, {
    filters: [{ name: 'TXT files', extensions: ['txt'] }],
    properties: ['openFile']
  })
  if (typeof (SavePath) !== 'undefined') {
    fs.writeFileSync(SavePath, problems, 'utf8')
  }
}
