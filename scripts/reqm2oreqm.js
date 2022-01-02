/* Main class for managing oreqm xml data */
'use strict'
// eslint-disable-next-line no-redeclare
/* global DOMParser, alert */
import { cloneDeep } from "lodash"
import { getTimeNow, logTimeSpent } from './util.js'
/** placeholder for XMLSerializer instance */
let serializer = null

/** depth at this level and above is infinite (does not count down) */
const INFINITE_DEPTH = 100

/**
 * Process xml input text and display possible errors detected
 * @param {string} xmlString
 */
function tryParseXML (xmlString) {
  const parser = new DOMParser()
  const parsererrorNS = parser.parseFromString('INVALID', 'text/xml').getElementsByTagName('parsererror')[0].namespaceURI
  const dom = parser.parseFromString(xmlString, 'text/xml')
  const errors = dom.getElementsByTagNameNS(parsererrorNS, 'parsererror')
  if (errors.length > 0) {
    let text = ''
    for (const t of errors[0].childNodes) {
      text += t.textContent + '\n'
    }
    throw new Error(text)
  }
  return dom
}

// XML data extraction utility functions

/**
 * Return the text in the first (only?) tag with specified tag name
 * @param {object} node specobject
 * @param {string} tagName name of tag
 * @return {string}
 */
function getXmlText (node, tagName) {
  let result = ''
  const item = node.getElementsByTagName(tagName)
  if (item.length > 0) {
    result = item[0].textContent
  }
  return result
}

/**
 * Return list of texts found in specified xml tags (multiple instances possible)
 * @param {object} node
 * @param {string} tagName
 * @return {string[]} list of text
 */
function getListOf (node, tagName) {
  const result = []
  const items = node.getElementsByTagName(tagName)
  let i
  for (i = 0; i < items.length; i++) {
    result.push(items[i].textContent)
  }
  return result
}

/**
 * Return list of <linkerror> and <ffbLinkerror> with error text and addressed specobject
 * @param {object} node
 * @return {string[]} list of text
 */
 function getErrorListOf (node) {
  const result = []
  const pcov = node.getElementsByTagName('provcov')
  for (let p of pcov) {
    let err = getXmlText(p, 'linkerror')
    if (err.length) {
      let id = getXmlText(p, 'linksto')
      result.push(`${err} <id> ${id}`)
    }
  }
  return result
}

/**
 * Return list of <linkerror> and <ffbLinkerror> with error text and addressed specobject
 * @param {object} node
 * @return {string[]} list of text
 */
 function getFfbErrorListOf (node) {
  const result = []
  const ffbs = node.getElementsByTagName('ffbObj')
  for (let f of ffbs) {
    let err = getXmlText(f, 'ffbLinkerror')
    if (err.length) {
      let id = getXmlText(f, 'ffbId')
      result.push(`ffb ${err} <id> ${id}`)
    }
  }
  return result
}


/**
 * A specobject needs coverage, but hasn't any for some doctype
 * I.e. at least one <linkedfrom> in every <needscov>
 * @param {string} node xml object
 * @returns list of missing doctypes
 */
function checkNeedsobjCoverageMissing (node) {
  let missing = []
  const nc = node.getElementsByTagName('needscov')
  for (let n of nc) {
    let dt = getXmlText(n, 'needsobj')
    const items = n.getElementsByTagName('linkedfrom')
    if (items.length === 0) {
      missing.push(dt)
    }
  }
  return missing
}

/**
 * Get linksto references from specobject XML
 * @param {specobject} node
 * @return {object[]} an array of objects with .linksto .dstversion and .linkerror
 */
function getLinksto (node) {
  const result = []
  const items = node.getElementsByTagName('provcov')
  let i
  for (i = 0; i < items.length; i++) {
    const linksto = items[i].getElementsByTagName('linksto')
    // istanbul ignore next
    if (linksto.length !== 1) {
      console.log('Multiple <linksto> in <provcov>')
      continue
    }
    const dstversion = items[i].getElementsByTagName('dstversion')
    let dstversionTxt
    // istanbul ignore next
    if (dstversion.length !== 1) {
      dstversionTxt = 'multiple'
    } else {
      dstversionTxt = dstversion[0].textContent
    }
    const linkerror = items[i].getElementsByTagName('linkerror')
    // if (linkerror) {
    //   console.log(linkerror[0].textContent)
    // }
    let linkErrorTxt = (linkerror && linkerror.length > 0) ? linkerror[0].textContent : ''
    if (linkErrorTxt && linkErrorTxt.startsWith('source ')) {
      // Do not render 'source not covered.' and 'source status 'rejected' excluded from tracing.' in diagram edges
      linkErrorTxt = ''
    }
    const link = {
      linksto: linksto[0].textContent,
      dstversion: dstversionTxt,
      linkerror: linkErrorTxt,
      diff: '', // In comparisons of oreqm files this may become 'rem' or 'new'
      kind: 'provcov'
    }
    result.push(link)
  }
  return result
}

/**
 * Get untracedLink references from specobject XML
 * @param {specobject} node
 * @return {object[]} an array of objects with .target .targetVersion and .linkerror
 */
 function getUntracedLink (node) {
  const result = []
  const items = node.getElementsByTagName('untracedLink')
  for (const item of items) {
    const target = item.getElementsByTagName('target')
    const targetVersion = item.getElementsByTagName('targetVersion')
    let targetVersionTxt
    // istanbul ignore next
    if (targetVersion.length === 1) {
      targetVersionTxt = targetVersion[0].textContent
    } else {
      targetVersionTxt = ''
    }
    const linkerror = item.getElementsByTagName('linkerror')
    let linkErrorTxt = (linkerror && linkerror.length > 0) ? linkerror[0].textContent : ''
    if (linkErrorTxt && linkErrorTxt.startsWith('source ')) {
      // Do not render 'source not covered.' and 'source status 'rejected' excluded from tracing.' in diagram edges
      linkErrorTxt = ''
    }
    const link = {
      linksto: target[0].textContent,
      dstversion: targetVersionTxt,
      linkerror: linkErrorTxt,
      diff: '', // In comparisons of oreqm files this may become 'rem' or 'new'
      kind: 'untraced'
    }
    result.push(link)
  }
  return result
}

/**
 * Return a list of arrays (id,doctype,version) of the ffbObj's
 * @param {object} node
 * @return {object[]} list
 */
