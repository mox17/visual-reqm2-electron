#!/usr/bin/env bash
if [ -z ${REQM2+x} ]; then
  echo "REQM2 is unset. Do 'export REQM2=/full/path/to/ReqM2.pl'";
  exit 1
else
  echo "Using $REQM2 to process requirements."
fi

if [ "$#" -ne 2 ]; then
  echo "Specify input and output "
  exit 1
fi

# Find configuration file
APP_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
CFG=$APP_ROOT/doc/ReqM2cfg.xml
CFGW=$(cygpath -m $CFG)

#echo $CFG
# Remove the tags breaking re-import
sed -e 's|<needscov>||g' -e 's|</needscov>||g' $1 > $1.needscov

perl $REQM2 -i $1.needscov -c $CFGW -cleanup -x ReqM_2::Importer::DocBook -o $1.reqm
perl $REQM2 -q -c $CFGW -t $1.reqm -o $2
rm $1.needscov
