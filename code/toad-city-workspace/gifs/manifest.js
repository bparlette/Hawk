// Gallery manifest: every GIF = ordered segments. capture.js renders frames, make.sh encodes.
// Segment keys: id, label (burned-in), labelOpt {pos,sub,color,size}, q (query string), pre (JS after boot, clock already manual),
// warm (seconds of sim-only fast-forward), after (JS after warm), tick (JS run before every captured frame; window.__capU = 0..1, __capI = frame idx),
// dur (seconds captured), hideUI (hide the game HUD), check (JS whose result is logged), recapture (merge names after which to redo).
// radio=0: no radio bar / station-ID card over the action (the card dropped over the top third of most clips).
// Only the radio feature and Voltage Vic (whose battle borrows the radio player) keep the stubbed radio (radiotest=1).
const BASE = '?nointro=1&radio=0';
const RBASE = '?nointro=1&radiotest=1';

// ---------- landmarks: aerial "drone" cuts. [id, real name, look x,y,z, radius, height, start angle] ----------
// look targets match LANDMARKS (dumped from the build) / game-landmarks T/lm/shots.js
const LM = [
  ['harborplace', 'HARBORPLACE', -52, 5, -24, 40, 24, 0.83],
  ['constellation', 'USS CONSTELLATION', -31, 7, -18, 34, 18, 1.03],
  ['wtc', 'WORLD TRADE CENTER', -12, 22, -22, 66, 36, 1.33],
  ['aquarium', 'NATIONAL AQUARIUM', 19, 7, -17, 44, 24, 1.43],
  ['powerplant', 'POWER PLANT', 56, 9, -17, 46, 26, 1.63],
  ['fourseasons', 'FOUR SEASONS', 82, 20, -58, 60, 36, 1.23],
  ['pendry', 'PENDRY', 126, 6, -25, 44, 22, 1.73],
  ['fells', 'FELLS POINT', 155, 4, -56, 46, 26, 1.53],
  ['monument', 'WASHINGTON MONUMENT', -20, 18, -92, 46, 26, 1.13],
  ['orioles', 'ORIOLE PARK', -100, 6, 0, 60, 36, -0.07],
  ['ravens', 'M&T BANK STADIUM', -106, 8, 76, 64, 38, -0.77],
  ['science', 'SCIENCE CENTER', -54, 7, 58, 46, 26, -1.57],
  ['fedhill', 'FEDERAL HILL', -3, 6, 59, 48, 28, -1.67],
  ['domino', 'DOMINO SUGARS', 82, 14, 57, 52, 28, -1.87],
  ['underarmour', 'UNDER ARMOUR', 116, 7, 52, 48, 26, -1.97],
  ['fort', 'FORT MCHENRY', 176, 4, 78, 58, 38, -2.47],
];
// drone orbit: sweeps 0.55 rad round the target while descending, fog pushed back, city sim paused (draw only)
const orbitTick = (x, y, z, r, h, a0) => `{const C=__cel,u=__capU,a=${a0}+u*0.55,rr=${r}*(1.12-0.18*u),hh=${h}*(1.15-0.3*u);
C.camera.position.set(${x}+Math.cos(a)*rr,${y}+hh,${z}+Math.sin(a)*rr);C.camera.lookAt(${x}+Math.cos(a)*rr*0.16,${y}*0.55,${z}+Math.sin(a)*rr*0.16);
if(window.__sky)__sky.position.copy(C.camera.position);}`;
const LM_PRE = `{const C=__cel;C.pause=true;C.camera.far=2000;C.camera.fov=55;C.camera.aspect=innerWidth/innerHeight;C.camera.updateProjectionMatrix();C.scene.fog.near=260;C.scene.fog.far=640;}`;
const landmarks = LM.map(([id, name, x, y, z, r, h, a0]) => ({
  id, label: name, labelOpt: { size: 26 }, q: BASE + '&tod=0.12', hideUI: true, dur: 1.8,
  pre: LM_PRE + `{const C=__cel;C.hero.pos.set(${x},C.groundY(${x},${z}),${z});}`, tick: orbitTick(x, y, z, r, h, a0),
  reuse: true, recapture: id === 'orioles' || id === 'ravens' ? ['stadiums', 'landmarks'] : ['landmarks'],
}));


