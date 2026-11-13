// Rigged Juniper GLB hero loader + deterministic AnimationMixer scheduler
// for Lanternport staged scenes. Keeps sim/scene timing untouched while swapping
// the staged hero visual node with tasking's juniper_rig.glb + pose clips.

import { GLTFLoader } from './lib/GLTFLoader.js';

export const HERO_GLB_SCALE = 0.0115;
const STANDING_Y_OFFSET = 84.9 * HERO_GLB_SCALE; // ~0.976 m (soles at y = 0)
const SEATED_Y_OFFSET = 0.55;                     // rests hips cleanly atop 0.62 m rim when o.y = 0.42
const SEATED_Z_OFFSET = 0.0;                      // seat ON the ledge, aligned to the procedural anchor (rimsit.js: z = pd/2 - 0.12). Was 0.16, which pushed her forward over the water (Cherie phone verdict, Nov 13)
const FOUNTAIN_SEATED_Y_OFFSET = 1.02;            // lifts hips atop outer stone fountain coping (o.y = 0.45)
const FOUNTAIN_SEATED_Z_OFFSET = 2.25;            // pushes model out onto the ~3.8m fountain rim from o=(1,1)
const SWIM_Y_OFFSET = 0.46;                       // keeps face and shoulders above pool water plane

export const CLIP_FILES = [
  'idle-stand',
  '07_01',
  '09_01',
  'sit-rim',
  'sit-lookback',
  'dance-cartop',
  'dance-club',
  'swim-surface',
  'fish-cast',
  'dive',
  // <GENERATED_CLIPS_START>
  'pot-rampage',
  'chest-fanfare',
  'sword-pedestal',
  'ocarina-dawn',
  'dawn-shift',
  'festival-roundabout',
  // <GENERATED_CLIPS_END>
];

function compileSegments(segments) {
  return (tick) => {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.untilTick === undefined || tick < seg.untilTick) return seg;
    }
    return segments[segments.length - 1];
  };
}

