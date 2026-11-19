// spec_compass.mjs — SPEC: compass arrow target selection (src/lf_compass.js, owner Nov 18).
//   node tools/spec_compass.mjs        (from games/laurel-fulton/)   exit 0 = green
// The arrow must point at the CURRENT objective and nothing else: nearest undone house during
// the rally, the meetup on the finale run, the party house at night once the rally is done —
// and it must hide when there is no target, during the arrival beat, and when the only party
// venue on offer sits outside this map (College Park loads Laurel's party data; its coords
// must never become a target there). Also pins the orbit radius contract vs the drift readout.
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const { compassTarget, COMPASS } = await import('../src/lf_compass.js');

const C = { x: 0, y: 0 };
const stops = [
  { x: 900, y: 0, done: false },     // farther undone
  { x: 300, y: 400, done: false },   // nearest undone (500 away)
  { x: 50, y: 0, done: true },       // nearest of all, but done
];
const M = { complete: false, beat: null, stops, meet: { pos: [5000, 5000] } };
const partyOff = { active: false, venue: () => ({ world: [700, 700] }) };
const partyOn = { active: true, venue: () => ({ world: [700, 700] }) };
const BOUNDS = { x0: -20000, y0: -20000, x1: 20000, y1: 20000 };

let t = compassTarget(M, partyOff, C, BOUNDS);
check(t && t.kind === 'house' && t.x === 300 && t.y === 400, 'rally: nearest UNDONE house (done stops skipped)', JSON.stringify(t));
t = compassTarget({ ...M, stops: stops.map(s => ({ ...s, done: true })) }, partyOff, C, BOUNDS);
check(t && t.kind === 'meet' && t.x === 5000 && t.y === 5000, 'finale: the meetup once every stop is done', JSON.stringify(t));
t = compassTarget({ ...M, complete: true }, partyOn, C, BOUNDS);
check(t && t.kind === 'party' && t.x === 700 && t.y === 700, 'rally complete + party on: the party house', JSON.stringify(t));
t = compassTarget({ ...M, complete: true }, partyOff, C, BOUNDS);
check(t === null, 'rally complete + no party: hidden (no target exists)');
t = compassTarget({ ...M, complete: true }, partyOn, C, { x0: 1000, y0: 1000, x1: 2000, y1: 2000 });
check(t === null, 'party venue outside this map (the College Park leak): hidden, never points off-world');
t = compassTarget({ ...M, beat: { t: 1 } }, partyOn, C, BOUNDS);
check(t === null, 'during the arrival beat: hidden (the beat owns the screen)');
t = compassTarget(M, partyOn, C, BOUNDS);
check(t && t.kind === 'house', 'party on but rally still running: the house wins (the mission is the objective)');
t = compassTarget(null, partyOn, C, BOUNDS);
check(t && t.kind === 'party', 'no mission object: the party can still be the target');
check(compassTarget(M, partyOff, null, BOUNDS) === null, 'no player car: hidden');
check(COMPASS.radius >= 100, 'orbit radius clears the drift-bank readout slot (pill top -64, popups to ~-91)', `radius ${COMPASS.radius}`);

console.log(fails ? `FAIL (${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
