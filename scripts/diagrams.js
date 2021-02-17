/* Main class for managing oreqm xml data */
"use strict";

import { ReqM2Specobjects } from './reqm2oreqm.js'
import { get_color } from './color.js'
import { DoctypeRelations } from './doctypes.js'
import { program_settings } from './settings.js'

/**
 * Escape XML special characters
 * @param {string} txt String possibly containing XML reserved characters
 * @return {string} Updated text
 */
export function xml_escape(txt) {
  // Escape string for usen in XML
  return txt.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Normalize indentation of multiline string, removing common indentation
 * @param {string} txt Multi-line string
 * @return {string} Adjusted string
 */
export function normalize_indent(txt) {
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
  // Heuristic that 1st line may mave no indentation because of the way xml is written
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
const re_line_length  = new RegExp(/([^\n]{110,500}?(:|;| |\/|-))/g)
//const re_keep_nl      = new RegExp(/\s*\n\s*/)
const re_empty_lines  = new RegExp(/<BR ALIGN="LEFT"\/>(\s*&nbsp;<BR ALIGN="LEFT"\/>)+/, 'm')

/**
 * Remove xml style formatting not compliant with 'dot' tables
 * @param {string} txt Text with various markup (for example docbook)
 * @return {string} 'dot' html table friendly text.
 */
export function dot_format(txt) {
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

/**
 * Format violations as list with the text from the definition in oreqm
 * @param  {array} vlist
 * @param  {object} rules
 * @return {string} docbook formatted list
 */
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

/**
 * Generate color coded cells for coverage
 * @param  {object} rec Specobject
 * @param  {boolean} show_coverage shall coverage be color coded
 * @param  {boolean} color_status shall specobject status be color coded
 * @return {string} dot html table
 */
function status_cell(rec, show_coverage, color_status) {
  let cov_color = (rec.covstatus === 'covered') ? '' : (rec.covstatus === 'partially') ? 'BGCOLOR="yellow"' : 'BGCOLOR="red"'
  let status_color = (!color_status || (rec.status === 'approved')) ? '' : (rec.status === 'proposed') ? 'BGCOLOR="yellow"' :  'BGCOLOR="red"'
  let covstatus = show_coverage && rec.covstatus ? `<TR><TD ${cov_color}>${rec.covstatus}</TD></TR>` : ''
  let str = `<TABLE BORDER="0"><TR><TD ${status_color}>${rec.status}</TD></TR>${covstatus}</TABLE>`
  return str
}

/**
 * Generate a string of possible missing referenced objects
 * @param {specobject} rec
 * @return {string} dot table row
 */
function format_nonexistent_links(rec) {
  let result = ''
  if (program_settings.show_errors) {
    let missing = []
    for (let lt of rec.linksto) {
      if (lt.linkerror && lt.linkerror.startsWith('referenced object does not exist')) {
        missing.push(lt.linksto)
      }
    }
    if (missing.length) {
      result = '        <TR><TD COLSPAN="3" ALIGN="LEFT" BGCOLOR="#FF6666">Referenced object does not exist:<BR ALIGN="LEFT"/>&nbsp;&nbsp;*&nbsp;{}<BR ALIGN="LEFT"/></TD></TR>\n'.format(missing.join('<BR ALIGN="LEFT"/>&nbsp;&nbsp;*&nbsp;'))
    }
  }
  return result
}

/**
 * Create 'dot' style 'html' table entry for the specobject. Rows without data are left out
 * @param  {string} node_id  Specobject <id>
 * @param  {object} rec Object with specobject data
 * @param  {boolean} ghost Is this a deleted object (then rendered with gradient)
 * @param  {object} oreqm Object for whole oreqm file
 * @param  {boolean} show_coverage
 * @param  {boolean} color_status
 * @return {string} dot html table representing the specobject
 */
function format_node(node_id, rec, ghost, oreqm, show_coverage, color_status) {
  let node_table = ""
  let nonexist_link = format_nonexistent_links(rec)
  let violations    = rec.violations.length ? '        <TR><TD COLSPAN="3" ALIGN="LEFT" BGCOLOR="#FF6666">{}</TD></TR>\n'.format(dot_format(format_violations(rec.violations, oreqm.rules))) : ''
  let furtherinfo     = rec.furtherinfo     ? '        <TR><TD COLSPAN="3" ALIGN="LEFT">furtherinfo: {}</TD></TR>\n'.format(dot_format(rec.furtherinfo)) : ''
  let safetyrationale = rec.safetyrationale ? '        <TR><TD COLSPAN="3" ALIGN="LEFT">safetyrationale: {}</TD></TR>\n'.format(dot_format(rec.safetyrationale)) : ''
  let shortdesc       = rec.shortdesc       ? '        <TR><TD COLSPAN="3" ALIGN="LEFT">shortdesc: {}</TD></TR>\n'.format(dot_format(rec.shortdesc)) : ''
  let rationale       = rec.rationale       ? '        <TR><TD COLSPAN="3" ALIGN="LEFT">rationale: {}</TD></TR>\n'.format(dot_format(rec.rationale)) : ''
  let verifycrit      = rec.verifycrit      ? '        <TR><TD COLSPAN="3" ALIGN="LEFT">{}</TD></TR>\n'.format(dot_format(rec.verifycrit)) : ''
  let comment         = rec.comment         ? '        <TR><TD COLSPAN="3" ALIGN="LEFT">comment: {}</TD></TR>\n'.format(dot_format(rec.comment)) : ''
  let source          = rec.source          ? '        <TR><TD COLSPAN="3" ALIGN="LEFT">source: {}</TD></TR>\n'.format(dot_format(rec.source)) : ''
  let status          = rec.status          ? '        <TR><TD>{}</TD><TD>{}</TD><TD>{}</TD></TR>\n'.format(tags_line(rec.tags, rec.platform), rec.safetyclass, status_cell(rec, show_coverage, color_status)) : ''
  node_table     = `
      <TABLE BGCOLOR="{}{}" BORDER="1" CELLSPACING="0" CELLBORDER="1" COLOR="{}" >
        <TR><TD CELLSPACING="0" >{}</TD><TD>{}</TD><TD>{}</TD></TR>
        <TR><TD COLSPAN="2" ALIGN="LEFT">{}</TD><TD>{}</TD></TR>\n{}{}{}{}{}{}{}{}{}{}      </TABLE>`.format(
                        get_color(rec.doctype),
                        ghost ? ':white' : '',
                        ghost ? 'grey' : 'black',
                        rec.id, rec.version, rec.doctype,
                        dot_format(rec.description), rec.needsobj.join('<BR/>'),
                        shortdesc,
                        rationale,
                        safetyrationale,
                        verifycrit,
                        comment,
                        furtherinfo,
                        source,
                        status,
                        violations,
                        nonexist_link)
  let node = '  "{}" [id="{}" label=<{}>];\n'.format(node_id, node_id, node_table)
  return node
}

/**
 * Create dot formatted edge between specobjects
 * @param {string} from_node origin
 * @param {string} to_node destination
 * @param {string} kind 'fulfilledby' or ''
 * @param {string} error possible problem with this edge
 * @return {string} dot format edge
 */
function format_edge(from_node, to_node, kind, error) {
  if (!program_settings.show_errors) {
    error = ''
  }
  let formatting = ''
  let label = ''
  if (error && error.length) {
    error = error.replace(/([^\n]{20,500}?(:|;| |\/|-))/g, '$1\n')
  }
  if (kind === "fulfilledby") {
    formatting = ' [style=bold color=purple dir=back fontname="Arial" label="{}"]'
    label = 'ffb'
    if (error.length) {
      label += '\n' + error
      formatting = ' [style=bold color=purple dir=back fontcolor="red" fontname="Arial" label="{}"]'
    }
  } else {
    formatting = ' [style=bold fontname="Arial" fontcolor="red" label="{}"]'
    label = error
  }
  return '  "{}" -> "{}"{};\n'.format(from_node, to_node, formatting.format(label))
}

/**
 * @param  {Array} tags of tag strings
 * @param  {Array} platforms of platform strings
 * @return {string} dot html table cell
 */
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

/**
 * Show the empty safetyclass as 'none'
 * @param  {string} sc safetyclass
 * @return {string}
 */
function sc_str(sc) {
  return (sc === '') ? 'none' : sc
}

/**
 * return string representation of safetyclass part of doctype
 * @param {string} doctype_with_safetyclass formatted as doctype:safetyclass
 * @return {string} safetyclass part
 */
function dt_sc_str(doctype_with_safetyclass) {
  return sc_str(doctype_with_safetyclass.split(':')[1])
}

/**
 * Put quotes around IDs containing spaces
 * @param {string} id
 * @return {string}
 */
function quote_id(id) {
  if (id.includes(' ')) {
    id = '"{}"'.format(id)
  }
  return id
}

/**
 * Report when number of nodes are limited to console
 * @param {integer} max_nodes
 */
function report_limit_exeeded(max_nodes) {
  console.log(`More than ${max_nodes} specobjects. Graph is limited to 1st ${max_nodes} encountered.`)
}

/** function pointer to reporting function */
let limit_reporter = report_limit_exeeded

/**
 * Set reporting function
 * @param {function} reporting_function some_function(max_limit)
 */
export function set_limit_reporter(reporting_function) {
  limit_reporter = reporting_function;
}

/**
 * @classdesc Derived class with capability to generate diagrams of contained oreqm data.
 */
export class ReqM2Oreqm extends ReqM2Specobjects {

  /**
   * Construct new object
   * @param {string} filename of the oreqm file
   * @param {string} content XML data
   * @param {string[]} excluded_doctypes List of doctypes to exclude from diagram
   * @param {string[]} excluded_ids List of IDs to exclude from diagram
   */
  constructor(filename, content, excluded_doctypes, excluded_ids) {
    super(filename, content, excluded_doctypes, excluded_ids);
    // diagram related members
    this.doctype_clusters = null; // A map of {doctype : [doctype:safetyclass]}
    this.dt_map = null; //new Map(); // A map of { doctype_name : DoctypeRelations }
  }

  /** @description Initial part of dot file */
  static get DOT_PREAMBLE() {
    const preamble =
`digraph "" {
  rankdir="RL"
  node [shape=plaintext fontname="Arial" fontsize=16]
  edge [color="blue",dir="forward",arrowhead="normal",arrowtail="normal"];

`;
    return preamble;
  }

  /** @description Final part of dot file */
  static get DOT_EPILOGUE() {
    const epilogue = '\n}\n';
    return epilogue;
  }

  /**
   * Format a node to dot format. Use a cache to speed up subsequent renderings.
   * @param {string} req_id
   * @param {boolean} ghost Is this a deleted speocobject (in a comparison)
   * @param {boolean} show_coverage
   * @param {boolean} color_status
   * @return {string} dot html table string
   */
  get_format_node(req_id, ghost, show_coverage, color_status) {
    let node
    if (this.format_cache.has(req_id)) {
      node = this.format_cache.get(req_id)
      //console.log('cache hit: ', req_id)
    } else {
      node = format_node(req_id, this.requirements.get(req_id), ghost, this, show_coverage, color_status)
      this.format_cache.set(req_id, node)
    }
    return node
  }

  /**
   * Return a 'dot' compatible graph with the subset of nodes nodes
   * accepted by the selection_function.
   * Also updates the doctype table in lower left of window.
   * The 'TOP' node forces a sensible layout for highest level requirements
   * (some level of visual proximity and aligned to the left of the graph)
   * @param {function} selection_function A function which tells if a particular node is included
   * @param {array} top_doctypes List of doctypes to link to 'TOP' node
   * @param {string} title diagram legend as dot html table
   * @param {object} highlights List of object IDs to be outlined as selected
   * @param {number} max_nodes Upper limit of nodes to render
   * @param {boolean} show_coverage
   * @param {boolean} color_status
   * @return {string} dot graph
   */
  create_graph(selection_function, top_doctypes, title, highlights, max_nodes, show_coverage, color_status) {
    //rq: ->(rq_dot) D(* Function shall output a dot graph*)
    let graph = ReqM2Oreqm.DOT_PREAMBLE;
    let subset = []
    const ids = this.requirements.keys()
    let node_count = 0
    let edge_count = 0
    let doctype_dict = new Map()  // { doctype : [id] }  list of id's per doctype
    let selected_dict = new Map() // { doctype : [id] } list of selected id's per doctype
    let selected_nodes = []
    let limited = false
    for (const req_id of ids) {
      this.doctype_grouping(req_id, doctype_dict, selected_dict, selection_function, subset, highlights, selected_nodes);
      if (subset.length > max_nodes) {
        limited = true;
        limit_reporter(max_nodes);
        break; // hard limit on node count
      }
    }
    let show_top;
    ({ show_top, graph } = this.handle_top_node(top_doctypes, graph));

    // babel artifact? below names must match what is used in return from visible_duplicates()
    let arrays_of_duplicates
    let not_duplicates
    ({arrays_of_duplicates, not_duplicates} = this.visible_duplicates(subset));
    console.log(arrays_of_duplicates)
    console.log(not_duplicates)
    for (const dup_list of arrays_of_duplicates) {
      let dup_cluster_id = this.requirements.get(dup_list[0]).id;
      graph += `subgraph "cluster_${dup_cluster_id}_dups" { color=grey penwidth=1 label="duplicates" fontname="Arial" labelloc="t"\n`;
      for (const req_id of dup_list) {
        // duplicate nodes
        ({ graph, node_count } = this.add_node_to_graph(req_id, show_coverage, color_status, highlights, graph, node_count));
      }
      graph += `}`;
    }
    for (const req_id of not_duplicates) {
        // nodes
        ({ graph, node_count } = this.add_node_to_graph(req_id, show_coverage, color_status, highlights, graph, node_count));
    }
    graph += '\n  # Edges\n'
    graph = this.handle_top_node_edges(show_top, subset, top_doctypes, graph);
    for (const req_id of subset) {
      // edges
      ({ graph, edge_count } = this.add_dot_edge(req_id, subset, graph, edge_count));
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
    result.limited = limited
    selected_nodes.sort()
    result.selected_nodes = selected_nodes
    return result
  }

  add_node_to_graph(req_id, show_coverage, color_status, highlights, graph, node_count) {
    const ghost = this.removed_reqs.includes(req_id);
    let node = this.get_format_node(req_id, ghost, show_coverage, color_status);
    node = this.add_node_emphasis(req_id, node, req_id, highlights);
    graph += node + '\n';
    node_count += 1;
    return { graph, node_count };
  }

  /**
   * Calculate the subset of visible nodes that are duplicates
   * @param {string[]} subset keys of visible nodes
   * @return { string[][], string[] } An array of visible duplicate sets, array of rest
   */
  visible_duplicates(subset) {
    let set_copy = subset.slice();
    let not_duplicates = [];
    let arrays_of_duplicates = [];
    while (set_copy.length > 0) {
      let key = set_copy[0];
      let id = this.requirements.get(set_copy[0]).id;
      if (this.duplicates.has(id)) {
        // Add the duplicates on the list to dup_set which are also in the subset
        let dup_set = [];
        let dup_arr = this.duplicates.get(id);
        for (const dup_pair of dup_arr) {
          if (set_copy.includes(dup_pair.id)) {
            dup_set.push(dup_pair.id);
          }
        }
        // Remove these ids/keys from set_copy
        let temp_copy = set_copy.filter(function(value, _index, _arr){
          return !dup_set.includes(value);
        })
        set_copy = temp_copy;
        arrays_of_duplicates.push(dup_set)
      } else {
        not_duplicates.push(key)
        set_copy = set_copy.slice(1);
      }
    }
    console.log("visible_duplicates", subset, arrays_of_duplicates, not_duplicates);
    return { arrays_of_duplicates, not_duplicates };
  }

  handle_top_node_edges(show_top, subset, top_doctypes, graph) {
    if (show_top) {
      for (const req_id of subset) {
        if (top_doctypes.includes(this.requirements.get(req_id).doctype)) {
          graph += format_edge(req_id, 'TOP', '', '');
        }
      }
    }
    return graph;
  }

  /**
   * Add 'TOP' node if there will be edges to it.
   * @param {string[]} top_doctypes 
   * @param {string} graph 
   */
  handle_top_node(top_doctypes, graph) {
    let show_top = false;
    for (let top_dt of top_doctypes) {
      if (this.doctypes.has(top_dt) && !this.excluded_doctypes.includes(top_dt)) {
        show_top = true;
      }
    }
    if (show_top) {
      graph += '  "TOP" [fontcolor=lightgray];\n\n';
    }
    return { show_top, graph };
  }

  add_dot_edge(req_id, subset, graph, edge_count) {
    let kind = ''
    let linkerror = ''
    if (this.linksto.has(req_id)) {
      for (const link of this.linksto.get(req_id)) {
        // Do not reference non-selected specobjets
        if (subset.includes(link)) {
          if (this.fulfilledby.has(req_id) && this.fulfilledby.get(req_id).has(link)) {
            kind = "fulfilledby";
            linkerror = this.get_ffb_link_error(link, req_id);
          } else {
            kind = null;
            linkerror = this.get_link_error(req_id, link);
          }
          graph += format_edge(req_id, link, kind, linkerror);
          edge_count += 1;
        }
      }
    }
    return { graph, edge_count };
  }

  /**
   * Calculate categories of nodes in diagram
   * @param {string} req_id of current node
   * @param {Map<string, string[]>} doctype_dict 
   * @param {Map<string, string[]>} selected_dict 
   * @param {function(string, Object, Set<number>)} selection_function 
   * @param {string[]} subset List of selected and reachable ids
   * @param {string[]} highlights list of selected ids
   * @param {string[]} selected_nodes 
   */
  doctype_grouping(req_id, doctype_dict, selected_dict, selection_function, subset, highlights, selected_nodes) {
    const rec = this.requirements.get(req_id);
    if (!doctype_dict.has(rec.doctype)) {
      doctype_dict.set(rec.doctype, []);
      selected_dict.set(rec.doctype, []);
    }
    if (selection_function(req_id, rec, this.color.get(req_id)) &&
      !this.excluded_doctypes.includes(rec.doctype) &&
      !this.excluded_ids.includes(req_id)) {
      subset.push(req_id);
      doctype_dict.get(rec.doctype).push(req_id);
      if (highlights.includes(req_id)) {
        selected_dict.get(rec.doctype).push(req_id);
        selected_nodes.push(req_id);
      }
    }
  }

  /**
   * Decorate the node with a colored 'cluster¨' if one of special categories.
   * @param {string} req_id specobject id
   * @param {string} node 'dot' language node
   * @param {string} dot_id svg level id
   * @param {string[]} highlights id's of selected nodes
   */
  add_node_emphasis(req_id, node, dot_id, highlights) {
    if (this.new_reqs.includes(req_id)) {
      node = 'subgraph "cluster_{}_new" { color=limegreen penwidth=1 label="new" fontname="Arial" labelloc="t"\n{}}\n'.format(dot_id, node);
    } else if (this.updated_reqs.includes(req_id)) {
      node = 'subgraph "cluster_{}_changed" { color=goldenrod1 penwidth=1 label="changed" fontname="Arial" labelloc="t"\n{}}\n'.format(dot_id, node);
    } else if (this.removed_reqs.includes(req_id)) {
      node = 'subgraph "cluster_{}_removed" { color=red penwidth=1 label="removed" fontname="Arial" labelloc="t"\n{}}\n'.format(dot_id, node);
    }
    if (highlights.includes(req_id)) {
      node = 'subgraph "cluster_{}" { id="sel_{}" color=maroon3 penwidth=3 label=""\n{}}\n'.format(dot_id, dot_id, node);
    }
    return node;
  }

  /**
   * Get error possibly associated with linksto
   * @param {string} req_id specobject id
   * @param {string} link specobject in linksto reference
   * @return {string} error string or ''
   */
  get_link_error(req_id, link) {
    const rec = this.requirements.get(req_id)
    let error = ''
    for (const lt of rec.linksto) {
      if (lt.linksto === link) {
        error = lt.linkerror
      }
    }
    return error
  }

  /**
   * Get error possibly associated with fulfilledby link
   * @param {string} req_id specobject id
   * @param {string} link specobject in ffb reference
   * @return {string} error string or ''
   */
  get_ffb_link_error(req_id, link) {
    const rec = this.requirements.get(req_id)
    let error = ''
    for (const ffb of rec.fulfilledby) {
      if (ffb.id === link) {
        error = ffb.ffblinkerror
      }
    }
    return error
  }

  /**
   * Check two expanded doctype:safetyclass pairs for compliance with at least one of the supplied rules,
   * i.e. permitted safetyclass for providescoverage <from_safetyclass>:<to_safetyclass>
   * @param {string} from origin doctype:safetyclass
   * @param {string} to descination doctype:safetyclass
   * @return {boolean}
   */
  check_linksto_safe(from, to) {
    let combo = "{}>{}".format(from, to)
    for (const re of program_settings.safety_link_rules) {
      if (combo.match(re)) {
        return true
      }
    }
    return false
  }

  /**
   * Generate doctype:safetyclass classifier
   * @param {string} id
   * @param {string} safety safetyclass
   * @return {string}
   */
  build_doctype_with_safetyclass(id, safety) {
    // construct a doctype name, qualified with safetyclass
    let rec = this.requirements.get(id)
    if (safety) {
      return "{}:{}".format(rec.doctype, rec.safetyclass)
    } else {
      return rec.doctype
    }
  }

  /**
   * Calculate edge color according to compliance with safety rules
   * @param {string} from  origin doctype
   * @param {string} to destination doctype
   * @return {string} RGB color of graph edge
   */
  linksto_safe_color(from, to) {
    return this.check_linksto_safe(from, to) ? '#00AA00' : '#FF0000'
  }

  /**
   * Build a mapping of doctype relations.
   * Update this.dt_map
   * @param {boolean} doctype_safety consider safetyclass in diagram
   */
  build_doctype_mapping(doctype_safety) {
    let id_list = this.requirements.keys()
    let doctype = null
    let dest_doctype = null
    let basic_doctype = null
    this.doctype_clusters = new Map() // {doctype : [doctype:safetyclass]}
    for (const id of id_list) {
      if (this.requirements.get(id).ffb_placeholder === true) {
        // skip placeholders
        continue;
      }
      // make a cluster of doctypes with the different safetyclasses
      basic_doctype = this.requirements.get(id).doctype
      if (!this.doctype_clusters.has(basic_doctype)) {
        this.doctype_clusters.set(basic_doctype, [])
      }
      doctype = this.build_doctype_with_safetyclass(id, doctype_safety)
      if (!this.dt_map.has(doctype)) {
        this.dt_map.set(doctype, new DoctypeRelations(doctype))
        // Create clusters of refined doctypes, based on fundamental one
        if (!this.doctype_clusters.get(basic_doctype).includes(doctype)) {
          this.doctype_clusters.get(basic_doctype).push(doctype)
        }
      }

      this.dt_map.get(doctype).add_instance(id)
      // linksto
      if (this.linksto.has(id)) {
        const linksto = Array.from(this.linksto.get(id))
        for (let linked_id of linksto) {
          if (this.requirements.has(linked_id)) {
            dest_doctype = this.build_doctype_with_safetyclass(linked_id, doctype_safety)
            //console.log("add_linksto ", doctype, linked_id, dest_doctype)
            this.dt_map.get(doctype).add_linksto(dest_doctype, [linked_id, id])
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
          this.dt_map.get(doctype).add_needsobj(dest_doctype)
        }
      }
      // fulfilledby
      let ffb_list = Array.from(this.requirements.get(id).fulfilledby)
      for (let ffb of ffb_list) {
        if (doctype_safety) {
          // will need at least its own safetyclass
          dest_doctype = "{}:{}".format(ffb.doctype, this.requirements.get(id).safetyclass)
        } else {
          dest_doctype = ffb.doctype
        }
        //console.log("add_fulfilledby ", dest_doctype)
        this.dt_map.get(doctype).add_fulfilledby(dest_doctype, [id, ffb.id])
      }
    }
  }

  /**
   * Scan all requirements and summarize the relationships between doctypes
   * with counts of instances and relations (needsobj, linksto, fulfilledby)
   * When doctype_safety is true, the doctypes are qualified with the safetyclass
   * of the requirement as in <doctype>:<safetyclass> and these are the nodes rendered
   * @param {boolean} doctype_safety false: plain doctype relations; true: safetyclass checks for doctype relations
   * @return {string} dot language diagram
   */
  scan_doctypes(doctype_safety) {
    this.dt_map = new Map() // A map of { doctype_name : DoctypeRelations }
    this.build_doctype_mapping(doctype_safety)
    // DOT language start of diagram
    let graph = `digraph "" {
      rankdir="{}"
      node [shape=plaintext fontname="Arial" fontsize=16]
      edge [color="black" dir="forward" arrowhead="normal" arrowtail="normal" fontname="Arial" fontsize=11];

`.format(doctype_safety ? 'BT' : 'TD')
    // Define the doctype nodes - the order affects the layout
    const doctype_array = Array.from(this.doctype_clusters.keys())
    for (let doctype of doctype_array) {
      let doctypes_in_cluster = this.doctype_clusters.get(doctype)
      let sc_stats = ''
      let count_total = 0
      let sc_list = Array.from(doctypes_in_cluster.keys())
      sc_list.sort()
      let sc_string = ''
      for (const sub_doctype of doctypes_in_cluster) {
        let dt = this.dt_map.get(sub_doctype)
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
    let doctype_edges = Array.from(this.dt_map.keys())
    // Loop over doctypes
    for (let doctype of doctype_edges) {
      dt = this.dt_map.get(doctype)
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
        if (doctype_safety && !this.check_linksto_safe(doctype, lk)) {
          let prov_list = dt.linksto.get(lk).map(x => '{} -> {}'.format(quote_id(x[1]), quote_id(x[0])))
          let dt2 = doctype
          if (dt2.endsWith(':')) {
            dt2 += '<none>'
          }
          if (lk.endsWith(':')) {
            lk += '<none>'
          }
          let problem = "{} provcov to {}\n  {}".format(dt2, lk, prov_list.join('\n  '))
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
          doctype_safety ? '\n{}>{}'.format(dt_sc_str(ffb), dt_sc_str(doctype)) : '',
          doctype_safety ? this.linksto_safe_color(ffb, doctype) : 'purple')
        if (doctype_safety && !this.check_linksto_safe(ffb, doctype)) {
          let problem = "{} fulfilledby {}".format(ffb, doctype)
          this.problem_report(problem)
        }
      }
    }
    let rules = new Object()
    if (doctype_safety) {
      rules.text = xml_escape(JSON.stringify(program_settings.safety_link_rules, 0, 2)).replace(/\\/g, '\\\\')
      rules.text = rules.text.replace(/\n/mg, '<BR ALIGN="LEFT"/> ')
      rules.title = "Safety rules for coverage<BR/>list of regex<BR/>doctype:safetyclass&gt;doctype:safetyclass"
    }
    graph += '\n  label={}\n  labelloc=b\n  fontsize=14\n  fontcolor=black\n  fontname="Arial"\n'.format(
      this.construct_graph_title(false, rules, null, false, null))
    graph += '\n}\n'
    //console.log(graph)
    this.dot = graph
    return graph
  }

  /**
   * Construct diagram legend as 'dot' table.
   * @param {boolean} show_filters display selection criteria
   * @param {object} extra object with .title and .text for additional row
   * @param {object} oreqm_ref optional reference (2nd) oreqm object
   * @param {boolean} id_checkbox search <id>s only
   * @param {string} search_pattern 'selection criteria' string
   * @return {string} 'dot' table
   */
  construct_graph_title(show_filters, extra, oreqm_ref, id_checkbox, search_pattern) {
    let title = '""'
    title  = '<\n    <table border="1" cellspacing="0" cellborder="1">\n'
    title += '      <tr><td cellspacing="0" >File</td><td>{}</td><td>{}</td></tr>\n'.format(this.filename.replace(/([^\n]{30,500}?(\\|\/))/g, '$1<BR ALIGN="LEFT"/>'), this.timestamp)

    if (show_filters) {
      if (oreqm_ref) {
        title += '      <tr><td>Ref. file</td><td>{}</td><td>{}</td></tr>\n'.format(oreqm_ref.filename.replace(/([^\n]{30,500}?(\\|\/))/g, '$1<BR ALIGN="LEFT"/>'), oreqm_ref.timestamp)
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
      let ex_dt_list = this.excluded_doctypes
      if (ex_dt_list.length) {
        title += '      <tr><td>excluded doctypes</td><td colspan="2">{}</td></tr>\n'.format(ex_dt_list.join(", ").replace(/([^\n]{60,500}? )/g, '$1<BR ALIGN="LEFT"/>'))
      }

      let excluded_ids = this.excluded_ids
      if (excluded_ids.length) {
        title += '      <tr><td>excluded &lt;id&gt;s</td><td colspan="2">{}<BR ALIGN="LEFT"/></td></tr>\n'.format(excluded_ids.join('<BR ALIGN="LEFT"/>'))
      }
    }

    if (extra && extra.title && extra.text && extra.title.length && extra.text.length) {
      title += '      <tr><td>{}</td><td colspan="2">{}<BR ALIGN="LEFT"/></td></tr>\n'.format(extra.title, extra.text)
    }
    title += '    </table>>'
    //console.log(title)
    return title
  }

}