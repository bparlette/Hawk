// node T/duel/ovcheck.js <port> <w> <h> : Chip Kid duel HUD text-fit check. Pushes every prompt / special name / word pop / banner / grade + lose card / panel label
// the duel uses into the live HUD and measures each box against the viewport (and its own content box). Prints FAIL lines + a summary.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, w = '390', h = '844'] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&duel=chipkid&duelbot=lose&sim=1`);
  await p.waitForFunction(() => window.__duels && __duels.cur && document.fonts.status === 'loaded', null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const res = await p.evaluate(async () => {
    const D = __duels, hud = D.hudEl, W = innerWidth, out = [], wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const fit = (sel, what) => { const e = hud.querySelector(sel) || document.querySelector(sel); if (!e) return; const r = e.getBoundingClientRect(); if (!r.width) return;
      const over = Math.max(0, -r.left, r.right - W), clip = Math.max(0, e.scrollWidth - e.clientWidth - 1); out.push({ what, sel, l: Math.round(r.left), r: Math.round(r.right), lines: Math.round(r.height), over: Math.round(over), clip }); };
    D.hold = true; // freeze the sim; pops are driven by hand below
    const tells = ['SPICE CLOUD! DUCK OR DODGE!', 'CAN BARRAGE! LEAVE THE RED LANE!', 'CAN VOLLEY! FIND THE CLEAR LANE!', 'BAG-SLAM! DODGE LEFT OR RIGHT!', 'CLAW JAB! DODGE \u25b6 OR DUCK!', 'CLAW JAB! DODGE \u25c0 OR DUCK!',
      'POWER LOW: HIT THE MECH!', 'NICE DODGE! +POWER', 'IT\u2019S OPEN! SWING!', 'IT\u2019S STUCK! SWING AWAY!'];
    for (const t of tells) { D.tell(t, 9); await wait(60); fit('.dtell', 'tell ' + t); }
    const touch = document.body.classList.contains('touch');
    for (const n of ['BAY DUST CYCLONE!', 'CRAB-MALLET POUND!', '"HON!" HOMER!']) { D.ready('\u26a1 ' + (touch ? '' : 'PRESS <b>E</b>: ') + n); await wait(520); fit('.dready', 'ready ' + n); } D.ready(null);
    const bans = ['THE CHIP KID<small>HARBORPLACE \u00b7 ROUND 1</small>', 'BAY DUST<br>CYCLONE!<small>POWER SPECIAL</small>', 'CRAB-MALLET<br>POUND!<small>POWER SPECIAL</small>', '"HON!"<br>HOMER!<small>POWER SPECIAL</small>',
      'SECOND WIND!<small>MAVIS: GET UP, HAROLD!</small>', 'ROUND 3<small>AGAIN! FULL HEALTH + FULL POWER</small>', 'ROUND 3<small>FINAL ROUND! FULL HEALTH</small>', 'DOWN!<small>ROUND 2 TO HAROLD</small>', 'K.O.!!<small>THE FINAL BLOW</small>'];
    for (const t of bans) { D.banner(t, 9); await wait(260); fit('.dban', 'banner ' + t.replace(/<[^>]+>/g, ' ')); }
    D.say('THE CHIP KID', 'My mech has a turbo button, you know! Somewhere!', 9); await wait(250); fit('.dsay', 'say');
    // word pops: placed at the mech, then pushed to both screen edges (worst case), sampled through their scale-up
    D.hold = false; const C = D.cur, words = ['HOME RUN!', 'KABOOM!', '+25 CRAB CAKE', 'BAY DUST!', 'CRUNCH!', 'POUND!', 'CRASH!', '60'], cls = ['word', 'big', 'heal', 'word', 'word', 'word', 'word', 'big'];
    for (const xo of [-6, 0, 6]) { words.forEach((t, i) => { D.pop(t, ({ x: xo, y: 3 - i * 0.25, z: 4 }), cls[i]); });
      let worst = {}; for (let k = 0; k < 14; k++) { await wait(35); hud.querySelectorAll('.dpop').forEach((e) => { if (e.style.opacity === '0' || !e.textContent) return; const r = e.getBoundingClientRect(), o = Math.max(0, -r.left, r.right - W); worst[e.textContent] = Math.max(worst[e.textContent] || 0, Math.round(o)); }); }
      for (const [t, o] of Object.entries(worst)) out.push({ what: 'pop x' + xo + ' ' + t, over: o, clip: 0 }); await wait(1200); }
    D.hold = true;
    const stars = '<span style="color:#ffd23c;font-size:22px;letter-spacing:4px">\u2605\u2605<span style="opacity:.25">\u2605</span></span><br>GRADE A<br>MAX COMBO 14 \u00b7 SPECIALS 3 \u00b7 DODGES 12 \u00b7 HITS TAKEN 11<br><span style="color:#a6f03c">STYLE BONUS +1\u2605 (specials / dodges)</span><br>Harborplace is clear. Crime at Harborplace: 0.';
    D.over('win', 'THE CHIP KID<br>RAN HOME!', stars, { again: true }); await wait(120); for (const s of ['.dover h2', '.dover p', '.dover button.r', '.dover button.l', '.dover .bt']) fit(s, 'win card ' + s);
    D.over('lose', 'T.K.O.!', 'The Chip Kid\u2019s mech flattened Harold. Retry round 3 with full health and a full POWER meter.'); await wait(120); for (const s of ['.dover h2', '.dover p', '.dover .bt']) fit(s, 'lose card ' + s);
    for (const n of ['a', 'b', 'c', 'l', 'r']) { const e = document.getElementById('albl-' + n); if (e && e.getBoundingClientRect().width) { const r = e.getBoundingClientRect(); out.push({ what: 'panel label ' + n + ' "' + e.textContent + '"', over: Math.round(Math.max(0, -r.left, r.right - W)), clip: Math.max(0, e.scrollWidth - e.clientWidth - 1) }); } }
    fit('.dhint', 'desktop hint'); fit('.dtop', 'bars'); fit('.dpow', 'power bar');
    return out;
  });
  let fails = 0; for (const r of res) { const bad = r.over > 0 || r.clip > 0; if (bad) fails++; console.log((bad ? 'FAIL ' : 'ok   ') + r.what + (r.l !== undefined ? ` [${r.l}..${r.r}] h${r.lines}` : '') + (bad ? ` over=${r.over} clip=${r.clip}` : '')); }
  await p.screenshot({ path: `T/duel/ov_${w}_card.png` });
  console.log(`SUMMARY ${w}x${h}: ${res.length} checked, ${fails} fail, pageerrors ${errs.length}`);
  await b.close();
})();