function getFulfilledby (node) {
  const ffList = []
  const ffbobjList = node.getElementsByTagName('ffbObj')
  let i
  for (i = 0; i < ffbobjList.length; i++) {
    const ffbobj = ffbobjList[i]
    const ffbLinkerrorList = ffbobj.getElementsByTagName('ffbLinkerror')
    // if (ffbLinkerrorList) {
    //   console.log('ffbLinkerror:', ffbLinkerrorList[0].textContent)
    // }
    let ffbLinkerrorTxt = (ffbLinkerrorList && ffbLinkerrorList.length > 0) ? ffbLinkerrorList[0].textContent : ''
    if (ffbLinkerrorTxt && ffbLinkerrorTxt.startsWith('target not ')) {
      // Do not render 'target not covered.' in diagram edges
      ffbLinkerrorTxt = ''
    }
    const ffEntry = {
      id: getXmlText(ffbobj, 'ffbId'),
      doctype: getXmlText(ffbobj, 'ffbType'),
      version: getXmlText(ffbobj, 'ffbVersion'),
      ffblinkerror: ffbLinkerrorTxt,
      diff: '',
      xml: ffbobj
    }
    if (ffEntry.id.includes('&nbsp;')) {
      ffEntry.id = ffEntry.id.replace('&nbsp;', '')
    }
    ffList.push(ffEntry)
  }
  return ffList
}

// let magic = 'BAT_SDK_1'

function linkstoCompare (a, b) {
  if (a.linksto < b.linksto) {
    return -1
  }
  if (a.linksto > b.linksto) {
    return 1
  }
  return 0
}

/**
 * Compare aIn and bIn objects, while ignoring the fields listed in ignoreList
 * @param {object} aIn
 * @param {object} bIn
 * @param {[string]} ignoreList
 * @return {boolean} is the subset of fields equal
 */
function stringEqual (aIn, bIn, ignoreList) {
  if (bIn === undefined) return false
  const a = cloneDeep(aIn)
  const b = cloneDeep(bIn)
  // console.log(typeof(a), a, typeof(b), b)

  // Make sure list items are in same order for comparison
  a.linksto.sort(linkstoCompare)
  a.dependson.sort()
  a.needsobj.sort()
  a.platform.sort()
  a.verifymethods.sort()
  a.releases.sort()
  a.conflicts.sort()
  a.tags.sort()

  b.linksto.sort(linkstoCompare)
  b.dependson.sort()
  b.needsobj.sort()
  b.platform.sort()
  b.verifymethods.sort()
  b.releases.sort()
  b.conflicts.sort()
  b.tags.sort()

  // istanbul ignore else
  if (typeof (a) === 'object' && typeof (b) === 'object') {
    for (const field of ignoreList) {
      // force ignored fields empty
      a[field] = null
      b[field] = null
    }
    // Remove generated data elements before comparison
    a.xml = null
    b.xml = null
    if (a.linksto !== null) {
      for (let lt of a.linksto) {
        lt.error = ''
        lt.diff = ''
      }
    }
    if (a.fulfilledby !== null) {
      for (let ffb of a.fulfilledby) {
      ffb.ffblinkerror = null
      ffb.diff = null
      ffb.xml = null
      }
    }
    if (b.linksto !== null) {
      for (let lt of b.linksto) {
      lt.error = ''
      lt.diff = ''
      }
    }
    if (b.fulfilledby !== null) {
      for (let ffb of b.fulfilledby) {
      ffb.ffblinkerror = null
      ffb.diff = null
      ffb.xml = null
      }
    }
  }
  const aString = JSON.stringify(a)
  const bString = JSON.stringify(b)
  let equal = aString === bString
  // if (!equal && aString.includes(magic)) {
  //   console.log(aString, bString)
  // }
  if (!equal) {
    //console.log(aIn.id)
  }
  return equal
}

/**
 * These are the shorthand tags that maps to xml tags in speobjects
 * key: is the name of the tag
 * field: is the field name in the JS object
 * list: indicates is this is a list of entries
 * freetext: indicates if the content is free form, meaning that a search
 * would like be for an embedded word, rather that an exact match
 */
export const searchTags = [
  { key: 'dt', field: 'doctype', list: false, freetext: false},
  { key: 'id', field: 'id', list: false, freetext: false},
  { key: 've', field: 'version', list: false, freetext: false},
  { key: 'de', field: 'description', list: false, freetext: true},
  { key: 'no', field: 'needsobj', list: true, freetext: false},
  { key: 'sd', field: 'shortdesc', list: false, freetext: true},
  { key: 'rt', field: 'rationale', list: false, freetext: true},
  { key: 'sr', field: 'safetyrationale', list: false, freetext: true},
  { key: 'scr', field: 'securityrationale', list: false, freetext: true},
  { key: 'scl', field: 'securityclass', list: false, freetext: false},
  { key: 'vc', field: 'verifycrit', list: false, freetext: true},
  { key: 'vm', field: 'verifymethods', list: true, freetext: true},
  { key: 'vco', field: 'verifycond', list: false, freetext: true},
  { key: 'co', field: 'comment', list: false, freetext: true},
  { key: 'fi', field: 'furtherinfo', list: false, freetext: true},
  { key: 'uc', field: 'usecase', list: false, freetext: true},
  { key: 'src', field: 'source', list: false, freetext: true},
  { key: 'srv', field: 'sourcerevision', list: false, freetext: true},
  { key: 'cd', field: 'creationdate', list: false, freetext: true},
  { key: 'sf', field: 'sourcefile', list: false, freetext: true},
  { key: 'ti', field: 'testin', list: false, freetext: true},
  { key: 'tx', field: 'testexec', list: false, freetext: true},
  { key: 'to', field: 'testout', list: false, freetext: true},
  { key: 'tp', field: 'testpasscrit', list: false, freetext: true},
  { key: 'dep', field: 'dependson', list: true, freetext: false},
  { key: 'con', field: 'conflicts', list: true, freetext: false},
  { key: 'rel', field: 'releases', list: true, freetext: false},
  { key: 'cat', field: 'category', list: false, freetext: true},
  { key: 'pri', field: 'priority', list: false, freetext: false},
  { key: 'tag', field: 'tags', list: true, freetext: false},
  { key: 'plt', field: 'platform', list: true, freetext: false},
  { key: 'sc', field: 'safetyclass', list: false, freetext: false},
  { key: 'st', field: 'status', list: false, freetext: false},
  { key: 'cs', field: 'covstatus', list: false, freetext: false},
  { key: 'ffb', field: 'fulfilledby', list: true, freetext: false},
  { key: 'vio', field: 'violations', list: true, freetext: true},
  { key: 'err', field: 'errors', list: true, freetext: true},
  { key: 'fer', field: 'ffberrors', list: true, freetext: true},
  { key: 'mic', field: 'miscov', list: true, freetext: true}
  // below are meta items
  // { key: 'dup', field: '', list: false},
  // { key: 'rem', field: '', list: false},
  // { key: 'chg', field: '', list: false},
  // { key: 'new', field: '', list: false},
  // { key: '', field: '', list: false}
]

