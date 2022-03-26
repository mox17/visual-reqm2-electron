'use strict'
const nearley = require('nearley')
const grammar = require('./vql-parser.js')
import {searchTagOrder, searchTagsLookup} from './reqm2oreqm'
import { getTimeNow, logTimeSpent } from './util.js'

// Reference to current oreqm object. Only valid during vqlParse
let oreqm = null

/**
 * Parse a VQL expression and evaluate it.
 * @param {Object} oreqm collection of specobjects
 * @param {String} sc Search criteria string (in VQL)
 * @returns {Object} AST of parsed VQL expression
 */
export function vqlParse (oreqmParameter, sc) {
  //rq: ->(rq_query_language)
  let ans
  oreqm = oreqmParameter
  let result = null
  try {
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
    ans = parser.feed(sc)
  } catch (e) {
    //console.log(e)
    //var errorOut = `Error offset ${e.offset} chars into\n${sc}`
    //let msg = e.message.replace(/xxInstead.*/msg, '')
    return null
  }
  // Check if there are any results
  if (ans.results.length) {
    result = vqlEvalRoot(oreqm, ans.results[0])
  } else {
    // This means the input is incomplete.
    result = null
  }
  oreqm = null
  return result
}

/**
 * Validate VQL input
 * @param {string} sc VQL string to check
 * @returns null if OK, string with error if problem found
 */
export function vqlValidate (sc) {
  let ans
  try {
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
    ans = parser.feed(sc)
  } catch (e) {
    //console.log(e)
    let msg = e.message.replace(/Instead.*/msg, '')
    msg = msg.replace(/\n/msg, '<br>').replace(/ /msg, '&nbsp;')
    return msg
  }
  // Check if there are any results
  if (ans.results.length) {
    //console.log(ans.results)
    // istanbul ignore next
    if (ans.results.length > 1) {
      return 'Ambiguous result'
    }
    return null
  } else {
    // This means the input is incomplete.
    return 'Error: incomplete VQL input, parse failed.'
  }
}

/**
 * Evaluate a VQL query against a oreqm object
 * @param {Object} oreqm specobjects to search
 * @param {Object} searchAst a parse object from search expression
 * @returns {Set} Matching specobject ids
 */
export function vqlEvalRoot (oreqm, searchAst) {
  let initialSet = oreqm.getAllIds()
  const now = getTimeNow()
  const res = vqlEval(initialSet, searchAst)
  logTimeSpent(now, "vqlEvalRoot")
  return res
}

/**
 * Visual ReqM2 Query language search
 * @param {Set} inputNodes list of keys (specobject ids)
 * @param {Object} searchAst Parse tree of search expression
 *
 * @returns {Set} set of matching keys (specobject ids)
 */
function vqlEval (inputNodes, searchAst) {
  switch (searchAst.op) {
    case 'AND':
      return andSearch(inputNodes, searchAst.arg1, searchAst.arg2)
    case 'OR':
      return orSearch(inputNodes, searchAst.arg1, searchAst.arg2)
    case 'co': // 'co'/'children_of' deprecated
    case 'de': //rq: ->(rq_vql_descendants)
      return coSearch(inputNodes, searchAst.arg1, searchAst.arg2)
    case 'ao': // 'ao'/'ancestors_of' deprecated
    case 'an': //rq: ->(rq_vql_ancestors)
      return aoSearch(inputNodes, searchAst.arg1, searchAst.arg2)
    case 'ch': //rq: ->(rq_vql_children)
      return chSearch(inputNodes, searchAst.arg1, searchAst.arg2)
    case 'pa': //rq: ->(rq_vql_parents)
      return paSearch(inputNodes, searchAst.arg1, searchAst.arg2)
    case 'd':
      return dSearch(inputNodes, searchAst)
    case 'NOT': {
      let s1 = vqlEval(inputNodes, searchAst.arg)
      // return complementary set
      return new Set([...inputNodes].filter((x) => !s1.has(x)))
    }
    // istanbul ignore next
    default: {
      //console.log(`vqlSearch op error ${searchAst}`)
      return new Set()
    }
  }
}

/**
 * AND two results. Return set intersection
 * @param {Set} nodes input to match against
 * @param {Object} a1
 * @param {Object} a2
 * @returns {Set} intersection between results from a1 and a2
 */
function andSearch (nodes, a1, a2) {
  let s1 = vqlEval(nodes, a1)
  if (s1.size) {
    // Only evaluate a2 if a1 returned non-empty set
    let s2 = vqlEval(nodes, a2)
    return new Set([...s1].filter(x => s2.has(x)))
  } else {
    return s1
  }
}

/**
 * OR two results. Return set union of results
 * @param {Set} nodes input to match against
 * @param {Object} a1
 * @param {Object} a2
 * @returns union of results from a1 and a2
 */
