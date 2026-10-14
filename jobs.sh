#!/bin/bash
# usage: jobs.sh <run_id>
curl -s "https://api.github.com/repos/bparlette/Hawk/actions/runs/$1/jobs?per_page=100" | python3 -c "
import json,sys,datetime as D
d=json.load(sys.stdin)
f=lambda s: D.datetime.fromisoformat(s.replace('Z','+00:00')) if s else None
for j in d['jobs']:
  a,b=f(j['started_at']),f(j['completed_at'])
  print(f\"{j['name']:28} {j['status']:12} {str(j['conclusion']):10} {int((b-a).total_seconds()) if a and b else '-':>5}s\", j['id'])
"
