// voice.js — TASK 8: VOICE WIRING. Plays the recorded lines in assets/audio/voice/ at their
// triggers. Two sets live in that folder: wave 1 (50 lines, ids cop01..rad05, MANIFEST.md) and
// wave 2 (71 VOX_* hooks, files named by the hook in lowercase, WAVE2-MANIFEST.md).
//
// Where the triggers come from:
//  - jobs.js / events.js already fire sim.ev('vox_*') for every job + city-event hook, and
//    destruct.js / siege.js fire the destruction + siege ones (added with this task). main.js
//    routes every 'vox_*' event (and 'jobstart') into play().
//  - The wave-1 situational barks (cop / dispatch / ped / hero / radio) have no single code
//    moment, so update() — called from main.js every frame — watches the sim and fires them.
//
// Playback rules (the spec is silent on overlap; this is the chosen policy):
//  - ONE line at a time. 'urgent' hooks (SWAT, siege, dispatch, the fed, spikes) cut the
//    current line. 'normal' hooks queue one deep. 'ambient' lines (the update() rotation)
//    only play into silence and are dropped if anything is playing or queued.
//  - A hook lists its candidate files in order of preference, wave 2 first, wave 1 as the
//    alternate take; when several exist, play() rotates between the ones that exist.
//  - A hook whose file is not in the repo yet is a SILENT no-op: existence is probed once per
//    file (HEAD, cached; missing files are re-probed about once a minute), so when the rest
//    of wave 2 lands tonight the hooks light up with no code change.
//  - iOS: lines are plain <audio> elements (Safari gets the .m4a mirrors, everything else
//    .ogg); unlock() is called on the first gesture alongside the synth engine, and the
//    media session is set to playback so the silent switch doesn't mute the game.

const U = 'urgent', N = 'normal', A = 'ambient';