/** Staged scenes converted to the rigged Juniper GLB and their clip schedules. */
export const HERO_GLB_SCENES = {
  'pool-rimsit': {
    actorId: 'juniper',
    clips: ['sit-rim', 'sit-lookback'],
    schedule: (tick) => {
      if (tick < 240) return { clip: 'sit-rim', loop: true, rate: 1, t0: 0, yOffset: SEATED_Y_OFFSET, zOffset: SEATED_Z_OFFSET };
      if (tick < 810) return { clip: 'sit-lookback', loop: true, rate: 0.55, t0: 240 / 30, yOffset: SEATED_Y_OFFSET, zOffset: SEATED_Z_OFFSET };
      return { clip: 'sit-rim', loop: true, rate: 1, t0: 810 / 30, yOffset: SEATED_Y_OFFSET, zOffset: SEATED_Z_OFFSET };
    },
  },
  'cartop-dance': {
    actorId: 'juniper',
    clips: ['dance-cartop'],
    schedule: () => ({ clip: 'dance-cartop', loop: true, rate: 1, t0: 0, yOffset: STANDING_Y_OFFSET + 0.06 }),
  },
  'club-stage': {
    actorId: 'dancer',
    clips: ['dance-club'],
    stageLight: true,
    schedule: () => ({ clip: 'dance-club', loop: true, rate: 1, t0: 0, yOffset: STANDING_Y_OFFSET }),
  },
  'pool-surface': {
    actorId: 'juniper',
    clips: ['swim-surface'],
    schedule: (tick) => ({
      clip: 'swim-surface',
      loop: true,
      // swim-tread is not authored yet; slow swim-surface gently once pulled to rim hold
      rate: tick < 110 ? 1.0 : 0.55,
      t0: 0,
      yOffset: SWIM_Y_OFFSET,
      zOffset: -1.05,
      rotY: -Math.PI / 2,
    }),
  },
  'dock-fishing': {
    actorId: 'fen',
    clips: ['idle-stand', 'fish-cast'],
    attachRod: true,
    schedule: (tick) => {
      if (tick < 115) return { clip: 'idle-stand', loop: true, rate: 1, t0: 0, yOffset: STANDING_Y_OFFSET };
      return { clip: 'fish-cast', loop: false, rate: 1, t0: 115 / 30, yOffset: STANDING_Y_OFFSET };
    },
  },
  'cucco-swarm': {
    actorId: 'juniper',
    clips: ['idle-stand', '07_01', '09_01', 'sit-rim'],
    schedule: (tick) => {
      if (tick < 90) return { clip: '07_01', loop: true, rate: 1.0, t0: 0, yOffset: STANDING_Y_OFFSET };
      if (tick < 130) return { clip: 'idle-stand', loop: true, rate: 1.0, t0: 90 / 30, yOffset: STANDING_Y_OFFSET };
      if (tick < 760) return { clip: '09_01', loop: true, rate: 1.35, t0: 130 / 30, yOffset: STANDING_Y_OFFSET };
      return { clip: 'sit-rim', loop: true, rate: 1.0, t0: 760 / 30, yOffset: FOUNTAIN_SEATED_Y_OFFSET, zOffset: FOUNTAIN_SEATED_Z_OFFSET };
    },
  },
  'fairy-orbit': {
    actorId: 'juniper',
    clips: ['idle-stand', '07_01'],
    schedule: (tick) => {
      if (tick < 270) return { clip: '07_01', loop: true, rate: 1.0, t0: 0, yOffset: STANDING_Y_OFFSET };
      if (tick < 580) return { clip: 'idle-stand', loop: true, rate: 1.0, t0: 270 / 30, yOffset: STANDING_Y_OFFSET };
      return { clip: '07_01', loop: true, rate: 1.0, t0: 580 / 30, yOffset: STANDING_Y_OFFSET };
    },
  },
  'rooftop-dive': {
    actorId: 'juniper',
    clips: ['idle-stand', '07_01', 'dive', 'swim-surface', 'sit-rim'],
    schedule: (tick) => {
      // DIVE beats (filmscenes.js): hold 0-60, strut 60-180, bounces 200/235, leap 268, splash 300,
      // underwater (actor vis=false hides the GLB hero too) 300-400, surface 400, swim 440-560, rim-sit from 600, end 900.
      if (tick < 60) return { clip: 'idle-stand', loop: true, rate: 1, t0: 0, yOffset: STANDING_Y_OFFSET };
      if (tick < 222) return { clip: '07_01', loop: true, rate: 1, t0: 60 / 30, yOffset: STANDING_Y_OFFSET };
      // 78-tick oneshot: the clip's own crouch-launch-layout arc covers bounce2 + the leap; entry lands on the splash tick (300).
      if (tick < 300) return { clip: 'dive', loop: false, rate: 1, t0: 222 / 30, yOffset: STANDING_Y_OFFSET };
      if (tick < 600) return { clip: 'swim-surface', loop: true, rate: 1, t0: 300 / 30, yOffset: SWIM_Y_OFFSET };
      return { clip: 'sit-rim', loop: true, rate: 1, t0: 600 / 30, yOffset: SEATED_Y_OFFSET, zOffset: SEATED_Z_OFFSET };
    },
  },
  // <GENERATED_SCENES_START>
  'pot-rampage': {
    actorId: 'juniper',
    clips: ['07_01', 'pot-rampage', 'idle-stand'],
    schedule: compileSegments([
      { untilTick: 95, clip: '07_01', loop: true, rate: 1, t0: 0, yOffset: STANDING_Y_OFFSET },
      { untilTick: 170, clip: 'pot-rampage', loop: false, rate: 1, t0: 95 / 30, yOffset: STANDING_Y_OFFSET },
      { untilTick: 260, clip: 'idle-stand', loop: true, rate: 1, t0: 170 / 30, yOffset: STANDING_Y_OFFSET },
      { untilTick: 620, clip: '07_01', loop: true, rate: 1.25, t0: 260 / 30, yOffset: STANDING_Y_OFFSET },
      { untilTick: 780, clip: 'pot-rampage', loop: false, rate: 0.9, t0: 620 / 30, yOffset: STANDING_Y_OFFSET },
      { clip: '07_01', loop: true, rate: 1.15, t0: 780 / 30, yOffset: STANDING_Y_OFFSET },
    ]),
  },
  'chest-fanfare': {
    actorId: 'juniper',
    clips: ['idle-stand', '07_01', 'chest-fanfare'],
    schedule: compileSegments([
      { untilTick: 120, clip: 'idle-stand', loop: true, rate: 1, t0: 0, yOffset: STANDING_Y_OFFSET },
      { untilTick: 260, clip: '07_01', loop: true, rate: 1, t0: 120 / 30, yOffset: STANDING_Y_OFFSET },
      { clip: 'chest-fanfare', loop: false, rate: 1, t0: 260 / 30, yOffset: STANDING_Y_OFFSET },
    ]),
  },
  'sword-pedestal': {
    actorId: 'juniper',
    clips: ['idle-stand', '07_01', 'sword-pedestal'],
    schedule: compileSegments([
      { untilTick: 60, clip: 'idle-stand', loop: true, rate: 1, t0: 0, yOffset: STANDING_Y_OFFSET },
      { untilTick: 195, clip: '07_01', loop: true, rate: 1, t0: 60 / 30, yOffset: STANDING_Y_OFFSET },
      { clip: 'sword-pedestal', loop: false, rate: 0.34, t0: 195 / 30, yOffset: STANDING_Y_OFFSET },
    ]),
  },
  'ocarina-dawn': {
    actorId: 'juniper',
    clips: ['idle-stand', 'ocarina-dawn'],
    schedule: compileSegments([
      { untilTick: 90, clip: 'idle-stand', loop: true, rate: 1, t0: 0, yOffset: STANDING_Y_OFFSET },
      { untilTick: 710, clip: 'ocarina-dawn', loop: false, rate: 0.3, t0: 90 / 30, yOffset: STANDING_Y_OFFSET },
      { clip: 'idle-stand', loop: true, rate: 1, t0: 710 / 30, yOffset: STANDING_Y_OFFSET },
    ]),
  },
  'dawn-shift': {
    actorId: 'juniper',
    clips: ['idle-stand', '07_01', 'dawn-shift'],
    attachDawnProps: true,
    schedule: compileSegments([
      { untilTick: 60, clip: 'idle-stand', loop: true, rate: 1, t0: 0, yOffset: STANDING_Y_OFFSET },
      { untilTick: 200, clip: '07_01', loop: true, rate: 1, t0: 60 / 30, yOffset: STANDING_Y_OFFSET },
      { untilTick: 300, clip: 'dawn-shift', loop: false, rate: 0.45, t0: 200 / 30, yOffset: STANDING_Y_OFFSET },
      { untilTick: 380, clip: '07_01', loop: true, rate: 1, t0: 300 / 30, yOffset: STANDING_Y_OFFSET },
      { clip: 'dawn-shift', loop: false, rate: 0.75, t0: 380 / 30, clipOffset: 60 / 30, yOffset: STANDING_Y_OFFSET },
    ]),
  },
  'festival-roundabout': {
    actorId: 'dancer',
    clips: ['festival-roundabout'],
    schedule: compileSegments([
      { clip: 'festival-roundabout', loop: true, rate: 1, t0: 0, yOffset: STANDING_Y_OFFSET },
    ]),
  },
  // <GENERATED_SCENES_END>
};

