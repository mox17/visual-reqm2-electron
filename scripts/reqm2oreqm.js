/* Main class for managing oreqm xml data */
"use strict";

/**
 * Process xml input text and display possible errors detected
 * @param {string} xmlString
 */
function tryParseXML(xmlString) {
  var parser = new DOMParser();
  var parsererrorNS = parser.parseFromString('INVALID', 'text/xml').getElementsByTagName("parsererror")[0].namespaceURI;
  var dom = parser.parseFromString(xmlString, 'text/xml');
  let errors = dom.getElementsByTagNameNS(parsererrorNS, 'parsererror')
  if (errors.length > 0) {
    let text = ''
    for (let t of errors[0].childNodes ) {
      text += t.textContent + '\n'
    }
    throw new Error(text);
  }
  return dom;
}

// XML data extraction utility functions

/**
 * Return the text in the first (only?) tag with specified tag name
 * @param {object} node specobject
 * @param {string} tag_name name of tag
 * @return {string}
 */
function get_xml_text(node, tag_name) {
  var result = ""
  var item = node.getElementsByTagName(tag_name)
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
function get_list_of(node, tag_name) {
  var result = []
  var items = node.getElementsByTagName(tag_name)
  var i;
  for (i=0; i < items.length; i++) {
    result.push(items[i].textContent)
  }
  return result
}

/**
 * Get linksto references
 * @param {specobject} node
 * @return {object[]} an array of objects with .linksto .dstversion and .linkerror
 */
function get_linksto(node) {
  var result = []
  var items = node.getElementsByTagName('provcov')
  var i;
  for (i=0; i < items.length; i++) {
    let linksto = items[i].getElementsByTagName('linksto')
    if (linksto.length != 1) {
      console.log("Multiple <linksto> in <provcov>")
      continue
    }
    let dstversion = items[i].getElementsByTagName('dstversion')
    let dstversion_txt
    if (dstversion.length != 1) {
      dstversion_txt = "multiple"
    } else {
      dstversion_txt = dstversion[0].textContent
    }
    let linkerror = items[i].getElementsByTagName('linkerror')
    // if (linkerror) {
    //   console.log(linkerror[0].textContent)
    // }
    let link_error_txt = (linkerror && linkerror.length > 0) ? linkerror[0].textContent : ''
    if (link_error_txt && link_error_txt.startsWith('source ')) {
      // Do not render 'source not covered.' and 'source status 'rejected' excluded from tracing.' in diagram edges
      link_error_txt = ''
    }
    let link = {
      linksto : linksto[0].textContent,
      dstversion : dstversion_txt,
      linkerror : link_error_txt
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
function get_fulfilledby(node) {
  var ff_list = []
  var ffbobj_list = node.getElementsByTagName('ffbObj')
  var i;
  for (i = 0; i < ffbobj_list.length; i++) {
    var ffbobj = ffbobj_list[i]
    let ffb_linkerror_list = ffbobj.getElementsByTagName('ffbLinkerror')
    // if (ffb_linkerror_list) {
    //   console.log('ffbLinkerror:', ffb_linkerror_list[0].textContent)
    // }
    let ffb_linkerror_txt = (ffb_linkerror_list && ffb_linkerror_list.length > 0) ? ffb_linkerror_list[0].textContent : ''
    if (ffb_linkerror_txt && ffb_linkerror_txt.startsWith('target not ')) {
      // Do not render 'target not covered.' in diagram edges
      ffb_linkerror_txt = ''
    }
    let ff_entry = {
      id : get_xml_text(ffbobj, 'ffbId'),
      doctype : get_xml_text(ffbobj, 'ffbType'),
      version : get_xml_text(ffbobj, 'ffbVersion'),
      ffblinkerror : ffb_linkerror_txt
    }
    ff_list.push(ff_entry)
  }
  return ff_list
}

/**
 * Compare a_in and b_in objects, while ignoring the fields listed in ignore_list
 * @param {object} a_in
 * @param {object} b_in
 * @param {[string]} ignore_list
 * @return {boolean} is the subset of fields equal
 */
function stringEqual(a_in, b_in, ignore_list) {
  let a = Object.assign({}, a_in)
  let b = Object.assign({}, b_in)
  //console.log(typeof(a), a, typeof(b), b)
  if (typeof(a) === 'object' && typeof(b) === 'object') {
    for (let field of ignore_list) {
      // force ignored fields empty
      a[field] = '';
      b[field] = '';
    }
  }
  const a_s = JSON.stringify(a)
  const b_s = JSON.stringify(b)
  return a_s === b_s
}

/**
 * This class reads and manages information in ReqM2 .oreqm files
 */
export default class ReqM2Specobjects {
  constructor(filename, content, excluded_doctypes, excluded_ids) {
    this.filename = filename;      // basename of oreqm file
    this.timestamp = ''            // recorded time of ReqM2 run
    this.root = null;              // xml tree
    this.doctypes = new Map();     // { doctype : [id] }  List of ids of a specific doctype
    this.requirements = new Map(); // { id : Requirement}
    this.rules = new Map();        // {rule_id : description}
    this.color = new Map();        // {id:[color]} When traversing the graph of nodes a 'color' is associated with each visited node
    this.linksto = new Map();      // {id:{id}} -- map to set of linked ids
    this.linksto_rev = new Map();  // {id:{id}} -- reverse direction of linksto. i.e. top-down
    this.fulfilledby = new Map();  // {id:{id}}
    this.excluded_doctypes = excluded_doctypes; // [doctype]
    this.excluded_ids = excluded_ids; // [id]
    this.no_rejects = true         // skip rejected specobjects
    this.new_reqs = [];            // List of new requirements (from comparison)
    this.updated_reqs = [];        // List of updated requirements (from comparison)
    this.removed_reqs = [];        // List of removed requirements (copies taken from older(?) version of oreqm)
    this.visible_nodes = new Map(); // {doctype:[id]}
    this.problems = []             // [ Str ] problems reports
    this.search_cache = new Map()  // Cache tagged string versions
    this.format_cache = new Map()  // Cache 'dot' formatted nodes
    this.dot = 'digraph "" {label="Select filter criteria and exclusions, then click\\l                    [update graph]\\l(Unfiltered graphs may be too large to render)"\n  labelloc=b\n  fontsize=24\n  fontcolor=grey\n  fontname="Arial"\n}\n'

    // Initialization logic
    this.clear_problems()
    let success = this.process_oreqm_content(content);
    if (success) {
      this.read_reqm2_rules();
      this.read_req_descriptions();
      this.add_fulfilledby_nodes();
      this.build_graph_traversal_links();
      this.timestamp = this.get_time()
      let problems = this.get_problems()
      if (problems) {
        //alert(problems)
      }
    }
  }

  /**
   * Create a default diagram which acts as a mini user guide
   */
  set_svg_guide() {
    this.dot = 'digraph "" {label="Select filter criteria and exclusions, then click\\l                    [update graph]\\l(Unfiltered graphs may be too large to render)"\n  labelloc=b\n  fontsize=24\n  fontcolor=grey\n  fontname="Arial"\n}\n'
  }

  /**
   * Attempt to load XML and report if error detected
   * @param {string} content
   * @return {boolean} processing success
   */
  process_oreqm_content(content) {
    try {
      this.root = tryParseXML(content)
    } catch (err) {
      alert(err)
      return false
    }
    return true
  }

  /**
   * Read the rules specified within the oreqm file, i.e. the rules behind 'violations'.
   * Store descriptions in map
   */
  read_reqm2_rules() {
   let rule_list = this.root.getElementsByTagName("rule");
   for (const rule of rule_list) {
     let rule_id_arr = rule.getElementsByTagName("name")
     let rule_description_arr = rule.getElementsByTagName("description")
     if (rule_id_arr.length === 1 && rule_description_arr.length === 1) {
       //console.log(rule_id_arr[0].textContent, rule_description_arr[0].textContent)
       this.rules.set(rule_id_arr[0].textContent, rule_description_arr[0].textContent)
     }
   }
 }

 /**
  * Find and read all specobjects with associated doctypes
  */
  read_req_descriptions() {
    // Handle all sections with specobjects
    let specobjects_list = this.root.getElementsByTagName("specobjects");
    for (const specobjects of specobjects_list) {
      let doctype = specobjects.getAttributeNode("doctype").value;
      if (!this.doctypes.has(doctype)) {
        this.doctypes.set(doctype, []);
      }
      this.read_specobject_list(specobjects, doctype);
    }
  }

  /**
   * Read a single specobject and create and object for each
   * @param {object} node specobject
   * @param {string} doctype
   */
  read_specobject_list(node, doctype) {
    // Read individual specobject
    let specobject_list = node.getElementsByTagName("specobject");
    for (const comp of specobject_list) {
      let req = new Object();
      req.id              = get_xml_text(comp, 'id');
      req.comment         = get_xml_text(comp, 'comment'),
      req.covstatus       = get_xml_text(comp, 'covstatus'),
      req.dependson       = get_list_of(comp, 'dependson'),
      req.description     = get_xml_text(comp, 'description');
      req.doctype         = doctype,
      req.fulfilledby     = get_fulfilledby(comp),
      req.furtherinfo     = get_xml_text(comp, 'furtherinfo'),
      req.linksto         = get_linksto(comp),
      req.needsobj        = get_list_of(comp, 'needsobj'),
      req.platform        = get_list_of(comp, 'platform'),
      req.rationale       = get_xml_text(comp, 'rationale'),
      req.safetyclass     = get_xml_text(comp, 'safetyclass'),
      req.safetyrationale = get_xml_text(comp, 'safetyrationale'),
      req.shortdesc       = get_xml_text(comp, 'shortdesc'),
      req.source          = get_xml_text(comp, 'source'),
      req.sourcefile      = get_xml_text(comp, 'sourcefile'),
      req.sourceline      = get_xml_text(comp, 'sourceline'),
      req.status          = get_xml_text(comp, 'status'),
      req.tags            = get_list_of(comp, 'tag'),
      req.usecase         = get_xml_text(comp, 'usecase'),
      req.verifycrit      = get_xml_text(comp, 'verifycrit'),
      req.version         = get_xml_text(comp, 'version'),
      req.violations      = get_list_of(comp, 'ruleid');
      req.ffb_placeholder = false;

      if (this.requirements.has(req.id)) {
        let problem = "<id> duplicated: {} ".format(req.id)
        //console.log("redefinition of ", req.id)
        this.problem_report(problem)
      }
      while (this.requirements.has(req.id)) {
        // Add suffix until id is unique
        req.id += '_dup_'
      }
      this.requirements.set(req.id, req)
      let dt_arr = this.doctypes.get(doctype)
      if (!dt_arr.includes(req.id)) {
        dt_arr.push(req.id)
        this.doctypes.set(doctype, dt_arr) // keep status per doctype
      } else {
        //console.log("duplicate id ", req.id)
      }
      //console.log(req);
    }
  }

  /**
   * Create placeholders for absent 'fulfilledby' requirements.
   * Add doctype to needsobj if not present
   */
  add_fulfilledby_nodes() {
    const ids = Array.from(this.requirements.keys())
    let new_nodes = new Map() // need a new container to add after loop
    for (let req_id of ids) {
      const rec = this.requirements.get(req_id)
      let ffb_list = Array.from(rec.fulfilledby)
      for (let ff_arr of ffb_list) {
        const ff_id = ff_arr.id
        const ff_doctype = ff_arr.doctype
        const ff_version = ff_arr.version
        if (!this.requirements.has(ff_id)) {
            // Create placeholder for ffb node
            let new_node = {
              "comment": '',
              "dependson": [],
              "description": "*FULFILLEDBY PLACEHOLDER*",
              "doctype": ff_doctype,
              "fulfilledby": [],
              "furtherinfo": '',
              "id": ff_id,
              "linksto": [],
              "needsobj": [],
              "platform": [],
              "rationale": '',
              "safetyclass": '',
              "safetyrationale": '',
              "shortdesc": '',
              "source": '',
              "sourcefile": '',
              "sourceline": '',
              "status": '',
              "tags": [],
              "usecase": "",
              "verifycrit": '',
              "version": ff_version,
              "violations": [],
              "ffb_placeholder" : true
            }
            new_nodes.set(ff_id, new_node)
        } else {
          // check for matching doctype
          const real_dt = this.requirements.get(ff_id).doctype
          if (real_dt !== ff_doctype) {
            let problem = "ffbType {} does not match {} for <id> {}".format(ff_doctype, real_dt, ff_id)
            this.problem_report(problem)
          }
        }
        // Add pseudo needsobj with '*' suffix
        if (!rec.needsobj.includes(ff_doctype) &&
            !rec.needsobj.includes(ff_doctype+'*')) {
          rec.needsobj.push(ff_doctype+'*')
          this.requirements.set(req_id, rec)
        }
        // Add new doctype list if unknown
        if (!this.doctypes.has(ff_doctype)) {
          this.doctypes.set(ff_doctype, [])
        }
        // Add id to list if new
        let dt_arr = this.doctypes.get(ff_doctype)
        if (!dt_arr.includes(ff_id)) {
          dt_arr.push(ff_id)
          this.doctypes.set(ff_doctype, dt_arr)
        }
      }
    }
    const new_keys = new_nodes.keys()
    for (const key of new_keys) {
      //console.log(key, new_nodes[key])
      if (!this.requirements.has(key)) {
        this.requirements.set(key, new_nodes.get(key))
      }
    }
  }

  /**
   * Populate the linksto and reverse linksto_rev dicts with the linkages in the requirements.
   * Ensure that color dict has all valid ids
   */
  build_graph_traversal_links() {
    const ids = this.requirements.keys()
    // Clear any previous results
    this.linksto = new Map()
    this.linksto_rev = new Map()
    let lt_set
    // Check all requirements
    for (const req_id of ids) {
      const rec = this.requirements.get(req_id)
      for (const link of rec.linksto) {
        //console.log(req_id, link)
        // bottom-up
        if (!this.linksto.has(req_id)) {
            this.linksto.set(req_id, new Set())
        }
        this.linksto.set(req_id, this.linksto.get(req_id).add(link.linksto))

        // top-down
        if (!this.linksto_rev.has(link.linksto)) {
          this.linksto_rev.set(link.linksto, new Set())
        }
        lt_set = this.linksto_rev.get(link.linksto)
        lt_set.add(req_id)
        this.linksto_rev.set(link.linksto, lt_set)
      }
      for (const ffb_arr of rec.fulfilledby) {
        const ffb_link = ffb_arr.id
        // top-down
        if (!this.linksto_rev.has(req_id)) {
          this.linksto_rev.set(req_id, new Set())
        }
        let ffb_set = this.linksto_rev.get(req_id)
        ffb_set.add(ffb_link)
        this.linksto_rev.set(req_id, ffb_set)

        if (!this.fulfilledby.has(ffb_link)) {
          this.fulfilledby.set(ffb_link, new Set())
        }
        ffb_set = this.fulfilledby.get(ffb_link)
        ffb_set.add(req_id)
        this.fulfilledby.set(ffb_link, ffb_set)

        // bottom-up
        if (!this.linksto.has(ffb_link)) {
          this.linksto.set(ffb_link, new Set())
        }
        lt_set = this.linksto.get(ffb_link)
        lt_set.add(req_id)
        this.linksto.set(ffb_link, lt_set)
      }
      this.color.set(req_id, new Set())
    }
  }

  /**
   * Store reject state flag in oreqm object
   * @param {boolean} state
   */
  set_no_rejects(state) {
    this.no_rejects = state
  }

  /**
   * Check if node is eligible for inclusion in graph (not excluded, invalid or already visited)
   * If OK mark req_id with 'color' and process child nodes recursively
   * @param {integer} color
   * @param {string} req_id
   */
  mark_and_flood_down(color, req_id) {
    // Color this id and linksto_rev referenced nodes with color
    const rec = this.requirements.get(req_id)
    if (!rec) {
      return // missing specobject
    }
    if (!this.color.has(req_id)) {
      return // unknown <id> (bug)
    }
    if (this.color.get(req_id).has(color)) {
      return // already visited
    }
    //console.log(this.requirements.get(req_id).doctype)
    if (this.excluded_doctypes.includes(rec.doctype)) {
      return // blacklisted doctype
    }
    //Is this requirement rejected
    if (this.no_rejects && rec.status === 'rejected') {
      return // rejected specobject
    }
    if (this.excluded_ids.includes(req_id)) {
      return // blacklisted id
    }
    let col_set = this.color.get(req_id)
    col_set.add(color)
    this.color.set(req_id, col_set)
    if (this.linksto_rev.has(req_id)) {
      for (const child of this.linksto_rev.get(req_id)) {
        this.mark_and_flood_down(color, child)
      }
    }
  }

  /**
   * Check if node is eligible for inclusion in graph (not excluded, invalid or already visited)
   * If OK mark req_id with 'color' and process ancestor nodes recursively
   * @param {integer} color
   * @param {string} req_id
   */
  mark_and_flood_up(color, req_id) {
    //Color this id and linksto referenced nodes with color
    const rec = this.requirements.get(req_id)
    if (!rec) {
      return // missing specobject
    }
    if (!this.color.has(req_id)) {
      return // unknown <id> (bug)
    }
    if (this.color.get(req_id).has(color)) {
      return // already visited
    }
    if (this.excluded_doctypes.includes(rec.doctype)) {
      return // blacklisted doctype
    }
    //Is this requirement rejected
    if (this.no_rejects && rec.status === 'rejected') {
      return // rejected specobject
    }
    if (this.excluded_ids.includes(req_id)) {
      return // blacklisted id
    }
    let col_set = this.color.get(req_id)
    col_set.add(color)
    this.color.set(req_id, col_set)
    if (this.linksto.has(req_id)) {
      for (const ancestor of this.linksto.get(req_id)) {
        this.mark_and_flood_up(color, ancestor)
      }
    }
  }

  /**
   * Extract execution timestamp from oreqm report
   * @return {string} time
   */
  get_time() {
    const time = get_xml_text(this.root, "timestamp")
    return time
  }

  /**
   * A comparison may add 'ghost' requirements, which represent deleted
   * requirements. Remove these 'ghost' requirements.
   * @param {boolean} find_again do a new search
   */
  remove_ghost_requirements(find_again) {
    for (const ghost_id of this.removed_reqs) {
      if (this.requirements.has(ghost_id)) { // Ghost may not exist
        const rec = this.requirements.get(ghost_id)
        let dt_list = this.doctypes.get(rec.doctype)
        dt_list.remove(ghost_id)
        if (dt_list.length) {
          this.doctypes.set(rec.doctype, dt_list)
        } else {
          this.doctypes.delete(rec.doctype)
        }
        this.requirements.delete(ghost_id)
      }
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
  clear_cache() {
    this.search_cache = new Map()
    this.format_cache = new Map()
  }

  /**
   * Compare two sets of requirements (instances of ReqM2Oreqm)
   * and return lists of new, modified and removed <id>s"""
   * Requirements with no description are ignored
   * @param {object} old_reqs reference oreqm object
   * @param {string[]} ignore_fields list of fields to ignore
   * @return {object} with new, updated and removed ids
   */
  compare_requirements(old_reqs, ignore_fields) {
    const new_ids = Array.from(this.requirements.keys())
    let new_reqs = []
    let updated_reqs = []
    let removed_reqs = []
    this.remove_ghost_requirements(false)
    for (const req_id of new_ids) {
      const rec = this.requirements.get(req_id)
      // skip 'impl' and similar
      if ((rec.description.length === 0) && (rec.shortdesc.length === 0)) {
        continue;
      }
      // compare json versions
      if (stringEqual(this.requirements.get(req_id), old_reqs.requirements.get(req_id), ignore_fields)) {
        continue // skip unchanged or nondescript reqs
      }
      if (old_reqs.requirements.has(req_id)) {
          updated_reqs.push(req_id)
      } else {
          new_reqs.push(req_id)
      }
    }
    const old_ids = old_reqs.requirements.keys()
    for (const req_id of old_ids) {
      let old_rec = old_reqs.requirements.get(req_id)
      if ((old_rec.description.length === 0) && (old_rec.shortdesc.length === 0)) {
        continue;
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
        let dt_arr = this.doctypes.get(old_rec.doctype)
        dt_arr.push(req_id)
        this.doctypes.set(old_rec.doctype, dt_arr)
      }
    }
    this.build_graph_traversal_links() // Select the changed ones (if wanted)
    this.new_reqs = new_reqs
    this.updated_reqs = updated_reqs
    this.removed_reqs = removed_reqs
    let result = new Object()
    result.new_reqs = new_reqs
    result.updated_reqs = updated_reqs
    result.removed_reqs = removed_reqs
    return result
  }

  /**
   * Prefix <id> with new:, chg: or rem: if changed
   * @param {string} req_id id to check
   * @return {string} updated (decorated) id
   */
  decorate_id(req_id) {
    let id_str = req_id
    if (this.new_reqs.includes(req_id)) {
      id_str = 'new:' + req_id
    } else if (this.updated_reqs.includes(req_id)) {
      id_str = 'chg:' + req_id
    } else if (this.removed_reqs.includes(req_id)) {
      id_str = 'rem:' + req_id
    }
    return id_str
  }

  /**
   * Check all ids against regex
   * @param {string} regex
   * @return {string[]} list of matching ids
   */
  find_reqs_with_name(regex) {
    const ids = this.requirements.keys()
    let rx = new RegExp(regex, 'i') // case-insensitive
    let matches = []
    for (const id of ids) {
      const decorated_id = this.decorate_id(id)
      if (decorated_id.search(rx) >= 0)
        matches.push(id)
    }
    return matches
  }

  /**
   * Return tagged text format for specobject.
   * There is a cache for previously created strings which is used for speedup.
   * Each xml tag has a corresponding 2 or 3 letter tag prefix.
   * @param {string} req_id id of specobject
   * @return {string} tagged string
   */
  get_all_text(req_id) {
    if (this.search_cache.has(req_id)) {
      return this.search_cache.get(req_id)
    } else {
      // Get all text fields as combined string
      const rec = this.requirements.get(req_id)
      let id_str = this.decorate_id(req_id)
      let ffb = ''
      rec.fulfilledby.forEach(element =>
        ffb += '\nffb:'+element.id)
      let tags = ''
      rec.tags.forEach(element =>
        tags += '\ntag:'+element)
      let plat = ''
      rec.platform.forEach(element =>
        plat += '\nplt:'+element)
      let needsobj = ''
      rec.needsobj.forEach(element =>
        needsobj += '\nno:'+element)
      let all_text = 'dt:' + rec.doctype
        + '\nst:' + rec.status
        + '\nde:' + rec.description
        + '\nfi:' + rec.furtherinfo
        + '\nrt:' + rec.rationale
        + '\nsr:' + rec.safetyrationale
        + '\nsc:' + rec.safetyclass
        + '\nsd:' + rec.shortdesc
        + '\nuc:' + rec.usecase
        + '\nvc:' + rec.verifycrit
        + '\nco:' + rec.comment
        + '\ncs:' + rec.covstatus
        + needsobj
        + ffb
        + tags
        + plat
        + '\nid:' + id_str;  // req_id is last to ensure regex search for <id>$ will succeed

      this.search_cache.set(req_id, all_text)
      return all_text
    }
  }

  /**
   * Check requirement texts against regex
   * @param {string} regex
   * @return {string[]} list of matching ids
   */
  find_reqs_with_text(regex) {
    const ids = this.requirements.keys()
    let matches = []
    try {
      let rx = new RegExp(regex, 'ims') // case-insensitive multi-line
      for (const id of ids) {
        if (rx.test(this.get_all_text(id)))
          matches.push(id)
      }
    }
    catch(err) {
      alert('Selection criteria error:\n{}'.format(err.message))
    }
    return matches
  }

  /**
   * Mark all reachable nodes from id_list both up and down the graph
   * @param {*} id_list
   * @param {*} color_up_value
   * @param {*} color_down_value
   */
  mark_and_flood_up_down(id_list, color_up_value, color_down_value) {
    for (const res of id_list) {
      this.mark_and_flood_down(color_down_value, res)
      this.mark_and_flood_up(color_up_value, res)
    }
  }

  /**
   * Clear the 'color' tags on the requirements
   */
  clear_marks() {
    const ids = this.color.keys()
    for (const id of ids) {
      this.color.set(id, new Set())
    }
  }

  get_doctypes() {
    return this.doctypes
  }

  get_dot() {
    // return current graph
    return this.dot
  }

  set_excluded_doctypes(doctypes) {
    // Set excluded doctypes
    this.excluded_doctypes = doctypes
  }

  get_excluded_doctypes() {
    // Get excluded doctypes
    return this.excluded_doctypes
  }

  set_excluded_ids(ids) {
    // Set excluded doctypes
    this.excluded_ids = ids
  }

  get_main_ref_diff() {
    // Return the lists of ids
    let diff = new Object()
    diff.new_reqs = this.new_reqs
    diff.updated_reqs = this.updated_reqs
    diff.removed_reqs = this.removed_reqs
    return diff
  }

  get_node_count() {
    return this.requirements.size
  }

  check_node_id(name) {
    return this.requirements.has(name)
  }

  doctypes_rank() {
    // Return an array of doctypes in abstraction level order.
    // Could be the order of initial declaration in oreqm
    // For now this is it.
    return Array.from(this.doctypes.keys())
  }

  /**
   * Collect problems and suppress duplicates
   * @param {string} report string with description (possibly multiple lines)
   */
  problem_report(report) {
    //if (!this.problems.includes(report)) {
      this.problems.push(report)
    //}
  }

  get_problems() {
    // Get a list of problems as string. Empty string -> no problems
    return this.problems.join('\n')
  }

  get_problem_count() {
    // Get a count of problems strings
    return this.problems.length;
  }

  clear_problems() {
    this.problems = []
  }

  /**
   * Recreate XML for presentation purposes
   * @param {object} rec
   * @param {string} tag
   * @return {string} in XML format
   */
  get_tag_text_formatted(rec, tag) {
    let xml_txt = ''
    if (Object.prototype.hasOwnProperty.call(rec, tag)) {
      let txt = rec[tag]
      let template = "\n    <{}>{}</{}>"
      if (txt.length) {
        xml_txt = template.format(tag, txt, tag)
      }
    }
    return xml_txt
  }

  /**
   * Recreate XML lists for presentation purposes
   * @param {*} rec
   * @param {*} field
   * @return {string} in XML format
   */
  get_list_formatted(rec, field) {
    let xml_txt = ''
    if (Object.prototype.hasOwnProperty.call(rec, field)) {
      let list = rec[field]
      let template = "\n    <{}>{}</{}>"
      if (list.length) {
        xml_txt = "\n{}: ".format(field)
        if (field==='linksto') {
          xml_txt = '\n    <providescoverage>'
          for (let i=0; i<list.length; i++) {
            xml_txt += `
      <provcov>
        <linksto>{}</linksto>
        <dstversion>{}</dstversion>
      </provcov>`.format(list[i].linksto, list[i].dstversion)
          }
          xml_txt += '\n    </providescoverage>'
        } else if (field==='needsobj') {
          xml_txt = '\n    <needscoverage>'
          for (let i=0; i<list.length; i++) {
            if (list[i].includes('*')) continue;
            xml_txt += `
      <needscov><needsobj>{}</needsobj></needscov>`.format(list[i])
          }
          xml_txt += '\n    </needscoverage>'
        } else if (field==='tags') {
          xml_txt = '\n    <tags>'
          for (let i=0; i<list.length; i++) {
            xml_txt += `
      <tag>{}</tag>`.format(list[i])
          }
          xml_txt += '\n    </tags>'
        } else if (field==='platform') {
          xml_txt = '\n    <platforms>'
          for (let i=0; i<list.length; i++) {
            xml_txt += `
      <platform>{}</platform>`.format(list[i])
          }
          xml_txt += '\n    </platforms>'
        } else if (field==='fulfilledby') {
          xml_txt = '\n    <fulfilledby>'
          for (let i=0; i<list.length; i++) {
            xml_txt += `
      <ffbObj>
        <ffbId>{}</ffbId>
        <ffbType>{}</ffbType>
        <ffbVersion>{}</ffbVersion>
      </ffbObj>`.format(list[i].id, list[i].doctype, list[i].version)
          }
          xml_txt += '\n    </fulfilledby>'
        } else {
          xml_txt = template.format(field, list.join(', '), field)
        }
      }
    }
    return xml_txt
  }

  /**
   * Reconstruct XML representation of specobject (ignoring extra tags related to oreqm results)
   * @param {string} id
   * @return {string} in XML format
   */
  get_node_text_formatted(id) {
    let xml_txt = ""
    if (this.requirements.has(id)) {
      let rec = this.requirements.get(id)
      let indent = '      '
      let template = `\
<specobjects doctype="{}">
  <specobject>
    <id>{}</id>
    <status>{}</status>{}
  </specobject>
</specobjects>
`
      let optional = ''
      optional    += this.get_tag_text_formatted(rec, 'source', indent)
      optional    += this.get_tag_text_formatted(rec, 'version', indent)
      optional    += this.get_tag_text_formatted(rec, 'shortdesc', indent)
      optional    += this.get_tag_text_formatted(rec, 'description', indent)
      optional    += this.get_tag_text_formatted(rec, 'rationale', indent)
      optional    += this.get_tag_text_formatted(rec, 'comment', indent)
      optional    += this.get_tag_text_formatted(rec, 'furtherinfo', indent)
      optional    += this.get_tag_text_formatted(rec, 'safetyclass', indent)
      optional    += this.get_tag_text_formatted(rec, 'safetyrationale', indent)
      optional    += this.get_tag_text_formatted(rec, 'verifycrit', indent)
      optional    += this.get_tag_text_formatted(rec, 'source', indent)
      optional    += this.get_tag_text_formatted(rec, 'sourcefile', indent)
      optional    += this.get_tag_text_formatted(rec, 'sourceline', indent)
      optional    += this.get_list_formatted(rec, 'tags', indent)
      optional    += this.get_list_formatted(rec, 'fulfilledby', indent)
      optional    += this.get_list_formatted(rec, 'platform', indent)
      optional    += this.get_list_formatted(rec, 'needsobj', indent)
      optional    += this.get_list_formatted(rec, 'linksto', indent)
      xml_txt = template.format(rec.doctype, rec.id, rec.status, optional)
    }
    return xml_txt
  }

}
