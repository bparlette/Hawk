// Excerpts from the game (read-only reference)
// src/03c_landmarks_hd_b2.js: set-piece hooks
const LMHOOK = {}; // set-piece interior stubs (phase 5 builds them): LMHOOK.aquarium.tank, LMHOOK.science.imax; also on the LANDMARKS entry as .interior
function lmHook(id, h) { LMHOOK[id] = h; const L = LANDMARKS.find((l) => l.id === id); if (L) L.interior = h; }
  lmHook('aquarium', { stub: true, kind: 'underwater_tank', door: { x: (A.ex0 + A.ex1) / 2, z: A.ez0 - 0.6 }, tank: { x: 17, y: CURB + 1, z: -19.5, w: 10, d: 11, h: 12 } });
  lmHook('science', { stub: true, kind: 'imax_theatre', door: { x: -57, z: M.dz - M.dr - 1.8 }, screen: { x: -46.8, y: CURB + 1, z: 58, w: 8, h: 6, facing: 'west' }, hall: { x0: M.bx0, x1: M.bx1, z0: M.bz0, z1: M.bz1 } });

// The game's LANDMARKS (src/03_city.js): landmark(id, popupName, x, z, radius, boss)
landmark('harborplace', 'HARBORPLACE', -52, -24, 16, { name: 'Dragon Boat Duchess', x: -44, z: -12, water: true });
landmark('constellation', 'USS CONSTELLATION', -31, -18, 17, { name: 'Captain Cobblestone', x: -31, z: -18, y: CURB + 1.75 });
landmark('wtc', 'WORLD TRADE CENTER', -12, -22, 14, { name: 'The Penthouse Pigeon', x: -12, z: -22.5, y: CURB + 63 });
landmark('aquarium', 'NATIONAL AQUARIUM', 19, -17, 19, { name: 'Big Jimmy', x: 19, z: -5, water: true });
landmark('powerplant', 'POWER PLANT', 56, -17, 19, { name: 'Voltage Vic', x: 56, z: -5.5 });
landmark('fourseasons', 'FOUR SEASONS', 82, -58, 20, { name: 'Chef Crabcake', x: 82, z: -42 });
landmark('pendry', 'PENDRY', 126, -25, 17, { name: 'The Pool Shark', x: 126, z: -19.5 });
landmark('fells', 'FELLS POINT', 160, -56, 24, { name: 'Arabber Al', x: 167, z: -58 });
landmark('monument', 'WASHINGTON MONUMENT', -20, -92, 16, { name: 'The Stoop Scrubber', x: -20, z: -84 });
landmark('orioles', 'ORIOLE PARK', -100, 0, 34, { name: 'Bird Brain Bobby', x: -91.5, z: 0 });
landmark('ravens', 'M&T BANK STADIUM', -106, 76, 32, { name: 'The Raven King', x: -106, z: 76 });
landmark('science', 'SCIENCE CENTER', -54, 58, 16, { name: 'Dr. Shellacious', x: -54, z: 41 });
landmark('fedhill', 'FEDERAL HILL', -3, 59, 24, { name: 'The Hon Queen', x: HILL.x, z: HILL.z, y: CURB + HILL.h });
landmark('domino', 'DOMINO SUGARS', 82, 57, 16, { name: 'Sugar Rush', x: 82, z: 57, y: CURB + DOM_H });
landmark('underarmour', 'UNDER ARMOUR', 116, 52, 16, { name: 'The Compression King', x: 116, z: 43 });
landmark('fort', 'FORT MCHENRY', 176, 78, 26, { name: 'Admiral Redclaw', x: 176, z: 80 });