export const metaTags = [
  'dup',
  'rem',
  'chg',
  'new'
]

export function searchTagsLookup (keyval) {
  for (let rec of searchTags) {
    if (rec.key === keyval) {
      return rec
    }
  }
  return undefined
}

// Create dictionary of tags to their order of appearance
export let searchTagOrder = new Map()
let searchTagOrd = 0

for (let t of searchTags) {
  searchTagOrder.set(t.key, searchTagOrd)
  searchTagOrd++
}
for (let t of metaTags) {
  searchTagOrder.set(t, searchTagOrd)
  searchTagOrd++
}

/**
 * Generate tooltip string from table of searchable tags
 * @returns string
 */
export function searchTooltip (lang) {
  let tooltip = ''
  if (lang === 'vql') {
    tooltip = '&nbsp;<b>Available tags:</b><br/>'
    // Sort tooltips according to field
    let sortedSearchTags = [...searchTags]
    sortedSearchTags.sort((a, b) => (a.field > b.field) ? 1 : -1)
    //console.log(sortedSearchTags)
    for (let row of sortedSearchTags) {
      let freetext = row.freetext ? '*' : ''
    let tag = row.key.length > 2 ? `${row.key}:` : `${row.key}:&nbsp;`
      tooltip += `<b>&nbsp;${tag}</b>&nbsp;&lt;${row.field}&gt;${freetext}<br/>`
    }
  } else {
    tooltip = '&nbsp;<b>Use tags in this order:</b><br/>'
    for (let row of searchTags) {
      let freetext = row.freetext ? '*' : ''
      tooltip += `<b>&nbsp;${row.key}:</b>&nbsp;&lt;${row.field}&gt;${freetext}<br/>`
    }
  }
  tooltip += '<b>&nbsp;dup:</b>&nbsp;duplicate<br/>'
  tooltip += '<b>&nbsp;rem:</b>|<b>chg:</b>|<b>new:</b>&nbsp;diff'
  return tooltip
}

/**
 * This class reads and manages information in ReqM2 .oreqm files
 */
export class ReqM2Specobjects {
  constructor (filename, content, excludedDoctypes, excludedIds) {
    this.filename = filename // basename of oreqm file
    this.timestamp = '' // recorded time of ReqM2 run
    this.root = null // xml tree
    /** Map<doctype, id[]>  List of ids of a specific doctype */
    this.doctypes = new Map()
    /** Map<key, Requirement[]> Where key is === \<id> except for duplicates, where a :\<version> is suffixed for subsequent instances of \<id> */
    this.requirements = new Map()
    /** Map<id, {id:, version:}[]> where 2nd id is the effective (unique) key */
    this.duplicates = new Map()
    this.rules = new Map() // {ruleId : description}
    this.color = new Map() // {id:[color]} When traversing the graph of nodes a 'color' is associated with each visited node
    this.linksto = new Map() // {id:{id}} -- map to set of linked ids
    this.linkstoRev = new Map() // {id:{id}} -- reverse direction of linksto. i.e. top-down
    this.fulfilledby = new Map() // {id:{id}}
    this.untraced = new Map() // {id:{id}}
    this.excludedDoctypes = excludedDoctypes // [doctype]
    this.excludedIds = excludedIds // [id]
    this.noRejects = true // skip rejected specobjects
    this.newReqs = [] // List of new requirements (from comparison)
    this.updatedReqs = [] // List of updated requirements (from comparison)
    this.removedReqs = [] // List of removed requirements (copies taken from older(?) version of oreqm)
    this.problems = [] // string[] problems reports.
    this.searchCache = new Map() // Cache tagged string versions
    this.formatCache = new Map() // Cache 'dot' formatted nodes
    this.dot = 'digraph "" {label="Select filter criteria and exclusions, then click\\l                    [update graph]\\l(Unfiltered graphs may be too large to render)"\n  labelloc=b\n  fontsize=24\n  fontcolor=grey\n  fontname="Arial"\n}\n'

    // Initialization logic
    this.clearProblems()
    const success = this.processOreqmContent(content) //rq: ->(rq_read_oreqm)
    // istanbul ignore else
    if (success) {
      const now = getTimeNow()
      this.readReqm2Rules()
      this.readReqDescriptions()
      this.addFulfilledbyNodes()
      this.buildGraphTraversalLinks()
      this.timestamp = this.getTime()
      // const problems = this.getProblems()
      // if (problems) {
      //   // alert(problems);
      // }
      logTimeSpent(now, 'Analyzing oreqm XML')
    }
  }

  /**
   * Create a default diagram which acts as a mini user guide
   */
  setSvgGuide () {
    this.dot = 'digraph "" {label="Select filter criteria and exclusions, then click\\l                    [update graph]\\l(Unfiltered graphs may be too large to render)"\n  labelloc=b\n  fontsize=24\n  fontcolor=grey\n  fontname="Arial"\n}\n'
  }

  /**
   * Table driven creation of tagged search string.
   * Each tag is between ':'s followed by value
   * @param {object} rec
   * @returns string
   */
  buildTaggedString (rec) {
    let tagStr = ''
    for (let row of searchTags) {
      if (!row.list) {
        if (rec[row.field]) {
          tagStr += `:${row.key}:${rec[row.field]}\n/${row.key}/\n`
        }
      } else {
        for (let item of rec[row.field]) {
          let entry
          switch (row.field) {
            case 'fulfilledby':
              entry = `:${row.key}:${item.id}\n/${row.key}/\n`
              break;
            default:
              entry = `:${row.key}:${item}\n/${row.key}/\n`
              break;
          }
          tagStr += entry
        }
      }
    }
    // Handle meta-properties
    tagStr += this.duplicates.has(rec.id) ? '\n:dup:\n/dup/' : ''
    tagStr += this.removedReqs.includes(rec.id) ? '\n:rem:\n/rem/' : ''
    tagStr += this.updatedReqs.includes(rec.id) ? '\n:chg:\n/chg/' : ''
    tagStr += this.newReqs.includes(rec.id) ? '\n:new:\n/new/' : ''
    return tagStr
  }

  /**
   * Attempt to load XML and report if error detected
   * @param {string} content
   * @return {boolean} processing success
   */
  processOreqmContent (content) {
    try {
      const now = getTimeNow()
      this.root = tryParseXML(content)
      logTimeSpent(now, 'tryParseXML')
    } catch (err) // istanbul ignore next
    {
      console.log(err)
      alert(err)
      return false
    }
    return true
  }