// ---------- bosses: every boss in the build, mid-fight, auto-pilot on, name + landmark ----------
// [segId, boss name, where, query, warm seconds]
const BOSSES = [
  ['chipkid', 'THE CHIP KID', 'HARBORPLACE', '&duel=chipkid&duelbot=win', 9],
  ['cobblestone', 'CAPTAIN COBBLESTONE', 'USS CONSTELLATION', '&cobblestone=1&cobblestonenight=1&cobblestoneauto=win', 9],
  ['pigeon', 'THE PENTHOUSE PIGEON', 'WORLD TRADE CENTER', '&pigeon=1&pigeonauto=win', 9],
  ['jimmy', 'BIG JIMMY', 'NATIONAL AQUARIUM', '&jimmy=1&jimmyauto=win', 8],
  ['vic', 'VOLTAGE VIC', 'POWER PLANT', '&vic=perfect&vicyt=stub', 9],
  ['crabcake', 'CHEF CRABCAKE', 'FOUR SEASONS', '&crabcake=1&crabcakeauto=win', 9],
  ['poolshark', 'THE POOL SHARK', 'PENDRY', '&poolshark=1&poolsharkauto=win', 9],
  ['al', 'ARABBER AL', 'FELLS POINT', '&rb=al&rbauto=win', 7],
  ['scrubber', 'THE STOOP SCRUBBER', 'WASHINGTON MONUMENT', '&scrubber=1&scrubberauto=win', 9],
  ['bobby', 'BIRD BRAIN BOBBY', 'ORIOLE PARK', '&derby=perfect', 7],
  ['ravenking', 'THE RAVEN KING', 'M&T BANK STADIUM', '&ravenking=1&ravenkingauto=win', 9],
  ['shellacious', 'DR. SHELLACIOUS', 'SCIENCE CENTER', '&shellacious=1&shellaciousauto=win', 9],
  ['honqueen', 'THE HON QUEEN', 'FEDERAL HILL', '&honqueen=1&honqueenauto=win', 9],
  ['sugarrush', 'SUGAR RUSH', 'DOMINO SUGARS', '&sugarrush=1&sugarrushauto=win', 9],
  ['compking', 'THE COMPRESSION KING', 'UNDER ARMOUR', '&compking=1&compkingauto=win', 9],
  ['redclaw', 'ADMIRAL REDCLAW', 'FORT MCHENRY', '&fort=1&fortwave=4&fortauto=1', 10],
  ['pete', 'PIT BEEF PETE', 'LEXINGTON MARKET', '&pete=1&peteauto=win', 8],
  ['rodney', 'RIPTIDE RODNEY', 'RASH FIELD', '&duel=rodney&duelbot=win', 9],
  ['carl', 'KINGPIN CARL', 'DUCKPIN DEN LANES', '&carl=1&carlauto=win', 8],
  ['duchess', 'THE DRAGON BOAT DUCHESS', 'INNER HARBOR', '&rb=duchess&rbauto=win', 8],
  ['brewmaster', 'THE ONE-EYED BREWMASTER', 'ONE-EYE BREWERY', '&brewmaster=1&brewmasterauto=win', 9],
];
const bosses = BOSSES.map(([id, name, where, q, warm]) => ({ id, label: name, labelOpt: { sub: where, color: '#ff5fd0' }, q: (id === 'vic' ? RBASE : BASE) + q, warm, dur: 1.6,
  recapture: id === 'bobby' || id === 'ravenking' ? ['stadiums', 'rigs'] : ['rigs'] }));

