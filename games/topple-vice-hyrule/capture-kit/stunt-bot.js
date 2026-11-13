/**
 * Reusable scripted StuntBot driver for automated spectacular gameplay runs.
 * Drives normalized pointer/action inputs via game.applyInput() and logs them to ReplayRecorder.
 */

export const DEFAULT_TOPPLE_SCRIPT = [
  // Strike 1: High-arc smash into upper clay pot tier, perched cuccos & upper Bomb Flower barrel
  { tick: 12, type: 'dragStart', data: { x: 260, y: 420 } },
  { tick: 20, type: 'dragMove', data: { x: 185, y: 445 } },
  { tick: 28, type: 'dragMove', data: { x: 125, y: 472 } },
  { tick: 36, type: 'dragEnd', data: { x: 125, y: 472 } },

  // Strike 2: Mid-tower power shot into central Bomb Flower barrels, Vice sports cars & cuccos -> triggers Cucco Swarm!
  { tick: 122, type: 'dragStart', data: { x: 260, y: 440 } },
  { tick: 130, type: 'dragMove', data: { x: 170, y: 440 } },
  { tick: 138, type: 'dragMove', data: { x: 100, y: 442 } },
  { tick: 146, type: 'dragEnd', data: { x: 100, y: 442 } },

  // Strike 3: Low sweeping wrecking-ball finisher into base crates/cars during peak Cucco Swarm
  { tick: 245, type: 'dragStart', data: { x: 260, y: 430 } },
  { tick: 253, type: 'dragMove', data: { x: 175, y: 398 } },
  { tick: 261, type: 'dragMove', data: { x: 102, y: 372 } },
  { tick: 269, type: 'dragEnd', data: { x: 102, y: 372 } },
];

export class StuntBot {
  /**
   * @param {Object} [options]
   * @param {number} [options.seed=19860221]
   * @param {Array<{tick:number,type:string,data:Object}>} [options.script]
   * @param {number} [options.maxTicks=660]
   * @param {Function} [options.adaptiveHook] Optional callback (game, bot) => void called each tick for dynamic cleanup shots
   */
  constructor({ seed = 19860221, script = DEFAULT_TOPPLE_SCRIPT, maxTicks = 660, adaptiveHook = null } = {}) {
    this.seed = (seed >>> 0) || 1;
    this.script = script.map((ev) => ({ tick: ev.tick | 0, type: ev.type, data: { ...ev.data } }));
    this.maxTicks = maxTicks | 0;
    this.adaptiveHook = adaptiveHook;
    this.cursor = 0;
    this.running = false;
    this.completed = false;
  }

  start(game, recorder = null) {
    this.cursor = 0;
    this.running = true;
    this.completed = false;
    game.reset(this.seed);
    if (recorder) recorder.start(this.seed);
    return this;
  }

  /**
   * Executes one tick of scripted/adaptive inputs, records them, and advances game.stepTick().
   * Returns true while still running, false once finished.
   */
  stepTick(game, recorder = null) {
    if (!this.running) return false;

    while (this.cursor < this.script.length && this.script[this.cursor].tick <= game.tick) {
      const ev = this.script[this.cursor++];
      if (ev.tick === game.tick) {
        game.applyInput(ev.type, ev.data);
        if (recorder) recorder.record(game.tick, ev.type, ev.data);
      }
    }

    if (this.adaptiveHook) {
      this.adaptiveHook(game, this, recorder);
    }

    game.stepTick();

    const doneByFinale = typeof game.isFinaleComplete === 'function' && game.isFinaleComplete();
    if (doneByFinale || game.tick >= this.maxTicks) {
      this.running = false;
      this.completed = true;
      if (recorder && recorder.active) {
        recorder.finish({
          totalTicks: game.tick,
          finalScore: typeof game.getScore === 'function' ? game.getScore() : 0,
          digest: typeof game.getDigest === 'function' ? game.getDigest() : '',
          stats: typeof game.getStats === 'function' ? game.getStats() : {},
        });
      }
      return false;
    }

    return true;
  }

  /** Runs the full bot session synchronously (useful for headless determinism checks). */
  runHeadless(game, recorder = null) {
    this.start(game, recorder);
    while (this.stepTick(game, recorder)) {
      // synchronous step
    }
    return {
      totalTicks: game.tick,
      finalScore: typeof game.getScore === 'function' ? game.getScore() : 0,
      digest: typeof game.getDigest === 'function' ? game.getDigest() : '',
      stats: typeof game.getStats === 'function' ? game.getStats() : {},
      replayLog: recorder ? recorder.lastLog : null,
    };
  }
}
