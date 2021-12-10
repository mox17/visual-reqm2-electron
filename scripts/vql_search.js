const nearley = require('nearley')
const grammar = require('./vql-parser.js')
import {search_tag_order} from './reqm2oreqm'
import {oreqm_main} from './main_data.js'
import { remote } from 'electron'
/**
 * Parse a VQL expression and evaluate it
 * @param {String} sc Search criteria string (in VQL)
 * @returns {Object} AST of parsed VQL exxpression
 */
export function vql_parse (sc) {
  let ans
  try {
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
    ans = parser.feed(sc)
  } catch (e) {
    console.log(e)
    //var error_out = `Error offset ${e.offset} chars into\n${sc}`
    let msg = e.message.replace(/Instead.*/msg, '')
    remote.dialog.showErrorBox("VQL parsing error", msg)
    //alert(e.message)
    return null
  }
  // Check if there are any results
  if (ans.results.length) {
    console.log(ans.results)
    if (ans.results.length > 1) {
      alert('Ambiguous result')
    }
    return vql_eval_root(ans.results[0])
  } else {
    // This means the input is incomplete.
    var out = 'Error: incomplete input, parse failed.'
    console.log(out)
    alert(out)
    return null
  }
}

/**
 * Evaluate a VQL query against a oreqm object
 * @param {Object} search_ast a parse object from search expression
 * @returns {Set} Matching specobject ids
 */
export function vql_eval_root (search_ast) {
  let initial_set = oreqm_main.get_all_ids()
  return vql_eval(initial_set, search_ast)
}

/**
 * Visual ReqM2 Query language search
 * @param {Set} input_nodes list of keys (specobject ids)
 * @param {Object} search_ast Parse tree of search expression
 *
 * @returns {Set} set of matching keys (specobject ids)
 */
function vql_eval (input_nodes, search_ast) {
  switch (search_ast.op) {
    case 'AND':
      return and_search(input_nodes, search_ast.arg1, search_ast.arg2)
    case 'OR':
      return or_search(input_nodes, search_ast.arg1, search_ast.arg2)
    case 'co':
      return co_search(input_nodes, search_ast.arg1, search_ast.arg2)
    case 'ao':
      return ao_search(input_nodes, search_ast.arg1, search_ast.arg2)
    case 'd':
      return d_search(input_nodes, search_ast)
    case 'NOT': {
      let s1 = vql_eval(input_nodes, search_ast.arg)
      // return complementary set
      return new Set([...input_nodes].filter((x) => !s1.has(x)))
    }
    default:
      console.log(`vql_search op error ${search_ast}`)
      return new Set()
  }
}

/**
 * AND two results. Return intersection
 * @param {Set} nodes input to match against
 * @param {Object} a1
 * @param {Object} a2
 * @returns {Set} intersection between results from a1 and a2
 */
function and_search (nodes, a1, a2) {
  // const results = oreqm_main.find_reqs_from_set (ids, regex)
  let s1 = vql_eval(nodes, a1)
  if (s1.size) {
    // Only evaluate a2 if a1 returned non-empty set
    let s2 = vql_eval(nodes, a2)
    return new Set([...s1].filter(x => s2.has(x)))
  } else {
    return s1
  }
}

/**
 * OR two results. Return union of results
 * @param {Set} nodes input to match against
 * @param {Object} a1
 * @param {Object} a2
 * @returns union of results from a1 and a2
 */
function or_search (nodes, a1, a2) {
  let s1 = vql_eval(nodes, a1)
  let s2 = vql_eval(nodes, a2)
  return new Set([...s1, ...s2])
}

/**
 * Children of matches to 't1' filtered by 't2'
 * @param {Set} nodes input to match against
 * @param {Object} t1 'parents' are defined by this term
 * @param {Object} t2 'children' are filtered by this term
 * @returns {Set} Filtered set of children
 */
function co_search (nodes, t1, t2) {
  let parents = vql_eval(nodes, t1)
  return vql_eval(oreqm_main.get_children(parents), t2)
}

/**
 * Ancestors of matches to 't1' filtered by 't2'
 * @param {Set} nodes input to match against
 * @param {Object} t1 'children' are defined by this term
 * @param {Object} t2 'ancestors' are filtered by this term
 * @returns {Set} Filtered set of ancestors
 */
function ao_search (nodes, t1, t2) {
  let children = vql_eval(nodes, t1)
  let ancestors = oreqm_main.get_ancestors_set(children)
  return vql_eval(ancestors, t2)
}

/**
 * Find nodes matching regex
 * @param {Set} nodes set to search in
 * @param {Object} ast the 'd' object with one or more regex
 * @returns {Set} the set of matching nodes
 */
function d_search (nodes, ast) {
  let regex
  if (ast.q && ast.v.length > 1) {
    // Sort array according to tag order and construct combined regex
    let st = order_tags(ast.v)
    regex = st.join('.*')
  } else {
    regex = ast.v[0]
  }
  console.log(`d_search ${regex}`)
  return oreqm_main.find_reqs_from_set(nodes, regex)
}

/**
 * Return a list of tagged entries sorted according to defined order of appearance in search string
 * @param {Array} tags array of tagged search entries
 * @returns {Array} sorted entries
 */
function order_tags (tags) {
  let tagged_array = []
  for (let t of tags) {
    let tag_match = t.match(/^[a-z]{2,3}:/)
    tagged_array.push({t: tag_match[0], v: t})
  }
  tagged_array.sort((a, b) => (search_tag_order.get(a.t) > search_tag_order.get(b.t) ? 1 : -1))
  let res = []
  for (let t of tagged_array) {
    res.push(t.v)
  }
  return res
}
