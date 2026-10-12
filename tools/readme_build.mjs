// tools/readme_build.mjs — writes README_bosses.md: tools/README_bosses.template.md with the measured tables
// (tools/readme_tables.mjs, from tools/results_boss_<id>.json) and the design notes (tools/README_bosses.notes.md) filled in.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const tables = execFileSync(process.execPath, ['tools/readme_tables.mjs'], { encoding: 'utf8' }).trim();
const notes = fs.readFileSync('tools/README_bosses.notes.md', 'utf8').trim();
const t = fs.readFileSync('tools/README_bosses.template.md', 'utf8').replace('<!--TABLES-->', tables).replace('<!--NOTES-->', notes);
fs.writeFileSync('README_bosses.md', t);
console.log('README_bosses.md', t.length, 'bytes; last heading:', t.match(/^## .*/gm).pop());
