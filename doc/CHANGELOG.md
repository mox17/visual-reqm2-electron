### Changelog

## 2.7.1
* Fixed bug where spurious xml tags inside `<sourceline>` made dot graph invalid.
* Display more detailed error messages from graphviz.
* In VQL functions pa() ch() de() an() filter results to existing specobjects only (bugfix).

## 2.7.0
* Update VQL with more graph selection functions and tidy up naming of functions:
  * `children()` (alias to `ch()` ). One level reference to specobjects.
  * `parents()`  (alias to `pa()` ). One level reference to specobjects.
  * `descendants()` (alias to `de()`, `co()` and `children_of()` ). Multi-level reference to specobjects.
  * `ancestors()` (alias to `an()`, `ao()` and `ancestors_of()` ). Multi-level reference to specobjects.
  * The function names `co()`, `children_of()`, `ao()` and `ancestors_of()` are deprecated and will be removed in a future release.
* Remove usage of deprecated internal module `remote`.
  * This is necessary to upgrade to newer version of electron.
  * refactor code to use other ipc mechanisms
* Update to electron 18
* Add double-click selection of fields for xlsx export
* Cosmetic changes to modal dialogs (settings and selection of exported fields)
* Add dialog to edit doctype colors w. color picker
  * Add feature to cluster doctypes according to V-model in 'hierarchy' and 'safety' view.

## 2.6.0
* Use SheetJS to export selected specobjects as xlsx files
* Removed .csv export of selected specobjects.
* Added dialog with drag-and-drop to configure fields exported to xlsx files
* Make "exclude rejected" a setting

## 2.5.2
* Add support quoted search terms in VQL. Enclose whole term in either pairs of `"` or `'` characters.
  This permits spaces in search terms, without rewriting spaces as `\s`.
* Update VQL.md documentation.

## 2.5.1
* Fix bug in showToast import that could leave an active progress-bar window running.

## 2.5.0
* VQL query language for easier search. This is a major new feature. See [VQL.md](VQL.md) about details
  of the new and hopefully easier search syntax.
* `-q` `--vql` command line option for VQL search. Mutually exclusive with `-i` `--idOnly` and `-x` `--regex` options.
* `-x` `--regex` command line option for Regex search. Mutually exclusive with `-i` `--idOnly` and `-q` `--vql` options.
* Radio-button choice to select between search 'languages'. Options are `<id>`, `regex` and `VQL`.
* In the doctype table, the 'select' column now also show counts for **excluded** doctypes.
  The 'shown' count is of course still zero. This indicates if a query finds specobjects, even if nothing is
  displayed because of excluded doctypes.
* Added links to README.md and VQL.md in 'help' menu. These are github hosted documents.
* Added HTML table as a display format.
* Live error messages under selection box. Content evaluated after each keystroke. Checks RegEx and VQL syntax problems on-the-fly.

## 2.4.2
* Fix bug of empty display of 'dot' when no previous 'svg' display was done.

## 2.4.1
* In diff/comparison view do not render `<linksto>` links from reference `.oreqm` specobjects that
  have links errors, such as `'referenced object does not exist'`. This is because such links are shown as
  an attribute on the speobject, as there are no removed 'ghost' :ghost: specobjects to render a connection to.

## 2.4.0
* Single-node selection. Some selections may generate diagrams that are too large to render.
  This 'single' select option gives the possibility to step through multiple diagrams, where only a
  single node is selected. The selection can be done with `next` or `prev` buttons, or a specific node
  can be chosen from the selection box.

## 2.3.1
* Add columns with specobject `<status>` in diagram selection csv file.

## 2.3.0
* Add button to copy list of selected `<id>`s to clipboard.
* Fix bug in ancestor calculation for `.csv` exports.
* Add File menu items to load oreqm files.
* Color code the needsobj entries when showing coverage errors. Doctypes with no coverage have a RED background.
* Check for false positives for missing coverage (only relevant for old input oreqm files).