// ---------- fighter groups ----------
// city fight at a turf: hero + Mavis dropped beside the nearest thug post, Harold swings every 5 frames, barks on
// (coords are parenthesised: "e.pos.x-${-52}" would read as "x--52", a syntax error that killed the first fighters/specials run)
const fightAt = (x, z) => `{const C=__cel;let b=null,bd=1e9;for(const e of C.enemies){const d=Math.hypot(e.pos.x-(${x}),e.pos.z-(${z}));if(e.alive!==false&&d<bd){bd=d;b=e;}}
const t=b?b.pos:{x:(${x}),z:(${z})};const a=Math.atan2((${x})-t.x,(${z})-t.z)||0;C.hero.pos.set(t.x+Math.sin(a)*4.5,C.groundY(t.x,t.z),t.z+Math.cos(a)*4.5);C.hero.yaw=a+Math.PI;
C.partner.pos.set(C.hero.pos.x+1.5,C.hero.pos.y,C.hero.pos.z+1.2);if(C.CAM){C.CAM.yaw=C.hero.yaw;}}`;
// capture camera for city fights: wraps renderer.render once so every rendered frame looks side-on at the hero and the
// nearest live thug (smoothed, raised), instead of the follow cam that can end up inside a tree or a wall.
const SIDECAM = `{const C=__cel;if(!C.__capWrap){C.__capWrap=1;const R=C.renderer,o=R.render.bind(R);
R.render=function(s,c){try{const h=C.hero.pos;let b=null,bd=1e9;for(const e of C.enemies){if(e.alive===false||!e.pos)continue;const d=Math.hypot(e.pos.x-h.x,e.pos.z-h.z);if(d<bd){bd=d;b=e;}}
const t=b&&bd<14?b.pos:h;const mx=(h.x+t.x)/2,mz=(h.z+t.z)/2;let dx=t.x-h.x,dz=t.z-h.z;const L=Math.hypot(dx,dz);if(L<0.3){dx=Math.sin(C.hero.yaw||0);dz=Math.cos(C.hero.yaw||0);}else{dx/=L;dz/=L;}
const D=8.5,W=window;let px=-dz,pz=dx;if(W.__capSide&&px*W.__capSide[0]+pz*W.__capSide[1]<0){px=-px;pz=-pz;}W.__capSide=[px,pz];
const gx=mx+px*D-dx*2.5,gz=mz+pz*D-dz*2.5;const S=W.__capCamS||(W.__capCamS={x:gx,z:gz});S.x+=(gx-S.x)*0.2;S.z+=(gz-S.z)*0.2;
C.camera.position.set(S.x,h.y+5.2,S.z);C.camera.lookAt(mx,h.y+1.0,mz);}catch(e){}return o(s,c);};}}`;
const GANGS = [
  ['harbor_rats', 'HARBOR RATS', 'HARBORPLACE / WTC / MONUMENT', -52, -24],
  ['pier_gulls', 'PIER GULLS', 'AQUARIUM / POWER PLANT', 19, -17],
  ['cobble_catfish', 'COBBLESTONE CATFISH', 'HARBOR EAST / FELLS POINT', 155, -56],
  ['masked_bandits', 'MASKED BANDITS', 'STADIUMS / SCIENCE CENTER', -100, 0],
  ['key_hwy_otters', 'KEY HIGHWAY OTTERS', 'FEDERAL HILL / KEY HWY / FORT', -3, 59],
];
const fighters = [
  { id: 'team', label: 'HAROLD & MAVIS', labelOpt: { sub: 'THE PLAYER TEAM (MAVIS = AI PARTNER)', color: '#9dff6b' }, q: BASE + '&tod=0.15', hideUI: true, pre: fightAt(-52, -24) + SIDECAM, warm: 2.5, dur: 2.6, every: [5, 'j'], recapture: ['rigs'] },
  ...GANGS.map(([id, name, turf, x, z]) => ({ id, label: name, labelOpt: { sub: 'TURF: ' + turf, color: '#ff8a2a' }, q: BASE + '&tod=0.15', hideUI: true, pre: fightAt(x, z) + SIDECAM, warm: 2.5, dur: 2.2, every: [6, 'j'], recapture: ['rigs', 'gang wiring'] })),
];

