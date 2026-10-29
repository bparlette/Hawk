#!/usr/bin/env python3
"""Generate UniRig_on_Colab.ipynb -- free GPU route to a UniRig-rigged GLB."""
import json

def md(src):
    return {"cell_type": "markdown", "metadata": {}, "source": src.splitlines(True)}

def code(src):
    return {"cell_type": "code", "metadata": {}, "execution_count": None,
            "outputs": [], "source": src.splitlines(True)}

cells = [
md("""# UniRig on Colab — free auto-rigging for a generated cat mesh

**What this does:** takes an *unrigged* mesh (`.glb` / `.obj` / `.fbx` — e.g. a TRELLIS or Hunyuan3D cat) and returns a **rigged `.glb`** (skeleton + skinning weights) using [UniRig](https://github.com/VAST-AI-Research/UniRig) (SIGGRAPH 2025, Tsinghua + Tripo), running on Colab's free GPU instead of Meshy.

**Before you start:** Runtime → Change runtime type → **T4 GPU** (free tier is fine — UniRig needs a CUDA GPU with ≥ 8 GB VRAM; a T4 has ~15 GB).

**What you get at the end:** `*_rigged.glb` — your mesh with a UniRig skeleton and predicted skin weights. **It has no animation yet.** A walk cycle is a separate stage (keyframe it in Blender, or run the local procedural-walk script in `miso-3d-rig/rig/`).

**Honest caveats (from the UniRig repo, checked 2026-10-28):**
- The public checkpoint is trained on **Articulation-XL2.0**. The paper-grade checkpoints trained on Rig-XL/VRoid are **not released yet**, so results are good-not-magic; odd meshes can get odd skeletons. Re-run with a different `--seed` for a different skeleton variation.
- Skinning quality depends on skeleton quality — if the skeleton misses tail/ear bones, fix expectations (or the skeleton in Blender) before skinning.
- Meshes are decimated to ~50k faces during preprocessing."""),
md("## Step 0 — confirm the GPU"),
code("!nvidia-smi"),
md("""## Step 1 — Python 3.11 environment
UniRig pins `bpy==4.2` (Blender-as-a-library, used for FBX export), which only ships wheels for **CPython 3.11**. Colab's default Python is newer, so we install Miniconda and build an isolated 3.11 env. This takes a few minutes."""),
code("""!wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/mc.sh
!bash /tmp/mc.sh -b -p /opt/miniconda
!/opt/miniconda/bin/conda create -y -n unirig python=3.11 > /dev/null 2>&1
print("env ready")"""),
md("""## Step 2 — clone UniRig and install dependencies
Order matters: PyTorch (CUDA 12.1 build) first, then the CUDA extension wheels (`spconv`, `torch_scatter`, `torch_cluster`, `flash-attn`), then the repo requirements."""),
code("""%cd /content
!git clone -q https://github.com/VAST-AI-Research/UniRig.git
%cd /content/UniRig
PY = "/opt/miniconda/envs/unirig/bin/python"
!{PY} -m pip install -q torch==2.5.1 torchvision --index-url https://download.pytorch.org/whl/cu121
!{PY} -m pip install -q spconv-cu120
!{PY} -m pip install -q torch_scatter torch_cluster -f https://data.pyg.org/whl/torch-2.5.0+cu121.html
!{PY} -m pip install -q -r requirements.txt"""),
md("""`flash-attn` (in requirements.txt) sometimes tries to compile from source, which is slow. If the cell above churns for >5 minutes on flash-attn, interrupt it and run this fallback instead — it pulls a prebuilt wheel matching torch 2.5 / CUDA 12 / Python 3.11, then re-runs the rest of the requirements:"""),
code("""# FALLBACK ONLY if flash-attn tried to compile from source in the cell above.
PY = "/opt/miniconda/envs/unirig/bin/python"
!{PY} -m pip install -q https://github.com/Dao-AILab/flash-attention/releases/download/v2.7.4.post1/flash_attn-2.7.4.post1+cu12torch2.5cxx11abiFALSE-cp311-cp311-linux_x86_64.whl
!{PY} -m pip install -q -r requirements.txt"""),
md("""## Step 3 — provide your mesh
Run the next cell and upload your `.glb` (the free-generation output, e.g. the TRELLIS/Hunyuan cat). Or comment it out and copy a file from Google Drive instead."""),
code("""from google.colab import files
up = files.upload()
INPUT = "/content/" + next(iter(up))
print("INPUT =", INPUT)"""),
md("""## Step 4 — rig it (skeleton → skin → merge)
Three stages, exactly as the repo's `launch/inference/` scripts define them. The checkpoint downloads automatically from Hugging Face (`VAST-AI/UniRig`) on first run.

⚠️ In the merge step, merge the **skin** FBX (`results/cat_skin.fbx`), *not* the skeleton FBX — merging the skeleton file produces a GLB with bones but **no skinning** (the repo README calls this out explicitly)."""),
code("""import os
PY = "/opt/miniconda/envs/unirig/bin/python"
base = os.path.splitext(os.path.basename(INPUT))[0]
os.makedirs("/content/results", exist_ok=True)
!bash launch/inference/generate_skeleton.sh --input {INPUT} --output /content/results/{base}_skeleton.fbx
!bash launch/inference/generate_skin.sh --input /content/results/{base}_skeleton.fbx --output /content/results/{base}_skin.fbx
!bash launch/inference/merge.sh --source /content/results/{base}_skin.fbx --target {INPUT} --output /content/results/{base}_rigged.glb
print("done ->", f"/content/results/{base}_rigged.glb")"""),
md("""## Step 5 — download the rigged GLB"""),
code("""import os
base = os.path.splitext(os.path.basename(INPUT))[0]
files.download(f"/content/results/{base}_rigged.glb")"""),
md("""## If something breaks
- **`flash_attn` import error** → the wheel didn't match; use the Step 2 fallback cell.
- **`spconv` import error** → its per-CUDA package names are finicky; check the install table in the [spconv repo](https://github.com/traveller59/spconv) for your CUDA version.
- **Skeleton looks wrong** (missing tail, extra spine joints) → re-run Step 4's first command adding `--seed 42` (or any other integer) for a different variation.
- **Out of memory** → you are probably not on a GPU runtime (Step 0 shows nothing). UniRig has no CPU path — its own README lists a CUDA GPU with ≥ 8 GB VRAM as a requirement.
- **Then what?** The rigged GLB opens in Blender (File → Import → glTF). Animate the bones there, or feed it to the procedural-walk stage kept with this notebook in `miso-3d-rig/rig/`."""),
]

nb = {"cells": cells,
      "metadata": {"kernelspec": {"display_name": "Python 3", "name": "python3"},
                   "language_info": {"name": "python"}},
      "nbformat": 4, "nbformat_minor": 5}
out = "/home/hatch/workspace/miso-3d-rig/rig/UniRig_on_Colab.ipynb"
with open(out, "w") as f:
    json.dump(nb, f, indent=1)
print("wrote", out, "cells:", len(cells))