## 2.2.2
Additional error details in exported error table:
* mic: Missing direct coverage. ´Missing coverage from doctype g_swintts´
* fer: ffb errors. Such as  ´ffb referenced object does not exist. <id> some.id.follows.here´

## 2.2.0
Menu option to generate .csv table of errors in current selection of nodes.
Table includes the ancestor specobjects of the objects w. errors.

This table generation works even if Visual ReqM2 is not able to render a svg diagram of the
selected nodes.
NOTE: Raise the limit for nodes in a diagram in settings from default 1000 to something larger
than the specobjects in trace, say 50000.

## 2.1.3
* When selecting a duplicate from the context menu, all duplicate entries are selected.
  Individual duplicates can excluded.
* File watching. If a currently displayed `.oreqm` is updated on disk, the user will be offered
  to reload the file or ignore the change.
* Allow drag-and-drop of `.vr2x` file to load a diagram context.
* Cosmetic changes to spinner.
* Show error message when Graphviz fails (typically because of too complex graph).


## 2.1.2
Handle ReqM2 traces where the `<id>` names contain regex meta characters such as '(' ')' '[' '{' etc.
This previously broke the select/deselect logic because the id's were regexes that didn't match themselves.

The '.' character continues to be an un-escaped metacharacter, which could lead to finding too many spebjects,
but it does not force regex knowledge on the users of Visual ReqM2.

Harmonize names of binaries in releases
| Type                | Filename                          |
|---------------------|-----------------------------------|
| Windows stand-alone | visualreqm2-2.1.2.exe             |
| Windows installer   | visualreqm2-2.1.2-setup.exe       |
| Linux stand-alone   | visualreqm2-2.1.2-x86_64.AppImage |
| Linux Debian        | visualreqm2-2.1.2-amd64.deb       |
| Linux RPM           | visualreqm2-2.1.2-x86_64.rpm      |


## 2.1.1
Fix bug with detecting differences between `.oreqm` files.

Phantom differences were caused by differing order of items in lists within specobjects.
These lists are now sorted before comparison.

## 2.1.0
 * Diagram context save and load
   * store a `.vr2x` file (json format) with the paths to `.oreqm` file(s), selection criteria and settings affecting rendering.
     Use the "Save diagram context..." and "Load diagram context..." in File menu.
     The `.vr2x` file uses relative paths to the `.oreqm` files.
     This allows copying of `.oreqm` files as well as `.vr2x` file to another user, who can then open exactly the same view.
     *Caveat:* Settings in program are updated by the `.vr2x` file, but are not saved. To save enter the Settings dialog and exit with [OK], or restart program to discard settings read from context.
   * Added --context command line parameter to load `.vr2x` file from cmd line and from double-clicking a `.vr2x` file.

## 2.0.3
 * Display more specobjects fields
   * securityrationale
   * securityclass
   * verifymethod (list)
   * verifycond
   * usecase
   * sourcerevison
   * creationdate
   * sourcefile:sourceline
   * testin
   * testexec
   * testout
   * testpasscrit
   * dependson
   * conflictswith
   * untracedLink

The specobject diagram representation is like this:


<table>
  <tr><td>id</td><td>version</td><td>doctype</td></tr>
  <tr><td colspan="2">description</td><td>needsobj</td></tr>
  <tr><td colspan="3">shortdesc</td></tr>
  <tr><td colspan="3">rationale</td></tr>
  <tr><td colspan="3">safetyrationale</td></tr>
  <tr><td colspan="3">shortdesc</td></tr>
  <tr><td colspan="2">securityrationale</td><td>securityclass</td></tr>
  <tr><td colspan="3">verifycrit</td></tr>
  <tr><td colspan="2">verifymethod[]</td><td>verifycond</td></tr>
  <tr><td colspan="3">comment</td></tr>
  <tr><td colspan="3">furtherinfo</td></tr>
  <tr><td colspan="3">usecase</td></tr>
  <tr><td>source</td><td>sourcerevision</td><td>creationdate</td></tr>
  <tr><td colspan="3">sourcefile:sourceline</td></tr>
  <tr><td colspan="3">testin</td></tr>
  <tr><td colspan="3">testexec</td></tr>
  <tr><td colspan="3">testout</td></tr>
  <tr><td colspan="3">testpasscrit</td></tr>
  <tr><td colspan="2">dependson</td><td>conflictswith</td></tr>
  <tr><td>releases[]</td><td>category</td><td>priority</td></tr>
  <tr><td>tags+platforms</td><td>safetyclass</td><td>status+covstatus</td></tr>
  <tr><td colspan="3">violations[]</td></tr>
  <tr><td colspan="3">linkerrors[]</td></tr>