  /**
   * Read the rules specified within the oreqm file, i.e. the rules behind 'violations'.
   * Store descriptions in map
   */
  readReqm2Rules () {
    const ruleList = this.root.getElementsByTagName('rule')
    for (const rule of ruleList) {
      const ruleIdArr = rule.getElementsByTagName('name')
      const ruleDescriptionArr = rule.getElementsByTagName('description')
      if (ruleIdArr.length === 1 && ruleDescriptionArr.length === 1) {
        // console.log(ruleIdArr[0].textContent, ruleDescriptionArr[0].textContent)
        this.rules.set(ruleIdArr[0].textContent, ruleDescriptionArr[0].textContent)
      }
    }
  }

  /**
  * Find and read all specobjects with associated doctypes
  */
  readReqDescriptions () {
    // Handle all sections with specobjects
    const specobjectsList = this.root.getElementsByTagName('specobjects')
    for (const specobjects of specobjectsList) {
      const doctype = specobjects.getAttributeNode('doctype').value
      if (!this.doctypes.has(doctype)) {
        this.doctypes.set(doctype, [])
      }
      this.readSpecobjectList(specobjects, doctype)
    }
  }

  /**
   * Read a single specobject and create and object for each
   * @param {object} node specobject
   * @param {string} doctype
   */
  readSpecobjectList (node, doctype) {
    // Read individual specobject
    const specobjectList = node.getElementsByTagName('specobject')
    for (const comp of specobjectList) {
      this.addOneSpecobject(comp, doctype)
    }
  }

  /**
   * Add XML representation of specobject to oreqm container
   * @param {object} comp
   */
  addOneSpecobject (comp, doctype) {
    const req = new Object()
    req.id = getXmlText(comp, 'id')
    if (req.id.includes('&nbsp;')) {
      const problem = `specobject <id> contains &amp;nbsp;  ${req.id}`
      this.problemReport(problem)
      req.id = req.id.replace('&nbsp;', '')
    }
    req.comment = getXmlText(comp, 'comment')
    req.covstatus = getXmlText(comp, 'covstatus')
    req.dependson = getListOf(comp, 'dependson')
    req.description = getXmlText(comp, 'description')
    req.doctype = doctype
    req.fulfilledby = getFulfilledby(comp)
    req.furtherinfo = getXmlText(comp, 'furtherinfo')
    let untraced = getUntracedLink(comp)
    req.linksto = getLinksto(comp).concat(untraced)
    req.needsobj = getListOf(comp, 'needsobj')
    req.platform = getListOf(comp, 'platform')
    req.rationale = getXmlText(comp, 'rationale')
    req.safetyclass = getXmlText(comp, 'safetyclass')
    req.safetyrationale = getXmlText(comp, 'safetyrationale')
    req.securityclass = getXmlText(comp, 'securityclass')
    req.securityrationale = getXmlText(comp, 'securityrationale')
    req.shortdesc = getXmlText(comp, 'shortdesc')
    req.source = getXmlText(comp, 'source')
    req.sourcefile = getXmlText(comp, 'sourcefile')
    req.sourceline = getXmlText(comp, 'sourceline')
    req.sourcerevision = getXmlText(comp, 'sourcerevision')
    req.creationdate = getXmlText(comp, 'creationdate')
    req.category = getXmlText(comp, 'category')
    req.priority = getXmlText(comp, 'priority')
    req.securityclass = getXmlText(comp, 'securityclass')
    req.securityrationale = getXmlText(comp, 'securityrationale')
    req.verifymethods = getListOf(comp, 'verifymethod')
    req.verifycond = getXmlText(comp, 'verifycond')
    req.testin = getXmlText(comp, 'testin')
    req.testexec = getXmlText(comp, 'testexec')
    req.testout = getXmlText(comp, 'testout')
    req.testpasscrit = getXmlText(comp, 'testpasscrit')
    req.releases = getListOf(comp, 'release')
    req.conflicts = getListOf(comp, 'conflictswith')
    req.status = getXmlText(comp, 'status')
    req.tags = getListOf(comp, 'tag')
    req.usecase = getXmlText(comp, 'usecase')
    req.verifycrit = getXmlText(comp, 'verifycrit')
    req.version = getXmlText(comp, 'version')
    req.violations = getListOf(comp, 'ruleid')
    req.errors = getErrorListOf(comp)
    req.ffberrors = getFfbErrorListOf(comp)
    req.miscov = checkNeedsobjCoverageMissing(comp)
    req.ffbPlaceholder = false
    req.xml = comp
    this.addSpecobjectRec(req)
  }

  /**
   * Add JS representation of specobject to oreqm container
   * @param {object} req JS object
   */
  addSpecobjectRec (req) {
    let doctype = req.doctype
    // There may be duplicate <id>'s in use.
    let key = req.id
    let reportDuplicate = true
    while (this.requirements.has(key)) {
      //rq: ->(rq_dup_req)
      // Check for unique versions
      if (reportDuplicate && this.requirements.get(key).version === req.version) {
        const problem = `specobject '${req.id}' is duplicated with same version '${req.version}'`
        // console.log(problem);
        //rq: ->(rq_dup_same_version)
        this.problemReport(problem)
        reportDuplicate = false
      }
      // Add suffix until id is unique
      key += ':' + req.version
    }
    this.requirements.set(key, req)
    // Keep track of duplicates and their versions
    if (key !== req.id) {
      // istanbul ignore else
      if (!this.duplicates.has(req.id)) {
        // Create list of duplicates for this <id>
        const firstReq = this.requirements.get(req.id)
        this.duplicates.set(req.id, [{ id: firstReq.id, version: firstReq.version }])
      }
      // Add duplicate
      this.duplicates.get(req.id).push({ id: key, version: req.version })
    }
    // Add new doctype list if unknown
    if (!this.doctypes.has(doctype)) {
      this.doctypes.set(doctype, [])
    }
    const dtArr = this.doctypes.get(doctype)
    // istanbul ignore else
    if (!dtArr.includes(key)) {
      dtArr.push(key)
      this.doctypes.set(doctype, dtArr) // keep status per doctype
    }
  }

