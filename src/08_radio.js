
// ---------------- B-MORE 410 RADIO: music like a radio station, full credit up top like a station ID (Brad, DESIGN.md "Night radio" / "Day radio").
// Plays through the official YouTube IFrame Player API (no audio is downloaded or shipped). The player always stays visible (>= 200x200 CSS px)
// inside a boombox frame; it collapses to that size in a corner and never covers the arcade panel. Starts on the first tap / keypress.
// Day playlist at day, night playlist (rotating) at night, switched at dusk / dawn of the game's cycle with a volume crossfade.
// Off/on: M, a short tap of R (holding R still turns the camera), the 📻 HUD button or the box's power button. onError skips to the next track.
// ?radio=0 disables it, ?radiotest=1 swaps the YouTube player for a stub (headless logic checks). Test hook: window.__radio ----------------
const RADIO = (function () {
  if (Q.get('radio') === '0') return null;
  const TRACKS = {
    day: [{ id: 'BJlNLNNzNZo', title: "I Can't", tag: 'Baltimore Type Beat', artist: '', prod: 'Lor Bitewho' }],
    night: [{ id: 'nEUiAHAm60o', title: 'playa shh', tag: '', artist: 'NASG CHAZ', prod: 'DC 1-30' },
      { id: 'Tu_WQLMzdu8', title: 'Hood Raised', tag: 'Baltimore Club Beat', artist: '', prod: 'Lor Bitewho' }],
  };
  // the radio icon is an inline SVG (an emoji may be missing on some devices); the plain-text credit (test hook) keeps the 📻
  const ICON = '<svg class="ric" viewBox="0 0 24 18" aria-label="radio"><path d="M6 4 L17 0.8" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="1" y="4" width="22" height="13" rx="2.5" fill="currentColor"/><circle cx="7" cy="11" r="3.6" fill="#120a22"/><circle cx="7" cy="11" r="1.3" fill="currentColor"/><rect x="13" y="7" width="7.5" height="3" rx="1" fill="#120a22"/><circle cx="15" cy="13.6" r="1.2" fill="#120a22"/><circle cx="18.6" cy="13.6" r="1.2" fill="#120a22"/></svg>';
  const STATION = 'B-MORE 410 RADIO', VOL = 70, FADE = 1.6, BIG_S = 5;
  const TEST = Q.has('radiotest');
  const R = { on: true, started: false, ready: false, playing: false, list: null, idx: { day: -1, night: -1 }, cur: null, vol: 0, goal: 0, after: null,
    bad: new Set(), log: [], offAir: false, player: null, bigT: 0, ids: 0, test: TEST };

  // ---- DOM + CSS (self-contained) ----
  const css = document.createElement('style');
  css.textContent = `
  #rid { position: fixed; z-index: 59; left: 0; right: 0; top: 0; height: calc(env(safe-area-inset-top, 0px) + 20px); padding-top: env(safe-area-inset-top, 0px); box-sizing: border-box; pointer-events: none;
    background: linear-gradient(#1b1030, #120a22); border-bottom: 2px solid #000; box-shadow: 0 2px 0 rgba(255,61,110,.55); overflow: hidden; }
  #ridt { position: absolute; left: 0; right: 0; bottom: 0; height: 18px; display: flex; align-items: center; white-space: nowrap; overflow: hidden;
    font: 800 11px/18px system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: .3px; color: #fff; }
  #ridt span { display: inline-block; padding-left: 8px; }
  #ridt b { color: #ffd23c; font-weight: 900; } #ridt i { color: #ff9ad0; font-style: normal; }
  #ridt.scroll span { animation: ridm var(--dur, 18s) linear 1.5s infinite; }
  @keyframes ridm { 0%, 6% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
  .ric { width: 1.35em; height: 1em; vertical-align: -0.12em; color: #ffd23c; display: inline-block; }
  #rbtn .ric { color: #14101f; } #rbtn.off .ric { color: #ddd; } #rbar .ric { color: #ffd23c; }
  body.radio #proto { top: calc(env(safe-area-inset-top, 0px) + 26px); } body.radio #hpbox { top: calc(env(safe-area-inset-top, 0px) + 28px); }
  body.radio #mmap { top: calc(env(safe-area-inset-top, 0px) + 54px); } body.radio #clock { top: calc(env(safe-area-inset-top, 0px) + 116px); }
  body.radio #qbtn { top: calc(env(safe-area-inset-top, 0px) + 132px); }
  #ridc { position: fixed; z-index: 61; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 24px); width: min(560px, calc(100vw - 16px)); box-sizing: border-box; pointer-events: none;
    transform: translate(-50%, -150%); opacity: 0; transition: transform .45s cubic-bezier(.2,1.4,.4,1), opacity .3s; padding: 9px 12px 10px; text-align: center;
    background: linear-gradient(#2a1650, #160c2c); border: 3px solid #000; box-shadow: 4px 4px 0 #000, inset 0 0 0 2px #ff3d6e; color: #fff; }
  #ridc.on { transform: translate(-50%, 0); opacity: 1; }
  #ridc .st { font: 10px/1.4 'PX', monospace; color: #ffd23c; text-shadow: 2px 2px 0 #000; letter-spacing: 1px; }
  #ridc .sh { font: 800 10px/1.6 system-ui, sans-serif; letter-spacing: 3px; color: #8fe8ff; }
  #ridc .np { font: 900 16px/1.25 system-ui, -apple-system, sans-serif; margin-top: 3px; text-shadow: 2px 2px 0 #000; }
  #ridc .cr { font: 800 13px/1.35 system-ui, sans-serif; color: #ffb3dc; margin-top: 2px; text-shadow: 1px 1px 0 #000; }
  #rbox { position: fixed; z-index: 15; right: calc(env(safe-area-inset-right, 0px) + 8px); bottom: calc(var(--panel, 0px) + env(safe-area-inset-bottom, 0px) * 0 + 8px);
    box-sizing: border-box; padding: 0 4px 4px; border: 3px solid #000; border-radius: 12px; box-shadow: 3px 3px 0 #000;
    background: linear-gradient(#3a3d46, #22242b); display: flex; flex-direction: column; align-items: center; pointer-events: auto; touch-action: manipulation; }
  body.touch #rbox { bottom: calc(var(--panel, 0px) + 6px); right: 6px; }
  #rbox.hide { display: none; }
  #rbar { display: flex; align-items: center; gap: 4px; width: 100%; height: 22px; font: 8px/1 'PX', monospace; color: #ffd23c; }
  #rbar .rlb { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-shadow: 1px 1px 0 #000; }
  #rbar button { all: unset; cursor: pointer; width: 20px; height: 16px; border-radius: 4px; background: #111; color: #fff; border: 1px solid #555; text-align: center; font: 10px/16px system-ui, sans-serif; }
  #rbar button:active { background: #ff3d6e; }
  #rmid { display: flex; align-items: center; gap: 6px; }
  .rspk { width: 64px; height: 64px; border-radius: 50%; border: 3px solid #000; background: radial-gradient(circle, #555 0 14%, #111 16% 30%, #2b2b2b 32% 100%);
    box-shadow: inset 0 0 0 4px #4a4d57; }
  #rbox.mini .rspk { display: none; }
  #rspks { display: flex; flex-direction: column; gap: 10px; } #rbox.mini #rspks { display: none; }
  #rplay { width: 200px; height: 200px; min-width: 200px; min-height: 200px; background: #000; border: 2px solid #000; border-radius: 4px; overflow: hidden; position: relative; }
  #rplay iframe, #rplay > div { width: 100% !important; height: 100% !important; display: block; }
  #rstub { display: flex !important; align-items: center; justify-content: center; text-align: center; font: 800 12px/1.4 system-ui, sans-serif; color: #ccc; background: repeating-linear-gradient(45deg,#181818 0 8px,#202020 8px 16px); }
  #rtip { width: 200px; font: 700 10px/1.3 system-ui, sans-serif; color: #fff; text-align: center; margin-top: 3px; }
  #rtip:empty { display: none; }
  #rbtn { position: fixed; z-index: 60; pointer-events: auto; cursor: pointer; right: calc(env(safe-area-inset-right, 0px) + 10px); top: calc(env(safe-area-inset-top, 0px) + 152px);
    font: 8px/1 'PX', monospace; color: #000; background: #ff9ad0; border: 2px solid #000; box-shadow: 2px 2px 0 #000; padding: 5px 6px; touch-action: manipulation; }
  #rbtn.off { background: #777; color: #ddd; }
  @media (max-width: 480px) { #ridc .np { font-size: 14px; } #ridc .cr { font-size: 12px; } }
  @media (max-height: 420px) { #rplay { width: 200px; height: 200px; } #rbar { height: 18px; } }`;
  document.head.appendChild(css);
  const el = (tag, id, html) => { const e = document.createElement(tag); if (id) e.id = id; if (html) e.innerHTML = html; document.body.appendChild(e); return e; };
  const bar = el('div', 'rid', '<div id="ridt"><span></span></div>');
  const card = el('div', 'ridc', '<div class="st"></div><div class="sh"></div><div class="np"></div><div class="cr"></div>');
  const box = el('div', 'rbox', '<div id="rbar"><span class="rlb">410</span><button id="rnext" type="button" title="next track">&raquo;</button><button id="rmin" type="button" title="collapse / expand">▾</button><button id="rpow" type="button" title="radio off (M)">&times;</button></div>'
    + '<div id="rmid"><div id="rspks"><div class="rspk"></div><div class="rspk"></div></div><div id="rplay"><div id="rplayer"></div></div></div><div id="rtip"></div>');
  const hudBtn = el('button', 'rbtn'); hudBtn.type = 'button'; hudBtn.title = 'Radio on/off (M, or tap R)';
  document.body.classList.add('radio');
  if (document.body.classList.contains('touch') || innerWidth < 700) box.classList.add('mini'); // phones start collapsed to the 200x200 minimum
  // the expanded boombox has a speaker on the left only (keeps it compact); collapsed = just the player + the frame
  const tickerS = bar.querySelector('#ridt'), tickerSpan = tickerS.querySelector('span');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const credit = (t) => `"${t.title}"${t.tag ? ` (${t.tag})` : ''}${t.artist ? ` · ${t.artist}` : ''} · prod. ${t.prod}`;
  const idText = (t) => `📻 ${STATION} · NOW PLAYING: ${credit(t)}`;

  let lastHtml = '';
  function setTicker(html, plain) {
    if (html === lastHtml) return; lastHtml = html; tickerSpan.innerHTML = html; R.tickerText = tickerSpan.textContent; tickerS.classList.remove('scroll');
    requestAnimationFrame(() => { if (tickerSpan.scrollWidth > tickerS.clientWidth - 8) { // too long for the strip: a seamless marquee (text, gap, text) that starts left-aligned
      tickerSpan.innerHTML = html + '<span style="display:inline-block;width:60px"></span>' + html; tickerS.style.setProperty('--dur', Math.max(12, plain.length * 0.26) + 's'); tickerS.classList.add('scroll'); } });
  }
  function render() {
    const t = R.cur; hudBtn.innerHTML = ICON + (R.on ? ' RADIO' : ' OFF'); hudBtn.classList.toggle('off', !R.on);
    box.classList.toggle('hide', !R.on); $('rmin').textContent = box.classList.contains('mini') ? '▴' : '▾';
    if (!t) return;
    let tip = '';
    if (R.offAir) { setTicker(`${ICON} <b>${STATION}</b> · <i>OFF AIR</i> · no track can be embedded right now`, 'off air'); return; }
    if (!R.on) setTicker(`${ICON} <b>${STATION}</b> · <i>RADIO OFF</i> · press M / tap R or the RADIO button to tune in · up next: ${esc(credit(t))}`, idText(t) + ' radio off press');
    else {
      setTicker(`${ICON} <b>${STATION}</b> · <i>NOW PLAYING:</i> ${esc(credit(t))}`, idText(t));
      if (!R.started) tip = 'Tap or press any key to tune in';
      else if (!R.playing && R.ready && !TEST && performance.now() - R.startT > 2500) tip = 'Tap the player to start the music';
    }
    box.querySelector('.rlb').innerHTML = `${ICON} 410 · ${R.list === 'night' ? 'NIGHT' : 'DAY'}`;
    $('rtip').textContent = tip;
  }
  function stationId(reason) { // the big card slides in, then it shrinks back to the slim ticker
    const t = R.cur; if (!t) return; R.ids++;
    card.querySelector('.st').innerHTML = `${ICON} ${STATION}`;
    card.querySelector('.sh').textContent = (R.list === 'night' ? 'NIGHT SHIFT' : 'DAY SHIFT') + (reason === 'dusk' ? ' · DUSK' : reason === 'dawn' ? ' · DAWN' : '');
    card.querySelector('.np').textContent = `NOW PLAYING: "${t.title}"${t.tag ? ` (${t.tag})` : ''}`;
    card.querySelector('.cr').textContent = `${t.artist ? t.artist + ' · ' : ''}prod. ${t.prod}`;
    card.classList.remove('on'); void card.offsetWidth; card.classList.add('on'); R.bigT = BIG_S;
    R.log.push({ at: +(S.time || 0).toFixed(2), reason, list: R.list, id: t.id, text: idText(t) });
    render();
  }

  // ---- playlist logic ----
  const nightNow = () => 0.5 - 0.5 * Math.cos((CYC.pin !== null ? CYC.pin : CYC.tod) * TAU) > 0.5; // dusk = tod .25, dawn = tod .75 on the game's loop
  function nextIn(list) { // next playable track in a playlist (night rotates); null if every one failed
    const L = TRACKS[list]; for (let k = 1; k <= L.length; k++) { const i = (R.idx[list] + k) % L.length; if (!R.bad.has(L[i].id)) { R.idx[list] = i; return L[i]; } } return null;
  }
  function tune(list, reason) {
    let t = nextIn(list);
    if (!t) { const o = list === 'day' ? 'night' : 'day'; t = nextIn(o); if (t) list = o; } // that whole playlist can't be embedded: borrow the other one
    if (!t) { R.offAir = true; R.cur = R.cur || TRACKS.day[0]; R.playing = false; duck(false); try { R.player && R.player.stopVideo(); } catch (e) {} render(); return; }
    R.list = list; R.cur = t;
    if (R.player && R.ready) { try { if (R.started && R.on) R.player.loadVideoById(t.id); else R.player.cueVideoById(t.id); } catch (e) {} }
    stationId(reason);
  }
  function fadeThen(fn) { R.goal = 0; R.after = fn; } // crossfade: volume down, swap, back up
  function switchList(list, reason) {
    if (R.list === list) return;
    if (R.started && R.on && R.vol > 1) fadeThen(() => { tune(list, reason); R.goal = VOL; });
    else tune(list, reason);
  }
  function advance(reason) { tune(R.list || (nightNow() ? 'night' : 'day'), reason); }
  function duck(on) { try { if (SFXBUS) SFXBUS.gain.setTargetAtTime(on ? 0.62 : 1, AC.currentTime, 0.3); } catch (e) {} }

  // ---- YouTube IFrame Player API (or the test stub) ----
  function onReady() { R.ready = true; try { R.player.setVolume(0); } catch (e) {} if (R.cur) { try { if (R.started && R.on) R.player.loadVideoById(R.cur.id); else R.player.cueVideoById(R.cur.id); } catch (e) {} } render(); }
  function onState(e) {
    const s = e.data; // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
    if (s === 1) { R.playing = true; if (!R.on) { try { R.player.pauseVideo(); } catch (er) {} } else { duck(true); if (R.goal === 0 && !R.after) R.goal = VOL; } }
    else if (s === 0) { R.playing = false; advance('next'); }
    else if (s === 2 || s === -1 || s === 5) { if (s === 2) { R.playing = false; duck(false); } }
    render();
  }
  function onError(e) { // 2 bad id, 5 html5, 100 gone, 101/150 embedding not allowed: skip to the next track
    if (R.cur) R.bad.add(R.cur.id); R.log.push({ at: +(S.time || 0).toFixed(2), reason: 'error ' + (e && e.data), id: R.cur && R.cur.id }); R.playing = false; advance('skip');
  }
  function makeStub() { // ?radiotest=1: same calls, no network; the box shows a placeholder of the same size
    $('rplayer').id = 'rstub'; $('rstub').textContent = 'YouTube player (test stub)';
    const P = { v: 0, vid: null, state: -1, calls: [], setVolume(v) { this.v = v; }, getVolume() { return this.v; },
      loadVideoById(id) { this.vid = id; this.calls.push('load ' + id); setTimeout(() => onState({ data: 1 }), 30); }, cueVideoById(id) { this.vid = id; this.calls.push('cue ' + id); },
      playVideo() { this.calls.push('play'); setTimeout(() => onState({ data: 1 }), 30); }, pauseVideo() { this.calls.push('pause'); setTimeout(() => onState({ data: 2 }), 10); }, stopVideo() { this.calls.push('stop'); } };
    R.player = P; setTimeout(onReady, 50);
  }
  function noSignal() { // YouTube unreachable (offline, blocked network): say so inside our own box; the credit stays up top
    if (R.ready) return; const d = $('rplayer'); if (d && !d.querySelector('iframe') && d.tagName !== 'IFRAME') { d.id = 'rstub'; d.innerHTML = 'NO SIGNAL<br><small>YouTube player could not load</small>'; } R.noSignal = true; render();
  }
  function makeYT() {
    const mk = () => {
      R.player = new YT.Player('rplayer', { width: 200, height: 200, playerVars: { playsinline: 1, controls: 1, rel: 0, fs: 0, enablejsapi: 1, origin: location.origin },
        events: { onReady, onStateChange: onState, onError } });
    };
    if (window.YT && YT.Player) mk(); else { const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { prev && prev(); mk(); };
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true; s.onerror = noSignal; setTimeout(() => { if (!R.ready) noSignal(); }, 15000); document.head.appendChild(s); }
  }
  if (TEST) makeStub(); else makeYT();

  // ---- start on the first gesture; on/off ----
  function start() {
    if (R.started) return; R.started = true; R.startT = performance.now();
    if (R.on && R.player && R.ready && R.cur) { try { R.player.loadVideoById(R.cur.id); R.player.setVolume(0); } catch (e) {} R.goal = VOL; }
    if (R.on) stationId('tune-in'); else render();
  }
  function setOn(on) {
    R.on = on; render();
    if (!R.player || !R.ready) return;
    try { if (on) { if (R.started) { R.vol = 0; R.player.setVolume(0); R.goal = VOL; R.player.playVideo(); } stationId('on'); } else { R.player.pauseVideo(); R.playing = false; duck(false); } } catch (e) {}
  }
  const toggle = () => { if (!R.started) start(); setOn(!R.on); };
  const gesture = () => { audioInit(); start(); };
  addEventListener('pointerdown', gesture, { capture: true }); addEventListener('touchstart', gesture, { capture: true, passive: true });
  let rDown = -1, rFrame = 0, rFirst = false; const fr = () => (window.__cel ? __cel.frames : 0);
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase(); if (e.repeat) return; rFirst = !R.started; gesture();
    if (k === 'm') toggle(); if (k === 'r') { rDown = e.timeStamp; rFrame = fr(); }
  }, { capture: true });
  addEventListener('keyup', (e) => { if (e.key.toLowerCase() === 'r' && rDown >= 0) { const tap = e.timeStamp - rDown < 250 || fr() - rFrame <= 2; rDown = -1; /* a tap toggles (a hold keeps turning the camera); the frame count covers slow devices */ if (tap && !rFirst) toggle(); rFirst = false; } });
  hudBtn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  $('rpow').addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  $('rnext').addEventListener('click', (e) => { e.stopPropagation(); if (R.on) fadeThen(() => { advance('next'); R.goal = VOL; }); });
  $('rmin').addEventListener('click', (e) => { e.stopPropagation(); box.classList.toggle('mini'); render(); });
  for (const ev of ['pointerdown', 'touchstart']) box.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); // taps on the radio never drive the camera

  // ---- tick: day/night switch, volume fades, card timer ----
  tune(nightNow() ? 'night' : 'day', 'start');
  let last = performance.now();
  setInterval(() => {
    const now = performance.now(), dt = Math.min(0.5, (now - last) / 1000); last = now;
    const want = nightNow() ? 'night' : 'day';
    if (!R.offAir && R.list !== want && !R.after) switchList(want, want === 'night' ? 'dusk' : 'dawn');
    if (R.bigT > 0) { R.bigT -= dt; if (R.bigT <= 0) card.classList.remove('on'); }
    const step = VOL / FADE * dt;
    if (R.vol !== R.goal) { R.vol = R.vol < R.goal ? Math.min(R.goal, R.vol + step) : Math.max(R.goal, R.vol - step); try { R.player && R.ready && R.player.setVolume(Math.round(R.vol)); } catch (e) {} }
    if (R.after && R.vol <= 0.01) { const f = R.after; R.after = null; f(); }
    if (R.started && R.on && !R.playing) render();
  }, 100);
  render();

  window.__radio = { R, TRACKS, toggle, setOn, start, advance, idText, get text() { return R.tickerText; }, get card() { return card.classList.contains('on') ? card.textContent : ''; },
    simEnd: () => onState({ data: 0 }), simError: (c = 150) => onError({ data: c }), get vol() { return R.vol; }, get sfx() { return SFXBUS ? SFXBUS.gain.value : null; } };
  return R;
})();