// ---------- special moves ----------
// city-fight segments (their pre places the hero via fightAt) get the side camera and a clean frame (HUD + landmark popups hidden)
const cityCam = (s) => (s.pre && s.pre.includes('C.enemies') ? { pre: s.pre + SIDECAM, hideUI: true } : {});
const POW = (h) => `{const H=window.${h};const st=H&&(H.st||H.S||H);if(st&&'pow' in st)st.pow=1;}`;
const specials = [
  { id: 'cane_combo', label: 'CANE COMBO', labelOpt: { sub: 'HAROLD: 3-HIT CANE STRING' }, q: BASE + '&tod=0.15', pre: fightAt(19, -17), warm: 2.4, dur: 2.0, keys: { 0: 'j', 4: 'j', 8: 'j', 16: 'j', 20: 'j', 24: 'j' } },
  { id: 'air_cane', label: 'AIR CANE', labelOpt: { sub: 'JUMP + SWING' }, q: BASE + '&tod=0.15', pre: fightAt(-52, -24), warm: 2.4, dur: 1.8, keys: { 0: 'k', 4: 'j', 14: 'k', 18: 'j' } },
  { id: 'cane_quake', label: 'CANE QUAKE', labelOpt: { sub: 'POWER: HOP, FLIP, SLAM + MAVIS SPIN' }, q: BASE + '&tod=0.15', pre: fightAt(-52, -24), warm: 2.8, dur: 2.2, keys: { 1: 'e' } },
  { id: 'purse_swing', label: 'PURSE SWING', labelOpt: { sub: "MAVIS'S HANDBAG" }, q: BASE + '&tod=0.15', pre: fightAt(155, -56) + `{const C=__cel;C.hero.pos.x+=3;}`, warm: 3.0, dur: 2.2, tick: `{const C=__cel,P=C.partner;C.CAM&&0;}` },
  { id: 'tag_finisher', label: 'TAG-TEAM FINISHER', labelOpt: { sub: 'DIZZY THUG: FINISH (QTE)' }, q: BASE + '&tod=0.15', pre: fightAt(-3, 59), warm: 2.4, dur: 2.8, every: [4, 'j'], keys: { 10: 'e', 14: 'e', 18: 'e', 22: 'e', 26: 'e', 30: 'e' } },
  { id: 'cane_torpedo', label: 'CANE TORPEDO', labelOpt: { sub: 'BIG JIMMY DUEL POWER' }, q: BASE + '&jimmy=1&jimmyauto=win', warm: 10, dur: 2.0, after: POW('__jimmy'), keys: { 1: 'e' } },
  { id: 'chipkid_specials', label: 'HON! HOMER', labelOpt: { sub: 'CHIP KID DUEL POWER SPECIAL' }, q: BASE + '&duel=chipkid&duelbot=win', warm: 12, dur: 2.4, keys: { 1: 'e' } },
  { id: 'chefs_flip', label: "CHEF'S FLIP", labelOpt: { sub: 'TEAM-UP VS CHEF CRABCAKE' }, q: BASE + '&crabcake=1&crabcakeauto=win', warm: 9, dur: 2.2, after: POW('__crabcake'), keys: { 1: 'e' } },
  { id: 'clearance_sale', label: 'CLEARANCE SALE', labelOpt: { sub: 'POWER VS THE COMPRESSION KING' }, q: BASE + '&compking=1&compkingauto=win', warm: 9, dur: 2.2, after: POW('__compking'), keys: { 1: 'e' } },
  { id: 'bank_shot', label: 'BANK SHOT', labelOpt: { sub: 'TEAM-UP VS THE POOL SHARK' }, q: BASE + '&poolshark=1&poolsharkauto=win', warm: 9, dur: 2.2, after: POW('__poolshark'), keys: { 1: 'e' } },
  { id: 'stoop_surf', label: 'STOOP SURF', labelOpt: { sub: 'TEAM-UP VS THE STOOP SCRUBBER' }, q: BASE + '&scrubber=1&scrubberauto=win', warm: 9, dur: 2.2, after: POW('__scrubber'), keys: { 1: 'e' } },
  { id: 'plot_twist', label: 'PLOT TWIST', labelOpt: { sub: 'POWER VS DR. SHELLACIOUS' }, q: BASE + '&shellacious=1&shellaciousauto=win', warm: 9, dur: 2.2, after: POW('__shellacious'), keys: { 1: 'e' } },
  { id: 'back_boost', label: 'MAVIS BACK-BOOST', labelOpt: { sub: 'TEAM-UP VS SUGAR RUSH' }, q: BASE + '&sugarrush=1&sugarrushauto=win', warm: 9, dur: 2.2, after: POW('__sugarrush'), keys: { 1: 'e' } },
  { id: 'lantern_flare', label: 'LANTERN FLARE', labelOpt: { sub: 'POWER VS CAPTAIN COBBLESTONE' }, q: BASE + '&cobblestone=1&cobblestonenight=1&cobblestoneauto=win', warm: 9, dur: 2.2, after: POW('__cobblestone'), keys: { 1: 'e' } },
  { id: 'hon_haymaker', label: 'HON HAYMAKER', labelOpt: { sub: 'TEAM-UP VS THE BREWMASTER' }, q: BASE + '&brewmaster=1&brewmasterauto=win', warm: 9, dur: 2.2, after: POW('__brewmaster'), keys: { 1: 'e' } },
  { id: 'dragon_slayer_ram', label: 'DRAGON-SLAYER RAM', labelOpt: { sub: 'POWER VS THE DRAGON BOAT DUCHESS' }, q: BASE + '&rb=duchess&rbauto=win', warm: 8, dur: 2.2, after: POW('__rb'), keys: { 1: 'e' } },
].map((s) => ({ ...s, ...cityCam(s), labelOpt: { color: '#2fd3ff', ...s.labelOpt }, recapture: s.recapture || ['rigs'] }));