  /**
   * Create placeholders for absent 'fulfilledby' requirements.
   * Add doctype to needsobj if not present
   */
  addFulfilledbyNodes () {
    //rq: ->(rq_ffb_placeholder)
    const ids = Array.from(this.requirements.keys())
    let newNodes = new Map() // need a new container to add after loop
    for (const reqId of ids) {
      const rec = this.requirements.get(reqId)
      const ffbList = Array.from(rec.fulfilledby)
      for (const ffArr of ffbList) {
        const ffId = ffArr.id
        const ffDoctype = ffArr.doctype
        const ffVersion = ffArr.version
        const key = this.getKeyForIdVer(ffId, ffVersion)
        //console.log(reqId, key, newNodes)
        if (!this.requirements.has(key)) {
          if (!newNodes.has(key)) {
            // Create placeholder for ffb node
            //console.log("new object", key, ffId, ffDoctype, ffVersion)
            const newNode = {
              comment: '',
              dependson: [],
              description: '*FULFILLEDBY PLACEHOLDER*',
              doctype: ffDoctype,
              fulfilledby: [],
              furtherinfo: '',
              id: ffId,
              linksto: [],
              needsobj: [],
              platform: [],
              rationale: '',
              safetyclass: '',
              safetyrationale: '',
              shortdesc: '',
              source: '',
              sourcefile: '',
              sourceline: '',
              sourcerevision: '',
              creationdate: '',
              category: '',
              priority: '',
              securityclass: '',
              securityrationale: '',
              verifymethods: [],
              verifycond: '',
              testin: '',
              testexec: '',
              testout: '',
              testpasscrit: '',
              releases: [],
              conflicts: [],
              status: '',
              tags: [],
              usecase: '',
              verifycrit: '',
              version: ffVersion,
              violations: [],
              errors: [],
              ffberrors: [],
              miscov: [],
              ffbPlaceholder: true,
              xml: ffArr.xml
            }
            //let newId = {id: ffId}
            //console.log("adding to newNodes ", key)
            newNodes.set(key, newNode)
          }
        } else {
          // check for matching doctype
          const realDt = this.requirements.get(ffId).doctype
          if (realDt !== ffDoctype) {
            const problem = `ffbType ${ffDoctype} does not match ${realDt} for <id> ${ffId}`
            this.problemReport(problem)
          }
        }
        // Add pseudo needsobj with '*' suffix
        // istanbul ignore else
        if (!rec.needsobj.includes(ffDoctype) &&
            !rec.needsobj.includes(ffDoctype + '*')) {
          rec.needsobj.push(ffDoctype + '*') //rq: ->(rq_ffb_needsobj)
          this.requirements.set(reqId, rec)
        }
      }
    }
    // Now add the fulfilledby placeholders to the set of specobjects
    const newKeys = newNodes.keys()
    for (const key of newKeys) {
      this.addSpecobjectRec(newNodes.get(key))
    }
  }

  /**
   * Get the effective key for a (id, version) pair
   * @param {string} id Possibly duplicate <id>
   * @param {string} version id+version unique
   * @return {string} effective key. If matching version not found an unspecified key with matching id will be returned
   */
  getKeyForIdVer (id, version) {
    const key = id
    if (this.duplicates.has(id)) {
      for (const idVer of this.duplicates.get(id)) {
        if (idVer.version === version) {
          return idVer.id
        }
      }
      console.log('No match to multiple versions of:', id, version)
    }
    return key
  }

  /**
   * Populate the linksto and reverse linkstoRev dicts with the linkages in the requirements.
   * Ensure that color dict has all valid ids
   */
  buildGraphTraversalLinks () {
    const ids = this.requirements.keys()
    // Clear any previous results
    this.linksto = new Map()
    this.linkstoRev = new Map()
    // Check all requirements
    for (const reqId of ids) {
      const rec = this.requirements.get(reqId)
      for (const link of rec.linksto) {
        if (link.linksto === reqId) {
          this.problemReport(`linksto points to specobject itself ${reqId}`)
        }
        // key to speobjects, can be !== id for duplicated id's
        const ltKey = this.getKeyForIdVer(link.linksto, link.dstversion)

        // check miscov items and remove false positives, i.e. actual coverage from 'missing' doctype
        let lrec = this.requirements.get(ltKey)
        if (lrec) {
          const idx = lrec.miscov.indexOf(rec.doctype)
          if (idx >= 0) {
            lrec.miscov.splice(idx, 1)
            this.requirements.set(ltKey, lrec)
          }
        }

        // bottom-up
        if (!this.linksto.has(reqId)) {
          this.linksto.set(reqId, new Set())
        }
        this.linksto.get(reqId).add(ltKey)

        // top-down
        if (!this.linkstoRev.has(ltKey)) {
          this.linkstoRev.set(ltKey, new Set())
        }
        this.linkstoRev.get(ltKey).add(reqId)

        if (link.kind === 'untraced') {
          if (!this.untraced.has(reqId)) {
            this.untraced.set(reqId, new Set())
          }
          this.untraced.get(reqId).add(ltKey)
        }
      }
      for (const ffbArr of rec.fulfilledby) {
        if (ffbArr.id === reqId) {
          this.problemReport(`ffbId points to specobject itself ${reqId}`)
        }
        const ffbLink = this.getKeyForIdVer(ffbArr.id, ffbArr.version)
        // top-down
        if (!this.linkstoRev.has(reqId)) {
          this.linkstoRev.set(reqId, new Set())
        }
        this.linkstoRev.get(reqId).add(ffbLink)

        if (!this.fulfilledby.has(ffbLink)) {
          this.fulfilledby.set(ffbLink, new Set())
        }
        this.fulfilledby.get(ffbLink).add(reqId)

        // bottom-up
        if (!this.linksto.has(ffbLink)) {
          this.linksto.set(ffbLink, new Set())
        }
        this.linksto.get(ffbLink).add(reqId)
      }
      this.color.set(reqId, new Set())
    }
  }

  /**
   * Store reject state flag in oreqm object
   * @param {boolean} state
   */
  setNoRejects (state) {
    this.noRejects = state
  }

  /**
   * Check if node is eligible for inclusion in graph (not excluded, invalid or already visited)
   * If OK mark reqId with 'color' and process child nodes recursively
   * @param {integer} color
   * @param {string} reqId
   * @param {integer} depth Remaining traversal depth
   */
  markAndFloodDown (color, reqId, depth) {
    // Color this id and linkstoRev referenced nodes with color
    const rec = this.requirements.get(reqId)
    // istanbul ignore next
    if (!rec) {
      return // missing specobject
    }
    // istanbul ignore next
    if (!this.color.has(reqId)) {
      return // unknown <id> (bug)
    }
    let colorDepth = {color: color, depth: depth}
    if (this.color.get(reqId).has(colorDepth)) {
      return // already visited
    }
    // console.log(this.requirements.get(reqId).doctype)
    if (this.excludedDoctypes.includes(rec.doctype)) { //rq: ->(rq_sel_doctype)
      return // blacklisted doctype
    }
    // Is this requirement rejected
    if (this.noRejects && rec.status === 'rejected') { //rq: ->(rq_excl_rejected)
      return // rejected specobject
    }
    if (this.excludedIds.includes(reqId)) { //rq: ->(rq_excl_id)
      return // blacklisted id
    }
    this.color.get(reqId).add(color)
    this.color.get(reqId).add(colorDepth)
    if (depth > 0) { //rq: ->(rq_limited_walk)
      if (this.linkstoRev.has(reqId)) {
        let nextDepth = (depth < INFINITE_DEPTH) ? depth - 1 : depth
        for (const child of this.linkstoRev.get(reqId)) {
          if (child !== reqId) {
            this.markAndFloodDown(color, child, nextDepth)
          }
        }
      }
    }
  }

