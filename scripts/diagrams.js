/* Main class for managing oreqm xml data */
"use strict";

import ReqM2Specobjects from './reqm2oreqm.js'
import get_color from './color.js'
import Doctype from './doctypes.js'
import { remote } from 'electron'
import fs from 'fs'

var accepted_safety_class_links_re = [
  /^\w+:>\w+:$/,           // no safetyclass -> no safetyclass
  /^\w+:QM>\w+:$/,         // QM -> no safetyclass
  /^\w+:SIL-2>\w+:$/,      // SIL-2 -> no safetyclass
  /^\w+:QM>\w+:QM$/,       // QM -> QM
  /^\w+:SIL-2>\w+:QM$/,    // SIL-2 -> QM
  /^\w+:SIL-2>\w+:SIL-2$/, // SIL-2 -> SIL-2
  /^impl.*>.*$/,           // impl can cover anything (maybe?)
  /^swintts.*>.*$/,        // swintts can cover anything (maybe?)
  /^swuts.*>.*$/           // swuts can cover anything (maybe?)
]

export function xml_escape(txt) {
  // Escape string for usen in XML
  return txt.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function normalize_indent(txt) {
  // Normalize indentation of multiline string
  txt = txt.replace(/\r/, '')  // no cr
  txt = txt.replace(/\t/, '  ')  // no tabs
  txt = txt.replace(/^(\s*\n)+/, '') // empty initial line
  txt = txt.replace(/(\n\s*)+$/m, '') // empty final line
  let line_arr = txt.split('\n')
  // Calculate smallest amount of leading whitespace
  let min_leading = 100
  let match = line_arr[0].match(/^\s+/)
  let first_length = 0
  if (match) {
    first_length = line_arr[0].match(/^\s+/)[0].length
  }
  for (let i=1; i<line_arr.length; i++) {
     match = line_arr[i].match(/^\s+/)
    if (match) {
      const leading = match[0].length
      if ( leading < min_leading) min_leading = leading
    } else {
      min_leading = 0
    }
  }
  // Heuristic that 1st line may mave no indentation because of the xml is written
  if (line_arr.length > 1) {
    if (first_length < min_leading) {
      line_arr[0] = ' '.repeat(min_leading-first_length) + line_arr[0]
    }
  } else {
    min_leading = first_length
  }
  // Remove that amount from all strings
  for (let i=0; i<line_arr.length; i++) {
    line_arr[i] = line_arr[i].slice(min_leading)
  }
  txt = line_arr.join('\n')
  return txt
}

// Regexes for "make requirements readable" heuristics
const re_xml_comments = new RegExp(/<!--.*?-->/g, 'm')
//const re_unwanted_mu  = new RegExp(/<!\[CDATA\[\s*/g, 'm')
//const re_amp_quote    = new RegExp(/&/g, 'm')
//const re_list_heurist = new RegExp(/<li>[\s\n]*|<listitem>[\s\n]*/g, 'm')
const re_tag_text     = new RegExp(/<a\s+type="xref"\s+href="[A-Z]+_([^"]+)"\s*\/>/g, 'm')
//const re_xml_remove   = new RegExp(/<\/?ul>|<\/?itemizedlist>|<\/listitem>|<\/li>|<\/para>/g, 'm')
const re_whitespace   = new RegExp(/^[\s\n]*|\s\n]*$/)
const re_nbr_list     = new RegExp(/\n\s+(\d+)/g)
const re_line_length  = new RegExp(/([^\n]{110,500}?(:|;| ))/g)
//const re_keep_nl      = new RegExp(/\s*\n\s*/)
const re_empty_lines  = new RegExp(/<BR ALIGN="LEFT"\/>(\s*&nbsp;<BR ALIGN="LEFT"\/>)+/, 'm')

