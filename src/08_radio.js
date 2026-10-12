// ---------------- B-MORE 410 RADIO: music like a radio station, full credit up top like a station ID (Brad, DESIGN.md "Night radio" / "Day radio" / "Radio stations").
// Plays through the official YouTube IFrame Player API (no audio is downloaded or shipped). Creative Commons Baltimore club tracks (Ducky Dynamo, DJ AyyMello)
// play from the artists' official YouTube uploads; if YouTube refuses one (embed error / no signal) that same track plays through Bandcamp's official
// embedded player instead ("bandcamp" source: no JS API, so the box says TAP ▶ TO PLAY and a timer set to the track length moves on). Audio is never edited.
// Stations (GTA-style dial, any time): AUTO (default: DAY by day, NIGHT by night, switched at dusk / dawn with a crossfade), B-MORE 410 DAY, B-MORE 410 NIGHT,
// DUCKY DYNAMO FM (all the CC tracks), LOR BITEWHO ([FREE] beats), B-MORE CLUB + B-MORE RAP (Brad's 30 Baltimore classics), OFF. The choice is kept in localStorage. Every switch shows the station-ID card with the full credit.
// Controls (all in the slim top bar): ⏮ / station / ⏭ / CR (credits list); tap the station = next station, long-press = off/on;
// keys N = next track, B = previous track, T = next station, M or a short tap of R = off/on (holding R still turns the camera).
// No visible video (Brad 2026-10-11 09:06): the YouTube iframe is 2x2 px, opacity .01, pointer-events:none, behind everything; controls=0, fs=0, disablekb=1,
// allow="autoplay" only. Starts on the first tap / keypress with the title track. The station-ID card drops from the bar on every switch.
// ?radio=0 disables it, ?radiotest=1 swaps the YouTube player for a stub (headless logic checks), ?radiobc=1 forces the Bandcamp player for the CC tracks.
// B-MORE 410 REMIX (Brad 2026-10-11: "make a remix channel the default channel ... each song plays the most played 20 seconds ... then remixes into the next"):
// first on the dial and the default. Shuffles Brad's 30 Baltimore classics (no repeats until all 30 have played), plays a 20 s clip of each from its peak start
// (REMIX_PEAK, baked offline by radio/remix_heatmap.py from YouTube's Most Replayed heatmap; never scraped at runtime), then crossfades into the next clip.
// Two hidden audio-only players: the next clip is preloaded muted at its peak, and the last 3 s run an equal-power crossfade with a short tape-drag
// (playbackRate 0.5) on the outgoing clip. iOS Safari ignores setVolume and lets one page play one audible stream, so on iOS one player hard-cuts
// clip to clip with a fast seek ("play to play"). ?remix1=1 forces the one-player mode, ?remix2=1 the two-player mode, ?remixclip=N shortens clips (tests), ?radiolog=1 logs clips to the console.
// Test hook: window.__radio ----------------
const RADIO = (function () {
  if (Q.get('radio') === '0') return null;
  const BYND = ['CC BY-ND 4.0', 'https://creativecommons.org/licenses/by-nd/4.0/'], BYNCND = ['CC BY-NC-ND 4.0', 'https://creativecommons.org/licenses/by-nc-nd/4.0/'];
  const cc = (id, title, tag, artist, lic, src, bc, len) => ({ id, title, tag, artist, prod: '', lic: lic[0], licUrl: lic[1], src, yt: 'https://youtu.be/' + id, bc, len });
  const lb = (id, title) => ({ id, title, tag: '', artist: '', prod: 'Lor Bitewho (@OneBiteBeats)', yt: 'https://youtu.be/' + id });
  const yt = (id, title, artist) => ({ id, title, tag: '', artist, prod: '', yt: 'https://youtu.be/' + id });
  const T = {
    syc: cc('g9-ZkYiEUdo', 'Select Your Character', 'Baltimore Club', 'Ducky Dynamo', BYND, 'https://duckydynamo.bandcamp.com/track/select-your-character-baltimore-club', 429017724, 159),
    bullet: cc('l3mVHdpItYg', 'Baltimore Bullet', 'Baltimore Club', 'Ducky Dynamo', BYND, 'https://duckydynamo.bandcamp.com/track/baltimore-bullet-baltimore-club-2', 2173550732, 155),
    crash: cc('FtE6FiaJB5I', 'Completely Valid Crash Out', 'Baltimore Club', 'Ducky Dynamo', BYND, 'https://duckydynamo.bandcamp.com/track/completely-valid-crash-out-baltimore-club', 813921011, 163),
    cock: cc('0T4x4sAf0eE', 'Cockback', 'Baltimore Club', 'Ducky Dynamo', BYND, 'https://duckydynamo.bandcamp.com/track/cockback-baltimore-club', 511392191, 153),
    para: cc('atMQ7h_1J9g', '3AM in The Paradox', 'Baltimore Club Music', 'DJ AyyMello feat. Ducky Dynamo', BYNCND, 'https://ayymello.bandcamp.com/track/3am-in-the-paradox-feat-ducky-dynamo-baltimore-club-music', 2891386594, 208),
    // Lor Bitewho (@OneBiteBeats) [FREE] Baltimore type beats, official uploads on his channel; credit: "TITLE" · prod. Lor Bitewho (@OneBiteBeats)
    icant: lb('BJlNLNNzNZo', "I Can't"), hood: lb('Tu_WQLMzdu8', 'Hood Raised'), back: lb('bOkdSXQuYPM', 'Back Street'), war: lb('nyxnsGp4ilI', 'WAR READY'),
    took: lb('ckZEi0DIeyk', 'TOOK CONTROL'), run: lb('ggNVhuKhYuQ', 'On The Run'), every: lb('IjuK4VVuTHI', 'Everything I Wanted'), anthem: lb('mUCm7MZGRKY', 'Block Anthem'),
    playa: { id: 'nEUiAHAm60o', title: 'playa shh', tag: '', artist: 'NASG CHAZ', prod: 'DC 1-30', yt: 'https://youtu.be/nEUiAHAm60o' },
    // Brad's Baltimore classics (2026-10-11 09:16, radio/baltimore_classics_brad.md): exactly his 30, his titles / artists, credited "TITLE" · ARTIST, ranked
    c1: yt('quUSjngSmN0', 'Dance My Pain Away', 'Rod Lee'), c2: yt('qEnptXwZSfo', 'How U Wanna Carry It', 'Miss Tony'), c3: yt('1zRb_WNEeaw', 'Doo Doo Brown', '2 Hyped Brothers & A Dog'),
    c4: yt('rvZWAEDI6bY', 'Whores in This House', 'Frank Ski'), c5: yt('1kbwFhD597Q', "I'm the Ish", 'DJ Class'), c6: yt('gXVaIiexbRk', 'Bank Roll', 'Tim Trees'),
    c7: yt('u2hse3dRJZ8', 'Bring in the Katz', 'KW Griff ft. Pork Chop'), c8: yt('gVCCuHMRpco', 'Oh (B-More Anthem)', 'Bossman'), c9: yt('l_xzOk0w3qU', 'Watch Out for the Big Girl', 'DJ Booman & Jimmy Jones'),
    c10: yt('BbXklS6t4AM', 'Bird Flu', 'Lor Scoota'), c11: yt('RT0GKX-Pfkg', 'Bank Rolls (Remix)', 'Tate Kobang'), c12: yt('9WyLkGp9eM0', 'Bitchuary', 'Shordie Shordie'),
    c13: yt('fHAigWTZioI', 'Shake It to the Ground', 'Blaqstarr & Rye Rye'), c14: yt('BWpbV-DrI_0', 'Slide To The Left', 'K-Swift'), c15: yt('GI7wtAZaXXs', 'Posted', 'Young Moose'),
    c16: yt('mze0GuD2k6c', 'Money Man', 'Peso Da Mafia'), c17: yt('Av5jyGX2yE8', 'Hands Up Thumbs Down', 'Blaqstarr'), c18: yt('SrYcZfalGjI', "Samir's Theme", 'Debonair Samir'),
    c19: yt('kUlr1WLU6ys', 'Girlfriend', 'DJ Technics'), c20: yt('f32eCeneIbY', 'One Wish', 'Shordie Shordie'), c21: yt('7Z3ExxAPSF8', 'Shining', 'YBS Skola'),
    c22: yt('_Dru5adhPjU', 'Dumb Dumb', 'Young Moose'), c23: yt('KKIunI_nlKg', 'BBB', 'Bandhunta Izzy ft. BB Sleepy'), c24: yt('jovjP6StSWU', 'Might Not Miss', 'YG Teck'),
    c25: yt('Svmcd4uvkiY', 'Whole Lotta Money', 'YBS Skola'), c26: yt('8pWftkom4_I', 'War', 'YGG Tay'), c27: yt('RknlZpl-VpM', 'War', 'King Los ft. Marsha Ambrosius'),
    c28: yt('V16BdeeA4YY', 'North North', 'Tate Kobang'), c29: yt('uwl1zto209M', 'Bmore Is The Livest Town', 'Mighty Mark'), c30: yt('XIs3B_CL0l8', 'Bad Sista', 'Mighty Mark ft. TT the Artist'),
  };
  const TITLE = T.syc; // the title / tune-in track
  const TRACKS = { day: [T.syc, T.icant, T.bullet, T.back, T.anthem], night: [T.playa, T.hood, T.crash, T.cock, T.para, T.war, T.run],
    ducky: [T.syc, T.bullet, T.crash, T.cock, T.para], lor: [T.icant, T.hood, T.back, T.war, T.took, T.run, T.every, T.anthem],
    club: [T.c1, T.c2, T.c3, T.c4, T.c5, T.c7, T.c9, T.c13, T.c14, T.c17, T.c18, T.c19, T.c29, T.c30],
    rap: [T.c6, T.c8, T.c10, T.c11, T.c12, T.c15, T.c16, T.c20, T.c21, T.c22, T.c23, T.c24, T.c25, T.c26, T.c27, T.c28] };
  // ---- REMIX: peak start per track (seconds). A number = heatmap peak (best 20 s window by summed intensityScoreNormalized). null = FALLBACK: no heatmap could be
  // fetched at build time (2026-10-11: youtube.com answered the build box with HTTP 429 / google.com/sorry for every watch page, see radio/remix_heatmap.log), so the
  // clip starts 35% into the track (at least 30 s in, past the intro; at most length - 25 s), worked out from player.getDuration() once the track loads (45 s until then).
  // Re-run radio/remix_heatmap.py from an unblocked machine and paste radio/remix_peaks.json here to replace the fallbacks.
  const REMIX_PEAK = {
    quUSjngSmN0: null, qEnptXwZSfo: null, '1zRb_WNEeaw': null, rvZWAEDI6bY: null, '1kbwFhD597Q': null, gXVaIiexbRk: null, u2hse3dRJZ8: null, gVCCuHMRpco: null, // fallback (no heatmap)
    l_xzOk0w3qU: null, BbXklS6t4AM: null, 'RT0GKX-Pfkg': null, '9WyLkGp9eM0': null, fHAigWTZioI: null, 'BWpbV-DrI_0': null, GI7wtAZaXXs: null, mze0GuD2k6c: null, // fallback
    Av5jyGX2yE8: null, SrYcZfalGjI: null, kUlr1WLU6ys: null, f32eCeneIbY: null, '7Z3ExxAPSF8': null, _Dru5adhPjU: null, KKIunI_nlKg: null, jovjP6StSWU: null, // fallback
    Svmcd4uvkiY: null, '8pWftkom4_I': null, 'RknlZpl-VpM': null, V16BdeeA4YY: null, uwl1zto209M: null, XIs3B_CL0l8: null, // fallback
  };
  // Pool: Brad's 30 Baltimore classics only (Baltimore artists, already in the radio). The CC BY-ND / BY-NC-ND tracks stay off REMIX (ND = no adaptations, and a
  // crossfaded excerpt mix could count as one); Lor Bitewho / NASG CHAZ are left out because their Baltimore origin isn't confirmed.
  const POOL = [T.c1, T.c2, T.c3, T.c4, T.c5, T.c6, T.c7, T.c8, T.c9, T.c10, T.c11, T.c12, T.c13, T.c14, T.c15, T.c16, T.c17, T.c18, T.c19, T.c20, T.c21, T.c22, T.c23, T.c24, T.c25, T.c26, T.c27, T.c28, T.c29, T.c30];
  const shuffle = (a, avoid) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } if (avoid && a[0] === avoid && a.length > 1) [a[0], a[a.length - 1]] = [a[a.length - 1], a[0]]; return a; };
  TRACKS.remix = shuffle(POOL.slice());
  const STATIONS = ['remix', 'auto', 'day', 'night', 'ducky', 'lor', 'club', 'rap', 'off'];
  const SNAME = { remix: 'B-MORE 410 REMIX', auto: 'AUTO', day: 'B-MORE 410 DAY', night: 'B-MORE 410 NIGHT', ducky: 'DUCKY DYNAMO FM', lor: 'LOR BITEWHO', club: 'B-MORE CLUB', rap: 'B-MORE RAP', off: 'OFF' };
  const SSHORT = { remix: 'REMIX', auto: 'AUTO', day: 'DAY', night: 'NIGHT', ducky: 'DUCKY FM', lor: 'LOR BITEWHO', club: 'B-MORE CLUB', rap: 'B-MORE RAP', off: 'OFF' };
  const ICON = '<svg class="ric" viewBox="0 0 24 18" aria-label="radio"><path d="M6 4 L17 0.8" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="1" y="4" width="22" height="13" rx="2.5" fill="currentColor"/><circle cx="7" cy="11" r="3.6" fill="#120a22"/><circle cx="7" cy="11" r="1.3" fill="currentColor"/><rect x="13" y="7" width="7.5" height="3" rx="1" fill="#120a22"/><circle cx="15" cy="13.6" r="1.2" fill="#120a22"/><circle cx="18.6" cy="13.6" r="1.2" fill="#120a22"/></svg>';
  // ⏮ / ⏭ as inline SVG (the emoji / symbol glyphs are missing on some devices)
  const PREV = '<svg class="rsv" viewBox="0 0 20 14" aria-hidden="true"><rect x="1" y="1" width="2.6" height="12" fill="currentColor"/><path d="M11 1 L3.6 7 L11 13Z M19 1 L11.6 7 L19 13Z" fill="currentColor"/></svg>';
  const NEXT = '<svg class="rsv" viewBox="0 0 20 14" aria-hidden="true"><path d="M1 1 L8.4 7 L1 13Z M9 1 L16.4 7 L9 13Z" fill="currentColor"/><rect x="16.4" y="1" width="2.6" height="12" fill="currentColor"/></svg>';
  const STATION = 'B-MORE 410 RADIO', VOL = 70, FADE = 1.6, BIG_S = 5, LONG_MS = 550, LS = 'tcb_radio_station2'; // new key with REMIX: everyone starts on the new default once, then the dial is remembered
  const TEST = Q.has('radiotest'), FORCE_BC = Q.get('radiobc') === '1';
  let saved = null; try { saved = localStorage.getItem(LS); } catch (e) {}
  const st0 = STATIONS.includes(saved) ? saved : 'remix';
  const R = { station: st0, lastSt: st0 === 'off' ? 'remix' : st0, on: st0 !== 'off', started: false, ready: false, playing: false, list: null, idx: { remix: -1, day: -1, night: -1, ducky: -1, lor: -1, club: -1, rap: -1 }, cur: null,
    vol: 0, goal: 0, after: null, bad: new Set(), ytFail: new Set(), log: [], offAir: false, player: null, bigT: 0, ids: 0, test: TEST, bc: null, bcLeft: 0, bcTapped: false, noSignal: false };

  // ---- DOM + CSS (self-contained). No visible video: the YouTube iframe sits in a 2x2 px, opacity .01, pointer-events:none box behind
  // everything (audio only); the only radio UI is the top bar (credit ticker + ⏮ / station / ⏭ / CR) and the station-ID card that drops from it ----
  const css = document.createElement('style');
  css.textContent = `
  #rid { position: fixed; z-index: 59; left: 0; right: 0; top: 0; height: calc(env(safe-area-inset-top, 0px) + 28px); padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) 0 env(safe-area-inset-left, 0px);
    box-sizing: border-box; display: flex; align-items: center; gap: 4px; pointer-events: none;
    background: linear-gradient(#1b1030, #120a22); border-bottom: 2px solid #000; box-shadow: 0 2px 0 rgba(255,61,110,.55); }
  #ridt { flex: 1; min-width: 0; height: 26px; display: flex; align-items: center; white-space: nowrap; overflow: hidden;
    font: 800 11px/26px system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: .3px; color: #fff; }
  #ridt span { display: inline-block; padding-left: 8px; }
  #ridt b { color: #ffd23c; font-weight: 900; } #ridt i { color: #ff9ad0; font-style: normal; } #ridt u { color: #8fe8ff; text-decoration: none; } #ridt em { color: #7dffb0; font-style: normal; font-weight: 900; }
  #ridt.scroll span { animation: ridm var(--dur, 18s) linear 1.5s infinite; }
  @keyframes ridm { 0%, 6% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
  .ric { width: 1.35em; height: 1em; vertical-align: -0.12em; color: #ffd23c; display: inline-block; }
  .rsv { width: 1.25em; height: .9em; vertical-align: -0.08em; display: inline-block; }
  #rctl { flex: none; display: flex; gap: 3px; padding-right: 4px; pointer-events: auto; }
  #rctl button { all: unset; cursor: pointer; box-sizing: border-box; height: 22px; min-width: 28px; padding: 0 5px; border-radius: 5px; border: 1px solid #000; box-shadow: inset 0 0 0 1px #5a4a80;
    background: #2a1650; color: #ffd23c; text-align: center; font: 900 12px/20px system-ui, sans-serif; white-space: nowrap; touch-action: manipulation; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  #rctl #rst { background: #ff9ad0; color: #14101f; font: 7px/20px 'PX', monospace; max-width: 34vw; overflow: hidden; text-overflow: ellipsis; }
  #rctl #rst .ric { color: #14101f; } #rid.off #rctl #rst:not(.hold) { background: #777; color: #eee; } #rid.off .rsk { opacity: .4; }
  #rctl #rst.hold { background: #ff3d6e; color: #fff; }
  #rctl #rcrb { font-size: 9px; color: #8fe8ff; }
  #rctl button:active { background: #ff3d6e; color: #fff; }
  body.touch #rid { height: calc(env(safe-area-inset-top, 0px) + 30px); } body.touch #rctl button { height: 26px; min-width: 32px; line-height: 24px; }
  body.radio #proto { top: calc(env(safe-area-inset-top, 0px) + 36px); } body.radio #hpbox { top: calc(env(safe-area-inset-top, 0px) + 38px); }
  body.radio #mmap { top: calc(env(safe-area-inset-top, 0px) + 64px); } body.radio #clock { top: calc(env(safe-area-inset-top, 0px) + 126px); }
  body.radio #qbtn { top: calc(env(safe-area-inset-top, 0px) + 142px); }
  #ridc { position: fixed; z-index: 61; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 34px); width: min(560px, calc(100vw - 16px)); box-sizing: border-box; pointer-events: none;
    transform: translate(-50%, -150%); opacity: 0; transition: transform .45s cubic-bezier(.2,1.4,.4,1), opacity .3s; padding: 9px 12px 10px; text-align: center;
    background: linear-gradient(#2a1650, #160c2c); border: 3px solid #000; box-shadow: 4px 4px 0 #000, inset 0 0 0 2px #ff3d6e; color: #fff; }
  #ridc.on { transform: translate(-50%, 0); opacity: 1; }
  #ridc .st { font: 10px/1.4 'PX', monospace; color: #ffd23c; text-shadow: 2px 2px 0 #000; letter-spacing: 1px; }
  #ridc .sh { font: 800 10px/1.6 system-ui, sans-serif; letter-spacing: 3px; color: #8fe8ff; }
  #ridc .np { font: 900 16px/1.25 system-ui, -apple-system, sans-serif; margin-top: 3px; text-shadow: 2px 2px 0 #000; }
  #ridc .cr { font: 800 13px/1.35 system-ui, sans-serif; color: #ffb3dc; margin-top: 2px; text-shadow: 1px 1px 0 #000; }
  #ridc .lc { font: 700 11px/1.35 system-ui, sans-serif; color: #c9f3ff; margin-top: 2px; word-break: break-all; }
  #ridc .lc:empty { display: none; }
  #ridc .bp { font: italic 800 12px/1.35 system-ui, -apple-system, sans-serif; color: #7dffb0; margin-top: 5px; padding-top: 4px; border-top: 1px dashed rgba(255,154,208,.45); text-shadow: 1px 1px 0 #000; }
  #ridc .bp:empty { display: none; }
  #rplay { position: fixed; left: 0; bottom: 0; width: 2px; height: 2px; overflow: hidden; opacity: .01; pointer-events: none; z-index: -1; }
  #rplay iframe, #rplay > div { width: 2px !important; height: 2px !important; border: 0; pointer-events: none; }
  #rbcw { display: none; position: fixed; z-index: 58; right: 6px; bottom: calc(var(--panel, 0px) + 8px); /* only for a Bandcamp fallback item: above the arcade panel, clear of the top HUD */ width: min(360px, calc(100vw - 12px)); box-sizing: border-box; padding: 4px;
    background: #120a22; border: 2px solid #000; box-shadow: 3px 3px 0 #000; pointer-events: auto; }
  #rbcw.on { display: block; }
  #rbcw b { display: block; font: 9px/1.5 'PX', monospace; color: #ffd23c; text-align: center; animation: rblink 1s steps(2) infinite; }
  #rbcw.tapped b { animation: none; color: #8fe8ff; }
  @keyframes rblink { 50% { opacity: .35; } }
  #rbcw iframe, #rbcw .rbcstub { width: 100%; height: 42px; border: 0; display: block; }
  #rbcw .rbcstub { display: flex; align-items: center; justify-content: center; font: 800 11px/1.3 system-ui, sans-serif; color: #ccc; background: repeating-linear-gradient(45deg,#181818 0 8px,#202020 8px 16px); }
  #rcred { position: fixed; z-index: 72; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(460px, calc(100vw - 20px)); max-height: min(560px, calc(100vh - 60px)); overflow: auto;
    box-sizing: border-box; padding: 10px 12px 12px; background: #160c2c; color: #fff; border: 3px solid #000; box-shadow: 4px 4px 0 #000, inset 0 0 0 2px #ff3d6e; font: 600 12px/1.4 system-ui, sans-serif; }
  #rcred.hide { display: none; }
  #rcred h3 { margin: 0 0 6px; font: 11px/1.4 'PX', monospace; color: #ffd23c; display: flex; justify-content: space-between; align-items: center; }
  #rcred h3 button { all: unset; cursor: pointer; padding: 3px 8px; background: #ff3d6e; color: #fff; border: 2px solid #000; font: 900 12px/1 system-ui, sans-serif; }
  #rcred li { margin: 0 0 7px; } #rcred ul { margin: 0; padding-left: 16px; } #rcred a { color: #8fe8ff; word-break: break-all; } #rcred .t { font-weight: 900; } #rcred .m { color: #ffb3dc; }
  #rcred p { margin: 6px 0 0; color: #bbb; font-size: 11px; }
  @media (max-width: 480px) { #ridc .np { font-size: 14px; } #ridc .cr { font-size: 12px; } #ridt { font-size: 10px; } }`;
  document.head.appendChild(css);
  const el = (tag, id, html) => { const e = document.createElement(tag); if (id) e.id = id; if (html) e.innerHTML = html; document.body.appendChild(e); return e; };
  const bar = el('div', 'rid', '<div id="ridt"><span></span></div><div id="rctl"><button class="rsk" id="rprev" type="button" title="previous track (B)" aria-label="previous track">' + PREV + '</button>'
    + '<button id="rst" type="button" title="tap: next station (T) · hold: radio off/on (M)"></button><button class="rsk" id="rnext" type="button" title="next track (N)" aria-label="next track">' + NEXT + '</button>'
    + '<button id="rcrb" type="button" title="radio credits" aria-label="radio credits">CR</button></div>');
  const card = el('div', 'ridc', '<div class="st"></div><div class="sh"></div><div class="np"></div><div class="cr"></div><div class="lc"></div><div class="bp"></div>');
  const rplay = el('div', 'rplay'); rplay.setAttribute('aria-hidden', 'true');
  const bcw = el('div', 'rbcw', '<b>TAP ▶ TO PLAY</b>');
  const cred = el('div', 'rcred'); cred.classList.add('hide');
  document.body.classList.add('radio');
  const tickerS = bar.querySelector('#ridt'), tickerSpan = tickerS.querySelector('span');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const who = (t) => (t.artist ? t.artist : '') + (t.prod ? (t.artist ? ' · ' : '') + 'prod. ' + t.prod : '');
  const credit = (t) => `"${t.title}"${t.tag ? ` (${t.tag})` : ''} · ${who(t)}${t.lic ? ` · ${t.lic}` : ''}`;
  const isBC = (t) => !!(t && t.bc && (FORCE_BC || R.ytFail.has(t.id) || R.noSignal));
  const stName = () => (R.station === 'auto' ? (R.list === 'night' ? SNAME.night : SNAME.day) + ' (AUTO)' : SNAME[R.station]);
  const idText = (t) => `📻 ${STATION} · ${stName()} · NOW PLAYING: ${credit(t)}`;
  const srcLine = (t) => (t.lic ? `${t.lic} · ${(isBC(t) ? t.src : t.yt).replace('https://', '')}` : `YouTube · ${t.yt.replace('https://', '')}`);

  // ---- credits list (title, artist, licence + link, source) ----
  cred.innerHTML = `<h3><span>RADIO CREDITS</span><button type="button" id="rcrx">CLOSE</button></h3><ul>${[...new Set(Object.values(TRACKS).flat())].map((t) =>
    `<li><span class="t">"${esc(t.title)}"${t.tag ? ` (${esc(t.tag)})` : ''}</span> · <span class="m">${esc(who(t))}</span><br>${t.lic
      ? `Licence: <a href="${t.licUrl}" target="_blank" rel="noopener">${t.lic}</a> · Source: <a href="${t.src}" target="_blank" rel="noopener">${esc(t.src.replace('https://', ''))}</a> · YouTube: <a href="${t.yt}" target="_blank" rel="noopener">${t.yt.replace('https://', '')}</a>`
      : `YouTube upload, played through the YouTube embed (not shipped with the game): <a href="${t.yt}" target="_blank" rel="noopener">${t.yt.replace('https://', '')}</a>`}</li>`).join('')}</ul>
    <p>Creative Commons tracks are played unedited from the artists' own YouTube / Bandcamp pages. No audio is shipped with the game. B-MORE 410 REMIX plays 20-second clips of Brad's Baltimore classics through the same YouTube embeds, crossfaded live in the player (nothing is cut or downloaded). Stations: B-MORE 410 REMIX, AUTO, B-MORE 410 DAY, B-MORE 410 NIGHT, DUCKY DYNAMO FM, LOR BITEWHO, B-MORE CLUB, B-MORE RAP.</p>`;
  const showCred = (on) => { cred.classList.toggle('hide', !on); R.credOpen = on; };

  let lastHtml = '';
  function setTicker(html, plain) {
    if (html === lastHtml) return; lastHtml = html; tickerSpan.innerHTML = html; R.tickerText = tickerSpan.textContent; tickerS.classList.remove('scroll');
    requestAnimationFrame(() => { if (tickerSpan.scrollWidth > tickerS.clientWidth - 8) { // too long for the strip: a seamless marquee (text, gap, text) that starts left-aligned
      tickerSpan.innerHTML = html + '<span style="display:inline-block;width:60px"></span>' + html; tickerS.style.setProperty('--dur', Math.max(12, plain.length * 0.26) + 's'); tickerS.classList.add('scroll'); } });
  }
  function render() {
    if (R.lend) { $('rst').innerHTML = ICON + ' VIC'; bar.classList.remove('off'); setTicker(R.lend.html || '', R.lend.plain || ''); return; } // a boss fight has the player (lend)
    const t = R.cur; const lab = R.station === 'auto' ? 'AUTO·' + (R.list === 'night' ? 'NIGHT' : 'DAY') : SSHORT[R.station];
    $('rst').innerHTML = ICON + ' ' + (R.on ? lab : 'OFF'); bar.classList.toggle('off', !R.on);
    if (!t) return;
    if (R.offAir) { setTicker(`${ICON} <b>${STATION}</b> · <i>OFF AIR</i> · no track can be played right now`, 'off air'); return; }
    const cr = `"${esc(t.title)}"${t.tag ? ` (${esc(t.tag)})` : ''} · ${esc(who(t))}${t.lic ? ` · <u>${t.lic}</u>` : ''}`;
    let tip = '';
    if (R.on && !R.started) tip = 'TAP TO TUNE IN · ';
    else if (R.on && isBC(t) && !R.bcTapped) tip = 'TAP ▶ ON THE BANDCAMP PLAYER · ';
    if (!R.on) setTicker(`${ICON} <b>${STATION}</b> · <i>RADIO OFF</i> · tap the station button, press T / M or tap R to tune in`, 'radio off press to tune in');
    else setTicker(`${tip ? `<em>${tip}</em>` : ''}${ICON} <b>${STATION}</b> · <b>${esc(stName())}</b> · <i>NOW PLAYING:</i> ${cr}${isBC(t) ? ' · via Bandcamp' : ''}`, tip + idText(t));
  }
  function stationId(reason) { // the big card slides in, then it shrinks back to the slim ticker
    const t = R.cur; R.ids++;
    card.querySelector('.st').innerHTML = `${ICON} ${STATION}`;
    if (!R.on || !t) {
      card.querySelector('.sh').textContent = 'STATION DIAL'; card.querySelector('.np').textContent = 'RADIO OFF';
      card.querySelector('.cr').textContent = 'tap the station button or press T / M to tune back in'; card.querySelector('.lc').textContent = '';
    } else {
      card.querySelector('.sh').textContent = stName() + (reason === 'dusk' ? ' · DUSK' : reason === 'dawn' ? ' · DAWN' : '');
      card.querySelector('.np').textContent = `NOW PLAYING: "${t.title}"${t.tag ? ` (${t.tag})` : ''}`;
      card.querySelector('.cr').textContent = who(t);
      card.querySelector('.lc').textContent = srcLine(t);
    }
    const bump = R.on && t ? R.bumpNext : null; R.bumpNext = null; card.querySelector('.bp').textContent = bump ? bump.text : ''; if (bump) R.bumps.push({ at: +(S.time || 0).toFixed(2), st: R.station, id: bump.id });
    card.classList.remove('on'); void card.offsetWidth; card.classList.add('on'); R.bigT = BIG_S;
    R.log.push({ at: +(S.time || 0).toFixed(2), reason, st: R.station, list: R.on ? R.list : 'off', id: t ? t.id : '', src: t && R.on ? (isBC(t) ? 'bc' : 'yt') : '', text: R.on && t ? idText(t) : 'RADIO OFF' });
    render();
  }

  // ---- playlist logic ----
  const nightNow = () => 0.5 - 0.5 * Math.cos((CYC.pin !== null ? CYC.pin : CYC.tod) * TAU) > 0.5; // dusk = tod .25, dawn = tod .75 on the game's loop
  const listFor = (st) => (TRACKS[st] ? st : nightNow() ? 'night' : 'day');
  const playable = (t) => !R.bad.has(t.id) && (t.bc || !(R.ytFail.has(t.id) || R.noSignal));
  function step(list, dir) { // next / previous playable track in a playlist; null if none can play
    const L = TRACKS[list]; for (let k = 1; k <= L.length; k++) { const raw = R.idx[list] + dir * k;
      if (list === 'remix' && dir > 0 && raw >= L.length) { const lastT = L[R.idx.remix] || null; shuffle(L, lastT); R.idx.remix = -1; R.log.push({ at: +(S.time || 0).toFixed(2), reason: 'reshuffle', list: 'remix', id: '' }); return step(list, dir); } // all 30 played: new shuffle, never the same track twice in a row
      const i = ((raw % L.length) + L.length) % L.length; if (playable(L[i])) { R.idx[list] = i; return L[i]; } } return null;
  }
  // ---- Bandcamp embed (official player; no JS API) ----
  function clearBC() { R.bc = null; R.bcLeft = 0; R.bcTapped = false; bcw.classList.remove('on', 'tapped'); const f = bcw.querySelector('iframe, .rbcstub'); if (f) f.remove(); }
  function showBC(t) {
    clearBC(); R.bc = t; R.bcLeft = t.len + 4;
    if (!R.on || !R.started) return; bcw.classList.add('on'); // the frame is added once the radio is on and tuned in
    let f;
    if (TEST) { f = document.createElement('div'); f.className = 'rbcstub'; f.textContent = 'Bandcamp player (test stub) ' + t.bc; }
    else { f = document.createElement('iframe'); f.title = `${t.title} by ${t.artist} (Bandcamp)`; f.setAttribute('seamless', ''); f.allow = 'autoplay';
      f.src = `https://bandcamp.com/EmbeddedPlayer/size=small/bgcol=333333/linkcol=ffd23c/transparent=true/track=${t.bc}/`; }
    bcw.appendChild(f);
  }
  addEventListener('blur', () => { setTimeout(() => { const f = bcw.querySelector('iframe'); if (f && document.activeElement === f && R.bc && !R.bcTapped) { R.bcTapped = true; R.bcLeft = R.bc.len + 2; bcw.classList.add('tapped'); bcw.querySelector('b').textContent = 'ON AIR · ' + R.bc.title; duck(true); render(); } }, 0); });
  function stopYT() { rxCancel(); try { if (R.player && R.ready) R.player.pauseVideo(); } catch (e) {} R.playing = false; }
  function play(t, reason) { // put a track on the air (YouTube, or the Bandcamp embed for a CC track YouTube refused)
    R.cur = t; clearBC(); bcw.querySelector('b').textContent = 'TAP ▶ TO PLAY';
    if (R.list === 'remix') rxClip(t); else rxCancel();
    if (isBC(t)) { stopYT(); duck(false); if (!R.held) showBC(t); }
    else if (R.player && R.ready) {
      try { if (R.started && R.on && !R.held) { R.vol = 0; R.player.setVolume(0); R.goal = VOL; R.player.loadVideoById(vid(t)); } else R.player.cueVideoById(vid(t)); } catch (e) {}
    }
    if (R.list === 'remix' && /^(remix|next|prev|skip)$/.test(reason)) clipCredit(t, reason); else stationId(reason);
    if (R.list === 'remix' && R.started && R.on && !R.held) rxPreload();
  }
  function offAir() { R.offAir = true; R.cur = R.cur || TITLE; R.playing = false; duck(false); clearBC(); stopYT(); render(); }
  function tune(list, dir, reason) { // move along a playlist; if that whole list can't play, borrow another one
    let t = step(list, dir);
    if (!t) for (const o of Object.keys(TRACKS)) { if (o !== list && (t = step(o, 1))) { list = o; break; } }
    if (!t) return offAir();
    R.list = list; play(t, reason);
  }
  function fadeThen(fn, fast) { R.goal = 0; R.after = fn; R.fast = !!fast; } // crossfade: volume down, swap, back up (a player's own switch uses a quick dip)
  function swap(fn, fast) { if (R.started && R.on && R.vol > 1 && !isBC(R.cur) && !R.after) fadeThen(fn, fast); else { R.after = null; fn(); } }
  function advance(reason) { if (R.list === 'remix' && R.station === 'remix') return rxAdvance(reason); tune(R.list || listFor(R.station), 1, reason); }
  function skip(dir) { // N / B / ⏭ / ⏮
    if (R.lend) return;
    if (!R.started) start();
    if (!R.on) { setStation(R.lastSt); return; }
    if (R.list === 'remix' && dir > 0 && RX.dual && RX.pre && RX.pre.ready && !RX.fade && R.playing) { rxCross(XF_FAST, 'next'); return; } // ⏭ on REMIX: a quick crossfade into the preloaded clip
    if (R.list === 'remix') rxCancel();
    swap(() => tune(R.list, dir, dir > 0 ? 'next' : 'prev'), true);
  }
  const BUMPS = {}; for (const b of (typeof GR1 !== 'undefined' && GR1.radio && GR1.radio.bumpers) || []) if (STATIONS.includes(b.station) && !/canary/.test(b.id)) (BUMPS[b.station] = BUMPS[b.station] || []).push(b);
  R.bumps = []; R.bumpI = {};
  const bumperFor = (st) => { const L = BUMPS[st]; if (!L) return null; R.bumpI[st] = ((R.bumpI[st] ?? -1) + 1) % L.length; return L[R.bumpI[st]]; }; // cycles through a station's bumpers
  function setStation(st, why) { // the dial: auto / day / night / ducky / off
    if (!STATIONS.includes(st)) return;
    const wasOn = R.on; R.station = st; try { localStorage.setItem(LS, st); } catch (e) {}
    if (RX.fade || (R.list === 'remix' && st !== 'remix')) rxCancel();
    if (st === 'off') { R.on = false; R.after = null; R.goal = 0; stopYT(); duck(false); if (R.bc) clearBC(); R.wasBC = isBC(R.cur); stationId('off'); return; }
    R.lastSt = st; R.on = true; R.offAir = false;
    R.bumpNext = bumperFor(st); // GR1 station bumper: rides on the station-ID card this tune-in shows
    const list = listFor(st);
    if (!R.started) { if (R.list !== list) tune(list, 1, why || 'station'); else stationId(why || 'station'); return; }
    if (!wasOn && R.list === list && R.cur) { resume(); stationId(why || 'on'); return; } // back on: pick up where it was
    if (R.list === list) { stationId(why || 'station'); return; } // same playlist (e.g. AUTO -> DAY by day): just the station ID
    swap(() => tune(list, 1, why || 'station'), true);
  }
  function resume() {
    const t = R.cur; if (!t || R.held) return;
    if (isBC(t)) { showBC(t); return; }
    try { if (R.player && R.ready) { R.vol = 0; R.player.setVolume(0); R.goal = VOL; R.player.playVideo(); } } catch (e) {}
    if (R.list === 'remix') { rxClip(t, true); rxPreload(); }
  }
  const cycle = () => { if (R.lend) return; if (!R.started) start(); setStation(STATIONS[(STATIONS.indexOf(R.station) + 1) % STATIONS.length]); };
  const toggle = () => { if (R.lend) return; if (!R.started) start(); setStation(R.on ? 'off' : R.lastSt || 'remix'); };
  // hold(true): a set piece with its own music (Fort McHenry) takes the air: the radio pauses (iOS ignores setVolume, so a pause is the only
  // dependable "duck"); hold(false) puts it back where it was. The dial still works while held but nothing plays until release.
  function hold(on) {
    on = !!on; if (R.held === on) return; R.held = on;
    if (on) { R.heldWas = { on: R.on, started: R.started, bc: R.bc ? R.cur : null }; rxCancel(); R.after = null; R.goal = 0;
      try { if (R.player && R.ready) R.player.pauseVideo(); } catch (e) {} try { if (RX.idle && RX.idle !== R.player) { RX.idle.pauseVideo(); RX.idle.mute(); } } catch (e) {}
      R.playing = false; if (R.bc) clearBC(); duck(false); rlog({ reason: 'hold' }); }
    else { rlog({ reason: 'release' }); if (!R.lend && R.on && R.started && !R.offAir && R.cur) resume(); render(); }
  }
  R.hold = hold;
  // ---- boss mini-games duck the radio: every player's setVolume is scaled by DUCK.k (re-wrapped if the IFrame API swaps the method) ----
  const DUCK = { k: 1 };
  function dwrap(P) { if (!P || typeof P.setVolume !== 'function' || P.setVolume.__dk) return; const sv = P.setVolume; const f = function (v) { return sv.call(this, Math.round(v * DUCK.k)); }; f.__dk = true; P.setVolume = f; }
  function duckTo(k) { DUCK.k = clamp(+k, 0, 1); for (const P of [RX.A, RX.B, R.player]) { if (!P) continue; dwrap(P); }
    try { if (R.player && R.ready && !RX.fade) R.player.setVolume(Math.round(R.vol)); } catch (e) {} R.log.push({ at: +(S.time || 0).toFixed(2), reason: 'duck ' + DUCK.k }); }
  // boss duels (09a_duel_core.js): fightDuck(on) = duckTo(0.22) / duckTo(1), reusing the one setVolume wrapper above.
  function fightDuck(on) { duckTo(on ? 0.22 : 1); }
  function duck(on) { try { if (SFXBUS) SFXBUS.gain.setTargetAtTime(on ? 0.62 : 1, AC.currentTime, 0.3); } catch (e) {} }


  // ---- B-MORE 410 REMIX engine: 20 s peak clips, next clip preloaded muted on the idle player, equal-power crossfade (or a fast-seek cut on iOS) ----
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const CLIP = Math.max(4, +Q.get('remixclip') || 20), XF = Math.min(3, CLIP / 4), XF_FAST = 0.8, RXLOG = Q.has('radiolog');
  const RX = { dual: Q.get('remix2') === '1' ? true : Q.get('remix1') === '1' ? false : !IOS, A: null, B: null, bReady: false, idle: null, pre: null, fade: null, start: 0, t: 0, adj: false, clips: 0, fades: 0 };
  const rlog = (o) => { const e = { at: +(S.time || 0).toFixed(2), ...o }; R.log.push(e); if (RXLOG) console.log('[remix]', JSON.stringify(e)); };
  const peakOf = (t) => (REMIX_PEAK[t.id] != null ? REMIX_PEAK[t.id] : 45); // 45 s = the fallback guess until the length is known
  const fbStart = (dur) => Math.max(0, Math.min(Math.max(30, dur * 0.35), dur - CLIP - 5));
  const vid = (t) => (R.list === 'remix' ? { videoId: t.id, startSeconds: R.cur === t ? RX.start : peakOf(t) } : t.id);
  const ptime = (p) => { try { const v = p.getCurrentTime(); return isFinite(v) ? v : NaN; } catch (e) { return NaN; } };
  const pdur = (p) => { try { return +p.getDuration() || 0; } catch (e) { return 0; } };
  function clipCredit(t, reason) { // each clip: the credit changes in the slim top bar (the big card only drops on a station switch)
    lastHtml = ''; render(); rlog({ reason: 'clip', st: R.station, list: 'remix', id: t.id, title: t.title, start: RX.start, peak: REMIX_PEAK[t.id] != null ? 'heatmap' : 'fallback', mode: RX.dual ? 'crossfade' : 'cut', why: reason, text: idText(t) });
  }
  function rxClip(t, keep) { if (!keep) { RX.start = peakOf(t); RX.adj = REMIX_PEAK[t.id] != null; } RX.t = 0; RX.clips++; }
  function rxCancel() { // drop the preload / any crossfade in flight (station switch, off, ⏮); the preloaded track goes back in the shuffle
    if (RX.fade) { const f = RX.fade; RX.fade = null; try { f.from.setPlaybackRate(1); f.from.setVolume(Math.round(R.vol)); } catch (e) {} }
    if (RX.pre) { const p = RX.idle; try { p.pauseVideo(); p.mute(); p.setVolume(0); } catch (e) {} const L = TRACKS.remix; R.idx.remix = (R.idx.remix - 1 + L.length) % L.length; RX.pre = null; }
  }
  function rxPreload() { // next clip on the idle player: muted, playing just long enough to buffer at its peak, then paused there
    if (!RX.dual || !RX.bReady || !RX.idle || RX.pre || RX.fade || !R.started || !R.on || R.list !== 'remix') return;
    const t = step('remix', 1); if (!t) return;
    RX.pre = { t, start: peakOf(t), ready: false, adj: REMIX_PEAK[t.id] != null, at: performance.now() };
    try { const p = RX.idle; p.mute(); p.setVolume(0); p.loadVideoById({ videoId: t.id, startSeconds: RX.pre.start }); } catch (e) {}
    rlog({ reason: 'preload', id: t.id, start: RX.pre.start });
  }
  function rxIdleState(s) { // state events from the idle (preloading) player
    const P = RX.pre; if (!P || RX.fade) return;
    if (s === 1 && P.ready) { try { RX.idle.pauseVideo(); } catch (e) {} return; } // keep the preloaded clip parked at its peak
    if (s === 1 && !P.ready) {
      const p = RX.idle; let vd = null; try { vd = p.getVideoData ? p.getVideoData().video_id : p.vid; } catch (e) {} if (vd && vd !== P.t.id) return; // (a stale event from the previous video)
      if (!P.adj) { const d = pdur(p); if (d > 0) { P.start = fbStart(d); P.adj = true; try { p.seekTo(P.start, true); } catch (e) {} } }
      try { p.pauseVideo(); } catch (e) {} P.ready = true; rlog({ reason: 'preloaded', id: P.t.id, start: +P.start.toFixed(1), ms: Math.round(performance.now() - P.at) });
    }
  }
  function rxIdleError(code) { const P = RX.pre; if (!P) return; R.bad.add(P.t.id); rlog({ reason: 'error ' + code + ' (preload)', id: P.t.id }); RX.pre = null; rxPreload(); }
  function rxCross(dur, why) { // equal-power crossfade: out = cos, in = sin; a tape-drag on the outgoing clip near the end
    const P = RX.pre, from = R.player, to = RX.idle;
    RX.fade = { from, to, t: 0, t0: performance.now(), dur, why, tape: false, P, v0: Math.max(R.vol, 1) };
    try { to.setVolume(0); to.unMute(); to.playVideo(); } catch (e) {}
    RX.fades++; rlog({ reason: 'xfade-start', from: R.cur && R.cur.id, to: P.t.id, dur, clipT: +RX.t.toFixed(2), why });
  }
  function rxFadeTick(dt) {
    const F = RX.fade; F.t = (performance.now() - F.t0) / 1000; const x = Math.min(1, F.t / F.dur);
    try { F.from.setVolume(Math.round(F.v0 * Math.cos(x * Math.PI / 2))); F.to.setVolume(Math.round(VOL * Math.sin(x * Math.PI / 2))); } catch (e) {}
    if (!F.tape && x > 0.72) { F.tape = true; try { F.from.setPlaybackRate(0.5); } catch (e) {} } // tape-drag on the way out
    if (x < 1) return;
    try { F.from.pauseVideo(); F.from.mute(); F.from.setPlaybackRate(1); F.from.setVolume(0); } catch (e) {}
    RX.fade = null; R.player = F.to; RX.idle = F.from; RX.pre = null;
    R.cur = F.P.t; R.vol = R.goal = VOL; R.playing = true; RX.start = F.P.start; RX.adj = true; RX.t = Math.max(0, (ptime(F.to) || F.P.start + F.t) - F.P.start); RX.clips++;
    rlog({ reason: 'xfade-end', id: R.cur.id, ms: Math.round(F.t * 1000) }); clipCredit(R.cur, F.why); rxPreload();
  }
  function rxAdvance(reason) { // the clip is over (or the track ended / errored): crossfade if the next one is ready, else a quick cut
    if (RX.fade) return;
    if (RX.dual && RX.pre && RX.pre.ready && reason !== 'skip') return rxCross(reason === 'remix' ? XF : XF_FAST, reason);
    if (RX.pre) rxCancel();
    const go = () => tune('remix', 1, reason === 'skip' ? 'skip' : 'remix');
    if (reason === 'skip') { R.after = null; go(); } else swap(go, true);
  }
  function rxTick(dt) {
    if (R.held || R.lend) return;
    if (R.station !== 'remix' || R.list !== 'remix' || !R.started || !R.on || R.offAir || !R.cur) return;
    if (RX.fade) { rxFadeTick(dt); return; }
    if (!R.playing || R.after) return;
    const ct = ptime(R.player);
    if (!RX.adj) { const d = pdur(R.player); if (d > 0) { RX.adj = true; const s0 = fbStart(d); if (Math.abs(s0 - RX.start) > 2) { RX.start = s0; try { R.player.seekTo(s0, true); } catch (e) {} RX.t = 0; rlog({ reason: 'fallback-start', id: R.cur.id, start: +s0.toFixed(1), len: Math.round(d) }); return; } } }
    RX.t = isFinite(ct) && ct >= RX.start - 1 ? Math.max(0, ct - RX.start) : RX.t + dt;
    if (!RX.pre && RX.dual) rxPreload();
    const lead = RX.dual && RX.pre && RX.pre.ready ? XF : 0.4; // dual: the fade fills the last 3 s; one player: a 0.35 s dip then the cut
    if (RX.t >= CLIP - lead) { rlog({ reason: 'clip-end', id: R.cur.id, clipT: +RX.t.toFixed(2) }); rxAdvance('remix'); }
  }
  // ---- YouTube IFrame Player API (or the test stub) ----
  function onReady(e) {
    if (e && e.target) dwrap(e.target);
    if (e && e.target && RX.B && e.target === RX.B && RX.A !== RX.B) { RX.bReady = true; try { RX.B.mute(); RX.B.setVolume(0); } catch (er) {} rxPreload(); return; } // the second (remix) player
    R.ready = true; try { R.player.setVolume(0); } catch (e) {} const t = R.cur; if (t && !isBC(t)) { try { if (R.started && R.on) { R.player.loadVideoById(vid(t)); R.goal = VOL; } else R.player.cueVideoById(vid(t)); } catch (e) {} } render(); }
  function onState(e) {
    if (R.lend) { try { R.lend.onState && R.lend.onState(e); } catch (er) {} return; } // lent to a boss fight: its events, not the radio's
    if (e && e.target && R.player && e.target !== R.player) { if (RX.fade && e.target === RX.fade.to) return; rxIdleState(e.data); return; } // events from the idle remix player
    if (RX.fade && e && e.data !== 1) return; // the outgoing clip is being faded out / paused by the crossfade
    const s = e.data; // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
    if (s === 1 && R.held) { R.playing = false; try { R.player.pauseVideo(); } catch (er) {} return; }
    if (s === 1) { R.playing = true; if (!R.on || isBC(R.cur)) { try { R.player.pauseVideo(); } catch (er) {} } else { duck(true); if (R.goal === 0 && !R.after) R.goal = VOL; } }
    else if (s === 0) { R.playing = false; if (R.on && !isBC(R.cur)) advance('next'); }
    else if (s === 2) { R.playing = false; if (!isBC(R.cur)) duck(false); }
    render();
  }
  function onError(e) { // 2 bad id, 5 html5, 100 gone, 101/150 embedding not allowed: a CC track falls back to Bandcamp, anything else is skipped
    if (R.lend) { try { R.lend.onError && R.lend.onError(e); } catch (er) {} return; }
    if (e && e.target && R.player && e.target !== R.player) { if (RX.fade && e.target === RX.fade.to) { const P = RX.fade.P; rxCancel(); R.bad.add(P.t.id); rxPreload(); } else rxIdleError(e.data); return; }
    const t = R.cur; if (!t || isBC(t)) return; R.log.push({ at: +(S.time || 0).toFixed(2), reason: 'error ' + (e && e.data), id: t.id }); R.playing = false;
    if (t.bc) { R.ytFail.add(t.id); play(t, 'bandcamp'); } else { R.bad.add(t.id); advance('skip'); }
  }
  function makeStub() { // ?radiotest=1: same calls, no network; the box shows a placeholder of the same size. Each stub keeps a clock (getCurrentTime) and a 200 s length.
    const sd = document.createElement('div'); sd.id = 'rstub'; rplay.appendChild(sd);
    const mk = (name) => { const P = { name, v: 0, muted: false, rate: 1, vid: null, pos: 0, t0: 0, on: false, calls: [], setVolume(v) { this.v = v; }, getVolume() { return this.v; },
      mute() { this.muted = true; }, unMute() { this.muted = false; }, isMuted() { return this.muted; }, setPlaybackRate(r) { this.sync(); this.rate = r; }, getDuration() { return this.vid ? 200 : 0; },
      sync() { if (this.on) { const n = performance.now(); this.pos += (n - this.t0) / 1000 * this.rate; this.t0 = n; } }, getCurrentTime() { this.sync(); return this.pos; },
      seekTo(s) { this.sync(); this.pos = s; this.calls.push('seek ' + s); },
      loadVideoById(a) { const id = typeof a === 'object' ? a.videoId : a; this.vid = id; this.pos = (typeof a === 'object' && a.startSeconds) || 0; this.on = false; this.calls.push('load ' + id + '@' + this.pos);
        setTimeout(() => { if (this.vid !== id) return; this.on = true; this.t0 = performance.now(); onState({ data: 1, target: P }); }, 30); },
      cueVideoById(a) { const id = typeof a === 'object' ? a.videoId : a; this.vid = id; this.pos = (typeof a === 'object' && a.startSeconds) || 0; this.calls.push('cue ' + id); },
      playVideo() { this.calls.push('play'); setTimeout(() => { this.sync(); this.on = true; this.t0 = performance.now(); onState({ data: 1, target: P }); }, 30); },
      pauseVideo() { this.sync(); this.on = false; this.calls.push('pause'); setTimeout(() => onState({ data: 2, target: P }), 10); }, stopVideo() { this.calls.push('stop'); } }; return P; };
    const A = mk('A'); R.player = RX.A = A; setTimeout(() => onReady({ target: A }), 50);
    if (RX.dual) { const B = mk('B'); RX.B = RX.idle = B; setTimeout(() => onReady({ target: B }), 80); }
  }
  function noSignal() { // YouTube unreachable (offline, blocked network): the CC tracks still play through Bandcamp; the rest wait
    if (R.ready) return; R.noSignal = true;
    if (R.cur && !R.cur.bc) advance('skip'); else if (R.cur) play(R.cur, 'bandcamp'); render();
  }
  function makeYT() { // our own audio-only iframe (allow="autoplay" only, no controls / fullscreen / keyboard), then the IFrame API binds to it
    const f = document.createElement('iframe'); f.id = 'rplayer'; f.title = 'B-MORE 410 RADIO audio'; f.setAttribute('allow', 'autoplay'); f.setAttribute('tabindex', '-1'); f.setAttribute('aria-hidden', 'true');
    f.width = 2; f.height = 2; f.frameBorder = '0';
    f.src = 'https://www.youtube.com/embed/' + TITLE.id + '?enablejsapi=1&playsinline=1&controls=0&fs=0&disablekb=1&rel=0&iv_load_policy=3&modestbranding=1&origin=' + encodeURIComponent(location.origin);
    rplay.appendChild(f);
    let f2 = null; if (RX.dual) { // the second hidden audio-only player for REMIX crossfades (same 2x2 px, opacity .01, pointer-events:none box)
      f2 = document.createElement('iframe'); f2.id = 'rplayer2'; f2.title = 'B-MORE 410 REMIX audio'; f2.setAttribute('allow', 'autoplay'); f2.setAttribute('tabindex', '-1'); f2.setAttribute('aria-hidden', 'true');
      f2.width = 2; f2.height = 2; f2.frameBorder = '0'; f2.src = f.src.replace(TITLE.id, POOL[0].id); rplay.appendChild(f2); }
    const mk = () => { R.player = RX.A = new YT.Player('rplayer', { events: { onReady, onStateChange: onState, onError } });
      if (f2) RX.B = RX.idle = new YT.Player('rplayer2', { events: { onReady, onStateChange: onState, onError } }); };
    if (window.YT && YT.Player) mk(); else { const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { prev && prev(); mk(); };
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true; s.onerror = noSignal; setTimeout(() => { if (!R.ready) noSignal(); }, 15000); document.head.appendChild(s); }
  }
  if (TEST) makeStub(); else makeYT();

  // ---- start on the first gesture ----
  function start() {
    if (R.started) return; R.started = true; R.startT = performance.now();
    if (R.on && R.cur) { if (isBC(R.cur)) showBC(R.cur); else if (R.player && R.ready) { try { R.player.setVolume(0); R.vol = 0; R.player.loadVideoById(vid(R.cur)); } catch (e) {} R.goal = VOL; } }
    // Browsers only let a page start audible media from a gesture: the first tap starts the active player (above) and, in REMIX's two-player mode, rxPreload()
    // below starts the second one (muted load + play) inside the same gesture, so its later unmute + play for the crossfade is allowed
    if (R.list === 'remix' && R.on) { RX.t = 0; rlog({ reason: 'clip', st: R.station, list: 'remix', id: R.cur.id, title: R.cur.title, start: RX.start, peak: REMIX_PEAK[R.cur.id] != null ? 'heatmap' : 'fallback', mode: RX.dual ? 'crossfade' : 'cut', why: 'tune-in' }); rxPreload(); }
    if (R.on) { R.bumpNext = bumperFor(R.station); stationId('tune-in'); } else render();
  }
  const gesture = () => { audioInit(); start(); };
  addEventListener('pointerdown', gesture, { capture: true }); addEventListener('touchstart', gesture, { capture: true, passive: true });
  let rDown = -1, rFrame = 0, rFirst = false; const fr = () => (window.__cel ? __cel.frames : 0);
  addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase(); if (e.repeat) return; rFirst = !R.started; gesture();
    if (k === 'm') toggle(); else if (k === 'n') skip(1); else if (k === 'b') skip(-1); else if (k === 't') cycle(); else if (k === 'escape' && R.credOpen) showCred(false);
    if (k === 'r') { rDown = e.timeStamp; rFrame = fr(); }
  }, { capture: true });
  addEventListener('keyup', (e) => { if (e.key.toLowerCase() === 'r' && rDown >= 0) { const dur = e.timeStamp - rDown, tap = dur < 300 || (dur < 450 && fr() - rFrame <= 2); R.rTap = [Math.round(dur), fr() - rFrame, tap, rFirst]; rDown = -1; /* a tap toggles (a hold keeps turning the camera); the frame count covers slow devices */ if (tap && !rFirst) toggle(); rFirst = false; } });
  const on = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(e); });
  // HUD station button: tap = next station, long-press = off / on
  let lpT = 0, lpFired = false; const stb = $('rst');
  stb.addEventListener('pointerdown', (e) => { lpFired = false; clearTimeout(lpT); stb.classList.add('hold'); lpT = setTimeout(() => { lpFired = true; stb.classList.remove('hold'); toggle(); try { navigator.vibrate && navigator.vibrate(20); } catch (_) {} }, LONG_MS); });
  let lpAt = 0; stb.addEventListener('pointerdown', () => { lpAt = performance.now(); });
  const lpEnd = (e) => { clearTimeout(lpT); stb.classList.remove('hold'); if (e && e.type === 'pointerup' && !lpFired && lpAt && performance.now() - lpAt >= LONG_MS) { lpFired = true; toggle(); } lpAt = 0; }; // a slow main thread can delay the timer: pointerup decides too
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) stb.addEventListener(ev, lpEnd);
  stb.addEventListener('contextmenu', (e) => e.preventDefault());
  on('rst', () => { if (lpFired) { lpFired = false; return; } cycle(); });
  on('rprev', () => skip(-1)); on('rnext', () => skip(1)); on('rcrb', () => showCred(!R.credOpen)); on('rcrx', () => showCred(false));
  for (const n of [bar, bcw, cred]) for (const ev of ['pointerdown', 'touchstart']) n.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); // taps on the radio never drive the camera
  cred.addEventListener('click', (e) => e.stopPropagation());

  // ---- tick: AUTO day/night switch, volume fades, Bandcamp timer, card timer ----
  { const list = listFor(R.station); R.list = list;
    if (list === 'remix') { R.idx.remix = 0; R.cur = TRACKS.remix[0]; rxClip(R.cur); RX.clips = 0; stationId('start'); } // REMIX (default) tunes in on the first clip of its shuffle
    else { R.idx[list] = TRACKS[list].indexOf(TITLE); R.cur = TITLE; if (isBC(TITLE)) showBC(TITLE); stationId('start'); } } // other stations: the title track tunes in first
  let last = performance.now();
  setInterval(() => {
    const now = performance.now(), dt = Math.min(0.5, (now - last) / 1000); last = now;
    rxTick(dt);
    if (R.lend) { if (R.bigT > 0) { R.bigT -= dt; if (R.bigT <= 0) card.classList.remove('on'); } return; } // lent: no AUTO switch, no volume fades, no Bandcamp timer
    if (R.station === 'auto' && R.on && !R.offAir && !R.after && !R.held) { const want = nightNow() ? 'night' : 'day'; if (R.list !== want) swap(() => tune(want, 1, want === 'night' ? 'dusk' : 'dawn')); }
    if (R.bigT > 0) { R.bigT -= dt; if (R.bigT <= 0) card.classList.remove('on'); }
    if (R.bc && R.on && R.started && R.bcLeft > 0 && !R.held) { R.bcLeft -= dt; if (R.bcLeft <= 0) advance('next'); }
    const stp = VOL / (R.fast && R.goal === 0 ? 0.35 : FADE) * dt;
    if (DUCK.k !== 1) for (const P of [RX.A, RX.B, R.player]) dwrap(P);
    if (R.vol !== R.goal && !RX.fade) { R.vol = R.vol < R.goal ? Math.min(R.goal, R.vol + stp) : Math.max(R.goal, R.vol - stp); try { R.player && R.ready && R.player.setVolume(Math.round(R.vol)); } catch (e) {} }
    if (R.after && R.vol <= 0.01) { const f = R.after; R.after = null; f(); }
    if (R.started && R.on && !R.playing) render();
  }, 100);
  render();

  // ---- lend / unlend: a boss fight borrows the YouTube player (Voltage Vic spins radio records). The radio pauses (iOS ignores setVolume,
  // so pausing is the only dependable duck), its player events go to the fight, the dial is locked and the ticker shows the fight's credit.
  // unlend() puts the station back: REMIX tunes the next clip, other stations restart the current track; a radio that was off stays off.
  function lend(o) {
    if (R.lend || !o) return null;
    rxCancel(); R.after = null; R.goal = 0; R.vol = 0;
    try { if (R.player && R.ready) R.player.pauseVideo(); } catch (e) {} try { if (RX.idle && RX.idle !== R.player) { RX.idle.pauseVideo(); RX.idle.mute(); } } catch (e) {}
    if (R.bc) clearBC(); R.playing = false; duck(false); card.classList.remove('on'); R.bigT = 0;
    R.lend = { name: o.name || '', onState: o.onState, onError: o.onError, html: '', plain: '', wasOn: R.on, wasStarted: R.started };
    rlog({ reason: 'lend', to: R.lend.name });
    const ok = !!(R.player && R.ready && !R.noSignal && !TEST);
    return { player: ok ? R.player : null, ytOk: ok, test: TEST, credit: (html, plain) => { if (!R.lend) return; R.lend.html = html; R.lend.plain = plain || ''; lastHtml = ''; render(); } };
  }
  function unlend() {
    if (!R.lend) return; const was = R.lend; R.lend = null; lastHtml = '';
    try { if (R.player && R.ready) { R.player.setPlaybackRate(1); R.player.pauseVideo(); R.player.setVolume(0); } } catch (e) {} R.vol = 0; R.playing = false;
    rlog({ reason: 'unlend', from: was.name });
    if (R.held) render(); else if (R.on && R.started && !R.offAir && R.cur) { if (R.list === 'remix') tune('remix', 1, 'remix'); else play(R.cur, 'back'); } else render();
  }
  window.__radio = { R, T, TRACKS, STATIONS, hold, get held() { return !!R.held; }, toggle, setStation, cycle, skip, start, advance, idText, isBC, get station() { return R.station; }, get text() { return R.tickerText; },
    get card() { return card.classList.contains('on') ? card.textContent : ''; }, get stored() { try { return localStorage.getItem(LS); } catch (e) { return null; } },
    simEnd: () => onState({ data: 0 }), simError: (c = 150) => onError({ data: c }), simBCEnd: () => { if (R.bc) R.bcLeft = 0.01; }, showCred,
    RX, REMIX_PEAK, POOL, CLIP, BUMPS, get vol() { return R.vol; }, duckTo, get duck() { return DUCK.k; }, fightDuck, get fduck() { return DUCK.k; }, lend, unlend, get lent() { return !!R.lend; }, get sfx() { return SFXBUS ? SFXBUS.gain.value : null; } };
  return R;
})();