  /**
   * Check if node is eligible for inclusion in graph (not excluded, invalid or already visited)
   * If OK mark reqId with 'color' and process ancestor nodes recursively
   * @param {integer} color
   * @param {string} reqId
   * @param {integer} depth Remaining traversal depth
   */
  markAndFloodUp (color, reqId, depth) {
    // Color this id and linksto referenced nodes with color
    const rec = this.requirements.get(reqId)
    // istanbul ignore next
    if (!rec) {
      return // missing specobject
    }
    // istanbul ignore next
    if (!this.color.has(reqId)) {
      return // unknown <id> (bug)
    }
    let colorDepth = {color: color, depth: depth}
    if (this.color.get(reqId).has(colorDepth)) {
      return // already visited
    }
    if (this.excludedDoctypes.includes(rec.doctype)) { //rq: ->(rq_sel_doctype)
      return // blacklisted doctype
    }
    // Is this requirement rejected
    if (this.noRejects && rec.status === 'rejected') { //rq: ->(rq_excl_rejected)
      return // rejected specobject
    }
    if (this.excludedIds.includes(reqId)) { //rq: ->(rq_excl_id)
      return // blacklisted id
    }
    this.color.get(reqId).add(color)
    this.color.get(reqId).add(colorDepth)
    if (depth > 0) { //rq: ->(rq_limited_walk)
      if (this.linksto.has(reqId)) {
        let nextDepth = (depth < INFINITE_DEPTH) ? depth - 1 : depth
        for (const ancestor of this.linksto.get(reqId)) {
          if (ancestor !== reqId) {
            this.markAndFloodUp(color, ancestor, nextDepth)
          }
        }
      }
    }
  }

  /**
   * Return an unordered collection of "upstream" specobjects
   * @param {string} reqId
   * @returns {Set} This is a set of { id: <id>, doctype: <doctype>, status: <status> }
   */
  getAncestors (reqId, ancestors) {
    if (this.linksto.has(reqId)) {
      for (const ancestor of this.linksto.get(reqId)) {
        ancestors.add( {id: ancestor, doctype: this.requirements.get(reqId).doctype, status: this.requirements.get(reqId).status})
        if (ancestor !== reqId) {
          let newAncestors = this.getAncestors(ancestor, ancestors)
          for (let n in newAncestors) {
            ancestors.add(n)
          }
        }
      }
    }
    return ancestors
  }

  /**
   * Return an unordered collection of ancestors from set of ids
   * @param {Set} reqIds Set of 'children' to find ancestors of
   */
  getAncestorsSet (reqIds) {
    let result = new Set()
    for (const r of reqIds) {
      let a = this.getAncestors(r, new Set())
      for (const x of a) {
        result.add(x.id)
      }
    }
    return result
  }

  /**
   * Return an unordered collection of "downstream" specobjects
   * @param {Set} reqIds Starting nodes to find children from
   * @param {Set} children This is a set of <id>
   */
  getChildren (reqIds, children= new Set())
  {
    for (let id of reqIds) {
      if (this.linkstoRev.has(id)) {
        let generation = new Set()
        for (const child of this.linkstoRev.get(id)) {
          children.add(child)
          generation.add(child)
        }
        let grandchildren = this.getChildren(generation, children)
        for (let g of grandchildren) {
          children.add(g)
        }
      }
    }
    return children
  }

  /**
   * Extract execution timestamp from oreqm report
   * @return {string} time
   */
  getTime () {
    const time = getXmlText(this.root, 'timestamp')
    return time
  }

  /**
   * A comparison may add 'ghost' requirements, which represent deleted
   * requirements. Remove these 'ghost' requirements.
   * @param {boolean} findAgain do a new search
   */
  removeGhostRequirements (findAgain) {
    for (const ghostId of this.removedReqs) {
      if (this.requirements.has(ghostId)) { // Ghost may not exist
        const rec = this.requirements.get(ghostId)
        const dtList = this.doctypes.get(rec.doctype)
        let idx = dtList.indexOf(ghostId)
        if (idx > -1) {
          dtList.splice(idx, 1)
        }
        //dtList.remove(ghostId)
        if (dtList.length) {
          this.doctypes.set(rec.doctype, dtList)
        } else {
          this.doctypes.delete(rec.doctype)
        }
        this.requirements.delete(ghostId)
        // Clear 'removed' diff status for linksto
        for (let lt of rec.linksto) {
          lt.diff = ''
        }
      }
    }
    // Reset diff flag for all links
    //console.log("New requirements to check for diff flag", this.newReqs)
    for (const newReq of this.newReqs) {
      const rec = this.requirements.get(newReq)
      //console.dir(rec)
      for (const lt of rec.linksto) {
        lt.diff = ''
      }
    }
    // Remove 'ghost' links
    for (const chgReq of this.updatedReqs) {
      //console.log("Changed requirements to check for diff flag", this.newReqs)
      const rec = this.requirements.get(chgReq)
      const newLt = []
      for (const lt of rec.linksto) {
        if (lt.diff !== 'removed') {
          lt.diff = ''
          newLt.push(lt)
        } else {
          //console.log("Skip ghost linksto:", lt)
        }
      }
      //console.log("rec before and after", rec.id, rec.linksto, newLt)
      rec.linksto = newLt
      const newFfb = []
      for (const ffb of rec.fulfilledby) {
        if (ffb.diff !== 'removed') {
          ffb.diff = ''
          newFfb.push(ffb)
        } else {
          //console.log("Skip ghost fulfilledby:", lt)
        }
      }
      rec.fulfilledby = newFfb
    }
    this.removedReqs = []
    this.newReqs = []
    this.updatedReqs = []
    if (findAgain) {
      this.buildGraphTraversalLinks()
    }
    this.clearCache()
  }

  /**
   * Clear cached node data
   */
  clearCache () {
    this.searchCache = new Map()
    this.formatCache = new Map()
  }

