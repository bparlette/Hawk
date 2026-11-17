// assets.js — loads the Blender-baked sprite manifest and every image it names.
// A missing or undecodable image is a hard error (shown on screen), never a silent substitute.

export async function loadAssets(onProgress) {
  const res = await fetch('../palm-city/assets/manifest.json');
  if (!res.ok) throw new Error('../palm-city/assets/manifest.json failed to load (' + res.status + ')');
  const M = await res.json();
  // destruction stage sprites live in their own manifest so a re-bake of manifest.json never drops them
  const dres = await fetch('../palm-city/assets/destruct.json');
  if (!dres.ok) throw new Error('../palm-city/assets/destruct.json failed to load (' + dres.status + ')');
  M.destruct = await dres.json();
  // the Motel Siege's side-view art (tools/bake_side.py): cutaway, side-view people, Gemini's props
  const sres = await fetch('../palm-city/assets/siege.json');
  if (!sres.ok) throw new Error('../palm-city/assets/siege.json failed to load (' + sres.status + ')');
  M.siege = await sres.json();
  // Sky + Street Pressure sprites (Gemini; tools/import_pressure.mjs): chopper, SWAT van, roadblock props
  const pres = await fetch('../palm-city/assets/pressure.json');
  if (!pres.ok) throw new Error('../palm-city/assets/pressure.json failed to load (' + pres.status + ')');
  M.pressure = await pres.json();
  // Jobs Board sprites (Gemini; tools/import_jobs.mjs): bus + tow truck join the car models, fares the peds
  const jres = await fetch('../palm-city/assets/jobs.json');
  if (!jres.ok) throw new Error('../palm-city/assets/jobs.json failed to load (' + jres.status + ')');
  M.jobs = await jres.json();
  Object.assign(M.cars, M.jobs.cars); Object.assign(M.peds, M.jobs.peds);
  // the SWAT van drives like any other car model (same cell layout as the vans)
  M.cars.swat_van = { angles: 32, cols: 8, kind: 'police', length: 49, width: 20, color: M.pressure.swatVan.color, shadow: M.pressure.swatVan.shadow, light: M.pressure.swatVan.light };
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
    img.src = '../palm-city/assets/' + f;
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
