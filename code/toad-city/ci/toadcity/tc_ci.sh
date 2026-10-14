#!/bin/bash
# Toad City remote CI helper (GitHub Actions on bparlette/Hawk). Run with shell credentials [{"provider":"github"}].
#   tc_ci.sh push  <worktree> <name>             push the worktree's HEAD to Hawk as toadcity/<name> (force; only Hawk)
#   tc_ci.sh run   <name> [bosses] [modes] [city] dispatch toadcity-tests.yml against toadcity/<name>, wait, print results
#   tc_ci.sh all   <worktree> <name> [bosses] [modes] [city]   push + run
#   tc_ci.sh jobs  <run_id>                       per-job table
#   tc_ci.sh fetch <run_id> [dir]                 download every artifact (logs, screenshots, result JSON) to dir
set -e
R=bparlette/Hawk; API=https://api.github.com/repos/$R
jobs() { curl -s "$API/actions/runs/$1/jobs?per_page=100" | python3 -c "
import json,sys,datetime as D
d=json.load(sys.stdin); f=lambda s: D.datetime.fromisoformat(s.replace('Z','+00:00')) if s else None
for j in d['jobs']:
  a,b=f(j['started_at']),f(j['completed_at'])
  print(f\"{j['name']:24} {j['status']:11} {str(j['conclusion']):9} {int((b-a).total_seconds()) if a and b else '-':>5}s\")"; }
case "$1" in
  push) cd "$2"; [ -n "$(git status --porcelain -- site src parts)" ] && echo "WARN: uncommitted changes in site/src/parts are NOT tested (CI serves committed site/)"
        git push -f https://github.com/$R.git HEAD:refs/heads/toadcity/$3 ;;
  run)  N=$2; TAG="$N-$(date +%H%M%S)"
        IN=$(python3 -c "import json,sys;print(json.dumps({'ref':'toadcity/'+sys.argv[1],'bosses':sys.argv[2],'modes':sys.argv[3] or 'win,lose','city':sys.argv[4] or 'true','tag':sys.argv[5]}))" "$N" "${3:-}" "${4:-}" "${5:-}" "$TAG")
        apicall github workflow_dispatch owner=bparlette repo=Hawk workflow_id=toadcity-tests.yml ref=toadcity/ci inputs="$IN" >/dev/null
        for i in $(seq 1 20); do sleep 6; ID=$(curl -s "$API/actions/workflows/toadcity-tests.yml/runs?per_page=20" | python3 -c "import json,sys;t=sys.argv[1];print(next((str(r['id']) for r in json.load(sys.stdin)['workflow_runs'] if t in r['display_title']),''))" "$TAG"); [ -n "$ID" ] && break; done
        echo "run https://github.com/$R/actions/runs/$ID"
        while :; do S=$(curl -s "$API/actions/runs/$ID" | python3 -c "import json,sys;r=json.load(sys.stdin);print(r['status'],r['conclusion'])"); [ "${S%% *}" = completed ] && break; sleep 30; done
        echo "conclusion: ${S#* }"; jobs $ID ;;
  all)  "$0" push "$2" "$3"; "$0" run "$3" "${4:-}" "${5:-}" "${6:-}" ;;
  jobs) jobs $2 ;;
  fetch) D=${3:-./ci_$2}; mkdir -p $D; curl -s "$API/actions/runs/$2/artifacts?per_page=100" | python3 -c "import json,sys;[print(a['name'],a['archive_download_url']) for a in json.load(sys.stdin)['artifacts']]" | while read n u; do curl -sL -o $D/$n.zip "$u" && (cd $D && unzip -qo $n.zip -d $n && rm $n.zip); done; echo "artifacts in $D" ;;
  *) sed -n 2,8p "$0" ;;
esac
