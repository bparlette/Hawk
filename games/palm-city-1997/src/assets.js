// assets.js — loads the Blender-baked sprite manifest and every image it names.
// A missing or undecodable image is a hard error (shown on screen), never a silent substitute.
// BAKE-OFF FORK: assets are NOT copied — they are read in place from the
// original game's folder (../palm-city/assets/), so this fork carries no binaries.

const ASSET_BASE = '../palm-city/assets/';

export async function loadAssets(onProgress) {
  const res = await fetch(ASSET_BASE + 'manifest.json');
  if (!res.ok) throw new Error(ASSET_BASE + 'manifest.json failed to load (' + res.status + ')');
  const M = await res.json();
  // destruction stage sprites live in their own manifest so a re-bake of manifest.json never drops them
  const dres = await fetch(ASSET_BASE + 'destruct.json');
  if (!dres.ok) throw new Error(ASSET_BASE + 'destruct.json failed to load (' + dres.status + ')');
  M.destruct = await dres.json();
  const files = new Set();
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (typeof o.file === 'string') files.add(o.file);
    for (const k in o) walk(o[k]);
  };
  walk(M);
  const images = {};
  let done = 0;
  await Promise.all([...files].map(async (f) => {
    const img = new Image();
    img.src = ASSET_BASE + f;
    try { await img.decode(); } catch (e) { throw new Error('sprite failed to decode: ' + ASSET_BASE + f); }
    images[f] = img;
    done++;
    if (onProgress) onProgress(done / files.size);
  }));
  // Attach the image to every entry for direct drawing.
  const attach = (o) => {
    if (!o || typeof o !== 'object') return;
    if (typeof o.file === 'string') o.img = images[o.file];
    for (const k in o) if (k !== 'img') attach(o[k]);
  };
  attach(M);
  return M;
}
