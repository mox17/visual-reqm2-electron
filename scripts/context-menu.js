'use strict'
import { oreqm_main, oreqm_ref, convert_svg_to_png, svg_result } from "./main_data"
import { search_language } from "./search"
import { filter_change, selected_node } from "./show_diagram"
import { clipboard } from "electron"
import { base64StringToBlob } from 'blob-util'
import { xml_escape } from "./diagrams"

// Setup for the raw node display dialog (raw text and diff (for changed reqs))
export const nodeSource = document.getElementById('nodeSource')

// Get the <span> element that closes the modal
const nodeSourceClose = document.getElementById('nodeSourceClose')

// When the user clicks on <span> (x), close the modal
nodeSourceClose.onclick = function () {
  nodeSource.style.display = 'none'
}

export function add_node_to_selection (node) {
  if (oreqm_main && oreqm_main.check_node_id(node)) {
    let search_pattern = document.getElementById('search_regex').value.trim()

    if (search_language === 'vql') {
      // For VQL the '@' prefixed string allows () and [] in name
      // Prefix with id: and end with '$'
      let id_str = `@id:${remDupSuffix(node)}$`
      if (!search_pattern.includes(id_str)) {
        if (search_pattern.length) {
          id_str = '\nor ' + id_str
        }
        search_pattern += id_str
        document.getElementById('search_regex').value = search_pattern
        filter_change()
      }
    } else {
      let node_select_str = escRegexMetaChars(remDupSuffix(node))+'$'
      if (!search_pattern.includes(node_select_str)) {
        if (search_pattern.length) {
          node_select_str = '\n|' + node_select_str
        }
        search_pattern += node_select_str
        document.getElementById('search_regex').value = search_pattern
        filter_change()
      }
    }
  }
}

// For duplicates remove the disambiguating id suffix of :\d and check if it is valid
function remDupSuffix (str) {
  const pureId = str.replace(/:\d+$/, '')
  if (oreqm_main.duplicates.has(pureId)) {
    str = pureId;
  }
  return str
}

function escRegexMetaChars (str) {
  return str.replaceAll('\\', '\\\\')
            .replaceAll('^', '\\^')
            .replaceAll('$', '\\$')
//            .replaceAll('.', '\\.') // strictly speaking this should be included, but may confuse users not consciously using regex
            .replaceAll('|', '\\|')
            .replaceAll('?', '\\?')
            .replaceAll('*', '\\*')
            .replaceAll('+', '\\+')
            .replaceAll('(', '\\(')
            .replaceAll(')', '\\)')
            .replaceAll('[', '\\[')
            .replaceAll('{', '\\{')
}

export function menu_deselect () {
  // Remove node to the selection criteria (if not already selected)
  //rq: ->(rq_ctx_deselect)
  if (oreqm_main && oreqm_main.check_node_id(selected_node)) {
    let new_search_pattern
    let search_pattern
    const org_search_pattern = document.getElementById('search_regex').value.trim()
    if (search_language === 'vql') {
      let id_str = `@id:${remDupSuffix(selected_node)}$`
      let id_str_or = '\nor ' + id_str
      new_search_pattern = org_search_pattern
      search_pattern = org_search_pattern
      if (org_search_pattern.includes(id_str_or)) {
        new_search_pattern = org_search_pattern.replace(id_str_or, '')
      } else if (org_search_pattern.includes(id_str)) {
        // Check if removing the 1st of several selected nodes, i.e. remove separating 'or'
        let trailing_or = id_str + '\nor '
        if (org_search_pattern.includes(trailing_or)) {
          new_search_pattern = org_search_pattern.replace(trailing_or, '')
        } else {
          new_search_pattern = org_search_pattern.replace(id_str, '')
        }
      }
    } else {
      const node = escRegexMetaChars(escRegexMetaChars(remDupSuffix(selected_node)))
      const node_select_str = new RegExp(`(^|\\|)${node}\\$`)
      search_pattern = org_search_pattern.replace(/\n/g, '')
      new_search_pattern = search_pattern.replace(node_select_str, '')
      if (new_search_pattern[0] === '|') {
        new_search_pattern = new_search_pattern.slice(1)
      }
      new_search_pattern = new_search_pattern.replace(/\|/g, '\n|')
    }
    if (new_search_pattern !== search_pattern) {
      document.getElementById('search_regex').value = new_search_pattern
      // console.log("deselect_node() - search ", node, search_pattern, new_search_pattern)
      filter_change()
    } else {
      const alert_text = `'${selected_node}' is not a selected node\nPerhaps try 'Exclude'?`
      alert(alert_text)
    }
  }
}

