#!/bin/sh
# Build + analyze + test the prototype. Usage: ./check.sh
T=/workspace/work/roblox/tools
cd /workspace/work/roblox/repo/prototype || exit 1
$T/rojo build default.project.json -o /tmp/pcs.rbxl >/dev/null 2>&1 && echo "ROJO BUILD OK" || { echo "ROJO BUILD FAIL"; $T/rojo build default.project.json -o /tmp/pcs.rbxl; }
$T/rojo sourcemap default.project.json -o sourcemap.json >/dev/null 2>&1
timeout 100 $T/luau-lsp analyze --platform=roblox --sourcemap=sourcemap.json --definitions=$T/globalTypes.d.luau src 2>&1 | grep -v '^\[' | sed "s#$PWD/##"
echo "ANALYZE rc done"
if [ -d tests ]; then $T/lune run tests/run.luau; fi
$T/stylua --check src tests >/dev/null 2>&1 && echo "STYLUA OK" || echo "STYLUA DIFFS"
