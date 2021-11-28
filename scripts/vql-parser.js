// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }
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
    {"name": "dqstring$ebnf$1", "symbols": []},
    {"name": "dqstring$ebnf$1", "symbols": ["dqstring$ebnf$1", "dstrchar"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "dqstring", "symbols": [{"literal":"\""}, "dqstring$ebnf$1", {"literal":"\""}], "postprocess": function(d) {return d[1].join(""); }},
    {"name": "sqstring$ebnf$1", "symbols": []},
    {"name": "sqstring$ebnf$1", "symbols": ["sqstring$ebnf$1", "sstrchar"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "sqstring", "symbols": [{"literal":"'"}, "sqstring$ebnf$1", {"literal":"'"}], "postprocess": function(d) {return d[1].join(""); }},
    {"name": "btstring$ebnf$1", "symbols": []},
    {"name": "btstring$ebnf$1", "symbols": ["btstring$ebnf$1", /[^`]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "btstring", "symbols": [{"literal":"`"}, "btstring$ebnf$1", {"literal":"`"}], "postprocess": function(d) {return d[1].join(""); }},
    {"name": "dstrchar", "symbols": [/[^\\"\n]/], "postprocess": id},
    {"name": "dstrchar", "symbols": [{"literal":"\\"}, "strescape"], "postprocess": 
        function(d) {
            return JSON.parse("\""+d.join("")+"\"");
        }
        },
    {"name": "sstrchar", "symbols": [/[^\\'\n]/], "postprocess": id},
    {"name": "sstrchar", "symbols": [{"literal":"\\"}, "strescape"], "postprocess": function(d) { return JSON.parse("\""+d.join("")+"\""); }},
    {"name": "sstrchar$string$1", "symbols": [{"literal":"\\"}, {"literal":"'"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "sstrchar", "symbols": ["sstrchar$string$1"], "postprocess": function(d) {return "'"; }},
    {"name": "strescape", "symbols": [/["\\/bfnrt]/], "postprocess": id},
    {"name": "strescape", "symbols": [{"literal":"u"}, /[a-fA-F0-9]/, /[a-fA-F0-9]/, /[a-fA-F0-9]/, /[a-fA-F0-9]/], "postprocess": 
        function(d) {
            return d.join("");
        }
        },
    {"name": "or_term", "symbols": ["and_term"], "postprocess": id},
    {"name": "or_term$subexpression$1", "symbols": [/[oO]/, /[rR]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "or_term", "symbols": ["and_term", "__", "or_term$subexpression$1", "__", "or_term"], "postprocess": (d) => { return {op: "OR", arg1: d[0], arg2: d[4]} }},
    {"name": "and_term", "symbols": ["term"], "postprocess": id},
    {"name": "and_term$subexpression$1", "symbols": [/[aA]/, /[nN]/, /[dD]/], "postprocess": function(d) {return d.join(""); }},
    {"name": "and_term", "symbols": ["term", "__", "and_term$subexpression$1", "__", "and_term"], "postprocess": (d) => { return {op: "AND", arg1: d[0], arg2: d[4]} }},
    {"name": "term$subexpression$1$string$1", "symbols": [{"literal":"a"}, {"literal":"o"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "term$subexpression$1", "symbols": ["term$subexpression$1$string$1"]},
    {"name": "term$subexpression$1$string$2", "symbols": [{"literal":"c"}, {"literal":"o"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "term$subexpression$1", "symbols": ["term$subexpression$1$string$2"]},
    {"name": "term", "symbols": ["term$subexpression$1", "_", {"literal":"("}, "_", "or_term", "_", {"literal":","}, "_", "or_term", "_", {"literal":")"}], "postprocess": (d) => { return {op: `${d[0].join("")}`, arg1: d[4], arg2: d[8] } }},
    {"name": "term$ebnf$1", "symbols": ["qual"], "postprocess": id},
    {"name": "term$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "term", "symbols": ["term$ebnf$1", "_", "patt"], "postprocess": (d) => { return {op: 'd', q: d[0] ? d[0] : '', v: d[2] } }},
    {"name": "term", "symbols": [{"literal":"("}, "__", "or_term", "__", {"literal":")"}], "postprocess": (d) => { return d[2] }},
    {"name": "qual", "symbols": [/[a-z]/, /[a-z]/, {"literal":":"}], "postprocess": (d) => { return d[0]+d[1]+":" }},
    {"name": "qual", "symbols": [/[a-z]/, /[a-z]/, /[a-z]/, {"literal":":"}], "postprocess": (d) => { return d[0]+d[1]+d[2]+":" }},
    {"name": "patt", "symbols": ["dqstring"], "postprocess": id},
    {"name": "patt", "symbols": ["sqstring"], "postprocess": id},
    {"name": "patt", "symbols": ["rawdqstring"], "postprocess": id},
    {"name": "patt", "symbols": ["rawsqstring"], "postprocess": id},
    {"name": "rawdqstring$string$1", "symbols": [{"literal":"r"}, {"literal":"\""}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "rawdqstring$ebnf$1", "symbols": []},
    {"name": "rawdqstring$ebnf$1", "symbols": ["rawdqstring$ebnf$1", "rawdstrchar"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "rawdqstring", "symbols": ["rawdqstring$string$1", "rawdqstring$ebnf$1", {"literal":"\""}], "postprocess": (d) => {return d[1].join(""); }},
    {"name": "rawdstrchar", "symbols": [/[^"\n]/], "postprocess": id},
    {"name": "rawsqstring$string$1", "symbols": [{"literal":"r"}, {"literal":"'"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "rawsqstring$ebnf$1", "symbols": []},
    {"name": "rawsqstring$ebnf$1", "symbols": ["rawsqstring$ebnf$1", "rawsstrchar"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "rawsqstring", "symbols": ["rawsqstring$string$1", "rawsqstring$ebnf$1", {"literal":"'"}], "postprocess": (d) => {return d[1].join(""); }},
    {"name": "rawsstrchar", "symbols": [/[^'\n]/], "postprocess": id}
]
  , ParserStart: "or_term"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