// event name -> { f: [file ids], p: priority, cd: per-hook cooldown seconds }
export const HOOKS = {
  // ---- jobs (wave 2 hooks pre-wired in jobs.js; jobstart is routed by main.js) ----
  vox_job_taxi_start:    { f: ['job_taxi_start'], p: N, cd: 6 },
  vox_job_tow_start:     { f: ['job_tow_start'], p: N, cd: 6 },
  vox_job_bus_start:     { f: ['job_bus_start'], p: N, cd: 6 },
  vox_taxi_vip:          { f: ['job_taxi_pickup_vip'], p: N, cd: 6 },
  vox_taxi_chill:        { f: ['job_taxi_pickup_chill', 'tax05'], p: N, cd: 6 },
  vox_taxi_mood:         { f: ['job_taxi_mood_low'], p: N, cd: 20 },
  vox_taxi_fed:          { f: ['job_taxi_fed_reveal', 'tax04', 'tax03'], p: U, cd: 20 },
  vox_taxi_drop:         { f: ['job_taxi_drop_clean', 'tax02', 'tax06'], p: N, cd: 6 },
  vox_tow_hooked:        { f: ['job_tow_hooked'], p: N, cd: 8 },
  vox_tow_hit:           { f: ['job_tow_weapon_hit'], p: N, cd: 10 },
  vox_tow_sling:         { f: ['job_tow_slingshot'], p: N, cd: 10 },
  vox_tow_snap:          { f: ['job_tow_snap'], p: N, cd: 10 },
  vox_tow_done:          { f: ['job_tow_delivered', 'tow02', 'tow03'], p: N, cd: 6 },
  vox_tow_cop:           { f: ['tow01'], p: N, cd: 15 },
  vox_dsp_towcop:        { f: ['dsp02'], p: N, cd: 15 },
  vox_bus_board:         { f: ['job_bus_board'], p: N, cd: 4 },
  vox_bus_skip:          { f: ['job_bus_skip_warn', 'bus02'], p: N, cd: 8 },
  vox_bus_finish:        { f: ['job_bus_finish', 'bus01'], p: N, cd: 8 },
  vox_getaway_alarm:     { f: ['job_getaway_alarm', 'get01'], p: U, cd: 10 },
  vox_getaway_tire:      { f: ['job_getaway_tire_blown', 'get02'], p: U, cd: 15 },
  vox_getaway_decoy:     { f: ['job_getaway_decoy'], p: N, cd: 8 },
  vox_getaway_bail:      { f: ['job_getaway_tandem_bail'], p: N, cd: 10 },
  vox_getaway_clear:     { f: ['job_getaway_clear', 'get04'], p: N, cd: 10 },
  // ---- city events (pre-wired in events.js) ----
  vox_evt_wreck_start:   { f: ['evt_wreck_start', 'wrk01'], p: N, cd: 8 },
  vox_evt_wreck_domino:  { f: ['evt_wreck_domino', 'wrk02'], p: N, cd: 10 },
  vox_evt_wreck_chain_5x:{ f: ['evt_wreck_chain_5x'], p: N, cd: 15 },
  vox_evt_wreck_10s:     { f: ['evt_wreck_10s'], p: N, cd: 30 },
  vox_evt_wreck_gold:    { f: ['evt_wreck_gold'], p: N, cd: 15 },
  vox_evt_wreck_busted:  { f: ['evt_wreck_busted'], p: U, cd: 15 },
  vox_evt_valet_start:   { f: ['evt_valet_start'], p: N, cd: 8 },
  vox_evt_valet_mint:    { f: ['evt_valet_mint'], p: N, cd: 8 },
  vox_evt_valet_drift:   { f: ['evt_valet_drift'], p: N, cd: 8 },
  vox_evt_valet_jturn:   { f: ['evt_valet_jturn', 'val01'], p: N, cd: 8 },
  vox_evt_valet_scrape:  { f: ['evt_valet_scrape'], p: N, cd: 8 },
  vox_evt_valet_complete:{ f: ['evt_valet_complete'], p: N, cd: 8 },
  vox_evt_openroad_cheer:{ f: ['ped01', 'ped02', 'ped04', 'ped05'], p: A, cd: 5 },
  // ---- destruction + palms (call sites added in destruct.js / events.js with this task) ----
  vox_dest_car_smash:    { f: ['dest_car_smash'], p: N, cd: 10 },
  vox_dest_car_smoke:    { f: ['dest_car_smoke'], p: N, cd: 18 },
  vox_dest_hydrant:      { f: ['dest_hydrant_geyser'], p: N, cd: 12 },
  vox_dest_bench:        { f: ['dest_bench_split'], p: N, cd: 12 },
  vox_dest_tower:        { f: ['dest_tower_drop'], p: N, cd: 12 },
  vox_dest_fence:        { f: ['dest_fence_breach'], p: N, cd: 12 },
  vox_palm_dry:          { f: ['palm_snap_dry'], p: N, cd: 10 },
  vox_palm_near:         { f: ['palm_snap_near'], p: N, cd: 10 },
  vox_palm_car:          { f: ['palm_snap_car'], p: N, cd: 10 },
  vox_palm_multi:        { f: ['palm_snap_multi'], p: N, cd: 20 },
  vox_palm_tourist:      { f: ['palm_snap_tourist'], p: N, cd: 12 },
  // ---- motel siege (call sites added in siege.js with this task) ----
  vox_siege_start:       { f: ['siege_start', 'dsp03', 'sig01'], p: N, cd: 20 },
  vox_swat_arrive:       { f: ['swat_arrive'], p: N, cd: 20 },
  vox_swat_breach:       { f: ['swat_door_breach', 'sig01'], p: N, cd: 15 },
  vox_swat_ladder:       { f: ['swat_ladder_up'], p: N, cd: 15 },
  vox_swat_sniper:       { f: ['swat_sniper_ping'], p: N, cd: 15 },
  vox_swat_shield:       { f: ['swat_shield_adv'], p: N, cd: 15 },
  vox_swat_flank:        { f: ['swat_flank_stairs'], p: N, cd: 15 },
  vox_swat_stunned:      { f: ['swat_stunned'], p: N, cd: 10 },
  vox_swat_retreat:      { f: ['swat_retreat'], p: N, cd: 15 },
  vox_siege_vend:        { f: ['siege_trap_vend'], p: N, cd: 10 },
  vox_siege_tv:          { f: ['siege_trap_tv'], p: N, cd: 10 },
  vox_siege_cart:        { f: ['siege_trap_cart'], p: N, cd: 10 },
  vox_siege_ac:          { f: ['siege_trap_ac'], p: N, cd: 10 },
  vox_siege_fuse:        { f: ['siege_trap_fuse', 'sig02'], p: N, cd: 10 },
  vox_siege_barricade:   { f: ['siege_barricade', 'sig03'], p: N, cd: 8 },
  vox_siege_floor:       { f: ['siege_floor_clear'], p: N, cd: 15 },
  vox_siege_roof:        { f: ['siege_roof_escape'], p: N, cd: 15 },
  vox_sig_roof:          { f: ['sig05'], p: N, cd: 20 },
  vox_sig_ram:           { f: ['sig04'], p: N, cd: 15 },
  vox_sig_sign:          { f: ['sig06'], p: N, cd: 15 },
};

