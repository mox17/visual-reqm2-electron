### Changelog


## 1.4.7

 * Keyboard shortcuts for svg pan-zoom
   * `Alt+Space` reset zoom.
   * `Alt+0`     reset zoom.
   * `Alt+'+'`   zoom in
   * `Alt+PgUp`  zoom in
   * `Alt+'-'`   zoom out
   * `Alt+PgDn`  zoom out
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
   * Duplicates are grouped together in a cluster with a grey 'duplicates' box around them, one box for each unique \<id>.
   * To distinguish duplicate specobjects, they will have their version appended to their 'key' in the graph. The 'key' is usually just the \<id>.
   * This is relevant when excluding nodes. With duplicate nodes, it is not obvious which duplicate
   should be excluded.
   * With this change, the duplicates will have a key, which is different from their \<id>.
   The first encountered instance of a set of duplicates will have just \<id> as key.
   * When several duplicates share the SAME \<version>, The key is constructed from \<id> with the string
   `:<version>` appended repeatedly until the key is unique.
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


 ## for previous versions consult git log...


