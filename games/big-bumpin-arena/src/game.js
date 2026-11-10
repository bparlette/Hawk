// Game (car-league's Game layer): teams, score, clock and the match state machine on top of World.
// The goal choreography is ice-bumpers' (goal -> cars frozen + clock paused -> 2 s celebration -> ball and
// cars back to the face-off spots -> 1 s beat -> play), but counted in sim ticks, never setTimeout, so a
// match is a pure function of (seed, inputs). Last-touch goal attribution is carball.io's rule.
import { CFG, HZ } from './config.js';
import { World } from './world.js';
import { botInput, botKickoff, makeBotMemory } from './bots.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const TEAMS = ['RED', 'BLUE'];

export class Game {
  /** opts: { seed, cfg, seconds, arena, surface, hazards: { pads, pylons, tilt }, teams: [[cls, cls], [cls, cls]], skill: [0..1, 0..1] } */
  constructor(M, opts = {}) {
    this.M = M; this.cfg = opts.cfg || CFG; this.seed = opts.seed ?? 1; this.rand = rng(this.seed);
    this.world = new World(M, this.cfg, { arena: opts.arena, surface: opts.surface, hazards: opts.hazards, rand: rng(this.seed * 31 + 7) });
    this.surface = this.world.surfaceName; this.skill = opts.skill || [0.8, 0.8];
    const A = (this.arena = this.world.arena), cy = A.cy;
    // team 0 (red) defends the left goal; team 1 (blue) is the mirror image. Car 0 is Player 1.
    for (const team of [0, 1]) A.spawns.forEach((s, slot) => {
      const cls = opts.teams ? opts.teams[team][slot] : s.cls;   // the weight-class mix is data: a season ladder just changes it
      const x = team === 0 ? s.x : A.w - s.x, y = team === 0 ? cy + s.y : cy - s.y;
      const car = this.world.addCar(cls, team, x, y, team === 0 ? 0 : Math.PI);
      car.role = slot === 0 ? 'chaser' : 'sweeper'; car.name = `${TEAMS[team]} ${this.world.cars.filter((c) => c.team === team).length}`;
    });
    this.bots = this.world.cars.map(() => makeBotMemory(rng(this.seed * 7919 + this.world.cars.length + Math.floor(this.rand() * 1e6))));
    this.score = [0, 0]; this.ticks = 0; this.clock = (opts.seconds ?? this.cfg.match.seconds) * HZ; this.overtime = false;
    this.state = 'kickoff'; this.timer = this.cfg.match.kickoffTicks; this.winner = null;
    this.lastTouch = [null, null];   // per team: { car, tick }
    this.lastGoal = null;            // { team, scorer, ownGoal, tick }
    this.goals = [];
    this.events = [];                // this tick: hits from the world plus { type:'goal'|'kickoff'|'go'|'over'|'overtime'|'count' }
    this._faceOff();
  }
  get cars() { return this.world.cars; }
  get ball() { return this.world.ball; }
  get stats() { return this.world.stats; }
  /** Seconds left on the clock, rounded up (0 in overtime). */
  get secondsLeft() { return Math.ceil(this.clock / HZ); }

  _faceOff() { this.world.faceOff(); this.lastTouch = [null, null]; this.bots.forEach(botKickoff); }

  /** Advance one tick. humans = { carIndex: { throttle, steer, turbo, brake } }; every other car is a bot. */
  tick(humans = {}) {
    this.events.length = 0; this.ticks++;
    const live = this.state === 'play';
    this.world.live = live; this.world.tiltOn = this.overtime || this.clock <= this.cfg.hazards.tilt.lastTicks;
    const inputs = this.cars.map((c) => (live ? humans[c.index] || botInput(this, c, this.bots[c.index]) : null));
    this.world.step(inputs);
    for (const e of this.world.events) {
      this.events.push(e);
      if ((e.kind === 'ball-car' || e.type === 'hold') && live) { const c = this.cars[e.type === 'hold' ? e.car : e.cars[0]]; this.lastTouch[c.team] = { car: c.index, tick: this.ticks }; }
    }
    if (this.state === 'play') {
      const z = this.world.ballInNet();
      if (z) return this._goal(z.scoringTeam);
      if (!this.overtime && --this.clock <= 0) {
        this.clock = 0;
        if (this.score[0] === this.score[1]) { this.overtime = true; this.events.push({ type: 'overtime' }); }  // golden goal
        else this._finish();
      }
    } else if (this.state === 'kickoff' || this.state === 'faceoff') {
      if (this.timer % HZ === 0 && this.timer > 0) this.events.push({ type: 'count', n: this.timer / HZ });
      if (--this.timer <= 0) { this.state = 'play'; this.events.push({ type: 'go' }); }
    } else if (this.state === 'goal') {
      if (--this.timer <= 0) {
        if (this.overtime) return this._finish();
        this._faceOff(); this.state = 'faceoff'; this.timer = this.cfg.match.faceoffTicks; this.events.push({ type: 'kickoff' });
      }
    }
  }

  // carball.io's attribution: the scoring team's last toucher gets the goal, unless that touch is more than
  // 5 s old (or never happened), in which case it is an own goal by the other team's last toucher.
  _goal(team) {
    const mine = this.lastTouch[team], theirs = this.lastTouch[1 - team], fresh = mine && this.ticks - mine.tick <= this.cfg.match.ownGoalTicks;
    const ownGoal = !fresh && !!theirs, scorer = fresh ? mine.car : theirs ? theirs.car : mine ? mine.car : null;
    this.score[team]++;
    this.lastGoal = { team, scorer, ownGoal, tick: this.ticks, name: scorer === null ? TEAMS[team] : this.cars[scorer].name };
    this.goals.push(this.lastGoal);
    this.state = 'goal'; this.timer = this.cfg.match.celebrateTicks;
    this.events.push({ type: 'goal', ...this.lastGoal });
  }
  _finish() { this.state = 'over'; this.winner = this.score[0] === this.score[1] ? null : this.score[0] > this.score[1] ? 0 : 1; this.events.push({ type: 'over', winner: this.winner }); }

  /** Compact state for determinism checks. */
  digest() {
    const r = (n) => Math.round(n * 1000) / 1000, b = this.ball.body;
    return JSON.stringify([this.ticks, this.score, this.state, r(b.position.x), r(b.position.y), r(this.ball.heat), r(this.ball.curve), ...this.cars.flatMap((c) => [r(c.body.position.x), r(c.body.position.y), r(c.body.angle), r(c.turbo)])]);
  }
}
