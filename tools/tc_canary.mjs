// tc_canary.mjs <folder> <strings.txt> : check that expected canary strings appear in a delivery.
// Node 18+ ES module, zero deps, read-only, no network, no regex lookbehind.
// Reads one expected string per line from strings.txt (blank lines skipped).
// Recursively searches every .js .md .json .html .txt file under <folder>.
// Prints, per string, `FOUND <string> at file:line` or `MISSING <string>`.
// The strings file is NEVER printed except inside those per-string result lines.
// Exit code: 1 if any string is MISSING, else 0. (2 on bad usage.)

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const [folder, stringsPath] = process.argv.slice(2);
if (!folder || !stringsPath || !existsSync(folder) || !existsSync(stringsPath)) {
  console.error('usage: node tc_canary.mjs <folder> <strings.txt>');
  process.exit(2);
}

const EXTS = new Set(['.js', '.md', '.json', '.html', '.txt']);

// Recursive walk collecting text files (skips node_modules and dot-dirs).
function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name !== 'node_modules' && !name.startsWith('.')) walk(p, out);
    } else if (EXTS.has(extname(name).toLowerCase())) out.push(p);
  }
  return out;
}

// Expected strings: one per line, trailing CR stripped, blanks skipped.
const wanted = readFileSync(stringsPath, 'utf8')
  .split('\n')
  .map((s) => s.replace(/\r$/, ''))
  .filter((s) => s.trim() !== '');

// Load each file once, split into lines.
const files = walk(folder).map((p) => ({
  rel: relative(folder, p),
  lines: readFileSync(p, 'utf8').split(/\r?\n/),
}));

let missing = 0;
for (const s of wanted) {
  let hit = null;
  for (const f of files) {
    const i = f.lines.findIndex((l) => l.includes(s)); // plain substring, no regex
    if (i >= 0) { hit = `${f.rel}:${i + 1}`; break; }
  }
  if (hit) console.log(`FOUND ${s} at ${hit}`);
  else { console.log(`MISSING ${s}`); missing++; }
}
console.log(`\n${wanted.length - missing}/${wanted.length} found.`);
// Exit 1 if any MISSING, else 0.
process.exit(missing > 0 ? 1 : 0);
