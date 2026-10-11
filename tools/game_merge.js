// tools/game_merge.js — loads tools/game/04b_rig_merge.js (the game's own file, kept byte-identical) and returns its
// mergeRig(), bound to this page's THREE and the kit's QUAL. Q.has('nomerge') is answered true so the file's tail, which
// rewraps the game's buildHero/buildThug, does nothing here.
import * as THREE from 'three';
export async function loadMergeRig(K) {
  const src = await (await fetch(new URL('./game/04b_rig_merge.js', import.meta.url))).text();
  const f = new Function('THREE', 'QUAL', 'Q', 'buildHero', 'buildThug', src + '\nreturn mergeRig;');
  return f(THREE, K.QUAL, { has: () => true }, null, null);
}
