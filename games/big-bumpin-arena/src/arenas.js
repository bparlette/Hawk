// Arenas are data. Each one is a different place with its own shape, size, landscape and furniture; none of this
// file touches Matter or the DOM. buildArena() turns a short description into everything the sim and the renderer
// need: the closed wall polygon (with a net pocket behind each goal line), goals, obstacles, pits, sweepers,
// spawn spots, power-up spots and hazard positions. Every arena is symmetric under a half-turn about its centre,
// so neither team gets the better end. All designs are original.
const arc = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
const P = Math.PI;

// `top` = the boundary from the left goal's upper post, over the top, to the right goal's upper post.
// `half` items (obstacles, pits, pads, pylons, item spots) are listed once and mirrored through the centre.
const DEFS = {
  rink: { name: 'THE RINK', blurb: 'Classic boards', theme: 'rink', surface: 'asphalt', w: 1280, h: 908, L: 110, R: 1170, goalHalf: 104,
    top: () => [...arc(240, 170, 130, P, 1.5 * P, 7), ...arc(1040, 170, 130, 1.5 * P, 2 * P, 7)],
    spawns: [['light', 400, -70], ['heavy', 250, 70]], items: [[640, 196], [420, 454]], pads: [[370, 48, 560, 112, 1], [720, 48, 910, 112, 1]], pylons: [[480, 294], [800, 294]] },

  lot: { name: 'LOT 7', blurb: 'Parking lot after closing: telephone poles, parked cars, kerb islands', theme: 'lot', surface: 'asphalt', w: 2100, h: 1300, L: 150, R: 1950, goalHalf: 120,
    top: () => [[150, 300], [330, 60], [1770, 60], [1950, 300]],                          // chamfered corners: jersey barriers
    obstacles: [{ kind: 'pole', x: 640, y: 330, r: 20 }, { kind: 'pole', x: 1460, y: 330, r: 20 },
      { kind: 'car', x: 1050, y: 190, w: 150, h: 76, angle: 0.08 }, { kind: 'island', x: 860, y: 650, w: 70, h: 240, angle: 0 }, { kind: 'bollard', x: 390, y: 420, r: 15 }, { kind: 'cart', x: 1700, y: 200, w: 120, h: 60, angle: -0.5 }],
    spawns: [['light', 560, -90], ['heavy', 360, 90]], items: [[1050, 420], [620, 650]], pads: [[620, 70, 880, 150, 1], [1220, 70, 1480, 150, 1]], pylons: [[820, 400], [1280, 400]] },

  pond: { name: 'FROSTBITE POND', blurb: 'A frozen pond: no straight walls, rocks, and fishing holes you can fall in', theme: 'pond', surface: 'ice', w: 2000, h: 1300, L: 170, R: 1830, goalHalf: 112,
    top: (a) => { const pts = []; for (let i = 1; i < 24; i++) { const t = i / 24, ang = P + t * P, wob = 1 + 0.07 * Math.sin(t * 17) + 0.05 * Math.sin(t * 31 + 1); pts.push([a.cx + Math.cos(ang) * 830 * (0.97 + 0.03 * Math.cos(t * 9)), a.cy + Math.sin(ang) * 560 * wob]); } return pts.filter(([x, y]) => !(Math.abs(y - a.cy) < 150 && (x < 260 || x > 1740))); },
    obstacles: [{ kind: 'rock', x: 700, y: 330, r: 46 }, { kind: 'rock', x: 1210, y: 250, r: 34 }, { kind: 'hut', x: 1000, y: 180, w: 120, h: 90, angle: 0.2 }],
    pits: [{ x: 560, y: 800, r: 50 }, { x: 1000, y: 455, r: 44 }],
    spawns: [['light', 560, -80], ['heavy', 380, 80]], items: [[1000, 330], [760, 650]], pads: [[820, 160, 1010, 230, 1]], pylons: [[820, 520], [1180, 520]] },

  derby: { name: 'DUST BOWL', blurb: 'Six-sided dirt derby with hay bales, tyre stacks and a swinging boom', theme: 'derby', surface: 'dirt', w: 2000, h: 1240, L: 150, R: 1850, goalHalf: 116,
    top: () => [[150, 400], [520, 60], [1480, 60], [1850, 400]],
    obstacles: [{ kind: 'bale', x: 700, y: 260, w: 130, h: 64, angle: 0.5 }, { kind: 'bale', x: 1280, y: 330, w: 130, h: 64, angle: -0.3 }, { kind: 'tires', x: 480, y: 520, r: 34 }, { kind: 'tires', x: 1000, y: 150, r: 30 }],
    sweepers: [{ x: 1000, y: 620, len: 210, speed: 0.022, mirror: false }],
    spawns: [['light', 560, -90], ['heavy', 360, 90]], items: [[1000, 330], [640, 760]], pads: [[620, 70, 860, 150, 1], [1140, 70, 1380, 150, 1]], pylons: [[760, 480], [1240, 480]] },

  pinch: { name: 'THE PINCH', blurb: 'Freight yard hourglass: wide ends, a narrow throat between stacked containers', theme: 'pinch', surface: 'asphalt', w: 2200, h: 1240, L: 150, R: 2050, goalHalf: 116,
    top: () => [[150, 220], [310, 60], [760, 60], [940, 330], [1260, 330], [1440, 60], [1890, 60], [2050, 220]],
    obstacles: [{ kind: 'container', x: 520, y: 330, w: 220, h: 86, angle: 0.5 }, { kind: 'bollard', x: 1100, y: 500, r: 16 }, { kind: 'bollard', x: 800, y: 760, r: 16 }, { kind: 'drum', x: 1560, y: 250, r: 26 }],
    spawns: [['light', 560, -90], ['heavy', 360, 90]], items: [[600, 620], [1100, 430]], pads: [[960, 340, 1240, 410, 1]], pylons: [[700, 520], [1500, 520]] },

  midway: { name: 'THE MIDWAY', blurb: 'Round fairground floor built around a carousel', theme: 'midway', surface: 'asphalt', w: 1900, h: 1400, L: 150, R: 1750, goalHalf: 116,
    top: (a) => arc(a.cx, a.cy, 1, P, 2 * P, 22).slice(1, -1).map(([x, y]) => [a.cx + (x - a.cx) * 800, a.cy + (y - a.cy) * 640]).filter(([x, y]) => !(Math.abs(y - a.cy) < 170 && (x < 230 || x > 1670))),
    obstacles: [{ kind: 'carousel', x: 950, y: 700, r: 130, mirror: false }, { kind: 'bollard', x: 950, y: 440, r: 16 }, { kind: 'bollard', x: 690, y: 700, r: 16 }, { kind: 'booth', x: 560, y: 300, w: 110, h: 80, angle: 0.7 }],
    spawns: [['light', 560, -90], ['heavy', 360, 90]], items: [[950, 250], [520, 880]], pads: [[820, 80, 1080, 150, 1]], pylons: [[640, 480], [1260, 480]] },
};
export const ARENA_ORDER = ['rink', 'lot', 'pond', 'derby', 'pinch', 'midway'];
export const ARENA_INFO = Object.fromEntries(ARENA_ORDER.map((id) => [id, { name: DEFS[id].name, blurb: DEFS[id].blurb, surface: DEFS[id].surface }]));

