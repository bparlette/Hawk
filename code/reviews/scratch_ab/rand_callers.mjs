import { fakeDocument } from './fakedom2.mjs'; globalThis.document = fakeDocument;
const K = (await import('./sonnet_kit.mjs')).K; const SRC = '/workspace/work/reviews/hawk-ab/src/';
const M = {}; for (const f of ['rowkit_tiles', 'rowkit_rowhouse', 'rowkit_corner', 'rowkit_block', 'props_tiles', 'props_street', 'props_crab_shack', 'veh_cars', 'veh_boats', 'veh_carts']) M[f] = await import(SRC + f + '.js');
const tally = {}; const r0 = Math.random; let on = true;
Math.random = () => { if (on) { const s = new Error().stack.split('\n')[2] || ''; const m = /([a-z_]+\.(?:m?js)):/.exec(s); const k = m ? m[1] : s.trim(); tally[k] = (tally[k] || 0) + 1; } return r0(); };
const A = K.makeAtlas(M.rowkit_tiles.KIT_TILES), B = K.makeAtlas(M.props_tiles.PROP_TILES);
const out = K.makeOut(); M.rowkit_block.buildRowBlock(K, out, A, 0, 0, 24, 24, { seed: 3, builders: { buildRowhouse: M.rowkit_rowhouse.buildRowhouse, buildCornerBar: M.rowkit_corner.buildCornerBar, buildCornerShop: M.rowkit_corner.buildCornerShop } }); out.build();
for (const f of [M.veh_boats.buildWaterTaxi, M.veh_boats.buildDragonBoat, M.veh_carts.buildArabberCart, M.veh_cars.buildCarSedan]) f(K, { atlas: B });
console.log(tally);
