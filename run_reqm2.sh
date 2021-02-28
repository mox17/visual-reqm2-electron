#!/usr/bin/env bash

if [ ! -d scripts ]; then
  echo "Script must be run from top directory of repository"
  exit 1
elif [ ! -d ./reqm2 ]; then
  mkdir -p ./reqm2;
fi

if [ -z ${REQM2+x} ]; then
  echo "REQM2 is unset. Do 'export REQM2=/full/path/to/ReqM2.pl'";
  exit 1
else
  echo "Using $REQM2 to process requirements."
fi

# Transpile js to avoid missing ES6 compatibility in ReqM2
./node_modules/.bin/babel.cmd scripts -d lib

perl $REQM2 -q -i doc/requirements.xlsx -x ReqM_2::Importer::XLSX -p 'doctype=requirements;sheettitle=requirements' -O reqm2 -o requirements.reqm
perl $REQM2 -q -i main.js lib/*.js -x ReqM_2::Importer::TerseMultiLang -p 'doctype=sourcecode;language=JavaScript' -O reqm2 -o implementation.reqm
perl $REQM2 -q -i test/*.js -x ReqM_2::Importer::TerseMultiLang -p 'doctype=testcode;language=JavaScript' -O reqm2 -o tests.reqm
perl $REQM2 -q -t reqm2/*.reqm  -O reqm2 -o visual_reqm2.oreqm
perl $REQM2 -q -r reqm2/visual_reqm2.oreqm -x ReqM_2::Exporter::Html5 -O reqm2 -o visual_reqm2.html