export function isHeroGLBTarget(sceneId, actor) {
  const cfg = sceneId ? HERO_GLB_SCENES[sceneId] : null;
  return Boolean(cfg && actor && actor.id === cfg.actorId);
}

let cachedAssetsPromise = null;

function assetURL(rel) {
  return new URL(`./assets/juniper/${rel}`, import.meta.url).href;
}

/** Preloads the rig binary and clip AnimationClips once per page session. */
export function loadHeroGLBAssets() {
  if (cachedAssetsPromise) return cachedAssetsPromise;
  if (typeof fetch !== 'function') {
    cachedAssetsPromise = Promise.reject(new Error('fetch unavailable'));
    return cachedAssetsPromise;
  }
  const loader = new GLTFLoader();
  const base = assetURL('');
  cachedAssetsPromise = (async () => {
    const rigRes = await fetch(assetURL('juniper_rig.glb'));
    if (!rigRes.ok) throw new Error(`Failed loading juniper_rig.glb: ${rigRes.status}`);
    const rigBytes = await rigRes.arrayBuffer();
    const clips = {};
    await Promise.all(CLIP_FILES.map(async (name) => {
      const cg = await loader.loadAsync(assetURL(`clips/${name}.glb`));
      if (!cg.animations || !cg.animations.length) throw new Error(`Clip has no animations: ${name}`);
      clips[name] = cg.animations[0];
    }));
    return { rigBytes, clips, base };
  })();
  // Avoid unhandled rejections when preloaded speculatively in non-browser tests
  cachedAssetsPromise.catch(() => {});
  return cachedAssetsPromise;
}

function makeFishingRod(THREE) {
  // Coordinates are in unscaled Juniper rig space (~87 units = 1 m)
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 1.35, 130, 8),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.75 }),
  );
  pole.rotation.x = Math.PI / 2;
  pole.position.set(0, 0, 62);
  g.add(pole);
  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 85, 5),
    new THREE.MeshBasicMaterial({ color: 0xe2eef6 }),
  );
  line.position.set(0, -42.5, 126);
  g.add(line);
  return g;
}

