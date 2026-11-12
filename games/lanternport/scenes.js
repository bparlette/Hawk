// Scene staging for Lanternport: short, deterministic, replayable set-pieces built to be filmed as vertical
// Shorts. A scene is pure logic (no DOM, no three.js) so it is testable headless, like capture.js.
//
// A scene definition:
//   id        unique id, used as ?scene=<id>
//   title     one line, for humans
//   duration  length in sim ticks (30 ticks = 1 second); the page loops the scene when it ends
//   bookmark  the staged camera framing for this scene: { pivot: [x, y, z], yaw, pitch, dist } or a
//             function(game) returning one. Number keys 1-8 jump the freecam to SCENES[n].bookmark.
//   setup     optional (game, bot) => state object, kept for the whole run
//   input     (game, bot, state, tick) => the input object for this tick (same shape the Bot returns)
//   events    [{ at: tick, name } | { when: (game, state) => bool, name }] — fired events are logged
//             with their tick to window.__dbg.scene.events for the external recorder.
//
// Determinism contract: a scene may only use game state and the seeded game RNG (never Math.random,
// never wall-clock time). The same seed must produce the same sim digest at every tick, at any
// timescale — the tests in test/lanternport-scenes.test.mjs prove it for every scene registered here.
import { Bot } from './bot.js';
import { roadAt } from './sim.js';
import { FILM_SCENES } from './filmscenes.js';
import { cuccoSwarm } from './cucco.js';
import { ZELDA_SCENES } from './zelda.js';
import { poolSurface } from './surface.js';
import { poolRimsit } from './rimsit.js';
import { cartopDance } from './cartop.js';
import { clubStage } from './clubstage.js';

export class SceneRunner {
  constructor(game, def) {
    this.g = game; this.def = def; this.bot = new Bot(game);
    this.t = 0; this.fired = []; this._whenFired = new Set();
    this.state = def.setup ? def.setup(game, this.bot) : {};
  }
  /** Call exactly once per sim tick, before game.tick. Returns the input to feed the game. */
  input() {
    for (const [i, e] of (this.def.events || []).entries()) {
      if (e.at !== undefined && e.at === this.t) this.fired.push({ tick: this.t, name: e.name });
      else if (e.when && !this._whenFired.has(i) && e.when(this.g, this.state)) { this._whenFired.add(i); this.fired.push({ tick: this.t, name: e.name }); }
    }
    const inp = this.def.input(this.g, this.bot, this.state, this.t);
    this.t++;
    return inp;
  }
  get done() { return this.t >= this.def.duration; }
}

const distTo = (g, x, z) => { const p = g.hero.ctrl.pos; return Math.hypot(x - p[0], z - p[2]); };

// ---------------------------------------------------------------------------
// stage-test: the framework proof, NOT a film scene. The hero walks the roads
// from the hideout to the plaza fountain and back to the road corner, then
// waits. (Roads, not straight lines: Bot.walk has no collision avoidance, and
// a diagonal across blocks wedges the hero on a building face — route every
// scene along roads and plaza interiors.) It exists so the staging, the event
// log, the bookmark and the loop are all exercised before any real scene is
// written. Real scenes are added below as builders deliver them — see
// SCENES.md for the slate and its status.
const stageTest = {
  id: 'stage-test',
  title: 'Stage test — framework proof (hideout → plaza fountain → road corner)',
  duration: 1500, // 50 s at 30 Hz; the walk ends early and the hero idles at the corner
  bookmark: (g) => ({ pivot: [g.city.fountain.x, 260, g.city.fountain.z], yaw: -2.3, pitch: 0.32, dist: 2400 }),
  input(g, bot, s, t) {
    const f = g.city.fountain;
    if (!s.route) s.route = [[roadAt(1), roadAt(1)], [roadAt(1), roadAt(2)], [roadAt(3), roadAt(2)], [f.x, f.z], [roadAt(3), roadAt(2)]];
    const wp = Math.min(s.wp || 0, s.route.length - 1), [tx, tz] = s.route[wp];
    if (distTo(g, tx, tz) < 500) { if (wp >= s.route.length - 1) return {}; s.wp = wp + 1; }
    const [gx, gz] = s.route[Math.min(s.wp || 0, s.route.length - 1)];
    return bot.walk(gx, gz);
  },
  events: [
    { at: 0, name: 'start' },
    { when: (g) => distTo(g, g.city.fountain.x, g.city.fountain.z) <= 700, name: 'at-fountain' },
    { at: 1499, name: 'end' },
  ],
};

// Registry order = bookmark keys 1-8. The film scenes come first; the framework proof stays last.
export const SCENES = [...FILM_SCENES, cuccoSwarm, stageTest, ...ZELDA_SCENES, poolSurface, poolRimsit, cartopDance, clubStage];

export function sceneById(id) { return SCENES.find((s) => s.id === id) || null; }
