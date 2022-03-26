@builtin "whitespace.ne" # `_` means arbitrary amount of whitespace

@{%
// Escape all regex meta-characters
function escStr (str) {
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
function checkAndOr (s) {
  let t = s.toUpperCase()
  let reserved = ['AND', 'OR', 'NOT', '(', ')', ','].includes(t) ||
                 s.startsWith('an(') ||
                 s.startsWith('ancestors_of(') ||
                 s.startsWith('ancestors(') ||
                 s.startsWith('ao(') ||
                 s.startsWith('ch(') ||
                 s.startsWith('children_of(') ||
                 s.startsWith('children(') ||
                 s.startsWith('co(') ||
                 s.startsWith('de(') ||
                 s.startsWith('decendants(') ||
                 s.startsWith('pa(') ||
                 s.startsWith('parents(')
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
      // the ¤ marker is replaced in module vql-search with the appropriate regex (or nothing)
      // It is used to insert '.*' for fields with free format text in later processing
      // The default for free format is defined in a table and can be overridden by '^' and '*'
      // as 1st character after tag.
      let marker = m[3].length ? '¤' : ''
      return {q: [`${m[2]}:`], v: `${m[1]}${marker}${m[3]}.*^/${m[2]}/`}
    } else {
      return {q: [`${m[2]}:`], v: `${m[1]}${m[3]}`}
    }
  } else {
    return {q: [], v: str }
  }
}

function checkAoCo (s) {
  if (s === 'ancestors_of') return 'ao'
  if (s === 'ancestors') return 'an'
  if (s === 'children_of') return 'co'
  if (s === 'children') return 'ch'
  if (s === 'descendants') return 'de'|
  if (s === 'parents') return 'pa'
  return s
}

// return true if tags already defined in f and s tag not already present in f
function checkDupTag(f, s) {
  return (! f.includes(s[0])) && f.length
}

// This is an optimization to enable combination of tagged terms into one regex
// This requires that each tag only occurs once
function checkAnd (f, s) {
  if (f.q && f.q.length && s.q && s.q.length && checkDupTag(f.q, s.q)) {
    return {op: 'd', q: f.q.concat(s.q), v: f.v.concat(s.v) }
  } else {
    return {op: "AND", arg1: f, arg2: s }
  }
}

%}

# Grammar Rules                                             Semantic actions
# Allow leading and trailing whitespace
result -> _ or_term _                                       {% (d) => { return d[1] } %}

or_term -> and_term                                         {% id %}
         | and_term __ "OR"i __ or_term                     {% (d) => { return {op: "OR", arg1: d[0], arg2: d[4] } } %}

# the 'and' operator is optional
and_term -> not_term                                        {% id %}
          | and_term __ ( "AND"i __ ):? not_term            {% (d) => { return checkAnd(d[0], d[3]) } %}

not_term -> "NOT"i __ term                                  {% (d) => { return {op: "NOT", arg: d[2] } } %}
          | term                                            {% id %}

# Simple function concept ancestors_of and children_of to give a subset of nodes for second search term
# TODO: clean up this with extra rule
term -> ("ao"|"co"|"ch"|"pa"|"de"|"an"|
         "children_of"|"ancestors_of"|"children"|
         "parents"|"descendants"|"ancestors") _ "(" _ or_term _ "," _ or_term _ ")"
                                                            {%
                                                              (d) => { return {op: `${checkAoCo(d[0].join(""))}`, arg1: d[4], arg2: d[8] } }
                                                            %}
      | patt                                                {% (d) => {
                                                              let q_v = qualifier(d[0].v, d[0].t)
                                                              return {op: 'd', q: q_v.q, v: [q_v.v] }
                                                            } %}
      | "(" __ or_term __ ")"                               {% (d) => { return d[2] } %}

# '@' prefixed strings escapes all regex metacharacters
patt -> "@" [\S]:+                                          {% (d) => { return { v: escStr(d[1].join("")), t: false } } %}
patt -> "\"" [^"]:+ "\""                                    {% (d) => { return { v: d[1].join(""), t: true } }  %}
patt -> "'" [^']:+ "'"                                      {% (d) => { return { v: d[1].join(""), t: true } }  %}
      # 'and' and 'or' are not valid patterns, prefix with '@' if really needed
patt -> [^@"'\s] [\S]:*                                     {% (d, l, reject) => {
                                                              let str = d[0]+d[1].join("");
                                                              if (checkAndOr(str)) {
                                                                return reject
                                                              } else {
                                                                return { v: str, t: true }
                                                              }
                                                            } %}