function orSearch (nodes, a1, a2) {
  let s1 = vqlEval(nodes, a1)
  let s2 = vqlEval(nodes, a2)
  return new Set([...s1, ...s2])
}

/**
 * Children of matches to 't1' filtered by 't2'
 * @param {Set} nodes input to match against
 * @param {Object} t1 'parents' are defined by this term
 * @param {Object} t2 'children' are filtered by this term
 * @returns {Set} Filtered set of children
 */
function coSearch (nodes, t1, t2) {
  let parents = vqlEval(nodes, t1)
  return vqlEval(oreqm.getDescendants(parents), t2)
}

/**
 * Ancestors of matches to 't1' filtered by 't2'
 * @param {Set} nodes input to match against
 * @param {Object} t1 'children' are defined by this term
 * @param {Object} t2 'ancestors' are filtered by this term
 * @returns {Set} Filtered set of ancestors
 */
function aoSearch (nodes, t1, t2) {
  let children = vqlEval(nodes, t1)
  let ancestors = oreqm.getAncestorsSet(children)
  return vqlEval(ancestors, t2)
}

/**
 * Parents of matches to 't1' filtered by 't2'
 * @param {Set} nodes input to match against
 * @param {Object} t1 'children' are defined by this term
 * @param {Object} t2 'parents' are filtered by this term
 * @returns {Set} Filtered set of ancestors
 */
 function paSearch (nodes, t1, t2) {
  let children = vqlEval(nodes, t1)
  let parents = oreqm.getParentsSet(children)
  return vqlEval(parents, t2)
}

/**
 * Children of matches to 't1' filtered by 't2'
 * @param {Set} nodes input to match against
 * @param {Object} t1 'current nodes (parents)' are defined by this term
 * @param {Object} t2 'children' are filtered by this term
 * @returns {Set} Filtered set of ancestors
 */
 function chSearch (nodes, t1, t2) {
  let children = vqlEval(nodes, t1)
  let parents = oreqm.getChildrenSet(children)
  return vqlEval(parents, t2)
}

/**
 * Find nodes matching regex
 * @param {Set} nodes set to search in
 * @param {Object} ast the 'd' object with one or more regex
 * @returns {Set} the set of matching nodes
 */
function dSearch (nodes, ast) {
  let regex
  if ((ast.q.length > 1) && (ast.v.length > 1)) {
    // Sort array according to tag order and construct combined regex
    let st = orderTags(ast.v)
    regex = st.join('.*')
  } else {
    regex = tagPrefixHandling(ast.v)[0]
  }
  //console.log(`dSearch ${regex}`)
  return oreqm.findReqsFromSet(nodes, regex)
}

/**
 * Return a list of tagged entries sorted according to defined order of appearance in search string
 * @param {Array} tags array of tagged search entries
 * @returns {Array} sorted entries
 */
function orderTags (tags) {
  let taggedArray = []
  //console.log(tags)
  let newTags = tagPrefixHandling(tags)
  //console.log(newTags)
  for (let t of newTags) {
    let tagMatch = t.match(/^:?([a-z]{2,3}):/)
    taggedArray.push({t: tagMatch[1], v: t})
  }
  taggedArray.sort((a, b) => (searchTagOrder.get(a.t) > searchTagOrder.get(b.t) ? 1 : -1))
  //console.log(taggedArray)
  let res = []
  for (let t of taggedArray) {
    res.push(t.v)
  }
  return res
}

/**
 * Handle prefix pattern (or not) for tags with prefix marker '¤'
 * Insert '.*' between tag on reset based on these rules
 * if 1st char after tag is '*', insert '.*'
 * if first char after tag is '^' do NOT insert '.*'
 * otherwise insert '.*' if searchTags[tag].freetext is true
 *
 * The shorthand '*' and '^' and the defaults get transformed into
 * a proper regex expression
 *
 * @param {Array} tags an array of tags
 * @returns Array of modified tags
 */
function tagPrefixHandling (tags) {
  let result = []
  for (let tag of tags) {
    let tagMatch = tag.match(/^:?([a-z]{2,3}):¤(.)(.*)/)
    //                            1             2  3
    if (tagMatch) {
      let tagId = tagMatch[1]
      let restOfTag = tagMatch[2]+tagMatch[3]
      let stRec = searchTagsLookup(tagId)
      let freeText = stRec ? stRec.freetext : false
      if (tagMatch[2] === '*') {
        restOfTag = tagMatch[3]
        freeText = true
      } else if (tagMatch[2] === '^') {
        restOfTag = tagMatch[3]
        freeText = false
      }
      let newTag = `${tagMatch[1]}:${freeText?'.*':''}${restOfTag}`
      //console.log(newTag)
      result.push(newTag)
    } else {
      result.push(tag)
    }
  }
  return result
}