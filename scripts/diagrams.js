/* Main class for managing oreqm xml data */
'use strict'

import { ReqM2Specobjects } from './reqm2oreqm.js'
import { getColor } from './color.js'
import { DoctypeRelations } from './doctypes.js'
import { programSettings } from './settings.js'
import { processRuleSet } from './settings_dialog.js'
import { progressbarStart, progressbarUpdateValue, progressbarStop } from './progressbar'

/**
 * Escape XML special characters
 * @param {string} txt String possibly containing XML reserved characters
 * @return {string} Updated text
 */
export function xmlEscape (txt) {
  // Escape string for use in XML
  return txt.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function xmlUnescape (txt) {
  return txt.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

/**
 * Normalize indentation of multiline string, removing common indentation
 * @param {string} txt Multi-line string
 * @return {string} Adjusted string
 */
export function normalizeIndent (txt) {
  txt = txt.replace(/\r/, '') // no cr
  txt = txt.replace(/\t/, '  ') // no tabs
  txt = txt.replace(/^(\s*\n)+/, '') // empty initial line
  txt = txt.replace(/(\n\s*)+$/m, '') // empty final line
  const lineArr = txt.split('\n')
  // Calculate smallest amount of leading whitespace
  let minLeading = 100
  let match = lineArr[0].match(/^\s+/)
  let firstLength = 0
  if (match) {
    firstLength = lineArr[0].match(/^\s+/)[0].length
  }
  for (let i = 1; i < lineArr.length; i++) {
    match = lineArr[i].match(/^\s+/)
    if (match) {
      const leading = match[0].length
      if (leading < minLeading) minLeading = leading
    } else {
      minLeading = 0
    }
  }
  // Heuristic that 1st line may mave no indentation because of the way xml is written
  if (lineArr.length > 1) {
    if (firstLength < minLeading) {
      lineArr[0] = ' '.repeat(minLeading - firstLength) + lineArr[0]
    }
  } else {
    minLeading = firstLength
  }
  // Remove that amount from all strings
  for (let i = 0; i < lineArr.length; i++) {
    lineArr[i] = lineArr[i].slice(minLeading)
  }
  txt = lineArr.join('\n')
  return txt
}

// Regexes for "make requirements readable" heuristics
const reXmlComments = /<!--.*?-->/gm
// const reUnwantedMu  = /<!\[CDATA\[\s*/gm
// const reAmpQuote    = /&/gm
// const reListHeurist = /<li>[\s\n]*|<listitem>[\s\n]*/gm
const reTagText = /<a\s+type="xref"\s+href="[A-Z]+_([^"]+)"\s*\/>/gm
// const reXmlRemove   = /<\/?ul>|<\/?itemizedlist>|<\/listitem>|<\/li>|<\/para>/gm
const reWhitespace = /^[\s\n]*|\s\n]*$/
const reNbrList = /\n\s+(\d+)/g
const reLineLength = /([^\n]{110,500}?(:|;| |\/|-))/g
// const reKeepNl      = /\s*\n\s*/
const reEmptyLines = /<BR ALIGN="LEFT"\/>(\s*&nbsp;<BR ALIGN="LEFT"\/>)+/m

/**
 * Remove xml style formatting not compliant with 'dot' tables
 * @param {string} txt Text with various markup (for example docbook)
 * @return {string} 'dot' html table friendly text.
 */
