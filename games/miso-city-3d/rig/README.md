# Free rigging path — no Meshy required

Two working routes turn an **unrigged** generated mesh (TRELLIS / Hunyuan3D
output landing in `../free/`) into a **rigged, walk-animated GLB**:

| Route | Where it runs | Rig quality | Animation |
|---|---|---|---|
| **A. `rig_cat.py`** (this folder) | This VM, Blender headless, free | Fitted 18-bone quadruped rig, distance weights with anatomical region masks | Procedural trot walk included |
| **A2. `rig_biped.py`** (this folder) | This VM, Blender headless, free | Fitted 20-bone BIPED rig for upright Miso (arms + legs), same skinning machinery | Procedural biped walk included |
| **B. `UniRig_on_Colab.ipynb`** | Google Colab free GPU (Cherie's Google sign-in) | ML-predicted skeleton + skinning (UniRig) | None — add walk afterwards in Blender |

Route A is the one proven end-to-end here (see test results below).
Route B exists because UniRig **cannot run on this VM at all** (see
"UniRig reality check").

## Route A — local Blender pipeline

```bash
~/workspace/tools/blender-4.2.3-linux-x64/blender --background \
  --factory-startup --python rig_cat.py -- INPUT.glb OUTPUT.glb STILLS_DIR [facing]
```

- `facing`: `auto` (default — detected from a source skeleton's Head/Tail
  bones if present, else the longer horizontal axis), or `+x/-x/+y/-y`.
- What it does: strips any imported rig/animations → preserves world
  transforms → drops stray debris meshes (<10% of the largest mesh's
  verts) → normalises scale (longest horizontal side = 0.55 m) → builds an
  18-bone rig (root, spine, neck, head, tail×2, 4 legs × 3) fitted from
  the bounding box → skins with numpy distance weights (top-4 influences)
  constrained by anatomical region masks → authors a 24-frame trot cycle
  (diagonal leg pairs FL+HR / FR+HL, lower-leg fold on swing, body bob,
  head counter-bob, tail sway) → exports GLB with skin + `Walk` animation
  → renders 3 proof stills.
- Rendering used **Cycles CPU** for the proof stills. (Workbench/EEVEE
  need `libEGL.so.1`, which was missing when the pipeline was built; the
  sandbox's apt run eventually installed `libegl1` after ~18 minutes in
  the background, and a Workbench render of the rigged cat has since been
  verified working — future runs can use Workbench for much faster
  stills.)

### Watch out (lessons from the test run)
- **Region masks matter.** Pure distance weights let the front-leg bones
  claim the muzzle (it sits right above them) and drag the face around at
  max stride. The masks restrict legs to their own f-range/side and bar
  them from the head zone entirely. The script prints the muzzle vertex's
  top influences as a sanity check.
- **Don't cap leg weights by height** — that amputates the thigh (its top
  is inside the body silhouette) and the leg shears at max swing. The
  f-range does the anatomical separation on its own.
- Source GLBs may hide their real scale on a parent node (the test cat's
  ×100 sat on its armature). The script snapshots `matrix_world` before
  deleting parents — skipping that step shrinks the mesh 100×.

## UniRig reality check (from the repo, 2026-10-28)

Source: github.com/VAST-AI-Research/UniRig README + requirements.txt,
commit `6793c66`.

- **System requirement, verbatim:** "For generation: CUDA-enabled GPU
  with at least 8GB VRAM." Inference configs hardcode `accelerator: gpu`.
  `requirements.txt` includes `flash_attn` (CUDA-only) and the install
  steps require `spconv-{cuda}`, CUDA builds of `torch_scatter` /
  `torch_cluster`. **This VM has no GPU** (no `nvidia-smi`, no VGA in
  `lspci`; 2 CPU cores, 7.7 GB RAM) → local UniRig is not a thing here.
- **What the public release actually is:** code for skeleton prediction
  AND skinning prediction, plus ONE checkpoint (skeleton + skinning)
  trained on **Articulation-XL2.0**, hosted at huggingface.co/VAST-AI/UniRig
  and auto-downloaded by the scripts. The paper-grade checkpoints trained
  on **Rig-XL / VRoid are NOT released yet** ("Planned Future Releases").
  Bone-attribute prediction (physics stiffness) is "Coming Soon".
- **Pipeline shape:** `generate_skeleton.sh` (mesh → skeleton FBX) →
  `generate_skin.sh` (→ skinned FBX) → `merge.sh` (→ rigged GLB). Merge
  must use the **skin** FBX; merging the skeleton FBX yields bones with
  no skinning. Inputs are decimated to ~50k faces in preprocessing.
  `--seed` gives alternate skeletons.
