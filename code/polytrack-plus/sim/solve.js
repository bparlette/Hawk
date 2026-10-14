import { chain, overlapReport } from '../game/track.js';
const pre = ["start","straight","straight","ramp","straight","kicker","gap","gap","straight","straight","checkpoint",["bank",1],"straight","rampdown","straight","loop","straight","checkpoint",["turn",1]];
const st = (n) => Array(n).fill("straight");
const res = [];
for (let a = 0; a < 16; a++) for (let b = 0; b < 12; b++) for (let c = 0; c < 6; c++) for (const mid of [[], ["turn", ["turn",1]], [["turn",1], "turn"]]) {
  const L = [...pre, ...st(a), ["bank",1], ...st(b), ...mid, "checkpoint", ...st(c), ["turn",1]];
  const { pieces, end } = chain(L);
  if (end.gx === 0 && end.gz === 0 && end.dir === 0 && end.L === 0 && overlapReport(pieces).length === 0) res.push([a, b, c, mid.length, L.length]);
}
console.log(JSON.stringify(res.slice(0, 20)));
