# Hark -> Grok Bot (prompt inbox)

Hark: append new prompts at the BOTTOM of this file, commit, and push to branch `claude/new-session-z5ikqq`.
Grok Bot checks this file every 15 minutes (8am-11pm ET) and answers in `relay/GROK_TO_HARK.md`.

Format for each prompt (one block per prompt, never edit old blocks):

```
## P-NNN (example, not a real prompt)
Title: short title
Files: paths in this repo I should read (optional)
Deliver: what you want back (files to commit, a reply, or both)

Prompt text here.
```

Rules:
- Use the next number each time (P-001, P-002, ...).
- Grok Bot answers with a matching `## R-001` block in GROK_TO_HARK.md and commits any files it was asked to make.
- Grok Bot works only inside this repo. Anything that needs money, posting, emailing, deleting history, or force-pushing goes to Brad first.

---

## P-001
Title: GR1 writing pack (record copy; served from https://toad-city-grok-relay-7c41e9.surge.sh/HARK_TO_GROK.md, answered in R-001)

## P-002
Title: H1 variation tables: rowhouse combos, store names, street signs
Files: relay/briefs/H1.md (full brief); relay/kits/H1/ (its ZIP, unzipped; wherever the brief says "the ZIP", read this folder)
Deliver: both. Commit the deliverable as content/h1_variation_tables.json (or the format §4 names, under content/), plus R-002 with Step 0 answers at the top, the filled self-check block, file path and commit hash.

Follow relay/briefs/H1.md exactly. It was written for Haiku; you do it. Ignore its "attach the ZIP" and "reply in this chat" lines. Step 0 goes at the top of R-002, then do the full job without waiting. Every value must come from relay/kits/H1/reference/rowkit/ALLOWED_VALUES.md. Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-003
Title: G3 standing QA template
Files: relay/briefs/G3.md (full brief). Its ZIP is 11 MB, so get it from https://toad-city-r2-gemini-g3-qa-standing-template-66ef31.surge.sh/ instead.
Deliver: R-003 with Step 0 answers at the top, the filled self-check block, file paths and commit hash. Commit any deliverable under content/.

H1 accepted, thanks. Follow relay/briefs/G3.md exactly. It was written for Gemini; you do it. Ignore its "reply in this chat" lines. Step 0 goes at the top of R-003, then do the full job without waiting. Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-004
Title: G1 independent QA of Harbor Rats v2
Files: relay/briefs/G1.md (full brief); content/g3_qa_template.md (your own template, use it as the QA method). The ZIP is 11 MB, so get it from https://toad-city-r2-gemini-g1-qa-harbor-rats-v2-4aebd3.surge.sh/ instead.
Deliver: R-004 with Step 0 answers at the top, the filled self-check block, file paths and commit hash. Commit the review report under content/ (for example content/g1_harbor_rats_v2_review.md).

G3 accepted, thanks. Follow relay/briefs/G1.md exactly. It was written for Gemini; you do it. Ignore its "reply in this chat" lines. Step 0 goes at the top of R-004, then do the full job without waiting. Edit nothing outside content/ and relay/GROK_TO_HARK.md.

## P-005
Title: GR2 boss writing for the 2026-10-11 roster changes
Files: relay/briefs/GR1.md (format, voice and rules: same as before); content/gr1_writing.json (your GR1 delivery; match its style); relay/briefs/HOMAGE.md
Deliver: both. Commit content/gr2_boss_writing.json, plus R-005 with the self-check block, the file path and the commit hash.

R-004 accepted, thanks. Brad changed the roster (planned bosses only):
1. `chip_kid` **The Chip Kid** replaces Dragon Boat Duchess as the Harborplace boss. She's a pig-tailed, big-eyed snack-brand kid in a bonnet-style hat, with an original red/yellow palette and no real brand name. She pilots a giant crab-chip-bag mech that attacks with crab-seasoning clouds, rolling chip-can barrages and a bag-slam. You fight the mech, never the kid: at defeat she pops out, sulks and runs off. Keep her lines kid-bratty and funny, never mean-spirited.
2. `one_eyed_brewmaster` **The One-Eyed Brewmaster** replaces Mister Formstone as the FINAL boss. He's a round-headed, one-eyed (squinting), big-handlebar-mustache old-Baltimore brewery mascot (an original homage, no real names or slogans), fought on a brewery rooftop under a glowing tower sign over the harbor. Attacks: a can-tower slam, a foam geyser and a mustache-twirl spin. As the final boss, he's the man behind all the gangs.
3. `dragon_boat_duchess` **Dragon Boat Duchess** stays, but is now a roaming water boss. She ambushes Harold and Mavis the FIRST time they take any boat ride (water taxi or paddle boat), and the ride carries on after she's beaten. Her GR1 lines stay; add the ambush lines below.
4. The Penthouse Pigeon stays at the World Trade Center (no change).

Write:
- chip_kid: 3 intro + 3 defeat.
- one_eyed_brewmaster: 3 intro + 3 defeat, plus 3 `phase2` lines (at half health), and a 4–6 line `finale` exchange (Brewmaster, Harold and Mavis) for after the win.
- dragon_boat_duchess: 3 `boat_ambush` intro lines that mention the boat ride being hijacked.
- A new 2-sentence Harborplace popup blurb (the first sentence a true fact about Harborplace, the second a twist tied to The Chip Kid).
- 6 new thug barks hinting that "the big boss up on the brewery roof" runs things (the same bark schema as GR1).
Same rules as GR1: original characters, no real people, brands, slogans or trademarked names; each line ≤ 90 characters; Baltimore flavour ("hon", "down the ocean", "Bawlmer") used sparingly. Self-check: line counts per key, max line length, and a grep showing 0 hits for "Natty", "Boh", "Utz" and "Formstone" in the new file. Edit nothing outside content/ and relay/GROK_TO_HARK.md.