  /**
   * Compare two sets of requirements (instances of ReqM2Oreqm)
   * and return lists of new, modified and removed <id>s"""
   * Requirements with no description are ignored.
   * 'Ghost' requirements in inserted which only exist in reference file.
   * @param {object} oldReqs reference oreqm object
   * @param {string[]} ignoreFields list of fields to ignore
   * @return {object} with new, updated and removed ids
   */
  compareRequirements (oldReqs, ignoreFields) { //rq: ->(rq_oreqm_diff_calc)
    const newIds = Array.from(this.requirements.keys())
    const newReqs = []
    const updatedReqs = []
    const removedReqs = []
    this.removeGhostRequirements(false)
    for (const reqId of newIds) {
      const rec = this.requirements.get(reqId)
      // skip 'impl' and similar
      if ((rec.description.length === 0) && (rec.shortdesc.length === 0)) {
        continue
      }
      // compare json versions
      const newRec = this.requirements.get(reqId)
      const oldRec = oldReqs.requirements.get(reqId)
      if (stringEqual(newRec, oldRec, ignoreFields)) {
        continue // skip unchanged or nondescript reqs
      }
      if (oldReqs.requirements.has(reqId)) {
        updatedReqs.push(reqId)
        this.compareLinksto(oldRec, newRec)
        this.compareFulfilledby(oldRec, newRec)
      } else {
        this.markLinkstoNew(reqId)
        this.markFfbNew(reqId)
        newReqs.push(reqId)
      }
    }
    const oldIds = oldReqs.requirements.keys()
    for (const reqId of oldIds) {
      const oldRec = oldReqs.requirements.get(reqId)
      if ((oldRec.description.length === 0) && (oldRec.shortdesc.length === 0)) {
        continue
      }
      if (!newIds.includes(reqId)) { // <id> no longer present -> removed
        removedReqs.push(reqId)
        // Create 'ghost' requirement
        this.requirements.set(reqId, oldRec)
        // check if this introduces a new doctype
        if (!this.doctypes.has(oldRec.doctype)) {
          this.doctypes.set(oldRec.doctype, [])
        }
        // Update doctype table with new counts (and types)
        this.doctypes.get(oldRec.doctype).push(reqId)
        // Make all linksto 'removed'
        for (let lt of oldRec.linksto) {
          lt.diff = 'removed'
        }
      }
    }
    this.buildGraphTraversalLinks()
    this.newReqs = newReqs
    this.updatedReqs = updatedReqs
    this.removedReqs = removedReqs
    const result = new Object()
    result.newReqs = newReqs
    result.updatedReqs = updatedReqs
    result.removedReqs = removedReqs
    return result
  }

  /**
   * Mark all ffbs as new in 'diff' field
   * @param {string} reqId
   */
  markFfbNew (reqId) {
    const ffbCount = this.requirements.get(reqId).fulfilledby.length
    for (let index = 0; index < ffbCount; index++) {
      this.requirements.get(reqId).fulfilledby[index].diff = 'new'
    }
  }

  /**
   * Compare fulfilledby lists and add removed ffbs as 'ghosts' with 'removed' attribute, and set 'new' attribute on new ffbs.
   * @param {Specobject} oldRec
   * @param {Specobject} newRec
   */
  compareFulfilledby (oldRec, newRec) {
    let oldMap = new Map() // Map<id, fulfilledbyRec> Lookup table of OLD fulfilledby based on destination <id>
    let stillThere = [] // List of old fulfilledby still present. Use to find removed ffbs later.
    // build lookup table for old specobject
    for (const oldF of oldRec.fulfilledby) {
      if (oldMap.has(oldF.id)) {
        console.log(`ref ${oldRec.id} has multiple fulfilledby ${oldF.id}`, oldRec)
      }
      oldMap.set(oldF.id, oldF)
    }
    // Check each ffb from new specobject
    for (const newF of newRec.fulfilledby) {
      if (oldMap.has(newF.id)) {
        if ((newF.version !== oldMap.get(newF.id).version) ||
            (newF.doctype !== oldMap.get(newF.id).doctype)) {
          //console.log('Change version:', oldMap.get(key), newF)
          newF.diff = 'chg'
        }
        stillThere.push(newF.id)
        //console.log('stillThere:', newF.id, stillThere)
      } else {
        newF.diff = 'new'
        //console.log('new fulfilledby:', newRec.id, newF)
      }
    }
    // Find the fulfilledby that are no longer present
    for (const oldF of oldRec.fulfilledby) {
      if (!stillThere.includes(oldF.id)) {
        // Add a 'ghost' fulfilledby
        //console.log(`Ghost fulfilledby ${oldRec.id} to ${oldL.id}`)
        const ghostFfb = { ...oldF } // make a clone
        ghostFfb.diff = 'removed'
        //console.log("Add ghost fulfilledby", ghostFfb)
        newRec.fulfilledby.push(ghostFfb)
        //console.log('rec with ghost', newRec.fulfilledby)
      }
    }
  }

  /**
   * Mark all linksto as new in 'diff' field
   * @param {string} reqId
   */
   markLinkstoNew (reqId) {
    const ltCount = this.requirements.get(reqId).linksto.length
    for (let index = 0; index < ltCount; index++) {
      this.requirements.get(reqId).linksto[index].diff = 'new'
      //console.log(`Mark as new ${reqId} ->`, this.requirements.get(reqId).linksto[index])
    }
  }

  /**
   * Compare linksto lists and add removed links as 'ghosts' with 'removed' attribute, and set 'new' attribute on new linksto.
   * @param {Specobject} oldRec
   * @param {Specobject} newRec
   */
  compareLinksto (oldRec, newRec) {
    let oldMap = new Map() // Map<id, linkstoRec> Lookup table of OLD linksto based on destination <id>
    let stillThere = [] // List of old linksto still present. Use to find removed links later.
    // build lookup table for old specobject
    for (const oldL of oldRec.linksto) {
      if (oldMap.has(oldL.linksto)) {
        console.log(`ref ${oldRec.id} has multiple linksto ${oldL.linksto}`, oldRec)
      }
      oldMap.set(oldL.linksto, oldL)
    }
    // Check each link from new specobject
    for (const newL of newRec.linksto) {
      if (oldMap.has(newL.linksto)) {
        if (newL.dstversion !== oldMap.get(newL.linksto).dstversion) {
          //console.log('Change version:', oldMap.get(newL.linksto), newL)
          newL.diff = 'chg'
        }
        stillThere.push(newL.linksto)
        //console.log('stillThere:', newL.linksto, stillThere)
      } else {
        newL.diff = 'new'
        //console.log('new linksto:', newRec.id, newL)
      }
    }
    // Find the linksto that are no longer present
    for (const oldL of oldRec.linksto) {
      // Skip broken linksto from reference oreqm
      if ((!stillThere.includes(oldL.linksto)) &&
          (!oldL.linkerror.startsWith('referenced object does not exist'))) {
        // Add a 'ghost' linksto
        //console.log(`Ghost linksto ${oldRec.id} to ${oldL.linksto}`)
        const ghostLinksto = { ...oldL } // make a clone
        ghostLinksto.diff = 'removed'
        //console.log("Add ghost linksto", ghostLinksto)
        newRec.linksto.push(ghostLinksto)
        //console.log('rec with ghost', newRec.linksto)
      }
    }
  }

