# Toad City remote CI (GitHub Actions on bparlette/Hawk)

Use this instead of queueing headless Chrome behind `locks/chrome.flock`. Every boss x mode and both city smokes run as
separate parallel jobs on GitHub's runners; a full regression (20 jobs) takes about 11 minutes wall clock.

- Workflow: `.github/workflows/toadcity-tests.yml` on Hawk branch **`toadcity/ci`** (the harness branch; also registered on
  Hawk's default branch `claude/new-session-z5ikqq` only because `workflow_dispatch` requires the file to exist there.
  Always dispatch with `ref=toadcity/ci` so the current harness version runs).
- Runner scripts: `ci/toadcity/run_boss.js`, `ci/toadcity/run_city.js`, `ci/toadcity/common.js` on `toadcity/ci`
  (local working copy: `/workspace/work/hawk-ci`). Generic versions of game-int `T/w2b/run.js` and `T/w2b/city.js`.
- Helper: `/workspace/work/hawk-ci/tc_ci.sh` (same file at `ci/toadcity/tc_ci.sh` on the branch).
- Hawk is public, so Actions minutes are free; about 20 jobs run at once per account. Two runs at the same time queue behind each other.

## Rules
- Push **only** to `https://github.com/bparlette/Hawk.git`, and only to branches named `toadcity/<name>`. Never push the
  game repo anywhere else, never deploy to surge from CI, never rewrite `hark/integration` in game-int.
- Run every git push and `apicall github` command with shell `credentials: [{"provider":"github"}]`. The gateway injects
  the token, and plain `curl https://api.github.com/...` in that shell is authenticated too.
- **CI tests what is committed.** It serves `site/` from your pushed commit. Run `./mk.sh` / `./build.sh`, commit `site/game.js`,
  then push. Uncommitted edits are not tested (`tc_ci.sh push` warns about them).

## 1. Push your branch
```bash
# from your worktree, e.g. /workspace/work/toad-city/game-brewmaster (branch hark/boss-brewmaster)
git push -f https://github.com/bparlette/Hawk.git HEAD:refs/heads/toadcity/brewmaster
# or: /workspace/work/hawk-ci/tc_ci.sh push /workspace/work/toad-city/game-brewmaster brewmaster
```
`toadcity/integration` is the integration branch's mirror. Only the integration owner pushes it.

## 2. Dispatch, then wait
```bash
# whole matrix (every boss in the build x win,lose at 390x844 + city 390x844 and 1280x720):
/workspace/work/hawk-ci/tc_ci.sh run brewmaster
# only your boss, both modes, no city:      tc_ci.sh run brewmaster brewmaster win,lose false
# a few bosses + city:                       tc_ci.sh run brewmaster brewmaster,crabcake "" true
# push + run in one go:                      tc_ci.sh all <worktree> <name> [bosses] [modes] [city]
```
`run` dispatches, prints the run URL, polls every 30 s until the run completes, then prints the per-job table. The shell tool
caps each command at 120 s, so for a full run, dispatch it and poll in short commands instead:
```bash
apicall github workflow_dispatch owner=bparlette repo=Hawk workflow_id=toadcity-tests.yml ref=toadcity/ci \
  inputs='{"ref":"toadcity/brewmaster","bosses":"","modes":"win,lose","city":"true","tag":"brewmaster-1"}'
curl -s "https://api.github.com/repos/bparlette/Hawk/actions/workflows/toadcity-tests.yml/runs?per_page=5" \
  | python3 -c "import json,sys;[print(r['id'],r['display_title'],r['status'],r['conclusion']) for r in json.load(sys.stdin)['workflow_runs']]"
/workspace/work/hawk-ci/tc_ci.sh jobs <run_id>      # per-job status / conclusion / seconds
```
Inputs:
- `ref`: the Hawk branch holding the game repo (required).
- `bosses`: a comma list. Leave it blank for every known boss that is in the build.
- `modes`: defaults to `win,lose`.
- `city`: `true` or `false`.
- `tag`: free text that goes into the run name, so you can find your run.
- `ci_ref`: the harness branch. Defaults to `toadcity/ci`.

The plan job checks `site/game.js` for `<boss>auto`. Bosses that are not in the build are skipped and listed in the run summary,
so a new boss (e.g. brewmaster) is tested automatically once it is merged. To add a boss param the harness doesn't know yet,
add it to `known` (and to `extra` if it needs a query flag such as `&cobblestonenight=1`) in the workflow on `toadcity/ci`.

## 3. Read the results
- The run page (`https://github.com/bparlette/Hawk/actions/runs/<id>`) has a summary table: job, PASS/FAIL, wall seconds,
  own console errors, and the reason.
- `tc_ci.sh fetch <run_id> <dir>` downloads every artifact into one folder per job:
  - `results-<job>/<name>.json`: pass, reason, errors, warnings, ignored third-party failures, sampled duel state, final duel log.
  - `<job>.log`: the runner's stdout.
  - `*_mid.png` and `*_end.png`: boss screenshots at about 10 s and at the end state.
  - `city_*_<boss>.png`: one screenshot per entry ring.
  - The `summary` artifact holds `summary.json` for the whole run.
- One job's raw log: `curl -sL https://api.github.com/repos/bparlette/Hawk/actions/jobs/<job_id>/logs | grep RESULT`.

### What PASS means
- **Boss win**: the duel bot plays `?<boss>=1&<boss>auto=win&sim=3` until the duel ends with `__duels.result === 'win'`.
- **Boss lose**: the bot loses until the RETRY flow runs (`__duels.retries >= 1`, fight live again).
- **City (390x844 and 1280x720)**: the city renders and every boss entry in the build shows its BEAM ring at the trigger.
  Entries without a ring, such as Carl's duckpin door, pass on the ACT label instead.
- **Every job**: 0 own console errors, 0 page errors, 0 failed own requests, and `__celErr.n === 0`.
  - Ignored: failures from youtube, ytimg, google, gstatic, bandcamp and bcbits, plus swiftshader, GPU-stall and autoplay noise.
  - Warnings are recorded but do not fail a job.

### Notes
- Each fight has an 18-minute ceiling; jobs time out at 30 minutes.
- Lose runs are the long ones on CI: shellacious about 10 min, cobblestone and crabcake about 8 to 9 min, compking about 8 min.
- `stallKicks` in a result JSON means fight time stopped for 20 s and the runner forced a frame with a screenshot. This
  happened once in an early run (cobblestone lose, right after the KO).
  - It is recorded so a real freeze still shows.
  - If one job stalls repeatedly, investigate the game.
