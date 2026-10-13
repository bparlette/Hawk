
// ======================= DRAGON BOAT DUCHESS on the DUELS core (hark/polish, 2026-10-13).
// The fight itself lives in src/06h_racers.js (DUCH: the harbour arena, her AI, the tells, Harold's cane combo, POWER, Mavis). This file only registers it as
// the DUELS kind 'duchess' so it gets the shared duel HUD (bars, call-outs, RETRY / CONTINUE card), the JUICE kit (hit-stop, shake, pops, final-blow replay)
// and the CI boss runner. The first boat ride's ambush (RIDES in 06h) calls DUCH.start -> DUELS.start('duchess'); exit resumes the ride.
// Tests: ?duchess=1 (water taxi) or ?duchess=paddle, &duchessauto=win|lose|mash (bot); ?rb=duchess&rbauto=... still works and routes here too.
(function () {
  if (typeof DUELS === 'undefined' || typeof RB === 'undefined' || !RB.DUCH) return;
  const DU = RB.DUCH;
  const K = { scene: DU.sc, cam: DU.cam, title: 'DRAGON BOAT DUCHESS', pips: 3, built: true,
    hint: '<b>A / D</b> steer · <b>W / S</b> throttle · <b>J</b> ram / cane · <b>K</b> hop · <b>E</b> power',
    labels: { a: 'RAM', b: 'HOP', c: 'POWER', l: '&#9664; STEER', r: 'STEER &#9654;' },
    st: { hp: 100, bhp: 300, phase: 0, over: false, won: false } };
  K.build = () => {};
  K.start = (opts) => DU.duelStart(K, opts || {});
  K.step = (dt, I) => DU.duelStep(dt, I, K);
  K.render = (rdt) => DU.duelRender(rdt, K);
  K.retry = () => DU.duelRetry();
  K.exit = (why) => DU.exit(why === 'win');
  K.botThink = (B, dt) => DU.duelBot(B, dt);
  Object.defineProperty(K, 'camL', { get: () => DU.camL });
  DUELS.reg('duchess', K);
  let n = 0; MODE.ticks.push(() => { n++; if (n === 3 && Q.has('duchess') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('duchessauto');
    DU.start(Q.get('duchess') === 'paddle' ? 'paddle' : 'taxi', ['win', 'lose', 'mash'].includes(m) ? { bot: m } : {}); } });
  window.__duchess = K;
})();
