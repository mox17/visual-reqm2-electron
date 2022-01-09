'use strict'
import { oreqmMain, oreqmRef, convertSvgToPng, svgResult } from "./main_data"
import { searchLanguage } from "./search"
import { filterChange, selectedNode } from "./show_diagram"
import { clipboard } from "electron"
import { base64StringToBlob } from 'blob-util'
import { xmlEscape } from "./diagrams"
import { showAlert } from "./util"

// Setup for the raw node display dialog (raw text and diff (for changed reqs))
export const nodeSource = document.getElementById('nodeSource')

// Get the <span> element that closes the modal
const nodeSourceClose = document.getElementById('nodeSourceClose')

// When the user clicks on <span> (x), close the modal
nodeSourceClose.onclick = function () {
  nodeSource.style.display = 'none'
}

export function addNodeToSelection (node) {
  // istanbul ignore else
  if (oreqmMain && oreqmMain.checkNodeId(node)) {
    let searchPattern = document.getElementById('search_regex').value.trim()

    if (searchLanguage === 'vql') {
      // For VQL the '@' prefixed string allows () and [] in name
      // Prefix with id: and end with '$'
      let idStr = `@id:${remDupSuffix(node)}$`
      if (!searchPattern.includes(idStr)) {
        if (searchPattern.length) {
          idStr = '\nor ' + idStr
        }
        searchPattern += idStr
        document.getElementById('search_regex').value = searchPattern
        filterChange()
      }
    } else {
      let nodeSelectStr = escRegexMetaChars(remDupSuffix(node))+'$'
      if (!searchPattern.includes(nodeSelectStr)) {
        if (searchPattern.length) {
          nodeSelectStr = '\n|' + nodeSelectStr
        }
        searchPattern += nodeSelectStr
        document.getElementById('search_regex').value = searchPattern
        filterChange()
      }
    }
  }
}

