# build_life_wave2.py — Bake City Life Ped Variety Wave 2 (6 x 16-angle peds) & 2 Car Color Variants via Blender
# Usage: /opt/homebrew/bin/blender -b -P tools/build_life_wave2.py
# Outputs: shots/life-sprites/*.webp (exact game scale UPM=10, 1032x344 peds, 1024x512 cars)
import os, sys, time, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bake_sprites_v2 as B

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'shots', 'life-sprites')
TMP = '/tmp/life_wave2_tmp'
os.makedirs(OUT, exist_ok=True)
os.makedirs(TMP, exist_ok=True)

# Override output/tmp paths on bake_sprites_v2 module without touching assets/ or manifest.json!
B.OUT = OUT
B.TMP = TMP

NEW_PEDS = [
    # Beach
    ('beach_surfer',     '#32d6c8', '#ff6854', '#d89b6e', '#ecd06a', 'cap',  '#f0d878'),
    ('beach_resort',     '#ff5e82', '#e8c688', '#e6b28a', '#3d281c', 'hat',  '#fff0d0'),
    # Business
    ('biz_suit',         '#243456', '#1c2234', '#eec09c', '#2c1e16', None,   '#1a1210'),
    ('biz_exec',         '#f2e4cc', '#2f787e', '#cc8d64', '#5c2a1a', None,   '#422518'),
    # Night crowd
    ('night_clubber',    '#ff3ea5', '#18162b', '#c28358', '#1a1424', None,   '#f4f2ff'),
    ('night_velvet',     '#3ee8ff', '#222434', '#7a4930', '#14101c', None,   '#14121c'),
]

NEW_CARS = [
    ('conv_sunset',    'convertible', '#ff7832'),
    ('sedan_lavender', 'sedan',       '#b87cff'),
]

B.reset()
sh_ped_saved = False
for name, shirt, pants, skin, hair, headwear, shoes in NEW_PEDS:
    t0 = time.time()
    root, limbs = B.build_ped(shirt, pants, skin, hair, headwear, shoes)
    col, sh = [], []
    scx, scy = B.SHADOW_DIR.x * 3.6, B.SHADOW_DIR.y * 3.6
    for k in range(B.PED_ANGLES):
        th = k * 2 * math.pi / B.PED_ANGLES
        root.rotation_euler = (0, 0, -th - math.pi / 2)
        for stride in B.PED_POSES:
            B.pose_ped(limbs, stride)
            B.set_pass('color')
            B.frame(0, 0, B.PED_FRAME, B.PED_FRAME, B.PED_PPM)
            B.render(f'{TMP}/c.png')
            col.append(B.ink(B.kuwahara(B.load_np(f'{TMP}/c.png'), 1), 0.6, 0.2))
            if not sh_ped_saved:
                B.set_pass('shadow')
                B.frame(scx, scy, B.PED_SH_FRAME, B.PED_SH_FRAME, B.PED_SH_PPM)
                B.render(f'{TMP}/s.png')
                sh.append(B.shadow_to_alpha(B.load_np(f'{TMP}/s.png')))
    cols = len(B.PED_POSES) * 4
    B.save_np(B.sheet(col, cols), f'{OUT}/ped_{name}.webp')
    if not sh_ped_saved:
        B.save_np(B.sheet(sh, cols), f'{OUT}/ped_life_sh.webp')
        sh_ped_saved = True
    B.clear_asset()
    print(f'ped {name} baked in {time.time() - t0:.1f}s', flush=True)

for name, kind, paint in NEW_CARS:
    t0 = time.time()
    root = B.build_car(kind, paint)
    col, sh = [], []
    scx, scy = B.SHADOW_DIR.x * 1.2, B.SHADOW_DIR.y * 1.2
    for k in range(B.CAR_ANGLES):
        th = k * 2 * math.pi / B.CAR_ANGLES
        root.rotation_euler = (0, 0, -th - math.pi / 2)
        B.set_pass('color')
        B.frame(0, 0, B.CAR_FRAME, B.CAR_FRAME, B.CAR_PPM)
        B.render(f'{TMP}/c.png')
        col.append(B.paint_finish(B.load_np(f'{TMP}/c.png'), kuw_r=2, stroke_r=2, stroke_s=0.28, line=0.68, inner=0.32))
        B.set_pass('shadow')
        B.frame(scx, scy, B.CAR_SH_FRAME, B.CAR_SH_FRAME, B.CAR_SH_PPM)
        B.render(f'{TMP}/s.png')
        sh.append(B.shadow_to_alpha(B.load_np(f'{TMP}/s.png')))
    B.save_np(B.sheet(col, 8), f'{OUT}/car_{name}.webp')
    B.save_np(B.sheet(sh, 8), f'{OUT}/car_{name}_sh.webp')
    B.clear_asset()
    print(f'car {name} baked in {time.time() - t0:.1f}s', flush=True)

print('CITY LIFE WAVE 2 BAKE COMPLETE!')
