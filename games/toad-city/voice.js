// Toad City Baltimore — HOA Warfare ("Call of Karen") voice pack.
//
// Hooks the game's own bark system (window.__barks): when a speech bubble
// shows for a thug or boss, the matching HOA voice line plays. Harold/Mavis
// lines fire from __cel game events (same pattern as Toad Street 32).
// Zero game-code changes: poll state, play audio. One voice at a time.
//
// Audio streams from the hoa-warfare repo via jsDelivr (binaries must
// never go through the GitHub connector — it corrupts them).
// Disable with ?novoice=1

const Q = new URLSearchParams(location.search);
if (Q.has('novoice')) {
  window.ToadVoice = { disabled: true };
} else {

const CDN = 'https://cdn.jsdelivr.net/gh/bparlette/hoa-warfare@main/web/vo/';

// ---- casting: gang -> HOA voice, boss id -> HOA voice ----
const GANG_VOICE = {"harbor_rats": "fratHouse", "pier_gulls": "brainRot", "cobble_catfish": "rednecks", "masked_bandits": "furries", "key_hwy_otters": "animeWeebs"};
const BOSS_VOICE = {"bird_brain_bobby": "fratHouse", "raven_king": "gymRats", "dr_shellacious": "animeWeebs", "hon_queen": "karens", "sugar_rush": "valleyGirls", "compression_king": "gymRats", "admiral_redclaw": "hoaDads", "big_jimmy": "gymRats", "voltage_vic": "cloutStreamers", "chef_crabcake": "tradwives", "arabber_al": "rednecks", "pool_shark": "wallstreetBets", "dragon_boat_duchess": "fabulous", "captain_cobblestone": "rednecks", "penthouse_pigeon": "fabulous", "stoop_scrubber": "karens", "mister_formstone": "gymRats"};

// ---- audio pools: "voice:kind" -> [{file}] ----
// Rotation: ONE shared index per pool. Every thug/boss sharing a voice
// cycles through ALL of that voice's sayings together — a character never
// restarts the list from the top.
const POOLS = {
  "animeWeebs:boss_defeat": ["animeWeebs_defeat_c_0.ogg","animeWeebs_defeat_c_1.ogg","animeWeebs_defeat_c_2.ogg","animeWeebs_defeat_s_0.ogg","animeWeebs_defeat_s_1.ogg"],
  "animeWeebs:boss_intro": ["animeWeebs_roundStart_c_1.ogg","animeWeebs_roundStart_c_2.ogg","animeWeebs_roundStart_s_0.ogg","animeWeebs_roundStart_s_1.ogg"],
  "animeWeebs:thug_hit": ["animeWeebs_lowHealth_c_0.ogg","animeWeebs_lowHealth_c_1.ogg","animeWeebs_lowHealth_c_2.ogg","animeWeebs_lowHealth_s_0.ogg","animeWeebs_lowHealth_s_1.ogg"],
  "animeWeebs:thug_ko": ["animeWeebs_defeat_c_0.ogg","animeWeebs_defeat_c_1.ogg","animeWeebs_defeat_c_2.ogg","animeWeebs_defeat_s_0.ogg","animeWeebs_defeat_s_1.ogg"],
  "animeWeebs:thug_taunt": ["animeWeebs_spotted_c_0.ogg","animeWeebs_spotted_c_1.ogg","animeWeebs_spotted_c_2.ogg","animeWeebs_spotted_s_0.ogg","animeWeebs_spotted_s_1.ogg"],
  "brainRot:thug_hit": ["brainRot_lowHealth_c_0.ogg"],
  "brainRot:thug_ko": ["brainRot_defeat_c_0.ogg","brainRot_defeat_c_1.ogg","brainRot_defeat_s_0.ogg","brainRot_defeat_s_1.ogg"],
  "brainRot:thug_taunt": ["brainRot_spotted_c_0.ogg"],
  "cloutStreamers:boss_defeat": ["cloutStreamers_defeat_c_0.ogg","cloutStreamers_defeat_c_1.ogg","cloutStreamers_defeat_s_0.ogg","cloutStreamers_defeat_s_1.ogg"],
  "cloutStreamers:boss_intro": ["cloutStreamers_roundStart_c_0.ogg"],
  "fabulous:boss_defeat": ["fabulous_defeat_c_0.ogg","fabulous_defeat_c_1.ogg","fabulous_defeat_s_0.ogg","fabulous_defeat_s_1.ogg"],
  "fabulous:boss_intro": ["fabulous_roundStart_c_0.ogg"],
  "fratHouse:boss_defeat": ["fratHouse_defeat_c_0.ogg","fratHouse_defeat_c_1.ogg","fratHouse_defeat_s_0.ogg","fratHouse_defeat_s_1.ogg"],
  "fratHouse:boss_intro": ["fratHouse_roundStart_c_0.ogg"],
  "fratHouse:thug_hit": ["fratHouse_lowHealth_c_0.ogg"],
  "fratHouse:thug_ko": ["fratHouse_defeat_c_0.ogg","fratHouse_defeat_c_1.ogg","fratHouse_defeat_s_0.ogg","fratHouse_defeat_s_1.ogg"],
  "fratHouse:thug_taunt": ["fratHouse_spotted_c_0.ogg"],
  "furries:thug_hit": ["furries_lowHealth_c_0.ogg","furries_lowHealth_c_1.ogg","furries_lowHealth_c_2.ogg","furries_lowHealth_s_0.ogg","furries_lowHealth_s_1.ogg"],
  "furries:thug_ko": ["furries_defeat_c_0.ogg","furries_defeat_c_1.ogg","furries_defeat_c_2.ogg","furries_defeat_s_0.ogg","furries_defeat_s_1.ogg"],
  "furries:thug_taunt": ["furries_spotted_c_0.ogg","furries_spotted_c_1.ogg","furries_spotted_c_2.ogg","furries_spotted_s_0.ogg","furries_spotted_s_1.ogg"],
  "gymRats:boss_defeat": ["gymRats_defeat_c_0.ogg","gymRats_defeat_c_1.ogg","gymRats_defeat_s_0.ogg","gymRats_defeat_s_1.ogg"],
  "gymRats:boss_intro": ["gymRats_roundStart_c_0.ogg"],
  "hoaDads:boss_defeat": ["hoaDads_defeat_c_1.ogg","hoaDads_defeat_c_2.ogg","hoaDads_defeat_s_0.ogg","hoaDads_defeat_s_1.ogg"],
  "hoaDads:boss_intro": ["hoaDads_roundStart_c_1.ogg","hoaDads_roundStart_s_0.ogg"],
  "karens:boss_defeat": ["karens_defeat_c_0.ogg","karens_defeat_c_1.ogg","karens_defeat_s_0.ogg","karens_defeat_s_1.ogg"],
  "karens:boss_intro": ["karens_roundStart_c_0.ogg"],
  "karens:hero_defeat": ["karens_defeat_c_0.ogg","karens_defeat_c_1.ogg","karens_defeat_s_0.ogg","karens_defeat_s_1.ogg"],
  "karens:hero_down": ["karens_humiliated_c_0.ogg"],
  "karens:hero_fightstart": ["karens_roundStart_c_0.ogg"],
  "karens:hero_hurt": ["karens_humiliated_c_0.ogg"],
  "karens:hero_kill": ["karens_kill_c_0.ogg","karens_kill_c_1.ogg","karens_kill_c_2.ogg","karens_kill_s_1.ogg","karens_kill_s_2.ogg"],
  "karens:hero_victory": ["karens_victory_c_0.ogg","karens_victory_c_1.ogg"],
  "pickleballRetirees:hero_combo": ["pickleballRetirees_double_c_0.ogg","pickleballRetirees_double_c_1.ogg","pickleballRetirees_double_s_0.ogg"],
  "pickleballRetirees:hero_defeat": ["pickleballRetirees_defeat_c_0.ogg","pickleballRetirees_defeat_s_0.ogg"],
  "pickleballRetirees:hero_down": ["pickleballRetirees_humiliated_c_0.ogg","pickleballRetirees_humiliated_c_1.ogg","pickleballRetirees_humiliated_s_0.ogg"],
  "pickleballRetirees:hero_fightstart": ["pickleballRetirees_roundStart_c_1.ogg","pickleballRetirees_roundStart_s_0.ogg"],
  "pickleballRetirees:hero_finisher": ["pickleballRetirees_melee_c_1.ogg","pickleballRetirees_melee_s_0.ogg"],
  "pickleballRetirees:hero_firstblood": ["pickleballRetirees_firstBlood_c_0.ogg","pickleballRetirees_firstBlood_c_1.ogg","pickleballRetirees_firstBlood_s_0.ogg"],
  "pickleballRetirees:hero_hurt": ["pickleballRetirees_lowHealth_c_0.ogg","pickleballRetirees_lowHealth_c_1.ogg","pickleballRetirees_lowHealth_s_0.ogg"],
  "pickleballRetirees:hero_kill": ["pickleballRetirees_kill_c_3.ogg","pickleballRetirees_kill_s_0.ogg"],
  "pickleballRetirees:hero_victory": ["pickleballRetirees_victory_c_0.ogg","pickleballRetirees_victory_s_0.ogg"],
  "rednecks:boss_defeat": ["rednecks_defeat_c_0.ogg","rednecks_defeat_c_2.ogg","rednecks_defeat_s_0.ogg","rednecks_defeat_s_1.ogg","rednecks_defeat_s_2.ogg"],
  "rednecks:boss_intro": ["rednecks_roundStart_c_0.ogg","rednecks_roundStart_c_1.ogg","rednecks_roundStart_s_0.ogg"],
  "rednecks:thug_hit": ["rednecks_lowHealth_c_0.ogg","rednecks_lowHealth_c_1.ogg","rednecks_lowHealth_s_0.ogg"],
  "rednecks:thug_ko": ["rednecks_defeat_c_0.ogg","rednecks_defeat_c_2.ogg","rednecks_defeat_s_0.ogg","rednecks_defeat_s_1.ogg","rednecks_defeat_s_2.ogg"],
  "rednecks:thug_taunt": ["rednecks_spotted_c_0.ogg","rednecks_spotted_c_1.ogg","rednecks_spotted_s_0.ogg"],
  "tradwives:boss_defeat": ["tradwives_defeat_c_0.ogg","tradwives_defeat_c_1.ogg","tradwives_defeat_c_2.ogg","tradwives_defeat_s_0.ogg","tradwives_defeat_s_1.ogg"],
  "tradwives:boss_intro": ["tradwives_roundStart_c_0.ogg","tradwives_roundStart_c_1.ogg","tradwives_roundStart_c_2.ogg","tradwives_roundStart_s_0.ogg","tradwives_roundStart_s_1.ogg"],
  "valleyGirls:boss_defeat": ["valleyGirls_defeat_c_0.ogg","valleyGirls_defeat_c_1.ogg","valleyGirls_defeat_s_0.ogg","valleyGirls_defeat_s_1.ogg"],
  "valleyGirls:boss_intro": ["valleyGirls_roundStart_c_0.ogg"],
  "wallstreetBets:boss_defeat": ["wallstreetBets_defeat_c_0.ogg","wallstreetBets_defeat_c_1.ogg","wallstreetBets_defeat_s_0.ogg","wallstreetBets_defeat_s_1.ogg"],
  "wallstreetBets:boss_intro": ["wallstreetBets_roundStart_c_0.ogg"],
};

// boss intro vs defeat, matched by the bubble's text (from the game's GR1 data)
const BOSS_INTRO_TEXT = {
  "admiral_redclaw": new Set(["Fire the rockets! For the crown!","1812 called. I'm still mad about it.","This fort will fall, little toad!"]),
  "arabber_al": new Set(["Get outta my lane, toad!","Fresh produce, fast horse, no brakes!","Yo! Arabber coming through!"]),
  "big_jimmy": new Set(["Welcome to my tank, shrimp.","Big Jimmy don't do steamed, hon.","Claws out, toad. Down in the deep."]),
  "bird_brain_bobby": new Set(["Batter up, Harold! Heads up too!","Welcome to my hallway. It's a long way to first.","Nobody hits my heater, old timer!"]),
  "captain_cobblestone": new Set(["Yarr! This ship be haunted, toad!","My lantern lights the way to your doom!","Ghosts don't feel canes, matey!"]),
  "chef_crabcake": new Set(["Order up! One toad, well done!","Taste my seasoning! In your eyes!","Two mallets, one Harold. Let's cook!"]),
  "compression_king": new Set(["Feel the squeeze, old man!","No logo, no mercy!","My gear is tight. My grip is tighter."]),
  "dr_shellacious": new Set(["Welcome to my lab! The screen is HUGE!","My experiments need a test toad!","Goggles down! Science is about to hurt!"]),
  "dragon_boat_duchess": new Set(["Kneel before the Duchess of the harbor!","My paddle-sceptre says you're done!","Row, row, row your toad... under!"]),
  "hon_queen": new Set(["Hey hon! Come up the hill, hon!","This beehive's got a sting, sweetie.","Hairspray! Extra hold! Down you go!"]),
  "mister_formstone": new Set(["Welcome to my city, Harold.","Nothing cracks Formstone, old toad.","Every block in B-more answers to me."]),
  "penthouse_pigeon": new Set(["Welcome to the top, peasant toad.","Drink? No? Then fight.","Up here, I rule the skyline."]),
  "pool_shark": new Set(["Wanna play? Winner takes the cabana.","Rack 'em up, grandpa!","Eight ball, side pocket: you."]),
  "raven_king": new Set(["Nevermore will you cross my field!","Hut! Hut! Hike up those pants, toad!","Shoulder pads on. Mercy off."]),
  "stoop_scrubber": new Set(["Get off my clean steps, hon!","These marble steps shine. You won't!","Suds up! Slip and slide, toad!"]),
  "sugar_rush": new Set(["I'm sweet, but I hit like a truck!","Glitter and grit, toad! Taste it!","Neon on, sugar high, you're done!"]),
  "voltage_vic": new Set(["Drop the beat! Drop the toad!","Charm City club, high voltage!","Hands up! Gonna shock 'em all!"]),
};

const COOLDOWN = { thug_taunt: 7000, thug_hit: 5000, thug_ko: 4500, boss_intro: 0, boss_defeat: 0, hero_fightstart: 0, hero_firstblood: 0, hero_kill: 8000, hero_finisher: 10000, hero_combo: 15000, hero_hurt: 20000, hero_down: 10000, hero_victory: 30000, hero_defeat: 45000 };

const cache = new Map();   // file -> HTMLAudioElement
const durCache = new Map();// file -> seconds (from loadedmetadata)
const IDX = {};            // poolKey -> shared rotation index
let busyUntil = 0;
const lastFired = {};      // poolKey -> performance.now()

function hashStart(key, n) { let h = 7; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % n; }

function nextIn(poolKey) {
  const pool = POOLS[poolKey];
  if (!pool || !pool.length) return null;
  if (IDX[poolKey] === undefined) IDX[poolKey] = hashStart(poolKey, pool.length);
  else IDX[poolKey] = (IDX[poolKey] + 1) % pool.length;
  return pool[IDX[poolKey]];
}

function sayPool(poolKey) {
  const file = nextIn(poolKey);
  if (!file) return false;
  const now = performance.now();
  if (now < busyUntil) return false;
  const kind = poolKey.split(':')[1];
  if (now < (lastFired[poolKey] || 0) + (COOLDOWN[kind] || 4000)) return false;
  let a = cache.get(file);
  if (!a) {
    a = new Audio(CDN + file); a.volume = 0.85; a.preload = 'auto';
    a.addEventListener('loadedmetadata', () => { if (a.duration && isFinite(a.duration)) durCache.set(file, a.duration); }, { once: true });
    cache.set(file, a);
  }
  try { a.currentTime = 0; } catch (e) {}
  const p = a.play(); if (p && p.catch) p.catch(() => {});
  busyUntil = now + (durCache.get(file) || 2.2) * 1000 + 200;
  lastFired[poolKey] = now;
  return true;
}

const pickHero = (kind) => (Math.random() < 0.5 ? 'pickleballRetirees' : 'karens') + ':hero_' + kind;

function onBark(cur) {
  const kind = cur.kind, who = cur.who;
  if (kind === 'taunt' || kind === 'hit' || kind === 'ko') {
    const gang = (who && who.gang) || 'harbor_rats';
    const voice = GANG_VOICE[gang] || 'fratHouse';
    sayPool(voice + ':thug_' + kind);
  } else if (kind === 'boss') {
    const bossId = String(who);
    const voice = BOSS_VOICE[bossId];
    if (!voice) return;
    const isIntro = BOSS_INTRO_TEXT[bossId] && BOSS_INTRO_TEXT[bossId].has(cur.text);
    sayPool(voice + ':boss_' + (isIntro ? 'intro' : 'defeat'));
    if (!isIntro) setTimeout(() => sayPool(pickHero('victory')), 2000);
  }
  // idle barks stay text-only — keeps the soundscape from getting chaotic
}

const prev = {};
let startT = 0, seenIntro = null, lowArmed = true, plowArmed = true;

function poll() {
  const cel = window.__cel, BARK = window.__barks;
  if (!cel || !cel.S || !BARK || !BARK.B) return;
  const S = cel.S, PART = cel.PART || {}, hero = cel.hero, partner = cel.partner;
  const B = BARK.B;
  if (!startT) { startT = performance.now(); seenIntro = !!(cel.CINE && cel.CINE.intro); }
  // game start: intro ends (or ~2s in)
  if (!prev.started) {
    const done = (seenIntro && cel.CINE && !cel.CINE.intro) || (!seenIntro && performance.now() - startT > 2000);
    if (done) { prev.started = true; sayPool(pickHero('fightstart')); }
  }
  // speech bubbles
  if (prev.shown === undefined) prev.shown = B.shown || 0;
  if ((B.shown || 0) > prev.shown && B.cur) onBark(B.cur);
  prev.shown = B.shown || 0;
  // hero KOs a thug — credit Harold vs Mavis like Toad Street 32
  if (prev.kills === undefined) { prev.kills = S.kills || 0; prev.heroKos = PART.heroKos || 0; prev.kos = PART.kos || 0; }
  if ((S.kills || 0) > prev.kills) {
    if (prev.kills === 0) sayPool('pickleballRetirees:hero_firstblood');
    else if ((PART.heroKos || 0) > prev.heroKos) sayPool('pickleballRetirees:hero_kill');
    else if ((PART.kos || 0) > prev.kos) sayPool('karens:hero_kill');
    else sayPool('pickleballRetirees:hero_kill');
  }
  prev.kills = S.kills || 0; prev.heroKos = PART.heroKos || 0; prev.kos = PART.kos || 0;
  // finishers + combo milestones
  const st = (cel.CINE && cel.CINE.stats) || {};
  if (prev.finishers === undefined) prev.finishers = st.finishers || 0;
  if ((st.finishers || 0) > prev.finishers) sayPool('pickleballRetirees:hero_finisher');
  prev.finishers = st.finishers || 0;
  if (prev.combo === undefined) prev.combo = S.combo || 0;
  if (prev.combo < 5 && (S.combo || 0) >= 5) sayPool('pickleballRetirees:hero_combo');
  prev.combo = S.combo || 0;
  // hero / partner hurt (re-arm above 60%)
  if (hero && hero.maxHp) {
    const pct = hero.hp / hero.maxHp;
    if (lowArmed && pct < 0.3 && hero.hp > 0) { sayPool('pickleballRetirees:hero_hurt'); lowArmed = false; }
    else if (pct > 0.6) lowArmed = true;
  }
  if (partner && partner.maxHp) {
    const pct = partner.hp / partner.maxHp;
    if (plowArmed && pct < 0.3 && partner.hp > 0) { sayPool('karens:hero_hurt'); plowArmed = false; }
    else if (pct > 0.6) plowArmed = true;
  }
  // hero / partner down
  if (prev.downs === undefined) prev.downs = S.playerDowns || 0;
  if ((S.playerDowns || 0) > prev.downs) sayPool('pickleballRetirees:hero_down');
  prev.downs = S.playerDowns || 0;
  if (prev.pdowns === undefined) prev.pdowns = PART.downs || 0;
  if ((PART.downs || 0) > prev.pdowns) sayPool('karens:hero_down');
  prev.pdowns = PART.downs || 0;
  // game over
  if (prev.over === undefined) prev.over = !!PART.over;
  if (!prev.over && PART.over) sayPool(pickHero('defeat'));
  prev.over = !!PART.over;
}

setInterval(poll, 125);

// debug / manual triggering from the console
window.ToadVoice = { POOLS, GANG_VOICE, BOSS_VOICE, sayPool, disabled: false };

}