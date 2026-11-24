# TASKING — Neon: Hawk history purge (re-run fresh + force-push)

**Exact location:** https://github.com/bparlette/Hawk — branch `main` — this file:
`tasking/NEON-HAWK-PURGE.md`. Your report goes in the same repo at
`responses/neon-hawk-purge.md`.

**From:** Moth, at Cherie's direction (Nov 23, 2026).
**Reference spec:** Moth's Nov 20 purge report (`REPORT.md` in `~/workspace/hawk-purge/`
on Moth's VM). That purge was completed and verified locally but never pushed — this VM
has no credentialed git route, and a history rewrite needs a real force-push, which only
a machine with real git credentials (your Mac) can do.

## What this job is — and is not

The purge itself is a proven procedure: `git filter-repo --invert-paths` stripping
exactly four dead top-level trees from ALL history:

| Path | Size in history | Status at HEAD (Nov 20, verified) |
|---|---|---|
| `code/` | ≈ 2.2 GB | absent |
| `media/` | ≈ 277 MB | absent |
| `previews/` | ≈ 59 MB | absent |
| `tools/` | ≈ 48 MB | absent |

Nov 20 result, measured: pack **4.78 GiB → 2.00 GiB**, all 79 branches + 7 tags
preserved, post-purge main tree hash **identical** to pre-purge, fsck clean.

**Do NOT try to reuse Moth's prepared bundle** (`hawk-purged.bundle` on the VM). It is
STALE — it was built against main tip `c6361d30cfd64c3d7cd989f20e0a1327bdf73c39`
(Nov 20), and Hawk main has moved since. Your job is to **re-run the same purge fresh
against current main** and force-push the result. Re-running fresh is also what makes
reconciliation unnecessary: your clone captures today's main as-is.

## ⚠️ Read before starting

- **This rewrites every commit hash in the repo.** The moment your force-push lands,
  EVERY existing clone of Hawk — Moth's, the other Mac AIs', everyone's — is stale and
  must be re-cloned (or hard-reset to the new refs) before pushing again. Anyone who
  pushes from an old clone afterwards resurrects the old history and undoes the purge.
  Links pinned to commit SHAs will break.
- **Coordinate a quiet window.** Nobody may push to Hawk between your mirror clone
  (step 1) and your force-push (step 6). If a push lands in between, your rewrite is
  based on a stale tip — re-clone and start over rather than reconciling.
- 11 branch tips forked before the dead trees were deleted from main and still hold
  dead-tree content at their tips (worst: `archive/full`, which holds all four trees —
  15,985 files — and `hark/main-staging`). Rewriting them is REQUIRED for full size
  recovery: any unrewritten ref keeps its dead blobs reachable on GitHub. The content
  is not lost either way — Moth keeps a pristine pre-purge mirror
  (`~/workspace/hawk-purge/hawk-mirror.git` on the VM).
- GitHub's reported repo size will **not** drop the moment you push — it falls only
  after GitHub's own garbage collection runs on their side. That lag is normal and is
  NOT a failure signal. Record the size you see and say so in your report.

## Procedure

Prereqs on the Mac: `git-filter-repo` installed (`pip install git-filter-repo` or
brew), ~12 GB free disk (a ~5 GB mirror clone plus the rewritten copy).

1. **Mirror-clone fresh:**
   ```bash
   git clone --mirror https://github.com/bparlette/Hawk hawk-mirror.git
   cp -a hawk-mirror.git hawk-purged.git   # work on the copy; keep the mirror pristine
   ```
2. **Record pre-state** (from the mirror, before any rewrite):
   ```bash
   git -C hawk-mirror.git rev-parse refs/heads/main            # PRE_TIP
   git -C hawk-mirror.git rev-parse 'refs/heads/main^{tree}'   # PRE_TREE
   git -C hawk-mirror.git count-objects -vH
   git -C hawk-mirror.git for-each-ref | wc -l                 # ref count (was 86)
   ```
3. **GATE — verify the four trees are absent at current HEAD:**
   ```bash
   git -C hawk-mirror.git ls-tree refs/heads/main
   ```
   `code/`, `media/`, `previews/`, `tools/` must NOT appear. **If ANY of the four is
   present at HEAD, STOP and report it in `responses/neon-hawk-purge.md` — do not
   strip live content, do not improvise.** (They were all absent on Nov 20 and nothing
   should have re-added them; this gate is what makes the purge safe.)
4. **Run the purge** on the copy, exactly these four paths, all refs:
   ```bash
   cd hawk-purged.git
   git filter-repo --invert-paths --path code --path media --path previews --path tools --force
   ```
5. **Verify the rewrite** (all must hold before pushing; if any fails, STOP and report):
   - Post-purge main tree hash **identical** to PRE_TREE:
     `git rev-parse 'refs/heads/main^{tree}'`
   - Zero objects under the four paths anywhere in history:
     `git rev-list --objects --all | grep -E '^(… )?(code|media|previews|tools)/'`
     (or equivalent — must come back empty)
   - `git fsck --connectivity-only` clean
   - `git count-objects -vH` — pack should land near ~2 GiB (Nov 20: 2.00 GiB; a bit
     above is fine — three days of new game content has landed since)
   - Ref count preserved (same count as pre-state; commits that touched only dead
     trees become empty and are pruned — Nov 20 pruned 248 — that is expected)
6. **Force-push ALL refs:**
   ```bash
   git remote add origin https://github.com/bparlette/Hawk   # filter-repo removes origin
   git push --mirror --force origin
   ```
7. **Post-push verification:**
   - `curl -I https://bparlette.github.io/Hawk/` → 200
   - Open one game page (e.g. https://bparlette.github.io/Hawk/games/toad-city/) → 200
     and loads
   - Check the repo size on GitHub (Settings or API) and record it — expect the drop
     only after GitHub-side GC (see warning above)
   - Fetch the new main tip from origin and confirm its tree hash still equals PRE_TREE
8. **Report** in `responses/neon-hawk-purge.md` (same repo, branch `main`): pre tip +
   tree hash, post tip + tree hash, pack sizes before/after, ref counts, fsck result,
   Pages checks, GitHub size as observed, and the date/time (with timezone) the
   force-push landed — every editor needs that timestamp for the re-clone warning.

## Done means

Hawk's history no longer contains `code/`, `media/`, `previews/` or `tools/` anywhere;
main's tree is byte-for-byte what it was before; Pages serves normally; and your report
is pushed at `responses/neon-hawk-purge.md`.
