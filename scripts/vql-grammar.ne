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
	let reserved = ['AND', 'OR', '(', ')'].includes(t) || t.startsWith('AO(') || t.startsWith('CO(')
  return reserved
}

function qualifier(s) {
  let m = s.match(/^[a-z]{2,3}:/)
  return m ? m[0] : ''
}

%}

# Allow leading and trailing whitespace
result -> _ or_term _                                      {% (d) => { return d[1] } %}

or_term -> and_term                                        {% id %}
         | and_term __ "OR"i __ or_term                    {% (d) => { return {op: "OR", args: [d[0], d[4]] } } %}

# the 'and' operator is optional
and_term -> term                                           {% id %}
          | and_term __ ( "AND"i __ ):? term               {% (d) => { return {op: "AND", args: [d[0], d[3]] } } %}

# Simple function concept ancestors_of and children_of to give a subset of nodes for second search term
term -> ("ao"|"co") _ "(" _ or_term _ "," _ or_term _ ")"  {% (d) => { return {op: `${d[0].join("")}`, arg1: d[4], arg2: d[8] } } %}
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
