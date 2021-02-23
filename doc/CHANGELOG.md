### Changelog


## 1.4.7

 * Keyboard shortcuts for pan-zoom, when focus is on svg
   * ' ' (space key) in diagram will reset zoom.
   * '+' zoom in
   * '-' zoom out
   * 'a' or 'ArrowLeft' pan left
   * 'd or 'ArrowRight' pan right
   * 'w' or 'ArrowUp' pan up
   * 's' or 'ArrowDown' pan down
 * Specobject boxes have cleaner outline. Graphviz would sometime show double outline.
 * cluster outlines have rounded corners and slightly thicker.
 * Logic for handling duplicates much improved. Now believed to follow what is specified for ReqM2 itself.
   * A consequence of this is that duplicate specobjects will have their version appended to their name and 'key'
   in the graph.
   * This is relevant when excluding nodes. With duplicate node it is not obvious which duplicate
   should be excluded.
   * With this change, the duplicates will have a key, which is different from their \<id>.
   First encountered instance of a set of duplicates will have just \<id> as key.
   * When several duplicates share the SAME \<version>, The key is constructed from \<id> with the string
   `:<version>` appended repeatedly until the key is unique.
 * Save diagram as `.dot` is a new option.
 * Automated tests are added. run `npm install ; npm test` to see them in action. A folder `./tmp/` is generated,
   which contains a variety of generated artifacts, screenshots etc.
 * Requirements have been added. The file `./docs/requirements.xlsx` contain current set of requirements.
 * Requirements tracing has been added. Should you happen to have a ReqM2 installation available,
   the script `run_reqm2.sh` will generate a requirements trace in `./reqm2`. Be aware that ReqM2 appears to have
   some problems with processing JavaScript source code, so several links are currently not picked up.
 * A spinner has been introduced to indicate long lasting (or never ending) operations, such are too large graphs.
   It currently suffers from the author's lack of CSS skills, but keeps the waiting user entertained just the same.
 * Code has been reorganized to permit use of Visual ReqM2 as a command line tool to generate predefined diagrams,
   such as diff views. Use the '--help' option to get an overview. This is working best with Linux.

