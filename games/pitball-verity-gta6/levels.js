// PITBALL — VICE: single-level data (Level 1 only).
// Numbers are IDENTICAL to Pitfall Verity Level 1 (FROST SHAFT): same pit
// geometry (540x960 logical space, straight 516-wide shaft, same two
// deflectors), same spawn table, same escalation, same survive-240 goal.
// Only the scene dressing changed: the pit is a Vice beach-street crater.

export const LEVELS = [
  {
    id: 'vice-strip',
    name: 'VICE STRIP',
    scene: {
      palette: { bg: '#2a0e2e', wall: '#43234d', glow: '#ff4fa3', accent: '#2ee6c8' },
      backdrop: 'vice-beach',
      props: ['palm-silhouettes', 'neon-signs', 'ocean-strip', 'lane-markings'],
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
    intro: 'Sunset over Vice Beach — the traffic is coming the wrong way down the strip, and every car on it wants your lane.',
  },
];

export default LEVELS;
