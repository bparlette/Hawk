// Take-control rigged hero (Cherie, Nov 13: "Take control has to be the rigged
// version as well"). When the player takes control inside a converted staged
// scene, the hero they drive is the SAME juniper_rig.glb + clip library as the
// staged performance (heroglb.js) — not the procedural HeroView figure. The
// staged actor and this player rig are two instances of one model/clip set, so
// handing control over never swaps in a different character.
//
// View-layer only: the sim, colliders, controls and camera are untouched. This
// module reads the controlled hero's live movement state (action, forward
// speed, whether she is standing in a stage pool) and picks the clip the
// watch-mode schedules use for the same situation:
//   still            -> idle-stand (or the scene's dance clip in dance scenes)
//   moving           -> 07_01 walk, 09_01 at a run (rate scaled by speed)
//   in a stage pool  -> swim-surface (slowed when barely moving, as staged)
//   SM64 dive move   -> dive (one-shot)
// There is no jump/fall or free-play sit clip in the library, and the movement
// controller has no sit action, so airborne movement keeps the locomotion clip
// and sit-rim stays a watch-mode pose — see REPORT notes in the task handoff.

import {
  CLIP_FILES,
  HERO_GLB_SCENES,
  STANDING_Y_OFFSET,
  SWIM_Y_OFFSET,
  loadHeroGLBAssets,
  buildRigInstance,
} from './heroglb.js';

/** Scenes whose staged performance IS a dance: standing still in them, she dances. */
export const PLAYER_DANCE_CLIPS = {
  'cartop-dance': 'dance-cartop',
  'club-stage': 'dance-club',
  'festival-roundabout': 'festival-roundabout',
};

/** The watch-mode GLB config for a scene, or null when the scene is not converted. */
export function playerRigScene(sceneId) {
  return sceneId ? HERO_GLB_SCENES[sceneId] || null : null;
}

/**
 * Pure clip decision from the controlled hero's live state.
 * sel: { action, speed, swimming, danceClip }
 *   action    — Sm64Controller action string ('idle', 'dive', ...)
 *   speed     — |ctrl.fvel| in sim units (walk tops out around 32)
 *   swimming  — hero is standing in the current stage's pool
 *   danceClip — the scene's dance clip name, or null outside dance scenes
 */
export function pickPlayerClip(sel) {
  if (sel.swimming) {
    return { clip: 'swim-surface', loop: true, rate: sel.speed > 1 ? 1 : 0.55, yOffset: SWIM_Y_OFFSET };
  }
  if (sel.action === 'dive' || sel.action === 'bellySlide') {
    return { clip: 'dive', loop: false, rate: 1, yOffset: STANDING_Y_OFFSET };
  }
  if (sel.speed < 1) {
    if (sel.danceClip) return { clip: sel.danceClip, loop: true, rate: 1, yOffset: STANDING_Y_OFFSET };
    return { clip: 'idle-stand', loop: true, rate: 1, yOffset: STANDING_Y_OFFSET };
  }
  if (sel.speed < 16) {
    return { clip: '07_01', loop: true, rate: Math.min(1.5, Math.max(0.6, sel.speed / 11)), yOffset: STANDING_Y_OFFSET };
  }
  return { clip: '09_01', loop: true, rate: Math.min(1.6, Math.max(0.8, sel.speed / 24)), yOffset: STANDING_Y_OFFSET };
}

const FADE_S = 0.18; // matches the staged scheduler's 0.25 s class of blend, a touch snappier for control

export class PlayerRig {
  constructor(THREE) {
    this.THREE = THREE;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.ready = false;
    this.error = null;
    this.boundBones = 0;
    this.meshCount = 0;
    this.activeClip = null;
    this.handle = null;
    this._cur = null;
    this._prev = null;
    this._fade = 1;
    this._times = {};
    this._yOff = STANDING_Y_OFFSET;
    this._loading = null;
    this._syncGlobal();
  }

  /** Loads the shared rig assets and builds the player instance (idempotent). */
  load() {
    if (this._loading) return this._loading;
    this._loading = (async () => {
      try {
        const assets = await loadHeroGLBAssets();
        const handle = await buildRigInstance(this.THREE, assets, { clips: CLIP_FILES });
        this.handle = handle;
        this.boundBones = handle.boundBones;
        this.meshCount = handle.meshCount;
        this.group.add(handle.model);
        this.ready = true;
        this._syncGlobal();
        return true;
      } catch (err) {
        this.error = String(err && err.message ? err.message : err);
        this._syncGlobal();
        return false;
      }
    })();
    return this._loading;
  }

  _syncGlobal() {
    if (typeof globalThis !== 'undefined') {
      globalThis.__lanternportPlayerRig = {
        ready: this.ready,
        error: this.error,
        boundBones: this.boundBones,
        meshCount: this.meshCount,
        activeClip: this.activeClip,
        visible: this.group.visible,
      };
    }
  }

  setVisible(v) {
    if (this.group.visible !== v) {
      this.group.visible = v;
      this._syncGlobal();
    }
  }

  /**
   * Per render frame. pos = the controlled hero's interpolated feet position in
   * metres (HeroView.position), yawRad = interpolated facing. sel comes from
   * pickPlayerClip. dt is the (timescaled) render dt in seconds.
   */
  update(dt, pos, yawRad, sel) {
    if (!this.ready || !this.handle) return;
    this.group.position.copy(pos);
    this.group.rotation.y = yawRad;
    const { actions, mixer, model } = this.handle;

    if (sel.clip !== this._cur) {
      this._prev = this._cur;
      this._cur = sel.clip;
      this._fade = 0;
      if (!sel.loop) this._times[sel.clip] = 0; // one-shots restart on entry; loops keep their phase
    }
    this._fade = Math.min(1, this._fade + (FADE_S > 0 ? dt / FADE_S : 1));
    const u = this._fade;
    const w = u * u * (3 - 2 * u);

    for (const [name, entry] of Object.entries(actions)) {
      const { act, clip } = entry;
      let weight = 0;
      if (name === this._cur) weight = w;
      else if (name === this._prev) weight = 1 - w;
      if (weight <= 0) {
        act.enabled = false;
        act.setEffectiveWeight(0);
        continue;
      }
      act.enabled = true;
      act.setEffectiveWeight(weight);
      const isCur = name === this._cur;
      const rate = isCur ? sel.rate : 1;
      const loop = isCur ? sel.loop : true;
      const dur = clip.duration;
      let t = (this._times[name] || 0) + dt * rate;
      t = loop ? (dur > 0 ? t % dur : 0) : Math.min(t, Math.max(0, dur - 1e-4));
      this._times[name] = t;
      act.time = t;
    }

    // Ease the vertical offset (standing <-> swim depth) instead of snapping it.
    this._yOff += (sel.yOffset - this._yOff) * Math.min(1, dt * 10);
    model.position.set(0, this._yOff, 0);
    model.rotation.y = 0;
    mixer.time = 0;
    mixer.update(0);
    model.updateMatrixWorld(true);
    this.activeClip = this._cur;
    this._syncGlobal();
  }
}
