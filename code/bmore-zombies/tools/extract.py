#!/usr/bin/env python3
"""Copy the Toad City Baltimore modules Dead Streets reuses, verbatim, out of the live integration worktree
(/workspace/work/toad-city/game-int, branch hark/integration). Read-only on the Toad City repo.
Same extraction as Toad City Paperboy (bmore-paperboy/tools/extract.py). Each copied file gets a provenance header.
Patches are tiny, listed here, and asserted:
  01_core.js   : POST shader HD branch gains a screen-space comic halftone in the shadows (uHT uniform)
  03_city.js   : only the builder classes, props, buildings and sky are taken (no world layout);
                 `const CB/DB/OL/GB` -> `let`
  03b / 03f    : the HD builder (HB), sign atlas (SA), sText, B3 helpers, and the World Trade Center + Fells Point
                 landmark builders, unchanged; lmHD() is redefined by this game (10_dz_world.js) to just register them
"""
import subprocess, os
SRC = '/workspace/work/toad-city/game-int/src'
OUT = os.path.join(os.path.dirname(__file__), '..', 'src')
os.makedirs(OUT, exist_ok=True)
rev = subprocess.run(['git', '-C', os.path.dirname(SRC), 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True).stdout.strip()

def lines(f): return open(os.path.join(SRC, f), encoding='utf-8').read().split('\n')
def idx(L, pred, start=0):
    for i in range(start, len(L)):
        if pred(L[i]): return i
    raise SystemExit('anchor not found')
def hdr(f, what): return f'// ===== copied from Toad City Baltimore src/{f} @ hark/integration {rev} ({what}) =====\n'
def put(name, text): open(os.path.join(OUT, name), 'w', encoding='utf-8').write(text); print('wrote', name, len(text))

core = open(os.path.join(SRC, '01_core.js'), encoding='utf-8').read()
old = "if (uPost < 0.5) { gl_FragColor = vec4(c, 1.0); return; } // HD: straight copy"
assert old in core
new = ("if (uPost < 0.5) { // HD: straight copy + (Dead Streets) comic halftone dots in the shadows\n"
       "        float lum = dot(c, vec3(0.299, 0.587, 0.114)); vec2 hp = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / uHT;\n"
       "        float k = clamp((0.3 - lum) * 2.6, 0.0, 0.8), dd = length(fract(hp) - 0.5), rr = sqrt(k) * 0.5;\n"
       "        c = mix(c, c * vec3(0.55, 0.5, 0.68), (1.0 - smoothstep(rr - 0.07, rr + 0.03, dd)) * step(0.02, k) * 0.7);\n"
       "        gl_FragColor = vec4(c, 1.0); return; }")
core = core.replace(old, new)
old2 = "uniform sampler2D tSrc; uniform vec2 uRes; uniform float uDither; uniform float uPost; varying vec2 vUv;"
assert old2 in core
core = core.replace(old2, "uniform sampler2D tSrc; uniform vec2 uRes; uniform float uDither; uniform float uPost; uniform float uHT; varying vec2 vUv;")
old3 = "uPost: QUAL.post },"
assert old3 in core
core = core.replace(old3, "uPost: QUAL.post, uHT: { value: 5.0 } },")
put('01_core.js', hdr('01_core.js', 'renderer, PS1/HD toon material, ink-outline hulls; halftone patch') + core)

put('02_atlas.js', hdr('02_atlas.js', 'city atlas: facades, storefronts, real-name signs, ground tiles') + open(os.path.join(SRC, '02_atlas.js'), encoding='utf-8').read())

L = lines('03_city.js')
a = 0; b = idx(L, lambda s: s.startswith('function sbox('))
part1 = L[a:b + 1]
part1 = [s.replace('const CB = new CMB(), DB = new CMB(), OL = new OB(), GB = new CMB();', 'let CB = new CMB(), DB = new CMB(), OL = new OB(), GB = new CMB();') for s in part1]
assert any(s.startswith('let CB = new CMB()') for s in part1)
c = idx(L, lambda s: s.startswith('const CURB = 0.16'))
d0 = idx(L, lambda s: s.startswith('function building(')); d1 = idx(L, lambda s: s.startswith('// street furniture along the one block'))
e0 = idx(L, lambda s: s.startswith('const LAMPS = [];')); e1 = idx(L, lambda s: s.startswith('function tree(')); e2 = idx(L, lambda s: s == '}', e1)
f0 = idx(L, lambda s: s.startswith('const SKY = (function sky()')); f1 = idx(L, lambda s: s.startswith('})();'), f0)
txt = '\n'.join(part1 + [L[c]] + L[d0:d1] + L[e0:e2 + 1] + L[f0:f1 + 1]) + '\n'
put('03_kit.js', hdr('03_city.js', 'merged city builders, building(), street props, cars, lamps, trees, sky dome; world layout not copied') + txt)

L = lines('03b_landmarks_hd.js')
g1 = idx(L, lambda s: s.startswith('const LMHD = {'))
w0 = idx(L, lambda s: s.startswith('// ======================= WORLD TRADE CENTER')); w1 = idx(L, lambda s: s.startswith('// ======================= POWER PLANT COMPLEX'))
put('03b_hd.js', hdr('03b_landmarks_hd.js', 'HD builder HB, sign atlas SA, sText, World Trade Center builder') + '\n'.join(L[:g1] + L[w0:w1]) + '\n')

L = lines('03f_landmarks_hd_b3.js')
b1 = idx(L, lambda s: s == '};')
p0 = idx(L, lambda s: s.startswith('// ======================= FELLS POINT - Thames St')); p1 = idx(L, lambda s: s.startswith('// ======================= UNDER ARMOUR'))
put('03f_fells.js', hdr('03f_landmarks_hd_b3.js', 'B3 helpers + Fells Point Thames St rowhouse block with its real signs') + '\n'.join(L[:b1 + 1] + L[p0:p1]) + '\n')

put('04_actors.js', hdr('04_actors.js', 'Harold + Mavis + thug rigs, poses') + open(os.path.join(SRC, '04_actors.js'), encoding='utf-8').read())
put('04b_rig_merge.js', hdr('04b_rig_merge.js', 'rig merge: each rig -> a few skinned meshes') + open(os.path.join(SRC, '04b_rig_merge.js'), encoding='utf-8').read())
put('05_fx.js', hdr('05_fx.js', 'comic FX sprites + WebAudio sfx') + open(os.path.join(SRC, '05_fx.js'), encoding='utf-8').read())
print('rev', rev)
