# Hark -> Opus 2 (prompt inbox for Brad's second Opus session)

Hark appends new prompts at the BOTTOM of this file on branch `claude/new-session-z5ikqq`.
Opus 2: `git pull` this branch and do every new `## J-NNN` block after the last one you answered. Reply in `relay/OPUS2_TO_HARK.md` with a matching `## Q-NNN` block (Status DONE / BLOCKED / QUESTION, file paths, branch, commit hash). Never edit old blocks. Code goes on its own delivery branch; only relay files go on `claude/new-session-z5ikqq`. The other Opus session uses HARK_TO_OPUS.md / OPUS_TO_HARK.md (H/O blocks): don't answer those.
Money, posting, deleting history or force-pushing go to Brad first.

---

## J-001
Title: Bosses batch 2 (O6): Admiral Redclaw, Big Jimmy, Voltage Vic, Chef Crabcake, Arabber Al, The Pool Shark
Files: relay/briefs/O6.md (full brief). Kit ZIP: https://toad-city-r2-opus-o6-bosses-b-3af37f.surge.sh/ (download Toad_City_Round2_OPUS.zip from that page).
Deliver: Q-001 with the Step 0 comprehension check only. No code until a J block says GO.

Follow relay/briefs/O6.md. Its "Brad says GO" now means a later J block from Hark says GO. Push code to claude/o6-bosses-b. Batch 1 (O5) is running in parallel in the other Opus session, so don't touch claude/o5-bosses-a. Carry over what was learned on the gangs (see the accepted branches claude/o1..o4-*, e.g. claude/o4-key-hwy-otters): real mergeRig, culling r = 2.6 (the ZIP kit's 1.9 is stale), the game's dizzy pose attached at test time, the real thug/boss timings from the brief, measured README numbers only, and headroom on every margin.

Standing instruction: after you post any Q block, keep polling. Run `sleep 300 && git pull` in a loop and act on every new J block, until a block tells you to stop or the session ends.

## J-002
Title: QUEUED after O6: new content batch (O8): Pit Beef Pete, Kingpin Carl, Riptide Rodney, Fells Point Phantoms gang, Chompy
Files: relay/briefs/O8.md, relay/briefs/O6.md, relay/briefs/HOMAGE.md
Deliver: nothing yet. O6 comes first: post Q-001 (the O6 Step 0) if you haven't, then build O6 after GO. After O6 is delivered and accepted, reply with a Q block containing the O8 Step 0, then STOP until a J block says GO. Push O8 code to claude/o8-new-content only.

## J-003
Title: O6 bosses batch 2: GO
Files: relay/briefs/O6.md, relay/briefs/HOMAGE.md, relay/HARK_TO_OPUS.md H-002 (shared answers)
Deliver: code on claude/o6-bosses-b, pushed after each boss, then Q-002 with the filled self-check and the branch + commit.

Step 0 accepted: all eight answers and all three canaries are right. Thanks for finding the right repo. GO.

The H-002 defaults apply to you too: the timings as stated assumptions, root scale = META.scale, culling 2.6 pass/fail with 1.9 as info, tools/measure_boss.mjs + tools/results_boss_<id>.json, no dizzy, the section 3 district ids, HOMAGE.md first.

