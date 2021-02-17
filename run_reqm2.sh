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

perl $REQM2 -i doc/requirements.xlsx -x ReqM_2::Importer::XLSX -p 'doctype=swrs;sheettitle=Sheet1' -O reqm2 -o requirements.reqm
perl $REQM2 -i scripts/*.js -x ReqM_2::Importer::TerseMultiLang -p 'doctype=impl;language=JavaScript' -O reqm2 -o implementation.reqm
perl $REQM2 -i test/*.js -x ReqM_2::Importer::TerseMultiLang -p 'doctype=test;language=JavaScript' -O reqm2 -o tests.reqm
perl $REQM2 -t reqm2/*.reqm  -O reqm2 -o visual_reqm2.oreqm
perl $REQM2 -r reqm2/visual_reqm2.oreqm -x ReqM_2::Exporter::Html5 -O reqm2 -o visual_reqm2.html