</table>


Only fields present in oreqm file will be rendered

Note: Untraced links are shown with dotted lines and the label 'untraced'

## 2.0.2
 * Fix for duplicate fulfilledby placholders. More automated test cases.
 * Multiline regex needed for id-only search

## 2.0.0
 * Refactored the tag search logic. `id:` is now just after `dt:` (doctype). Updated tooltip and documentation.
   If you do advanced search this is a minor change in the order search terms are entered, to better reflect the order
   in the ReqM2 xml schema.
 * The **'new:'**, **'chg:'** and **'rem:'** markers are no longer part of the **'id:'**, but are seperate tags.
 * Color-code fulfilledby links in comparison view, similar to the linksto links.
 * The filfilledby placeholders are now shown as 'ghosts' :ghost:, i.e. with a doctype specific background color that fades to a ghostly white. This is to indicate that these are not real specobjects, but are there to visualize the intended relation.
 * Added option to limit reachable nodes to 1 level. Thought to be useful for limiting size of diff diagrams. Use **"depth=1"** checkbox.
 * Fixed bug with lost 1st click on controls.
 * `npm run-script test:cov` generates coverage report - see report in `./coverage/index.html`.
 * In comparison diagrams, any modifications to linksto links arew now shown as color coded edges/arrows with labels 'new', 'changed' or 'removed'.
 * Batch mode possible, i.e. generate diagrams entirely from command line.
   * The `--help` option is your friend.
