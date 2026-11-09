// THE CLIMB — course data + game rules + scripted bot. Pure data/logic, no rendering,
// so the same file drives the browser game (index.html) and the headless completion test.
// Units are controller units (hero ~160 tall, top run speed 32/tick, 100 units = 1 m).
// The route runs +Z and climbs from a meadow (y=0) to a summit deck (y=2700).
// Gate sizing comes from measured controller flights: running jump ~800 long / 337 high,
// double ~1000 / 486, triple ~1160 / 630, long jump ~1450 / 240, dive ~470 / 60.
import { BoxWorld } from './boxworld.js';

// Box helper: a solid block whose walkable top is `top`, extending `thick` below it.
const B = (x0, x1, top, z0, z1, thick = 260, tag = 'stone') =>
  ({ x0, x1, y0: top - thick, y1: top, z0, z1, tag });

export const ZONES = [
  { name: 'Meadow',     until: 650,  sky: 0x79bde8, fog: 0x9fd0ee },
  { name: 'Cliffside',  until: 1400, sky: 0x84b4e2, fog: 0xa8c6e8 },
  { name: 'Frost',      until: 2100, sky: 0xa9cdec, fog: 0xc3d9ef },
  { name: 'Sky Summit', until: 1e9,  sky: 0xc9def3, fog: 0xdcebf7 },
];
export const zoneOf = (y) => ZONES.find((z) => y < z.until) || ZONES[ZONES.length - 1];

