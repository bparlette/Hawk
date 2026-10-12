// tools/boss_seq.js — the boss state timings used by every boss test (Node harness and browser viewer share this file).
// The game's boss branch was not available; these are Hark's H-002 / J-003 defaults, stated as assumptions in README_bosses.md:
//   idle / run          POSES.idle(t) / POSES.run(t, 5)      rate 14
//   attack N            POSES.atkN(st / dur)                 rate 30, for ATTACKS[N].dur seconds
//   hurt                POSES.hurt(min(st / 0.32, 1))        rate 22, 0.34 s
//   knock-down          hop vy 4.2, gravity 22 (root y), then POSES.down(st / 1.25, grounded)   rate 14, 1.25 s
//   getup               POSES.idle(t) blended from down(1, true) by damping                       rate 14, 0.5 s
// animateBoss(J, t, state, u) receives the game state name: 'idle' | 'run' | 'hurt' | 'down' | 'atk1' | 'atk2' | 'atk3'
// (getup reports 'idle', as lesson A9 asks).
export const RUN_SPEED = 5;
export const HOP = { vy: 4.2, g: 22 };
export function seqList(name, ATTACKS) {
  const atk = (i) => ['atk', ATTACKS[i].dur, ATTACKS[i].pose];
  const S = {
    knockdown: [['idle', 0.4], ['hurt', 0.34], ['down', 1.25], ['getup', 0.5], ['idle', 0.5]],
    hurt: [['idle', 0.4], ['hurt', 0.34], ['idle', 0.6]],
    run: [['idle', 0.3], ['run', 1.2], ['idle', 0.5]],
    atk1: [['idle', 0.4], atk(0), ['idle', 0.6]],
    atk2: [['idle', 0.4], atk(1), ['idle', 0.6]],
    atk3: [['idle', 0.4], atk(2), ['idle', 0.6]],
  };
  // 'chain': every state back to back, including attack -> hurt -> down and run -> attack transitions
  S.chain = [['idle', 0.3], ['run', 0.8], atk(0), ['hurt', 0.34], atk(1), ['run', 0.6], atk(2), ['hurt', 0.34], ['down', 1.25], ['getup', 0.5], ['idle', 0.4]];
  return S[name];
}
export const SEQ_NAMES = ['knockdown', 'hurt', 'run', 'atk1', 'atk2', 'atk3', 'chain'];
// evaluate the sequence at time tt (seconds): returns { p (pose), rate, state, u, y (root lift) }
export function seqAt(P, J, list, tt) {
  const tot = list.reduce((a, s) => a + s[1], 0); let st = tt % tot;
  for (const seg of list) {
    const [kind, dur, pose] = seg;
    if (st <= dur || seg === list[list.length - 1]) {
      if (kind === 'atk') { const u = Math.min(st / dur, 1); return { p: P[pose](u, J), rate: 30, state: pose, u, y: 0 }; }
      if (kind === 'hurt') { const u = Math.min(st / 0.32, 1); return { p: P.hurt(u, J), rate: 22, state: 'hurt', u, y: 0 }; }
      if (kind === 'down') {
        const air = 2 * HOP.vy / HOP.g, y = st < air ? HOP.vy * st - 0.5 * HOP.g * st * st : 0;
        const u = Math.min(st / 1.25, 1); return { p: P.down(u, st >= air, J), rate: 14, state: 'down', u, y };
      }
      if (kind === 'getup') return { p: P.idle(tt, J), rate: 14, state: 'idle', u: Math.min(st / 0.5, 1), y: 0 };
      if (kind === 'run') return { p: P.run(tt, RUN_SPEED, J), rate: 14, state: 'run', u: 0, y: 0 };
      return { p: P.idle(tt, J), rate: 14, state: 'idle', u: 0, y: 0 };
    }
    st -= dur;
  }
}
export function seqDur(list) { return list.reduce((a, s) => a + s[1], 0); }
