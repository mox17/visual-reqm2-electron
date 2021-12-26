import path from 'path'
import fs from 'fs'
import { ipcRenderer } from 'electron'
import { set_search_language, set_search_pattern, set_excluded_doctypes } from "./search"
import { save_diagram_file, oreqm_main } from './main_data'
import { show_doctypes, show_doctypes_safety } from './show_diagram'

export let diagram_format = 'svg'
export let output_filename = 'diagram'
/** @global {string[]} Queue of operations for command line operations */
const cmd_queue = []


/**
 * Handle command line parameters related to 'batch' execution
 * @param {object} args the input argument object
 */
 export function cmd_line_parameters (args) {
    if (args.select !== undefined) {
      set_search_pattern(args.select)
      document.getElementById('search_regex').value = args.select
    }
    // Override settings search language with cmd line options
    if (args.vql) {
      document.getElementById('vql_checkbox_input').checked = true
      set_search_language('vql')
    } else if (args.regex) {
      document.getElementById('regex_checkbox_input').checked = true
      set_search_language('reg')
    } else if (args.idOnly) {
      document.getElementById('id_checkbox_input').checked = true
      set_search_language('ids')
    }
    document.getElementById('limit_depth_input').checked = args.limitDepth //rq: ->(rq_limited_walk_cl)
    if (args.exclIds !== undefined) {
      document.getElementById('excluded_ids').value = args.exclIds.replaceAll(',', '\n')
    }
    document.getElementById('no_rejects').checked = !args.inclRejected
    if (args.exclDoctypes !== undefined) {
      set_excluded_doctypes(args.exclDoctypes.split(','))
    }
    diagram_format = args.format
    output_filename = 'diagram'
    if (args.output !== undefined) {
      output_filename = args.output
    }
    // istanbul ignore next
    if (process.env.PORTABLE_EXECUTABLE_APP_FILENAME && (args.output !== undefined) && !path.isAbsolute(output_filename)) {
      // Add PWD as start of relative path
      if (process.env.PWD) {
        output_filename = path.join(process.env.PWD, output_filename)
        console.log('Updated output path:', output_filename)
      } else {
        alert('Define PWD in environment or specify absolute paths.')
      }
    }
    // The pending commands are pushed on a queue.
    // The asynchronous completion of diagrams will
    // trigger processing of the queue.
    if (args.diagram) {
      cmd_queue.push('save-diagram') //rq: ->(rq_automatic_diagram)
    }
    if (args.hierarchy) {
      cmd_queue.push('hierarchy')
      cmd_queue.push('save-hierarchy')
    }
    if (args.safety) {
      cmd_queue.push('safety')
      cmd_queue.push('save-safety')
    }
    if (args.diagram||args.hierarchy||args.safety) {
      cmd_queue.push('done')
      // cmd_queue.push('quit')  // TODO: consider implied quit when diagram generation is specified
    }
    if (args.quit) {
      // istanbul ignore next
      cmd_queue.push('quit')
    }
    // console.log("queue:", cmd_queue);
  }

  /**
 * Check for pending command line operations.
 * This function is called on completion of a diagram.
 * The next step is triggered via the main process.
 */
export function check_cmd_line_steps () {
  // console.log("Check queue:", cmd_queue);
  if (cmd_queue.length) {
    const next_operation = cmd_queue.shift()
    // console.log(`Next operation '${next_operation}'`);
    const filename = output_filename
    let diagram_file = ''
    let problems = ''
    switch (next_operation) {
      case 'save-diagram':
        diagram_file = `${filename}-diagram.${diagram_format}`
        // console.log(diagram_file);
        save_diagram_file(diagram_file)
        ipcRenderer.send('cmd_echo', 'next')
        break

      case 'hierarchy':
        // Trigger generation of doctype diagram
        show_doctypes()
        break

      case 'save-hierarchy':
        diagram_file = `${filename}-doctypes.${diagram_format}`
        // console.log(diagram_file);
        save_diagram_file(diagram_file)
        ipcRenderer.send('cmd_echo', 'next')
        break

      case 'safety':
        // Trigger generation of safety diagram
        show_doctypes_safety()
        break

      case 'save-safety':
        diagram_file = `${filename}-safety.${diagram_format}`
        // console.log(diagram_file);
        save_diagram_file(diagram_file)
        ipcRenderer.send('cmd_echo', 'next')
        break

      case 'done':
        document.getElementById('vrm2_batch').innerHTML = 'done'
        ipcRenderer.send('cmd_echo', 'next')
        break;

      // istanbul ignore next
      case 'quit':
        diagram_file = `${filename}-issues.txt`
        problems = oreqm_main.get_problems()
        fs.writeFileSync(diagram_file, problems, 'utf8')
        ipcRenderer.send('cmd_quit')
        break

      // istanbul ignore next
      default:
        // istanbul ignore next
        console.log(`Unknown operation '${next_operation}'`)
    }
    document.getElementById('vrm2_batch').innerHTML = next_operation
  }
}