- It also pins `bpy==4.2` (Blender as a Python library, for FBX export),
  which needs CPython 3.11 — hence the Miniconda env in the Colab
  notebook (Colab's default Python is newer).
- A successor project, **SkinTokens**, is announced at the top of the
  README (unified skeleton+skin tokens, RL-tuned). Worth re-checking
  before investing in UniRig long-term.
- Community wrappers exist (a ComfyUI-UniRig node; a Replicate port) —
  same weights, friendlier packaging, if Colab friction becomes the
  bottleneck.

## Test results (Route A, 2026-10-28)

Test dummy: "Cat" by **Quaternius** (CC0), via Poly Pizza
(`static.poly.pizza/67f5e3fe-37ee-4c86-95c8-d269d8c9f8ba.glb`), saved as
`test-cat-quaternius.glb`. Its own rig/animations were stripped; the mesh
was re-rigged from scratch by `rig_cat.py`.

- Output: `test-cat-rigged-walk.glb` — 1 skin, **18 joints**, 1 animation
  `Walk` (54 channels), 2,276 verts.
- Numeric proof: the front-left paw vertex travels y −0.094 → −0.017
  (lifted, z 0.054) → −0.132 → −0.184 across frames 1/7/13/19 — a full
  stride sweep with mid-swing lift, in the exported file itself.
- Visual proof: `stills/walk_phase0.png`, `walk_phase25.png`,
  `walk_phase50.png` — diagonal pairs alternate; head/body stay coherent
  at max stride.
- Known limits: distance-weight skinning gives a slightly hard hinge at
  leg joints on chunky low-poly meshes; the tail reads stiff in stills
  (its sway is subtle from the proof camera). Both are cosmetic; the
  pipeline is the deliverable.

## When the real Miso mesh lands in `../free/`

```bash
~/workspace/tools/blender-4.2.3-linux-x64/blender --background \
  --factory-startup --python rig_cat.py -- \
  ../free/<miso>.glb ../free/<miso>-rigged-walk.glb ../free/stills
```

Facing auto-detection needs a source skeleton, which TRELLIS/Hunyuan
meshes don't have — it falls back to "longer horizontal axis = forward,
+ direction". If Miso comes out moonwalking, re-run with the explicit
facing argument (e.g. `-y`) — the landmark fractions assume a generic
quadruped silhouette and may want a tweak for a big-headed chibi cat
(head zone starts at f=0.84).

## Route A2 — biped variant (`rig_biped.py`)

Miso is an anthropomorphic chibi cat: he runs on **two legs**, has arms
(he throws yarn balls), and a tail. The quadruped rig can't pose that
body, and Meshy's animal auto-rig only offers "Quadruped Dog" — so this
variant exists. Same CLI shape and machinery as `rig_cat.py` (strip rigs,
world-transform snapshot, debris drop, distance-weight skinning with
region masks, GLB export, proof stills — Workbench here, it's fast):

```bash
~/workspace/tools/blender-4.2.3-linux-x64/blender --background \
  --factory-startup --python rig_biped.py -- INPUT.glb OUTPUT.glb STILLS_DIR [facing]
```

- **Skeleton (20 bones):** root, hips, spine, chest, neck, head,
  tail.01/02, and per side thigh/shin/foot + upperarm/forearm/hand.
  Fitted from the bounding box for a chibi silhouette (head = top ~32%,
  scale normalised so standing height = 1.0 m). Region masks are
  height/side bands; the quadruped muzzle lesson applies double — the
  oversized head sits right beside the shoulders, so arm bones are
  capped below the head zone and pushed outboard, and the sanity prints
  check head-top / hand-zone / foot-zone influences every run.
- **Walk (24-frame loop, named `Walk`):** alternating strides reusing
  rig_cat's proven downward-bone phase formulas (knee fold peaks as the
  leg swings forward, lifting the foot), arms swinging opposite the
  same-side leg with a forward elbow flex, root bob 0.018 m twice per
  cycle + hip twist, spine/chest forward lean with shoulder
  counter-twist, head counter-bob, tail sway.
- **Facing:** `auto` = skeleton hint if present, else forward is the
  SHORTER horizontal axis (a standing biped is wider than deep), signed
  by the feet (toes protrude further than heels at ground level), with
  tail-band vertex counts as tiebreak. Still a heuristic on generated
  meshes — check the stills; re-run with `+x/-x/+y/-y` if he moonwalks.
- **Deliberate difference from rig_cat:** the debris filter drops a mesh
  only if it is small in BOTH vertex count (<10% of largest) AND extent
  (<10% of total diagonal). rig_cat's verts-only rule would amputate a
  multi-part character (a 24-vert foot box next to a 1,488-vert head
  sphere) — it fired on the first biped test run and took the legs,
  feet, ears and tail with it.

### Test results (Route A2, 2026-10-28)

Test dummy: procedural character built in Blender by
`make_test_biped.py` (`test-biped.glb`) — sphere head (35% of height
with ears) + muzzle, capsule body, green scarf torus, cylinder arms/legs,
box feet, two-segment tail; faces +X, unrigged.

- Output: `test-biped-rigged-walk.glb` — 1 skin, **20 joints**, 1
  animation named `Walk` in the file, 15,204 verts.
- Facing auto-detect: forward `[1,0,0]` via the feet cue — correct.
- Skinning sanity: head-top vertex → head 0.9; hand-zone vertex →
  hand.L 0.67 / forearm.L 0.29 (head influence 0.0 — no cheek-drag);
  foot-zone vertex → foot.L 0.78 / shin.L 0.22.
- Numeric proof (`verify_biped.py`, reads the exported GLB fresh): each
  foot sweeps **0.471 m** forward/back; foot z peaks **+0.151 m** above
  its planted height mid-swing; L/R foot-height correlation **−0.58**
  (alternating gait); pelvis bob amplitude **0.018 m** (as keyed); head
  forward drift only 0.033 m across the cycle.
- Visual proof: `stills-biped/walk_phase0.png`, `walk_phase25.png`,
  `walk_phase50.png` — stride split, passing pose, and opposite leg
  lifted with folded shin; head/scarf coherent at max stride.
- Known limits: distance-weight skinning still gives a hard-ish hinge at
  knees/elbows on chunky meshes, and the shoulder is the soft spot —
  upperarm weights are distance-based inside a tight mask, so a mesh
  whose arms rest tight against a very wide head may show slight
  shoulder/cheek pull at full arm swing; watch the first real-Miso
  stills there. The belly bottom can tug slightly toward the thighs
  (centre verts sit close to both thigh bones). Stride/bob amplitudes
  are cartoon-large (0.47 m stride, 0.15 m foot lift on a 1 m character)
  — deliberate for a bouncy chibi walk; tame AMP_T / the shin fold in
  the walk section if the real mesh reads too springy.

### When the real (biped) Miso mesh lands in `../free/`

He stands on two legs, so use the biped pipeline, NOT rig_cat.py:

```bash
~/workspace/tools/blender-4.2.3-linux-x64/blender --background \
  --factory-startup --python rig_biped.py -- \
  ../free/<miso>.glb ../free/<miso>-rigged-walk.glb ../free/stills-biped
```

Check the stills for facing and shoulder behaviour; if he's backwards,
re-run with the explicit facing argument (TRELLIS/Hunyuan exports vary).

## Files

- `rig_cat.py` — Route A pipeline (Blender 4.2, headless).
- `rig_biped.py` — Route A2 pipeline: biped variant (Blender 4.2, headless).
- `make_test_biped.py` — builds the procedural biped test character.
- `test-biped.glb` — unrigged procedural biped test dummy.
- `test-biped-rigged-walk.glb` — Route A2 output on the dummy.
- `verify_biped.py` — numeric gait verification for a rigged biped GLB.
- `stills-biped/` — Route A2 proof renders (Workbench, 640×480).
- `run-biped.log` — last Route A2 pipeline run log.
- `UniRig_on_Colab.ipynb` — Route B notebook (16 cells; prepared, not
  executed — needs Cherie's signed-in Colab + a GPU runtime).
- `make_notebook.py` — regenerates the notebook.
- `test-cat-quaternius.glb` — CC0 test dummy (Quaternius via Poly Pizza).
- `test-cat-rigged-walk.glb` — Route A output on the dummy.
- `stills/` — proof renders (Cycles CPU, 640×480, 32 samples; Workbench
  is available now too — see the Route A note above).
- `run.log` — last pipeline run log.

## Route A2b — procedural MISO likeness (make_miso_biped.py)

`make_test_biped.py`'s dummy proved the rig but looked nothing like
Miso. `make_miso_biped.py` builds an actual Miso from smooth subdivided
primitives, proportioned from measurements of the reference sprite
(720×846, character 695×820 px; fractions of total height):

- head + ears 0.52 H (skull ~0.44 H); head width 0.60 H vs body 0.36 H
- scarf band z 0.35–0.47, hanging end to chest level on his left
- legs + feet = bottom 0.18 H (stubs, per Cherie's photo frame
  `../miso-reference-photo.jpg`, which supersedes the painting:
  tail tip only reaches ~hip height z~0.52, whisker marks on cheeks)

All parts are joined into ONE mesh (18,276 verts, 8 materials) so the
rigger's debris filter can't amputate small parts (eyes, whiskers).
Build → rig → stills:

```bash
blender --background --factory-startup --python make_miso_biped.py
blender --background --factory-startup --python rig_biped.py -- \
  miso-biped.glb miso-biped-rigged-walk.glb stills-miso +x
blender --background --factory-startup --python render_miso_beauty.py
# extra front 3/4 still -> stills-miso/beauty_phase0.png
```

Known limits (eyeballed against Cherie's photo): coat renders
tan-ginger under Workbench light vs the photo's brighter orange; the
cream belly is a slightly-proud patch and can read as stuck-on from
3/4 angles; the tail is centred behind the body (rig_biped's tail
bones are centred) so it's mostly hidden from the front, where the
photo shows it up his right side; whisker dashes on the far cheek can
float a hair past the cheek edge. Face is primitives only — no painted
texture, mouth line, or toe beans.
