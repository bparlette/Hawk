// assets.js — loads the Blender-baked sprite manifest and every image it names.
// A missing or undecodable image is a hard error (shown on screen), never a silent substitute.

export async function loadAssets(onProgress) {
  const res = await fetch('assets/manifest.json');
  if (!res.ok) throw new Error('assets/manifest.json failed to load (' + res.status + ')');
  const M = await res.json();
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
    img.src = 'assets/' + f;
    try { await img.decode(); } catch (e) { throw new Error('sprite failed to decode: assets/' + f); }
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