  /**
   * Prefix <id> with new:, chg: or rem: if changed
   * @param {string} reqId id to check
   * @return {string} updated (decorated) id
   */
  idSearchString (reqId) {
    let diff = this.diffStatus(reqId)
    return `id:${reqId}\n${diff}`
  }

  /**
   * Get diff status of id, i.e. new:, chg:, rem: or ''
   * @param {string} reqId id to check
   * @return {string} updated (decorated) id
   */
   diffStatus (reqId) {
    let diff = ''
    if (this.newReqs.includes(reqId)) {
      diff = 'new:'
    } else if (this.updatedReqs.includes(reqId)) {
      diff = 'chg:'
    } else if (this.removedReqs.includes(reqId)) {
      diff = 'rem:'
    }
    return diff
  }

  /**
   * Check all ids against regex
   * @param {string} regex
   * @return {string[]} list of matching ids
   */
  findReqsWithName (regex) {
    const ids = this.requirements.keys()
    const rx = new RegExp(regex, 'im') // case-insensitive
    const matches = []
    for (const id of ids) {
      const idString = this.idSearchString(id)
      //rq: ->(rq_search_id_only)
      if (idString.search(rx) >= 0) {
        matches.push(id)
      }
    }
    return matches
  }

  /**
   * Return tagged text format for specobject.
   * There is a cache for previously created strings which is used for speedup.
   * Each xml tag has a corresponding 2 or 3 letter tag prefix.
   * @param {string} reqId key of specobject, === id for non-duplicates
   * @return {string} tagged string
   */
  getAllText (reqId) {
    if (this.searchCache.has(reqId)) {
      return this.searchCache.get(reqId)
    } else {
      let allText = this.buildTaggedString(this.requirements.get(reqId))
      this.searchCache.set(reqId, allText)
      return allText
    }
  }

  /**
   * Check requirement texts against regex
   * @param {string} regex
   * @return {string[]} list of matching ids
   */
  findReqsWithText (regex) {
    const ids = this.requirements.keys()
    const matches = []
    try {
      const rx = new RegExp(regex, 'ims') // case-insensitive multi-line
      for (const id of ids) {
        if (rx.test(this.getAllText(id))) { matches.push(id) }
      }
    } catch (err) {
      const msg = `Selection criteria error:\n${err.message}`
      console.log(msg)
      alert(msg)
    }
    return matches
  }

  /**
   * Return the set of all ids
   * TODO: should FFB placeholders be returned?
   * @returns Set(ids)
   */
  getAllIds ()
  {
    return new Set(this.requirements.keys())
  }

  /**
   * Return the set of specobjects from `ids` that match the `regex`
   * @param {Set} ids specobjects to examine
   * @param {*} regex match expression (for tagged search string)
   * @returns {Set} matching ids
   */
  findReqsFromSet (ids, regex)
  {
    const matches = new Set()
    try {
      const rx = new RegExp(regex, 'ims') // case-insensitive multi-line
      for (const id of ids) {
        if (rx.test(this.getAllText(id))) { matches.add(id) }
      }
    } catch (err) {
      const msg = `Selection criteria error:\n${err.message}`
      console.log(msg)
      alert(msg)
    }
    return matches
  }

  /**
   * Mark all reachable nodes from idList both up and down the graph
   * @param {string[]} idList
   * @param {integer} colorUpValue
   * @param {integer} colorDownValue
   * @param {integer} depth
   */
  markAndFloodUpDown (idList, colorUpValue, colorDownValue, depth) {
    //rq: ->(rq_calc_shown_graph)
    for (const res of idList) {
      this.markAndFloodDown(colorDownValue, res, depth)
      this.markAndFloodUp(colorUpValue, res, depth)
    }
  }

  /**
   * Clear the 'color' tags on the requirements
   */
  clearColorMarks () {
    const ids = this.color.keys()
    for (const id of ids) {
      this.color.set(id, new Set())
    }
  }

  getDoctypes () {
    return this.doctypes
  }

  getDot () {
    // return current graph
    return this.dot
  }

  setExcludedDoctypes (doctypes) {
    // Set excluded doctypes
    this.excludedDoctypes = doctypes
  }

  getExcludedDoctypes () {
    // Get excluded doctypes
    return this.excludedDoctypes
  }

  setExcludedIds (ids) {
    // Set excluded doctypes
    this.excludedIds = ids
  }

  checkNodeId (name) {
    return this.requirements.has(name)
  }

  /**
   * Collect problems and suppress duplicates
   * @param {string} report string with description (possibly multiple lines)
   */
  problemReport (report) {
    //rq: ->(rq_issues_log)
    // if (!this.problems.includes(report)) {
    this.problems.push(report)
    // }
  }

  getProblems () {
    // Get a list of problems as string. Empty string -> no problems
    return "Detected problems:\n" + this.problems.join('\n')
  }

  getProblemCount () {
    // Get a count of problems strings
    return this.problems.length
  }

  clearProblems () {
    this.problems = []
  }

  /**
   * Get XML representation of specobject
   * @param {string} id
   * @return {string} in XML format
   */
  getXmlString (id) {
    if (serializer === null) {
      serializer = new XMLSerializer()
    }
    let str = ''
    if (this.requirements.has(id)) {
      let xml = this.requirements.get(id).xml
      if (xml !== undefined) {
        str = serializer.serializeToString(xml)+'\n'
        let leading = str.match(/(^\s*)<\/(specobject|ffbObj)>.*/m)
        if (leading && leading.length > 1) {
          str = leading[1] + str
        }
      }
      return str
    } else {
      return `id ${id} not known`
    }
  }

  /**
   * Get a dict keyed by doctypes for the supplied list of ids
   * @returns {Object}
   */
  getDoctypeDict (idList) {
    let dtDict = new Map()
    let doctypes = this.doctypes.keys()
    // populate with empty list all known doctypes
    for (let dt of doctypes) {
      dtDict.set(dt, [])
    }
    // Add ids to specific lists
    for (let id of idList) {
      try {
        let odt = this.requirements.get(id).doctype
        dtDict.get(odt).push(id)
      } catch (e) {
        console.log(`No doctype defined for ${id}`)
      }
    }
    return dtDict
  }
}