export const COURSE = {
  name: 'The Climb',
  voidY: -1500,  // collision floor far below everything (never reached: killY respawns first)
  killY: -500,   // falling past this respawns at the base
  start: { x: 0, y: 0, z: -350, yaw: 0 },
  summitY: 2700,
  boxes: [
    // ---- MEADOW (tops < 650): running jumps, then the triple-jump tower ----
    B(-750, 750, 0, -800, 950, 240, 'meadow'),          // M0 base island
    B(-380, 380, 70, 1200, 1750, 260, 'meadow'),        // M1
    B(-380, 380, 150, 2000, 2550, 260, 'meadow'),       // M2
    B(-320, 320, 250, 2800, 3300, 260, 'meadow'),       // M3
    B(-420, 420, 310, 3550, 6480, 300, 'meadow'),       // M4 triple-jump runway
    // ---- CLIFFSIDE (650..1400): triple deck, ledge grab, long jump ----
    B(-420, 420, 880, 6480, 7480, 1150, 'cliff'),       // M5 tower deck (triple jump lands here)
    B(-320, 320, 880, 7730, 8230, 260, 'cliff'),        // C1
    B(-160, 160, 880, 8480, 8780, 260, 'cliff'),        // C2 grab pad (small: no room to chain)
    B(-380, 380, 1240, 8780, 9680, 1500, 'cliff'),      // C3 grab tower / long-jump runway
    B(-560, 560, 690, 8130, 9180, 260, 'cliff'),        // CS1 catch shelf under the grab
    B(-180, 180, 785, 8230, 8490, 120, 'cliff'),        // CS1 recovery step A
    B(-180, 180, 870, 8510, 8780, 120, 'cliff'),        // CS1 recovery step B
    B(-600, 600, 1010, 9700, 10700, 260, 'cliff'),      // CS2 catch shelf under the long jump
    B(-180, 180, 1105, 10120, 10380, 120, 'cliff'),     // CS2 recovery step A
    B(-180, 180, 1200, 10400, 10660, 120, 'cliff'),     // CS2 recovery step B
    B(-420, 420, 1240, 10800, 11700, 260, 'frost'),     // F1 across the long-jump gap (1200 wide)
    // ---- FROST (1400..2100): hops, then the dive-under-the-lintel gate ----
    B(-320, 320, 1430, 11950, 12450, 260, 'frost'),     // F2
    B(700, 860, 1430, 12120, 12280, 200, 'frost'),      // risky pillar beside F2 (coin on top)
    B(-320, 320, 1580, 12700, 13200, 260, 'frost'),     // F3
    B(-380, 380, 1720, 13450, 14150, 260, 'frost'),     // F4 dive approach
    { x0: -460, x1: 460, y0: 1970, y1: 2250, z0: 14050, z1: 14640, tag: 'lintel' }, // low bar over the dive gap
    B(-380, 380, 1720, 14540, 15250, 260, 'frost'),     // F5 dive landing (gap is 390, under the lintel)
    B(-580, 580, 1460, 13920, 15370, 260, 'frost'),     // CS3 catch shelf under the dive gate
    B(395, 575, 1555, 14670, 14930, 120, 'frost'),      // CS3 recovery step A (side lane)
    B(395, 575, 1650, 14410, 14680, 120, 'frost'),      // CS3 recovery step B
    // ---- SKY SUMMIT (2100+): two hops, then the wall-kick shaft ----
    B(-320, 320, 1880, 15500, 16000, 260, 'frost'),     // S1
    B(-320, 320, 2040, 16250, 16900, 260, 'summit'),    // S2
    B(-560, 560, 1620, 15420, 16720, 260, 'frost'),     // CS5 catch shelf under S1/S2
    B(340, 540, 1715, 15620, 15880, 120, 'frost'),      // CS5 recovery step A (side lane)
    B(340, 540, 1810, 15890, 16150, 120, 'frost'),      // CS5 recovery step B
    B(-460, 460, 2040, 17000, 18670, 300, 'summit'),    // S3 shaft deck
    B(-650, 650, 1780, 16670, 18870, 260, 'frost'),     // CS4 catch shelf under the shaft deck
    B(480, 640, 1875, 17270, 17530, 120, 'frost'),      // CS4 recovery step A (side lane)
    B(480, 640, 1970, 17540, 17800, 120, 'frost'),      // CS4 recovery step B
    { x0: -460, x1: 460, y0: 2220, y1: 3060, z0: 17570, z1: 17770, tag: 'wall' },  // shaft near wall (walk under it)
    B(-460, 460, 2700, 18170, 18670, 2960, 'summit'),   // summit tower; its top is the goal deck
  ],
  coins: [
    [0, 90, 300], [0, 90, 700], [0, 200, 1075], [0, 160, 1475], [0, 240, 2275], [0, 340, 3050],
    [0, 400, 3750], [0, 940, 6630], [0, 970, 7000], [0, 970, 7980], [0, 970, 8630],
    [0, 1330, 9100], [0, 1500, 10200], [0, 1330, 11200], [0, 1520, 12200], [0, 1670, 12950],
    [0, 1810, 13800], [0, 1830, 14345], [0, 1810, 14900], [0, 1970, 15750], [0, 2130, 16500],
    [0, 2520, 17970], [0, 2790, 18270],
    [780, 1520, 12200],   // risky: the side pillar by F2
    [0, 1100, 10200],     // risky: drop to the catch shelf under the long jump
    [560, 2060, 17670],   // risky: top of the CS4 recovery steps, beside the shaft
  ],
  goal: { x: 0, y: 2700, z: 18420, radius: 170 },
};

