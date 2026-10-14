import { chain, overlapReport, pieceCells } from '../game/track.js';
const L = JSON.parse(process.argv[2]);
const { pieces, end } = chain(L);
console.log('end', JSON.stringify(end), 'overlaps', JSON.stringify(overlapReport(pieces)));
const cells = new Map(); pieces.forEach((p, i) => pieceCells(p).forEach(([x, z, l]) => { const k = x + ',' + z; if (!cells.has(k)) cells.set(k, (i % 36).toString(36)); }));
let xs = [...cells.keys()].map((k) => +k.split(',')[0]), zs = [...cells.keys()].map((k) => +k.split(',')[1]);
for (let z = Math.max(...zs); z >= Math.min(...zs); z--) { let s = ''; for (let x = Math.max(...xs); x >= Math.min(...xs); x--) s += cells.get(x + ',' + z) || '.'; console.log(s, z); }
