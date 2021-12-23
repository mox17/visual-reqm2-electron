const nearley = require('nearley')
const grammar = require('./vql-parser.js')
import {search_tags, search_tag_order, search_tags_lookup} from './reqm2oreqm'
import {oreqm_main} from './main_data.js'
import { get_time_now, get_delta_time, log_time_spent } from './util.js'

/**
 * Parse a VQL expression and evaluate it.
 * @param {String} sc Search criteria string (in VQL)
 * @returns {Object} AST of parsed VQL expression
 */
export function vql_parse (sc) {
  let ans
  try {
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
    ans = parser.feed(sc)
  } catch (e) {
    //console.log(e)
    //var error_out = `Error offset ${e.offset} chars into\n${sc}`
    //let msg = e.message.replace(/xxInstead.*/msg, '')
    return null
  }
  // Check if there are any results
  if (ans.results.length) {
    return vql_eval_root(ans.results[0])
  } else {
    // This means the input is incomplete.
    return null
  }
}

/**
 * Validate VQL input
 * @param {string} sc VQL string to check
 * @returns null if OK, string with error if problem found
 */
export function vql_validate (sc) {
  let ans
  try {
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
    ans = parser.feed(sc)
  } catch (e) {
    console.log(e)
    let msg = e.message.replace(/Instead.*/msg, '')
    msg = msg.replace(/\n/msg, '<br>').replace(/ /msg, '&nbsp;')
    return msg
  }
  // Check if there are any results
  if (ans.results.length) {
    console.log(ans.results)
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
 * @param {Object} search_ast a parse object from search expression
 * @returns {Set} Matching specobject ids
 */
export function vql_eval_root (search_ast) {
  let initial_set = oreqm_main.get_all_ids()
  const now = get_time_now()
  const res = vql_eval(initial_set, search_ast)
  log_time_spent(now, "vql_eval_root")
  return res
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
 * AND two results. Return set intersection
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
 * OR two results. Return set union of results
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
  if ((ast.q.length > 1) && (ast.v.length > 1)) {
    // Sort array according to tag order and construct combined regex
    let st = order_tags(ast.v)
    regex = st.join('.*')
  } else {
    regex = tag_prefix_handling(ast.v)[0]
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
  console.log(tags)
  let new_tags = tag_prefix_handling(tags)
  console.log(new_tags)
  for (let t of new_tags) {
    let tag_match = t.match(/^:?([a-z]{2,3}):/)
    tagged_array.push({t: tag_match[1], v: t})
  }
  console.log(search_tag_order)
  tagged_array.sort((a, b) => (search_tag_order.get(a.t) > search_tag_order.get(b.t) ? 1 : -1))
  console.log(tagged_array)
  let res = []
  for (let t of tagged_array) {
    res.push(t.v)
  }
  return res
}

/**
 * Handle profix pattern (or not) for tags with prefix marker '¤'
 * Insert '.*' between tag on reset based on these rules
 * if 1st char after tag is '*', insert '.*'
 * if first char after tag is '^' do NOT insert '.*'
 * otherwise insert '.*' if search_tags[tag].freetext is true
 *
 * The shorthand '*' and '^' and the defaults get transformed into
 * a proper regex expression
 *
 * @param {Array} tags an array of tags
 * @returns Array of modified tags
 */
function tag_prefix_handling (tags) {
  let result = []
  for (let tag of tags) {
    let tag_match = tag.match(/^:?([a-z]{2,3}):¤(.)(.*)/)
    //                            1             2  3
    if (tag_match) {
      let tag_id = tag_match[1]
      let rest_of_tag = tag_match[2]+tag_match[3]
      let st_rec = search_tags_lookup(tag_id)
      let free_text = st_rec ? st_rec.freetext : false
      if (tag_match[2] === '*') {
        rest_of_tag = tag_match[3]
        free_text = true
      } else if (tag_match[2] === '^') {
        rest_of_tag = tag_match[3]
        free_text = false
      }
      let new_tag = `${tag_match[1]}:${free_text?'.*':''}${rest_of_tag}`
      console.log(new_tag)
      result.push(new_tag)
    } else {
      result.push(tag)
    }
  }
  return result
}