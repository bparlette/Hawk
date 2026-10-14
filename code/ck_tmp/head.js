// ======================= THE CHIP KID, HARBORPLACE: a cane-brawl mech duel (DESIGN.md "More game-style fights" + "Homage bosses"; reworked for FUN, Brad 2026-10-12:
// "way too hard ... the stick punch is not animated or fun enough ... the power button doesn't do anything special ... it should be easily beaten, with special moves
// and lots of animated action scenes worthy of replay").
// A behind-the-player view: Harold in a makeshift ring on the Harborplace plaza, Mavis cheering from the corner, facing The Chip Kid's giant
// crab-chip-bag mech (an original red / yellow snack look: "LIL' CRUNCH CRAB CHIPS", no real brand). The kid (pigtails, big eyes, bonnet-style hat) sits in the cockpit dome.
// CANE: SWING chains a 3-hit cane combo (forehand, backhand, overhead SMASH finisher). Every hit lands: wind-up + swing arc with a motion trail, hitstop, camera shake,
//   sparks + flying chip crumbs + foil shreds, the mech flinches back with a white flash, floating damage numbers, chunky hit sounds, a combo counter. After an attack the
//   mech is OPEN (it sags): hits there are CRITS (x1.5, gold numbers).
// POWER (ACT): hits and dodges fill the meter fast; when it is full the bar glows, the ACT button pulses and a POWER READY prompt shows. Specials rotate:
//   OLD BAY CYCLONE (a spinning seasoning-tornado cane flurry), CRAB-MALLET POUND (leap + giant mallet + shockwave, the mech bounces), "HON!" HOMER (a charged home-run
//   swing that sends the mech flying off into the sky and crashing back down). Each has slow-mo, zoom, big flashes and big damage; Harold can't be hurt during one.
// The mech's attacks are slow and loudly telegraphed (it flashes, a "!" pops over the dome, the danger shows on the ground):
//   SEASONING CLOUD (shakers tip + glow orange, orange ring on the middle lane) -> DUCK or DODGE   ·   CHIP-CAN BARRAGE (hatch opens, lanes flash) -> step out of the lane
//   BAG-SLAM (crouch + leap, red shadow on the middle lane) -> DODGE   ·   CLAW JAB (claw pulls back + flashes, lanes flash) -> dodge away or duck
// Forgiving: half the old damage, long i-frames after a hit, Mavis tosses crab cakes when Harold is low, one "second wind" per fight, full health between rounds.
// 3 short rounds; the final blow plays a slow-mo KO: the mech blows apart into a chip cloud, the kid tumbles out, sulks and runs off; then a grade (stars) + REMATCH.
// Controls: phone: stick left / right (or the white buttons) dodge, stick down / JUMP = DUCK, SWING = cane, ACT = POWER. Desktop: A / D (arrows) dodge, S duck, J swing,
// E power. Gamepad: left stick or LB / RB dodge, A duck, X swing, Y power.
// Tests: ?duel=chipkid&duelbot=win|mash|lose (mash = only mashes SWING), &ckhp=N start HP N with no crab cakes / second wind (test-only, for the lose path), &ckround=N.
// Rig hook: window.buildChipKid({ THREE, toonMat, outlineMat, addOdir, QUAL }) may return { root, bag?, armL?, armR?, shakers?, hatch?, dome?, kid?, flash? }.
(function () {
  const C = { scene: null, cam: null, title: 'THE CHIP KID', pips: 3,
    hint: '<b>J</b> swing (3-hit combo) · <b>E</b> POWER special · <b>A / D</b> dodge · <b>S</b> duck',
    labels: { a: 'SWING', b: 'DUCK', c: 'POWER', l: '&#9664; DODGE', r: 'DODGE &#9654;' } };
  const MZ = 4.4, LANE = 1.35; // the mech stands at z = MZ facing -z; Harold at z = 0 facing +z. Screen right is world -x here.
  const RHP = [200, 220, 240]; // mech HP per round
  const RND = [ // per round: tell lengths (slow + loud), how many cans, can spacing / speed, guard time, open time, attack order
    { cloud: 1.6, cans: 2, gap: 0.95, cspd: 3.4, slam: 1.7, jab: 1.2, guard: [1.7, 2.4], open: 1.8, mix: ['jab', 'cloud', 'cans', 'slam'] },
    { cloud: 1.45, cans: 3, gap: 0.85, cspd: 3.6, slam: 1.55, jab: 1.1, guard: [1.4, 2.1], open: 1.7, mix: ['cans', 'jab', 'cloud', 'slam', 'jab'] },
    { cloud: 1.3, cans: 3, gap: 0.8, cspd: 3.9, slam: 1.45, jab: 1.0, guard: [1.2, 1.9], open: 1.6, mix: ['slam', 'cans', 'jab', 'cloud', 'jab', 'cans'] },
  ];
  const DMG_TO_HAROLD = { cloud: 5, can: 4, slam: 10, jab: 5 };
  const SWINGS = [ // the 3-hit cane combo: duration, hit moment (s), damage, meter
    { dur: 0.3, hit: 0.12, dmg: 6, pw: 8, name: 'fore' }, { dur: 0.3, hit: 0.12, dmg: 7, pw: 8, name: 'back' }, { dur: 0.48, hit: 0.22, dmg: 14, pw: 16, name: 'smash' }];
  const SPECIALS = [{ id: 'cyclone', name: 'OLD BAY CYCLONE!', ban: 'OLD BAY<br>CYCLONE!', dur: 2.2 }, { id: 'mallet', name: 'CRAB-MALLET POUND!', ban: 'CRAB-MALLET<br>POUND!', dur: 2.3 }, { id: 'homer', name: '"HON!" HOMER!', ban: '"HON!"<br>HOMER!', dur: 3.3 }];
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
  const sx = (lat) => -lat * LANE; // screen lane (-1 left, 0 centre, 1 right) -> world x
  const TOUCH = () => document.body.classList.contains('touch');