export function exclude_id () {
  // Add node to the exclusion list
  //rq: ->(rq_ctx_excl)
  if (oreqm_main && oreqm_main.check_node_id(selected_node)) {
    let excluded_ids = document.getElementById('excluded_ids').value.trim()
    if (excluded_ids.length) {
      excluded_ids += '\n' + selected_node
    } else {
      excluded_ids = selected_node
    }
    document.getElementById('excluded_ids').value = excluded_ids
    filter_change()
  }
}

/**
 * Put id of selected specobject on clipboard in selected format
 * @param {boolean} ffb_format true: id:doctype:version ; false: id
 */
 export function copy_id_node (ffb_format) {
  let txt
  const rec = oreqm_main.requirements.get(selected_node)
  if (ffb_format) {
    txt = `${rec.id}:${rec.doctype}:${rec.version}` //rq: ->(rq_ctx_copy_id_dt_ver)
  } else {
    txt = rec.id //rq: ->(rq_ctx_copy_id)
  }
  clipboard.writeText(txt)
}

export function copy_png () {
  convert_svg_to_png(svg_result, png_callback)
}

/**
 * Create binary blob of png and put on clipboard
 * @param {null} ev event
 * @param {string} png image as string
 */
function png_callback (ev, png) {
  // istanbul ignore else
  if (ev === null) {
    const image_blob = base64StringToBlob(png.src.slice(22), 'image/png')
    // console.log(image_blob)
    const item = new ClipboardItem({ 'image/png': image_blob })
    // console.log(item)
    navigator.clipboard.write([item]).then(function () {
      // console.log("Copied to clipboard successfully!");
    }, function (_error) {
      // console.error("unable to write to clipboard. Error:");
      // console.log(_error);
    })
  }
}

/**
 * Show selected node as XML in the source code modal (html)
 */
 export function show_source () {
  if (selected_node.length) {
    const ref = document.getElementById('req_src')
    if (oreqm_ref && oreqm_main.updated_reqs.includes(selected_node)) {
      //rq: ->(rq_ctx_show_diff)
      // create a diff
      const text_ref = xml_escape(oreqm_ref.get_xml_string(selected_node))
      const text_main = xml_escape(oreqm_main.get_xml_string(selected_node))
      let result = '<h2>XML format (changed specobject)</h2><pre>'
      const diff = Diff.diffLines(text_ref, text_main, {ignoreWhitespace: true})
      diff.forEach(function (part) {
        // green for additions, red for deletions, black for common parts
        const color = part.added ? 'green' : part.removed ? 'red' : 'grey'
        let font = 'normal'
        if (part.added || part.removed) {
          font = 'bold'
        }
        result += `<span style="color: ${color}; font-weight: ${font};">${src_add_plus_minus(part)}</span>`
      })
      result += '</pre>'
      ref.innerHTML = result
    } else {
      //rq: ->(rq_ctx_show_xml)
      let header_main = '<h2>XML format</h2>'
      if (oreqm_main.removed_reqs.includes(selected_node)) {
        header_main = '<h2>XML format (removed specobject)</h2>'
      } else if (oreqm_main.new_reqs.includes(selected_node)) {
        header_main = '<h2>XML format (new specobject)</h2>'
      }
      ref.innerHTML = `${header_main}<pre>${xml_escape(oreqm_main.get_xml_string(selected_node))}</pre>`
    }
    nodeSource.style.display = 'block'
  }
}

/**
 * Add git style '+', '-' in front of changed lines.
 * The part can be multi-line and is expected to end with a newline
 * @param {object} part diff object
 * @return {string} updated string
 */
 function src_add_plus_minus (part) {
  const insert = part.added ? '+' : part.removed ? '-' : ' '
  let txt = part.value
  const last_char = txt.slice(-1)
  txt = txt.slice(0, -1)
  txt = insert + txt.split(/\n/gm).join('\n' + insert)
  return txt + last_char
}

export function show_internal () {
  // Show selected node as internal tagged string
  if (selected_node.length) {
    const ref = document.getElementById('req_src')
    const header_main = "<h2>Internal tagged 'search' format</h2>"
    const a_txt = oreqm_main.get_all_text(selected_node).replace(/\n/g, '\u21B5\n')
    ref.innerHTML = `${header_main}<pre>${xml_escape(a_txt)}</pre>`
    nodeSource.style.display = 'block'
  }
}
