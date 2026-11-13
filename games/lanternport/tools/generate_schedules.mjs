#!/usr/bin/env node
/**
 * Generate declarative scene schedule wiring in games/lanternport/heroglb.js from
 * games/lanternport/tools/scene_schedules.json. Never modifies existing scenes
 * above the <GENERATED_SCENES_START> marker (such as pool-rimsit or rooftop-dive).
 *
 * Usage:
 *   node games/lanternport/tools/generate_schedules.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LANTERNPORT_DIR = path.dirname(HERE);
const DEFAULT_CONFIG = path.join(HERE, 'scene_schedules.json');
const DEFAULT_TARGET = path.join(LANTERNPORT_DIR, 'heroglb.js');
const CLIPS_DIR = path.join(LANTERNPORT_DIR, 'assets/juniper/clips');

const Y_OFFSETS = new Set([
  'STANDING_Y_OFFSET',
  'SEATED_Y_OFFSET',
  'FOUNTAIN_SEATED_Y_OFFSET',
  'SWIM_Y_OFFSET',
]);

function formatVal(v, isOffset = false) {
  if (typeof v === 'string') {
    if (isOffset && Y_OFFSETS.has(v)) return v;
    return JSON.stringify(v);
  }
  return String(v);
}

function formatSegment(seg) {
  const parts = [];
  if (seg.untilTick !== undefined) parts.push(`untilTick: ${seg.untilTick}`);
  parts.push(`clip: '${seg.clip}'`);
  parts.push(`loop: ${Boolean(seg.loop)}`);
  parts.push(`rate: ${seg.rate ?? 1}`);
  parts.push(`t0: ${(seg.startTick ?? 0) === 0 ? '0' : `${seg.startTick} / 30`}`);
  if (seg.clipOffsetFrames) parts.push(`clipOffset: ${seg.clipOffsetFrames} / 30`);
  parts.push(`yOffset: ${formatVal(seg.yOffset ?? 'STANDING_Y_OFFSET', true)}`);
  if (seg.xOffset) parts.push(`xOffset: ${seg.xOffset}`);
  if (seg.zOffset) parts.push(`zOffset: ${seg.zOffset}`);
  if (seg.rotY) parts.push(`rotY: ${seg.rotY}`);
  return `{ ${parts.join(', ')} }`;
}

function replaceBlock(src, startMarker, endMarker, bodyLines) {
  const startIdx = src.indexOf(startMarker);
  const endIdx = src.indexOf(endMarker);
  if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
    throw new Error(`Missing or invalid markers: ${startMarker} .. ${endMarker}`);
  }
  const lineStart = src.lastIndexOf('\n', startIdx) + 1;
  const endLineStart = src.lastIndexOf('\n', endIdx) + 1;
  const indent = src.slice(lineStart, startIdx).match(/^\s*/)[0];
  const inner = bodyLines.length
    ? bodyLines.map((l) => `${indent}${l}`).join('\n') + '\n'
    : '';
  return src.slice(0, src.indexOf('\n', startIdx) + 1) + inner + src.slice(endLineStart);
}

function validateClip(name) {
  const p = path.join(CLIPS_DIR, `${name}.glb`);
  if (!fs.existsSync(p)) throw new Error(`Referenced clip GLB missing: ${p}`);
  const magic = fs.readFileSync(p).subarray(0, 4).toString('ascii');
  if (magic !== 'glTF') throw new Error(`Clip GLB corrupt (bad magic '${magic}'): ${p}`);
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const cfg = JSON.parse(fs.readFileSync(DEFAULT_CONFIG, 'utf8'));
  const clipsList = cfg.clips || [];
  const scenes = cfg.scenes || {};

  const referencedClips = new Set(clipsList);
  for (const [sceneId, s] of Object.entries(scenes)) {
    if (!s.actorId) throw new Error(`Scene ${sceneId} missing actorId`);
    for (const c of s.clips || []) referencedClips.add(c);
    for (const seg of s.segments || []) referencedClips.add(seg.clip);
  }
  for (const c of referencedClips) validateClip(c);

  const clipLines = clipsList.map((c) => `'${c}',`);
  const sceneLines = [];
  for (const [sceneId, s] of Object.entries(scenes)) {
    sceneLines.push(`'${sceneId}': {`);
    sceneLines.push(`  actorId: '${s.actorId}',`);
    sceneLines.push(`  clips: [${s.clips.map((c) => `'${c}'`).join(', ')}],`);
    if (s.stageLight) sceneLines.push(`  stageLight: true,`);
    if (s.attachRod) sceneLines.push(`  attachRod: true,`);
    if (s.attachDawnProps) sceneLines.push(`  attachDawnProps: true,`);
    sceneLines.push(`  schedule: compileSegments([`);
    for (const seg of s.segments) {
      sceneLines.push(`    ${formatSegment(seg)},`);
    }
    sceneLines.push(`  ]),`);
    sceneLines.push(`},`);
  }

  let src = fs.readFileSync(DEFAULT_TARGET, 'utf8');
  let next = replaceBlock(src, '// <GENERATED_CLIPS_START>', '// <GENERATED_CLIPS_END>', clipLines);
  next = replaceBlock(next, '// <GENERATED_SCENES_START>', '// <GENERATED_SCENES_END>', sceneLines);

  if (checkOnly) {
    if (next !== src) {
      console.error('heroglb.js is out of sync with scene_schedules.json; run generate_schedules.mjs');
      process.exit(1);
    }
    console.log(`OK: heroglb.js matches scene_schedules.json (${Object.keys(scenes).length} generated scenes, ${clipsList.length} generated clips)`);
    return;
  }

  fs.writeFileSync(DEFAULT_TARGET, next, 'utf8');
  console.log(`Updated ${path.relative(process.cwd(), DEFAULT_TARGET)} with ${clipsList.length} clips and ${Object.keys(scenes).length} scenes.`);
}

main();
