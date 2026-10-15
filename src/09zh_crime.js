// ---------------- item l: CRIME METER HUD (city mode) ----------------
// A small chip under the minimap: CITY CRIME nn% with a bar, plus the district you stand in (CITY.lmk) with its own crime level
// (100 until its boss is beaten, 0 after: BOSS_CLEAR.crime). Cleared landmarks turn green on the minimap (07_main.js draws them).
// Hidden in every special mode (duel, fort, derby, Vic, racer, finale, cinematics) and once the finale's CITY SAVED chip takes over.
// Test hooks: window.__crime = { text(), city(), shown() }.
(function () {
  if (typeof BOSS_CLEAR === 'undefined') return;
  const st = document.createElement('style');
  st.textContent = `
  #crimechip { position: fixed; z-index: 11; left: calc(env(safe-area-inset-left, 0px) + 6px); top: calc(env(safe-area-inset-top, 0px) + 132px); width: 150px; box-sizing: border-box; padding: 4px 5px 5px; display: none; background: #1a1220; border: 2px solid #000; box-shadow: 2px 2px 0 #000; font: 7px/1.5 'PX', monospace; color: #ffe08a; pointer-events: none; opacity: .92; }
  #crimechip.on { display: block; }
  #crimechip .cr1, #crimechip .cr2 { display: flex; justify-content: space-between; white-space: nowrap; overflow: hidden; }
  #crimechip .cr2 { color: #ff9ad0; margin-top: 2px; }
  #crimechip .cr2 span { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; margin-right: 5px; } #crimechip .cr2 b { flex: none; }
  #crimechip .cr3 { display: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; font-size: 6px; }
  #crimechip .cr2.clr { color: #7dff6b; }
  #crimechip .bar { height: 5px; background: #000; margin-top: 3px; border: 1px solid #000; }
  #crimechip .bar i { display: block; height: 100%; width: 100%; background: #ff3d6e; transition: width .6s; }
  @media (max-width: 480px) { #crimechip { width: 120px; top: calc(env(safe-area-inset-top, 0px) + 114px); } }
  body.cine #crimechip, body.duel #crimechip, body.fort #crimechip, body.derby #crimechip, body.vicfight #crimechip, body.rbmode #crimechip, body.finale #crimechip { display: none !important; }`;
  document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'crimechip'; el.className = 'ui';
  el.innerHTML = '<div class="cr1"><span>CITY CRIME</span><b></b></div><div class="bar"><i></i></div><div class="cr2"><span></span><b></b></div><div class="cr3"></div>';
  document.body.appendChild(el);
  const q = (s) => el.querySelector(s), cityB = q('.cr1 b'), bar = q('.bar i'), dist = q('.cr2'), dN = q('.cr2 span'), dV = q('.cr2 b'), gang = q('.cr3');
  const HIDE = /\b(cine|duel|fort|derby|vicfight|rbmode|finale)\b/;
  let key = '';
  function refresh() {
    const bc = BOSS_CLEAR, GW = (typeof GANGWIRE !== 'undefined') ? GANGWIRE : null, city = GW ? GW.cityCrime() : bc.cityCrime(), L = (typeof CITY !== 'undefined') ? CITY.lmk : null;
    const saved = document.getElementById('fcrime'); const hide = HIDE.test(document.body.className) || (saved && saved.classList.contains('on')) || (typeof MODE !== 'undefined' && MODE.duel) || (typeof FMAP !== 'undefined' && FMAP.F && FMAP.F.open);
    el.classList.toggle('on', !hide);
    const lv = L && bc.crime[L.id] !== undefined ? (GW ? GW.districtCrime(L.id) : bc.crime[L.id]) : null;
    const gg = L && GW ? GW.gangAt(L.id) : null, gk = gg ? gg.name + ' ' + Math.min(GW.kos[L.id] || 0, GW.need(L.id)) + '/' + GW.need(L.id) : '';
    const k = city + '|' + (L ? L.id : '') + '|' + lv + '|' + gk; if (k === key) return; key = k;
    cityB.textContent = city + '%'; bar.style.width = city + '%'; bar.style.background = city === 0 ? '#7dff6b' : city < 50 ? '#ffd23c' : '#ff3d6e';
    gang.textContent = gg && lv !== 0 ? gk.replace(/ (\d+)\/(\d+)$/, '  $1/$2 DOWN') : ''; gang.style.display = gang.textContent ? 'block' : 'none'; gang.style.color = gg ? gg.accent : '';
    if (L && lv !== null) { dN.textContent = L.name; dV.textContent = lv === 0 ? 'CLEAR' : lv + '%'; dist.classList.toggle('clr', lv === 0); dist.style.visibility = 'visible'; }
    else { dN.textContent = 'OUT ON THE STREETS'; dV.textContent = ''; dist.classList.remove('clr'); dist.style.visibility = 'visible'; }
  }
  setInterval(refresh, 400); BOSS_CLEAR.on(() => { key = ''; setTimeout(refresh, 0); }); setTimeout(refresh, 0);
  window.__crime = { text: () => el.innerText, city: () => (typeof GANGWIRE !== 'undefined' ? GANGWIRE.cityCrime() : BOSS_CLEAR.cityCrime()), clear: (id) => BOSS_CLEAR.clear(id), goto: (id) => { const l = LANDMARKS.find((x) => x.id === id); if (l) { hero.pos.x = l.x; hero.pos.z = l.z; } return !!l; }, ids: () => LANDMARKS.map((x) => x.id), shown: () => el.classList.contains('on') && getComputedStyle(el).display !== 'none' };
})();
