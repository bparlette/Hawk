// PITBALL VERITY — level data (data only, no engine code).
//
// Coordinate space: 540 wide x 960 tall logical px. y 0 = top of pit, y 960 = floor.
// Hero plays along the floor; orbs fire UP and fall back to be caught.
//
// pit.wallSegments: per side (L/R), contiguous spans covering y 0..960.
//   inset0/inset1 = how far (px) the wall face leans INTO the pit at y0 / y1.
//   Interior width at height y = 540 - insetL(y) - insetR(y) (linear interp in a span).
//   topWidth / bottomWidth are that interior width at y=0 / y=960, kept in sync.
// pit.deflectors: angled bank surfaces. x,y = centre of the deflector;
//   len = length px, angleDeg = tilt from horizontal (-60..60, + tilts down to the right),
//   r = end-cap radius px.
// spawns.table entries turn on at fromSec and stay on; weight = relative pick weight
//   among active entries; hpMul / speedMul scale the enemy type's base stats
//   (base descent: walker 56, runner 118, brute 38, splitter 66 px/s).
// spawns.escalateEverySec: every this many seconds the spawn director tightens
//   (interval shrinks, pressureMul is the level's base pressure vs a 1.1s base interval).

export const LEVELS = [
  {
    id: 'frost-shaft',
    name: 'FROST SHAFT',
    scene: {
      palette: { bg: '#0a2a3d', wall: '#bfe9f5', glow: '#67e8f9', accent: '#e0faff' },
      backdrop: 'frost-cavern',
      props: ['hanging-icicles', 'frost-mist', 'frozen-rubble', 'glowing-core-below'],
    },
    pit: {
      topWidth: 516,
      bottomWidth: 516,
      wallSegments: [
        { side: 'L', y0: 0, y1: 960, inset0: 12, inset1: 12 },
        { side: 'R', y0: 0, y1: 960, inset0: 12, inset1: 12 },
      ],
      deflectors: [
        { x: 150, y: 380, len: 120, angleDeg: -28, r: 10 },
        { x: 390, y: 600, len: 120, angleDeg: 28, r: 10 },
      ],
    },
    spawns: {
      durationSec: 240,
      table: [
        { type: 'walker', fromSec: 0, weight: 10, hpMul: 1.0, speedMul: 1.0 },
        { type: 'runner', fromSec: 45, weight: 4, hpMul: 0.7, speedMul: 1.0 },
        { type: 'splitter', fromSec: 150, weight: 2, hpMul: 0.9, speedMul: 0.95 },
      ],
      escalateEverySec: 30,
      pressureMul: 1.0,
    },
    goal: { type: 'survive', target: 240 },
    intro: 'Verity drops into the Frost Shaft — the core glows far below, and the horde is already thawing.',
  },
  {
    id: 'foundry-bend',
    name: 'THE FOUNDRY BEND',
    scene: {
      palette: { bg: '#1a0b06', wall: '#7a3b26', glow: '#ff7a1a', accent: '#ffd23c' },
      backdrop: 'foundry',
      props: ['lava-channels', 'riveted-steel', 'ember-vents', 'slag-piles'],
    },
    pit: {
      topWidth: 540,
      bottomWidth: 300,
      wallSegments: [
        { side: 'L', y0: 0, y1: 240, inset0: 0, inset1: 0 },
        { side: 'L', y0: 240, y1: 480, inset0: 0, inset1: 110 },
        { side: 'L', y0: 480, y1: 720, inset0: 110, inset1: 110 },
        { side: 'L', y0: 720, y1: 960, inset0: 110, inset1: 120 },
        { side: 'R', y0: 0, y1: 360, inset0: 0, inset1: 0 },
        { side: 'R', y0: 360, y1: 600, inset0: 0, inset1: 110 },
        { side: 'R', y0: 600, y1: 960, inset0: 110, inset1: 120 },
      ],
      deflectors: [
        { x: 215, y: 470, len: 110, angleDeg: -30, r: 12 },
        { x: 325, y: 470, len: 110, angleDeg: 30, r: 12 },
        { x: 270, y: 760, len: 90, angleDeg: -18, r: 10 },
      ],
    },
    spawns: {
      durationSec: 300,
      table: [
        { type: 'walker', fromSec: 0, weight: 10, hpMul: 1.3, speedMul: 1.1 },
        { type: 'brute', fromSec: 20, weight: 3, hpMul: 1.6, speedMul: 0.9 },
        { type: 'runner', fromSec: 60, weight: 5, hpMul: 0.9, speedMul: 1.15 },
        { type: 'splitter', fromSec: 120, weight: 4, hpMul: 1.1, speedMul: 1.1 },
      ],
      escalateEverySec: 25,
      pressureMul: 1.35,
    },
    goal: { type: 'kills', target: 220 },
    intro: 'The pit bends through the Foundry — steel funnels, lava light, and heavier things in the walls.',
  },
  {
    id: 'crown-spire',
    name: 'THE CROWN SPIRE',
    scene: {
      palette: { bg: '#12081f', wall: '#4c2a72', glow: '#a78bfa', accent: '#67e8f9' },
      backdrop: 'spire',
      props: ['divider-fin', 'lightning-arcs', 'rain-streaks', 'storm-coils'],
    },
    pit: {
      topWidth: 340,
      bottomWidth: 380,
      wallSegments: [
        { side: 'L', y0: 0, y1: 480, inset0: 100, inset1: 90 },
        { side: 'L', y0: 480, y1: 960, inset0: 90, inset1: 80 },
        { side: 'R', y0: 0, y1: 480, inset0: 100, inset1: 90 },
        { side: 'R', y0: 480, y1: 960, inset0: 90, inset1: 80 },
      ],
      deflectors: [
        { x: 185, y: 355, len: 105, angleDeg: 40, r: 9 },
        { x: 355, y: 355, len: 105, angleDeg: -40, r: 9 },
        { x: 270, y: 640, len: 120, angleDeg: 25, r: 10 },
      ],
    },
    spawns: {
      durationSec: 330,
      table: [
        { type: 'walker', fromSec: 0, weight: 8, hpMul: 1.8, speedMul: 1.35 },
        { type: 'runner', fromSec: 0, weight: 5, hpMul: 1.2, speedMul: 1.5 },
        { type: 'splitter', fromSec: 40, weight: 5, hpMul: 1.5, speedMul: 1.5 },
        { type: 'brute', fromSec: 60, weight: 4, hpMul: 2.6, speedMul: 1.3 },
      ],
      escalateEverySec: 20,
      pressureMul: 1.8,
    },
    goal: { type: 'survive', target: 330 },
    intro: 'The Crown Spire splits the storm into two lanes — pick a lane, own the merge.',
  },
];

export default LEVELS;
