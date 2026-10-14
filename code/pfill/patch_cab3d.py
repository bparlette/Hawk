#!/usr/bin/env python3
"""Portrait-fill patch for the Shell Shock 3D bake-off builds (A-H): the 3D view and the HUD canvas take the
container's real aspect when the viewport is portrait (taller HUD canvas, wider vertical FOV that keeps most of the
horizontal framing). Landscape / desktop keep H = 224 and the exact old framing. Idempotent (marker /*PFILL*/).

  python3 patch_cab3d.py <site_dir> [<site_dir> ...]
"""
import sys, os

K_EXP = 0.7  # vertical FOV widening: tan(v/2) *= (A0/aspect)^K_EXP  (1.0 = keep full horizontal FOV)

HELPERS = r'''
  /*PFILL*/ const H0 = 224; // portrait fill: H grows with a tall container (see resize), 224 otherwise
  function pfOn() { return H > H0; }
  function pfCam() { // portrait: widen the vertical FOV so the hero + nearby action stay framed on a tall screen
    if (typeof camera === "undefined" || !camera || camera.__pf) return; camera.__pf = 1;
    const up = camera.updateProjectionMatrix;
    camera.updateProjectionMatrix = function () {
      const f = this.fov, a = this.aspect, A = W / H0;
      if (this.isPerspectiveCamera && a < A * 0.98) { const k = Math.pow(A / a, %K%); this.fov = Math.min(100, Math.atan(Math.tan(f * Math.PI / 360) * k) * 360 / Math.PI); /* (radians -> full angle in degrees; cap ~100 deg) */ this.__efov = this.fov; up.call(this); this.fov = f; }
      else { this.__efov = f; up.call(this); }
    };
  }
  function pfBands(oy) { // menus / cards stay 384x224 in the middle of a tall screen: shade the bands around them
    ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = STATE.scene === "title" ? "rgba(6,4,12,0.5)" : "rgba(4,3,10,0.9)";
    ctx.fillRect(0, 0, W, oy); ctx.fillRect(0, oy + H0, W, H - oy - H0); ctx.restore();
  }
'''.replace('%K%', str(K_EXP))

P = [
    ('const W = 384, H = 224;', 'const W = 384; let H = 224;'),
    ('canvas.width = W * RES; canvas.height = H * RES;\n', 'canvas.width = W * RES; canvas.height = H * RES;\n' + HELPERS),
    # fill mode (full-screen button): in portrait the screen box takes all the height above the control panel
    ('let gw = vw, gh = vw * 224 / 384;', 'let gw = vw, gh = portrait ? availH : vw * 224 / 384;'),
    # HUD canvas height follows the screen box in portrait
    ('let cw = sw, ch = cw * H / W;',
     '{ const nh = (innerHeight > innerWidth && sw > 0 && sh > 0) ? Math.max(H0, Math.min(Math.round(W * 2.4), Math.round(W * sh / sw))) : H0; if (nh !== H) { H = nh; canvas.height = H * RES; } }\n    let cw = sw, ch = cw * H / W;'),
    # taps on menus map into the centred 224 band
    ('y: (e.clientY - r.top) / r.height * H }', 'y: (e.clientY - r.top) / r.height * H - (pfOn() && STATE.scene !== "stage" ? Math.round((H - H0) / 2) : 0) }'),
    # stage banners sit on the bottom edge, AREA CLEAR in the middle
    ('rect(0, 150, W, 34, "#000")', 'rect(0, H - 74, W, 34, "#000")'),
    ('ptext(B.a, W / 2, 154, 2, B.c); ptext(B.b, W / 2, 172, 1, "#fff")', 'ptext(B.a, W / 2, H - 70, 2, B.c); ptext(B.b, W / 2, H - 52, 1, "#fff")'),
    ('rect(0, 84, W, 40, "rgba(0,0,0,0.6)"); ptext("AREA CLEAR", W / 2, 98,', 'rect(0, H / 2 - 28, W, 40, "rgba(0,0,0,0.6)"); ptext("AREA CLEAR", W / 2, H / 2 - 14,'),
    # menus/cards/results: drawn at 384x224 in the middle band
    ('if (S) S[1]();', 'if (S) { if (pfOn() && STATE.scene !== "stage") { const oy = Math.round((H - H0) / 2), Hs = H; pfBands(oy); ctx.translate(0, oy); H = H0; try { S[1](); } finally { H = Hs; ctx.setTransform(RES, 0, 0, RES, 0, 0); } } else S[1](); }'),
    # particle size uses the effective FOV
    ('renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360))', 'renderer.domElement.height / (2 * Math.tan((camera.__efov || camera.fov) * Math.PI / 360))'),
]
FIT = [('camera.aspect = cw / ch; camera.updateProjectionMatrix();', 'pfCam(); camera.aspect = cw / ch; camera.updateProjectionMatrix();'),
       ('camera.aspect = PIX.w / PIX.h; camera.updateProjectionMatrix();', 'pfCam(); camera.aspect = PIX.w / PIX.h; camera.updateProjectionMatrix();')]

def patch(d):
    f = os.path.join(d, 'game.js')
    s = open(f, encoding='utf-8').read()
    if '/*PFILL*/' in s:
        print('already', d); return
    for a, b in P:
        n = s.count(a)
        if n != 1: sys.exit(f'{d}: {n} x {a[:60]}')
        s = s.replace(a, b)
    hit = 0
    for a, b in FIT:
        if s.count(a) == 1: s = s.replace(a, b); hit += 1
    if hit != 1: sys.exit(f'{d}: fit3D aspect line not found')
    open(f, 'w', encoding='utf-8').write(s)
    print('patched', d)

for d in sys.argv[1:]:
    patch(d)
