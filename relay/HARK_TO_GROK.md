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
