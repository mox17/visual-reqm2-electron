'use strict'
import path from 'path'
import fs from 'fs'
import { ipcRenderer } from 'electron'
import { setSearchLanguage, setSearchPattern, setExcludedDoctypes } from "./search"
import { saveDiagramFile, oreqmMain } from './main_data'
import { showDoctypes, showDoctypesSafety } from './show_diagram'
import { showAlert } from './util'

export let diagramFormat = 'svg'
export let outputFilename = 'diagram'
/** @global {string[]} Queue of operations for command line operations */
const cmdQueue = []


/**
 * Handle command line parameters related to 'batch' execution
 * @param {object} args the input argument object
 */
 export function cmdLineParameters (args) {
    if (args.select !== undefined) {
      setSearchPattern(args.select)
      document.getElementById('search_regex').value = args.select
    }
    // Override settings search language with cmd line options
    if (args.vql) {
      document.getElementById('vql_radio_input').checked = true
      setSearchLanguage('vql')
    } else if (args.regex) {
      document.getElementById('regex_radio_input').checked = true
      setSearchLanguage('reg')
    } else if (args.idOnly) {
      document.getElementById('id_radio_input').checked = true
      setSearchLanguage('ids')
    }
    document.getElementById('limit_depth_input').checked = args.limitDepth //rq: ->(rq_limited_walk_cl)
    if (args.exclIds !== undefined) {
      document.getElementById('excluded_ids').value = args.exclIds.replaceAll(',', '\n')
    }
    document.getElementById('no_rejects').checked = !args.inclRejected
    if (args.exclDoctypes !== undefined) {
      setExcludedDoctypes(args.exclDoctypes.split(','))
    }
    diagramFormat = args.format
    outputFilename = 'diagram'
    if (args.output !== undefined) {
      outputFilename = args.output
    }
    // istanbul ignore next
    if (process.env.PORTABLE_EXECUTABLE_APP_FILENAME && (args.output !== undefined) && !path.isAbsolute(outputFilename)) {
      // Add PWD as start of relative path
      if (process.env.PWD) {
        outputFilename = path.join(process.env.PWD, outputFilename)
        console.log('Updated output path:', outputFilename)
      } else {
        showAlert('Define PWD in environment or specify absolute paths.')
      }
    }
    // The pending commands are pushed on a queue.
    // The asynchronous completion of diagrams will
    // trigger processing of the queue.
    if (args.diagram) {
      cmdQueue.push('save-diagram') //rq: ->(rq_automatic_diagram)
    }
    if (args.hierarchy) {
      cmdQueue.push('hierarchy')
      cmdQueue.push('save-hierarchy')
    }
    if (args.safety) {
      cmdQueue.push('safety')
      cmdQueue.push('save-safety')
    }
    if (args.diagram||args.hierarchy||args.safety) {
      cmdQueue.push('done')
      // cmdQueue.push('quit')  // TODO: consider implied quit when diagram generation is specified
    }
    if (args.quit) {
      // istanbul ignore next
      cmdQueue.push('quit')
    }
    // console.log("queue:", cmd_queue);
    if (!cmdQueue.length) {
      // Nothing to do - helps test scripts
      document.getElementById('vrm2_batch').innerHTML = 'done'
    }
  }

  /**
 * Check for pending command line operations.
 * This function is called on completion of a diagram.
 * The next step is triggered via the main process.
 */
export function checkCmdLineSteps () {
  // console.log("Check queue:", cmd_queue);
  if (cmdQueue.length) {
    const nextOperation = cmdQueue.shift()
    // console.log(`Next operation '${next_operation}'`);
    const filename = outputFilename
    let diagramFile = ''
    let problems = ''
    switch (nextOperation) {
      case 'save-diagram':
        diagramFile = `${filename}-diagram.${diagramFormat}`
        // console.log(diagramFile);
        saveDiagramFile(diagramFile)
        ipcRenderer.send('cmd_echo', 'next')
        break

      case 'hierarchy':
        // Trigger generation of doctype diagram
        showDoctypes()
        break

      case 'save-hierarchy':
        diagramFile = `${filename}-doctypes.${diagramFormat}`
        // console.log(diagramFile);
        saveDiagramFile(diagramFile)
        ipcRenderer.send('cmd_echo', 'next')
        break

      case 'safety':
        // Trigger generation of safety diagram
        showDoctypesSafety()
        break

      case 'save-safety':
        diagramFile = `${filename}-safety.${diagramFormat}`
        // console.log(diagramFile);
        saveDiagramFile(diagramFile)
        ipcRenderer.send('cmd_echo', 'next')
        break

      case 'done':
        document.getElementById('vrm2_batch').innerHTML = 'done'
        ipcRenderer.send('cmd_echo', 'next')
        break;

      // istanbul ignore next
      case 'quit':
        diagramFile = `${filename}-issues.txt`
        problems = oreqmMain.getProblems()
        fs.writeFileSync(diagramFile, problems, 'utf8')
        ipcRenderer.send('cmd_quit')
        break

      // istanbul ignore next
      default:
        // istanbul ignore next
        console.log(`Unknown operation '${nextOperation}'`)
    }
    document.getElementById('vrm2_batch').innerHTML = nextOperation
  }
}