// For duplicates remove the disambiguating id suffix of :\d and check if it is valid
function remDupSuffix (str) {
  const pureId = str.replace(/:\d+$/, '')
  if (oreqmMain.duplicates.has(pureId)) {
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

export function menuDeselect () {
  // Remove node to the selection criteria (if not already selected)
  //rq: ->(rq_ctx_deselect)
  // istanbul ignore else
  if (oreqmMain && oreqmMain.checkNodeId(selectedNode)) {
    let newSearchPattern
    let searchPattern
    const orgSearchPattern = document.getElementById('search_regex').value.trim()
    if (searchLanguage === 'vql') {
      let idStr = `@id:${remDupSuffix(selectedNode)}$`
      let idStrOr = '\nor ' + idStr
      newSearchPattern = orgSearchPattern
      searchPattern = orgSearchPattern
      if (orgSearchPattern.includes(idStrOr)) {
        newSearchPattern = orgSearchPattern.replace(idStrOr, '')
      } else if (orgSearchPattern.includes(idStr)) {
        // Check if removing the 1st of several selected nodes, i.e. remove separating 'or'
        let trailingOr = idStr + '\nor '
        if (orgSearchPattern.includes(trailingOr)) {
          newSearchPattern = orgSearchPattern.replace(trailingOr, '')
        } else {
          newSearchPattern = orgSearchPattern.replace(idStr, '')
        }
      }
    } else {
      const node = escRegexMetaChars(escRegexMetaChars(remDupSuffix(selectedNode)))
      const nodeSelectStr = new RegExp(`(^|\\|)${node}\\$`)
      searchPattern = orgSearchPattern.replace(/\n/g, '')
      newSearchPattern = searchPattern.replace(nodeSelectStr, '')
      if (newSearchPattern[0] === '|') {
        newSearchPattern = newSearchPattern.slice(1)
      }
      newSearchPattern = newSearchPattern.replace(/\|/g, '\n|')
    }
    if (newSearchPattern !== searchPattern) {
      document.getElementById('search_regex').value = newSearchPattern
      // console.log("deselect_node() - search ", node, search_pattern, new_search_pattern)
      filterChange()
    } else {
      const alertText = `'${selectedNode}' is not a selected node\nPerhaps try 'Exclude'?`
      showAlert(alertText)
    }
  }
}

export function excludeId () {
  // Add node to the exclusion list
  //rq: ->(rq_ctx_excl)
  // istanbul ignore else
  if (oreqmMain && oreqmMain.checkNodeId(selectedNode)) {
    let excludedIds = document.getElementById('excluded_ids').value.trim()
    if (excludedIds.length) {
      excludedIds += '\n' + selectedNode
    } else {
      excludedIds = selectedNode
    }
    document.getElementById('excluded_ids').value = excludedIds
    filterChange()
  }
}

/**
 * Put id of selected specobject on clipboard in selected format
 * @param {boolean} ffbFormat true: id:doctype:version ; false: id
 */
 export function copyIdNode (ffbFormat) {
  let txt
  const rec = oreqmMain.requirements.get(selectedNode)
  if (ffbFormat) {
    txt = `${rec.id}:${rec.doctype}:${rec.version}` //rq: ->(rq_ctx_copy_id_dt_ver)
  } else {
    txt = rec.id //rq: ->(rq_ctx_copy_id)
  }
  clipboard.writeText(txt)
}

export function copyPng () {
  convertSvgToPng(svgResult, pngCallback)
}

/**
 * Create binary blob of png and put on clipboard
 * @param {null} ev event
 * @param {string} png image as string
 */
function pngCallback (ev, png) {
  // istanbul ignore else
  if (ev === null) {
    const imageBlob = base64StringToBlob(png.src.slice(22), 'image/png')
    // console.log(imageBlob)
    const item = new ClipboardItem({ 'image/png': imageBlob })
    // console.log(item)
    navigator.clipboard.write([item]).then(function () {
      // console.log("Copied to clipboard successfully!");
    },
    // istanbul ignore next
    function (_error) {
      // console.error("unable to write to clipboard. Error:");
      // console.log(_error);
    })
  }
}

/**
 * Show selected node as XML in the source code modal (html)
 */
 export function showSource () {
  // istanbul ignore else
  if (selectedNode.length) {
    const ref = document.getElementById('req_src')
    if (oreqmRef && oreqmMain.updatedReqs.includes(selectedNode)) {
      //rq: ->(rq_ctx_show_diff)
      // create a diff
      const textRef = xmlEscape(oreqmRef.getXmlString(selectedNode))
      const textMain = xmlEscape(oreqmMain.getXmlString(selectedNode))
      let result = '<h2>XML format (changed specobject)</h2><pre>'
      const diff = Diff.diffLines(textRef, textMain, {ignoreWhitespace: true})
      diff.forEach(function (part) {
        // green for additions, red for deletions, black for common parts
        const color = part.added ? 'green' : part.removed ? 'red' : 'grey'
        let font = 'normal'
        if (part.added || part.removed) {
          font = 'bold'
        }
        result += `<span style="color: ${color}; font-weight: ${font};">${srcAddPlusMinus(part)}</span>`
      })
      result += '</pre>'
      ref.innerHTML = result
    } else {
      //rq: ->(rq_ctx_show_xml)
      let headerMain = '<h2>XML format</h2>'
      if (oreqmMain.removedReqs.includes(selectedNode)) {
        headerMain = '<h2>XML format (removed specobject)</h2>'
      } else if (oreqmMain.newReqs.includes(selectedNode)) {
        headerMain = '<h2>XML format (new specobject)</h2>'
      }
      ref.innerHTML = `${headerMain}<pre>${xmlEscape(oreqmMain.getXmlString(selectedNode))}</pre>`
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
 function srcAddPlusMinus (part) {
  const insert = part.added ? '+' : part.removed ? '-' : ' '
  let txt = part.value
  const lastChar = txt.slice(-1)
  txt = txt.slice(0, -1)
  txt = insert + txt.split(/\n/gm).join('\n' + insert)
  return txt + lastChar
}

export function showInternal () {
  // Show selected node as internal tagged string
  // istanbul ignore else
  if (selectedNode.length) {
    const ref = document.getElementById('req_src')
    const headerMain = "<h2>Internal tagged 'search' format</h2>"
    const aTxt = oreqmMain.getAllText(selectedNode).replace(/\n/g, '\u21B5\n')
    ref.innerHTML = `${headerMain}<pre>${xmlEscape(aTxt)}</pre>`
    nodeSource.style.display = 'block'
  }
}
