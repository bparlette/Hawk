#!/usr/bin/env bash
# Deploys round-2 pages to their own surge subdomains (never touches toad-city-baltimore.surge.sh). Usage: deploy_r2.sh ID [ID…]
cd "$(dirname "$0")"
export SURGE_TOKEN=$(cat /workspace/work/.surge_token) SURGE_LOGIN=rbparle@gmail.com
S=/workspace/work/trailer_v2/surge_cli/node_modules/.bin/surge
mkdir -p logs
for id in "$@"; do
  dom=$(python3 -c "import json,sys;print([s['domain'] for s in json.load(open('sessions.json')) if s['id']=='$id'][0])")
  case "$dom" in toad-city-baltimore*) echo "REFUSE $dom"; continue;; esac
  ( $S ./pages/$id "$dom" > logs/deploy_$id.log 2>&1 && echo "DEPLOY_OK $id https://$dom/" || echo "DEPLOY_FAIL $id $(tail -2 logs/deploy_$id.log | tr '\n' ' ')" ) &
done
wait