function buildRigInstance(THREE, assets, cfg) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.parse(assets.rigBytes.slice(0), assets.base, (gltf) => {
      const model = gltf.scene;
      model.scale.setScalar(HERO_GLB_SCALE);
      let boundBones = 0;
      let meshCount = 0;
      model.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          obj.frustumCulled = false;
          meshCount++;
          if (obj.isSkinnedMesh && obj.skeleton) boundBones = Math.max(boundBones, obj.skeleton.bones.length);
        }
      });
      if (cfg.attachRod) {
        const hand = model.getObjectByName('bone_22');
        if (hand) hand.add(makeFishingRod(THREE));
      }
      let dawnCrate = null;
      let dawnCup = null;
      if (cfg.attachDawnProps) {
        const handR = model.getObjectByName('bone_22') || model.getObjectByName('bone_20');
        const chest = model.getObjectByName('bone_11');
        if (chest) {
          dawnCrate = new THREE.Mesh(
            new THREE.BoxGeometry(30, 22, 30),
            new THREE.MeshStandardMaterial({ color: 0xb67d47, roughness: 0.8 }),
          );
          dawnCrate.position.set(-16, 18, 6);
          dawnCrate.castShadow = true;
          chest.add(dawnCrate);
        }
        if (handR) {
          dawnCup = new THREE.Mesh(
            new THREE.CylinderGeometry(4.5, 3.8, 10, 10),
            new THREE.MeshStandardMaterial({ color: 0xf4ead8, roughness: 0.5 }),
          );
          dawnCup.position.set(0, 2, 4);
          dawnCup.visible = false;
          handR.add(dawnCup);
        }
      }
      if (cfg.stageLight) {
        const key = new THREE.PointLight(0xffe9d2, 2.2, 8);
        key.position.set(40, 180, 140);
        model.add(key);
      }
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      for (const name of cfg.clips) {
        const clip = assets.clips[name];
        const act = mixer.clipAction(clip);
        act.enabled = false;
        act.paused = true;
        act.play();
        actions[name] = { act, clip };
      }
      resolve({ model, mixer, actions, boundBones, meshCount, dawnCrate, dawnCup });
    }, reject);
  });
}

function clipTimeForSegment(seg, timeSec, duration) {
  const localT = (seg.clipOffset || 0) + Math.max(0, timeSec - seg.t0) * (seg.rate ?? 1);
  if (seg.loop === false) return Math.min(localT, Math.max(0, duration - 1e-4));
  return duration > 0 ? (localT % duration) : 0;
}

/** Smoothly samples the AnimationMixer deterministically for a given sim tick. */
export function evaluateHeroSchedule(handle, cfg, tick) {
  const timeSec = Math.max(0, tick) / 30;
  const seg = cfg.schedule(tick);
  const fadeDur = 0.25;

  // Detect prior segment just before a transition to blend smoothly during fadeDur
  const prevTick = Math.max(0, tick - fadeDur * 30);
  const prevSeg = tick > 0 ? cfg.schedule(prevTick) : seg;
  let curW = 1;
  let prevW = 0;
  if (prevSeg.clip !== seg.clip) {
    const dt = Math.max(0, timeSec - seg.t0);
    if (dt < fadeDur) {
      const u = dt / fadeDur;
      curW = u * u * (3 - 2 * u);
      prevW = 1 - curW;
    }
  }

  for (const [name, entry] of Object.entries(handle.actions)) {
    const { act, clip } = entry;
    if (name === seg.clip) {
      act.enabled = true;
      act.setEffectiveWeight(curW);
      act.time = clipTimeForSegment(seg, timeSec, clip.duration);
    } else if (prevW > 0 && name === prevSeg.clip) {
      act.enabled = true;
      act.setEffectiveWeight(prevW);
      act.time = clipTimeForSegment(prevSeg, timeSec, clip.duration);
    } else {
      act.enabled = false;
      act.setEffectiveWeight(0);
    }
  }

  const targetY = prevW > 0
    ? prevSeg.yOffset * prevW + seg.yOffset * curW
    : seg.yOffset;
  if (handle.dawnCrate) handle.dawnCrate.visible = tick < 392;
  if (handle.dawnCup) handle.dawnCup.visible = tick >= 424;
  handle.model.position.set(seg.xOffset || 0, targetY, seg.zOffset || 0);
  handle.model.rotation.y = seg.rotY || 0;
  handle.mixer.time = 0;
  handle.mixer.update(0);
  handle.model.updateMatrixWorld(true);
  return { activeClip: seg.clip, blendFrom: prevW > 0 ? prevSeg.clip : null, yOffset: targetY };
}