export function dotFormat (txt) {
  //rq: ->(rq_markup_remove)
  let txt2
  let newTxt = ''
  if (txt.length) {
    txt = normalizeIndent(txt)
    txt = txt.split(reXmlComments).join('') // remove XML comments
    // txt = txt.replace(reUnwantedMu, '')  // Remove unwanted markup
    // Handle unicode literals
    txt = txt.replace(/&#(\d+);/g, function (whole, group1) { return String.fromCharCode(parseInt(group1, 10)) })
    // txt = txt.replace(/\\u([0-9a-f]{4})/g, function (whole, group1) {return String.fromCharCode(parseInt(group1, 16));})
    // neuter unknown, unepanded xml elements
    txt2 = txt.split(/&(?!lt;|gt;|quot;|amp;|nbsp;)/gm)
    if (txt2.length > 1) {
      txt = txt2.join('&amp;')
    }
    // newTxt = txt.replace(reListHeurist, '&nbsp;&nbsp;* ') // heuristic for bulleted lists
    newTxt = txt.split(/<li>[\s\n]*|<listitem>[\s\n]*/).join('&nbsp;&nbsp;* ') // heuristic for bulleted lists
    // Dig out meaningful text from items like:
    // <a type="xref" href="TERM_UNAUTHORIZED_EXECUTABLE_ENTITIES"/>
    newTxt = newTxt.replace(reTagText, '$1')
    newTxt = newTxt.split(/<br\s*\/>|<\/?p>/i).join('&nbsp;\n') // keep deliberate newlines
    newTxt = newTxt.split(/<\/?ul>|<\/?itemizedlist>|<\/listitem>|<\/li>|<\/?para>|<a\s[^>/]*\/?>|<\/a>|<\/?filename>|<\/?code>|<\/?function>|<\/?pre>|<\/glossterm>|<glossterm [^>]+>/).join('') // remove xml markup
    newTxt = newTxt.replace(reWhitespace, '') // remove leading and trailing whitespace
    newTxt = newTxt.replace(/"/g, '&quot;')
    newTxt = newTxt.replace(/</g, '&lt;')
    newTxt = newTxt.replace(/>/g, '&gt;')
    newTxt = newTxt.replace(reNbrList, '\n&nbsp;&nbsp;$1') // heuristic for numbered lists
    newTxt = newTxt.replace(reLineLength, '$1\n') // limit line length
    newTxt = newTxt.split(/\s*\n/).join('<BR ALIGN="LEFT"/>') // preserve newlines
    newTxt = newTxt.replace(/^(\s*(&nbsp;)*<BR ALIGN="LEFT"\/>)+/, '') // remove blank leading lines
    newTxt = newTxt.replace(reEmptyLines, '<BR ALIGN="LEFT"/>&nbsp;<BR ALIGN="LEFT"/>') // Limit empty lines
    newTxt = newTxt.replace(/\r/, '') // no cr
    if (!newTxt.endsWith('<BR ALIGN="LEFT"/>')) {
      newTxt += '<BR ALIGN="LEFT"/>'
    }
  }
  return newTxt
}

/**
 * Format violations as list with the text from the definition in oreqm
 * @param  {array} vlist
 * @param  {object} rules
 * @return {string} docbook formatted list
 */
function formatViolations (vlist, rules) {
  //rq: ->(rq_node_probs)
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
 * @param  {boolean} showCoverage shall coverage be color coded
 * @param  {boolean} colorStatus shall specobject status be color coded
 * @return {string} dot html table
 */
function statusCell (rec, showCoverage, colorStatus) {
  //rq: ->(rq_status_color)
  //rq: ->(rq_cov_color)
  const covColor = (rec.covstatus === 'covered') ? '' : (rec.covstatus === 'partially') ? 'BGCOLOR="yellow"' : 'BGCOLOR="red"'
  const statusColor = (!colorStatus || (rec.status === 'approved')) ? '' : (rec.status === 'proposed') ? 'BGCOLOR="yellow"' : 'BGCOLOR="red"'
  const covstatus = showCoverage && rec.covstatus ? `<TR><TD ${covColor}>${rec.covstatus}</TD></TR>` : ''
  const str = `<TABLE BORDER="0"><TR><TD ${statusColor}>${rec.status}</TD></TR>${covstatus}</TABLE>`
  return str
}

/**
 * Generate a string of possible missing referenced objects
 * @param {specobject} rec
 * @return {string} dot table row
 */
function formatNonexistentLinks (rec) {
  let result = ''
  // istanbul ignore else
  if (programSettings.show_errors) {
    const missing = []
    for (const lt of rec.linksto) {
      if (lt.linkerror && lt.linkerror.startsWith('referenced object does not exist')) {
        missing.push(lt.linksto)
      }
    }
    if (missing.length) {
      result = `        <TR><TD COLSPAN="3" ALIGN="LEFT" BGCOLOR="#FF6666">Referenced object does not exist:<BR ALIGN="LEFT"/>&nbsp;&nbsp;*&nbsp;${missing.join('<BR ALIGN="LEFT"/>&nbsp;&nbsp;*&nbsp;')}<BR ALIGN="LEFT"/></TD></TR>\n`
    }
  }
  return result
}

/**
 * Create table row with category and priority data
 * @param {object} rec JS specobject
 * @returns {string} table row or empty string
 */
function relCategoryPriority (rec) {
  const releases = rec.releases.length ? `releases: ${dotFormat(rec.releases.join(', '))}` : ''
  const category = rec.category ? `category: ${rec.category}` : ''
  const priority = rec.priority ? `priority: ${rec.priority}` : ''
  let cP = ''
  if (releases.length || category.length || priority.length) {
    cP = `        <TR><TD>${releases}</TD><TD>${category}</TD><TD>${priority}</TD></TR>\n`
  }
  return cP
}

function dependsConflicts (rec) {
  let depCon = ''
  const depends = rec.dependson.length ? `dep: ${dotFormat(rec.dependson.join(', '))}` : ''
  const conflicts = rec.conflicts.length ? `con: ${dotFormat(rec.conflicts.join(', '))}` : ''
  if (depends.length || conflicts.length) {
    depCon = `        <TR><TD COLSPAN="2" ALIGN="LEFT">${depends}</TD><TD>${conflicts}</TD></TR>\n`
  }
  return depCon
}

function securityRationaleClass (rec) {
  let secRatCls = ''
  let secRat = rec.securityrationale ? `sec_rat: ${dotFormat(rec.securityrationale)}` : ''
  let secClass = rec.securityclass ? `sec_cls: ${rec.securityclass}` : ''
  if (secRat.length || secClass.length) {
    secRatCls = `        <TR><TD COLSPAN="2" ALIGN="LEFT">${secRat}</TD><TD>${secClass}</TD></TR>\n`
  }
  return secRatCls
}

function verifyMetCond (rec) {
  let verMetCon = ''
  let verMet = rec.verifymethods.length ? `ver_m: ${dotFormat(rec.verifymethods.join('\n'))}` : ''
  let verCond = rec.verifycond ? `ver_c: ${rec.verifycond}` : ''
  if (verMet.length || verCond.length) {
    verMetCon = `        <TR><TD COLSPAN="2" ALIGN="LEFT">${verMet}</TD><TD>${verCond}</TD></TR>\n`
  }
  return verMetCon
}

function srcRevDate (rec) {
  let row = ''
  let src = rec.source ? dotFormat(rec.source) : ''
  let rev = rec.sourcerevision ? dotFormat(rec.sourcerevision) : ''
  let date = rec.creationdate ? rec.creationdate : ''
  if (src.length || rec.length || date.length ) {
    row = `        <TR><TD>${src}</TD><TD>${rev}</TD><TD>${date}</TD></TR>\n`
  }
  return row
}

function sourceFileLine (rec) {
  let row = ''
  let file = rec.sourcefile ? rec.sourcefile : ''
  let line = rec.sourceline ? rec.sourceline : ''
  if (file.length || line.length) {
    row = `        <TR><TD COLSPAN="3" ALIGN="LEFT">src file: ${
      file.replace( /([^\n]{70,500}?(\\|\/))/g,
                    '$1<BR ALIGN="LEFT"/>')}:${line}<BR ALIGN="LEFT"/></TD></TR>\n`
  }
  return row
}

/**
 * If a doctype has no coverage, i.e. is in .miscov list, then show it
 * with a red background.
 * @param {object} rec specobject representation
 * @returns table formatted string or empty string
 */
function formatNeedsobj (rec, showCoverage) {
  let nobjTable = ''
  if (rec.needsobj.length > 0) {
    nobjTable += '<TABLE BORDER="0">'
    for (const d of rec.needsobj) {
      const statusColor = rec.miscov.includes(d) && showCoverage ? ' BGCOLOR="red"' : ''
      nobjTable += `<TR><TD${statusColor}>${d}</TD></TR>`
    }
    nobjTable += '</TABLE>'
  }
  return nobjTable
}

/**
 * Create 'dot' style 'html' table entry for the specobject. Rows without data are left out
 * @param  {string} nodeId  Specobject <id>
 * @param  {object} rec Object with specobject data
 * @param  {boolean} ghost Is this a deleted object (then rendered with gradient)
 * @param  {object} oreqm Object for whole oreqm file
 * @param  {boolean} showCoverage
 * @param  {boolean} colorStatus
 * @return {string} dot html table representing the specobject
 */
function formatNode (nodeId, rec, ghost, oreqm, showCoverage, colorStatus) {
  //rq: ->(rq_doctype_color)
  let nodeTable = ''
  const relCatPrio = relCategoryPriority(rec)
  const nonexistLink = formatNonexistentLinks(rec)
  const depCon = dependsConflicts(rec)
  const secur = securityRationaleClass(rec)
  const verMetCond = verifyMetCond(rec)
  const violations = rec.violations.length ? `        <TR><TD COLSPAN="3" ALIGN="LEFT" BGCOLOR="#FF6666">${dotFormat(formatViolations(rec.violations, oreqm.rules))}</TD></TR>\n` : ''
  const furtherinfo = rec.furtherinfo ? `        <TR><TD COLSPAN="3" ALIGN="LEFT">furtherinfo: ${dotFormat(rec.furtherinfo)}</TD></TR>\n` : ''
  const usecase = rec.usecase ? `        <TR><TD COLSPAN="3" ALIGN="LEFT">usecase: ${dotFormat(rec.usecase)}</TD></TR>\n` : ''
  const safetyrationale = rec.safetyrationale ? `        <TR><TD COLSPAN="3" ALIGN="LEFT">safetyrationale: ${dotFormat(rec.safetyrationale)}</TD></TR>\n` : ''
  const shortdesc = rec.shortdesc ? `        <TR><TD COLSPAN="3" ALIGN="LEFT">shortdesc: ${dotFormat(rec.shortdesc)}</TD></TR>\n` : ''
  const rationale = rec.rationale ? `        <TR><TD COLSPAN="3" ALIGN="LEFT">rationale: ${dotFormat(rec.rationale)}</TD></TR>\n` : ''
  const verifycrit = rec.verifycrit ? `        <TR><TD COLSPAN="3" ALIGN="LEFT">${dotFormat(rec.verifycrit)}</TD></TR>\n` : ''
  const comment = rec.comment ? `        <TR><TD COLSPAN="3" ALIGN="LEFT">comment: ${dotFormat(rec.comment)}</TD></TR>\n` : ''
  const source = srcRevDate(rec)
  const srcFile = sourceFileLine(rec)
  const testin = rec.testin ? `        <TR><TD COLSPAN="3" ALIGN="LEFT">testin: ${dotFormat(rec.testin)}</TD></TR>\n` : ''
  const testexec = rec.testexec ? `        <TR><TD COLSPAN="3" ALIGN="LEFT">testexec: ${dotFormat(rec.testexec)}</TD></TR>\n` : ''
  const testout = rec.testout ? `        <TR><TD COLSPAN="3" ALIGN="LEFT">testout: ${dotFormat(rec.testout)}</TD></TR>\n` : ''
  const testpasscrit = rec.testpasscrit ? `        <TR><TD COLSPAN="3" ALIGN="LEFT">testpasscrit: ${dotFormat(rec.testpasscrit)}</TD></TR>\n` : ''
  const status = rec.status ? `        <TR><TD>${tagsLine(rec.tags, rec.platform)}</TD><TD>${rec.safetyclass}</TD><TD>${
                                                                 statusCell(rec, showCoverage, colorStatus)}</TD></TR>\n` : ''
  nodeTable = `
      <TABLE BGCOLOR="${getColor(rec.doctype)}${ghost ? ':white' : ''}" BORDER="0" CELLSPACING="0" CELLBORDER="1" COLOR="${ghost ? 'grey' : 'black'}" >
        <TR><TD CELLSPACING="0" >${xmlEscape(rec.id)}</TD><TD>${rec.version}</TD><TD>${rec.doctype}</TD></TR>
        <TR><TD COLSPAN="2" ALIGN="LEFT">${dotFormat(rec.description)}</TD><TD>${formatNeedsobj(rec, showCoverage)}</TD></TR>\n${
          shortdesc}${rationale}${safetyrationale}${secur}${verifycrit}${
          verMetCond}${comment}${furtherinfo}${usecase}${source}${
          srcFile}${testin}${testexec}${testout}${testpasscrit}${depCon}${relCatPrio}${status}${violations}${nonexistLink}      </TABLE>`
  const node = `  "${nodeId}" [id="${nodeId}" label=<${nodeTable}>];\n`
  return node
}

/**
 * Create dot formatted edge between specobjects
 * @param {string} fromNode origin
 * @param {string} toNode destination
 * @param {string} kind 'fulfilledby' or ''
 * @param {string} error possible problem with this edge
 * @return {string} dot format edge
 */
function formatEdge (fromNode, toNode, kind, error, color = '', lbl = '') {
  if (!programSettings.show_errors) {
    error = ''
  }
  let label = ''
  let edgeLabel = ''
  if (error && error.length) {
    //rq: ->(rq_edge_probs)
    // insert newlines in long texts
    error = error.replace(/([^\n]{20,500}?(:|;| |\/|-))/g, '$1\\n')
  }
  if (kind === 'fulfilledby') {
    //rq: ->(rq_edge_pcov_ffb)
    label = lbl === '' ? 'ffb' : `ffb (${lbl})`
    if (color === '') {
      color = 'purple'
    }
    edgeLabel = ` [style=bold color=${color} dir=back fontname="Arial" label="${label}"]`
    if (error.length) {
      label += '\\n' + error
      edgeLabel = ` [style=bold color=${color} dir=back fontcolor="red" fontname="Arial" label="${label}"]`
    }
  } else {
    if (kind==='untraced') {
      color = 'blue style=dashed'
      lbl = (lbl.length > 0) ? lbl+ 'untraced' : 'untraced'
    }
    const col = (color !== '') ? `color=${color} ` : ''
    const fontcolor = error.length ? 'fontcolor=red ' : ''
    label = (lbl !== '') ? `${lbl}: ${error}` : error
    edgeLabel = ` [style=bold ${col}fontname="Arial" ${fontcolor}label="${label}"]`
  }
  return `  "${fromNode}" -> "${toNode}"${edgeLabel};\n`
}

/**
 * @param  {Array} tags of tag strings
 * @param  {Array} platforms of platform strings
 * @return {string} dot html table cell
 */
function tagsLine (tags, platforms) {
  // Combine tags and platforms into one cell in table
  const line = []
  if (tags.length) {
    let tagStr = 'tags: ' + tags.join(', ')
    tagStr = tagStr.replace(/([^\n]{90,800}?, )/g, '$1<BR ALIGN="LEFT"/>')
    line.push(tagStr)
  }
  if (platforms.length) {
    let platformStr = 'platforms: ' + platforms.join(', ')
    platformStr = platformStr.replace(/([^\n]{90,800}?, )/g, '$1<BR ALIGN="LEFT"/>')
    line.push(platformStr)
  }
  if (line.length) {
    return line.join('<BR ALIGN="LEFT"/>')
  } else {
    return ''
  }
}

// ----- helper functions hierarchy diagrams

/**
 * Show the empty safetyclass as 'none'
 * @param  {string} sc safetyclass
 * @return {string}
 */
function scStr (sc) {
  return (sc === '') ? 'none' : sc
}

/**
 * return string representation of safetyclass part of doctype
 * @param {string} doctypeWithSafetyclass formatted as doctype:safetyclass
 * @return {string} safetyclass part
 */
function dtScStr (doctypeWithSafetyclass) {
  return scStr(doctypeWithSafetyclass.split(':')[1])
}

/**
 * Put quotes around IDs containing spaces
 * @param {string} id
 * @return {string}
 */
function quoteId (id) {
  if (id.includes(' ')) {
    id = `"${id}"`
  }
  return id
}

/**
 * Report when number of nodes are limited to console
 * @param {integer} maxNodes
 */
function reportLimitExeeded (maxNodes) {
  console.log(`More than ${maxNodes} specobjects. Graph is limited to 1st ${maxNodes} encountered.`)
}

/** function pointer to reporting function */
let limitReporter = reportLimitExeeded

/**
 * Set reporting function
 * @param {function} reportingFunction someFunction(maxLimit)
 */
export function setLimitReporter (reportingFunction) {
  limitReporter = reportingFunction
}

/**
 * @classdesc Derived class with capability to generate diagrams of contained oreqm data.
 */
export class ReqM2Oreqm extends ReqM2Specobjects {
  /**
   * Construct new object
   * @param {string} filename of the oreqm file
   * @param {string} content XML data
   * @param {string[]} excludedDoctypes List of doctypes to exclude from diagram
   * @param {string[]} excludedIds List of IDs to exclude from diagram
   */
  constructor (filename, content, excludedDoctypes, excludedIds) {
    super(filename, content, excludedDoctypes, excludedIds)
    // diagram related members
    this.doctypeClusters = null // A map of {doctype : [doctype:safetyclass]}
    this.dtMap = null // new Map(); // A map of { doctypeName : DoctypeRelations }
    this.safetyRegexArray = [] // Array of regex to match relations
  }

  /** @description Initial part of dot file */
  static get DOT_PREAMBLE () {
    const preamble = `digraph "" {
  rankdir="RL"
  node [shape=plaintext fontname="Arial" fontsize=16]
  edge [color="blue",dir="forward",arrowhead="normal",arrowtail="normal"];

`
    return preamble
  }

  /** @description Final part of dot file */
  static get DOT_EPILOGUE () {
    const epilogue = '\n}\n'
    return epilogue
  }

  /**
   * Format a node to dot format. Use a cache to speed up subsequent renderings.
   * @param {string} reqId
   * @param {boolean} ghost Is this a deleted speocobject (in a comparison)
   * @param {boolean} showCoverage
   * @param {boolean} colorStatus
   * @return {string} dot html table string
   */
  getFormatNode (reqId, ghost, showCoverage, colorStatus) {
    let node
    if (this.formatCache.has(reqId)) {
      node = this.formatCache.get(reqId)
      // console.log('cache hit: ', req_id)
    } else {
      node = formatNode(
        reqId,
        this.requirements.get(reqId),
        ghost,
        this,
        showCoverage,
        colorStatus
      )
      this.formatCache.set(reqId, node)
    }
    return node
  }

  /**
   * Return a 'dot' compatible graph with the subset of nodes nodes
   * accepted by the selectionFunction.
   * Also updates the doctype table in lower left of window.
   * The 'TOP' node forces a sensible layout for highest level requirements
   * (some level of visual proximity and aligned to the left of the graph)
   * @param {function} selectionFunction A function which tells if a particular node is included
   * @param {array} topDoctypes List of doctypes to link to 'TOP' node
   * @param {string} title diagram legend as dot html table
   * @param {object} highlights List of object IDs to be outlined as selected
   * @param {number} maxNodes Upper limit of nodes to render
   * @param {boolean} showCoverage
   * @param {boolean} colorStatus
   * @return {string} dot graph
   */
  createGraph (
    selectionFunction,
    topDoctypes,
    title,
    highlights,
    maxNodes,
    showCoverage,
    colorStatus
  ) {
    //rq: ->(rq_dot) D(* Function shall output a dot graph*)
    let graph = ReqM2Oreqm.DOT_PREAMBLE
    const subset = []
    const ids = this.requirements.keys()
    let nodeCount = 0
    let edgeCount = 0
    const doctypeDict = new Map() // { doctype : [id] }  list of id's per doctype
    const selectedDict = new Map() // { doctype : [id] } list of selected id's per doctype
    const selectedNodes = []
    let limited = false
    for (const reqId of ids) {
      this.doctypeGrouping(
        reqId,
        doctypeDict,
        selectedDict,
        selectionFunction,
        subset,
        highlights,
        selectedNodes
      )
      if (subset.length > maxNodes) {
        limited = true
        limitReporter(maxNodes) //rq: ->(rq_config_node_limit)
        break // hard limit on node count
      }
      this.subset = selectedNodes // keep this subset to enable "save selection"
    }
    let showTop;
    ({ showTop, graph } = this.handleTopNode(topDoctypes, graph))

    // babel artifact? below names must match what is used in return from visibleDuplicates()
    let arraysOfDuplicates
    let notDuplicates;
    ({ arraysOfDuplicates, notDuplicates } = this.visibleDuplicates(
      subset
    ))
    // console.log(arraysOfDuplicates)
    // console.log(notDuplicates)
    for (const dupList of arraysOfDuplicates) {
      //rq: ->(rq_dup_req_display)
      const dupClusterId = this.requirements.get(dupList[0]).id
      const versions = dupList.map((a) => this.requirements.get(a).version)
      const versionsSet = new Set(versions)
      const versionSetSize = versionsSet.size
      //console.log(dupList, versions, versionsSet, versions.length, versionSetSize)
      const dupVersions = versions.length !== versionSetSize
      const label = 'duplicate' + (dupVersions ? ' id + version' : ' id') //rq: ->(rq_dup_id_ver_disp)
      const fontcolor = dupVersions ? 'fontcolor="red" ' : ''
      graph += `subgraph "cluster_${dupClusterId}_dups" { color=grey penwidth=2 label="${label}" ${fontcolor}fontname="Arial" labelloc="t" style="rounded"\n`
      for (const reqId of dupList) {
        // duplicate nodes
        ({ graph, nodeCount } = this.addNodeToGraph(
          reqId,
          showCoverage,
          colorStatus,
          highlights,
          graph,
          nodeCount
        ))
      }
      graph += '}\n\n'
    }
    for (const reqId of notDuplicates) {
      // nodes
      ({ graph, nodeCount } = this.addNodeToGraph(
        reqId,
        showCoverage,
        colorStatus,
        highlights,
        graph,
        nodeCount
      ))
    }
    graph += '\n  # Edges\n'
    graph = this.handleTopNodeEdges(showTop, subset, topDoctypes, graph)
    for (const reqId of subset) {
      // edges
      ({ graph, edgeCount } = this.addDotEdge(
        reqId,
        subset,
        graph,
        edgeCount
      ))
    }
    graph += `\n  label=${title}\n  labelloc=b\n  fontsize=18\n  fontcolor=black\n  fontname="Arial"\n` //rq: ->(rq_diagram_legend)
    graph += ReqM2Oreqm.DOT_EPILOGUE
    this.dot = graph

    selectedNodes.sort()
    const result = {
      nodeCount: nodeCount,
      edgeCount: edgeCount,
      doctypeDict: doctypeDict,
      selectedDict: selectedDict,
      limited: limited,
      selectedNodes: selectedNodes
    }
    return result
  }

  addNodeToGraph (
    reqId,
    showCoverage,
    colorStatus,
    highlights,
    graph,
    nodeCount
  ) {
    const ghost = this.removedReqs.includes(reqId) || this.requirements.get(reqId).ffbPlaceholder === true
    let node = this.getFormatNode(reqId, ghost, showCoverage, colorStatus)
    node = this.addNodeEmphasis(reqId, node, reqId, highlights)
    graph += node + '\n'
    nodeCount += 1
    return { graph, nodeCount }
  }

  /**
   * Calculate the subset of visible nodes that are duplicates
   * @param {string[]} subset keys of visible nodes
   * @return { string[][], string[] } An array of visible duplicate sets, array of rest
   */
  visibleDuplicates (subset) {
    let setCopy = subset.slice()
    const notDuplicates = []
    const arraysOfDuplicates = []
    while (setCopy.length > 0) {
      const key = setCopy[0]
      const id = this.requirements.get(setCopy[0]).id
      if (this.duplicates.has(id)) {
        // Add the duplicates on the list to dupSet which are also in the subset
        const dupSet = []
        const dupArr = this.duplicates.get(id)
        for (const dupPair of dupArr) {
          if (setCopy.includes(dupPair.id)) {
            dupSet.push(dupPair.id)
          }
        }
        // Remove these ids/keys from setCopy
        const tempCopy = setCopy.filter(function (value, _index, _arr) {
          return !dupSet.includes(value)
        })
        setCopy = tempCopy
        arraysOfDuplicates.push(dupSet)
      } else {
        notDuplicates.push(key)
        setCopy = setCopy.slice(1)
      }
    }
    // console.log("visibleDuplicates", subset, arraysOfDuplicates, notDuplicates);
    return { arraysOfDuplicates, notDuplicates }
  }

  handleTopNodeEdges (showTop, subset, topDoctypes, graph) {
    if (showTop) {
      for (const reqId of subset) {
        if (topDoctypes.includes(this.requirements.get(reqId).doctype)) {
          graph += formatEdge(reqId, 'TOP', '', '', '', '')
        }
      }
    }
    return graph
  }

  /**
   * Add 'TOP' node if there will be edges to it.
   * @param {string[]} topDoctypes
   * @param {string} graph
   */
  handleTopNode (topDoctypes, graph) {
    let showTop = false
    for (const topDt of topDoctypes) {
      if (
        this.doctypes.has(topDt) &&
        !this.excludedDoctypes.includes(topDt)
      ) {
        showTop = true
      }
    }
    if (showTop) {
      graph += '  "TOP" [fontcolor=lightgray];\n\n'
    }
    return { showTop, graph }
  }

  addDotEdge (reqId, subset, graph, edgeCount) {
    let kind = ''
    let linkerror = { error: '' }
    if (this.linksto.has(reqId)) {
      for (const link of this.linksto.get(reqId)) {
        // Do not reference non-selected specobjets
        if (subset.includes(link)) {
          if (
            this.fulfilledby.has(reqId) &&
            this.fulfilledby.get(reqId).has(link)
          ) {
            kind = 'fulfilledby'
            linkerror = this.getFfbLinkError(link, reqId)
          } else {
            kind = null
            if (this.untraced.has(reqId) &&
                this.untraced.get(reqId).has(link))  {
              kind = 'untraced'
              console.log(kind)
            }
            linkerror = this.getLinkError(reqId, link)
          }
          graph += formatEdge(
            reqId,
            link,
            kind,
            linkerror.error,
            linkerror.color,
            linkerror.label
          )
          edgeCount += 1
        }
      }
    }
    return { graph, edgeCount }
  }

  /**
   * Calculate categories of nodes in diagram
   * @param {string} reqId of current node
   * @param {Map<string, string[]>} doctypeDict
   * @param {Map<string, string[]>} selectedDict
   * @param {function(string, Object, Set<number>)} selectionFunction
   * @param {string[]} subset [output] List of selected and reachable ids
   * @param {string[]} highlights [input] list of selected ids
   * @param {string[]} selectedNodes [output]
   */
  doctypeGrouping (
    reqId,
    doctypeDict,
    selectedDict,
    selectionFunction,
    subset,
    highlights,
    selectedNodes
  ) {
    const rec = this.requirements.get(reqId)
    if (!doctypeDict.has(rec.doctype)) {
      doctypeDict.set(rec.doctype, [])
      selectedDict.set(rec.doctype, [])
    }
    if (
      selectionFunction(reqId, rec, this.color.get(reqId)) &&
      !this.excludedDoctypes.includes(rec.doctype) &&
      !this.excludedIds.includes(reqId)
    ) {
      subset.push(reqId)
      doctypeDict.get(rec.doctype).push(reqId)
      if (highlights.includes(reqId)) {
        selectedDict.get(rec.doctype).push(reqId)
        selectedNodes.push(reqId)
      }
    }
  }

  /**
   * Decorate the node with a colored 'cluster¨' if one of special categories.
   * @param {string} reqId specobject id
   * @param {string} node 'dot' language node
   * @param {string} dotId svg level id
   * @param {string[]} highlights id's of selected nodes
   */
  addNodeEmphasis (reqId, node, dotId, highlights) {
    //rq: ->(rq_req_diff_show)
    if (this.newReqs.includes(reqId)) {
      node = `subgraph "cluster_${dotId}_new" { color=limegreen penwidth=2 label="new" fontname="Arial" labelloc="t" style="rounded"\n${node}}\n`
    } else if (this.updatedReqs.includes(reqId)) {
      node = `subgraph "cluster_${dotId}_changed" { color=orange3 penwidth=2 label="changed" fontname="Arial" labelloc="t" style="rounded"\n${node}}\n`
    } else if (this.removedReqs.includes(reqId)) {
      node = `subgraph "cluster_${dotId}_removed" { color=red penwidth=2 label="removed" fontname="Arial" labelloc="t" style="rounded"\n${node}}\n`
    }
    if (highlights.includes(reqId)) {
      //rq: ->(rq_highlight_sel)
      node = `subgraph "cluster_${dotId}" { id="sel_${dotId}" color=maroon3 penwidth=3 label="" style="rounded"\n${node}}\n`
    }
    return node
  }

  /**
   * Get error possibly associated with linksto
   * @param {string} req_id specobject id
   * @param {string} link specobject in linksto reference
   * @return {string} error string or ''
   */
  getLinkError (req_id, link) { //rq: ->(rq_show_diff_links)
    const rec = this.requirements.get(req_id)
    let error = ''
    let color = ''
    let label = ''
    for (const lt of rec.linksto) {
      if (lt.linksto === link) {
        error = lt.linkerror
        label = lt.diff
        switch (label) {
          case 'removed':
            color = '"#C00000" style=dashed'
            break
          case 'new':
            color = 'green3'
            break
          case 'chg':
            color = 'orange3'
            break
        }
      }
    }
    return { error: error, color: color, label: label }
  }

  /**
   * Get error possibly associated with fulfilledby link
   * @param {string} req_id specobject id
   * @param {string} link specobject in ffb reference
   * @return {string} error string or ''
   */
  getFfbLinkError (req_id, link) {
    const rec = this.requirements.get(req_id)
    let error = ''
    let color = ''
    let label = ''
    for (const ffb of rec.fulfilledby) {
      if (ffb.id === link) {
        error = ffb.ffblinkerror
        label = ffb.diff
        switch (label) {
          case 'removed':
            color = '"#C00000" style=dashed'
            break
          case 'new':
            color = 'green3'
            break
          case 'chg':
            color = 'orange3'
            break
        }
      }
    }
    return { error: error, label: label, color: color }
  }

  /**
   * Check two expanded doctype:safetyclass pairs for compliance with at least one of the supplied rules,
   * i.e. permitted safetyclass for providescoverage <from_safetyclass>:<to_safetyclass>
   * @param {string} from origin doctype:safetyclass
   * @param {string} to descination doctype:safetyclass
   * @return {boolean}
   */
  checkLinkstoSafe (from, to) {
    const combo = `${from}>${to}`
    for (const re of this.safetyRegexArray) {
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
  buildDoctypeWithSafetyclass (id, safety) {
    // construct a doctype name, qualified with safetyclass
    const rec = this.requirements.get(id)
    if (safety) {
      return `${rec.doctype}:${rec.safetyclass}`
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
  linkstoSafeColor (from, to) {
    return this.checkLinkstoSafe(from, to) ? '#00AA00' : '#FF0000'
  }

  /**
   * Build a mapping of doctype relations.
   * Update this.dtMap
   * @param {boolean} doctypeSafety consider safetyclass in diagram
   */
  buildDoctypeMapping (doctypeSafety) {
    const idList = this.requirements.keys()
    let doctype = null
    let destDoctype = null
    let basicDoctype = null
    this.doctypeClusters = new Map() // {doctype : [doctype:safetyclass]}
    for (const id of idList) {
      if (this.requirements.get(id).ffbPlaceholder === true) {
        // skip placeholders
        continue
      }
      // make a cluster of doctypes with the different safetyclasses
      basicDoctype = this.requirements.get(id).doctype
      if (!this.doctypeClusters.has(basicDoctype)) {
        this.doctypeClusters.set(basicDoctype, [])
      }
      doctype = this.buildDoctypeWithSafetyclass(id, doctypeSafety)
      if (!this.dtMap.has(doctype)) {
        this.dtMap.set(doctype, new DoctypeRelations(doctype))
        // Create clusters of refined doctypes, based on fundamental one
        if (!this.doctypeClusters.get(basicDoctype).includes(doctype)) {
          this.doctypeClusters.get(basicDoctype).push(doctype)
        }
      }

      this.dtMap.get(doctype).addInstance(id)
      // linksto
      if (this.linksto.has(id)) {
        const linksto = Array.from(this.linksto.get(id))
        for (const linkedId of linksto) {
          if (this.requirements.has(linkedId)) {
            destDoctype = this.buildDoctypeWithSafetyclass(
              linkedId,
              doctypeSafety
            )
            // console.log("add_linksto ", doctype, linked_id, dest_doctype)
            this.dtMap.get(doctype).addLinksto(destDoctype, [linkedId, id])
          }
        }
      }
      // needsobj
      const needList = Array.from(this.requirements.get(id).needsobj)
      for (const need of needList) {
        if (!need.endsWith('*')) {
          if (doctypeSafety) {
            // will need at least its own safetyclass
            destDoctype = `${need}:${this.requirements.get(id).safetyclass}`
          } else {
            destDoctype = need
          }
          // console.log("add_needsobj ", dest_doctype)
          this.dtMap.get(doctype).addNeedsobj(destDoctype)
        }
      }
      // fulfilledby
      const ffbList = Array.from(this.requirements.get(id).fulfilledby)
      for (const ffb of ffbList) {
        if (doctypeSafety) {
          // will need at least its own safetyclass
          destDoctype = `${ffb.doctype}:${
            this.requirements.get(id).safetyclass
          }`
        } else {
          destDoctype = ffb.doctype
        }
        // console.log("add_fulfilledby ", dest_doctype)
        this.dtMap.get(doctype).addFulfilledby(destDoctype, [id, ffb.id])
      }
    }
  }

  /**
   * Build safety regexes from strings
   * @return {boolean} true: regex list updated, false: regex broken
   */
  buildSafetyRegexes () {
    const result = processRuleSet(programSettings.safety_link_rules)
    if (result.pass) {
      this.safetyRegexArray = result.regex_list
    } else {
      // alert(result.error);
    }
    return result.pass
  }

  /**
   * Scan all requirements and summarize the relationships between doctypes
   * with counts of instances and relations (needsobj, linksto, fulfilledby)
   * When doctype_safety is true, the doctypes are qualified with the safetyclass
   * of the requirement as in <doctype>:<safetyclass> and these are the nodes rendered
   * @param {boolean} doctypeSafety false: plain doctype relations; true: safetyclass checks for doctype relations
   * @return {string} dot language diagram
   */
  scanDoctypes (doctypeSafety) {
    //rq: ->(rq_doctype_hierarchy)
    //rq: ->(rq_doctype_aggr_safety)
    if (doctypeSafety) {
      this.buildSafetyRegexes()
    }
    this.dtMap = new Map() // A map of { doctype_name : DoctypeRelations }
    this.buildDoctypeMapping(doctypeSafety)
    // DOT language start of diagram
    let graph = `digraph "" {
      rankdir="${doctypeSafety ? 'BT' : 'TD'}"
      node [shape=plaintext fontname="Arial" fontsize=16]
      edge [color="black" dir="forward" arrowhead="normal" arrowtail="normal" fontname="Arial" fontsize=11];\n\n`
    // Define the doctype nodes - the order affects the layout
    const doctypeArray = Array.from(this.doctypeClusters.keys())
    for (const doctype of doctypeArray) {
      const doctypesInCluster = this.doctypeClusters.get(doctype)
      let scStats = ''
      let countTotal = 0
      const scList = Array.from(doctypesInCluster.keys())
      scList.sort()
      let scString = ''
      for (const subDoctype of doctypesInCluster) {
        const dt = this.dtMap.get(subDoctype)
        const sc = subDoctype.split(':')[1]
        scString += `</TD><TD port="${scStr(sc)}">${scStr(sc)}: ${
          dt.count
        } `
        countTotal += dt.count
      }
      if (doctypeSafety) {
        scStats = `\n          <TR><TD>safetyclass:${scString}</TD></TR>`
      }
      const dtNode = `\
      "${doctype}" [label=<
        <TABLE BGCOLOR="${getColor(
          doctype
        )}" BORDER="0" CELLSPACING="0" CELLBORDER="1" COLOR="black" >
        <TR><TD COLSPAN="5" CELLSPACING="0" >doctype: ${doctype}</TD></TR>
        <TR><TD COLSPAN="5" ALIGN="LEFT">specobject count: ${countTotal}</TD></TR>${scStats}
      </TABLE>>];\n\n`
      graph += dtNode
    }
    let dt
    let count
    const doctypeEdges = Array.from(this.dtMap.keys())
    // Loop over doctypes
    for (const doctype of doctypeEdges) {
      dt = this.dtMap.get(doctype)
      // Needsobj links
      graph += `# linkage from ${doctype}\n`
      const needKeys = Array.from(dt.needsobj.keys())
      if (!doctypeSafety) {
        for (const nk of needKeys) {
          count = dt.needsobj.get(nk)
          graph += ` "${doctype.split(':')[0]}" -> "${
            nk.split(':')[0]
          }" [label="need(${count})${
            doctypeSafety ? `\n${dtScStr(doctype)}` : ''
          } " style="dotted"]\n`
        }
      }
      // linksto links
      const ltKeys = Array.from(dt.linksto.keys())
      for (let lk of ltKeys) {
        count = dt.linksto.get(lk).length
        graph += ` "${doctype.split(':')[0]}" -> "${
          lk.split(':')[0]
        }" [label="linksto(${count})${
          doctypeSafety ? `\\l${dtScStr(doctype)}>${dtScStr(lk)}` : ''
        } " color="${
          doctypeSafety ? this.linkstoSafeColor(doctype, lk) : 'black'
        }"]\n`
        if (doctypeSafety && !this.checkLinkstoSafe(doctype, lk)) {
          const provList = dt.linksto
            .get(lk)
            .map((x) => `${quoteId(x[1])} -> ${quoteId(x[0])}`)
          let dt2 = doctype
          if (dt2.endsWith(':')) {
            dt2 += '<none>'
          }
          if (lk.endsWith(':')) {
            lk += '<none>'
          }
          const problem = `${dt2} provcov to ${lk}\n  ${provList.join('\n  ')}`
          this.problemReport(problem)
        }
      }
      // fulfilledby links
      const ffbKeys = Array.from(dt.fulfilledby.keys())
      for (const ffb of ffbKeys) {
        count = dt.fulfilledby.get(ffb).length
        graph += ` "${doctype.split(':')[0]}" -> "${
          ffb.split(':')[0]
        }" [label="fulfilledby(${count})${
          doctypeSafety ? `\n${dtScStr(ffb)}>${dtScStr(doctype)}` : ''
        } " color="${
          doctypeSafety ? this.linkstoSafeColor(ffb, doctype) : 'purple'
        }" style="dashed"]\n`
        if (doctypeSafety && !this.checkLinkstoSafe(ffb, doctype)) {
          const problem = `${ffb} fulfilledby ${doctype}`
          this.problemReport(problem)
        }
      }
    }
    let rules
    if (doctypeSafety) {
      const safetyRulesString = JSON.stringify(
        programSettings.safety_link_rules,
        null,
        2
      )
      rules = {
        text: xmlEscape(safetyRulesString.replace(/\\/g, '\\\\')).replace(/\n/gm, '<BR ALIGN="LEFT"/> '),
        title: 'Safety rules for coverage<BR/>list of regex<BR/>doctype:safetyclass&gt;doctype:safetyclass'
      }
    }
    //rq: ->(rq_diagram_legend)
    graph += `\n  label=${this.constructGraphTitle(
      false,
      rules,
      null,
      false,
      null
    )}\n  labelloc=b\n  fontsize=14\n  fontcolor=black\n  fontname="Arial"\n`
    graph += '\n}\n'
    // console.log(graph)
    this.dot = graph
    return graph
  }

  /**
   * Construct diagram legend as 'dot' table.
   * @param {boolean} showFilters display selection criteria
   * @param {object} extra object with .title and .text for additional row
   * @param {object} oreqmRef optional reference (2nd) oreqm object
   * @param {string} searchLang search language, one of 'id', 'reg', 'vql'
   * @param {string} searchPattern 'selection criteria' string
   * @return {string} 'dot' table
   */
  constructGraphTitle (
    showFilters,
    extra,
    oreqmRef,
    searchLang,
    searchPattern
  ) {
    //rq: ->(rq_diagram_legend)
    let title = '""'
    title = '<\n    <table border="0" cellspacing="0" cellborder="1">\n'
    title += `      <tr><td cellspacing="0" >File</td><td>${this.filename.replace(
      /([^\n]{30,500}?(\\|\/))/g,
      '$1<BR ALIGN="LEFT"/>'
    )}</td><td>${this.timestamp}</td></tr>\n`

    if (showFilters) {
      if (oreqmRef) {
        title += `      <tr><td>Ref. file</td><td>${oreqmRef.filename.replace(
          /([^\n]{30,500}?(\\|\/))/g,
          '$1<BR ALIGN="LEFT"/>'
        )}</td><td>${oreqmRef.timestamp}</td></tr>\n`
      }
      if (searchPattern.length) {
        const searchFormatted = xmlEscape(
          searchPattern.replace(/&/g, '&amp;')
        )
        const patternString = searchFormatted
          .trim()
          .replace(/([^\n]{40,500}?\|)/g, '$1<BR ALIGN="LEFT"/>')
          .replace(/\n/g, '<BR ALIGN="LEFT"/>')
        if (searchLang === 'ids') {
          title += `      <tr><td>Search &lt;id&gt;</td><td colspan="2">${patternString.replace(
            /\\/g,
            '\\\\'
          )}<BR ALIGN="LEFT"/></td></tr>\n`
        } else {
          title += `      <tr><td>Search text</td><td colspan="2">${patternString.replace(
            /\\/g,
            '\\\\'
          )}<BR ALIGN="LEFT"/></td></tr>\n`
        }
      }
      const exDtList = this.excludedDoctypes
      if (exDtList.length) {
        title += `      <tr><td>excluded doctypes</td><td colspan="2">${exDtList
          .join(', ')
          .replace(/([^\n]{60,500}? )/g, '$1<BR ALIGN="LEFT"/>')}</td></tr>\n`
      }

      let excludedIds = []
      for (let ei of this.excludedIds) {
        excludedIds.push(xmlEscape(ei))
      }
      if (excludedIds.length) {
        title += `      <tr><td>excluded &lt;id&gt;s</td><td colspan="2">${excludedIds.join(
          '<BR ALIGN="LEFT"/>'
        )}<BR ALIGN="LEFT"/></td></tr>\n`
      }
    }

    if (
      extra &&
      extra.title &&
      extra.text &&
      extra.title.length &&
      extra.text.length
    ) {
      title += `      <tr><td>${extra.title}</td><td colspan="2">${extra.text}<BR ALIGN="LEFT"/></td></tr>\n`
    }
    title += '    </table>>'
    // console.log(title)
    return title
  }

  /**
   * Generate ffb and coverage rows
   */
  generateLinkRows (reqId) {
    const rec = this.requirements.get(reqId)
    let ffbrows = ''
    for (const ffb of rec.fulfilledby) {
      const row = `<tr><td width="15%">${ffb.doctype}</td><td width="60%">${ffb.id}, Version ${ffb.version}</td><td width="25%">${ffb.ffblinkerror}</td></tr>`
      ffbrows += row
    }
    let covrows = ''
    for (const lt of rec.linksto) {
      const ltDoctype = this.requirements.has(lt.linksto) ? this.requirements.get(lt.linksto).doctype : ''
      const row = `<tr><td width="15%">${ltDoctype}</td><td width="60%">${lt.linksto}, Version ${lt.dstversion}</td><td width="25%">${lt.linkerror}</td></tr>`
      covrows += row
    }
    if (ffbrows.length) {
      ffbrows = `<tr><td>Fulfilledby</td><td><table BORDER="1" CELLSPACING="0" CELLBORDER="1" COLOR="black" width="100%">${ffbrows}</table></td></tr>`
    }
    if (covrows.length) {
      covrows = `<tr><td>Provides</td><td><table BORDER="1" CELLSPACING="0" CELLBORDER="1" COLOR="black" width="100%">${covrows}</table></td></tr>`
    }
    return ffbrows+covrows
  }

  /**
   * Create a HTML div with all specobjects
   */
  generateHtmlTable () {
    let reqList = this.getIdList()
    let reqCount = reqList.length
    let reqProgress = 0
    progressbarStart('Creating table view', `${reqCount} entries`, reqCount)
    reqList.sort()
    let table = '<div>\n'
    for (let reqId of reqList) {
      const ghost = this.removedReqs.includes(reqId) || this.requirements.get(reqId).ffbPlaceholder === true
      const nodeId = `spec_${reqId}`
      const linkRows = this.generateLinkRows(reqId)
      let node = this.getFormatNode(reqId, ghost, true, true)
        .replace(/.*label=</, '')
        .replace(/>\];/, '')
        .replace(/COLOR="black"/, 'COLOR="black" width="100%"')
        .replace(/ BORDER="0"/, ' BORDER="1"')
        .replace(/ <\/TABLE>/, `   ${linkRows}\n      </TABLE>`)
      table += `<div id="${nodeId}">${node}\n<hr>\n</div>`
      reqProgress += 1
      if (reqProgress % 20 === 0) {
        progressbarUpdateValue(reqProgress)
      }
    }
    table += '</div>\n'
    progressbarStop()
    return table
  }

  isReqVisible (reqId) {
    return !this.excludedIds.includes(reqId) &&
           !this.excludedDoctypes.includes(this.requirements.get(reqId).doctype)
  }
  /**
   * Get all the specobject ids
   * @returns list of strings
   */
  getIdList () {
    return Array.from(this.requirements.keys())
  }

}

/**
 * show/hide the div's representing the specobjects
 * @param {Object} _divMap A mapping from <id> to
 * @param {string[]} _reqList
 */
export function filterHtmlTable (_divMap, _reqList) {

}
