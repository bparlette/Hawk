/* ---------------- menus, setup, main loop ---------------- */
const $ = id => document.getElementById(id);
const EVCOL = ['#ff5fa2', '#9dff6b', '#2fd3ff', '#ffd23c', '#ff9f1c', '#c9a0ff'];
let setupPlayers = [{ name: 'PLAYER 1', sp: 0 }];
let setupMode = 'all';
function anyUserInput(src) {
  Audio.init();
  if (Game.state === 'attract') { Game.handOver(); }
}
function renderSetup() {
  const L = $('plist'); L.innerHTML = '';
  setupPlayers.forEach((p, i) => {
    const row = document.createElement('div'); row.className = 'prow';
    const b = document.createElement('div'); b.className = 'badge'; b.style.background = SPONSORS[p.sp].a; row.appendChild(b);
    const inp = document.createElement('input'); inp.value = p.name; inp.maxLength = 10; inp.setAttribute('aria-label', 'Player ' + (i + 1) + ' name');
    inp.addEventListener('input', () => { p.name = inp.value.toUpperCase().replace(/[^A-Z0-9 .'-]/g, '').slice(0, 10) || 'PLAYER ' + (i + 1); });
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); });
    row.appendChild(inp);
    const sb = document.createElement('button'); sb.className = 'spon'; sb.textContent = SPONSORS[p.sp].n; sb.style.background = SPONSORS[p.sp].a; sb.style.color = SPONSORS[p.sp].a === '#7b4dff' ? '#fff' : INK;
    sb.addEventListener('click', () => { p.sp = (p.sp + 1) % SPONSORS.length; Audio.sfx('tick'); renderSetup(); });
    row.appendChild(sb); L.appendChild(row);
  });
  $('pAdd').disabled = setupPlayers.length >= 4; $('pDel').disabled = setupPlayers.length <= 1;
  $('pCpu').textContent = 'CPU RIVALS: ' + (Comp.cpu ? 'ON' : 'OFF'); $('pCpu').classList.toggle('on', Comp.cpu);
}
function openSetup(mode) { setupMode = mode; Game.setState('setup'); showUI('setup'); renderSetup(); }
function renderPick() {
  const g = $('evgrid'); g.innerHTML = '';
  EVENTS.forEach((ev, i) => { const b = document.createElement('button'); b.className = 'evb'; b.style.background = EVCOL[i];
    const rec = records[ev.key]; b.innerHTML = (i + 1) + ' · ' + ev.name.toUpperCase() + '<small>' + ev.place.toUpperCase() + (rec ? ' · REC ' + fmt(rec.s) : '') + '</small>';
    b.addEventListener('click', () => { Audio.sfx('tick'); if (setupMode === 'practice') startComp('practice', [i]); else { Comp.pickedEvent = i; openSetup('one'); } });
    g.appendChild(b); });
}
function startComp(mode, events) {
  Comp.mode = mode; Comp.events = events; Comp.ei = 0; Comp.pi = 0; Comp.seed = (Date.now() & 0xffff) + 1;
  const src = mode === 'practice' ? [{ name: setupPlayers[0].name, sp: setupPlayers[0].sp }] : setupPlayers;
  Comp.players = src.map((p, i) => ({ name: p.name, sp: p.sp, cpu: false, look: lookFor(p.sp, i, i), scores: [0, 0, 0, 0, 0, 0], medals: [0, 0, 0], points: 0 }));
  if (mode !== 'practice' && Comp.cpu) CPU_DEF.forEach((c, i) => Comp.players.push({ name: c.name, sp: c.sp, cpu: true, skill: c.skill, look: lookFor(c.sp, c.hair, 2 + i), scores: [0, 0, 0, 0, 0, 0], medals: [0, 0, 0], points: 0 }));
  Game.startTurn();
}
function wire(id, fn) { const el = $(id); el.addEventListener('click', e => { Audio.init(); Audio.sfx('tick'); fn(e); }); }
wire('mAll', () => openSetup('all'));
wire('mOne', () => { setupMode = 'one'; Game.setState('pick'); $('pickT').textContent = 'COMPETE IN ONE EVENT'; renderPick(); showUI('pick'); });
wire('mPrac', () => { setupMode = 'practice'; Game.setState('pick'); $('pickT').textContent = 'PRACTICE AN EVENT'; renderPick(); showUI('pick'); });
wire('mRec', () => { let h = '<tr><th>EVENT</th><th>HOLDER</th><th class="n">RECORD</th></tr>';
  EVENTS.forEach(ev => { const r = records[ev.key]; h += '<tr><td>' + ev.name.toUpperCase() + '</td><td>' + (r ? esc(r.n) + '<br><small>' + r.sp + '</small>' : '—') + '</td><td class="n">' + (r ? fmt(r.s) : '—') + '</td></tr>'; });
  $('recT').innerHTML = h; Game.setState('records'); showUI('records'); });
wire('mDemo', () => { showUI(null); Game.setState('attract'); Game.attract(0); });
wire('recBack', () => Game.toMenu()); wire('pickBack', () => Game.toMenu()); wire('pBack', () => Game.toMenu());
wire('pAdd', () => { if (setupPlayers.length < 4) { setupPlayers.push({ name: 'PLAYER ' + (setupPlayers.length + 1), sp: (setupPlayers.length * 3) % 8 }); renderSetup(); } });
wire('pDel', () => { if (setupPlayers.length > 1) { setupPlayers.pop(); renderSetup(); } });
wire('pCpu', () => { Comp.cpu = !Comp.cpu; renderSetup(); });
wire('pGo', () => { if (setupMode === 'all') startComp('all', [0, 1, 2, 3, 4, 5]); else startComp('one', [Comp.pickedEvent || 0]); });
wire('psResume', () => Game.resume());
wire('psRetry', () => { showUI(null); Game.startTurn(); });
wire('psQuit', () => Game.toMenu());
wire('awNext', () => { showUI(null); Game.awardsNext(); });
wire('awRetry', () => { showUI(null); startComp(Comp.mode, Comp.events); });
wire('awMenu', () => Game.toMenu());
wire('chAgain', () => openSetup('all'));
wire('chMenu', () => Game.toMenu());
$('bPause').addEventListener('click', e => { e.stopPropagation(); anyUserInput('mouse'); if (Game.state === 'play' || Game.state === 'ready' || Game.state === 'paused') Game.togglePause(); else if (Game.state !== 'attract') Game.toMenu(); e.currentTarget.blur(); });
// keyboard on DOM menus: Enter/Space activate the focused button natively; arrows move focus
window.addEventListener('keydown', e => {
  const open = document.querySelector('.ui.on'); if (!open) return;
  if (e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    const bs = [...open.querySelectorAll('button:not([disabled])')].filter(b => b.offsetParent); if (!bs.length) return;
    let i = bs.indexOf(document.activeElement); i = i < 0 ? 0 : (i + ((e.code === 'ArrowDown' || e.code === 'ArrowRight') ? 1 : -1) + bs.length) % bs.length; bs[i].focus(); e.preventDefault();
  }
});
// ---------- main loop: rAF + fixed 60 Hz step, render once per frame ----------
let acc = 0, lastT = 0, frames = 0;
const QA = { bot: false, speed: 1, cap: '', cap2: '' }; // test hooks: bot drives the human turn, faster clock
function frame(t) {
  requestAnimationFrame(frame);
  let dt = lastT ? (t - lastT) / 1000 : STEP; lastT = t; if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0; dt *= QA.speed;
  pollPad();
  acc += dt; let n = 0;
  while (acc >= STEP && n < 8 * QA.speed) { Game.step(STEP); acc -= STEP; n++; }
  if (Game.state === 'awards' || Game.state === 'champ') syncPodium();
  else if (EVENTS[EVI] && EVENTS[EVI].sync) EVENTS[EVI].sync(E);
  renderFrame(); drawHUD(); Audio.tick(); frames++;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => resize());
resize();
Game.setState('attract'); Game.attract(0);
requestAnimationFrame(frame);
window.__cg = { QLOG, QA, startComp, Game, R, E: () => E, EVENTS, Comp, In, human, bot, T, V, cam, records, frames: () => frames };
