// siege_pick.mjs — wire a Motel Siege interior bake-off pick as the live cutaway sheets (task 7B).
// A filename-level swap: every .webp in shots/siege-interiors-bakeoff/<pick>/ is copied over the
// file of the same name in assets/siege/. Nothing else is touched (siege.json, the character and
// trap sheets, the code), so a later round only has to drop in files with the same names.
//   node tools/siege_pick.mjs after     -> the owner's pick (Gemini's lighting round) goes live
//   node tools/siege_pick.mjs before    -> revert to the originally shipped sheets
//   node tools/siege_pick.mjs status    -> which set each live file currently matches
// Refuses to copy a sheet whose pixel size differs from the live one (the code's geometry is
// pixel-locked to these sheets); a round that changes frame layout needs siege.json updated too.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BAKE = path.join(ROOT, 'shots', 'siege-interiors-bakeoff'), LIVE = path.join(ROOT, 'assets', 'siege');
const pick = process.argv[2];
const sha = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 10);
// pixel size straight from the WebP container (VP8X, VP8L or VP8 chunk)
function size(f) {
  const b = fs.readFileSync(f), tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  throw new Error('not a WebP: ' + f);
}
const list = (d) => fs.readdirSync(path.join(BAKE, d)).filter(f => f.endsWith('.webp')).sort();
if (pick === 'status') {
  for (const f of list('before')) {
    const live = sha(path.join(LIVE, f)), b = sha(path.join(BAKE, 'before', f)), af = path.join(BAKE, 'after', f), a = fs.existsSync(af) ? sha(af) : null;
    console.log(`${f.padEnd(30)} ${live === a ? 'AFTER' : live === b ? (a ? 'BEFORE' : 'before (no after candidate)') : 'neither'}`);
  }
  process.exit(0);
}
if (pick !== 'after' && pick !== 'before') { console.error('usage: node tools/siege_pick.mjs <after|before|status>'); process.exit(2); }
let n = 0;
for (const f of list(pick)) {
  const src = path.join(BAKE, pick, f), dst = path.join(LIVE, f);
  if (!fs.existsSync(dst)) { console.error(`REFUSED ${f}: no live file of that name in assets/siege/`); process.exit(1); }
  const a = size(src), b = size(dst);
  if (a[0] !== b[0] || a[1] !== b[1]) { console.error(`REFUSED ${f}: ${a.join('x')} does not match the live ${b.join('x')}`); process.exit(1); }
  fs.copyFileSync(src, dst); n++;
  console.log(`${f.padEnd(30)} ${a.join('x').padEnd(10)} ${sha(dst)}`);
}
console.log(`${n} sheets live from ${pick}/`);
