/* Pac-Man core logic — shared by the browser game (window.PacCore)
   and the Node test (module.exports). Exact-replica rules:
   original 28x31 maze, 240 dots + 4 energizers, original ghost
   targeting (including the famous "up" overflow bug), original
   scatter/chase schedule and scoring table. */
(function (exports) {
'use strict';

/* '#' wall, '.' dot, 'o' energizer, '-' ghost-house door,
   ' ' open corridor (no dot). 28 cols x 31 rows. */
var MAP = [
"############################",
"#............##............#",
"#.####.#####.##.#####.####.#",
"#o####.#####.##.#####.####o#",
"#.####.#####.##.#####.####.#",
"#..........................#",
"#.####.##.########.##.####.#",
"#.####.##.########.##.####.#",
"#......##....##....##......#",
"######.##### ## #####.######",
"     #.##### ## #####.#     ",
"     #.##          ##.#     ",
"     #.## ###--### ##.#     ",
"######.## #      # ##.######",
"      .   #      #   .      ",
"######.## #      # ##.######",
"     #.## ######## ##.#     ",
"     #.##          ##.#     ",
"     #.## ######## ##.#     ",
"######.## ######## ##.######",
"#............##............#",
"#.####.#####.##.#####.####.#",
"#.####.#####.##.#####.####.#",
"#o..##.......  .......##..o#",
"###.##.##.########.##.##.###",
"###.##.##.########.##.##.###",
"#......##....##....##......#",
"#.##########.##.##########.#",
"#.##########.##.##########.#",
"#..........................#",
"############################"
];

var COLS = 28, ROWS = 31;

var DIRS = {
  up:    { x: 0, y: -1 },
  left:  { x: -1, y: 0 },
  down:  { x: 0, y: 1 },
  right: { x: 1, y: 0 }
};
/* Original tie-break preference order at intersections. */
var DIR_ORDER = ['up', 'left', 'down', 'right'];

function tileAt(x, y) {
  if (y < 0 || y >= ROWS) return '#';
  if (x < 0 || x >= COLS) return ' '; /* tunnel row leads off-edge */
  return MAP[y].charAt(x);
}
function isWall(x, y) { return tileAt(x, y) === '#'; }
function isDoor(x, y) { return tileAt(x, y) === '-'; }
/* Ghost-house interior (Pac-Man and active ghosts may not enter). */
function isHouse(x, y) { return x >= 11 && x <= 16 && y >= 13 && y <= 15; }

function parsePellets() {
  var dots = {}, powers = {}, total = 0, x, y, c;
  for (y = 0; y < ROWS; y++) {
    for (x = 0; x < COLS; x++) {
      c = MAP[y].charAt(x);
      if (c === '.') { dots[x + ',' + y] = true; total++; }
      else if (c === 'o') { powers[x + ',' + y] = true; total++; }
    }
  }
  return { dots: dots, powers: powers, total: total };
}

/* Scatter (home corner) targets — the originals sit just outside
   the maze bounds. */
var SCATTER = {
  blinky: { x: 25, y: -3 },
  pinky:  { x: 2,  y: -3 },
  inky:   { x: 27, y: 32 },
  clyde:  { x: 0,  y: 32 }
};

/* Chase targets. pac = {tx, ty, dir}; ghost/blinky = {tx, ty}.
   Includes the original overflow bug: facing UP also shifts the
   target left by the same amount. */
function chaseTarget(name, pac, ghost, blinky) {
  var d = DIRS[pac.dir], px, py;
  if (name === 'blinky') {
    return { x: pac.tx, y: pac.ty };
  }
  if (name === 'pinky') {
    px = pac.tx + 4 * d.x; py = pac.ty + 4 * d.y;
    if (pac.dir === 'up') px -= 4;
    return { x: px, y: py };
  }
  if (name === 'inky') {
    px = pac.tx + 2 * d.x; py = pac.ty + 2 * d.y;
    if (pac.dir === 'up') px -= 2;
    return { x: 2 * px - blinky.tx, y: 2 * py - blinky.ty };
  }
  if (name === 'clyde') {
    var dx = ghost.tx - pac.tx, dy = ghost.ty - pac.ty;
    if (Math.sqrt(dx * dx + dy * dy) > 8) return { x: pac.tx, y: pac.ty };
    return { x: SCATTER.clyde.x, y: SCATTER.clyde.y };
  }
  return { x: pac.tx, y: pac.ty };
}

/* Scatter/chase schedule (seconds): 7/20, 7/20, 5/20, 5, then
   chase forever. The clock pauses while frightened. */
var MODE_SCHEDULE = [
  { mode: 'scatter', dur: 7 },
  { mode: 'chase',   dur: 20 },
  { mode: 'scatter', dur: 7 },
  { mode: 'chase',   dur: 20 },
  { mode: 'scatter', dur: 5 },
  { mode: 'chase',   dur: 20 },
  { mode: 'scatter', dur: 5 },
  { mode: 'chase',   dur: Infinity }
];
function modeAtTime(t) {
  var acc = 0, i;
  for (i = 0; i < MODE_SCHEDULE.length; i++) {
    acc += MODE_SCHEDULE[i].dur;
    if (t < acc) return { mode: MODE_SCHEDULE[i].mode, index: i };
  }
  return { mode: 'chase', index: MODE_SCHEDULE.length - 1 };
}

/* Tiles where ghosts may not choose "up" in scatter/chase
   (maze coordinates). */
var NO_UP = { '12,11': true, '15,11': true, '12,23': true, '15,23': true };

/* Frightened duration by level (seconds), levels 1..10, then 0. */
var FRIGHT_TABLE = [6, 5, 4, 4, 3, 3, 2, 2, 1, 1];
function frightDuration(level) {
  if (level < 1) level = 1;
  if (level > FRIGHT_TABLE.length) return 0;
  return FRIGHT_TABLE[level - 1];
}

/* Bonus fruit by level: name + points (original table). */
function fruitForLevel(level) {
  if (level <= 1) return { name: 'cherry', points: 100 };
  if (level === 2) return { name: 'strawberry', points: 300 };
  if (level <= 4) return { name: 'orange', points: 500 };
  if (level <= 6) return { name: 'apple', points: 700 };
  if (level <= 8) return { name: 'melon', points: 1000 };
  if (level <= 10) return { name: 'galboss', points: 2000 };
  if (level <= 12) return { name: 'bell', points: 3000 };
  return { name: 'key', points: 5000 };
}

var GHOST_CHAIN = [200, 400, 800, 1600];
var SCORES = { dot: 10, power: 50 };

exports.MAP = MAP;
exports.COLS = COLS;
exports.ROWS = ROWS;
exports.DIRS = DIRS;
exports.DIR_ORDER = DIR_ORDER;
exports.tileAt = tileAt;
exports.isWall = isWall;
exports.isDoor = isDoor;
exports.isHouse = isHouse;
exports.parsePellets = parsePellets;
exports.SCATTER = SCATTER;
exports.chaseTarget = chaseTarget;
exports.MODE_SCHEDULE = MODE_SCHEDULE;
exports.modeAtTime = modeAtTime;
exports.NO_UP = NO_UP;
exports.frightDuration = frightDuration;
exports.fruitForLevel = fruitForLevel;
exports.GHOST_CHAIN = GHOST_CHAIN;
exports.SCORES = SCORES;
})(typeof module !== 'undefined' && module.exports ? module.exports : (window.PacCore = {}));
