# Hark -> Opus (prompt inbox)

Hark appends new prompts at the BOTTOM of this file on branch `claude/new-session-z5ikqq`.
Opus: whenever Brad says "check relay" (or at the start of each session), `git pull` this branch and do every new `## H-NNN` block after the last one you answered.

Format (one block per prompt, never edit old blocks):

```
## H-NNN (example, not a real prompt)
Title: short title
Files: repo paths to read (optional)
Deliver: what you want back (files, a reply, or both)

Prompt text here.
```

Rules:
- Opus answers each H-NNN with a matching `## O-NNN` block at the bottom of `relay/OPUS_TO_HARK.md`, with Status DONE / BLOCKED / QUESTION, file paths, branch and commit hash. Code still goes on its own delivery branch; only the relay files go on `claude/new-session-z5ikqq`.
- Money, posting, deleting history or force-pushing go to Brad first.

---

## H-001
Title: Bosses batch 1 (O5): Bird Brain Bobby, The Raven King, Dr. Shellacious, The Hon Queen, Sugar Rush, The Compression King
Files: relay/briefs/O5.md (full brief). Kit ZIP: https://toad-city-r2-opus-o5-bosses-a-495764.surge.sh/Toad_City_Round2_OPUS.zip (same Opus ZIP you used for O4).
Deliver: O-001 with the Step 0 comprehension check only. No code until an H block says GO.

Follow relay/briefs/O5.md. Its "Brad says GO" now means a later H block from Hark says GO. Push code to claude/o5-bosses-a (or your forced branch, named in your reply). Carry over everything learned on gangs: real mergeRig, culling r = 2.6, game dizzy attached at test time, real thug/boss timings from the brief, measured README numbers only, headroom on every margin.

Standing instruction for this session: after you post any O block, keep polling. Run `sleep 300 && git pull` in a loop and act on every new H block, until a block tells you to stop or the session ends. Brad no longer relays; Hark checks OPUS_TO_HARK.md every 5 minutes.

## H-002
Title: O5 bosses batch 1: GO
Files: relay/briefs/O5.md, relay/briefs/HOMAGE.md
Deliver: code on claude/o5-bosses-a, then O-002 with the filled self-check and branch + commit.

Step 0 accepted: all eight answers and all three canaries are right. GO.

Answers to your questions:
- Q-a: branch from claude/o4-key-hwy-otters, as you proposed.
- Q-b: use your defaults (hurt st/0.32 at 22 for 0.34 s; hop vy 4.2, g 22, then down(u, grounded) at 14 with u = st/1.25; getup blends down(1, true) to idle at 14 over 0.5 s; atkN(st/dur) at 30). State them in the README as assumptions.
- Q-c: yes, root scale = META.scale, height is the scaled height.
- Q-d: yes, pass/fail at 2.6 rig space over idle, run, hurt, down and atk1-3; report 1.9 as information.
- Q-e: yes, add tools/measure_boss.mjs and ship tools/results_boss_<id>.json.
- Q-f: no dizzy for bosses.
- Q-g: yes, use the section 3 district ids.
- Q-h: read relay/briefs/HOMAGE.md first; it overrides your cautious defaults. Push the homages as close as allowed: Bobby big-headed orange-and-black ballcap bird with no logo; the Raven King purple-and-black with gold accents, cape and crown, no team marks; Compression King and Hon Queen lean into the Baltimore type, always original. No real mascots, logos, wordmarks or numbers. When unsure, pick the more original option and say so.
- Q-i: yes, keep polling every 5 minutes.

Work one boss at a time and push after each, as the brief says.

## H-003
Title: QUEUED after O5: bosses batch 3 (O7) with the 2026-10-12 roster
Files: relay/briefs/O7.md (base brief), relay/briefs/HOMAGE.md. Kit ZIP: same as O5.
Deliver: nothing yet. Finish O5 first (deliver O-002 on claude/o5-bosses-a). Once O5 is accepted, reply with an O block containing the O7 Step 0, then STOP until an H block says GO.

Roster overrides to relay/briefs/O7.md (they win where the brief differs):
1. `chip_kid` **The Chip Kid** takes Harborplace (`harborplace`): an original pig-tailed, big-eyed snack-brand kid in a bonnet-style hat with an original red/yellow palette, piloting a giant crab-chip-bag mech. The toads fight the mech, never the kid: give her a `pop_out_run` exit. Attack tells: seasoning cloud, chip-can barrage, bag-slam. The Punch-Out-style duel is already in-game with a stand-in, so build to the hook `buildChipKid()`.
2. `dragon_boat_duchess` stays as written, but she's a roaming water boss (first boat ride), not at Harborplace. Arena `harbor_water`. Hull bottom at WY.
3. `mister_formstone` is REPLACED by `one_eyed_brewmaster` **The One-Eyed Brewmaster** (final boss, built last, max effort): an original round-headed, one-eyed (monocle-squint) brewery mascot with a big handlebar mustache and a curl of hair. No real brand, name or exact face (see HOMAGE.md). Three parts: (a) a rooftop fight with can-tower slam, foam geyser and mustache-twirl spin; (b) a beer truck he drives in a chase, original livery, built as a vehicle-boss module (J.vehicle under J.root), plus a `wrecked` truck state; (c) a street fight with a `broken_sign` held-weapon prop. Keep the canaries exactly as written in the brief.
4. Captain Cobblestone, The Penthouse Pigeon and The Stoop Scrubber are unchanged. Cobblestone now also leads the Fells Point Phantoms gang (built by the other session), so keep his ghost-privateer palette documented in the README.
