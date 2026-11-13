// PITBALL — HYRULE: Level 1 only.
// Geometry, spawn table, escalation and goal are byte-identical in NUMBERS to
// Pitball Verity Level 1 ("FROST SHAFT"); only the scene dressing changed.
// Coordinate space: 540 wide x 960 tall logical px. y 0 = top of pit, y 960 = floor.
export const LEVELS = [
  {
    id: 'hyrule-crater',
    name: 'HYRULE CRATER',
    scene: {
      palette: { bg: '#1d3316', wall: '#6b5136', glow: '#ffd94d', accent: '#f4e9c8' },
      backdrop: 'hyrule-crater',
      props: ['grass-lip', 'vines', 'broken-ruins', 'soft-light'],
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
      pressureMul: 1.5,
    },
    goal: { type: 'survive', target: 240 },
    intro: 'Link drops into the Hyrule Crater — the old stone guardians are waking, and the horde is already marching down the pit.',
  },
];
export default LEVELS;
