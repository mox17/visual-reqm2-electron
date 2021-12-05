@builtin "whitespace.ne" # `_` means arbitrary amount of whitespace

@{% 
// Escape all regex meta-characters
function esc_str(str) {
  return str.replaceAll('\\', '\\\\')
            .replaceAll('^', '\\^')
            .replaceAll('$', '\\$')
            .replaceAll('*', '\\*')
            .replaceAll('+', '\\+')
            .replaceAll('?', '\\?')
            .replaceAll('.', '\\.')
            .replaceAll('(', '\\(')
            .replaceAll('{', '\\{')
            .replaceAll('[', '\\[')
}

// Filter out illegal search patterns
function check_and_or(s) {
	let t = s.toUpperCase()
	let reserved = ['AND', 'OR', 'NOT', '(', ')'].includes(t) || 
                 s.startsWith('ao(') || 
                 s.startsWith('co(') ||
                 s.startsWith('ancestors_of(') || 
                 s.startsWith('children_of(')
  return reserved
}

function qualifier(s) {
  let m = s.match(/^[a-z]{2,3}:/)
  return m ? m[0] : ''
}

function check_ao_co(s) {
  if (s === 'ancestors_of') return 'ao'
  if (s === 'children_of') return 'co'
  return s
}

%}

# Allow leading and trailing whitespace
result -> _ or_term _                                      {% (d) => { return d[1] } %}

or_term -> and_term                                        {% id %}
         | and_term __ "OR"i __ or_term                    {% (d) => { return {op: "OR", args: [d[0], d[4]] } } %}

# the 'and' operator is optional
and_term -> not_term                                       {% id %}
          | and_term __ ( "AND"i __ ):? not_term           {% (d) => { return {op: "AND", args: [d[0], d[3]] } } %}

not_term -> "NOT"i __ term                                 {% (d) => { return {op: "NOT", arg: d[2] } } %}
          | term                                           {% id %}

# Simple function concept ancestors_of and children_of to give a subset of nodes for second search term
term -> ("ao"|"co"|"children_of"|"ancestors_of") _ "(" _ or_term _ "," _ or_term _ ")"  {% (d) => { return {op: `${check_ao_co(d[0].join(""))}`, arg1: d[4], arg2: d[8] } } %}
      | patt                                               {% (d) => { return {op: 'd', q: qualifier(d[0]), v: d[0] } } %}
      | "(" __ or_term __ ")"                              {% (d) => { return d[2] } %}

# '@' prefixed strings escapes all regex metacharacters
patt -> "@" [\S]:+                                         {% (d) => { return esc_str(d[1].join("")) } %}
      # 'and' and 'or' are not valid patterns, prefix with '@' if really needed
patt -> [^@\s] [\S]:*                                      {% (d, l, reject) => {
                                                             let str = d[0]+d[1].join(""); 
                                                             if (check_and_or(str)) {
                                                               return reject
                                                             } else {
                                                               return str
                                                             }
                                                           } %}
