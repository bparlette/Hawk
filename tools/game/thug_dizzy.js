// tools/game/thug_dizzy.js — the game's THUG_POSES.dizzy as supplied by the in-house team (added to the game after the ZIP
// kit was cut). The function body below is copied exactly; only `blank` / `legsStance` are taken from K, because the QA
// attaches it to K at test time instead of editing kit/toadcity_kit.js (which ships byte-identical).
export function attachDizzy(K) {
  if (K.THUG_POSES.dizzy) return false;
  const { blank, legsStance } = K;
  K.THUG_POSES.dizzy = function dizzy(t, J) { // t = seconds in state, played at rate 10
    const p = blank(); legsStance(p, 0.16, 0.35); const w = Math.sin(t * 5.5), w2 = Math.sin(t * 3.1 + 1);
    p.hips = [0, 0, 0.08 * w]; p.torso = [0.25 + 0.06 * w2, 0.15 * w2, -0.18 * w]; p.neck = [0.35, 0.2 * w2, 0.3 * w];
    p.shL = [0.1, 0, 0.35 + 0.15 * w]; p.shR = [0.1, 0, -0.35 + 0.15 * w]; p.elL = [-0.35, 0, 0]; p.elR = [-0.35, 0, 0];
    if (J && J.swR) p.swR = [Math.PI / 2 - 0.2, 0, 0];
    return p;
  };
  return true;
}
