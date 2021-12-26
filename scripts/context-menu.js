import { oreqm_main } from "./main_data"
import { search_language } from "./search"
import { filter_change, selected_node } from "./show_diagram"
import { clipboard } from "electron"

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

