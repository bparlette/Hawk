/* Node test for pacman-core.js — run: node test.js */
'use strict';
const C = require('./pacman-core.js');
let failures = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log('PASS  ' + label); }
  else { failures++; console.log('FAIL  ' + label + ' — got ' + a + ', want ' + e); }
}
function ok(cond, label) { eq(!!cond, true, label); }

/* --- Maze / pellets --- */
eq(C.MAP.length, 31, 'maze has 31 rows');
ok(C.MAP.every(r => r.length === 28), 'every row is 28 tiles wide');
const p = C.parsePellets();
const dotCount = Object.keys(p.dots).length;
const powCount = Object.keys(p.powers).length;
eq(dotCount, 240, 'exactly 240 small dots');
eq(powCount, 4, 'exactly 4 energizers');
eq(p.total, 244, 'pellet total is 244');
ok(p.powers['1,3'] && p.powers['26,3'] && p.powers['1,23'] && p.powers['26,23'],
   'energizers in the four classic corners (1,3) (26,3) (1,23) (26,23)');
ok(C.isDoor(13, 12) && C.isDoor(14, 12), 'ghost-house door at (13,12)-(14,12)');
ok(!C.isWall(0, 14) && !C.isWall(27, 14), 'tunnel row open at both edges');

/* --- Ghost targeting --- */
const pacR = { tx: 14, ty: 17, dir: 'right' };
eq(C.chaseTarget('blinky', pacR, null, null), { x: 14, y: 17 },
   'Blinky targets Pac-Man tile');
eq(C.chaseTarget('pinky', pacR, null, null), { x: 18, y: 17 },
   'Pinky targets 4 tiles ahead (facing right)');
eq(C.chaseTarget('pinky', { tx: 14, ty: 17, dir: 'up' }, null, null), { x: 10, y: 13 },
   'Pinky up-overflow bug: 4 up AND 4 left');
eq(C.chaseTarget('inky', pacR, null, { tx: 10, ty: 15 }), { x: 22, y: 19 },
   'Inky: pivot (16,17), doubled vector from Blinky (10,15) -> (22,19)');
eq(C.chaseTarget('inky', { tx: 14, ty: 17, dir: 'up' }, null, { tx: 14, ty: 20 }), { x: 10, y: 10 },
   'Inky up-overflow: pivot (12,15), doubled from Blinky (14,20) -> (10,10)');
eq(C.chaseTarget('clyde', pacR, { tx: 14, ty: 26 }, null), { x: 14, y: 17 },
   'Clyde 9 tiles away (>8): targets Pac-Man');
eq(C.chaseTarget('clyde', pacR, { tx: 14, ty: 20 }, null), { x: 0, y: 32 },
   'Clyde 3 tiles away (<=8): retreats to scatter corner');
eq(C.SCATTER.blinky, { x: 25, y: -3 }, 'Blinky scatter corner top-right');
eq(C.SCATTER.clyde, { x: 0, y: 32 }, 'Clyde scatter corner bottom-left');

/* --- Mode schedule 7/20/7/20/5/20/5/forever --- */
eq(C.modeAtTime(0).mode, 'scatter', 't=0 scatter');
eq(C.modeAtTime(6.9).mode, 'scatter', 't=6.9 still scatter');
eq(C.modeAtTime(7).mode, 'chase', 't=7 chase');
eq(C.modeAtTime(26.9).mode, 'chase', 't=26.9 chase');
eq(C.modeAtTime(27).mode, 'scatter', 't=27 scatter (2nd)');
eq(C.modeAtTime(34).mode, 'chase', 't=34 chase (2nd)');
eq(C.modeAtTime(54).mode, 'scatter', 't=54 scatter (3rd)');
eq(C.modeAtTime(59).mode, 'chase', 't=59 chase (3rd)');
eq(C.modeAtTime(79).mode, 'scatter', 't=79 scatter (4th, 5s)');
eq(C.modeAtTime(84).mode, 'chase', 't=84 chase forever');
eq(C.modeAtTime(3600).mode, 'chase', 't=3600 still chase');

/* --- Scoring / fright / fruit tables --- */
eq(C.SCORES.dot, 10, 'dot = 10 pts');
eq(C.SCORES.power, 50, 'energizer = 50 pts');
eq(C.GHOST_CHAIN, [200, 400, 800, 1600], 'ghost chain 200/400/800/1600');
eq(C.frightDuration(1), 6, 'level 1 fright = 6s');
eq(C.frightDuration(2), 5, 'level 2 fright = 5s');
eq(C.frightDuration(11), 0, 'level 11+ fright = 0s');
eq(C.fruitForLevel(1), { name: 'cherry', points: 100 }, 'level 1 fruit: cherry 100');
eq(C.fruitForLevel(2), { name: 'strawberry', points: 300 }, 'level 2 fruit: strawberry 300');
eq(C.fruitForLevel(3), { name: 'orange', points: 500 }, 'level 3 fruit: orange 500');

console.log(failures === 0 ? '\nALL TESTS PASSED' : '\n' + failures + ' TEST(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
