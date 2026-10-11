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
