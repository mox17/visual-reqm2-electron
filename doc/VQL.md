# Visual ReqM2 Query Language (VQL)

## Introduction

When Visual ReqM2 is rendering a diagram, a selection of the specobjects of interest
is crucial to get a relevant diagram displayed.

A new selection method, called `Visual ReqM2 Query Language`, or `VQL` has been introduced.
It is one of three methods.
Depending on user feeback, the number of methods may be reduced in future releases.

| Method  | Description |
|:--------|:------------|
| \<id>   | A legacy method where the selection string is only matched against the \<id> field |
| Regex   | The common method used up to now. The selection is a [regular expression](https://www.w3schools.com/jsref/jsref_obj_regexp.asp), which is used to match against a tagged search string |
| VQL     | The new method described below. Simpler to use than Regular Expressions, but with features that make it more powerful |

How the selection text is interpreted is controlled by the radiobuttons below the input box.
There are 3 mutually exclusive choices \<id>, RegEx and VQL.

(Previously there was a checkbox choosing between \<id> and RegEx).

![image](selection-criteria-radiobuttons.png)

### Technology behind VQL

VQL is a small language with a formal grammar, a generated parser and an interpreter executing
searches based on the abstract syntax tree of the entered search term.

## Simple selection

A simple selection is to enter the `<id>` of the specobject in the **Selection criteria**
Notice that just one (1) node is selected. This is shown in the doctype table.

![image](selection-criteria-id-1.png)

It is also possible to select by simply entering words that occur in the relevant specobjects.
In below example the word `Meadow` occurs in two speobjects.

![image](selection-criteria-word-1.png)

If several words are specified, there is an implicit 'AND' between them, i.e. all words must
occur in the same specobject.
The 'AND' may also be spelled out, but is not necessary, as for example `meadow AND house`.
The order of the words does not matter for the final result.

The evaluation is from left-to-right, and subsequent test for `house` are only done on specobjects known to contain `meadow`.
This is a performance optimization and is in most cases not relevant to consider.

![image](selection-criteria-word-2.png)

### Scoping the selection to specific fields in specobject

Each specobject in Visual ReqM2 has an internal search string, where simple prefixes, derived from the XML schema,
prefix the various data items. Also a few synthesized attributes are present.

If you hover the mouse over the "Selection criteria" text, just over the input field, a tooltip will
appear with an overview of the available prefixes.

The curious can see the tagged search string for a specobject by right-clicking the specobject
and choosing `show search format`.

![image](selection-criteria-tooltip-vql.png)

So to search for a 'grate' which is NOT in a specobject of doctype `fea`, simply type

```
grate not dt:fea
```

This could also be written as

```
grate and not dt:fea
```

this is because the `and` operation is implied between terms.

Notice the RED outline (indicating what is selected) is only for the `swrs` object, not the `fea` object.

The `not` operator inverts the selection of `dt:fea` meaning **doctype** should be interpreted as any doctype BUT `fea`.

![image](selection-criteria-grate-not-dt-fea.png)

## Looking for space?

VQL search terms can be put inside single `'` or double `"` quotes. This allow spaces in the search
term itself.

Example:
```
"de:search with VQL's space support"
```
or

```
'de:search for "quoted" spaces " " '
```

But if a search string contains both `'`, `"` and space, then use regex syntax.



For example: match `"two quotes '" and spaces"` with

```
two\squotes\s'"\sand\sspaces
```

or match "separated by &nbsp;&nbsp;&nbsp;&nbsp;many spaces" with `separated\sby\s+many\sspaces`

Notice that an unquoted search term, i.e. not starting with either `'` or `"` can have any number
and combinations of `'` and `"` inside (but no literal spaces).

In VQL the actual space character is a separator between different search terms.
The fact that search terms not starting with `@` are interpreted as regular expressions, is used here.

# VQL free search term order

VQL allows free ordering of search terms. For example to look for **approved** **swad** requirements
mentioning **calibration** or **adjustment**.

You could write this in several different ways

| expression                                                 | comment |
|:-----------------------------------------------------------|:--------|
| `dt:swad AND st:approved AND calibration\|adjustment`      | Regex expressions are still supported **inside** VQL terms |
|`dt:swad AND st:approved AND ( calibration OR adjustment )` | Brackets/parentheses `(` `)` can be used to group terms, but remember to put spaces around them |
|`dt:swad st:approved ( calibration OR adjustment )`         | The `AND` operator is optional |
|`calibration\|adjustment st:approved dt:swad`               | Omitted `AND` and compact regex |
|`st:approved ( calibration or adjustment ) dt:swad`         | Order of terms is not important |

Notice that order does not matter.


# VQL operators

VQL support `AND` `OR` `NOT` operators and grouping with `(` `)`

Spaces are needed around the operators.

Additionally the hierarchical searches `children_of()` aka. `co()` and `ancestors_of()` aka. `ao()`
are available and have their own section below.

The operator hierarchy in descending order is: `NOT`, `AND`, `OR`. This is the same as in most
programming languages. Parentheses can be used to control evaluation order.

The `NOT` operator gives the complementary set. I.e. the nodes not matching the expression.
`NOT` can also be used in from of a bracketed search term like:

```
id:*maze not ( id:*6 or id:*8 )
```

The above would match specobjects with `maze` substring in the `<id>` and no occurences of
digits `6` or `8` in the `<id>`.

![image](selection-maze-not-6-8.png)

# Search terms

When we specify `dt:swrs` then we select the subset of specobjecs that have the `<doctype>` of `swrs`.
Additonal terms can be added, as in `st:approved dt:swrs`  to narrow the selection. There is an implied
`AND` betweeen the terms.

See [README.md search tags](../README.md#search-tags) for an overview of available tags.

A simple search term can be just a partial string which should match to the specobjects.

## Anchored sub-strings

When searching for a keyword expected in the `<description>` or any other **free text** field,
we want to match the word anywhere in the text. If we on the other hand want to match
`<version>1</version>`, written as `ve:1$`, we do not also want to match `<version>21</version>`
or `<version>217</version>`.
For fields with fixed content we typically want to anchor the match to the beginning.

Visual ReqM2 has a configured default for which fields have free-format text. In the tooltips
these are indicated with a trailing `*`.

This means that for free text fields, any text may occur **before** the search term.

## End marker `$`
If no end marker `$` is specified, then any text may also occur **after** the search term.

It is possible to override this default, which will be described below.

![image](selection-criteria-tooltip-vql.png)


| Search term           | Comment |
|:----------------------|:--------|
| id:cc.game.locations  | In the tooltips there is no '*' after `id: <id>`, this means that the \<id> must **start** exactly as specified, but there may be additional characters following the match |
| id:cc.game.locations$ | In this example the end of the match is forced with the '$', which means end-of-line |
| id:\*game.locations$  | Here the '*' immediately after the `id:` tag indicates that anything (possibly nothing) can precede the `game.locations` pattern |
| de:dragon             | The `de:` \<description> field has a trailing '*'. This means that by default we will try to match the string `dragon` anywhere in the text |
| de:^dragon            | Here the '^' immediately after the `de:` tag indicated that the pattern is anchored, i.e. the field must start precisely with the specified text |

#### Summary of search anchor mechanism

The objective is for the user to type as little as necessary, that is why the fields have a configured value for **free-text** or **anchored** search.
This configured default can be overridden by putting either '*' or '^' immediately after the tag.

In most cases this should not be necessary.
The single '*' (and '^') only works as a wildcard in this particular place. If a wildcard is wanted elsewhere in search term,
normal JS RegEx syntax applies.


## REGEX still exist

This is an **optional** advanced topic.

It is possible to be more advanced search for an \<id> (or any other field) containing multiple possibilities,
such as
```
id:name-(foo|bar)
```

This will match `id:name-foo` or `id:name-bar`.

To avoid matching a longer \<id>, which begins in the same way, the search can be terminated like this

```
id:name-(foo|bar)$
```

Here `$` is a regex metacharacter indicating end-of-line, which will prevent matching of any longer strings.

To avoid use of regular expressions, the `id:name-(foo|bar)` term could also be written as:

```
id:name-foo or id:name-bar
```

or

```
id:name-foo$ or id:name-bar$
```

to force only complete matches and exclude prefix matches

# Use of regex metacharacters in ids

In VQL it is still possible (but not necessary) to use regular expressions in the search terms.

In some projects the naming of specobjects now include regex meta characters such as
 `(`, `)`, `[`, `]` etc.

To manage the use of meta characters, any VQL term which starts with `@` will have all meta
characters escaped. Meaning they have no special purpose.

In practice this means that looking for a specobject named

```
ara.cli[StarterKit]--(ara.cli.StarterKit)

```

is written in selection box as:

```
@ara.cli[StarterKit]--(ara.cli.StarterKit)
```

It can be made more precise by adding the `id:` tag like this (this is optional)

```
@id:ara.cli[StarterKit]--(ara.cli.StarterKit)
```

Is is not possible to use regular expression syntax in `@` prefixed search terms. It is, however,
possible to use `$` to ensure match of a full name, like this:

```
@id:ara.cli[StarterKit]--(ara.cli.StarterKit)$
```

The author hopes that specobjects will not start to use `$` as part of the \<id>.

If for some reason the 1st character need to be a `@`, like `@foo`, then write it as `@@foo` .

**Note**: When you right-click and 'select' a node, it is added to the selection criteria using the `@id:<id>$` format.

## Hierarchical search

Suppose we want to find uncovered specobjects in a huge trace. There are many such specobjects,
but we want to limit it to specobjects which are children of some set of higher level specobjects.
To support this, VQL include the `children_of( term1, term2 )` (can be abbreviated to `co( term1, term2 )`).

1.  This search starts by finding the specobjects selected by `term1`. These are the higher level specobjects.
2.  Then the children of these specbjects are found.
3.  Finally the `term2` is applied on the children, which then gives the final result.

This effective limits the search to a sub-tree within the full trace.

Notice that `term1` can select one or more specobjects, so having groups of specobject trees is possible.

A similar search can be done with `ancestors_of( term1, term2 )` (can be abbreviated to `ao( term1, term2 )`).
This finds related specobjects by following the 'uplinks'.

1. This search starts by finding the specobject selected by `term1`.
2. Then the ancestors of these specobjects are found.
3. Finally the `term2`is applied on the ancestors, which then gives the final result.

Notice that these operations can be nested and combined with `AND`, `OR` and `NOT` operations on search
terms, as well as grouping with `(` and `)`.


Back to [README.md](../README.md)
