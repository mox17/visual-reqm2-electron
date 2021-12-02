const nearley = require("nearley");
const grammar = require("./vql-parser.js");
import {search_tag_order} from './reqm2oreqm'


export function parse_search_criteria(sc) {
    let ans
    try {
        const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
        ans = parser.feed(sc);
        // Check if there are any results
        if (ans.results.length) {
            console.log(ans.results[0])
            return ans.results[0].toString();
        } else {
            // This means the input is incomplete.
            var out = "Error: incomplete input, parse failed. :(";
            return out;
        }
    } catch(e) {
        var error_out = `Error offset ${e.offset} chars into\n${sc}`
        return error_out;
    }
}


/**
 * Visual ReqM2 Query language search
 * @param {Set} input_nodes list of keys (specobject ids)
 * @param {Object} search_tree Parse tree of search expression
 * 
 * @returns {Set} set of matching keys (specobject ids)
 */
export function vql_search(input_nodes, search_obj) {
    switch (search_obj.op) {
        case 'AND':
            return and_search(input_nodes, search_obj.arg1, search_obj.arg2)
        case 'OR':
            return or_search(input_nodes, search_obj.arg1, search_obj.arg2)
        case 'co':
            return co_search(input_nodes, search_obj.arg1, search_obj.arg2)
        case 'ao':
            return co_search(input_nodes, search_obj.arg1, search_obj.arg2)
        case 'd':
            return d_search(input_nodes, search_obj.q, search_obj.v )
        }
}

function and_search(nodes, a1, a2) {
    if (a1.op === 'd' && a2.op === 'd') {
      let aa = order_tags(a1, a2)


    }
}

/**
 * 
 * @param {Object} a1 firt argument
 * @param {Object} a2 Second argument
 */
function order_tags(a1, a2) {
    let res = [a1, a2]
    if (search_tag_order.has(a1.q) && search_tag_order.has(a2.q)) {
        if (search_tag_order.get(a1.q) > search_tag_order.get(a2.q)) {
            // Swap args based on tag order
            res = [a2, a1]
        }
    }
    return res
}