const cache = {};
export function buildArena(id = 'rink', netDepth = 88) {
  if (cache[id]) return cache[id];
  const d = DEFS[id] || DEFS.rink, a = { id: DEFS[id] ? id : 'rink', name: d.name, theme: d.theme, surface: d.surface, w: d.w, h: d.h, cx: d.w / 2, cy: d.h / 2, L: d.L, R: d.R, goalHalf: d.goalHalf, netDepth };
  const flip = ([x, y]) => [a.w - x, a.h - y], top = d.top(a), y0 = a.cy - a.goalHalf, y1 = a.cy + a.goalHalf;
  // closed loop, clockwise on screen: left upper post -> over the top -> right pocket -> along the bottom -> left pocket
  a.poly = [[a.L, y0], ...top, [a.R, y0], [a.R + netDepth, y0], [a.R + netDepth, y1], [a.R, y1], ...top.map(flip), [a.L, y1], [a.L - netDepth, y1], [a.L - netDepth, y0]];
  a.field = [[a.L, y0], ...top, [a.R, y0], [a.R, y1], ...top.map(flip), [a.L, y1]];                // the playing surface without the pockets
  a.goals = [{ team: 0, x: a.L, y: a.cy, dir: -1, half: a.goalHalf }, { team: 1, x: a.R, y: a.cy, dir: 1, half: a.goalHalf }]; // goals[t] is the one team t defends
  const xs = a.field.map((p) => p[0]), ys = a.field.map((p) => p[1]);
  a.bounds = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  const both = (list, fn) => (list || []).flatMap((o) => (o.mirror === false ? [fn(o, false)] : [fn(o, false), fn(o, true)]));
  a.obstacles = both(d.obstacles, (o, m) => ({ ...o, x: m ? a.w - o.x : o.x, y: m ? a.h - o.y : o.y, angle: (o.angle || 0) + (m ? P : 0) }));
  a.pits = both(d.pits, (o, m) => ({ ...o, x: m ? a.w - o.x : o.x, y: m ? a.h - o.y : o.y }));
  a.sweepers = both(d.sweepers, (o, m) => ({ ...o, x: m ? a.w - o.x : o.x, y: m ? a.h - o.y : o.y, r: 16 }));
  a.spawns = d.spawns.map(([cls, x, dy]) => ({ cls, x, y: dy }));                                     // team 0; y is relative to the centre line
  a.items = (d.items || []).flatMap(([x, y]) => [[x, y], [a.w - x, a.h - y]]);                          // boxes alternate between pair 0 and pair 1
  a.items = [a.items[0], a.items[1], a.items[2], a.items[3]];
  a.pads = (d.pads || []).flatMap(([x0, y0p, x1, y1p, dir]) => [{ x0, y0: y0p, x1, y1: y1p, dir }, { x0: a.w - x1, y0: a.h - y1p, x1: a.w - x0, y1: a.h - y0p, dir: -dir }]);
  a.pylons = (d.pylons || []).flatMap(([x, y]) => [[x, y], [a.w - x, a.h - y]]);
  // circles the bots steer around (and that block a harpoon line)
  a.blockers = [...a.obstacles.map((o) => ({ x: o.x, y: o.y, r: o.r || Math.hypot(o.w, o.h) * 0.42, post: !!o.r })), ...a.pits.map((p) => ({ x: p.x, y: p.y, r: p.r, pit: true })), ...a.sweepers.map((s) => ({ x: s.x, y: s.y, r: s.len * 0.8, soft: true }))];
  return (cache[id] = a);
}
/** Point-in-polygon for the playing surface. */
export function inField(a, x, y) { let c = false; const p = a.field; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; } return c; }
