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
