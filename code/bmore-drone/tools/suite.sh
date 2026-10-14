#!/usr/bin/env bash
cd /workspace/work/bmore-drone
python3 - <<'PY'
import socket,subprocess
s=socket.socket()
try: s.connect(('127.0.0.1',8791)); s.close()
except Exception: subprocess.Popen(['python3','/workspace/work/toad-city/game-int/serve.py','8791','/workspace/work/bmore-drone/site'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True); import time; time.sleep(1)
PY
export PLAYWRIGHT_BROWSERS_PATH=/workspace/work/freeze_test/pw-browsers LD_LIBRARY_PATH=/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu
echo "queued $(date +%T)"; flock /workspace/work/toad-city/locks/chrome.flock bash -c "echo got-lock \$(date +%T); timeout 2400 node tools/suite.js 8791 $1"; echo "end rc=$? $(date +%T)"