// ---------- unique gameplay features (verified against src/ on hark/integration) ----------
const features = [
  { id: 'fishing', label: 'HARBOR FISHING', labelOpt: { sub: 'CAST, HOOK, REEL + FEED CHOMPY' }, q: BASE + '&fish=1&fishauto=win', warm: 6, dur: 2.6 },
  { id: 'poe', label: 'POE STEALTH NIGHT', labelOpt: { sub: 'SNEAK PAST THE CROW LANTERNS' }, q: BASE + '&poe=1&poeauto=win', warm: 6, dur: 2.6 },
  { id: 'phantoms', label: 'FELLS POINT PHANTOMS', labelOpt: { sub: 'GHOST PIRATES ON BROADWAY PIER' }, q: BASE + '&phantoms=1&phauto=win', warm: 7, dur: 2.6 },
  { skipGallery: 'camera blocked by a yellow blob for most of the clip (QA 2026-10-13)', id: 'daynight', label: 'DAY / NIGHT CYCLE', labelOpt: { sub: 'TIME-LAPSE OVER THE INNER HARBOR' }, q: BASE + '&tod=0.3&cycle=6', hideUI: true, dur: 3.2,
    pre: `{const C=__cel;C.camera.far=2000;C.camera.fov=58;C.camera.aspect=innerWidth/innerHeight;C.camera.updateProjectionMatrix();C.scene.fog.near=260;C.scene.fog.far=640;C.pause=false;}`,
    tick: `{const C=__cel,u=__capU,a=1.35+u*0.25;C.camera.position.set(20+Math.cos(a)*120,70,-10+Math.sin(a)*120);C.camera.lookAt(20,0,-15);if(window.__sky)__sky.position.copy(C.camera.position);}` },
  { id: 'cobble_storm', label: 'DAYTIME STORM', labelOpt: { sub: 'CAPTAIN COBBLESTONE CALLS IT IN' }, q: BASE + '&cobblestone=1&tod=0.1', warm: 0.3, dur: 3.0 },
  { id: 'final_blow_replay', label: 'FINAL-BLOW REPLAY', labelOpt: { sub: 'HIT-STOP, COMBOS + SLOW-MO KO' }, q: BASE + '&compking=1&compkingauto=win', until: 'window.__juice && __juice.on', maxWarm: 90, untilExtra: 0.2, dur: 2.6 },
  { id: 'drone', label: 'THE DRONE', labelOpt: { sub: 'UNLOCKED AFTER THE FINALE' }, q: BASE + '&tod=0.2', after: `{__finale.save.drone=true;__finale.drone('act');}`, hold: ['w', 'k'], dur: 3.0, recapture: ['finale'] },
  { id: 'fireworks', label: 'FINALE FIREWORKS', labelOpt: { sub: 'THE CITY IS SAVED' }, q: BASE + '&finale=1', warm: 7, dur: 3.0, recapture: ['finale'] },
  { skipGallery: 'radio card covers the action (QA 2026-10-13)', id: 'radio', label: 'B-MORE 410 RADIO', labelOpt: { sub: 'THE BUILT-IN STATION DIAL' }, q: RBASE + '&tod=0.2', warm: 0.5, dur: 3.0, keys: { 2: 't', 22: 't' } },
  { id: 'partner_ai', label: 'MAVIS: AI PARTNER', labelOpt: { sub: 'FOLLOWS, FIGHTS, REVIVES, TAG-TEAMS' }, q: BASE + '&tod=0.15', pre: fightAt(56, -17) + `{const C=__cel;C.hero.hp=1;}`, warm: 4, dur: 2.8, every: [7, 'j'] },
  { id: 'derby', label: 'HOME RUN DERBY', labelOpt: { sub: 'ORIOLE PARK' }, q: BASE + '&derby=perfect', warm: 5, dur: 2.6, recapture: ['stadiums'] },
  { id: 'stoop', label: 'MARBLE STOOP SHOWDOWN', labelOpt: { sub: 'SLIPPERY SUDS ON THE WHITE MARBLE STEPS' }, q: BASE + '&scrubber=1&scrubberauto=win', warm: 16, dur: 2.6, recapture: ['rigs'] },
  { id: 'grandprix', label: 'HARBOR GRAND PRIX', labelOpt: { sub: '3 LAPS OF PRATT STREET' }, q: BASE + '&duel=grandprix&gpauto=win', warm: 8, dur: 2.6 },
].map((s) => ({ ...s, ...cityCam(s), labelOpt: { color: '#9dff6b', ...s.labelOpt }, recapture: s.recapture || [] }));

module.exports = {
  width: 720, height: 405, fps: 15, sub: 2, baseQuery: BASE,
  // per-GIF encode: one combined GIF (landmarks, bosses) or one GIF per segment (fighters, specials, features)
  gifs: [
    { id: 'landmarks', group: 'Landmarks', title: 'Every landmark', mode: 'combined', segments: landmarks },
    { id: 'bosses', group: 'Bosses', title: 'Every boss', mode: 'combined', segments: bosses },
    { id: 'fighters', group: 'Fighters', mode: 'each', segments: fighters },
    { id: 'specials', group: 'Special Moves', mode: 'each', segments: specials },
    { id: 'features', group: 'Features', mode: 'each', segments: features },
  ],
};
