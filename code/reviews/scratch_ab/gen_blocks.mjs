const RES = [
  { x0: -136, x1: -76, z0: -36, z1: 36 },{ x0: -136, x1: -76, z0: 46, z1: 106 },{ x0: -32, x1: -8, z0: -104, z1: -80 },{ x0: 70, x1: 94, z0: -70, z1: -46 },
  { x0: 138, x1: 162, z0: -70, z1: -46 },{ x0: -66, x1: -42, z0: 46, z1: 70 },{ x0: -32, x1: 26, z0: 46, z1: 72 },{ x0: 70, x1: 94, z0: 46, z1: 70 },
  { x0: 104, x1: 128, z0: 46, z1: 70 },{ x0: 138, x1: 213, z0: 46, z1: 106 }];
const BLOCKS = []; const cols = []; for (let k = 0; k < 10; k++) cols.push(-134 + k * 34);
for (const zr of [[-70, -46], [-104, -80], [46, 70], [80, 104]]) for (const x of cols) BLOCKS.push({ x0: x, x1: x + 24, z0: zr[0], z1: zr[1] });
for (const zr of [[-36, -6], [4, 36]]) for (const x of [-134, -100]) BLOCKS.push({ x0: x, x1: x + 24, z0: zr[0], z1: zr[1] });
const ovl = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
const GEN = BLOCKS.filter((b) => !RES.some((r) => ovl(r, b)));
const fells = GEN.filter(b=>b.x0 >= 138 && b.z1 < 0);
const ch = new Set(); for (const b of GEN) for (const x of [b.x0,b.x1-0.01]) for (const z of [b.z0,b.z1-0.01]) ch.add(Math.floor(x/64)+','+Math.floor(z/64));
console.log('GEN blocks', GEN.length, 'fells', fells.length, 'chunks touched by GEN', ch.size, 'non-24x24', GEN.filter(b=>b.z1-b.z0!==24).length);
