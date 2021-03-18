/* Main class for managing oreqm xml data */
'use strict'
// eslint-disable-next-line no-redeclare
/* global DOMParser, alert */
import { clone, cloneDeep } from "lodash"
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
 * @param {string} tag_name name of tag
 * @return {string}
 */
function get_xml_text (node, tag_name) {
  let result = ''
  const item = node.getElementsByTagName(tag_name)
  if (item.length > 0) {
    result = item[0].textContent
  }
  return result
}

/**
 * Return list of texts found in specified xml tags (multiple instances possible)
 * @param {object} node
 * @param {string} tag_name
 * @return {string[]} list of text
 */
function get_list_of (node, tag_name) {
  const result = []
  const items = node.getElementsByTagName(tag_name)
  let i
  for (i = 0; i < items.length; i++) {
    result.push(items[i].textContent)
  }
  return result
}

/**
 * Get linksto references from specobject XML
 * @param {specobject} node
 * @return {object[]} an array of objects with .linksto .dstversion and .linkerror
 */
function get_linksto (node) {
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
    let dstversion_txt
    // istanbul ignore next
    if (dstversion.length !== 1) {
      dstversion_txt = 'multiple'
    } else {
      dstversion_txt = dstversion[0].textContent
    }
    const linkerror = items[i].getElementsByTagName('linkerror')
    // if (linkerror) {
    //   console.log(linkerror[0].textContent)
    // }
    let link_error_txt = (linkerror && linkerror.length > 0) ? linkerror[0].textContent : ''
    if (link_error_txt && link_error_txt.startsWith('source ')) {
      // Do not render 'source not covered.' and 'source status 'rejected' excluded from tracing.' in diagram edges
      link_error_txt = ''
    }
    const link = {
      linksto: linksto[0].textContent,
      dstversion: dstversion_txt,
      linkerror: link_error_txt,
      diff: '' // In comparisons of oreqm files this may become 'rem' or 'new'
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
function get_fulfilledby (node) {
  const ff_list = []
  const ffbobj_list = node.getElementsByTagName('ffbObj')
  let i
  for (i = 0; i < ffbobj_list.length; i++) {
    const ffbobj = ffbobj_list[i]
    const ffb_linkerror_list = ffbobj.getElementsByTagName('ffbLinkerror')
    // if (ffb_linkerror_list) {
    //   console.log('ffbLinkerror:', ffb_linkerror_list[0].textContent)
    // }
    let ffb_linkerror_txt = (ffb_linkerror_list && ffb_linkerror_list.length > 0) ? ffb_linkerror_list[0].textContent : ''
    if (ffb_linkerror_txt && ffb_linkerror_txt.startsWith('target not ')) {
      // Do not render 'target not covered.' in diagram edges
      ffb_linkerror_txt = ''
    }
    const ff_entry = {
      id: get_xml_text(ffbobj, 'ffbId'),
      doctype: get_xml_text(ffbobj, 'ffbType'),
      version: get_xml_text(ffbobj, 'ffbVersion'),
      ffblinkerror: ffb_linkerror_txt,
      diff: '',
      xml: ffbobj
    }
    ff_list.push(ff_entry)
  }
  return ff_list
}

// let magic = 'BAT_SDK_1'

/**
 * Compare a_in and b_in objects, while ignoring the fields listed in ignore_list
 * @param {object} a_in
 * @param {object} b_in
 * @param {[string]} ignore_list
 * @return {boolean} is the subset of fields equal
 */
function stringEqual (a_in, b_in, ignore_list) {
  if (b_in === undefined) return false
  const a = cloneDeep(a_in)
  const b = cloneDeep(b_in)
  // console.log(typeof(a), a, typeof(b), b)
  // istanbul ignore else
  if (typeof (a) === 'object' && typeof (b) === 'object') {
    for (const field of ignore_list) {
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
    if (a.fulfilledby !== null) {
      for (let ffb of b.fulfilledby) {
      ffb.ffblinkerror = null
      ffb.diff = null
      ffb.xml = null
      }
    }
  }
  const a_s = JSON.stringify(a)
  const b_s = JSON.stringify(b)
  let equal = a_s === b_s
  // if (!equal && a_s.includes(magic)) {
  //   console.log(a_s, b_s)
  // }
  return equal
}

/**
 * This class reads and manages information in ReqM2 .oreqm files
 */
export class ReqM2Specobjects {
  constructor (filename, content, excluded_doctypes, excluded_ids) {
    this.filename = filename // basename of oreqm file
    this.timestamp = '' // recorded time of ReqM2 run
    this.root = null // xml tree
    /** Map<doctype, id[]>  List of ids of a specific doctype */
    this.doctypes = new Map()
    /** Map<key, Requirement[]> Where key is === \<id> except for duplicates, where a :\<version> is suffixed for subsequent instances of \<id> */
    this.requirements = new Map()
    /** Map<id, {id:, version:}[]> where 2nd id is the effective (unique) key */
    this.duplicates = new Map()
    this.rules = new Map() // {rule_id : description}
    this.color = new Map() // {id:[color]} When traversing the graph of nodes a 'color' is associated with each visited node
    this.linksto = new Map() // {id:{id}} -- map to set of linked ids
    this.linksto_rev = new Map() // {id:{id}} -- reverse direction of linksto. i.e. top-down
    this.fulfilledby = new Map() // {id:{id}}
    this.excluded_doctypes = excluded_doctypes // [doctype]
    this.excluded_ids = excluded_ids // [id]
    this.no_rejects = true // skip rejected specobjects
    this.new_reqs = [] // List of new requirements (from comparison)
    this.updated_reqs = [] // List of updated requirements (from comparison)
    this.removed_reqs = [] // List of removed requirements (copies taken from older(?) version of oreqm)
    // this.visible_nodes = new Map(); // {doctype:[id]}
    this.problems = [] // string[] problems reports.
    this.search_cache = new Map() // Cache tagged string versions
    this.format_cache = new Map() // Cache 'dot' formatted nodes
    this.dot = 'digraph "" {label="Select filter criteria and exclusions, then click\\l                    [update graph]\\l(Unfiltered graphs may be too large to render)"\n  labelloc=b\n  fontsize=24\n  fontcolor=grey\n  fontname="Arial"\n}\n'

    // Initialization logic
    this.clear_problems()
    const success = this.process_oreqm_content(content) //rq: ->(rq_read_oreqm)
    // istanbul ignore else
    if (success) {
      this.read_reqm2_rules()
      this.read_req_descriptions()
      this.add_fulfilledby_nodes()
      this.build_graph_traversal_links()
      this.timestamp = this.get_time()
      // const problems = this.get_problems()
      // if (problems) {
      //   // alert(problems);
      // }
    }
  }

  /**
   * Create a default diagram which acts as a mini user guide
   */
  set_svg_guide () {
    this.dot = 'digraph "" {label="Select filter criteria and exclusions, then click\\l                    [update graph]\\l(Unfiltered graphs may be too large to render)"\n  labelloc=b\n  fontsize=24\n  fontcolor=grey\n  fontname="Arial"\n}\n'
  }

  /**
   * Attempt to load XML and report if error detected
   * @param {string} content
   * @return {boolean} processing success
   */
  process_oreqm_content (content) {
    try {
      this.root = tryParseXML(content)
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
  read_reqm2_rules () {
    const rule_list = this.root.getElementsByTagName('rule')
    for (const rule of rule_list) {
      const rule_id_arr = rule.getElementsByTagName('name')
      const rule_description_arr = rule.getElementsByTagName('description')
      if (rule_id_arr.length === 1 && rule_description_arr.length === 1) {
        // console.log(rule_id_arr[0].textContent, rule_description_arr[0].textContent)
        this.rules.set(rule_id_arr[0].textContent, rule_description_arr[0].textContent)
      }
    }
  }

  /**
  * Find and read all specobjects with associated doctypes
  */
  read_req_descriptions () {
    // Handle all sections with specobjects
    const specobjects_list = this.root.getElementsByTagName('specobjects')
    for (const specobjects of specobjects_list) {
      const doctype = specobjects.getAttributeNode('doctype').value
      if (!this.doctypes.has(doctype)) {
        this.doctypes.set(doctype, [])
      }
      this.read_specobject_list(specobjects, doctype)
    }
  }

  /**
   * Read a single specobject and create and object for each
   * @param {object} node specobject
   * @param {string} doctype
   */
  read_specobject_list (node, doctype) {
    // Read individual specobject
    const specobject_list = node.getElementsByTagName('specobject')
    for (const comp of specobject_list) {
      this.add_one_specobject(comp, doctype)
    }
  }

  /**
   * Add XML representation of specobject to oreqm container
   * @param {object} comp
   */
  add_one_specobject (comp, doctype) {
    const req = new Object()
    req.id = get_xml_text(comp, 'id')
    req.comment = get_xml_text(comp, 'comment')
    req.covstatus = get_xml_text(comp, 'covstatus')
    req.dependson = get_list_of(comp, 'dependson')
    req.description = get_xml_text(comp, 'description')
    req.doctype = doctype
    req.fulfilledby = get_fulfilledby(comp)
    req.furtherinfo = get_xml_text(comp, 'furtherinfo')
    req.linksto = get_linksto(comp)
    req.needsobj = get_list_of(comp, 'needsobj')
    req.platform = get_list_of(comp, 'platform')
    req.rationale = get_xml_text(comp, 'rationale')
    req.safetyclass = get_xml_text(comp, 'safetyclass')
    req.safetyrationale = get_xml_text(comp, 'safetyrationale')
    req.shortdesc = get_xml_text(comp, 'shortdesc')
    req.source = get_xml_text(comp, 'source')
    req.sourcefile = get_xml_text(comp, 'sourcefile')
    req.sourceline = get_xml_text(comp, 'sourceline')
    req.sourcerevision = get_xml_text(comp, 'sourcerevision')
    req.creationdate = get_xml_text(comp, 'creationdate')
    req.category = get_xml_text(comp, 'category')
    req.priority = get_xml_text(comp, 'priority')
    req.securityclass = get_xml_text(comp, 'securityclass')
    req.securityrationale = get_xml_text(comp, 'securityrationale')
    req.verifymethods = get_list_of(comp, 'verifymethod')
    req.verifycond = get_xml_text(comp, 'verifycond')
    req.testin = get_xml_text(comp, 'testin')
    req.testexec = get_xml_text(comp, 'testexec')
    req.testout = get_xml_text(comp, 'testout')
    req.releases = get_list_of(comp, 'release')
    req.conflicts = get_list_of(comp, 'conflictswith')
    req.status = get_xml_text(comp, 'status')
    req.tags = get_list_of(comp, 'tag')
    req.usecase = get_xml_text(comp, 'usecase')
    req.verifycrit = get_xml_text(comp, 'verifycrit')
    req.version = get_xml_text(comp, 'version')
    req.violations = get_list_of(comp, 'ruleid')
    req.ffb_placeholder = false
    req.xml = comp
    this.add_specobject_rec(req)
  }

  /**
   * Add JS representation of specobject to oreqm container
   * @param {object} req JS object
   */
  add_specobject_rec(req) {
    let doctype = req.doctype
    // There may be duplicate <id>'s in use.
    let key = req.id
    let report_duplicate = true
    while (this.requirements.has(key)) {
      //rq: ->(rq_dup_req)
      // Check for unique versions
      if (report_duplicate && this.requirements.get(key).version === req.version) {
        const problem = `specobject '${req.id}' is duplicated with same version '${req.version}'`
        // console.log(problem);
        //rq: ->(rq_dup_same_version)
        this.problem_report(problem)
        report_duplicate = false
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
        const first_req = this.requirements.get(req.id)
        this.duplicates.set(req.id, [{ id: first_req.id, version: first_req.version }])
      }
      // Add duplicate
      this.duplicates.get(req.id).push({ id: key, version: req.version })
    }
    // Add new doctype list if unknown
    if (!this.doctypes.has(doctype)) {
      this.doctypes.set(doctype, [])
    }
    const dt_arr = this.doctypes.get(doctype)
    // istanbul ignore else
    if (!dt_arr.includes(key)) {
      dt_arr.push(key)
      this.doctypes.set(doctype, dt_arr) // keep status per doctype
    }
  }

  /**
   * Create placeholders for absent 'fulfilledby' requirements.
   * Add doctype to needsobj if not present
   */
  add_fulfilledby_nodes () {
    //rq: ->(rq_ffb_placeholder)
    const ids = Array.from(this.requirements.keys())
    let new_nodes = new Map() // need a new container to add after loop
    for (const req_id of ids) {
      const rec = this.requirements.get(req_id)
      const ffb_list = Array.from(rec.fulfilledby)
      for (const ff_arr of ffb_list) {
        const ff_id = ff_arr.id
        const ff_doctype = ff_arr.doctype
        const ff_version = ff_arr.version
        const key = this.get_key_for_id_ver(ff_id, ff_version)
        //console.log(req_id, key, new_nodes)
        if (!this.requirements.has(key)) {
          if (!new_nodes.has(key)) {
            // Create placeholder for ffb node
            //console.log("new object", key, ff_id, ff_doctype, ff_version)
            const new_node = {
              comment: '',
              dependson: [],
              description: '*FULFILLEDBY PLACEHOLDER*',
              doctype: ff_doctype,
              fulfilledby: [],
              furtherinfo: '',
              id: ff_id,
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
              releases: [],
              conflicts: [],
              status: '',
              tags: [],
              usecase: '',
              verifycrit: '',
              version: ff_version,
              violations: [],
              ffb_placeholder: true,
              xml: ff_arr.xml
            }
            //let new_id = {id: ff_id}
            //console.log("adding to new_nodes ", key)
            new_nodes.set(key, new_node)
          }
        } else {
          // check for matching doctype
          const real_dt = this.requirements.get(ff_id).doctype
          if (real_dt !== ff_doctype) {
            const problem = `ffbType ${ff_doctype} does not match ${real_dt} for <id> ${ff_id}`
            this.problem_report(problem)
          }
        }
        // Add pseudo needsobj with '*' suffix
        // istanbul ignore else
        if (!rec.needsobj.includes(ff_doctype) &&
            !rec.needsobj.includes(ff_doctype + '*')) {
          rec.needsobj.push(ff_doctype + '*') //rq: ->(rq_ffb_needsobj)
          this.requirements.set(req_id, rec)
        }
      }
    }
    // Now add the fulfilledby placeholders to the set of specobjects
    const new_keys = new_nodes.keys()
    for (const key of new_keys) {
      this.add_specobject_rec(new_nodes.get(key))
    }
  }

  /**
   * Get the effective key for a (id, version) pair
   * @param {string} id Possibly duplicate <id>
   * @param {string} version id+version unique
   * @return {string} effective key. If matching version not found an unspecified key with matching id will be returned
   */
  get_key_for_id_ver (id, version) {
    const key = id
    if (this.duplicates.has(id)) {
      for (const id_ver of this.duplicates.get(id)) {
        if (id_ver.version === version) {
          return id_ver.id
        }
      }
      console.log('No match to multiple versions of:', id, version)
    }
    return key
  }

  /**
   * Populate the linksto and reverse linksto_rev dicts with the linkages in the requirements.
   * Ensure that color dict has all valid ids
   */
  build_graph_traversal_links () {
    const ids = this.requirements.keys()
    // Clear any previous results
    this.linksto = new Map()
    this.linksto_rev = new Map()
    // Check all requirements
    for (const req_id of ids) {
      const rec = this.requirements.get(req_id)
      for (const link of rec.linksto) {
        // key to speobjects, can be !== id for duplicated id's
        const lt_key = this.get_key_for_id_ver(link.linksto, link.dstversion)

        // bottom-up
        if (!this.linksto.has(req_id)) {
          this.linksto.set(req_id, new Set())
        }
        this.linksto.get(req_id).add(lt_key)

        // top-down
        if (!this.linksto_rev.has(lt_key)) {
          this.linksto_rev.set(lt_key, new Set())
        }
        this.linksto_rev.get(lt_key).add(req_id)
      }
      for (const ffb_arr of rec.fulfilledby) {
        const ffb_link = this.get_key_for_id_ver(ffb_arr.id, ffb_arr.version)
        // top-down
        if (!this.linksto_rev.has(req_id)) {
          this.linksto_rev.set(req_id, new Set())
        }
        this.linksto_rev.get(req_id).add(ffb_link)

        if (!this.fulfilledby.has(ffb_link)) {
          this.fulfilledby.set(ffb_link, new Set())
        }
        this.fulfilledby.get(ffb_link).add(req_id)

        // bottom-up
        if (!this.linksto.has(ffb_link)) {
          this.linksto.set(ffb_link, new Set())
        }
        this.linksto.get(ffb_link).add(req_id)
      }
      this.color.set(req_id, new Set())
    }
  }

  /**
   * Store reject state flag in oreqm object
   * @param {boolean} state
   */
  set_no_rejects (state) {
    this.no_rejects = state
  }

  /**
   * Check if node is eligible for inclusion in graph (not excluded, invalid or already visited)
   * If OK mark req_id with 'color' and process child nodes recursively
   * @param {integer} color
   * @param {string} req_id
   * @param {integer} depth Remaining traversal depth
   */
  mark_and_flood_down (color, req_id, depth) {
    // Color this id and linksto_rev referenced nodes with color
    const rec = this.requirements.get(req_id)
    // istanbul ignore next
    if (!rec) {
      return // missing specobject
    }
    // istanbul ignore next
    if (!this.color.has(req_id)) {
      return // unknown <id> (bug)
    }
    let color_depth = {color: color, depth: depth}
    if (this.color.get(req_id).has(color_depth)) {
      return // already visited
    }
    // console.log(this.requirements.get(req_id).doctype)
    if (this.excluded_doctypes.includes(rec.doctype)) { //rq: ->(rq_sel_doctype)
      return // blacklisted doctype
    }
    // Is this requirement rejected
    if (this.no_rejects && rec.status === 'rejected') { //rq: ->(rq_excl_rejected)
      return // rejected specobject
    }
    if (this.excluded_ids.includes(req_id)) { //rq: ->(rq_excl_id)
      return // blacklisted id
    }
    this.color.get(req_id).add(color)
    this.color.get(req_id).add(color_depth)
    if (depth > 0) { //rq: ->(rq_limited_walk)
      if (this.linksto_rev.has(req_id)) {
        let next_depth = (depth < INFINITE_DEPTH) ? depth - 1 : depth
        for (const child of this.linksto_rev.get(req_id)) {
          this.mark_and_flood_down(color, child, next_depth)
        }
      }
    }
  }

  /**
   * Check if node is eligible for inclusion in graph (not excluded, invalid or already visited)
   * If OK mark req_id with 'color' and process ancestor nodes recursively
   * @param {integer} color
   * @param {string} req_id
   * @param {integer} depth Remaining traversal depth
   */
  mark_and_flood_up (color, req_id, depth) {
    // Color this id and linksto referenced nodes with color
    const rec = this.requirements.get(req_id)
    // istanbul ignore next
    if (!rec) {
      return // missing specobject
    }
    // istanbul ignore next
    if (!this.color.has(req_id)) {
      return // unknown <id> (bug)
    }
    let color_depth = {color: color, depth: depth}
    if (this.color.get(req_id).has(color_depth)) {
      return // already visited
    }
    if (this.excluded_doctypes.includes(rec.doctype)) { //rq: ->(rq_sel_doctype)
      return // blacklisted doctype
    }
    // Is this requirement rejected
    if (this.no_rejects && rec.status === 'rejected') { //rq: ->(rq_excl_rejected)
      return // rejected specobject
    }
    if (this.excluded_ids.includes(req_id)) { //rq: ->(rq_excl_id)
      return // blacklisted id
    }
    this.color.get(req_id).add(color)
    this.color.get(req_id).add(color_depth)
    if (depth > 0) { //rq: ->(rq_limited_walk)
      if (this.linksto.has(req_id)) {
        let next_depth = (depth < INFINITE_DEPTH) ? depth - 1 : depth
        for (const ancestor of this.linksto.get(req_id)) {
          this.mark_and_flood_up(color, ancestor, next_depth)
        }
      }
    }
  }

  /**
   * Extract execution timestamp from oreqm report
   * @return {string} time
   */
  get_time () {
    const time = get_xml_text(this.root, 'timestamp')
    return time
  }

  /**
   * A comparison may add 'ghost' requirements, which represent deleted
   * requirements. Remove these 'ghost' requirements.
   * @param {boolean} find_again do a new search
   */
  remove_ghost_requirements (find_again) {
    for (const ghost_id of this.removed_reqs) {
      if (this.requirements.has(ghost_id)) { // Ghost may not exist
        const rec = this.requirements.get(ghost_id)
        const dt_list = this.doctypes.get(rec.doctype)
        let idx = dt_list.indexOf(ghost_id)
        if (idx > -1) {
          dt_list.splice(idx, 1)
        }
        //dt_list.remove(ghost_id)
        if (dt_list.length) {
          this.doctypes.set(rec.doctype, dt_list)
        } else {
          this.doctypes.delete(rec.doctype)
        }
        this.requirements.delete(ghost_id)
        // Clear 'removed' diff status for linksto
        for (let lt of rec.linksto) {
          lt.diff = ''
        }
      }
    }
    // Reset diff flag for all links
    //console.log("New requirements to check for diff flag", this.new_reqs)
    for (const new_req of this.new_reqs) {
      const rec = this.requirements.get(new_req)
      //console.dir(rec)
      for (const lt of rec.linksto) {
        lt.diff = ''
      }
    }
    // Remove 'ghost' links
    for (const chg_req of this.updated_reqs) {
      //console.log("Changed requirements to check for diff flag", this.new_reqs)
      const rec = this.requirements.get(chg_req)
      const new_lt = []
      for (const lt of rec.linksto) {
        if (lt.diff !== 'removed') {
          lt.diff = ''
          new_lt.push(lt)
        } else {
          //console.log("Skip ghost linksto:", lt)
        }
      }
      //console.log("rec before and after", rec.id, rec.linksto, new_lt)
      rec.linksto = new_lt
      const new_ffb = []
      for (const ffb of rec.fulfilledby) {
        if (ffb.diff !== 'removed') {
          ffb.diff = ''
          new_ffb.push(ffb)
        } else {
          //console.log("Skip ghost fulfilledby:", lt)
        }
      }
      rec.fulfilledby = new_ffb
    }
    this.removed_reqs = []
    this.new_reqs = []
    this.updated_reqs = []
    if (find_again) {
      this.build_graph_traversal_links()
    }
    this.clear_cache()
  }

  /**
   * Clear cached node data
   */
  clear_cache () {
    this.search_cache = new Map()
    this.format_cache = new Map()
  }

  /**
   * Compare two sets of requirements (instances of ReqM2Oreqm)
   * and return lists of new, modified and removed <id>s"""
   * Requirements with no description are ignored.
   * 'Ghost' requirements in inserted which only exist in reference file.
   * @param {object} old_reqs reference oreqm object
   * @param {string[]} ignore_fields list of fields to ignore
   * @return {object} with new, updated and removed ids
   */
  compare_requirements (old_reqs, ignore_fields) { //rq: ->(rq_oreqm_diff_calc)
    const new_ids = Array.from(this.requirements.keys())
    const new_reqs = []
    const updated_reqs = []
    const removed_reqs = []
    this.remove_ghost_requirements(false)
    for (const req_id of new_ids) {
      const rec = this.requirements.get(req_id)
      // skip 'impl' and similar
      if ((rec.description.length === 0) && (rec.shortdesc.length === 0)) {
        continue
      }
      // compare json versions
      const new_rec = this.requirements.get(req_id)
      const old_rec = old_reqs.requirements.get(req_id)
      if (stringEqual(new_rec, old_rec, ignore_fields)) {
        continue // skip unchanged or nondescript reqs
      }
      if (old_reqs.requirements.has(req_id)) {
        updated_reqs.push(req_id)
        this.compare_linksto(old_rec, new_rec)
        this.compare_fulfilledby(old_rec, new_rec)
      } else {
        this.mark_linksto_new(req_id)
        this.mark_ffb_new(req_id)
        new_reqs.push(req_id)
      }
    }
    const old_ids = old_reqs.requirements.keys()
    for (const req_id of old_ids) {
      const old_rec = old_reqs.requirements.get(req_id)
      if ((old_rec.description.length === 0) && (old_rec.shortdesc.length === 0)) {
        continue
      }
      if (!new_ids.includes(req_id)) { // <id> no longer present -> removed
        removed_reqs.push(req_id)
        // Create 'ghost' requirement
        this.requirements.set(req_id, old_rec)
        // check if this introduces a new doctype
        if (!this.doctypes.has(old_rec.doctype)) {
          this.doctypes.set(old_rec.doctype, [])
        }
        // Update doctype table with new counts (and types)
        this.doctypes.get(old_rec.doctype).push(req_id)
        // Make all linksto 'removed'
        for (let lt of old_rec.linksto) {
          lt.diff = 'removed'
        }
      }
    }
    this.build_graph_traversal_links()
    this.new_reqs = new_reqs
    this.updated_reqs = updated_reqs
    this.removed_reqs = removed_reqs
    const result = new Object()
    result.new_reqs = new_reqs
    result.updated_reqs = updated_reqs
    result.removed_reqs = removed_reqs
    return result
  }

  /**
   * Mark all ffbs as new in 'diff' field
   * @param {string} id
   */
  mark_ffb_new (req_id) {
    const ffb_count = this.requirements.get(req_id).fulfilledby.length
    for (let index = 0; index < ffb_count; index++) {
      this.requirements.get(req_id).fulfilledby[index].diff = 'new'
    }
  }

  /**
   * Compare fulfilledby lists and add removed ffbs as 'ghosts' with 'removed' attribute, and set 'new' attribute on new ffbs.
   * @param {Specobject} old_rec
   * @param {Specobject} new_rec
   */
  compare_fulfilledby (old_rec, new_rec) {
    let old_map = new Map() // Map<id, fulfilledby_rec> Lookup table of OLD fulfilledby based on destination <id>
    let still_there = [] // List of old fulfilledby still present. Use to find removed ffbs later.
    // build lookup table for old specobject
    for (const old_f of old_rec.fulfilledby) {
      if (old_map.has(old_f.id)) {
        console.log(`ref ${old_rec.id} has multiple fulfilledby ${old_f.id}`, old_rec)
      }
      old_map.set(old_f.id, old_f)
    }
    // Check each ffb from new specobject
    for (const new_f of new_rec.fulfilledby) {
      if (old_map.has(new_f.id)) {
        if ((new_f.version !== old_map.get(new_f.id).version) ||
            (new_f.doctype !== old_map.get(new_f.id).doctype)) {
          //console.log('Change version:', old_map.get(key), new_f)
          new_f.diff = 'chg'
        }
        still_there.push(new_f.id)
        //console.log('still_there:', new_f.id, still_there)
      } else {
        new_f.diff = 'new'
        //console.log('new fulfilledby:', new_rec.id, new_f)
      }
    }
    // Find the fulfilledby that are no longer present
    for (const old_f of old_rec.fulfilledby) {
      if (!still_there.includes(old_f.id)) {
        // Add a 'ghost' fulfilledby
        //console.log(`Ghost fulfilledby ${old_rec.id} to ${old_l.id}`)
        const ghost_ffb = { ...old_f } // make a clone
        ghost_ffb.diff = 'removed'
        //console.log("Add ghost fulfilledby", ghost_ffb)
        new_rec.fulfilledby.push(ghost_ffb)
        //console.log('rec with ghost', new_rec.fulfilledby)
      }
    }
  }

  /**
   * Mark all linksto as new in 'diff' field
   * @param {string} id
   */
   mark_linksto_new (req_id) {
    const lt_count = this.requirements.get(req_id).linksto.length
    for (let index = 0; index < lt_count; index++) {
      this.requirements.get(req_id).linksto[index].diff = 'new'
      //console.log(`Mark as new ${req_id} ->`, this.requirements.get(req_id).linksto[index])
    }
  }

  /**
   * Compare linksto lists and add removed links as 'ghosts' with 'removed' attribute, and set 'new' attribute on new linksto.
   * @param {Specobject} old_rec
   * @param {Specobject} new_rec
   */
  compare_linksto (old_rec, new_rec) {
    let old_map = new Map() // Map<id, linksto_rec> Lookup table of OLD linksto based on destination <id>
    let still_there = [] // List of old linksto still present. Use to find removed links later.
    // build lookup table for old specobject
    for (const old_l of old_rec.linksto) {
      if (old_map.has(old_l.linksto)) {
        console.log(`ref ${old_rec.id} has multiple linksto ${old_l.linksto}`, old_rec)
      }
      old_map.set(old_l.linksto, old_l)
    }
    // Check each link from new specobject
    for (const new_l of new_rec.linksto) {
      if (old_map.has(new_l.linksto)) {
        if (new_l.dstversion !== old_map.get(new_l.linksto).dstversion) {
          //console.log('Change version:', old_map.get(new_l.linksto), new_l)
          new_l.diff = 'chg'
        }
        still_there.push(new_l.linksto)
        //console.log('still_there:', new_l.linksto, still_there)
      } else {
        new_l.diff = 'new'
        //console.log('new linksto:', new_rec.id, new_l)
      }
    }
    // Find the linksto that are no longer present
    for (const old_l of old_rec.linksto) {
      if (!still_there.includes(old_l.linksto)) {
        // Add a 'ghost' linksto
        //console.log(`Ghost linksto ${old_rec.id} to ${old_l.linksto}`)
        const ghost_linksto = { ...old_l } // make a clone
        ghost_linksto.diff = 'removed'
        //console.log("Add ghost linksto", ghost_linksto)
        new_rec.linksto.push(ghost_linksto)
        //console.log('rec with ghost', new_rec.linksto)
      }
    }
  }

  /**
   * Prefix <id> with new:, chg: or rem: if changed
   * @param {string} req_id id to check
   * @return {string} updated (decorated) id
   */
  id_search_string (req_id) {
    let diff = this.diff_status(req_id)
    return `id:${req_id}\n${diff}`
  }

  /**
   * Get diff status of id, i.e. new:, chg:, rem: or ''
   * @param {string} req_id id to check
   * @return {string} updated (decorated) id
   */
   diff_status (req_id) {
    let diff = ''
    if (this.new_reqs.includes(req_id)) {
      diff = 'new:'
    } else if (this.updated_reqs.includes(req_id)) {
      diff = 'chg:'
    } else if (this.removed_reqs.includes(req_id)) {
      diff = 'rem:'
    }
    return diff
  }

  /**
   * Check all ids against regex
   * @param {string} regex
   * @return {string[]} list of matching ids
   */
  find_reqs_with_name (regex) {
    const ids = this.requirements.keys()
    const rx = new RegExp(regex, 'im') // case-insensitive
    const matches = []
    for (const id of ids) {
      const id_string = this.id_search_string(id)
      //rq: ->(rq_search_id_only)
      if (id_string.search(rx) >= 0) {
        matches.push(id)
      }
    }
    return matches
  }

  /**
   * Return tagged text format for specobject.
   * There is a cache for previously created strings which is used for speedup.
   * Each xml tag has a corresponding 2 or 3 letter tag prefix.
   * @param {string} req_id key of specobject, === id for non-duplicates
   * @return {string} tagged string
   */
  get_all_text (req_id) {
    if (this.search_cache.has(req_id)) {
      return this.search_cache.get(req_id)
    } else {
      // Get all text fields as combined string
      const rec = this.requirements.get(req_id)
      const diff = this.diff_status(rec.id)
      let ffb = ''
      rec.fulfilledby.forEach(element =>
        ffb += '\nffb:' + element.id)
      let tags = ''
      rec.tags.forEach(element =>
        tags += '\ntag:' + element)
      let plat = ''
      rec.platform.forEach(element =>
        plat += '\nplt:' + element)
      let needsobj = ''
      rec.needsobj.forEach(element =>
        needsobj += '\nno:' + element)
      let verifymethods = ''
      rec.verifymethods.forEach(element =>
        verifymethods += '\nvm:' + element)
      let releases = ''
      rec.releases.forEach(element =>
        releases += '\nrel:' + element)
      let dependson = ''
      rec.dependson.forEach(element =>
        dependson += '\ndep:' + element)
      let conflicts = ''
      rec.conflicts.forEach(element =>
        conflicts += '\ncon:' + element)
      const dup = this.duplicates.has(rec.id) ? '\ndup:' : '' //rq: ->(rq_dup_req_search)
      const all_text = 'dt:' + rec.doctype +
        '\nid:' + rec.id +
        '\nve:' + rec.version +
        '\nst:' + rec.status +
        '\nde:' + rec.description +
        '\nfi:' + rec.furtherinfo +
        '\nrt:' + rec.rationale +
        '\nsr:' + rec.safetyrationale +
        '\nsc:' + rec.safetyclass +
        '\nsd:' + rec.shortdesc +
        verifymethods +
        '\nuc:' + rec.usecase +
        '\nvc:' + rec.verifycrit +
        '\nvco:' + rec.verifycond +
        '\nti:' + rec.testin +
        '\ntx:' + rec.testexec +
        '\nto:' + rec.testout +

        releases +
        dependson +
        conflicts +
        '\nco:' + rec.comment +
        '\ncs:' + rec.covstatus +
        needsobj +
        ffb +
        tags +
        plat +
        dup +
        '\n' + diff

      this.search_cache.set(req_id, all_text)
      return all_text
    }
  }

  /**
   * Check requirement texts against regex
   * @param {string} regex
   * @return {string[]} list of matching ids
   */
  find_reqs_with_text (regex) {
    const ids = this.requirements.keys()
    const matches = []
    try {
      const rx = new RegExp(regex, 'ims') // case-insensitive multi-line
      for (const id of ids) {
        if (rx.test(this.get_all_text(id))) { matches.push(id) }
      }
    } catch (err) {
      const msg = `Selection criteria error:\n${err.message}`
      console.log(msg)
      alert(msg)
    }
    return matches
  }

  /**
   * Mark all reachable nodes from id_list both up and down the graph
   * @param {string[]} id_list
   * @param {integer} color_up_value
   * @param {integer} color_down_value
   * @param {integer} depth
   */
  mark_and_flood_up_down (id_list, color_up_value, color_down_value, depth) {
    //rq: ->(rq_calc_shown_graph)
    for (const res of id_list) {
      this.mark_and_flood_down(color_down_value, res, depth)
      this.mark_and_flood_up(color_up_value, res, depth)
    }
  }

  /**
   * Clear the 'color' tags on the requirements
   */
  clear_marks () {
    const ids = this.color.keys()
    for (const id of ids) {
      this.color.set(id, new Set())
    }
  }

  get_doctypes () {
    return this.doctypes
  }

  get_dot () {
    // return current graph
    return this.dot
  }

  set_excluded_doctypes (doctypes) {
    // Set excluded doctypes
    this.excluded_doctypes = doctypes
  }

  get_excluded_doctypes () {
    // Get excluded doctypes
    return this.excluded_doctypes
  }

  set_excluded_ids (ids) {
    // Set excluded doctypes
    this.excluded_ids = ids
  }

  check_node_id (name) {
    return this.requirements.has(name)
  }

  /**
   * Collect problems and suppress duplicates
   * @param {string} report string with description (possibly multiple lines)
   */
  problem_report (report) {
    //rq: ->(rq_issues_log)
    // if (!this.problems.includes(report)) {
    this.problems.push(report)
    // }
  }

  get_problems () {
    // Get a list of problems as string. Empty string -> no problems
    return "Detected problems:\n" + this.problems.join('\n')
  }

  get_problem_count () {
    // Get a count of problems strings
    return this.problems.length
  }

  clear_problems () {
    this.problems = []
  }

  /**
   * Get XML representation of specobject
   * @param {string} id
   * @return {string} in XML format
   */
  get_xml_string(id) {
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
}
