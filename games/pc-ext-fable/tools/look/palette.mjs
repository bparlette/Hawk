// palette.mjs — retune the painted ground's colours with named presets, on ANY Palm City build.
// The ground painter (src/ground.js) holds one PAL table (base colour, variation, brush-dab colours per
// surface) plus a handful of hard-coded detail colours (oil, cracks, manholes, wet troughs, glints).
// A preset in palettes.json names new PAL rows and detail-colour swaps; this tool rewrites those exact
// lines, and nothing else. Swaps are keyed from the GAME'S ORIGINAL colours, so every preset applies to an
// untouched build (e.g. the live game); on a build that already wears another preset, revert first.
//
//   node tools/look/palette.mjs list
//   node tools/look/palette.mjs show  [build]                  print the build's current PAL rows
//   node tools/look/palette.mjs apply <preset> [build] [--dry] apply (first apply saves the build's
//                                                               original as preset "original-<build>")
//   node tools/look/palette.mjs apply original-<build> [build] revert
// build = a game folder under games/ (default: this one). Run from any games/<folder>/.
// After applying: ground chunks are painted at runtime, so just reload the page. Then capture with
// tools/look/bar_sheet.sh to judge it against the opening (THE BAR).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAMES = path.resolve(HERE, '../../..');
const PRESETS = path.join(HERE, 'palettes.json');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const dry = process.argv.includes('--dry');
const [cmd, a1, a2] = args;
const load = () => JSON.parse(fs.readFileSync(PRESETS, 'utf8'));
const buildOf = (b) => path.join(GAMES, b || path.basename(path.resolve(HERE, '../..')), 'src', 'ground.js');

function readPal(src) {                                   // { surface: wholeLine }
  const out = {}; const re = /^  ([a-z]+): +\{ base: \[[^\]]+\], +var: \[[^\]]+\], dabs: \[[^\]]+\] \},$/gm;
  let m; while ((m = re.exec(src))) out[m[1]] = m[0];
  return out;
}
const palLine = (k, v) => {                                // the painter's own column alignment: 'var' starts at a fixed column
  const b = `base: [${v.base.join(', ')}],`;
  return `  ${k}:${' '.repeat(Math.max(1, 10 - k.length))}{ ${b}${' '.repeat(Math.max(1, 23 - b.length))}var: [${v.var.join(', ')}], dabs: [${v.dabs.map(d => `'${d}'`).join(', ')}] },`;
};
const parseLine = (line) => {
  const m = line.match(/base: \[([^\]]+)\], +var: \[([^\]]+)\], dabs: \[([^\]]+)\]/);
  return { base: m[1].split(',').map(Number), var: m[2].split(',').map(Number), dabs: m[3].split(',').map(s => s.trim().replace(/'/g, '')) };
};

if (cmd === 'list') {
  for (const [k, v] of Object.entries(load())) console.log(k.padEnd(28), v._doc || '');
} else if (cmd === 'show') {
  const pal = readPal(fs.readFileSync(buildOf(a1), 'utf8'));
  for (const l of Object.values(pal)) console.log(l);
} else if (cmd === 'apply') {
  const presets = load(), P = presets[a1];
  if (!P) { console.error('no preset ' + a1 + ' — try: node tools/look/palette.mjs list'); process.exit(1); }
  const file = buildOf(a2), build = path.basename(path.dirname(path.dirname(file)));
  let src = fs.readFileSync(file, 'utf8');
  const pal = readPal(src);
  const origKey = 'original-' + build;
  if (!presets[origKey] && !a1.startsWith('original-')) {                 // remember how this build looked
    const orig = { _doc: `${build} before its first palette apply (${new Date().toISOString().slice(0, 10)})`, pal: {}, swaps: {} };
    for (const k of Object.keys(P.pal || {})) orig.pal[k] = parseLine(pal[k]);
    for (const [from, to] of Object.entries(P.swaps || {})) orig.swaps[to] = from;
    presets[origKey] = orig;
    if (!dry) fs.writeFileSync(PRESETS, JSON.stringify(presets, null, 1) + '\n');
  }
  let n = 0;
  for (const [k, v] of Object.entries(P.pal || {})) {
    if (!pal[k]) { console.error('surface not in PAL: ' + k); process.exit(1); }
    src = src.replace(pal[k], palLine(k, v)); n++;
  }
  for (const [from, to] of Object.entries(P.swaps || {})) {
    const c = src.split(`'${from}'`).length - 1;
    if (!c) console.warn(`  swap ${from} -> ${to}: not found (already applied?)`);
    src = src.split(`'${from}'`).join(`'${to}'`); n += c;
  }
  // keep the saved original pointing at the colours now in the file: a swap from->to renames the
  // original's key from -> to, so a revert after several presets still restores every detail colour
  const O = presets[origKey];
  if (O && !a1.startsWith('original-')) {
    for (const [from, to] of Object.entries(P.swaps || {})) if (O.swaps[from] !== undefined) { O.swaps[to] = O.swaps[from]; delete O.swaps[from]; }
    if (!dry) fs.writeFileSync(PRESETS, JSON.stringify(presets, null, 1) + '\n');
  }
  if (dry) console.log(`[dry] ${a1} on ${build}: ${n} edits`); else { fs.writeFileSync(file, src); console.log(`applied ${a1} to ${build}/src/ground.js: ${n} edits (revert: apply ${origKey} ${build})`); }
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 14).join('\n'));
}
