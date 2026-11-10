// BIG BUMPIN' ARENA! — every tuning number in one place (car-league's config/ layer; raycast-vehicle's
// "one params object" pattern). Units: pixels, and one sim tick = 1/60 s, so speeds are px per tick.
//
// Donor numbers this starts from (docs/fable-prompts/big-bumpin-donors.md):
//   ice-bumpers   world 1280x908, goal lines at x=110 / x=1170, car:puck mass 6:1, restitution 0.5,
//                 180 s clock, 2 s goal celebration + 1 s beat before cars re-enable, face-off spots.
//   GameKart      grip 0.96 / drift 0.82 (per-frame lateral kill) -> expressed here as decay rates.
//   Wocket-Weague lateral correction 4x normally, 0.6x while drifting; ball damping as the feel knob.
//   rocketball / carball.io   Matter ball numbers: frictionAir 0.01-0.015, restitution 1.0-1.5 (we stay under 1).
//   raycast-vehicle           grip fades back in over 0.35 s after a big load (landingGripTime / Factor 0.4).
export const HZ = 60;
export const CFG = {
  // Arena shapes, sizes, furniture and spot positions live in arenas.js. These are the build constants every arena shares.
  rink: {
    wall: 44,                                       // wall thickness (thick = no tunnelling at ball top speed)
    netDepth: 88,
    postR: 9,
  },
  restitution: { wall: 0.45, car: 0.72, ball: 0.9 },  // Matter uses the larger of a pair
  ball: { r: 38, mass: 1.5, frictionAir: 0.011, maxSpeed: 17, stuckTicks: 150 },
  // Weight classes, data-driven per car. punch = extra shove handed to the ball on contact.
  classes: {
    heavy: { name: 'tractor', len: 88, wid: 66, mass: 12, maxSpeed: 5.5, accel: 0.11, brake: 0.2, turn: 0.05, punch: 0.5, inertia: 2.2 },
    light: { name: 'kart', len: 68, wid: 48, mass: 4, maxSpeed: 7.1, accel: 0.24, brake: 0.3, turn: 0.078, punch: 0.18, inertia: 1.3 },
  },
  car: {
    gripRate: 0.14,        // share of sideways speed removed per tick when gripping
    driftRate: 0.022,      // ...while the handbrake is held
    slipTicks: 21,         // 0.35 s of reduced grip + steering authority after a hard hit (so hits shove and spin)
    slipFactor: 0.3,
    slipImpact: 2.2,       // closing speed that counts as a hard hit
    steerResponse: 0.3,    // how fast yaw rate follows the stick (collisions can still spin the car in between)
    pivot: 0.35,           // steering authority at a standstill (bumper cars can pivot; kfarr's demo could not)
    coast: 0.012,          // rolling drag with no throttle
    reverse: 0.5,          // reverse top speed as a share of forward
    driftTurn: 1.45,
    hardCap: 15,           // nothing moves a car faster than this
  },
  turbo: { speed: 1.5, accel: 1.9, drainTicks: 2.2 * HZ, regenTicks: 9 * HZ, draftBonus: 3, minStart: 0.15,
    draft: { near: 60, far: 260, lateral: 54, minSpeed: 2.4, maxAngle: 0.6 } },
  match: { seconds: 180, kickoffTicks: 3 * HZ, celebrateTicks: 2 * HZ, faceoffTicks: 1 * HZ, ownGoalTicks: 5 * HZ },
  // ---- Prompt 2: tactical layer
  // Surfaces are physics + palette swaps on the same rink. Multipliers on the numbers above.
  surfaces: {
    asphalt: { label: 'ASPHALT', grip: 1, drift: 1, accel: 1, top: 1, coast: 1, ballAir: 1, steer: 1 },
    ice: { label: 'ICE', grip: 0.09, drift: 0.3, accel: 0.55, top: 1, coast: 0.2, ballAir: 0.16, steer: 0.85 },       // sliding puck, drift steering, counter-steer
    dirt: { label: 'DIRT', grip: 1.35, drift: 1.6, accel: 0.9, top: 0.92, coast: 2.4, ballAir: 3.3, steer: 1 },       // the ball dies fast: pass direct, shoot low
  },
  shunt: { speed: 5.2, ticks: 4, cooldown: 42 },                       // a sideways barge of about one car width
  // GameKart triggerSpinOut(): yaw spin + speed cut + input lockout, retuned from 1.2 s to 0.75 s.
  spin: { ticks: 45, rate: 0.28, speedKeep: 0.4, immune: 75, chargeForce: 6.4, flank: 0.87 },
  heat: { step: 0.2, boost: 0.125, capBonus: 0.4, hitGap: 10, freeTicks: 80, decay: 0.006, stopSpeed: 1.6, knock: 9.5, flatTicks: 42, blockForce: 5 },
  curve: { gain: 0.0045, max: 0.032, decay: 0.975, wallKeep: 0.55, minSwipe: 1.2 },
  oneTimer: { window: 90, boost: 1.3, laserTicks: 45 },
  items: {
    period: 20 * HZ, first: 10 * HZ, pickR: 50, pool: ['magnet', 'shock', 'cow', 'oil', 'harpoon'],
    magnet: { ticks: 90, grab: 80, hold: 100, steer: 0.55 },
    shock: { windup: 30, radius: 280, car: 8.5, ball: 13 },
    cow: { ticks: 240, mass: 3, turn: 0.6 },
    oil: { ticks: 8 * HZ, r: 46, arm: 36 },
    harpoon: { range: 470, cone: 1.0, ticks: 150, minRest: 78 },   // tether: snag the ball or an opponent; snaps when a post breaks the line
  },
  hazards: {
    padPush: { car: 0.34, ball: 0.22, top: 1.45 },
    pylons: { r: 33, up: 8 * HZ, down: 8 * HZ, clear: 70 }, // ice-bumpers' pole spots, but they deploy and retract
    tilt: { lastTicks: 60 * HZ, ball: 0.012, car: 0.004 },
  },
};