```
$ ./node_modules/electron/dist/electron.exe . --help

VisualReqM2 options [main_oreqm [ref_oreqm]]

Options:
      --help          Show help                                        [boolean]
  -v, --version       Show version                    [boolean] [default: false]
  -d, --debug         Enable debug                    [boolean] [default: false]
  -u, --update        Do automatic update (if available)
                                                      [boolean] [default: false]
  -V, --newVer        Check for new release                            [boolean]
  -s, --select        Selection criteria                                [string]
  -i, --idOnly        Search id only                  [boolean] [default: false]
  -1, --limitDepth    Limit reachable nodes to 1 level[boolean] [default: false]
  -e, --exclIds       Excluded ids, comma separated                     [string]
  -R, --inclRejected  Include rejected specobjects    [boolean] [default: false]
  -T, --exclDoctypes  Excluded doctypes, comma separated                [string]
  -f, --format        svg, png or dot graph            [string] [default: "svg"]
  -o, --output        Name of output file (extension .svg, .png or .dot will be
                      added)                                            [string]
  -g, --diagram       Generate specobject diagram     [boolean] [default: false]
  -t, --hierarchy     Generate hierarchy diagram      [boolean] [default: false]
  -S, --safety        Generate safety check diagram   [boolean] [default: false]
  -Q, --quit          Exit program after batch generation of diagrams
                                                      [boolean] [default: false]
  -r, --rules         Safety rules json file                            [string]
  -F, --settFile      Settings json file                                [string]
  -D, --settDir       Settings directory                                [string]
  -m, --oreqm_main    main oreqm file                                   [string]
  -z, --oreqm_ref     ref oreqm file (older)                            [string]

```
   * All 3 types of diagrams (including diff views) can be generated.
     * Choose between `.svg`, `.dot` or `.png` format of diagrams.
     * file name suffix `-diagram` for requirements
     * `-doctypes` for hierarchy
     * `-safety` for safety rules check.
     * Possible detected issues are in file with `-issues.txt` suffix.
     * Remember the `--quit` option to terminate the program automatically. This oddity is there because of testing framework behavior.
   * This batch mode is suitable for CI environments.
   * Program still opens windows, therefore on a headless machine enable `xvfb` (this is what is done for testing on travis-ci.com/github/mox17/visual-reqm2-electron)
   * When running in 'portable mode' (i.e. not installed) define `PWD` as is done by `bash`, otherwise relative paths will
     not work, because execution moves to a different directory.
   * Specify the settings file on the command line for predictable results (using `-D <directory>` and `-F <file>` options).
 * Drag-and-drop main oreqm file on diagram area.
 * Keyboard shortcuts for svg pan-zoom
   * `Alt+Home`  reset zoom for diagram.
   * `Alt+0`     reset zoom for diagram.
   * `Ctrl+0`    reset zoom for application UI
   * `Ctrl+Shift+'+'` zoom in application UI
   * `Ctrl+'-'`  zoom out application UI
   * `Alt+'+'`   zoom in diagram
   * `Alt+PgUp`  zoom in diagram
   * `Alt+'-'`   zoom out diagram
   * `Alt+PgDn`  zoom out diagram
   * `Alt+Left`  pan left
   * `Alt+Right` pan right
   * `Alt+Up`    pan up
   * `Alt+Down`  pan down
   * `Alt+N`     Next selected node
   * `Alt+P`     Previous selected node
   * `Alt+Enter` Update graph
 * Specobject boxes have cleaner outline. Graphviz would sometimes show a double outline.
 * Cluster outlines have rounded corners and slightly thicker. This is for selected nodes, new, changed and modified nodes.
 * Logic for handling duplicates much improved. Now believed to follow what is specified for ReqM2 itself.
   * Duplicates are grouped together in a cluster with a grey 'duplicates' box around them, one box for each unique `<id>`.
   * To distinguish duplicate specobjects, they will have their version appended to their 'key' in the graph. The 'key' is usually just the `<id>`.
   * This is relevant when excluding nodes. With duplicate nodes, it is not obvious which duplicate
   should be excluded.
   * With this change, the duplicates will have a `key`, which is different from their `<id>`.
   The first encountered instance of a set of duplicates will have just `<id>` as `key`.
   * When several duplicates share the SAME `<version>`, The `key` is constructed from `<id>` with the string
   `:<version>` appended repeatedly until the `key` is unique.
   * Duplicate specobjects are marked with the **'dup:'** tag, accessible from search box.
 * Save diagram in `.dot` format is a new option.
 * Automated tests are added. run `npm install && npm test` to see them in action. A folder `./tmp/` is generated,
   which contains a variety of generated artifacts, screenshots etc.
 * Integration of **Travis CI**. Tests are run on every push to github and status is reflected in README.md.  [![Build Status](https://travis-ci.com/mox17/visual-reqm2-electron.svg?branch=main)](https://travis-ci.com/mox17/visual-reqm2-electron)
 * Requirements have been added. The file `./docs/requirements.xlsx` contain current set of requirements.
 * Requirements tracing has been added. Should you happen to have a ReqM2 installation available,
   the script `run_reqm2.sh` will generate a requirements trace in `./reqm2`. Be aware that ReqM2 appears to have
   some problems with processing JavaScript source code, so several tracing links are currently not picked up.
 * A spinner has been introduced to indicate long lasting (or never ending) operations, such as too large graphs.
   It currently suffers from the author's lack of CSS skills, but keeps the waiting user entertained just the same.
 * Updated to use Electron v11
 * Path to settings file is visible in settings dialog.
 * Settings file (and directory) can be specified on the command line.


 ## for previous versions (version 1.4.6 and older) consult git log...