function dot_format(txt) {
  //Remove xml style formatting not compliant with dot
  let txt2
  let new_txt = ''
  if (txt.length) {
    txt = normalize_indent(txt)
    txt = txt.split(re_xml_comments).join('') // remove XML comments
    // txt = txt.replace(re_unwanted_mu, '')  // Remove unwanted markup
    // Handle unicode literals
    txt = txt.replace(/&#(\d+);/g, function (whole, group1) {return String.fromCharCode(parseInt(group1, 10));})
    //txt = txt.replace(/\\u([0-9a-f]{4})/g, function (whole, group1) {return String.fromCharCode(parseInt(group1, 16));})
    // neuter unknown, unepanded xml elements
    txt2 = txt.split(/&(?!lt;|gt;|quot;|amp;|nbsp;)/gm)
    if (txt2.length > 1) {
      txt = txt2.join('&amp;')
    }
    //new_txt = txt.replace(re_list_heurist, '&nbsp;&nbsp;* ') // heuristic for bulleted lists
    new_txt = txt.split(/<li>[\s\n]*|<listitem>[\s\n]*/).join('&nbsp;&nbsp;* ') // heuristic for bulleted lists
    // Dig out meaningful text from items like:
    // <a type="xref" href="TERM_UNAUTHORIZED_EXECUTABLE_ENTITIES"/>
    new_txt = new_txt.replace(re_tag_text, '$1')
    new_txt = new_txt.split(/<br\s*\/>|<\/?p>/i).join('&nbsp;\n') // keep deliberate newlines
    new_txt = new_txt.split(/<\/?ul>|<\/?itemizedlist>|<\/listitem>|<\/li>|<\/?para>|<a\s[^>/]*\/?>|<\/a>|<\/?filename>|<\/?code>|<\/?function>|<\/?pre>|<\/glossterm>|<glossterm [^>]+>/).join('') // remove xml markup
    new_txt = new_txt.replace(re_whitespace, '') // remove leading and trailing whitespace
    new_txt = new_txt.replace(/"/g, '&quot;')
    new_txt = new_txt.replace(/</g, '&lt;')
    new_txt = new_txt.replace(/>/g, '&gt;')
    new_txt = new_txt.replace(re_nbr_list, '\n&nbsp;&nbsp;$1') // heuristic for numbered lists
    new_txt = new_txt.replace(re_line_length, '$1\n') // limit line length
    new_txt = new_txt.split(/\s*\n/).join('<BR ALIGN="LEFT"/>') // preserve newlines
    new_txt = new_txt.replace(/^(\s*(&nbsp;)*<BR ALIGN="LEFT"\/>)+/, '') // remove blank leading lines
    new_txt = new_txt.replace(re_empty_lines, '<BR ALIGN="LEFT"/>&nbsp;<BR ALIGN="LEFT"/>') // Limit empty lines
    new_txt = new_txt.replace(/\r/, '')  // no cr
    if (!new_txt.endsWith('<BR ALIGN="LEFT"/>')) {
      new_txt += '<BR ALIGN="LEFT"/>'
    }
  }
  return new_txt
}

function format_violations(vlist, rules) {
  let str = 'violations:\n  <itemizedlist>\n'
  for (const v of vlist) {
    if (rules.has(v)) {
      str += '    <listitem>' + rules.get(v) + '</listitem>\n'
    } else {
      str += '    <listitem>' + v + '</listitem>\n'
    }
  }
  str += '  </itemizedlist>\n'
  return str
}

function format_node(node_id, rec, ghost, oreqm) {
  // Create 'dot' style 'html' table entry for the specobject. Rows without data are left out
  let node_table = ""
  let violations    = rec.violations.length ? '        <TR><TD COLSPAN="3" ALIGN="LEFT" BGCOLOR="#FF6666">{}</TD></TR>\n'.format(dot_format(format_violations(rec.violations, oreqm.rules))) : ''
  let furtherinfo     = rec.furtherinfo     ? '        <TR><TD COLSPAN="3" ALIGN="LEFT">furtherinfo: {}</TD></TR>\n'.format(dot_format(rec.furtherinfo)) : ''
  let safetyrationale = rec.safetyrationale ? '        <TR><TD COLSPAN="3" ALIGN="LEFT">safetyrationale: {}</TD></TR>\n'.format(dot_format(rec.safetyrationale)) : ''
  let shortdesc       = rec.shortdesc       ? '        <TR><TD COLSPAN="3" ALIGN="LEFT">shortdesc: {}</TD></TR>\n'.format(dot_format(rec.shortdesc)) : ''
  let rationale       = rec.rationale       ? '        <TR><TD COLSPAN="3" ALIGN="LEFT">rationale: {}</TD></TR>\n'.format(dot_format(rec.rationale)) : ''
  let verifycrit      = rec.verifycrit      ? '        <TR><TD COLSPAN="3" ALIGN="LEFT">{}</TD></TR>\n'.format(dot_format(rec.verifycrit)) : ''
  let comment         = rec.comment         ? '        <TR><TD COLSPAN="3" ALIGN="LEFT">comment: {}</TD></TR>\n'.format(dot_format(rec.comment)) : ''
  let source          = rec.source          ? '        <TR><TD COLSPAN="3" ALIGN="LEFT">source: {}</TD></TR>\n'.format(dot_format(rec.source)) : ''
  let status          = rec.status          ? '        <TR><TD>{}</TD><TD>{}</TD><TD>{}</TD></TR>\n'.format(tags_line(rec.tags, rec.platform), rec.safetyclass, rec.status) : ''
  node_table     = `
      <TABLE BGCOLOR="{}{}" BORDER="1" CELLSPACING="0" CELLBORDER="1" COLOR="{}" >
        <TR><TD CELLSPACING="0" >{}</TD><TD>{}</TD><TD>{}</TD></TR>
        <TR><TD COLSPAN="2" ALIGN="LEFT">{}</TD><TD>{}</TD></TR>\n{}{}{}{}{}{}{}{}{}      </TABLE>`.format(
                        get_color(rec.doctype),
                        ghost ? ':white' : '',
                        ghost ? 'grey' : 'black',
                        node_id, rec.version, rec.doctype,
                        dot_format(rec.description), rec.needsobj.join('<BR/>'),
                        shortdesc,
                        rationale,
                        safetyrationale,
                        verifycrit,
                        comment,
                        furtherinfo,
                        source,
                        status,
                        violations)
  let node = '  "{}" [id="{}" label=<{}>];\n'.format(node_id, node_id, node_table)
  return node
}

function format_edge(from_node, to_node, kind) {
  // Format graph edge according to coverage type
  let formatting = ""
  if (kind === "fulfilledby") {
    formatting = ' [style=bold color=purple dir=back fontname="Arial" label="ffb"]'
  }
  return '  "{}" -> "{}"{};\n'.format(from_node, to_node, formatting)
}

function tags_line(tags, platforms) {
  // Combine tags and platforms into one cell in table
  let line = []
  if (tags.length) {
    let tag_str = "tags: " + tags.join(", ")
    tag_str = tag_str.replace(/([^\n]{90,800}?, )/g, '$1<BR ALIGN="LEFT"/>')
    line.push(tag_str)
  }
  if (platforms.length) {
    let platform_str = "platforms: " + platforms.join(", ")
    platform_str = platform_str.replace(/([^\n]{90,800}?, )/g, '$1<BR ALIGN="LEFT"/>')
    line.push(platform_str)
  }
  if (line.length) {
    return line.join('<BR ALIGN="LEFT"/>')
  } else {
    return ""
  }
}

// ----- helper functions hierarchy diagrams

function sc_str(sc) {
  // Show the empty safetyclass as 'none'
  return (sc === '') ? 'none' : sc
}

function dt_sc_str(doctype_with_safetyclass) {
  // return string representation of safetyclass part of doctype
  return sc_str(doctype_with_safetyclass.split(':')[1])
}

function process_rule_set(new_rules) {
  let pass_test = true
  let regex_array = []
  if (new_rules.length > 0) {
    for (let rule of new_rules) {
      if (!(typeof(rule)==='string')) {
        alert('Expected an array of rule regex strings')
        pass_test = false
        break;
      }
      if (!rule.includes('>')) {
        alert('Expected ">" in regex')
        pass_test = false
        break
      }
      let regex_rule
      try {
        regex_rule = new RegExp(rule)
      }
      catch(err) {
        alert('Malformed regex: {}'.format(err.message))
        pass_test = false
        break
      }
      regex_array.push(regex_rule)
    }
    if (pass_test) {
      // Update tests
      accepted_safety_class_links_re = regex_array
      //console.log(accepted_safety_class_links_re)
    }
  } else {
    alert('Expected array of rule regex strings')
  }
}

export function load_safety_rules_fs() {
  let LoadPath = remote.dialog.showOpenDialogSync(
    {
      filters: [{ name: 'JSON files', extensions: ['json']}],
      properties: ['openFile']
    })
  if (typeof(LoadPath) !== 'undefined' && (LoadPath.length === 1)) {
    let new_rules = JSON.parse(fs.readFileSync(LoadPath[0], {encoding: 'utf8', flag: 'r'}))
    process_rule_set(new_rules)
  }
}


export function load_safety_rules()
{
  let input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json'

  input.onchange = e => {
    const file = e.target.files[0];
    let reader = new FileReader();
    reader.readAsText(file,'UTF-8');
    reader.onload = readerEvent => {
      const new_rules = JSON.parse(readerEvent.target.result);
      //console.log(new_rules)
      process_rule_set(new_rules)
    }
  }
  input.click();
}

export default class ReqM2Oreqm extends ReqM2Specobjects {

      // Fixed texts that form part of dot file
  static get DOT_PREAMBLE() {
    const preamble =
`digraph "" {
  rankdir="RL"
  node [shape=plaintext fontname="Arial" fontsize=16]
  edge [color="blue",dir="forward",arrowhead="normal",arrowtail="normal"];

`;
    return preamble;
  }

  static get DOT_EPILOGUE() {
    const epilogue = '\n}\n';
    return epilogue;
  }

  create_graph(selection_function, top_doctype, title, highlights) {
    // Return a 'dot' compatible graph with the subset of nodes nodes
    // accepted by the selection_function.
    // The 'TOP' node forces a sensible layout for highest level requirements
    // (some level of visual proximity and aligned to the left of the graph)
    let graph = ReqM2Oreqm.DOT_PREAMBLE;
    let subset = []
    const ids = this.requirements.keys()
    let node_count = 0
    let edge_count = 0
    let doctype_dict = new Map()
    let selected_dict = new Map()
    let sel_arr = []
    let selected_nodes = []
    for (const req_id of ids) {
      const rec = this.requirements.get(req_id)
      if (!doctype_dict.has(rec.doctype)) {
        doctype_dict.set(rec.doctype, [])
        selected_dict.set(rec.doctype, [])
      }
      if (selection_function(req_id, rec, this.color.get(req_id)) &&
          !this.excluded_doctypes.includes(rec.doctype) &&
          !this.excluded_ids.includes(req_id)) {
        subset.push(req_id)
        let dt = doctype_dict.get(rec.doctype)
        dt.push(req_id)
        doctype_dict.set(rec.doctype, dt)
        if (highlights.includes(req_id)) {
          sel_arr = selected_dict.get(rec.doctype)
          sel_arr.push(req_id)
          selected_dict.set(rec.doctype, sel_arr)
          selected_nodes.push(req_id)
        }
      }
    }
    let show_top = this.doctypes.has(top_doctype) && !this.excluded_doctypes.includes(top_doctype)
    if (show_top) {
      graph += '  "TOP" [fontcolor=lightgray];\n\n'
    }
    for (const req_id of subset) {
        // nodes
        const ghost = this.removed_reqs.includes(req_id)
        let node = format_node(req_id, this.requirements.get(req_id), ghost, this)
        let dot_id = req_id //.replace(/\./g, '_').replace(' ', '_')
        if (this.new_reqs.includes(req_id)) {
          node = 'subgraph "cluster_{}_new" { color=limegreen penwidth=1 label="new" fontname="Arial" labelloc="t"\n{}}\n'.format(dot_id, node)
        } else if (this.updated_reqs.includes(req_id)) {
          node = 'subgraph "cluster_{}_changed" { color=goldenrod1 penwidth=1 label="changed" fontname="Arial" labelloc="t"\n{}}\n'.format(dot_id, node)
        } else if (this.removed_reqs.includes(req_id)) {
          node = 'subgraph "cluster_{}_removed" { color=red penwidth=1 label="removed" fontname="Arial" labelloc="t"\n{}}\n'.format(dot_id, node)
        }
        if (highlights.includes(req_id)) {
          node = 'subgraph "cluster_{}" { id="sel_{}" color=maroon3 penwidth=3 label=""\n{}}\n'.format(dot_id, dot_id, node)
        }
        graph += node + '\n'
        node_count += 1
    }
    graph += '\n  # Edges\n'
    if (show_top) {
      for (const req_id of subset) {
        if (this.requirements.get(req_id).doctype === top_doctype) {
          graph += format_edge(req_id, 'TOP')
        }
      }
    }
    let kind = ''
    for (const req_id of subset) {
      // edges
      if (this.linksto.has(req_id)) {
        for (const link of this.linksto.get(req_id)) {
          // Do not reference non-selected specobjets
          if (subset.includes(link)) {
            if (this.fulfilledby.has(req_id) && this.fulfilledby.get(req_id).has(link)) {
              kind = "fulfilledby"
            } else {
              kind = null
            }
            graph += format_edge(req_id, link, kind)
            edge_count += 1
          }
        }
      }
    }
    graph += '\n  label={}\n  labelloc=b\n  fontsize=18\n  fontcolor=black\n  fontname="Arial"\n'.format(title)
    graph += ReqM2Oreqm.DOT_EPILOGUE
    this.dot = graph
    let result = new Object()
    //result.graph = graph
    result.node_count = node_count
    result.edge_count = edge_count
    result.doctype_dict = doctype_dict
    result.selected_dict = selected_dict
    selected_nodes.sort()
    result.selected_nodes = selected_nodes
    return result
  }

  linksto_safe(from, to) {
    // permitted safetyclass for providescoverage <from_safetyclass>:<to_safetyclass>
    let combo = "{}>{}".format(from, to)
    for (const re of accepted_safety_class_links_re) {
      if (combo.match(re)) {
        return true
      }
    }
    return false
  }

  linksto_safe_color(from, to) {
    // Color coded safefety
    return this.linksto_safe(from, to) ? '#00AA00' : '#FF0000'
  }

  scan_doctypes(doctype_safety) {
    // Scan all requirements and summarize the relationships between doctypes
    // with counts of instances and relations (needsobj, linksto, fulfilledby)
    // When doctype_safety is true, the doctypes are qualified with the safetyclass
    // of the requirement as in <doctype>:<safetyclass> and these are the nodes rendered
    let dt_map = new Map() // A map of { doctype_name : Doctype }
    let id_list = this.requirements.keys()
    let doctype = null
    let dest_doctype = null
    let basic_doctype = null
    let doctype_clusters = new Map() // {doctype : [doctype:safetyclass]}
    for (const id of id_list) {
      if (this.requirements.get(id).ffb_placeholder === true) {
        // skip placeholders
        continue;
      }
      // make a cluster of doctypes with the different safetyclasses
      basic_doctype = this.requirements.get(id).doctype
      if (!doctype_clusters.has(basic_doctype)) {
        doctype_clusters.set(basic_doctype, [])
      }
      doctype = this.safety_doctype(id, doctype_safety)
      if (!dt_map.has(doctype)) {
        dt_map.set(doctype, new Doctype(doctype))
        // Create clusters of refined doctypes, based on fundamental one
        if (!doctype_clusters.get(basic_doctype).includes(doctype)) {
          doctype_clusters.get(basic_doctype).push(doctype)
        }
      }

      //
      dt_map.get(doctype).add_instance(id)
      // linksto
      if (this.linksto.has(id)) {
        const linksto = Array.from(this.linksto.get(id))
        for (let linked_id of linksto) {
          if (this.requirements.has(linked_id)) {
            dest_doctype = this.safety_doctype(linked_id, doctype_safety)
            //console.log("add_linksto ", doctype, linked_id, dest_doctype)
            dt_map.get(doctype).add_linksto(dest_doctype, [linked_id, id])
          }
        }
      }
      // needsobj
      let need_list = Array.from(this.requirements.get(id).needsobj)
      for (let need of need_list) {
        if (!need.endsWith('*')) {
          if (doctype_safety) {
            // will need at least its own safetyclass
            dest_doctype = "{}:{}".format(need, this.requirements.get(id).safetyclass)
          } else {
            dest_doctype = need
          }
          //console.log("add_needsobj ", dest_doctype)
          dt_map.get(doctype).add_needsobj(dest_doctype)
        }
      }
      // fulfilledby
      let ffb_list = Array.from(this.requirements.get(id).fulfilledby)
      for (let ffb of ffb_list) {
        if (doctype_safety) {
          // will need at least its own safetyclass
          dest_doctype = "{}:{}".format(ffb[1], this.requirements.get(id).safetyclass)
        } else {
          dest_doctype = ffb[1]
        }
        //console.log("add_fulfilledby ", dest_doctype)
        dt_map.get(doctype).add_fulfilledby(dest_doctype, [id, ffb[0]])
      }

    }
    // DOT language start of diagram
    let graph = `digraph "" {
      rankdir="{}"
      node [shape=plaintext fontname="Arial" fontsize=16]
      edge [color="black" dir="forward" arrowhead="normal" arrowtail="normal" fontname="Arial" fontsize=11];

`.format(doctype_safety ? 'BT' : 'TD')
    // Define the doctype nodes - the order affects the layout
    const doctype_array = Array.from(doctype_clusters.keys())
    for (let doctype of doctype_array) {
      let doctypes_in_cluster = doctype_clusters.get(doctype)
      let sc_stats = ''
      let count_total = 0
      let sc_list = Array.from(doctypes_in_cluster.keys())
      sc_list.sort()
      let sc_string = ''
      for (const sub_doctype of doctypes_in_cluster) {
        let dt = dt_map.get(sub_doctype)
        let sc = sub_doctype.split(':')[1]
        sc_string += '</TD><TD port="{}">{}: {} '.format(sc_str(sc), sc_str(sc), dt.count)
        count_total += dt.count
      }
      if (doctype_safety) {
        sc_stats = '\n          <TR><TD>safetyclass:{}</TD></TR>'.format(sc_string)
      }
      let dt_node = `\
      "{}" [label=<
        <TABLE BGCOLOR="{}" BORDER="1" CELLSPACING="0" CELLBORDER="1" COLOR="black" >
        <TR><TD COLSPAN="5" CELLSPACING="0" >doctype: {}</TD></TR>
        <TR><TD COLSPAN="5" ALIGN="LEFT">specobject count: {}</TD></TR>{}
      </TABLE>>];\n\n`.format(
          doctype,
          get_color(doctype),
          doctype,
          count_total,
          sc_stats)
      graph += dt_node
    }
    let dt
    let count
    let doctype_edges = Array.from(dt_map.keys())
    // Loop over doctypes
    for (let doctype of doctype_edges) {
      dt = dt_map.get(doctype)
      // Needsobj links
      graph += '# linkage from {}\n'.format(doctype)
      let need_keys = Array.from(dt.needsobj.keys())
      if (!doctype_safety) {
        for (let nk of need_keys) {
          count = dt.needsobj.get(nk)
          graph += ' "{}" -> "{}" [label="need({}){} " style="dotted"]\n'.format(
            doctype.split(':')[0],
            nk.split(':')[0],
            count,
            doctype_safety ? '\n{}'.format(dt_sc_str(doctype)) : '')
        }
      }
      // linksto links
      let lt_keys = Array.from(dt.linksto.keys())
      for (let lk of lt_keys) {
        count = dt.linksto.get(lk).length
        graph += ' "{}" -> "{}" [label="linksto({}){} " color="{}"]\n'.format(
          doctype.split(':')[0],
          lk.split(':')[0],
          count,
          doctype_safety ? '\\l{}>{}'.format(dt_sc_str(doctype), dt_sc_str(lk)) : '',
          doctype_safety ? this.linksto_safe_color(doctype, lk) : 'black')
        if (doctype_safety && !this.linksto_safe(doctype, lk)) {
          let prov_list = dt.linksto.get(lk).map(x => '{} -> {}'.format(x[1], x[0]))
          let problem = "{} provcov to {}\n  {}".format(doctype, lk, prov_list.join('\n  '))
          this.problem_report(problem)
        }
      }
      // fulfilledby links
      let ffb_keys = Array.from(dt.fulfilledby.keys())
      for (let ffb of ffb_keys) {
        count = dt.fulfilledby.get(ffb).length
        graph += ' "{}" -> "{}" [label="fulfilledby({}){} " color="{}" style="dashed"]\n'.format(
          doctype.split(':')[0],
          ffb.split(':')[0],
          count,
          doctype_safety ? '\n{}>{}'.format(dt_sc_str(ffb),dt_sc_str(doctype)) : '',
          doctype_safety ? this.linksto_safe_color(ffb, doctype) : 'purple')
        if (doctype_safety && !this.linksto_safe(ffb, doctype)) {
          let problem = "{} fulfilledby {}".format(ffb, doctype)
          this.problem_report(problem)
        }
      }
    }
    let rules = new Object()
    if (doctype_safety) {
      rules.text = xml_escape(JSON.stringify(accepted_safety_class_links_re, 0, 2)).replace(/\\/g, '\\\\')
      rules.text = rules.text.replace(/\n/mg, '<BR ALIGN="LEFT"/> ')
      rules.title = "Safety rules for coverage<BR/>list of regex<BR/>doctype:safetyclass&gt;doctype:safetyclass"
    }
    graph += '\n  label={}\n  labelloc=b\n  fontsize=14\n  fontcolor=black\n  fontname="Arial"\n'.format(
      this.construct_graph_title(false, rules, null))
    graph += '\n}\n'
    //console.log(graph)
    this.dot = graph
    return graph
  }

  construct_graph_title(show_filters, extra, oreqm_ref, id_checkbox, search_pattern) {
    let title = '""'
    title  = '<\n    <table border="1" cellspacing="0" cellborder="1">\n'
    title += '      <tr><td cellspacing="0" >File</td><td>{}</td><td>{}</td></tr>\n'.format(this.filename, this.timestamp)

    if (show_filters) {
      if (oreqm_ref) {
        title += '      <tr><td>Ref. file</td><td>{}</td><td>{}</td></tr>\n'.format(oreqm_ref.filename, oreqm_ref.timestamp)
        /*
        let diff = oreqm_main.get_main_ref_diff()
        if (diff.new_reqs.length) {
          title += '      <tr><td>New reqs</td><td colspan="2">{}<BR ALIGN="LEFT"/></td></tr>\n'.format(diff.new_reqs.join('<BR ALIGN="LEFT"/>'))
        }
        if (diff.updated_reqs.length) {
          title += '      <tr><td>Updated reqs</td><td colspan="2">{}<BR ALIGN="LEFT"/></td></tr>\n'.format(diff.updated_reqs.join('<BR ALIGN="LEFT"/>'))
        }
        if (diff.removed_reqs.length) {
          title += '      <tr><td>Removed reqs</td><td colspan="2">{}<BR ALIGN="LEFT"/></td></tr>\n'.format(diff.removed_reqs.join('<BR ALIGN="LEFT"/>'))
        }
        */
      }
      if (search_pattern.length) {
        let search_formatted = xml_escape(search_pattern.replace(/&/g, '&amp;'))
        let pattern_string = search_formatted.trim().replace(/([^\n]{40,500}?\|)/g, '$1<BR ALIGN="LEFT"/>').replace(/\n/g, '<BR ALIGN="LEFT"/>')
        if (id_checkbox) {
          title += '      <tr><td>Search &lt;id&gt;</td><td colspan="2">{}<BR ALIGN="LEFT"/></td></tr>\n'.format(pattern_string.replace(/\\/g, '\\\\'))
        } else {
          title += '      <tr><td>Search text</td><td colspan="2">{}<BR ALIGN="LEFT"/></td></tr>\n'.format(pattern_string.replace( /\\/g, '\\\\'))
        }
      }
    }

    let ex_dt_list = this.excluded_doctypes
    if (ex_dt_list.length) {
      title += '      <tr><td>excluded doctypes</td><td colspan="2">{}</td></tr>\n'.format(ex_dt_list.join(", "))
    }

    let excluded_ids = this.excluded_ids
    if (excluded_ids.length) {
      title += '      <tr><td>excluded &lt;id&gt;s</td><td colspan="2">{}<BR ALIGN="LEFT"/></td></tr>\n'.format(excluded_ids.join('<BR ALIGN="LEFT"/>'))
    }
    if (extra && extra.title && extra.text && extra.title.length && extra.text.length) {
      title += '      <tr><td>{}</td><td colspan="2">{}<BR ALIGN="LEFT"/></td></tr>\n'.format(extra.title, extra.text)
    }
    title += '    </table>>'
    //console.log(title)
    return title
  }

}