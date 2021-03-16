### Changelog

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
 * Integration of **Travis CI**. Tests are run on every push to github and status is reflected in README.md.  [![Build Status](https://travis-ci.com/mox17/visual-reqm2-electron.svg?branch=master)](https://travis-ci.com/mox17/visual-reqm2-electron)
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


