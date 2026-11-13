#!/usr/bin/env node
/**
 * Verify animation-only GLB clips against the unmodified M2 player and 07_01.glb
 * 34-track / 127-bone contract.
 *
 * Usage:
 *   node games/lanternport/tools/verify_clip.mjs --all
 *   node games/lanternport/tools/verify_clip.mjs games/lanternport/assets/juniper/clips/pot-rampage.glb [--oneshot]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LANTERNPORT = path.dirname(HERE);
const ASSET_DIR = path.join(LANTERNPORT, 'assets/juniper');
const RIG_GLB = path.join(ASSET_DIR, 'juniper_rig.glb');
const REF_GLB = path.join(ASSET_DIR, 'clips/07_01.glb');
const BONEMAP = JSON.parse(fs.readFileSync(path.join(HERE, 'bonemap.json'), 'utf8'));
const POSE_SPECS_PATH = path.join(HERE, 'pose_specs.json');

const ONESHOT_BUILTINS = new Set(['fish-cast', 'dive']);

const readAB = (p) => {
  const b = fs.readFileSync(p);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

function findPlayerDir(argv) {
  const idx = argv.indexOf('--player');
  const candidates = [
    idx >= 0 ? argv[idx + 1] : null,
    process.env.JUNIPER_PLAYER_DIR,
    '/Users/braidpairlette/tasking/juniper/player',
  ].filter(Boolean);
  const hit = candidates.find((dir) => fs.existsSync(path.join(dir, 'animator.js')));
  if (!hit) {
    throw new Error(`M2 player directory not found (checked: ${candidates.join(', ')})`);
  }
  return hit;
}

function loadLoopMap() {
  if (!fs.existsSync(POSE_SPECS_PATH)) return {};
  const specs = JSON.parse(fs.readFileSync(POSE_SPECS_PATH, 'utf8'));
  const map = {};
  for (const [name, sp] of Object.entries(specs.clips || {})) {
    map[name] = Boolean(sp.loop);
  }
  return map;
}

async function main() {
  const argv = process.argv.slice(2);
  const all = argv.includes('--all');
  const explicitOneshot = argv.includes('--oneshot');
  const kindIdx = argv.indexOf('--kind');
  const kind = kindIdx >= 0 && argv[kindIdx + 1] ? argv[kindIdx + 1] : 'other';
  const playerDir = findPlayerDir(argv);

  const importPlayer = (mod) => import(pathToFileURL(path.join(playerDir, mod)).href);
  const [
    { parseGLB },
    { rigFromGLB, createPose, createWorld, computeWorld, boneIndex },
    { clipFromGLB, bindClip, samplePose },
    { Animator },
    { quatAngle },
    { SIM_DT },
  ] = await Promise.all([
    importPlayer('glb.js'),
    importPlayer('rig.js'),
    importPlayer('clips.js'),
    importPlayer('animator.js'),
    importPlayer('posemath.js'),
    importPlayer('sim.js'),
  ]);

  const HIPS = BONEMAP.bones.Hips.target;
  const L_FOOT = BONEMAP.bones.LeftFoot.target;
  const R_FOOT = BONEMAP.bones.RightFoot.target;

  const rig = rigFromGLB(parseGLB(readAB(RIG_GLB)));
  const refParsed = parseGLB(readAB(REF_GLB));
  const refKeys = new Set(refParsed.animations[0].tracks.map((t) => `${t.bone}.${t.path}`));
  const walkClip = clipFromGLB(refParsed.animations[0], { name: '07_01', kind: 'walk', fps: 30, speed: 120.612 });
  bindClip(rig, walkClip, { positionBones: [HIPS], strict: true });

  const hipsIdx = boneIndex(rig, HIPS);
  const lfIdx = boneIndex(rig, L_FOOT);
  const rfIdx = boneIndex(rig, R_FOOT);

  const loopMap = loadLoopMap();
  let targets = [];
  if (all) {
    const clipDir = path.join(ASSET_DIR, 'clips');
    targets = fs.readdirSync(clipDir)
      .filter((f) => f.endsWith('.glb'))
      .sort()
      .map((f) => path.join(clipDir, f));
  } else {
    targets = argv.filter((a, i) => !a.startsWith('--') && i !== kindIdx + 1 && a !== playerDir);
  }
  if (!targets.length) {
    console.error('Usage: node games/lanternport/tools/verify_clip.mjs [--all | <clip.glb> ...] [--oneshot]');
    process.exit(1);
  }

  let failed = 0;
  for (const clipPath of targets) {
    const base = path.basename(clipPath, '.glb');
    const isOneshot = explicitOneshot || ONESHOT_BUILTINS.has(base) || (base in loopMap && !loopMap[base]);
    try {
      const parsed = parseGLB(readAB(clipPath));
      if (parsed.animations.length !== 1) throw new Error(`expected 1 animation, got ${parsed.animations.length}`);
      if (parsed.meshNodes.length !== 0) throw new Error(`clip must not embed meshes (${parsed.meshNodes.length})`);
      if (parsed.json.skins !== undefined || parsed.json.images !== undefined) throw new Error('clip carries skins or images');

      const anim = parsed.animations[0];
      const clipKeys = new Set(anim.tracks.map((t) => `${t.bone}.${t.path}`));
      const missing = [...refKeys].filter((k) => !clipKeys.has(k));
      const extra = [...clipKeys].filter((k) => !refKeys.has(k));
      if (missing.length || extra.length) {
        throw new Error(`track contract mismatch vs 07_01.glb: missing=[${missing}] extra=[${extra}]`);
      }

      const boundWalk = bindClip(rig, walkClip, { positionBones: [HIPS], strict: true });
      const poseClip = clipFromGLB(anim, { kind, speed: 0 });
      const boundPose = bindClip(rig, poseClip, { positionBones: [HIPS], strict: true });
      if (boundPose.unbound.length !== 0) throw new Error(`unbound tracks: ${boundPose.unbound.join(', ')}`);
      if (boundPose.boundCount !== 34) throw new Error(`expected 34 bound tracks, got ${boundPose.boundCount}`);

      const sampleA = createPose(rig);
      const sampleB = createPose(rig);
      const world = createWorld(rig);
      let minHipY = Infinity, maxHipY = -Infinity, minFootY = Infinity;
      let maxInteriorStep = 0, wrapStep = 0;

      for (let f = 0; f < poseClip.frames; f++) {
        samplePose(boundPose, f / poseClip.frames, sampleA);
        for (let i = 0; i < rig.n; i++) {
          const q = sampleA.rot.subarray(i * 4, i * 4 + 4);
          const norm = Math.hypot(q[0], q[1], q[2], q[3]);
          if (!Number.isFinite(norm) || Math.abs(norm - 1) > 1e-5) {
            throw new Error(`non-unit quaternion at frame ${f} bone ${rig.names[i]}: norm=${norm}`);
          }
        }
        computeWorld(rig, sampleA, world);
        for (let i = 0; i < world.pos.length; i++) {
          if (!Number.isFinite(world.pos[i])) throw new Error(`non-finite world pos at frame ${f}`);
        }
        const hy = world.pos[hipsIdx * 3 + 1];
        const fy = Math.min(world.pos[lfIdx * 3 + 1], world.pos[rfIdx * 3 + 1]);
        minHipY = Math.min(minHipY, hy);
        maxHipY = Math.max(maxHipY, hy);
        minFootY = Math.min(minFootY, fy);

        samplePose(boundPose, ((f + 1) % poseClip.frames) / poseClip.frames, sampleB);
        let stepMax = 0;
        for (let i = 0; i < rig.n; i++) {
          const ang = quatAngle(sampleA.rot, i * 4, sampleB.rot, i * 4);
          if (ang > stepMax) stepMax = ang;
        }
        if (f < poseClip.frames - 1) maxInteriorStep = Math.max(maxInteriorStep, stepMax);
        else wrapStep = stepMax;
      }

      const animCtrl = new Animator(rig, { walk: boundWalk, pose: boundPose }, { initialState: 'walk', locomotionStates: ['walk'] });
      animCtrl.setSpeed(120);
      for (let s = 0; s < 10; s++) animCtrl.step(SIM_DT);
      animCtrl.setState('pose');
      for (let s = 0; s < poseClip.frames + 15; s++) animCtrl.step(SIM_DT);
      for (let i = 0; i < rig.n; i++) {
        const q = animCtrl.pose.rot.subarray(i * 4, i * 4 + 4);
        if (Math.abs(Math.hypot(q[0], q[1], q[2], q[3]) - 1) > 1e-5) throw new Error('animator pose non-unit quat');
      }
      animCtrl.setState('walk');
      for (let s = 0; s < 15; s++) animCtrl.step(SIM_DT);

      const deg = (r) => +(r * 180 / Math.PI).toFixed(2);
      console.log(JSON.stringify({
        file: path.basename(clipPath),
        name: anim.name,
        frames: poseClip.frames,
        fps: poseClip.fps,
        duration_s: +poseClip.period.toFixed(3),
        tracks: anim.tracks.length,
        boundCount: boundPose.boundCount,
        unbound: boundPose.unbound.length,
        oneshot: isOneshot,
        hipY: [+minHipY.toFixed(2), +maxHipY.toFixed(2)],
        minFootY: +minFootY.toFixed(2),
        maxInteriorStep_deg: deg(maxInteriorStep),
        wrapStep_deg: isOneshot ? null : deg(wrapStep),
        animatorOk: true,
      }));
    } catch (err) {
      failed++;
      console.error(JSON.stringify({ file: path.basename(clipPath), error: err.message }));
    }
  }
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
