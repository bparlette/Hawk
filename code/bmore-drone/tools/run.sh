#!/usr/bin/env bash
# tools/run.sh <scenario> <w> <h> [query] [outPrefix]  -- headless chrome QA under the shared chrome flock
cd "$(dirname "$0")/.."
python3 - <<'EOF'
import socket,subprocess
s=socket.socket()
try:
    s.connect(('127.0.0.1',8791)); s.close()
except Exception:
    subprocess.call(['python3','/workspace/work/toad-city/game-int/serve.py','8791','/workspace/work/bmore-drone/site'])
EOF
export PLAYWRIGHT_BROWSERS_PATH=/workspace/work/freeze_test/pw-browsers LD_LIBRARY_PATH=/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu
exec flock /workspace/work/toad-city/locks/chrome.flock node tools/qa.js 8791 "$@"
