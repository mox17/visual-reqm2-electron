// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

// Escape all regex meta-characters
function esc_str (str) {
  return str.replaceAll('\\', '\\\\')
            .replaceAll('^', '\\^')
            //.replaceAll('$', '\\$') // we may want to use $ to mark end of COAT ids
            .replaceAll('*', '\\*')
            .replaceAll('+', '\\+')
            .replaceAll('?', '\\?')
            .replaceAll('.', '\\.')
            .replaceAll('(', '\\(')
            .replaceAll(')', '\\)')
            .replaceAll('{', '\\{')
            .replaceAll('}', '\\}')
            .replaceAll('[', '\\[')
            .replaceAll(']', '\\]')
}

// Filter out illegal search patterns
function check_and_or (s) {
  let t = s.toUpperCase()
  let reserved = ['AND', 'OR', 'NOT', '(', ')', ','].includes(t) ||
                 s.startsWith('ao(') ||
                 s.startsWith('co(') ||
                 s.startsWith('ancestors_of(') ||
                 s.startsWith('children_of(')
  return reserved
}

// Check for qualifier and if found add regex logic to match pattern *within* section
// by using the tag terminators of /tag/
// return object {q: [qualifiers], v: [(modified) regex match] }
function qualifier  (str, find_substring) {
  // A tag is 2 or three letters, colon separated from pattern
  let m = str.match(/^(:?([a-z]{2,3}):)(.*)/)
  // groups           1  2             3
  if (m) {
    if (find_substring) {
      // the ¤ marker is replaced in vql-search with appropriate regex (or nothing)
      // It is used to insert '.*' for fields with free format text in later processing
      let marker = m[3].length ? '¤' : ''
      return {q: [`${m[2]}:`], v: `${m[1]}${marker}${m[3]}.*^/${m[2]}/`}
    } else {
      return {q: [`${m[2]}:`], v: `${m[1]}${m[3]}`}
    }
  } else {
    return {q: [], v: str }
  }
}

function check_ao_co (s) {
  if (s === 'ancestors_of') return 'ao'
  if (s === 'children_of') return 'co'
  return s
}

// return true if tags already defined in f and s tag not already present in f
function check_dup_tag(f, s) {
  return (! f.includes(s[0])) && f.length
}

// This is an optimization to enable combination of tagged terms into one regex
// This requires that each tag only occurs once
function check_and (f, s) {
  if (f.q && s.q && check_dup_tag(f.q, s.q)) {
    return {op: 'd', q: f.q.concat(s.q), v: f.v.concat(s.v) }
  } else {
    return {op: "AND", arg1: f, arg2: s }
  }
}

var grammar = {
    Lexer: undefined,
    ParserRules: [
    {"name": "_$ebnf$1", "symbols": []},
    {"name": "_$ebnf$1", "symbols": ["_$ebnf$1", "wschar"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "_", "symbols": ["_$ebnf$1"], "postprocess": function(d) {return null;}},
    {"name": "__$ebnf$1", "symbols": ["wschar"]},
    {"name": "__$ebnf$1", "symbols": ["__$ebnf$1", "wschar"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "__", "symbols": ["__$ebnf$1"], "postprocess": function(d) {return null;}},
    {"name": "wschar", "symbols": [/[ \t\n\v\f]/], "postprocess": id},
    {"name": "result", "symbols": ["_", "or_term", "_"], "postprocess": (d) => { return d[1] }},
    {"name": "or_term", "symbols": ["and_term"], "postprocess": id},
    {"name": "or_term$subexpression$1", "symbols": [/[oO]/, /[rR]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "or_term", "symbols": ["and_term", "__", "or_term$subexpression$1", "__", "or_term"], "postprocess": (d) => { return {op: "OR", arg1: d[0], arg2: d[4] } }},
    {"name": "and_term", "symbols": ["not_term"], "postprocess": id},
    {"name": "and_term$ebnf$1$subexpression$1$subexpression$1", "symbols": [/[aA]/, /[nN]/, /[dD]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "and_term$ebnf$1$subexpression$1", "symbols": ["and_term$ebnf$1$subexpression$1$subexpression$1", "__"]},
    {"name": "and_term$ebnf$1", "symbols": ["and_term$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "and_term$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "and_term", "symbols": ["and_term", "__", "and_term$ebnf$1", "not_term"], "postprocess": (d) => { return check_and(d[0], d[3]) }},
    {"name": "not_term$subexpression$1", "symbols": [/[nN]/, /[oO]/, /[tT]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "not_term", "symbols": ["not_term$subexpression$1", "__", "term"], "postprocess": (d) => { return {op: "NOT", arg: d[2] } }},
    {"name": "not_term", "symbols": ["term"], "postprocess": id},
    {"name": "term$subexpression$1$string$1", "symbols": [{"literal":"a"}, {"literal":"o"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "term$subexpression$1", "symbols": ["term$subexpression$1$string$1"]},
    {"name": "term$subexpression$1$string$2", "symbols": [{"literal":"c"}, {"literal":"o"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "term$subexpression$1", "symbols": ["term$subexpression$1$string$2"]},
    {"name": "term$subexpression$1$string$3", "symbols": [{"literal":"c"}, {"literal":"h"}, {"literal":"i"}, {"literal":"l"}, {"literal":"d"}, {"literal":"r"}, {"literal":"e"}, {"literal":"n"}, {"literal":"_"}, {"literal":"o"}, {"literal":"f"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "term$subexpression$1", "symbols": ["term$subexpression$1$string$3"]},
    {"name": "term$subexpression$1$string$4", "symbols": [{"literal":"a"}, {"literal":"n"}, {"literal":"c"}, {"literal":"e"}, {"literal":"s"}, {"literal":"t"}, {"literal":"o"}, {"literal":"r"}, {"literal":"s"}, {"literal":"_"}, {"literal":"o"}, {"literal":"f"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "term$subexpression$1", "symbols": ["term$subexpression$1$string$4"]},
    {"name": "term", "symbols": ["term$subexpression$1", "_", {"literal":"("}, "_", "or_term", "_", {"literal":","}, "_", "or_term", "_", {"literal":")"}], "postprocess": 
        (d) => { return {op: `${check_ao_co(d[0].join(""))}`, arg1: d[4], arg2: d[8] } }
                                                                    },
    {"name": "term", "symbols": ["patt"], "postprocess":  (d) => {
          let q_v = qualifier(d[0].v, d[0].t)
          return {op: 'd', q: q_v.q, v: [q_v.v] }
        } },
    {"name": "term", "symbols": [{"literal":"("}, "__", "or_term", "__", {"literal":")"}], "postprocess": (d) => { return d[2] }},
    {"name": "patt$ebnf$1", "symbols": [/[\S]/]},
    {"name": "patt$ebnf$1", "symbols": ["patt$ebnf$1", /[\S]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "patt", "symbols": [{"literal":"@"}, "patt$ebnf$1"], "postprocess": (d) => { return { v: esc_str(d[1].join("")), t: false } }},
    {"name": "patt$ebnf$2", "symbols": []},
    {"name": "patt$ebnf$2", "symbols": ["patt$ebnf$2", /[\S]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "patt", "symbols": [/[^@\s]/, "patt$ebnf$2"], "postprocess":  (d, l, reject) => {
          let str = d[0]+d[1].join("");
          if (check_and_or(str)) {
            return reject
          } else {
            return { v: str, t: true }
          }
        } }
]
  , ParserStart: "result"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
