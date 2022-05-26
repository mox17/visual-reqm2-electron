# Test and Trace of Visual ReqM2

## Requirements
The features of Visual ReqM2 are summarized as requirements in [requirements.xlsx](./doc/requirements.xlsx).
Various places in the implementation there are _magical_ comments, which link that part of the code as
an implementaion of a requirement.
Likewise there are similar comments in test code, which indicate which requirement a test verifies.


The magical comments are of the form `//rq: ->(rq_doctype_color_gen) D(* Generate new colors*)`


The script `run_reqm2.sh` will create a ReqM2 tracing report in [./reqm2/visual_reqm2.html](./reqm2/visual_reqm2.html).


If you want some introspection there is also a `./reqm2/visual_reqm2.oreqm` file, which can be opened by Visual ReqM2.


## Tests
The tests are executed with `npm test` and will print a report to the console.
and will generate a coverage report in [./coverage/index.html](./coverage/index.html).

In general it is a good idea to make sure all libraries are present before attempting a test.
```bash
# Update all node packages
npm install
# Run NodeJS tests with coverage
npm test
```

### Babel
Currently this report is based of the Babelized source code, i.e. code transformed to an older more compatible format,
compared to the ES6 style that the application is written in.

These generated source files are located in `./lib`, and those are what can be seen in the tracing and coverage reports.

Also if some error is detected in a test, the source code location reported is the Babelized location, but a fix must
of course be applied in the `./scripts` area.

When Babel translates newer JavaScript constructs to older style, some boiler-plate transformations are used. While these
are believed to be correct, they do contain execution paths which are not reachable, and thus complete coverage is an elusive goal.

## Electron interactions
The core logic of Visual ReqM2 has been refactored, such that it can be unit tested *without* running in an application Window.

It does mean that not all functionality will be tested in Electron, but in a bare NodeJS environment.

## Summary
The intention is to have coverage for all requirements, and make sure that all worthwhile execution paths are covered
(as seen in the coverage report).

