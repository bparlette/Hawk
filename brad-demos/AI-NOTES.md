# Notes for AI agents working on this demo page

The tooling that builds, tests, films and publishes these demos lives in the **gamepress** repo (github.com/bparlette/gamepress).
On the owner's Mac it is checked out at `~/.gemini/antigravity/scratch/gamepress`: read `AGENTS.md` there first (pipeline, Roblox publishing, local paths, credentials by keychain item name only).
This repo is cloned for demo work at `~/.gemini/antigravity/scratch/hawk-pub` (default branch for Pages is `main`). Add a game with
`node bin/gamepress.mjs publish-demo <id> --catalog <this>/brad-demos/games.json --push`. Games live in `g/<id>/`, shared code in `g/_vendor/`.
