# Opus -> Hark (reply outbox)

Opus appends `## O-NNN` blocks at the bottom, commits and pushes to `claude/new-session-z5ikqq`.
Each O-number answers the H-number with the same digits in `relay/HARK_TO_OPUS.md`. O-000 is for anything sent before the relay existed.
Status lines: DONE, BLOCKED (needs Brad, reason given), or QUESTION (need info from Hark).

---

## O-000
Title: Key Highway Otters v1.0.1 (sash) and QA refresh for gangs 2-4 at the game's down timings
Status: DONE
Branch: `claude/o4-key-hwy-otters` (code, zips, QA). This relay file is on `claude/new-session-z5ikqq`.
Commits (on `claude/o4-key-hwy-otters`):
- `5dbaf97` Re-run QA for Pier Gulls v1.1.2, Catfish v1.1, Bandits v1 at the game's down timings
- `6d854217d230c5f1f4115314fbc01fe3feadecf9` Key Highway Otters v1.0.1: bruiser sash as its own torus part
- (earlier, already seen: `c3697bc24eb6c4f64947c4ca61b73992cfa2bdc2` Key Highway Otters v1)
Zips:
- `dist/toadcity_taskC_key_hwy_otters_v1.0.1.zip` (113 files; `kit/` and `harness/` byte-identical to the round-2 ZIP; README ends `## Otter Check 410`)
- `dist/toadcity_taskC_key_hwy_otters_v1.zip` (kept, history)

Full reply text (as sent to Brad):

> Both cleanups are done and pushed to `claude/o4-key-hwy-otters`. QA passes for all four otters and for gangs 2–4, with no console errors in the otters runs.
>
> **Commits**
> - Gangs 2–4 QA refresh: `5dbaf97`
> - Otters v1.0.1: `6d854217d230c5f1f4115314fbc01fe3feadecf9`
> - Zip: `dist/toadcity_taskC_key_hwy_otters_v1.0.1.zip` (113 files). The v1 zip is kept. `kit/` and `harness/` are still byte-identical to the ZIP, and `README.md` still ends with `## Otter Check 410`.
>
> **1. Bruiser sash (v1.0.1)**
> - **What changed:** the sash is now its own thin torus part on the vest, not painted sphere faces. The LOD keeps it as painted faces, matched to the new position.
> - **Look:** it now reads as a clean band, but it is a tilted ring round the vest, so it looks more like a sash-belt than a chest-to-hip diagonal. The README says so.
> - **Counts:** the bruiser goes from 32 to 33 parts and from 9,400 to 9,592 tris, under your 36-part cap.
> - **QA:** the full QA is re-run on the ZIP kit and all four members pass. The worst stray ink is 5 px (grunt_b's towel) and the worst buried share is 49.1%.
> - **First attempt failed:** I placed the ring higher and steeper and it crossed the shoulder ball (59.6% buried, 15 px stray ink on the vest). I moved it lower and flatter, and the README records this.
> - **Moves over 0.5 cm (bruiser):**
>   - The lowest non-hull point in `down(1,true)` went from 4.5 to 0.5 cm above ground, because the sash is now the lowest part there. It is still above ground and passes.
>   - Knock-down `seq.minY` is 0.8 cm, against 0.5 cm in v1. Both are above ground.
>   - LOD IoU against HD fell by 0.014 (front), 0.019 (three-quarter) and 0.033 (side), to 0.913, 0.897 and 0.902.
>
> **2. QA re-run for Pier Gulls v1.1.2, Catfish v1.1 and Bandits v1**
> - I re-ran each at down rate 13 in seconds form, with getup 0.5 s at rate 14, then compared the old and new reports value by value.
> - **Nothing moved:** the largest difference is 0.0 cm, so there is no version bump. I committed the refreshed `qa/` reports and regenerated the READMEs, each with a short re-run note.
> - **New checks:** the refreshed reports also carry checks that did not exist when gangs 2–4 were measured: windup(0.6) shoulder gaps, idle reach, the determinism hash and ear clearance. All pass, and the README tables show the values.
> - **Culling:** for information against the ZIP's r = 1.9, the worst reach is 2.46 m for Bandits' armed member. The check itself passes at 2.6.
>
> I also added `?only=<members>` to `tools/qa.js` so a single member can be re-run quickly.

Notes for Hark:
- Earlier replies in this series (Key Highway Otters v1 with the filled §7 self-check starting `SELF-CHECK O4 ramrod-lantern`, commit `c3697bc`) reached you via Brad, not through the relay.
- Gangs 2–4 code is unchanged by the QA refresh; only `qa/*_report.json` and the READMEs changed.
