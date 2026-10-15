// ---------------- item n polish: the CASE FILE (progress board) ----------------
// A button on the full-screen map (CASE FILE, bottom right) opens a pause-card listing every landmark boss (BOSS_CLEAR) with a check or the name still to beat,
// then the side quests (fishing, Poe, Phantoms, Bike Life, Grand Prix, Hold the Stoop, Rooftop Run, the finale/drone) and a % complete.
// The map already pauses the game; the case file is a layer over it (closing the case file leaves the map open). Nothing runs while closed.
// Test hooks: window.__casefile = { open(), close(), isOpen(), rows(), pct() }.
(function () {
  if (typeof BOSS_CLEAR === 'undefined' || typeof FMAP === 'undefined') return;
  const css = document.createElement('style');
  css.textContent = `
  #cfbtn { position: absolute; right: 8px; bottom: 8px; padding: 7px 9px; border: 2px solid #000; background: #ffd23c; color: #1a1220; font: 8px/1 'PX', monospace; letter-spacing: 1px;
    box-shadow: 2px 2px 0 #000; cursor: pointer; touch-action: manipulation; z-index: 3; }
  #cfile { display: none; position: fixed; z-index: 80; left: 0; right: 0; top: 0; bottom: var(--panel, 0px); background: rgba(7,5,13,.82); touch-action: pan-y; }
  #cfile.on { display: block; }
  #cfc { position: absolute; left: calc(env(safe-area-inset-left, 0px) + 8px); right: calc(env(safe-area-inset-right, 0px) + 8px); top: calc(env(safe-area-inset-top, 0px) + 8px); bottom: 8px;
    border: 3px solid #000; box-shadow: 4px 4px 0 #000, inset 0 0 0 2px #ffd23c; background: #1b1a22; overflow: hidden; display: flex; flex-direction: column; }
  #cfh { flex: none; padding: 10px 52px 8px 10px; font: 11px/1.3 'PX', monospace; color: #ffe08a; text-shadow: 2px 2px 0 #000; letter-spacing: 1px; }
  #cfh small { display: block; font: 700 11px/1.3 system-ui, sans-serif; color: #c9c3d8; letter-spacing: 0; text-shadow: 1px 1px 0 #000; margin-top: 3px; }
  #cfbar { flex: none; height: 8px; margin: 0 10px 6px; background: #000; border: 1px solid #000; } #cfbar i { display: block; height: 100%; width: 0; background: #7dff6b; transition: width .5s; }
  #cfx { position: absolute; right: 6px; top: 6px; width: 40px; height: 40px; border: 2px solid #000; background: #ff3d6e; color: #fff; font: 900 22px/34px system-ui, sans-serif;
    box-shadow: 2px 2px 0 #000; cursor: pointer; padding: 0; touch-action: manipulation; }
  #cfl { flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 0 10px 10px; font: 700 12px/1.25 system-ui, -apple-system, sans-serif; color: #e8e2f5; }
  #cfl h4 { margin: 8px 0 4px; font: 9px/1 'PX', monospace; color: #ff9ad0; letter-spacing: 1px; }
  #cfl .r { display: flex; align-items: baseline; gap: 6px; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,.08); }
  #cfl .r b { flex: none; width: 16px; text-align: center; color: #5a5060; } #cfl .r.ok b { color: #7dff6b; }
  #cfl .r span { flex: 1 1 auto; min-width: 0; } #cfl .r em { flex: none; font-style: normal; color: #9a93ad; font-size: 11px; text-align: right; } #cfl .r.ok em { color: #7dff6b; }`;
  document.head.appendChild(css);
  const ov = document.createElement('div'); ov.id = 'cfile'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Case file');
  ov.innerHTML = '<div id="cfc"><div id="cfh">CASE FILE<small></small></div><div id="cfbar"><i></i></div><div id="cfl"></div><button id="cfx" type="button" aria-label="close case file">✕</button></div>';
  document.body.appendChild(ov);
  const list = ov.querySelector('#cfl'), sub = ov.querySelector('#cfh small'), fill = ov.querySelector('#cfbar i');
  const ls = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const flag = (k) => { try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } };
  const NICE = { harborplace: 'Harborplace', constellation: 'USS Constellation', wtc: 'World Trade Center', aquarium: 'National Aquarium', powerplant: 'Power Plant Live', fourseasons: 'Four Seasons',
    pendry: 'Pendry Hotel', fells: 'Fells Point', monument: 'Washington Monument', orioles: 'Oriole Park', ravens: 'M&T Stadium', science: 'Science Center', fedhill: 'Federal Hill',
    domino: 'Domino Sugars', underarmour: 'Under Armour HQ', fort: 'Fort McHenry', lexington: 'Lexington Market', rashfield: 'Rash Field', duckpin: 'Duckpin Alley', brewery: 'One-Eye Brewery' };
  function rows() {
    const bosses = [];
    for (const L of LANDMARKS) if (L.boss && L.id !== 'brewery') bosses.push({ ok: BOSS_CLEAR.cleared.has(L.id) || !!L.boss.cleared, name: L.boss.name, note: NICE[L.id] || L.name || L.id });
    const fin = BOSS_CLEAR.cleared.has('brewery'); const bl = LANDMARKS.find((l) => l.id === 'brewery');
    if (bl && bl.boss) bosses.push({ ok: fin, name: bl.boss.name, note: fin ? 'FINAL BOSS' : 'FINAL BOSS' });
    const fish = (window.__fishing && __fishing.save) || ls('tcb_fish') || {}, poe = (window.__poe && __poe.save) || ls('tcb_poe') || {}, ph = (window.__phantoms && __phantoms.save) || ls('tcb_phantoms') || {};
    const bike = (window.__bikelife && __bikelife.save) || ls('tcb_bike') || {}, fn = (window.__finale && __finale.save) || ls('tcb_finale') || {};
    const nBike = Object.keys(bike.won || {}).filter((k) => bike.won[k]).length, nFish = Object.keys(fish.caught || {}).length;
    const side = [
      { ok: nFish >= 5, name: 'Harbor fishing', note: nFish + ' kinds caught' },
      { ok: !!fish.lantern, name: 'Ghost lantern', note: fish.lantern ? 'found' : 'night catch' },
      { ok: !!fish.key, name: 'Sunken key', note: fish.key ? 'found' : 'rare catch' },
      { ok: !!poe.feather, name: 'Nevermore Feather', note: poe.feather ? 'earned' : 'Poe night' },
      { ok: !!ph.cleared, name: 'Fells Point Phantoms', note: ph.cleared ? 'cleared' : 'night only' },
      { ok: nBike >= 4, name: 'Baltimore Bike Life', note: nBike + '/4 courses' },
      { ok: flag('tcb_gp_won'), name: 'Harbor Grand Prix', note: flag('tcb_gp_won') ? 'champion' : 'Pratt Street' },
      { ok: flag('tcb_td_won'), name: 'Hold the Stoop', note: flag('tcb_td_won') ? 'held' : 'rowhouse block' },
      { ok: flag('tcb_rr_won'), name: 'Fells Point Rooftop Run', note: flag('tcb_rr_won') ? 'steeple reached' : 'fire escape' },
      { ok: !!fn.saved, name: 'City saved', note: fn.saved ? 'drone ' + (fn.drone ? 'unlocked' : 'locked') : 'beat the Brewmaster' }];
    return { bosses, side };
  }
  const pct = () => { const r = rows(), all = r.bosses.concat(r.side); return Math.round(all.filter((x) => x.ok).length / all.length * 100); };
  function render() {
    const r = rows(), nb = r.bosses.filter((x) => x.ok).length, ns = r.side.filter((x) => x.ok).length, p = pct();
    const row = (x) => '<div class="r' + (x.ok ? ' ok' : '') + '"><b>' + (x.ok ? '✔' : '○') + '</b><span></span><em></em></div>';
    list.innerHTML = '<h4>BOSSES ' + nb + '/' + r.bosses.length + '</h4>' + r.bosses.map(row).join('') + '<h4>SIDE QUESTS ' + ns + '/' + r.side.length + '</h4>' + r.side.map(row).join('');
    const all = r.bosses.concat(r.side), rs = list.querySelectorAll('.r');
    rs.forEach((el, i) => { el.querySelector('span').textContent = all[i].name; el.querySelector('em').textContent = all[i].note; });
    sub.textContent = p + '% COMPLETE · CITY CRIME ' + (typeof GANGWIRE !== 'undefined' ? GANGWIRE.cityCrime() : BOSS_CLEAR.cityCrime()) + '%'; fill.style.width = p + '%';
  }
  const api = { open() { render(); ov.classList.add('on'); list.scrollTop = 0; api.opens++; }, close() { ov.classList.remove('on'); }, isOpen: () => ov.classList.contains('on'), rows, pct, opens: 0 };
  // the button lives inside the full-map card (built by 07b_fullmap.js); the map's own tap-outside-closes handler ignores it because we stop the event here
  const card = document.getElementById('fmapc');
  if (card) { const b = document.createElement('button'); b.id = 'cfbtn'; b.type = 'button'; b.textContent = 'CASE FILE'; card.appendChild(b);
    for (const ev of ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend']) b.addEventListener(ev, (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.preventDefault(); api.open(); }); }
  ov.querySelector('#cfx').addEventListener('click', api.close);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) { e.stopPropagation(); api.close(); } });
  addEventListener('keydown', (e) => { if (api.isOpen() && (e.key === 'Escape' || e.key === 'Tab')) { e.preventDefault(); e.stopImmediatePropagation(); api.close(); } }, true);
  window.__casefile = api;
})();
