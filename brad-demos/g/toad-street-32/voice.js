// Toad Street 32 — HOA Warfare ("Call of Karen") voice pack.
// Zero-change wiring: game.js exposes its internals on window.__cel (see the
// bottom of game.js), so this module polls that state and plays voice lines
// on gameplay events. No edits to game.js needed.
//
// Load AFTER game.js as a module so __cel exists:
//   <script type="module" src="game.js"></script>
//   <script type="module" src="voice.js"></script>
//
// Audio files stream from the hoa-warfare repo via jsDelivr (binaries must
// never go through the GitHub connector — it corrupts them).
// Disable with ?novoice=1

const Q = new URLSearchParams(location.search);
if (Q.has('novoice')) {
  window.ToadVoice = { disabled: true };
} else {

const CDN = 'https://cdn.jsdelivr.net/gh/bparlette/hoa-warfare@main/web/vo/';

// key -> { file, dur (seconds, from the hoa-warfare voice manifest), text }
const LINES = {
  // HAROLD — pickleballRetirees voice (avocado_v2:vdc_22255 @ 0.8 pitch, 1.25 rate):
  // the feisty retiree. Perfect for an elderly toad brawling thugs.
  harold_fightstart: { file: 'pickleballRetirees_roundStart_s_0.ogg', dur: 1.33, text: "Let's finish before dinner." },
  harold_firstblood: { file: 'pickleballRetirees_firstBlood_c_0.ogg', dur: 1.80, text: 'First blood! Before noon!' },
  harold_kill:       { file: 'pickleballRetirees_kill_s_0.ogg',        dur: 2.50, text: "Early-bird special: you're dead." },
  harold_finisher:   { file: 'pickleballRetirees_melee_c_1.ogg',       dur: 1.64, text: 'Backhand of justice!' },
  harold_combo5:     { file: 'pickleballRetirees_double_s_0.ogg',      dur: 1.80, text: 'Double kill. Still got it.' },
  harold_lowhp:      { file: 'pickleballRetirees_lowHealth_s_0.ogg',   dur: 2.01, text: "Bleeding? That's just arthritis." },
  harold_herodown:   { file: 'pickleballRetirees_humiliated_s_0.ogg',  dur: 1.72, text: "Medicare won't cover that burn." },
  harold_victory:    { file: 'pickleballRetirees_victory_c_0.ogg',     dur: 2.83, text: "We won! Early-bird dinner's on me!" },
  harold_defeat:     { file: 'pickleballRetirees_defeat_s_0.ogg',      dur: 2.48, text: 'Lost. My knee knew first.' },
  // MAVIS — karens voice (avocado_v2:Karen @ 1.25 pitch, 1.25 rate):
  // the iconic Karen, handbag in hand. Comedy gold next to Harold.
  mavis_fightstart:  { file: 'karens_roundStart_c_0.ogg',   dur: 1.34, text: "Let's get this sorted!" },
  mavis_kill:        { file: 'karens_kill_c_0.ogg',         dur: 1.88, text: 'I want to speak to your MANAGER!' },
  mavis_down:        { file: 'karens_humiliated_c_0.ogg',  dur: 1.68, text: 'This is UNACCEPTABLE.' },
  mavis_victory:     { file: 'karens_victory_c_0.ogg',      dur: 1.96, text: 'Motion PASSES. I win.' },
  mavis_defeat:      { file: 'karens_defeat_c_0.ogg',       dur: 1.78, text: "I'm filing an APPEAL." },
};

// per-trigger cooldowns (ms) — keeps brawls from turning into chatter
const COOLDOWN = {
  fightstart: 0, firstblood: 0, kill: 8000, finisher: 10000, combo5: 15000,
  lowhp: 25000, herodown: 10000, mavis_down: 10000,
  victory: 45000, defeat: 45000,
};

const cache = new Map();   // key -> HTMLAudioElement (preloaded on first gesture)
let preloaded = false;
let busyUntil = 0;         // performance.now() — one voice at a time, never overlap
const lastFired = {};      // trigger -> performance.now()

function preload() {
  if (preloaded) return; preloaded = true;
  for (const k of Object.keys(LINES)) {
    try {
      const a = new Audio(CDN + LINES[k].file);
      a.preload = 'auto'; a.volume = 0.85; a.load();
      cache.set(k, a);
    } catch (e) { /* audio is optional */ }
  }
}
addEventListener('pointerdown', preload, { capture: true });
addEventListener('keydown', preload, { capture: true });
addEventListener('touchstart', preload, { capture: true });

function say(key) {
  const L = LINES[key]; if (!L) return false;
  const now = performance.now();
  if (now < busyUntil) return false;                    // a line is playing — skip, never overlap
  if (now < (lastFired[key] || 0) + (COOLDOWN[key] || 0)) return false;
  let a = cache.get(key);
  if (!a) { a = new Audio(CDN + L.file); a.volume = 0.85; cache.set(key, a); }
  try { a.currentTime = 0; } catch (e) {}
  const p = a.play();
  if (p && p.catch) p.catch(() => {});
  busyUntil = now + L.dur * 1000 + 150;
  lastFired[key] = now;
  return true;
}
const pick = (...keys) => keys[(Math.random() * keys.length) | 0];

// ---- event detection: poll window.__cel (S, PART, CINE, enemies, hero) ----
const prev = {};
let seenIntro = null;      // null = not yet observed, bool once observed
let startT = 0;
let lowArmed = true;

function poll() {
  const cel = window.__cel;
  if (!cel || !cel.S) return;
  if (!startT) { startT = performance.now(); seenIntro = !!cel.CINE.intro; }
  const { S, PART, CINE, enemies, hero } = cel;
  const st = CINE.stats || {};

  // fight start: intro cinematic ends (or ~1.5s in when ?nointro=1 skips it)
  if (prev.started !== true) {
    if ((seenIntro && !CINE.intro) || (!seenIntro && performance.now() - startT > 1500)) {
      prev.started = true;
      say(pick('harold_fightstart', 'mavis_fightstart'));
    }
  }

  // thug KO'd — attribute via PART.heroKos (Harold) vs PART.kos (Mavis)
  if (prev.kills === undefined) { prev.kills = S.kills; prev.heroKos = PART.heroKos; prev.kos = PART.kos; }
  if (S.kills > prev.kills) {
    if (prev.kills === 0) say('harold_firstblood');
    else if (PART.heroKos > prev.heroKos) say('harold_kill');
    else if (PART.kos > prev.kos) say('mavis_kill');
    else say('harold_kill');
  }
  prev.kills = S.kills; prev.heroKos = PART.heroKos; prev.kos = PART.kos;

  // QTE finisher landed
  if (prev.finishers === undefined) prev.finishers = st.finishers || 0;
  if ((st.finishers || 0) > prev.finishers) say('harold_finisher');
  prev.finishers = st.finishers || 0;

  // combo milestone: S.combo crosses 5 upward
  if (prev.combo === undefined) prev.combo = S.combo;
  if (prev.combo < 5 && S.combo >= 5) say('harold_combo5');
  prev.combo = S.combo;

  // Harold knocked down
  if (prev.downs === undefined) prev.downs = S.playerDowns;
  if (S.playerDowns > prev.downs) say('harold_herodown');
  prev.downs = S.playerDowns;

  // Mavis knocked down
  if (prev.pdowns === undefined) prev.pdowns = PART.downs;
  if (PART.downs > prev.pdowns) say('mavis_down');
  prev.pdowns = PART.downs;

  // Harold low HP (re-arms above 60)
  if (hero && hero.hp !== undefined) {
    if (lowArmed && hero.hp < 30 && hero.hp > 0) { say('harold_lowhp'); lowArmed = false; }
    else if (hero.hp > 60) lowArmed = true;
  }

  // street cleared: all five thugs down at once (they respawn after 14s)
  if (enemies && enemies.length) {
    const cleared = enemies.every((e) => !e.alive);
    if (cleared && !prev.cleared) say(pick('harold_victory', 'mavis_victory'));
    prev.cleared = cleared;
  }

  // game over: both turtles down
  if (prev.over === undefined) prev.over = PART.over;
  if (!prev.over && PART.over) say(pick('harold_defeat', 'mavis_defeat'));
  prev.over = PART.over;
}

// game.js is a module too, so by the time this module runs, __cel exists.
// Poll defensively anyway; 8Hz is plenty for voice triggers.
setInterval(poll, 125);

// debug / manual triggering from the console
window.ToadVoice = { LINES, say, preload, disabled: false };

}
