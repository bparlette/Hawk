# Toad City · Round 2 index

Index page: https://toad-city-r2-index-6f5e0d.surge.sh/

## How to run these sessions
1. **Send now, in parallel (each in its own fresh chat):** O1–O7 (Opus), S1–S3 (Sonnet), G1 and G3 (Gemini), H1 and H2 (Haiku), GR1 (Grok). Each AI can run several sessions at once.
2. **In every chat:** paste the prompt (Copy prompt button), attach that AI's ZIP kit.
   - **Build sessions (O1–O7, S1–S3, G2) stop for GO:** the AI's first reply is the Step 0 comprehension check only. Brad (or Hark) checks it against the private answer key. Say **GO** only when it passes; otherwise tell it to re-read the whole prompt and redo Step 0.
   - **Small sessions (G1, G3, H1, H2, GR1) deliver in one go:** the reply opens with the Step 0 answers and continues straight into the full deliverable, with no GO. Brad hands the whole reply to Hark, who checks Step 0 and reviews the deliverable.
3. **G2 (Gemini QA of Sonnet A/B) waits** until Hark says the Task A/B fix pass has landed; Hark then sends the fixed files and preview PNGs to attach.
4. **Bring back:** for Opus and Sonnet, the branch name and commit hash they push to `bparlette/hawk` (and the dist zip path); for Gemini, Haiku and Grok, the full reply (markdown or JSON). Hand each to Hark for review.
5. **After Opus/Sonnet deliveries land:** run G3's template in a new Gemini chat for each delivery, attaching the branch URL and the preview PNGs Hark sends.

## Sessions

