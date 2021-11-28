@builtin "whitespace.ne" # `_` means arbitrary amount of whitespace
@builtin "string.ne"

or_term -> and_term                                        {% id %}
         | and_term __ "OR"i __ or_term                    {% (d) => { return {op: "OR", arg1: d[0], arg2: d[4]} } %}

and_term -> term                                           {% id %}
          | term __ "AND"i __ and_term                     {% (d) => { return {op: "AND", arg1: d[0], arg2: d[4]} } %}

# Simple function concept ancestors_of and children_of to give a subset of nodes for second search term
term -> ("ao"|"co") _ "(" _ or_term _ "," _ or_term _ ")"  {% (d) => { return {op: `${d[0].join("")}`, arg1: d[4], arg2: d[8] } } %}
      | qual:? _ patt                                      {% (d) => { return {op: 'd', q: d[0] ? d[0] : '', v: d[2] } } %}
	  | "(" __ or_term __ ")"                              {% (d) => { return d[2] } %}

qual -> [a-z] [a-z] ":"                                    {% (d) => { return d[0]+d[1]+":" } %}
qual -> [a-z] [a-z] [a-z] ":"                              {% (d) => { return d[0]+d[1]+d[2]+":" } %}

#patt -> [^"] [\S]:+                                       {% (d) => { return d[0]+d[1].join("") } %}
patt -> dqstring                                           {% id %}
patt -> sqstring                                           {% id %}
patt -> rawdqstring                                        {% id %}
patt -> rawsqstring                                        {% id %}

rawdqstring -> "r\"" rawdstrchar:* "\""                    {% (d) => {return d[1].join(""); } %}
rawdstrchar -> [^"\n]                                      {% id %}

rawsqstring -> "r'" rawsstrchar:* "'"                      {% (d) => {return d[1].join(""); } %}
rawsstrchar -> [^'\n]                                      {% id %}
