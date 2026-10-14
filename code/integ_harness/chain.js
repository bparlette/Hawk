// Chained Chromium auto-play L1 -> L15, manual frame stepping, in-page bot.
// node chain.js [startLevel] -> logs milestones, page errors, results-card texts; screenshots to shots/
const { chromium } = require('playwright');
const fs = require('fs');
const START = +(process.argv[2] || 1);
const OUT = __dirname + '/shots'; fs.mkdirSync(OUT, { recursive: true });
const SITE = process.env.SITE || 'file:///workspace/work/integ_test/index.html';
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  const errors = [];
  pg.on('pageerror', e => { errors.push(e.message); console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text()); });
  await pg.addInitScript(() => {
    window.__manual = false; window.__rafq = null; const real = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { if (window.__manual) { window.__rafq = cb; return 1; } return real(cb); };
    window.__PT = new Set();
    window.open = () => null;
  });
  await pg.goto(SITE + '?debug' + (START > 1 ? '&level=' + START : ''));
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { window.__manual = true; });
  await pg.waitForTimeout(300);
  // install bot
  await pg.evaluate(() => {
    const S = window.__CAP_STATE;
    const held = new Set();
    const key = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k }));
    const tap = (k) => { key('keydown', k); key('keyup', k); };
    const hold = (k, on) => { if (on && !held.has(k)) { key('keydown', k); held.add(k); } if (!on && held.has(k)) { key('keyup', k); held.delete(k); } };
    const B = window.__B = { f: 0, log: [], seen: new Set(), stuck: 0, lastProg: '', marks: {}, shotReq: [], pt: {} };
    const mark = (m) => { if (!B.seen.has(m)) { B.seen.add(m); B.log.push('f' + B.f + ': ' + m); B.marks[m] = B.f; return true; } return false; };
    B.mark = mark;
    B.tick = () => {
      const p = S.player, lv = S.level || 1;
      if (S.scene === 'title' && B.f % 20 === 5 && !B.finished) tap('enter');
      if (S.scene === 'select' && B.f % 20 === 15) tap('enter');
      if (S.scene === 'map') { if (mark('map before lvl=' + (window.__SS.MAP && window.__SS.MAP.n1))) B.shotReq.push('map_to_' + window.__SS.MAP.n1); if (window.__SS.MAP && window.__SS.MAP.t === 120) {} if (window.__SS.MAP && window.__SS.MAP.t > 130 && B.f % 10 === 0) tap('enter'); }
      if (S.scene === 'loading') mark('loading lvl=' + lv);
      if (S.scene === 'initials') { if (mark('INITIALS entry (score ' + S.score + ')')) B.shotReq.push('initials'); const E = window.__SS.ENTRY; if (E && !E.done && B.f % 30 === 0) tap('j'); if (E && E.done) mark('INITIALS saved'); }
      if (S.scene === 'stage' && p) {
        const sec = S.section + (S.section === 'L' ? S.sec : '');
        if (mark('stage lvl=' + lv + ' section=' + sec)) B.marks['sec' + lv + sec] = B.f;
        if (p.deadT === 0) { p.hp = Math.max(p.hp, 8); }
        const secStart = B.marks['sec' + lv + sec];
        if (lv >= 9 && B.f - secStart === 700 && sec === 'L0') B.shotReq.push('l' + lv + '_gameplay');
        if (lv >= 9 && B.f - secStart === 1600 && sec === 'L0') B.shotReq.push('l' + lv + '_gameplay2');
        if (S.results) {
          if (mark('results lvl=' + lv)) { window.__PT.clear(); B.resF = B.f; }
          if (B.f - B.resF === 90) { const t = [...window.__PT].filter((s) => /END|NEXT|HIGH SCORE|PLAY AGAIN|CONTINUE|CONGRAT/.test(s)); B.log.push('f' + B.f + ': RESULTS-CARD lvl=' + lv + ' -> ' + JSON.stringify(t)); B.pt[lv] = t; if (lv >= 8) B.shotReq.push('l' + lv + '_results'); }
          if (S.results.t > 100 && B.f % 10 === 0) tap('j');
        } else if (S.pizza) mark('pizza lvl=' + lv);
        else if (S.cut) mark('cutscene lvl=' + lv);
        else if (S.outro) {
          if (mark('outro lvl=' + lv)) { B.outF = B.f; window.__PT.clear(); }
          const d = B.f - B.outF;
          if (lv >= 8 && (d === 150 || d === 330 || d === 520 || (lv === 15 && (d === 700 || d === 860)))) B.shotReq.push('l' + lv + '_outro_' + d);
          if (d % 60 === 0) { const t = [...window.__PT].filter((s) => /END|CONTINUED|NEXT|THANKS/.test(s)); if (t.length) for (const x of t) mark('outro-text lvl=' + lv + ': ' + x); }
        } else {
          const bosses = S.enemies.filter((e) => e.boss);
          for (const e of bosses) {
            if (mark('boss lvl=' + lv + ' ' + (e.name || e.type))) B.marks['boss' + lv + (e.name || '')] = B.f;
            const d = B.f - B.marks['boss' + lv + (e.name || '')];
            if (lv >= 9 && (d === 260 || d === 900)) B.shotReq.push('l' + lv + '_boss_' + (e.name || 'x').replace(/\W+/g, '') + '_' + d);
            if (e.hp <= 0 || e.state === 'dying') mark('boss KO lvl=' + lv + ' ' + (e.name || e.type));
          }
          // HUD bar label check after a boss vanishes
          if (lv === 15 && S.sec === 1 && !bosses.length && B.seen.has('boss lvl=15 SHREDDER')) { window.__PT.forEach((s) => { if (s === 'ZAP-ROLLER') mark('BUG: ZAP-ROLLER label shown in L15'); }); }
          let foes = S.enemies.filter((e) => !['dying', 'fly', 'intro'].includes(e.state) && e.entered);
          let tx = null, ty = p.y;
          if (foes.length) { foes.sort((a, c) => Math.abs(a.x - p.x) - Math.abs(c.x - p.x)); const e = foes[0]; tx = e.x + (e.x > p.x ? -18 : 18); ty = e.y; }
          else if (S.enemies.length && S.locked) { tx = S.camX + 192; ty = 185; } else tx = p.x + 60;
          hold('arrowright', tx > p.x + 3); hold('arrowleft', tx < p.x - 3);
          hold('arrowdown', ty > p.y + 2); hold('arrowup', ty < p.y - 2);
          if (foes.length && Math.abs(foes[0].x - p.x) < 30 && B.f % 7 === 0) { tap('j'); }
          if (B.f % 97 === 0) tap('k');
        }
        if (lv === 15 && S.sec === 1) window.__PT.forEach((s) => { if (s === 'ZAP-ROLLER') mark('BUG: ZAP-ROLLER label in L15 section 2'); });
        const prog = [S.level, S.section, S.sec, S.wave, S.phase, S.enemies.length, S.queue.length, Math.round(S.camX / 50), !!S.outro, !!S.results, !!S.pizza].join(',');
        if (prog === B.lastProg) B.stuck++; else { B.stuck = 0; B.lastProg = prog; }
        if (B.stuck > 2400 && !S.results && !S.pizza && !S.cut && !S.outro) {
          B.log.push('f' + B.f + ': FORCE progress prog=' + prog);
          for (const e of S.enemies) { e.hp = 0; e.state = 'dying'; e.t = 0; } p.grabbedBy = null; B.stuck = 0;
        }
      }
      if (S.scene === 'title' && B.seen.has('INITIALS saved')) { if (mark('back to title after finale')) { B.finished = true; B.shotReq.push('title_after'); } }
    };
    B.run = (n) => {
      window.__PT.clear && 0;
      for (let i = 0; i < n; i++) {
        B.tick();
        const cb = window.__rafq; if (!cb) break; window.__rafq = null; cb(performance.now()); B.f++;
        if (B.shotReq.length || B.finished) break;
      }
      const out = { f: B.f, log: B.log.splice(0), shots: B.shotReq.splice(0), fin: !!B.finished, scene: S.scene, lv: S.level };
      return out;
    };
  });
  const t0 = Date.now();
  let lastLog = Date.now();
  for (;;) {
    const r = await pg.evaluate(() => window.__B.run(600));
    for (const l of r.log) console.log(l);
    for (const s of r.shots) {
      const d = await pg.evaluate(() => document.getElementById('game').toDataURL('image/png'));
      fs.writeFileSync(OUT + '/' + s + '.png', Buffer.from(d.split(',')[1], 'base64')); console.log('shot', s);
    }
    if (r.fin) break;
    if (r.f > 300000) { console.log('TIMEOUT frames'); break; }
    if (Date.now() - lastLog > 30000) { console.log(`.. f=${r.f} scene=${r.scene} lv=${r.lv} ${(Date.now() - t0) / 1000 | 0}s`); lastLog = Date.now(); }
  }
  const pt = await pg.evaluate(() => window.__B.pt);
  console.log('RESULTS TEXTS', JSON.stringify(pt));
  const hs = await pg.evaluate(() => window.__SS.HISCORES);
  console.log('HISCORES', JSON.stringify(hs));
  console.log('PAGE ERRORS', errors.length, JSON.stringify(errors));
  console.log('DONE in', (Date.now() - t0) / 1000 | 0, 's');
  await b.close();
})();