// Visual-only set dressing (no collision): placed by the page renderer.
export const DECOR = [
  // meadow trees (cone pines) on the base island and runway edges
  { k: 'tree', x: -520, y: 0, z: -500, s: 1.2 }, { k: 'tree', x: 480, y: 0, z: -620, s: 1.5 },
  { k: 'tree', x: -610, y: 0, z: 250, s: 1.0 }, { k: 'tree', x: 590, y: 0, z: 480, s: 1.3 },
  { k: 'tree', x: -300, y: 0, z: 780, s: 0.9 }, { k: 'tree', x: 330, y: 0, z: -80, s: 1.1 },
  { k: 'tree', x: -250, y: 0, z: -650, s: 1.1 }, { k: 'tree', x: 300, y: 0, z: 640, s: 0.85 },
  { k: 'spire', x: 545, y: 0, z: -120, s: 0.45 }, { k: 'spire', x: -565, y: 0, z: 620, s: 0.5 },
  { k: 'tree', x: -340, y: 310, z: 3900, s: 1.0 }, { k: 'tree', x: 350, y: 310, z: 4600, s: 1.2 },
  { k: 'tree', x: -280, y: 70, z: 1450, s: 0.8 }, { k: 'tree', x: 270, y: 150, z: 2300, s: 0.9 },
  // cliffside rock spires beside the route
  { k: 'spire', x: -700, y: 300, z: 7000, s: 1.4 }, { k: 'spire', x: 720, y: 200, z: 8400, s: 1.8 },
  { k: 'spire', x: -680, y: 500, z: 9400, s: 1.2 }, { k: 'spire', x: 660, y: 690, z: 7800, s: 1.0 },
  // frost crystals
  { k: 'crystal', x: -250, y: 1240, z: 11100, s: 1.0 }, { k: 'crystal', x: 260, y: 1240, z: 11500, s: 1.4 },
  { k: 'crystal', x: -290, y: 1720, z: 13700, s: 1.2 }, { k: 'crystal', x: 300, y: 1720, z: 14000, s: 0.9 },
  { k: 'crystal', x: -280, y: 1720, z: 14800, s: 1.1 }, { k: 'crystal', x: 240, y: 1880, z: 15800, s: 1.0 },
  { k: 'crystal', x: -230, y: 2040, z: 16500, s: 1.3 },
  // summit gold finials on the deck corners
  { k: 'finial', x: -400, y: 2040, z: 17200, s: 1.0 }, { k: 'finial', x: 400, y: 2040, z: 17200, s: 1.0 },
];
// Floating islands that are pure scenery (rendered by the page, NOT in BoxWorld).
export const DECO_ISLANDS = [
  { x0: -2600, x1: -1700, y0: -500, y1: -260, z0: 2000, z1: 2900, tag: 'meadow' },
  { x0: 1800, x1: 2500, y0: 100, y1: 330, z0: 5900, z1: 6600, tag: 'cliff' },
  { x0: -2900, x1: -2100, y0: 800, y1: 1010, z0: 9500, z1: 10300, tag: 'cliff' },
  { x0: 2000, x1: 2750, y0: 1250, y1: 1470, z0: 12500, z1: 13250, tag: 'frost' },
  { x0: -2500, x1: -1800, y0: 1750, y1: 1960, z0: 14900, z1: 15600, tag: 'frost' },
  { x0: 1900, x1: 2600, y0: 2300, y1: 2520, z0: 17500, z1: 18200, tag: 'summit' },
];

/** Game rules for a climb: coins, falls (big drops + respawns), the summit goal. Call update() once per tick. */
export class ClimbRun {
  constructor(course = COURSE) {
    this.course = course;
    this.world = new BoxWorld({ groundY: course.voidY, boxes: course.boxes });
    this.coins = course.coins.map(([x, y, z]) => ({ x, y, z, taken: false }));
    this.coinCount = 0; this.falls = 0; this.ticks = 0; this.won = false;
    this.bestY = course.start.y;         // best grounded height this attempt (for HUD + fall detection)
    this._armed = true;                  // fall detector latch
    this._wasAir = false;
    this.events = [];
  }
  update(hero) {
    const c = this.course, p = hero.pos;
    this.events.length = 0;
    if (this.won) return false;
    if (this.ticks > 0 || hero.action !== 'idle') this.ticks++;
    for (const coin of this.coins) {
      if (coin.taken) continue;
      const dx = coin.x - p[0], dy = coin.y - (p[1] + 80), dz = coin.z - p[2];
      if (dx * dx + dz * dz < 110 * 110 && Math.abs(dy) < 130) { coin.taken = true; this.coinCount++; this.events.push('coin'); }
    }
    // fall bookkeeping: a "fall" = landing 400+ below your best grounded height, or a respawn
    if (hero.airborne) this._wasAir = true;
    else {
      if (this._wasAir) {
        if (this._armed && p[1] < this.bestY - 400) { this.falls++; this.events.push('fall'); this._armed = false; }
        this._wasAir = false;
      }
      if (p[1] > this.bestY) this.bestY = p[1];
      if (p[1] > this.bestY - 150) this._armed = true;
    }
    const g = c.goal;
    if (!hero.airborne && Math.abs(p[1] - g.y) < 5 && Math.hypot(p[0] - g.x, p[2] - g.z) < g.radius) {
      this.won = true; this.events.push('win');
    }
    if (p[1] < c.killY) { this.respawn(hero); this.falls++; this.events.push('fall'); this.events.push('respawn'); return true; }
    return false;
  }
  respawn(hero) {
    const s = this.course.start;
    hero.pos[0] = s.x; hero.pos[1] = s.y; hero.pos[2] = s.z;
    hero.vel[0] = hero.vel[1] = hero.vel[2] = 0; hero.fvel = 0; hero.yaw = s.yaw;
    hero.floorY = s.y; hero.action = 'idle'; hero.prevAction = 'idle'; hero.timer = 0; hero.state = 0;
    this._armed = true; this._wasAir = false;
  }
}