// Hooks whose triggers do not exist in the game yet (destruction phase 2 — task 10 — and the
// finest palm bystander beats). They are in the table so the moment a call site exists, and
// the file exists, they play; nothing fires them today. Files: dest_stall_crush exists;
// the rest land with tonight's wave-2 files.
export const DORMANT = {
  vox_dest_glass_shop:   { f: ['dest_glass_shop'], p: N, cd: 12 },
  vox_dest_awning:       { f: ['dest_awning_tear'], p: N, cd: 12 },
  vox_dest_neon:         { f: ['dest_neon_fall'], p: N, cd: 12 },
  vox_dest_stall:        { f: ['dest_stall_crush'], p: N, cd: 12 },
  vox_palm_jogger:       { f: ['palm_snap_jogger'], p: N, cd: 12 },
  vox_palm_shade:        { f: ['palm_snap_shade'], p: N, cd: 12 },
  vox_palm_civic:        { f: ['palm_snap_civic'], p: N, cd: 20 },
  vox_swat_flashbang:    { f: ['swat_flashbang'], p: N, cd: 15 },
  vox_heli_steal:        { f: ['heli_steal'], p: N, cd: 15 },
  vox_heli_down:         { f: ['heli_down'], p: U, cd: 20 },
};
Object.assign(HOOKS, DORMANT);

const COPS = ['cop01', 'cop02', 'cop03', 'cop04', 'cop05', 'cop06'];
const PEDS = ['ped01', 'ped02', 'ped04', 'ped05'];
const RADIO = ['rad02', 'rad03', 'rad04', 'rad05'];

export class Voice {
  constructor(base = '../palm-city/assets/audio/voice/') {
    this.base = base;
    this.ext = '.ogg';
    try {
      const probe = document.createElement('audio');
      if (!probe.canPlayType || !probe.canPlayType('audio/ogg; codecs="vorbis"')) this.ext = '.m4a';
    } catch (_) { /* non-browser: playback never happens */ }
    this.known = new Map();          // file id -> true (exists) | false (404) | 'pending'
    this.cur = null;                 // { id, pri, el } now playing
    this.queue = [];                 // at most one waiting line
    this.cdUntil = new Map();        // hook/id -> sim-time cooldown expiry
    this.rot = new Map();            // hook -> rotation index over existing files
    this.log = [];                   // { n, name, id, act } — the proof trail (window.__vox)
    this.seq = 0;
    this.lastPlayT = -9;
    this.unlocked = false;
    this.reprobeT = 0;
    // ambient-director state
    this.prevStars = 0; this.prevBusted = false; this.hadChopper = false; this.prevMode = 'foot'; this.prevCarDmg = 0;
    this.copT = 6, this.radioT = 30, this.dspT = 25, this.pedT = 0, this.heroT = 50;
    this.boardDsp = false; this.duskSaid = false; this.pedCd = new Map();
    this.taxiFastT = 0; this.busDmg = 0; this.getDmgSaid = false;
  }

  note(name, id, act) {
    this.log.push({ n: this.seq++, name, id, act });
    if (this.log.length > 300) this.log.shift();
    try { console.log('[vox]', act, name, id || ''); } catch (_) {}
  }

