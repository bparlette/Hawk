/* ---------------- game framework: state machine, turns, scoring, flow ---------------- */
const EVENTS = []; // filled by the event files, in the 1987 order
const cam = { x: 0, y: 0, z: 1 };
const R = { score: 0, time: 0, falls: 0, maxFalls: 3, best: '', bestPts: 0, ended: false, practice: false, demo: false, stunts: 0, endReason: '' };
let E = {};                        // current event state (each event owns its object, reset in place)
let EVI = 0;                       // current event index
const LS_KEY = 'cgr_hark_records_v1';
let records = {}; try { records = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { records = {}; }
function saveRecords() { try { localStorage.setItem(LS_KEY, JSON.stringify(records)); } catch (e) {} }
const CPU_DEF = [{ name: 'RAD RICKY', sp: 0, skill: 1.0, hair: 0 }, { name: 'WAVY WENDY', sp: 5, skill: 0.84, hair: 3 }];
const Comp = { players: [], events: [], ei: 0, pi: 0, mode: 'all', cpu: true, seed: 1 };
const DEMO_LOOK = lookFor(0, 0);
const UI = {}; for (const id of ['menu','setup','pick','records','pause','awards','champ']) UI[id] = document.getElementById(id);
function showUI(id) { for (const k in UI) UI[k].classList.toggle('on', k === id); }

const Game = {
  state: 'boot', prev: '', attractI: 0, attractT: 0, cardT: 0, handedOver: false,
  look: DEMO_LOOK,
  setState(s) { this.prev = this.state; this.state = s; this.cardT = 0; },
  // ---------- event lifecycle ----------
  loadEvent(i, look, demo, practice) {
    EVI = i; const ev = EVENTS[i]; this.look = look;
    clearQueue(); clearParts(); clearPops(); banner.t = 0;
    T.hitstop = 0; T.slow = 0; T.shake = 0; T.flash = 0;
    R.score = 0; R.time = ev.time; R.falls = 0; R.maxFalls = ev.falls; R.best = ''; R.bestPts = 0; R.ended = false; R.demo = !!demo; R.practice = !!practice; R.stunts = 0; R.endReason = '';
    srand((Comp.seed + i * 31 + (demo ? 999 : 0)) >>> 0);
    E = ev.reset(ev.E);
    CAMS.cy = 0; ev.enter(E);
    this.fitCamera(true);
    setTouchLabels(ev.labels.a, ev.labels.b, ev.labels.c);
    Audio.amb('lowpass', 0, 400);
  },
  fitCamera(snap) {
    const ev = EVENTS[EVI], P = V.P;
    const vw = V.portrait && ev.viewP ? ev.viewP.w : ev.view.w, vh = V.portrait && ev.viewP ? ev.viewP.h : ev.view.h;
    cam.z = Math.min(P.w / vw, P.h / vh);
    CAMS.tilt = ev.tilt === undefined ? 0.1 : ev.tilt;
    if (snap) ev.camera(E, cam, 1, true);
  },
  startTurn() {
    const p = Comp.players[Comp.pi];
    this.loadEvent(Comp.events[Comp.ei], p.look, false, Comp.mode === 'practice');
    this.setState('ready'); showUI(null); showTouch(true); Audio.setMode('play'); Audio.setIntensity(0);
    clearHuman(); clearIn();
  },
  beginPlay() {
    this.setState('play'); clearIn(); Audio.sfx('go');
    const ev = EVENTS[EVI]; if (ev.start) ev.start(E);
  },
  endTurn(reason) {
    if (R.ended) return; R.ended = true; R.endReason = reason || 'time';
    const ev = EVENTS[EVI]; if (ev.finish) ev.finish(E);
    if (R.demo) { later(1.6, () => this.nextAttract()); return; }
    this.setState('turnEnd'); Audio.amb('lowpass', 0, 400);
    const p = Comp.players[Comp.pi];
    R.record = false;
    if (!R.practice) {
      p.scores[Comp.events[Comp.ei]] = R.score;
      const rec = records[ev.key];
      if (R.score > 0 && (!rec || R.score > rec.s)) { records[ev.key] = { s: R.score, n: p.name, sp: SPONSORS[p.sp].n }; saveRecords(); R.record = true; }
    }
    Audio.sfx(R.score > 0 ? 'cheer' : 'groan', 1); if (R.record) later(0.4, () => Audio.sfx('big'));
  },
  afterTurnCard() {
    if (R.practice) { this.startTurn(); return; }
    Comp.pi++;
    while (Comp.pi < Comp.players.length && Comp.players[Comp.pi].cpu) Comp.pi++;
    if (Comp.pi < Comp.players.length) { this.startTurn(); return; }
    this.awards();
  },
  // ---------- trophies (5/3/1 per the original) ----------
  standing(ei) {
    const list = [];
    for (const p of Comp.players) list.push({ p, s: p.scores[ei] || 0 });
    list.sort((a, b) => b.s - a.s); return list;
  },
  awards() {
    const ei = Comp.events[Comp.ei];
    for (const p of Comp.players) if (p.cpu) p.scores[ei] = cpuScore(p, ei);
    const st = this.standing(ei);
    const pts = [5, 3, 1];
    for (let i = 0; i < st.length && i < 3; i++) { if (st[i].s <= 0) continue; st[i].p.points += pts[i]; st[i].p.medals[i]++; }
    this.podium = st; this.podiumT = 0; this.setState('awards'); showTouch(false);
    loadPodiumScene(EVENTS[ei].scene);
    document.getElementById('awT').textContent = EVENTS[ei].name.toUpperCase() + ' — TROPHIES';
    let h = '<tr><th>#</th><th>COMPETITOR</th><th>SPONSOR</th><th class="n">SCORE</th></tr>';
    st.forEach((e, i) => { h += '<tr' + (e.p.cpu ? ' class="cpu"' : '') + '><td>' + ['🥇','🥈','🥉'][i] + (i > 2 ? (i + 1) : '') + '</td><td>' + esc(e.p.name) + (e.p.cpu ? ' (CPU)' : '') + '</td><td>' + SPONSORS[e.p.sp].n + '</td><td class="n">' + fmt(e.s) + '</td></tr>'; });
    document.getElementById('awTab').innerHTML = h;
    const last = Comp.ei >= Comp.events.length - 1;
    const nb = document.getElementById('awNext');
    nb.style.display = (Comp.mode === 'all') ? '' : 'none';
    nb.textContent = last ? 'FINAL STANDINGS' : 'NEXT: ' + EVENTS[Comp.events[Comp.ei + 1]].name.toUpperCase();
    document.getElementById('awRetry').style.display = Comp.mode === 'all' ? 'none' : '';
    showUI('awards'); Audio.sfx('fanfare'); Audio.setMode('menu');
  },
  awardsNext() {
    if (Comp.ei >= Comp.events.length - 1) { this.champion(); return; }
    Comp.ei++; Comp.pi = firstHuman(); this.startTurn();
  },
  champion() {
    const list = Comp.players.slice().sort((a, b) => b.points - a.points || b.medals[0] - a.medals[0] || total(b) - total(a));
    this.podium = list.map(p => ({ p, s: p.points })); this.podiumT = 0; this.setState('champ');
    loadPodiumScene('boardwalk');
    document.getElementById('chT').textContent = 'CALIFORNIA CHAMPION: ' + list[0].name;
    let h = '<tr><th>#</th><th>COMPETITOR</th><th class="n">🥇</th><th class="n">🥈</th><th class="n">🥉</th><th class="n">PTS</th></tr>';
    list.forEach((p, i) => { h += '<tr' + (p.cpu ? ' class="cpu"' : '') + '><td>' + (i + 1) + '</td><td>' + esc(p.name) + (p.cpu ? ' (CPU)' : '') + '<br><small>' + SPONSORS[p.sp].n + '</small></td><td class="n">' + p.medals[0] + '</td><td class="n">' + p.medals[1] + '</td><td class="n">' + p.medals[2] + '</td><td class="n">' + p.points + '</td></tr>'; });
    document.getElementById('chTab').innerHTML = h;
    showUI('champ'); Audio.sfx('fanfare'); later(0.9, () => Audio.sfx('cheer', 1.4));
  },
  // ---------- attract / demo (plays the real events with a bot) ----------
  attract(i) {
    this.attractI = (i === undefined ? this.attractI : i) % EVENTS.length;
    this.loadEvent(this.attractI, lookFor((this.attractI * 3) % 8, this.attractI), true, false);
    this.attractT = 0; const ev = EVENTS[EVI]; if (ev.start) ev.start(E);
    clearBot(); clearIn();
  },
  nextAttract() { if (this.isShowcase()) this.attract(this.attractI + 1); },
  isShowcase() { return this.state === 'attract' || this.state === 'menu' || this.state === 'setup' || this.state === 'pick' || this.state === 'records'; },
  toMenu() {
    clearQueue(); clearHuman(); clearBot(); clearIn();
    if (!R.demo) this.attract(this.attractI);
    this.setState('menu'); showUI('menu'); showTouch(false); Audio.setMode('menu');
    setTimeoutFocus('mAll');
  },
  handOver() { // first real input during attract → menu; no demo input survives
    clearBot(); clearIn(); this.handedOver = true; Audio.init();
    this.setState('menu'); showUI('menu'); showTouch(false); Audio.setMode('menu');
  },
  // ---------- pause ----------
  togglePause() {
    if (this.state === 'play' || this.state === 'ready') { this.pausedFrom = this.state; this.setState('paused'); showUI('pause'); clearHuman(); }
    else if (this.state === 'paused') this.resume();
  },
  autoPause() { if (this.state === 'play') this.togglePause(); },
  resume() { if (this.state !== 'paused') return; showUI(null); this.setState(this.pausedFrom || 'play'); clearHuman(); clearIn(); },
  canvasTap() { /* A-press on cards handled through the touch/keyboard latch; canvas taps act as A in card states */
    if (this.state === 'attract') { this.handOver(); return; }
    if (this.state === 'ready' || this.state === 'turnEnd') { human.latch.a = true; }
  },
  // ---------- fixed-step update ----------
  step(dt) {
    T.real += dt;
    if (T.shake > 0) T.shake = Math.max(0, T.shake * Math.exp(-7 * dt) - 2 * dt);
    if (T.flash > 0) T.flash = Math.max(0, T.flash - dt * 3);
    if (banner.t > 0) banner.t -= dt;
    const st = this.state, showcase = this.isShowcase();
    if (st === 'paused') return;
    if (st === 'awards' || st === 'champ') { this.podiumT += dt; T.game += dt; runQueue(); updParts(dt); if (Math.random() < 0.25) spawn(V.W * Math.random(), -10, 1, PAL[4 + (Math.random() * 6 | 0)], 40, 60, 4, 1); return; }
    const useBot = showcase || QA.bot;
    sampleInput(useBot);
    if (st === 'ready') { this.cardT += dt; if (this.cardT > 0.35 && (In.p.a || In.p.b || (QA.bot && this.cardT > 0.6))) { Audio.init(); this.beginPlay(); } this.idleUpdate(dt); return; }
    if (st === 'turnEnd') { this.cardT += dt; T.game += dt; runQueue(); updParts(dt); updPops(dt); if (this.cardT > 1.0 && (In.p.a || In.p.b || (QA.bot && this.cardT > 1.5))) this.afterTurnCard(); return; }
    if (st !== 'play' && !showcase) return;
    if (showcase) this.attractT += dt;
    if (useBot) EVENTS[EVI].bot(E, dt);
    if (T.hitstop > 0) { T.hitstop -= dt; return; }
    let sdt = dt; if (T.slow > 0) { T.slow -= dt; sdt *= T.slowScale; }
    T.game += sdt; runQueue();
    const ev = EVENTS[EVI];
    if (!R.ended) {
      if (ev.time > 0 && !E.clockStop) { R.time -= sdt; if (R.time <= 0) { R.time = 0; if (ev.timeUp) ev.timeUp(E); else this.endTurn('time'); } }
      ev.update(E, sdt);
    } else if (ev.idle) ev.idle(E, sdt);
    ev.camera(E, cam, sdt, false);
    updParts(sdt); updPops(sdt);
    if (showcase && this.attractT > 26 && !R.ended) this.endTurn('demo');
  },
  idleUpdate(dt) { T.game += dt; const ev = EVENTS[EVI]; if (ev.idle) ev.idle(E, dt); ev.camera(E, cam, dt, false); updParts(dt); }
};
function firstHuman() { for (let i = 0; i < Comp.players.length; i++) if (!Comp.players[i].cpu) return i; return 0; }
function total(p) { let s = 0; for (const v of p.scores) s += v || 0; return s; }
function fmt(n) { n = Math.round(n); const s = String(Math.abs(n)); let o = ''; for (let i = 0; i < s.length; i++) { if (i && (s.length - i) % 3 === 0) o += ','; o += s[i]; } return (n < 0 ? '-' : '') + o; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function setTimeoutFocus(id) { const el = document.getElementById(id); if (el && !V.touch) requestAnimationFrame(() => el.focus({ preventScroll: true })); }
function cpuScore(p, ei) { // CPU rivals post a score drawn around each event's par (seeded per competition)
  const par = EVENTS[ei].cpuPar; srand((Comp.seed * 7 + ei * 131 + p.name.length * 17) >>> 0);
  return Math.round(par * p.skill * (0.78 + rng() * 0.4) / 10) * 10;
}

/* ---------------- scoring + bails (shared juice) ---------------- */
function score(pts, name, x, y, tier) {
  pts = Math.round(pts); if (R.ended) return;
  R.score += pts; R.stunts++;
  if (pts > R.bestPts && tier >= 1) { R.bestPts = pts; R.best = name; }
  pop(x, y, '+' + fmt(pts), name, tier >= 2 ? C.tealL : C.yel);
  if (tier >= 2) { hitstop(0.1); shake(9); flash(0.35); slowmo(0.45, 0.45); spawn(x, y, 30, C.yel, 260, 300, 4); spawn(x, y, 14, C.pink, 200, 300, 3, 1); Audio.sfx('big'); say(name, '+' + fmt(pts), C.tealL, 1.3, true); Audio.sfx('cheer', 0.7); }
  else if (tier === 1) { hitstop(0.06); shake(4); spawn(x, y, 16, C.yel, 180, 300, 3); Audio.sfx('trick', (R.stunts % 5) * 2); say(name, '+' + fmt(pts), C.yel, 0.9, false); }
  else { spawn(x, y, 5, C.cream, 90, 200, 2); Audio.sfx('tick'); }
}
function hype(name, x, y, tier) { // feedback without points (judged events)
  pop(x, y, name, '', tier >= 2 ? '#9dff6b' : '#ffd23c');
  if (tier >= 2) { hitstop(0.09); shake(8); flash(0.3); slowmo(0.4, 0.5); spawn(x, y, 24, '#ffd23c', 240, 300, 4); Audio.sfx('big'); Audio.sfx('cheer', 0.7); say(name, '', '#9dff6b', 1.1, true); }
  else { hitstop(0.05); shake(4); spawn(x, y, 12, '#ffd23c', 160, 300, 3); Audio.sfx('trick', 3); }
}
const QLOG = [];
function bail(reason, x, y, serious) {
  if (R.ended) return; QLOG.push(EVENTS[EVI].key + ':' + reason);
  R.falls += serious ? R.maxFalls : 1;
  Audio.sfx('bail'); hitstop(0.12); shake(14); flash(0.25);
  spawn(x, y, 26, C.cream, 230, 400, 3); spawn(x, y, 10, C.coral, 170, 400, 3, 1);
  const left = Math.max(0, R.maxFalls - R.falls);
  say(reason, left > 0 ? left + (left === 1 ? ' FALL LEFT' : ' FALLS LEFT') : (serious ? 'SERIOUS FALL — OUT!' : 'OUT OF FALLS!'), C.coral, 1.5, true);
  if (R.falls >= R.maxFalls) later(1.8, () => Game.endTurn('falls'));
}