// ================================================================== bot
// A scripted driver that climbs the intended route using every required move, in order.
// Yields one input object per tick; shared by the Node test and the page's ?bot=1 spectate mode.
// Note: the controller reads button *edges*, so chained jumps release A for a tick before pressing.
const stickToward = (m, tx, tz) => { const dx = tx - m.pos[0], dz = tz - m.pos[2], d = Math.hypot(dx, dz) || 1; return { stickX: -dx / d, stickY: dz / d }; };

export function* botDrive(m, run) {
  const used = run ? (run.movesUsed = run.movesUsed || new Set()) : new Set();
  function* runTo(z, max = 300) { for (let i = 0; i < max && m.pos[2] < z; i++) { used.add(m.action); yield { ...stickToward(m, 0, z + 600) }; } }
  function* climbOut() { // if a jump ends in a ledge grab, climb up and settle
    yield {};
    yield { a: true };
    for (let i = 0; i < 60 && m.action !== 'idle' && m.action !== 'walk'; i++) yield {};
  }
  function* jumpOver(landZ, max = 90) {
    for (let i = 0; i < 30 && (m.airborne || m.action.startsWith('land')); i++) yield { stickY: 1 }; // settle first
    const steer = () => ({ stickY: m.pos[2] < landZ - 120 ? 1 : -1 }); // full speed until over the platform, then brake
    yield { stickY: 1 };
    yield { stickY: 1, a: true };
    for (let i = 0; i < max && m.airborne; i++) { used.add(m.action); yield { ...steer(), a: true }; }
    for (let i = 0; i < 40 && m.airborne; i++) { used.add(m.action); yield { ...steer(), a: true }; } // patience: land or grab before deciding
    if (m.action === 'ledgeGrab') { used.add('ledgeGrab'); yield* climbOut(); }
    // burn the chain-jump window so the next leg starts from a plain grounded state
    for (let i = 0; i < 10 && m.action !== 'walk' && m.action !== 'idle'; i++) yield { stickY: 1 };
  }
  function* press() { yield { stickY: 1 }; yield { stickY: 1, a: true }; } // release, then press (edge)
  function* tripleChain() {
    for (let i = 0; i < 240 && (m.pos[2] <= 3920 || m.airborne || m.action.startsWith('land')); i++) yield { stickY: 1 };
    yield* press(); // plain jump 1 (the previous jumpOver burned the chain window)
    let pressedFor = null;
    for (let i = 0; i < 700; i++) {
      used.add(m.action);
      if (!m.airborne && m.pos[1] > 840) return; // standing on the tower deck
      if ((m.action === 'landJump' || m.action === 'landDouble') && pressedFor !== m.action) {
        pressedFor = m.action;
        yield* press(); // landJump -> double jump, landDouble -> triple jump
        continue;
      }
      if (m.airborne) pressedFor = null;
      yield { stickY: 1, a: m.airborne }; // hold A in the air so the jump isn't cut
    }
  }
  function* grabAndClimb(max = 160) {
    // settle against the wall first: a leftover chain window would turn this into a double jump over the top
    for (let i = 0; i < 40 && (m.doubleJumpTimer > 0 || m.action.startsWith('land')); i++) yield { stickY: 1 };
    yield {};
    yield { stickY: 1, a: true };
    for (let i = 0; i < max && m.action !== 'ledgeGrab' && m.airborne; i++) { used.add(m.action); yield { stickY: 1, a: true }; }
    if (m.action !== 'ledgeGrab') return;
    used.add('ledgeGrab');
    yield {};
    yield { a: true };
    for (let i = 0; i < 60 && m.action !== 'idle'; i++) yield {};
  }
  function* longJump(max = 120) {
    yield { stickY: 1, z: true };
    yield { stickY: 1, z: true };
    yield { stickY: 1, z: true, a: true };
    for (let i = 0; i < max && m.airborne; i++) { used.add(m.action); yield { stickY: 1 }; }
  }
  function* diveGate(max = 220) {
    // Sprint at the gap and dive under the lintel; roll out of the belly slide on landing.
    for (let i = 0; i < max; i++) {
      used.add(m.action);
      if (!m.airborne && m.pos[2] > 14070 && m.fvel >= 29) { yield { stickY: 1, b: true }; break; }
      yield { stickY: 1 };
    }
    let rolled = false;
    for (let i = 0; i < max; i++) {
      used.add(m.action);
      if (m.action === 'bellySlide' && !rolled) { rolled = true; yield { a: true }; continue; }
      if (!m.airborne && m.pos[2] > 14700) return;
      yield { stickY: 1 };
    }
  }
  function* wallKickUp(topY, max = 900) {
    yield { stickY: 1 };
    yield { stickY: 1, a: true };
    let press = false;
    for (let i = 0; i < max; i++) {
      used.add(m.action);
      if (!m.airborne && m.pos[1] >= topY - 1) return;
      if (!m.airborne) { yield { stickY: 1, a: !press }; press = !press; continue; }
      const onWall = m.action === 'airHitWall' || m.action === 'softBonk';
      if (onWall) { yield { a: !press }; press = !press; }
      else { press = false; yield { a: true, stickY: m.vel[1] < 0 && m.pos[1] > topY ? -1 : 0 }; } // brake on the final descent so he lands on the tower top, not past it
    }
  }

  yield* runTo(820); yield* jumpOver(1475);             // M0 -> M1 (running jump)
  yield* runTo(1620); yield* jumpOver(2275);            // -> M2
  yield* runTo(2420); yield* jumpOver(3050);            // -> M3
  yield* runTo(3170); yield* jumpOver(3900);            // -> M4 runway
  yield* tripleChain();                                // -> M5 deck (triple jump, +580)
  yield* runTo(7350); yield* jumpOver(7980);            // -> C1
  yield* runTo(8100); yield* jumpOver(8630);            // -> C2 grab pad
  yield* runTo(8735); yield* grabAndClimb();           // -> C3 (ledge grab, +360)
  yield* runTo(9500); yield* longJump();               // -> F1 (long jump, 1120 gap)
  yield* runTo(11570); yield* jumpOver(12200);          // -> F2
  yield* runTo(12320); yield* jumpOver(12950);          // -> F3
  yield* runTo(13070); yield* jumpOver(13800);          // -> F4
  yield* diveGate();                                   // -> F5 (dive under the lintel)
  yield* runTo(15120); yield* jumpOver(15750);          // -> S1
  yield* runTo(15870); yield* jumpOver(16575);          // -> S2
  yield* runTo(16620); yield* jumpOver(17300);          // -> S3 shaft deck
  yield* runTo(17920); yield* wallKickUp(COURSE.summitY); // -> summit (wall-kick shaft)
  // the final kick can land anywhere on the tower top: walk to the goal ring from wherever that is
  for (let i = 0; i < 240 && !run.won; i++) yield { ...stickToward(m, COURSE.goal.x, COURSE.goal.z) };
}
