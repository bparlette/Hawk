# Lanternport Film Mode (Record & Replay) — Status

Repo: `bparlette/Hawk` (`main`, `games/lanternport/`)

## Plan & Checklist

1. **Replay engine (`games/lanternport/replay.js`) + determinism proof (`test/lanternport-replay.test.mjs`)** — **Done**
   - `SessionRecorder`: RLE-compressed input + sim tick recorder from `t=0` (with seamless pre-roll `prelude` capture so recordings started mid-session also replay from `Game(seed)`), plus `recordPlace` and `recordSceneState`.
   - `TakeStore`: `localStorage` (`lanternport:film:takes:v1`) persistence + in-memory fallback with save/list/rename/remove/nextName and quota-safe pruning.
   - `ReplayPlayer` & `verifyTakeDeterminism`: `SimClock`-driven playback (`0.5x`, `1x`, `2x`) with play/pause and `reset()`.
2. **UI + FreeCam + 9:16 Safe-Frame Integration (`games/lanternport/index.html`)** — Next
   - Record toggle + Takes drawer + named take save/rename/delete in game's existing pill/modal style (`z-index > 1000` above `gptouch` overlay, phone-friendly).
   - Replay transport bar: Play/Pause, Restart Take, `0.5x` / `1x` / `2x` speed buttons, `9:16` safe-frame toggle, Exit Replay; FreeCam unlocked for full orbit/pan/fly/dolly while replaying.
3. **Headless browser & full test suite verification** — Pending
   - Run full `node --test test/lanternport*.test.mjs test/linkle-walk-assets.test.mjs test/headless-pages.test.mjs` before every commit + verify live UI record -> replay -> digest parity in headless Chrome.

## Digest-Test Result

- **`test/lanternport-replay.test.mjs`:** **4/4 passed** (full Lanternport suite **56/56 passed**, 0 failed):
  - Free-play scripted run (`Bot` + manual jumps/dives/swaps/camera yaw): **bit-exact** `SimClock` digest at every tick and end digest (`360` ticks) across `0.5x`, `1x`, `2x` at `24`, `60`, `144` fps after JSON + `TakeStore` round-trip.
  - Mid-session take (`180` pre-roll ticks with `place()` + `240` recorded ticks): **bit-exact** prelude start digest and take end digest + per-tick parity.
  - Staged scene (`cucco-swarm` watch `120`t -> mid-scene `Take Control` `place()` + manual input `120`t): **bit-exact** per-tick & end digest, plus `paused` and `reset()` checks.
  - `TakeStore` save/list/rename/remove: passed.