/**
 * Attaches an async GLB Juniper rig onto an existing StageView actor node while
 * preserving its procedural/sprite children as immediate fallback during load.
 */
export function attachHeroGLB(THREE, node, actor, sceneId, isDisposedFn = () => false) {
  const cfg = sceneId ? HERO_GLB_SCENES[sceneId] : null;
  if (!cfg || !actor || actor.id !== cfg.actorId) return null;

  const fallbackGroup = new THREE.Group();
  while (node.children.length) fallbackGroup.add(node.children[0]);
  node.add(fallbackGroup);

  const fallbackPose = node.userData.pose;
  const state = {
    sceneId,
    actorId: actor.id,
    ready: false,
    error: null,
    activeClip: cfg.clips[0],
    boundBones: 0,
    meshCount: 0,
    handle: null,
    lastTick: 0,
  };

  node.userData.pose = (o, time, tick) => {
    const t = typeof tick === 'number' && Number.isFinite(tick) ? tick : (time * 30);
    state.lastTick = t;
    if (state.ready && state.handle) {
      const res = evaluateHeroSchedule(state.handle, cfg, t);
      state.activeClip = res.activeClip;
      if (typeof globalThis !== 'undefined' && globalThis.__lanternportHeroGLB) {
        globalThis.__lanternportHeroGLB.activeClip = res.activeClip;
      }
      return;
    }
    if (fallbackPose) fallbackPose(o, time, tick);
  };

  const inspect = () => {
    node.updateMatrixWorld(true);
    const box = new THREE.Box3();
    if (state.handle?.model) {
      state.handle.model.traverse((m) => {
        if (m.isSkinnedMesh && m.skeleton) {
          m.skeleton.update();
          const p = m.geometry.attributes.position;
          const v = new THREE.Vector3();
          for (let i = 0; i < p.count; i += 8) {
            v.fromBufferAttribute(p, i);
            m.applyBoneTransform(i, v);
            v.applyMatrix4(m.matrixWorld);
            box.expandByPoint(v);
          }
        }
      });
    }
    const wp = new THREE.Vector3();
    node.getWorldPosition(wp);
    const b2 = state.handle?.model?.getObjectByName('bone_2');
    const b2p = new THREE.Vector3();
    if (b2) b2.getWorldPosition(b2p);
    return {
      sceneId,
      actorId: actor.id,
      tick: state.lastTick,
      ready: state.ready,
      error: state.error,
      activeClip: state.activeClip,
      nodeVis: node.visible,
      fallbackVis: fallbackGroup.visible,
      modelVis: state.handle?.model?.visible ?? null,
      nodeWorld: wp.toArray().map((x) => +x.toFixed(2)),
      modelLocalPos: state.handle?.model?.position.toArray().map((x) => +x.toFixed(2)) ?? null,
      b2World: b2p.toArray().map((x) => +x.toFixed(2)),
      skinnedBox: box.isEmpty() ? null : { min: box.min.toArray().map((x) => +x.toFixed(2)), max: box.max.toArray().map((x) => +x.toFixed(2)) },
    };
  };

  const readyPromise = (async () => {
    try {
      const assets = await loadHeroGLBAssets();
      if (isDisposedFn()) return state;
      const handle = await buildRigInstance(THREE, assets, cfg);
      if (isDisposedFn()) return state;
      state.handle = handle;
      state.boundBones = handle.boundBones;
      state.meshCount = handle.meshCount;
      node.add(handle.model);
      fallbackGroup.visible = false;
      state.ready = true;
      const res = evaluateHeroSchedule(handle, cfg, state.lastTick);
      state.activeClip = res.activeClip;
      if (typeof globalThis !== 'undefined') {
        globalThis.__lanternportHeroGLB = {
          ready: true,
          sceneId: state.sceneId,
          actorId: state.actorId,
          activeClip: state.activeClip,
          boundBones: state.boundBones,
          meshCount: state.meshCount,
          inspect,
        };
      }
      return state;
    } catch (err) {
      state.error = String(err && err.message ? err.message : err);
      return state;
    }
  })();

  if (typeof globalThis !== 'undefined') {
    globalThis.__lanternportHeroGLB = {
      ready: false,
      sceneId: state.sceneId,
      actorId: state.actorId,
      activeClip: state.activeClip,
      boundBones: 0,
      meshCount: 0,
      inspect,
    };
  }

  return { state, readyPromise };
}