| ID | AI | Scope | Depends on | Delivery branch | Prompt file | Page |
|---|---|---|---|---|---|---|
| O1 | Claude Opus | Pier Gulls v1.1: real mergeRig, real timings, ≥2 parts/1k tris margin, beanie <55% buried, LOD dip ≥ −2 cm, dark wingtip LOD hands | Pier Gulls v1 (f1cfba4). Parallel with O2–O7. | `claude/o1-pier-gulls-v1-1` | `prompts/round2/O1_pier-gulls-v1-1.md` | https://toad-city-r2-opus-o1-pier-gulls-v1-1-647cb4.surge.sh/ |
| O2 | Claude Opus | Cobblestone Catfish (channel catfish): 4 members + far LOD, district Fells Point, Pendry | None (parallel with O1–O7). Uses the Harbor Rats v2 reference in the ZIP. | `claude/o2-cobble-catfish` | `prompts/round2/O2_cobble-catfish.md` | https://toad-city-r2-opus-o2-cobble-catfish-9a232e.surge.sh/ |
| O3 | Claude Opus | Masked Bandits (raccoons): 4 members + far LOD, district Oriole Park, M&T Bank Stadium, Science Center | None (parallel with O1–O7). Uses the Harbor Rats v2 reference in the ZIP. | `claude/o3-masked-bandits` | `prompts/round2/O3_masked-bandits.md` | https://toad-city-r2-opus-o3-masked-bandits-942acf.surge.sh/ |
| O4 | Claude Opus | Key Highway Otters (river otters): 4 members + far LOD, district Federal Hill, Domino Sugar, Tide Point, Fort McHenry | None (parallel with O1–O7). Uses the Harbor Rats v2 reference in the ZIP. | `claude/o4-key-hwy-otters` | `prompts/round2/O4_key-hwy-otters.md` | https://toad-city-r2-opus-o4-key-hwy-otters-cf9743.surge.sh/ |
| O5 | Claude Opus | Bosses: bird_brain_bobby, raven_king, dr_shellacious, hon_queen, sugar_rush, compression_king | None (parallel with O1–O7). | `claude/o5-bosses-a` | `prompts/round2/O5_bosses-a.md` | https://toad-city-r2-opus-o5-bosses-a-495764.surge.sh/ |
| O6 | Claude Opus | Bosses: admiral_redclaw, big_jimmy, voltage_vic, chef_crabcake, arabber_al, pool_shark | None (parallel with O1–O7). | `claude/o6-bosses-b` | `prompts/round2/O6_bosses-b.md` | https://toad-city-r2-opus-o6-bosses-b-3af37f.surge.sh/ |
| O7 | Claude Opus | Bosses: dragon_boat_duchess, captain_cobblestone, penthouse_pigeon, stoop_scrubber, mister_formstone | None (parallel). Mister Formstone (O7) is built last within O7. | `claude/o7-bosses-c` | `prompts/round2/O7_bosses-c.md` | https://toad-city-r2-opus-o7-bosses-c-4d59b9.surge.sh/ |
| S1 | Claude Sonnet | USS Torsk, Lightship Chesapeake (LV-116), Pride of Baltimore II, police boat, tug, kayaks, paddle-boat dock | None (parallel with S1–S3). | `claude/s1-harbor-vessels` | `prompts/round2/S1_harbor-vessels.md` | https://toad-city-r2-sonnet-s1-harbor-vessels-f9f292.surge.sh/ |
| S2 | Claude Sonnet | National Aquarium interior (ring tank + ramp, Atlantic coral reef, shark tank) and Science Center IMAX/planetarium hall, with colliders, light anchors, spawns | None (parallel with S1–S3). | `claude/s2-setpiece-interiors` | `prompts/round2/S2_setpiece-interiors.md` | https://toad-city-r2-sonnet-s2-setpiece-interiors-b23628.surge.sh/ |
| S3 | Claude Sonnet | Bus shelter (MTA-style), boh-style tower sign (original), screens batch 2, stoop chalk, original team-style banners, snowball stand, corner-store sign set, light-rail stop | None (parallel with S1–S3). | `claude/s3-street-props-2` | `prompts/round2/S3_street-props-2.md` | https://toad-city-r2-sonnet-s3-street-props-2-ce5a57.surge.sh/ |
| G1 | Gemini Pro | Independent QA of Harbor Rats v2 (Hark fix) vs TASK_C + lessons | None. Send any time. | `— (reply in chat)` | `prompts/round2/G1_qa-harbor-rats-v2.md` | https://toad-city-r2-gemini-g1-qa-harbor-rats-v2-4aebd3.surge.sh/ |
| G2 | Gemini Pro | QA of Sonnet Task A/B after Hark's fixes (send after Hark says the fix pass landed) | Hark's Task A/B fix pass must land first (Hark tells Brad). | `— (reply in chat)` | `prompts/round2/G2_qa-sonnet-taskab-fixed.md` | https://toad-city-r2-gemini-g2-qa-sonnet-taskab-fixed-2cd88e.surge.sh/ |
| G3 | Gemini Pro | Standing QA template for every new delivery | None. Send any time. | `— (reply in chat)` | `prompts/round2/G3_qa-standing-template.md` | https://toad-city-r2-gemini-g3-qa-standing-template-66ef31.surge.sh/ |
| H1 | Claude Haiku | 200 rowhouse colour/trim/awning combos, 120 original store/bar/carryout names, 80 real-street signs, as JSON for the rowhouse kit | None. Send any time. | `— (reply in chat)` | `prompts/round2/H1_variation-tables.md` | https://toad-city-r2-haiku-h1-variation-tables-38250a.surge.sh/ |
| H2 | Claude Haiku | Delivery lint script and canary-check script (Node, no deps) | None. Send any time. | `— (reply in chat)` | `prompts/round2/H2_lint-scripts.md` | https://toad-city-r2-haiku-h2-lint-scripts-0dab7d.surge.sh/ |
| GR1 | Grok | Thug barks per gang, boss intro/defeat lines, 10 radio DJ bumpers, 2-sentence blurbs for all 16 landmarks (JSON) | None. Send any time. | `— (reply in chat)` | `prompts/round2/GR1_barks-radio-blurbs.md` | https://toad-city-r2-grok-gr1-barks-radio-blurbs-869e35.surge.sh/ |

## ZIP kits (one per AI, in handoff/round2/)
- `Toad_City_Round2_OPUS.zip`: 7693 KB
- `Toad_City_Round2_SONNET.zip`: 3254 KB
- `Toad_City_Round2_GEMINI.zip`: 10240 KB
- `Toad_City_Round2_HAIKU.zip`: 33 KB
- `Toad_City_Round2_GROK.zip`: 476 KB