  // ---- file existence: probed once, cached; a missing file is a silent no-op ----
  probe(id) {
    if (this.known.has(id)) return;
    this.known.set(id, 'pending');
    const done = (ok) => { this.known.set(id, ok); };
    try {
      fetch(this.base + id + this.ext, { method: 'HEAD' })
        .then((r) => done(r.ok))
        .catch(() => done(false));
    } catch (_) { done(false); }
  }
  probeAll() {
    const ids = new Set();
    for (const h of Object.values(HOOKS)) for (const id of h.f) ids.add(id);
    for (const id of [...COPS, ...PEDS, ...RADIO, 'dsp01', 'dsp04', 'dsp05', 'dsp06', 'her01', 'her02', 'her03', 'tax01', 'bus01', 'bus03', 'get03']) ids.add(id);
    for (const id of ids) this.probe(id);
  }
  exists(id) { return this.known.get(id) === true; }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) {}
    try { const el = new Audio(); el.src = this.base + 'her03' + this.ext; el.volume = 0; el.play().then(() => el.pause()).catch(() => {}); } catch (_) {}
    this.probeAll();
  }

  // ---- playback core ----
  start(id, pri, name) {
    let el;
    try { el = new Audio(this.base + id + this.ext); } catch (_) { return false; }
    el.volume = 1;
    this.cur = { id, pri, el };
    el.onended = () => { if (this.cur && this.cur.el === el) { this.cur = null; this.pump(); } };
    el.onerror = () => { this.known.set(id, false); if (this.cur && this.cur.el === el) { this.cur = null; this.pump(); } };
    const pr = el.play();
    if (pr && pr.catch) pr.catch(() => { /* autoplay policy etc.: stay silent */ });
    this.lastPlayT = this.nowT || 0;
    this.note(name, id, 'play');
    return true;
  }
  stop() {
    if (!this.cur) return;
    try { this.cur.el.pause(); } catch (_) {}
    this.cur = null;
  }
  pump() {
    if (this.cur || !this.queue.length) return;
    const q = this.queue.shift();
    this.start(q.id, q.pri, q.name);
  }
  offer(name, id, pri) {
    if (!this.cur) return this.start(id, pri, name);
    if (pri === U && this.cur.pri !== U) { this.stop(); this.note(name, id, 'interrupt'); return this.start(id, pri, name); }
    if (pri === A) { this.note(name, id, 'drop-busy'); return false; }
    if (this.queue.length) { this.note(name, id, 'drop-queue-full'); return false; }
    this.queue.push({ name, id, pri });
    this.note(name, id, 'queue');
    return true;
  }

  // play an event hook: rotate among the candidate files that exist
  play(name, tNow) {
    this.nowT = tNow !== undefined ? tNow : this.nowT;
    const h = HOOKS[name];
    if (!h) { this.note(name, null, 'unknown-hook'); return false; }
    const t = this.nowT || 0;
    if (t < (this.cdUntil.get(name) || 0)) { this.note(name, null, 'drop-cd'); return false; }
    const avail = h.f.filter((id) => this.exists(id));
    if (!avail.length) {
      for (const id of h.f) if (!this.known.has(id)) this.probe(id);
      this.note(name, h.f[0], 'missing');
      return false;
    }
    const i = (this.rot.get(name) || 0) % avail.length;
    this.rot.set(name, i + 1);
    const id = avail[i];
    const ok = this.offer(name, id, h.p);
    if (ok) this.cdUntil.set(name, t + h.cd);
    return ok;
  }

  // play one specific file id (the ambient director's contextual picks)
  line(id, pri = A, cd = 8, tNow) {
    const t = tNow !== undefined ? tNow : (this.nowT || 0);
    if (t < (this.cdUntil.get(id) || 0)) return false;
    if (!this.exists(id)) { this.probe(id); this.note(id, id, 'missing'); return false; }
    const ok = this.offer(id, id, pri);
    if (ok) this.cdUntil.set(id, t + cd);
    return ok;
  }

  // ---- ambient director: wave-1 situational barks, watched off the sim every frame ----
  update(sim, dt, tod) {
    this.nowT = sim.time;
    if (!this.unlocked) return;
    // tonight's files can land mid-session: re-probe the missing ones about once a minute
    this.reprobeT -= dt;
    if (this.reprobeT <= 0) { this.reprobeT = 60; for (const [id, v] of this.known) if (v === false) this.known.delete(id), this.probe(id); }

    const P = sim.player, f = sim.focus();
    const inSiege = !!sim.siege;

    // DISPATCH stories (radio voice, normal priority — they should be heard whole)
    if (sim.chopper && !this.hadChopper) this.line('dsp04', N, 30);
    this.hadChopper = !!sim.chopper;
    if (this.prevStars >= 3 && sim.stars < this.prevStars && !inSiege) this.line('dsp05', N, 25);
    if (P.mode === 'board' && sim.stars >= 3 && !this.boardDsp) { if (this.line('dsp01', N, 30)) this.boardDsp = true; }
    if (sim.stars === 0 || P.mode !== 'board') this.boardDsp = false;
    // WORLD MIX (owner, Nov 16): the normal world gets the voices too, not just jobs and events.
    // The heat rising is a world beat: a cop answers at once instead of the world staying quiet
    // until 2 stars, and a bust — the biggest beat in free roam — is no longer voiceless.
    if (sim.stars > this.prevStars && !inSiege) this.copT = 0;
    this.prevStars = sim.stars;
    if (sim.busted && !this.prevBusted && !inSiege) this.line(COPS[(Math.random() * COPS.length) | 0], N, 20);
    this.prevBusted = !!sim.busted;
    this.dspT -= dt;
    if (this.dspT <= 0) { this.dspT = 30 + Math.random() * 20; if (sim.stars >= 4 && !sim.job && !inSiege) this.line('dsp06', A, 45); }

    if (inSiege || sim.busted) return;

    // COP pursuit barks (from 1 star — a 1-star chase is still a chase, and it used to be silent)
    this.copT -= dt;
    if (this.copT <= 0) {
      this.copT = 8 + Math.random() * 7;
      if (sim.stars >= 1) {
        const near = sim.cars.some((c) => c.driver === 'police' && Math.hypot(c.x - f.x, c.y - f.y) < 520);
        if (near) {
          let id;
          if (P.mode === 'car' && sim.W.surfaceAt(f.x, f.y) === 'sand') id = 'cop02';        // "He's driving on the beach!"
          else if (sim.chopper && sim.chopper.lock) id = 'cop05';                            // the spotlight line
          else id = COPS[(Math.random() * COPS.length) | 0];
          this.line(id, A, 9);
        }
      }
    }

    // PED near-miss reactions (city speeds count too — 110 was highway-only, the world felt mute)
    this.pedT -= dt;
    if (this.pedT <= 0 && P.mode === 'car' && Math.abs(P.car.v) > 80) {
      for (const p of sim.peds) {
        if (p.hidden || p.mode === 'down' || p === P.ped) continue;
        if (Math.hypot(p.x - P.car.x, p.y - P.car.y) > 36) continue;
        if (sim.time < (this.pedCd.get(p) || 0)) continue;
        this.pedCd.set(p, sim.time + 20);
        this.pedT = 5;
        const towingCop = sim.job && sim.job.kind === 'tow' && sim.job.target && sim.job.target.kind === 'police';
        this.line(towingCop ? 'ped03' : PEDS[(Math.random() * PEDS.length) | 0], A, 6);
        break;
      }
    }

    // HERO barks: the jack, the big shunt, the quiet moment
    if (this.prevMode === 'foot' && P.mode === 'car' && P.car && !P.car.job && !P.car.wreck && Math.random() < 0.5) this.line('her01', A, 12);
    this.prevMode = P.mode;
    const dmg = P.mode === 'car' && P.car ? P.car.dmg : 0;
    if (dmg - this.prevCarDmg >= 0.22) this.line('her02', A, 10);
    this.prevCarDmg = dmg;
    this.heroT -= dt;
    if (this.heroT <= 0) { this.heroT = 60 + Math.random() * 40; if (P.mode === 'foot' && sim.stars === 0) this.line('her03', A, 60); }

    // job-flavour wave-1 lines the wave-2 hooks don't cover
    const j = sim.job;
    if (j && P.mode === 'car') {
      if (j.kind === 'taxi' && j.phase === 'drop' && j.fare) {
        if (j.fare.type === 'speed' && Math.abs(P.car.v) > 230) { this.taxiFastT += dt; if (this.taxiFastT > 1.5) { if (this.line('tax01', A, 20)) this.taxiFastT = -20; } }
        else this.taxiFastT = 0;
      }
      if (j.kind === 'bus' && dmg - this.busDmg >= 0.15) this.line(Math.random() < 0.5 ? 'bus01' : 'bus03', A, 14);
      if (j.kind === 'getaway' && j.phase === 'run' && dmg >= 0.6 && !this.getDmgSaid) { if (this.line('get03', A, 20)) this.getDmgSaid = true; }
      if (j.kind !== 'getaway') this.getDmgSaid = false;
    }
    this.busDmg = dmg;

    // PALM CITY FM: dusk ident once, then a slow rotation in free roam
    if (tod !== undefined && tod >= 0.55 && !this.duskSaid) { if (this.line('rad01', A, 120)) this.duskSaid = true; }
    if (tod !== undefined && tod < 0.3) this.duskSaid = false;
    this.radioT -= dt;
    if (this.radioT <= 0) {
      this.radioT = 35 + Math.random() * 25;
      if (!sim.job && !sim.event && sim.stars <= 1) this.line(RADIO[(Math.random() * RADIO.length) | 0], A, 30);
    }
  }
}
