# Roblox (bparlette/Roblox) — review/improve progress

Clone: /workspace/work/roblox/repo (prototype/ is the Rojo project). Tools: /workspace/work/roblox/tools
- rojo 7.7.1, lune 0.11.0, stylua 2.6.0 (aarch64) OK
- luau-lsp 1.70.1 arm64 used for type analysis (+ globalTypes.d.luau, rojo sourcemap). luau-analyze & selene only ship x86_64 -> cannot run (no qemu/cargo/cmake).

## Baseline findings (before changes)
- BLOCKER: every require path wrong (init.server script.Parent.X, modules script.Parent.Parent.Shared, client script.Parent.Parent.Shared) -> server + SquashStretch error on load.
- BLOCKER: PetSpawner.luau:68-69 ambiguous-syntax parse error -> module fails to compile.
- Coins never awarded: watchPet(pet) called with no ownerHint -> player nil.
- Fling remote: no validation (any Model, inf vector -> NaN velocity), no per-player rate limit; pets get auto network ownership.
- Cylinder parts unrotated (trampoline, spawn plate, puddles, geysers stand on edge); geyser gz bug.
- FBX files are not synced by Rojo (unsupported type) -> fallback balls always; README claims otherwise.
- No game states, no persistence, HUD polls.

## Status: DONE, pushed ddc1826..85658fe to bparlette/Roblox main (2026-10-14)
Commits: 2754bcb boot fixes; c421f1b server authority/coins; 55b4a0c arena; 38738bb rounds+DataStore;
6aa3678 HUD/juice/mobile; b852a33 tests+check script; f8a528c pet colours/PetModels; 01a7952 Level leaderstat;
6e6f176 Model import; 85658fe REVIEW.md + README.
Verified: rojo build OK, luau-lsp analyze 0 errors, lune 37/37. Not run: selene (x86 only).
Needs Studio: physics feel, Touched reliability, GUI inset tap fix, DataStore with API access, balance.
Re-run checks: /workspace/work/roblox/check.sh
