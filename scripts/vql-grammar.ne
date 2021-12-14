@builtin "whitespace.ne" # `_` means arbitrary amount of whitespace

@{%
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
function qualifier  (s) {
  // A tag is 2 or three letters, colon separated from pattern
  let m = s.match(/^(:?([a-z]{2,3}):)(.*)/)
  // groups         1  2             3
  if (m) {
    return {q: [`${m[2]}:`], v: `${m[1]}.*${m[3]}.*^/${m[2]}/`}
  } else {
    return {q: [], v: s }
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

%}

# Grammar Rules                                             Semantic actions
# Allow leading and trailing whitespace
result -> _ or_term _                                       {% (d) => { return d[1] } %}

or_term -> and_term                                         {% id %}
         | and_term __ "OR"i __ or_term                     {% (d) => { return {op: "OR", arg1: d[0], arg2: d[4] } } %}

# the 'and' operator is optional
and_term -> not_term                                        {% id %}
          | and_term __ ( "AND"i __ ):? not_term            {% (d) => { return check_and(d[0], d[3]) } %}

not_term -> "NOT"i __ term                                  {% (d) => { return {op: "NOT", arg: d[2] } } %}
          | term                                            {% id %}

# Simple function concept ancestors_of and children_of to give a subset of nodes for second search term
term -> ("ao"|"co"|"children_of"|"ancestors_of") _ "(" _ or_term _ "," _ or_term _ ")"
                                                            {%
                                                              (d) => { return {op: `${check_ao_co(d[0].join(""))}`, arg1: d[4], arg2: d[8] } }
                                                            %}
      | patt                                                {% (d) => {
                                                              let q_v = qualifier(d[0])
                                                              return {op: 'd', q: q_v.q, v: [q_v.v] }
                                                            } %}
      | "(" __ or_term __ ")"                               {% (d) => { return d[2] } %}

# '@' prefixed strings escapes all regex metacharacters
patt -> "@" [\S]:+                                          {% (d) => { return esc_str(d[1].join("")) } %}
      # 'and' and 'or' are not valid patterns, prefix with '@' if really needed
patt -> [^@\s] [\S]:*                                       {% (d, l, reject) => {
                                                              let str = d[0]+d[1].join("");
                                                              if (check_and_or(str)) {
                                                                return reject
                                                              } else {
                                                                return str
                                                              }
                                                            } %}
