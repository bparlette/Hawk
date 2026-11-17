// import_pressure.mjs — copy Gemini's Sky + Street Pressure sprites (shots/pressure-sprites/,
// metrics from its SPRITES.md) into assets/pressure/ and write assets/pressure.json for the game.
// Usage: node tools/import_pressure.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'shots', 'pressure-sprites'), OUT = path.join(ROOT, 'assets', 'pressure');
fs.mkdirSync(OUT, { recursive: true });
const e = (f, w, h, ox, oy, extra = {}) => { fs.copyFileSync(path.join(SRC, f + '.webp'), path.join(OUT, f + '.webp')); return { file: 'pressure/' + f + '.webp', w, h, ox, oy, ...extra }; };
const A32 = { angles: 32, cols: 8 };
const M = {
  chopper: {
    body: e('chopper_body', 96, 96, -48, -48, A32), bodyDusk: e('chopper_body_dusk', 96, 96, -48, -48, A32),
    rotor: e('chopper_rotor', 96, 96, -48, -48), rotorDusk: e('chopper_rotor_dusk', 96, 96, -48, -48),
    shadow: e('chopper_shadow', 128, 128, -64, -64),
  },
  swatVan: {
    color: e('car_swat_van', 64, 64, -32, -32, A32), dusk: e('car_swat_van_dusk', 64, 64, -32, -32, A32),
    shadow: e('car_swat_van_sh', 96, 96, -36.41, -51.11, A32), light: e('car_swat_van_light', 70, 220, -35, -160),
  },
  sawhorse: { color: e('prop_sawhorse', 40, 40, -20, -20), dusk: e('prop_sawhorse_dusk', 40, 40, -20, -20), shadow: e('prop_sawhorse_sh', 52, 52, -26, -26), night: e('prop_sawhorse_night', 48, 48, -24, -24) },
  spikes: { color: e('prop_spike_strip', 48, 24, -24, -12), dusk: e('prop_spike_strip_dusk', 48, 24, -24, -12), shadow: e('prop_spike_strip_sh', 48, 24, -24, -12) },
  lightbar: { phases: e('cruiser_lightbar_phases', 64, 64, -32, -32, { cols: 3 }), phasesDusk: e('cruiser_lightbar_phases_dusk', 64, 64, -32, -32, { cols: 3 }) },
};
fs.writeFileSync(path.join(ROOT, 'assets', 'pressure.json'), JSON.stringify(M, null, 1));
console.log('imported', fs.readdirSync(OUT).length, 'sprites -> assets/pressure.json');