Answers to Q-a..Q-g:
- Q-a: branch from claude/o4-key-hwy-otters. Write your own tools/measure_boss.mjs now. If Opus 1 pushes one on claude/o5-bosses-a before you finish, match its JSON field names so both batches report the same way. Never touch claude/o5-bosses-a.
- Q-b: normal boss states, as you proposed. Note: the Al chase is already live in the game with a stand-in rider. Its hook is `buildArabberAl()`, returning an Object3D or `{ root, update?(dt, st) }` with st = { t, state, throwK }. Feet at y = 0, facing +z, about 1.8 m tall, seated on the cart. So export a `buildArabberAl` wrapper around your boss build that does this: the cart and pony come with Al, `run` = cart driving, and `atk` = the produce throw (throwK 0..1 drives the throwing arm). No extra states.
- Q-c: yes, as proposed. The game already ships a swim fight with a stand-in. Also export `buildBigJimmy({ THREE, toonMat, outlineMat, addOdir, QUAL })` returning `{ root, body?, soft?, mouth?, claws?: [{ arm, top, bot, tip }] x2, legs?: [left, right], flash?: [materials] }`. `soft` is the belly part he exposes when he rears up. Optional pieces can be left out.
- Q-d: no beat clock reaches the rig. The live Vic fight is a rhythm game that times his drops from its own chart, and its songs run 124–130 BPM. So keep ATTACKS on whole beats at 130 BPM as you proposed, as the defaults for the brawl version. Also export `buildVoltageVic({ THREE, stage: true })` and expose `J.pose(name, u)` so the rhythm mode can drive atk1-3 at any tempo. The DJ booth prop is welcome inside the budget.
- Q-e: yes, `J.setAngry(0..1)` plus the windup tint, exactly as you proposed. Redclaw goes deeper red.
- Q-f: yes to all three silhouettes. Redclaw also appears on his flagship deck in the Fort McHenry cannon set piece. That hook is `window.boss_admiral_redclaw.buildAdmiralRedclaw` (or a global `buildAdmiralRedclaw`), called with `{ THREE, toonMat, outlineMat, scale: 1 }`. The game rescales him to 2.6 m, so make sure his bicorne reads from far away.
- Q-g: yes, a 10-minute poll is fine.

Work one boss at a time and push after each. Suggested order: redclaw, big_jimmy, voltage_vic, arabber_al (these four already have live modes waiting on hooks), then chef_crabcake, pool_shark.

## J-004
Title: O6 accepted; go ahead with the O8 Step 0
Files: relay/briefs/O8.md, relay/briefs/HOMAGE.md
Deliver: a Q block with the O8 Step 0 (quiz answers + canaries), then STOP until a J block says GO. Code goes to claude/o8-new-content only.

Q-002 accepted: branch claude/o6-bosses-b f507212, canaries and the self-check numbers all within thresholds. Your Arabber Al, Big Jimmy, Voltage Vic and Redclaw hooks are being merged into the live build. Redclaw: J.root as the Object3D is fine.

## J-005
Title: O8 new content batch: GO
Files: relay/briefs/O8.md, relay/briefs/HOMAGE.md, relay/HARK_TO_OPUS.md H-002 (shared answers)
Deliver: code on claude/o8-new-content, pushed after each model, then Q-004 with the filled self-check, README_o8.md, branch + commit.

Step 0 accepted. Your restatements of the five deliverables, homage rule and the Phantoms toggle are right. GO. Answers:
- Q-a: yes, branch from claude/o6-bosses-b f507212.
- Q-b: no canary strings for O8; your `// tcr2 o8 <id>` line 2 is fine.
- Q-c: yes, shared PHANTOM_C in one constant. O7 will match it later.
- Q-d: yes, full boss contract (META, 3 ATTACKS, POSES idle/run/hurt/down/atk1-3) plus the named states via J.pose(name, u). Your attack mappings are approved.
- Q-e: both, as proposed.
- Q-f: as proposed (scale 1.0, no armband/stick, <= 40 parts / 12,000 tris).
- Q-g: as proposed.
- Q-h: one material per rig, as proposed.
- Q-i: yes to both.
- Q-j: as proposed. Chompy is a googly-eyed trash wheel (not a crab); keep it original.
- Q-k: defaults fine; phone line: 390x844, report merged draw calls and tris, no fixed limit beyond the O6 caps.
- Q-l: keep the 10-minute poll.
Order: pete, carl, rodney, phantoms, chompy. Push after each.

## J-006
Note: Grok stand-in rigs are done: Phantoms (66a546a) and Chompy (f6aeda2) on grok/opus-standin, so skip them. Pete, Carl and Rodney are on your branch. If those three are pushed, O8 is complete; post your delivery reply and wait for the next item.

## PING-001 (2026-10-14 10:59 UTC) — comms test from Hark
Brad asked for a comms check. Please reply in relay/OPUS2_TO_HARK.md with a block "## K-PING-001" containing: the current UTC time, your branch name, and one line on what you're working on. No other work needed for this ping.
