import { chain, overlapReport } from '../game/track.js';
const st = (n) => Array(n).fill("straight");
const pre = ["start",...st(3),"ramp","straight","kicker","gap","gap",...st(3),"checkpoint",["bank",1],...st(2),"turn",["turn",1],"straight","rampdown",...st(2),"loop","straight","checkpoint",["turn",1]];
const res = [];
for (let a = 0; a < 8; a++) for (let a2 = 0; a2 < 8; a2++) for (let b = 0; b < 10; b++) for (let c = 0; c < 6; c++) for (const [mi,mid] of [[], ["turn", ["turn",1]], [["turn",1], "turn"]].entries()) {
  const L = [...pre, ...st(a), "kicker","gap","straight", ...st(a2), "checkpoint", ["bank",1], ...st(b), ...mid, ...st(c), ["turn",1]];
  const { pieces, end } = chain(L);
  if (end.gx === 0 && end.gz === 0 && end.dir === 0 && end.L === 0 && overlapReport(pieces).length === 0) res.push([a,a2, b, c, mi, L.length]);
}
console.log(res.length, JSON.stringify(res.slice(0, 30)));
