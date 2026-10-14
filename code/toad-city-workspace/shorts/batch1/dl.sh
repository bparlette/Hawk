#!/bin/bash
# dl.sh <run_id> [name-filter]: download + unzip artifacts of a Hawk shorts run into raw/<name>/
cd /workspace/work/toad-city/shorts/batch1 && mkdir -p raw
curl -s -m 30 "https://api.github.com/repos/bparlette/Hawk/actions/runs/$1/artifacts?per_page=50" > arts_$1.json
python3 -c "
import json
for a in json.load(open('arts_$1.json'))['artifacts']: print(a['id'],a['name'])" | while read id nm; do
  n=${nm#cap-}; [ -n "$2" ] && [[ ! "$n" =~ $2 ]] && continue
  [ -f raw/$n/.ok_$id ] && continue
  mkdir -p raw/$n && curl -sL -m 110 -o raw/$n.zip "https://api.github.com/repos/bparlette/Hawk/actions/artifacts/$id/zip" && (cd raw/$n && unzip -oq ../$n.zip && rm ../$n.zip && touch .ok_$id) && echo "got $n"
done
