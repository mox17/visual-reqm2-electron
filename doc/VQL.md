# Visual ReqM2 Query Language (VQL)

## Purpose

When Visual ReqM2 is rendering a diagram, the precise selection of the specobjects of interest
is crucial.
So far each specobject has had a search string, where simple prefixes derived from the XML
schema, as well as a few synthesized attributes were present.
The search was then expressed as a regular expression, which should match search strings
for the relevant specobjects.

While this works, it does require that the user is conscious about the order prefixes can
occur in.

## Improvements wanted

A query language should help the user and avoid any need to learn unnecessary details.
In this context the order of the search tags is such a detail.

More advanced queries should be possible, but should not make simple queries any harder.

## VQL concept

One way to think about the search criteria, is a way to reduce the set of all specobject
of just the set of selected specobject.

If we specify `dt:swrs` then we select the subset of specobjecs that have the `<doctype>` of `swrs`.
To be more specific additonal terms could be added `st:approved dt:swrs`. There is an implied
AND betweeen the terms.

### Use of regex metacharacters in ids

In VQL it is still possibble to use regular expressions in the search terms. In some projects
the naming of specobjects now include regex meta characters such as `(`, `)`, `[`, `]` etc.
To manage the use of meta characters, any VQL term which starts with `@` will have all meta
characters escaped. In practice this means that looking for a specobject named
`ara.cli[StarterKit]--(ara.cli.StarterKit)` as `id:ara.cli[StarterKit]--(ara.cli.StarterKit)`
instead is written as `@id:ara.cli[StarterKit]--(ara.cli.StarterKit)`

If for some reason the 1st character need to a `@`, like `@foo`, then write it as `@@foo` .

## Hirerarchical search

Suppose we want to find uncovered specobjects in a huge trace. There are many such specobjects,
but we want to limit it to specobjects which are children of some set of higher level specobjects.
To support this, VQL include the `children_of(term1,term2)` (can be abbreviated to `co(term1,term2)`).

1.  This seach starts by finding the specobjects selected by `term1`.
2.  Then the children of these specbjects are found.
3.  Finally the `term2` is applied on the children, which then gives the final result.

A similar search can be done with `ancestors_of(term1,term2)` (can be abbreviated to `ao(term1,term2)`).

1. This search starte by finding the specobject selected by `term1`.
2. Then the ancestors of these specobjects are found.
3. Finally the `term2`is applied on the ancestors, which then gives the final result.

Notice that these operations can be nested and combined with `AND`, `OR` and `NOT` operations on search terms.
Also note that search terms can be grouped with `(` and  `)`. Put whitespace around the brackets to distguinsh them from the search terms.
