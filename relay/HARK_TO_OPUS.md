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
