# Visual ReqM2 Query Language (VQL)

## Purpose

When Visual ReqM2 is rendering a diagram, the precise selection of the specobjects of interest
is crucial.
Each specobject has a search string, where simple prefixes, derived from the XML schema,
prefix the various data items. Also a few synthesized attributes were present.

The already existing search is a regular expression, where the elements of the search must be
placed in the correct order. THIS IS WHAT VQL IMPROVES.

While this works, it does require that the user is conscious about the order prefixes can
occur in.

## Improvements over previous verions

A query language should help the user and avoid the need to learn unnecessary details.
In this context the **order** of the search tags is unnecessary detail.

More advanced queries should be possible, but should not make simple queries any harder.

## VQL concept

VQL allows free ordering of search terms. For example to look for **approved** **swad** requirements
mentioning **calibration** or **adjustment**. You could write it is several ways

| expression                                                 | comment |
|:-----------------------------------------------------------|:--------|
| `dt:swad AND st:approved AND calibration\|adjustment`      |         |
|`dt:swad AND st:approved AND ( calibration OR adjustment )` | brackets/parentheses `(` `)` can be used to group terms, but remember spaces around them |
|`dt:swad st:approved ( calibration OR adjustment )`         | the `AND` operator is optional |
|`calibration\|adjustment st:approved dt:swad`               | Omitted `AND` and compact regex |
|`st:approved ( calibration or adjustment ) dt:swad`         | Order of terms is not important |

Notice that order does not matter


## VQL operators

VQL support `AND` `OR` `NOT` operators and grouping with `(` `)`
Spaces are needed around the operators.
The operator hierarchy in descending order is: `NOT`, `AND`, `OR`. Thsi is the same as in most
programming languages. Parentheses can be used to control evaluation order.

The `NOT` operator gives the complementary set. I.e. the nodes not matching the expression.

### Search terms are regular expressions

If we specify `dt:swrs` then we select the subset of specobjecs that have the `<doctype>` of `swrs`.
To be more specific additonal terms can be added `st:approved dt:swrs`. There is an implied
AND betweeen the terms.

See [README.md search tags](../README.md#search-tags) for an overview of available tags.

There is also a tooltip on `Selection criteria` text, which gives a table of which tags refer to
what ReqM2 schema items.

A simple search term is just a partial string which should match to the specobjects.
It is possible to be more advanced and search for an <id> containing multiple possibilities
`id:name-(foo|bar)` this will match `id:name-foo` or `id:name-bar`. To avoid matching a longer
id, which begins in the same way, the search term would be `id:name-(foo|bar)$`
Here `$` is a regex metacharacter indicating end-of-line, which would prevent matching of any longer strings.

### Use of regex metacharacters in ids

In VQL it is still possible to use regular expressions in the search terms. In some projects
the naming of specobjects now include regex meta characters such as `(`, `)`, `[`, `]` etc.

To manage the use of meta characters, any VQL term which starts with `@` will have all meta
characters escaped.

In practice this means that looking for a specobject named
`ara.cli[StarterKit]--(ara.cli.StarterKit)` as `id:ara.cli[StarterKit]--(ara.cli.StarterKit)`
instead is written as `@id:ara.cli[StarterKit]--(ara.cli.StarterKit)`

Is is not possible to use regular expression syntax in '@' prefixed search terms. It is, however,
possible to use `$` to ensure match of a full name. It is hoped that specobjects will not start to
use `$` as part of the <id>.

If for some reason the 1st character need to a `@`, like `@foo`, then write it as `@@foo` .

## Hirerarchical search

Suppose we want to find uncovered specobjects in a huge trace. There are many such specobjects,
but we want to limit it to specobjects which are children of some set of higher level specobjects.
To support this, VQL include the `children_of(term1,term2)` (can be abbreviated to `co(term1,term2)`).

1.  This seach starts by finding the specobjects selected by `term1`.
2.  Then the children of these specbjects are found.
3.  Finally the `term2` is applied on the children, which then gives the final result.

A similar search can be done with `ancestors_of(term1,term2)` (can be abbreviated to `ao(term1,term2)`).
This finds related specobjects by following the 'uplinks'.

1. This search starts by finding the specobject selected by `term1`.
2. Then the ancestors of these specobjects are found.
3. Finally the `term2`is applied on the ancestors, which then gives the final result.

Notice that these operations can be nested and combined with `AND`, `OR` and `NOT` operations on search
terms, as well as grouping with `(` and `)`.
