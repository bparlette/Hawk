'use strict';
/* GULF THUNDER - title, story cards, continue, ending, music */
(function () {
  const R = GT.R;

  GT.SONGS = {
    title: {
      bpm: 132,
      bass: 'A2 . A2 A3 A2 . G2 A2 | F2 . F2 F3 F2 . E2 F2 | G2 . G2 G3 G2 . F2 G2 | E2 . E2 E3 E2 . E3 D3',
      lead: 'A4 - - C5 - - E5 - | D5 - C5 - A4 - - - | B4 - - D5 - - G5 - | E5 - - - E5 D5 B4 G#4',
      arp: 'E5 A5 C6 A5 E5 A5 C6 A5 | F5 A5 C6 A5 F5 A5 C6 A5 | G5 B5 D6 B5 G5 B5 D6 B5 | E5 G#5 B5 G#5 E5 G#5 B5 E6',
      drum: 'k h s h k k s h | k h s h k k s s'
    },
    boat: {
      bpm: 160,
      bass: 'E2 E2 E3 E2 E2 E3 E2 E3 | C2 C2 C3 C2 C2 C3 C2 C3 | D2 D2 D3 D2 D2 D3 D2 D3 | B1 B1 B2 B1 B1 B2 D2 D#2',
      lead: 'E4 - G4 - B4 - E5 - | E5 - D5 - C5 - B4 - | D5 - - F#5 - - A5 - | G5 - F#5 - D#5 - B4 -',
      drum: 'k h s h k h s h | k h s h k s s s'
    },
    beach: {
      bpm: 140,
      bass: 'C3 . G2 . C3 . G2 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 . | C3 . G2 . A2 . B2 .',
      lead: 'E5 - G5 - E5 C5 - D5 | C5 - A4 - C5 - F5 - | D5 - B4 - G4 - D5 - | E5 - C5 - - - G4 -',
      arp: 'C5 E5 G5 E5 C5 E5 G5 E5 | A4 C5 F5 C5 A4 C5 F5 C5 | B4 D5 G5 D5 B4 D5 G5 D5 | C5 E5 G5 C6 G5 E5 C5 G4',
      drum: 'k . s h k k s h'
    },
    swamp: {
      bpm: 150,
      bass: 'D2 . D2 D3 . D2 C3 . | Bb1 . Bb1 Bb2 . Bb1 A2 . | C2 . C2 C3 . C2 Bb2 . | A1 . A1 A2 . A2 C3 C#3',
      lead: 'D5 - - A4 - - D5 E5 | F5 - E5 - D5 - A4 - | G4 - - C5 - - E5 G5 | A5 - - - G5 F5 E5 C#5',
      drum: 'k h k s h k s h | k h k s k k s s'
    },
    kasbah: {
      bpm: 128,
      bass: 'A2 . A2 . Bb2 . A2 . | A2 . A2 . G2 . F2 . | D2 . D2 . E2 . F2 . | E2 . E2 . E2 . G#2 .',
      lead: 'A4 Bb4 C#5 - D5 - C#5 Bb4 | A4 - - - G4 F4 E4 - | D4 E4 F4 - G4 - A4 Bb4 | A4 - G#4 - F4 - E4 -',
      drum: 'k . h s . k s . | k . h s k k s h'
    },
    backlot: {
      bpm: 146,
      bass: 'G2 . G2 G2 Bb2 . C3 . | G2 . G2 G2 F2 . D2 . | Eb2 . Eb2 Eb2 F2 . G2 . | D2 . D2 D2 F#2 . A2 .',
      lead: 'G4 - Bb4 - D5 - C5 Bb4 | A4 - - F4 - - D4 - | Eb5 - D5 - C5 - Bb4 - | A4 - F#4 - D5 - - -',
      drum: 'k h s h k k s h | k h s k k s s s'
    },
    boss: {
      bpm: 170,
      bass: 'E2 E2 F2 E2 E2 E2 Bb2 A2 | E2 E2 F2 E2 E2 E2 G2 F#2',
      lead: 'E5 - F5 - E5 - B4 - | Bb4 - A4 - G4 - F#4 -',
      drum: 'k s k s k s k s | k k s k k k s s'
    },
    ending: {
      bpm: 108,
      bass: 'C3 . . G2 . . C3 . | A2 . . E2 . . A2 . | F2 . . C3 . . F2 . | G2 . . D3 . . G2 .',
      lead: 'E5 - - D5 C5 - G4 - | A4 - - C5 - - E5 - | F5 - - E5 D5 - C5 - | D5 - - - G4 - - -',
      arp: 'C5 E5 G5 E5 C5 E5 G5 E5 | A4 C5 E5 C5 A4 C5 E5 C5 | F4 A4 C5 A4 F4 A4 C5 A4 | G4 B4 D5 B4 G4 B4 D5 B4',
      drum: 'k . h . s . h . | k . h k s . h h'
    },
    over: { bpm: 90, bass: 'A2 . . . E2 . . . | F2 . . . E2 . . .', lead: 'E5 - - - C5 - - - | D5 - - - B4 - - -', drum: '. . . . . . . .' }
  };

  /* ---------- shared backdrops ---------- */
  GT.sunsetSky = function (g, v, horizon) {
    GT.R(g, v.x0, v.y0, v.x1 - v.x0, horizon - v.y0, '#2a1a4a');
    GT.grad(g, v.x0, Math.max(v.y0, horizon - 260), v.x1 - v.x0, 260, ['#2a1a4a', '#381c52', '#4a2058', '#62245c', '#7a2a5e', '#9a3258', '#b83a52', '#d24c46', '#e8603a', '#f27c3a', '#f89a3a', '#fcb44c', '#ffcc60']);
  };
  let logoC = null;
  GT.logo = function () {
    if (logoC) return logoC;
    const w = 250, h = 96;
    const t = GT.mk(w, h), tg = t.getContext('2d');
    GT.text(tg, 'GULF', w / 2, 4, '#fff', 5, 1);
    GT.text(tg, 'THUNDER', w / 2, 46, '#fff', 5, 1);
    tg.globalCompositeOperation = 'source-atop';
    const bands = [['#ffffff', 0], ['#e8eef8', 8], ['#9aa4bc', 16], ['#f6f8ff', 22], ['#c0c8d8', 30], ['#6a7088', 35],
      ['#ffffff', 42], ['#ffe060', 46], ['#ffb030', 56], ['#e83820', 66], ['#ff8040', 74], ['#a01810', 79]];
    for (let i = 0; i < bands.length; i++) { const y0 = bands[i][1], y1 = i + 1 < bands.length ? bands[i + 1][1] : h; GT.R(tg, 0, y0, w, y1 - y0, bands[i][0]); }
    const o = GT.mk(w, h), og = o.getContext('2d');
    const sil = GT.mk(w, h), sg = sil.getContext('2d'); sg.drawImage(t, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#100818'; sg.fillRect(0, 0, w, h);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 3; dy++) og.drawImage(sil, dx, dy);
    og.drawImage(t, 0, 0);
    // lightning bolt
    og.fillStyle = '#100818';
    const bolt = [[196, 30], [206, 30], [200, 40], [208, 40], [190, 60], [196, 46], [188, 46]];
    og.beginPath(); bolt.forEach((p, i) => i ? og.lineTo(p[0], p[1]) : og.moveTo(p[0], p[1])); og.closePath(); og.fill();
    og.fillStyle = '#ffe860'; og.beginPath(); bolt.forEach((p, i) => i ? og.lineTo(p[0] + 0.5, p[1] + 1) : og.moveTo(p[0] + 1, p[1] + 1.5)); og.closePath(); og.fill();
    return (logoC = o);
  };
  // sea band with moving glints
  GT.seaBand = function (g, v, y0, t, cols) {
    cols = cols || ['#f4b060', '#e89058', '#c87058', '#9a5a64', '#6a4a74', '#4a4274', '#2e3a6c', '#22305e', '#1a2a5a'];
    GT.grad(g, v.x0, y0, v.x1 - v.x0, v.y1 - y0, cols);
    for (let i = 0; i < 60; i++) {
      const yy = y0 + 3 + ((i * 37) % Math.max(1, (v.y1 - y0 - 4)));
      const xx = ((i * 71 + t * (10 + (i % 5) * 6)) % (v.x1 - v.x0 + 40)) + v.x0 - 20;
      const w = 2 + (i % 4) * 2 * (yy - y0) / 100;
      R(g, xx, yy, w, 1, i % 3 ? '#ffd8a0' : '#fff2d0');
    }
  };
  function islands(g, y) {
    g.fillStyle = '#2a1430';
    for (const [x, w, h] of [[-20, 90, 10], [180, 120, 14]]) {
      for (let i = 0; i < w; i++) { const hh = Math.round(h * Math.sin(Math.PI * i / w)); g.fillRect(x + i, y - hh, 1, hh); }
    }
    for (const [x, h] of [[20, 28], [34, 22], [254, 22]]) palmSil(g, x, y - 6, h);
    if (GT.pinkPalaceSmall) GT.pinkPalaceSmall(g, 192, y - 8);
  }
  function palmSil(g, x, y, h) {
    g.fillStyle = '#2a1430';
    for (let i = 0; i < h; i++) g.fillRect(Math.round(x + Math.sin(i / h * 1.6) * 4), y - i, 2, 1);
    const tx = Math.round(x + Math.sin(1.6) * 4), ty = y - h;
    for (const [dx, dy] of [[-1, 0], [1, 0], [-0.7, 0.5], [0.7, 0.5], [0, -0.4]]) for (let i = 0; i < 9; i++) g.fillRect(Math.round(tx + dx * i), Math.round(ty + dy * i + (Math.abs(dx) > 0.5 ? i * i / 20 : 0)), 2, 1);
  }
  GT.palmSil = palmSil;

  /* ---------- Title ---------- */
  GT.Title = function () {
    let t = 0, wk = new GT.FX();
    return {
      name: 'title',
      enter() { GT.music('title'); GT.touchVisible(false); },
      update(dt) {
        t += dt; wk.update(dt);
        if (Math.random() < 0.9) { wk.wake(127 + GT.rnd(-2, 2), 410 + Math.sin(t * 1.3) * 4, 140); wk.wake(143 + GT.rnd(-2, 2), 410 + Math.sin(t * 1.3) * 4, 140); }
        if (GT.inp.startP && t > 0.4) { GT.sfx('select'); GT.newGame(); GT.go(GT.Story(0), 'story0'); }
        if (GT.bot && t > 1) GT.botStart = true;
      },
      draw(g) {
        const v = GT.view();
        GT.sunsetSky(g, v, 268);
        GT.circ(g, 135, 252, 30, '#ffe890'); GT.circ(g, 135, 252, 26, '#fff4c0');
        for (let i = 0; i < 6; i++) R(g, 100, 236 + i * 5, 70, 1 + (i > 2), '#f89a3a');
        islands(g, 268);
        GT.seaBand(g, v, 268, t);
        // boat
        wk.draw(g);
        const by = 392 + Math.sin(t * 1.3) * 4;
        GT.draw(g, GT.S.th, 135, by + 22, false, 13, 22);
        GT.draw(g, GT.logo(), 135, 34, false, 125, 0);
        GT.text(g, 'A 16-BIT ACTION HOMAGE', 135, 136, '#ffe0b0', 1, 1, '#2a1030');
        if (Math.floor(t * 2) % 2 === 0) GT.textO(g, GT.isTouch ? 'TAP TO START' : 'PRESS FIRE TO START', 135, 182, '#fff', 1, 1, '#301020');
        if (!GT.isTouch) { GT.text(g, 'MOVE: WASD / ARROWS   FIRE: J', 135, 422, '#fff', 1, 1, '#000'); GT.text(g, 'JUMP/BOOST: K   SPECIAL: L', 135, 434, '#fff', 1, 1, '#000'); }
        GT.text(g, 'STARRING STORM STERLING', 135, 456, '#ffd848', 1, 1, '#000');
        GT.text(g, 'AND THE THUNDERHEAD', 135, 466, '#c8d0e0', 1, 1, '#000');
      }
    };
  };

  /* ---------- Story cards ---------- */
  const STAGES = GT.STAGE_NAMES = ['GULF RUN', 'PARADISE BEACH', 'MANGROVE CHASE', 'KASBAH ROOFTOPS', 'STUNT BACKLOT'];
  const STORY = [
    { who: 'mac', title: 'MISSION 1', lines: ['SUNSET KEY, GULF OF MEXICO.', 'A SMUGGLING RING CALLED THE RED TIDE IS RUNNING GUNS THROUGH THE GULF.', 'MAC: "STORM! THEY JUST HIT A SUPPLY BARGE. TAKE THE THUNDERHEAD AND RUN THEM DOWN!"'] },
    { who: 'mac', title: 'MISSION 2', lines: ['THE RED TIDE YACHT IS SINKING... BUT THEIR THUGS JUST CRASHED THE RESORT.', 'MAC: "THEY\'RE BUSTING UP MY GRILL! GET ASHORE AND SHOW THEM THE DOOR."', 'BRAWL! COMBO PUNCH, GRAB, THROW. SPECIAL = BODY SLAM.'] },
    { who: 'mac', title: 'MISSION 3', lines: ['THE BOUNCER TALKED: RED TIDE FUELS UP AT AN OLD OIL RIG PAST THE MANGROVES.', 'MAC: "CHANNEL\'S TIGHT. LAUNCH THE JET-SKI WHEN IT NARROWS..."', '"...AND IF THE PATROL\'S WATCHING, HOLD SPECIAL TO CLOAK."'] },
    { who: 'mac', title: 'MISSION 4', lines: ['THE RIG\'S LOGBOOK POINTS ACROSS THE SEA, TO A KASBAH MARKET.', 'A GUN BROKER DEALS FROM THE ROOFTOPS.', 'MAC: "CLIMB HIGH, KEEP YOUR HEAD DOWN. HOLD DOWN FOR COVER. SHOOT THE LANTERNS!"'] },
    { who: 'kade', title: 'FINAL MISSION', lines: ['THE BROKER SANG: RED TIDE\'S BOSS, VICTOR KADE, HIDES ON A DESERT MOVIE BACKLOT.', 'KADE: "COME AND GET ME, STERLING. MY PLANE IS FUELED AND READY."', 'MAC: "THOSE FUEL DRUMS... MAKE THEM COUNT, STORM."'] }
  ];
  GT.Story = function (i) {
    const s = STORY[i];
    let t = 0, chars = 0;
    const full = s.lines.map(l => GT.wrap(l, 26));
    const total = full.reduce((a, l) => a + l.join('').length, 0);
    return {
      name: 'story' + i,
      enter() { GT.music(i === 4 ? 'boss' : 'title'); GT.touchVisible(false); },
      update(dt) {
        t += dt;
        const before = Math.floor(chars); chars += dt * 55; if (Math.floor(chars) !== before && Math.floor(chars) % 3 === 0 && chars < total) GT.sfx('type');
        if (GT.inp.startP && t > 0.3) {
          if (chars < total) chars = total;
          else { GT.sfx('select'); GT.startStageScene(i); }
        }
        if (GT.bot && t > 1.2) { chars = total; GT.botStart = true; }
      },
      draw(g) {
        const v = GT.view();
        R(g, v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0, '#0c1028');
        for (let y = v.y0; y < v.y1; y += 3) R(g, v.x0, y, v.x1 - v.x0, 1, '#10163a');
        GT.textO(g, s.title, 135, 70, '#ffd848', 2, 1);
        GT.textO(g, STAGES[i], 135, 92, '#fff', 2, 1, '#a01810');
        // portrait frame
        R(g, 18, 128, 52, 52, '#c8d0e0'); R(g, 20, 130, 48, 48, '#1a2448');
        GT.draw(g, s.who === 'kade' ? GT.S.portKade : GT.S.portMac, 44, 176);
        GT.text(g, s.who === 'kade' ? 'V. KADE' : 'MAC', 44, 184, '#8fe0ff', 1, 1);
        R(g, 80, 128, 172, 52, '#1a2448'); R(g, 80, 128, 172, 1, '#c8d0e0');
        GT.text(g, 'INCOMING CALL', 86, 134, '#ff7060');
        GT.text(g, 'FREQ 121.5   CH ' + (i + 4), 86, 146, '#6a7aa8');
        GT.draw(g, GT.S.portStorm, 226, 176);
        let left = Math.floor(chars), y = 206;
        for (const para of full) {
          for (const line of para) {
            if (left <= 0) break;
            const show = line.slice(0, left); left -= line.length;
            GT.text(g, show, 20, y, '#fff', 1, 0);
            y += 11;
          }
          y += 8;
        }
        if (chars >= total && Math.floor(t * 2) % 2 === 0) GT.text(g, GT.isTouch ? 'TAP TO GO' : 'PRESS FIRE', 135, 420, '#ffd848', 1, 1);
      }
    };
  };

  GT.startStageScene = function (i) {
    GT.state.stage = i;
    const mk = [GT.Stage1, GT.Stage2, GT.Stage3, GT.Stage4, GT.Stage5][i];
    GT.go(mk(), 'stage' + (i + 1));
    GT.touchVisible(true);
  };
  GT.stageClear = function () {
    glog('clear:' + (GT.state.stage + 1));
    GT.state.stage++;
    if (GT.state.stage >= 5) GT.go(GT.Ending(), 'ending');
    else GT.go(GT.Story(GT.state.stage), 'story' + GT.state.stage);
  };
  // returns true if game continues (respawn), false if continue screen shown
  GT.loseLife = function () {
    GT.state.lives--;
    GT.sfx('die');
    if (GT.state.lives < 0) { GT.go(GT.Continue(), 'continue'); return false; }
    return true;
  };

  /* ---------- Continue ---------- */
  GT.Continue = function () {
    let t = 0, n = 9;
    return {
      name: 'continue',
      enter() { GT.music('over'); GT.touchVisible(false); },
      update(dt) {
        t += dt;
        if (t > 1.2) { t = 0.2; n--; GT.sfx('type'); }
        if (n < 0) { GT.go(GameOver(), 'gameover'); return; }
        if (GT.inp.startP && t > 0.1) {
          GT.sfx('select'); GT.state.lives = 2; GT.state.continues++; GT.state.score = 0; GT.startStageScene(GT.state.stage);
        }
        if (GT.bot) GT.botStart = true;
      },
      draw(g) {
        const v = GT.view();
        R(g, v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0, '#100608');
        GT.draw(g, GT.man('storm', 'lie'), 135, 300, false, 24, 33);
        GT.textO(g, 'CONTINUE?', 135, 150, '#ff5040', 3, 1);
        GT.textO(g, String(Math.max(0, n)), 135, 200, '#fff', 5, 1);
        GT.text(g, '"GET UP, STORM! THE GULF NEEDS YOU!"', 135, 340, '#ffd848', 1, 1);
        GT.text(g, '- MAC', 200, 352, '#8fe0ff', 1, 1);
        if (Math.floor(GT.t * 2) % 2 === 0) GT.text(g, GT.isTouch ? 'TAP TO CONTINUE' : 'PRESS FIRE TO CONTINUE', 135, 400, '#fff', 1, 1);
      }
    };
  };
  function GameOver() {
    let t = 0;
    return {
      name: 'gameover',
      enter() { GT.music('over'); },
      update(dt) { t += dt; if ((GT.inp.startP && t > 1) || t > 6) GT.go(GT.Title(), 'title'); },
      draw(g) {
        const v = GT.view(); R(g, v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0, '#000');
        GT.textO(g, 'GAME OVER', 135, 200, '#ff3030', 3, 1);
        GT.text(g, 'SCORE ' + GT.state.score, 135, 250, '#fff', 1, 1);
      }
    };
  }

  /* ---------- Ending ---------- */
  GT.Ending = function () {
    let t = 0; const wk = new GT.FX();
    const credits = ['MISSION COMPLETE', '', 'KADE\'S PLANE WENT UP IN A', 'FIREBALL ON THE BACKLOT.', 'THE RED TIDE IS FINISHED.', '', 'BACK AT SUNSET KEY, MAC', 'FIRES UP THE GRILL.', '', 'MAC: "BURGERS ARE ON THE', 'HOUSE TONIGHT, PARTNER!"', '', '', 'GULF THUNDER', 'AN ORIGINAL 16-BIT HOMAGE', 'TO 90S TV ACTION', '', 'STORM STERLING', 'MAC', 'THE THUNDERHEAD', '', '', 'FINAL SCORE', 'SCORE', '', '', 'THE END'];
    return {
      name: 'ending',
      enter() { GT.music('ending'); GT.touchVisible(false); glog('ending'); window.__gtEnding = true; },
      update(dt) {
        t += dt; wk.update(dt);
        const by = 380 - Math.min(160, t * 9);
        if (Math.random() < 0.8) { wk.wake(129, by + 40, 40); wk.wake(141, by + 40, 40); }
        if (t > 4 && GT.inp.startP) GT.go(GT.Title(), 'title');
      },
      draw(g) {
        const v = GT.view();
        GT.sunsetSky(g, v, 220);
        GT.circ(g, 135, 210, 26, '#ffe890'); GT.circ(g, 135, 210, 22, '#fff4c0');
        islands(g, 220);
        GT.seaBand(g, v, 220, t);
        wk.draw(g);
        const by = 380 - Math.min(160, t * 9);
        GT.draw(g, GT.S.th, 135, by + 22, false, 13, 22);
        if (/notext/.test(location.search)) return;
        let y = 480 - t * 16;
        for (const c of credits) {
          const s = c === 'SCORE' ? String(GT.state.score) : c;
          if (y > -20 && y < 470 && s && !(c === 'THE END' && y < 200)) GT.textO(g, s, 135, Math.round(y), c === 'THE END' || c === 'MISSION COMPLETE' || c === 'GULF THUNDER' ? '#ffd848' : '#fff', c === 'THE END' ? 3 : 1, 1, '#200818');
          y += c === 'THE END' ? 30 : 13;
        }
        if (y < 200) GT.textO(g, 'THE END', 135, 200, '#ffd848', 3, 1, '#200818');
        if (t > 6 && Math.floor(t * 2) % 2 === 0) GT.text(g, GT.isTouch ? 'TAP FOR TITLE' : 'PRESS FIRE', 135, 460, '#fff', 1, 1, '#000');
      }
    };
  };
})();
