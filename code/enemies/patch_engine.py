import json, sys
M=json.load(open('/workspace/work/enemies/out/meta.json'))
def skins_js(fam, img):
    m=M[fam]; f=lambda r: json.dumps(m[r],separators=(',',':'))
    return ('{ light: { img: "%s", frames: %s }, weapon: { img: "%s", frames: %s }, big: { img: "%s", frames: %s } }'%(img,f('light'),img,f('weapon'),img,f('big')))
ROLE_OF='{ purple: "light", blue: "light", dasher: "light", sword: "weapon", star: "weapon", heavy: "big", gunner: "big" }'
BLOCK='''  // ---- Per-level regular-enemy skins ----
  // A level def may set enemySkins = { <type>: { img, frames, k?, scale? } } for any of purple/blue/star/sword/dasher/heavy/gunner.
  // frames: { idle, walk, walk2?, attack, jump?, hurt, down, grab?, dash?, throw?, shoot? } as [x, y, w, h, anchorX] in sheet px
  // (anchorX = hip x inside the frame, default the frame centre); k = world px per sheet px (default SKIN_K: a 168px walk frame
  // stands ~63px, like the turtles). Render only: states, timing and hitboxes are the engine's. A type with no skin, or whose
  // sheet is still loading, falls back to the re-hued ninja/gunner atlas. Level 1 (built in) uses L1_ENEMY_SKINS.
  const SKIN_K = 0.375, skinIm = {}, SKIN_ROLE = %s;
  const skinImg = (src) => artOk(skinIm[src] || (skinIm[src] = mkArt(src)));
  const L1_SKIN_SET = %s;
  const L1_ENEMY_SKINS = {}; for (const t in SKIN_ROLE) L1_ENEMY_SKINS[t] = L1_SKIN_SET[SKIN_ROLE[t]];
  function enemySkin(e) {
    const LV = curLV(), S = LV ? LV.enemySkins : (STATE.level || 1) === 1 ? L1_ENEMY_SKINS : null;
    const sk = S && S[e.type]; if (!sk || !sk.frames || !sk.img) return null;
    const im = skinImg(sk.img); return im ? { sk, im } : null;
  }
  function skinFrame(e, F) {
    const s = e.state, pick = (...n) => { for (const k of n) if (F[k]) return k; return "idle"; };
    if (s === "held" || s === "thrown") return pick("hurt");
    if (s === "down" || s === "dying" || (s === "getup" && e.t < 10)) return pick("down", "hurt");
    if (s === "hurt" || s === "fly") return pick("hurt");
    if (s === "grab") return pick("grab", "attack");
    if (s === "attack") return e.type === "star" ? pick("throw", "attack") : e.type === "gunner" ? pick("shoot", "attack") : e.type === "dasher" ? pick("dash", "attack") : pick("attack");
    if (e.z > 0) return pick("jump", "walk");
    if (s === "walk" && e.taunt > 0) return Math.floor(e.taunt / 10) %% 2 ? pick("walk") : "idle";
    if (e.walkT > 0) return Math.floor(e.walkT / 9) %% 2 ? pick("walk2", "idle") : pick("walk");
    return "idle";
  }
  function drawSkin(e, sx, sy, s) {
    const F = s.sk.frames, fr = F[skinFrame(e, F)] || F.idle, f = e.facing < 0 ? -1 : 1;
    const k = (s.sk.k || SKIN_K) * (s.sk.scale || 1) * (e.type === "heavy" ? 1.18 : 1), ax = fr[4] === undefined ? fr[2] / 2 : fr[4];
    const jx = e.type === "heavy" && e.state === "attack" && e.t < 16 ? (e.t %% 4 < 2 ? 1 : -1) : 0; // haymaker wind-up shudder
    drawFrame(s.im, fr, sx + jx + (fr[2] / 2 - ax) * k * f, sy, k, f);
  }
'''%(ROLE_OF, skins_js('street','levels/enemies_street.png'))
A_OLD='''  function drawNinjaAtlas(e, sx, sy) {
    if (e.type === "gunner" || e.type === "heavy") {'''
A_NEW=BLOCK+'''  function drawNinjaAtlas(e, sx, sy) {
    const skin = enemySkin(e); if (skin) return drawSkin(e, sx, sy, skin);
    if (e.type === "gunner" || e.type === "heavy") {'''
R_OLD='''      def.hues = def.hues || {};
'''
R_NEW='''      def.hues = def.hues || {};
      if (def.enemySkins) for (const t in def.enemySkins) { const s = def.enemySkins[t]; if (s && s.img) skinImg(s.img); } // start loading the level's enemy sheets
'''
H_OLD='''    hitFlash: (e) => !!(e && e.flash > 0),'''
H_NEW='''    hasSkin: (e) => !!(e && enemySkin(e)),             // true when this enemy is drawn from its level's painted enemySkins sheet
    hitFlash: (e) => !!(e && e.flash > 0),'''
for path in sys.argv[1:]:
    s=open(path).read()
    if 'function enemySkin(' in s: print(path,'already patched'); continue
    assert s.count(A_OLD)==1 and s.count(R_OLD)==1 and s.count(H_OLD)==1, path
    s=s.replace(A_OLD,A_NEW).replace(R_OLD,R_NEW).replace(H_OLD,H_NEW)
    open(path,'w').write(s); print(path,'patched')