## What Brad attaches
- Every session: that AI's ZIP kit (the page has a download link).
- G1: the Gemini ZIP (contains Harbor Rats v2). Hawk repo: https://github.com/bparlette/hawk (v1 branch `claude/new-session-z5ikqq`; v2 is Hark's local branch `hark/harbor-rats-fixes`, in the ZIP only unless Hark pushes it).
- G2: the Gemini ZIP plus the fixed vendor/taskAB files and after-fix preview PNGs Hark sends when the fix pass lands; original branch https://github.com/bparlette/hawk/tree/claude/new-session-j5l7sz.
- G3 (each later use): the delivery branch URL and the preview PNGs Hark sends.

Answer keys: `ANSWER_KEYS.md` (private; never on a page or in a ZIP).

## Task A/B fix status at build time
| # | Before (finding, measured) | After (fix) | Status at ZIP build |
|---|---|---|---|
| M1 | Stone water table (1.25 m band) ran across the bottom of every rowhouse door: the stoop climbed into stone (door y 0.76–2.81 vs band 0.16–1.41). | Band split around `doorU ± 0.65`, marble threshold added at the sill. | Fixed in-house |
| M2 | Arabber canopy: the half-cylinder swept theta 0..π, so it stood as a striped wall on one side of the cart. | Theta starts at π/2 so the arc spans the top. | Fixed in-house |
| M3 | Pony floated 0.20 m: leg pivot at 1.2 with 1.0 m legs. | Pivot at 1.0, hooves on y = 0. | Fixed in-house |
| M4 | Parked pickup head/tail-light glows placed twice (`fin()` on already-placed geometry): at (10, 5) yaw π/2 they floated 7 m away. | Glow quads built from fresh local geometry; cars are being rebuilt in-house anyway. | Superseded: cars rebuilt in-house (in progress) |
| M5 | Corner downspout buried in the wall (z −0.12..−0.02) and the climb hook inside the collider: blocks with seed 4 and 16 had no usable climb. | Pipe and hook moved to the front of the wall (+0.07 / +0.12). | Fixed in-house |
| M6 | Stoops and cornices overhung the block box by up to 1.83 m; your street view hid it by laying pavement outside the block. In the game the plot is raised to CURB and roads are at y 0, so stoops would hang over the road. | `opts.inset` (integration passes the plot with a 2 m inset; a 20 m box builds cleanly for 30 seeds). | Fixed in-house |
| m1 | Climb `top` and camera-box `h` measured from the kerb in Task A but world y in Task B (0.16 m apart). | World y everywhere: `CURB + parTop`. | Fixed in-house |
| m2 | Yard bin lids at the bin row centre, not on their bins. | Lid reuses the bin x. | Fixed in-house |
| m3 | Crab shack posts poke 8.5 cm through the roof, back wall stops 37 cm short, neon floats with no frame, collider misses pots/barrels/easel. | Posts cut to the roof line, frame added, collider widened. | Fixed in-house |
| m4 | Arabber 'stand' seat floated behind the cart with no step. | Rear running board; seat on it. | Fixed in-house |
| m5 | `PROP_TILES` fallback unguarded in 4 of 5 Task B files (bare ReferenceError as ES modules). | `typeof` guard and a clear error everywhere. | Fixed in-house |
| m6 | `K.makeAtlas._props`: a cache written onto a kit function. | Module-level `WeakMap`. | Fixed in-house |
| m7 | Your viewer did not run on the real kit (`applyLight` signature, pose functions, joint names): "one-line change" was several. | Round 2 ships the real kit: your viewer must run on it unchanged. | Round-2 rule (applies to your new work) |
| m8 | Dragon-boat paddles `frustumCulled = false`: a draw call and a shadow call every frame even off screen. | Fixed bounding sphere. | Fixed in-house |
| m9 | Corner bar's OPEN neon hidden behind the awning (only 'EN' showed). | Moved into the glass-block window below the awning. | Fixed in-house |
| m10 | README claims wrong: "open side windows" were dark panels; "3 casting meshes" were 2. | Measured-only README. | Round-2 rule (applies to your new work) |
| m11 | Formstone read as regular coursed stone; real Formstone is irregular faux stone. | Irregular tiles. | Fixed in-house |
| m12 | Sedan, hatch, box truck at exactly 7/7 meshes, skateboard 3/3: no headroom. | ≥ 10 % headroom required in round 2. | Round-2 rule (applies to your new work) |
| m13 | Every file exported `META`: concatenation failed with "Identifier META has already been declared". | Renamed to `META_ROWHOUSE`, `META_CORNER`, … ; round 2 requires unique `META_<MODULE>` names. | Fixed in-house |
