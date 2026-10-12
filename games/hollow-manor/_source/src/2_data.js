// ---------- world data ----------
// Interior tiles x 1..14, y 2..12. Door gaps: N cols 7-8 rows 0-1, S cols 7-8 row 13, W col 0 rows 6-7, E col 15 rows 6-7.
const FLOORNAME = ['B1', '1F', '2F'];
const NOTE_FOYER = 'A NOTE: "IF THE POWER FAILS, THE BREAKER IS IN THE BASEMENT. THE CELLAR KEY IS IN MY STUDY - UPSTAIRS, WEST WING. -H."';
const NOTE_KITCHEN = 'COOK\'S NOTE: "THE GARDENER BORROWED THE BREAKER HANDLE FOR THE CONSERVATORY VALVE. AGAIN."';
const NOTE_WORK = 'GROUNDSKEEPER: "SPARE FUSES ARE IN THE CRAWLSPACE, PAST THE WINE. DON\'T FEED THE DOG."';
const RD = {
  // ===== ground floor =====
  foyer: { f: 1, gx: 2, gy: 1, n: 'FOYER', sn: 'FOYER', fl: 'marble', wl: 'paper', o: [
    ['window', 2], ['portrait', 5], ['portrait', 10], ['window', 12], ['rug', 5, 5, { w: 6, h: 4, c: 'red' }], ['statue', 3, 5],
    ['clock', 13, 3], ['plant', 2, 10], ['plant', 13, 10], ['frontdoor', 7], ['note', 9, 10, { text: NOTE_FOYER }], ['candle', 4, 2], ['candle', 11, 2]] },
  grand: { f: 1, gx: 2, gy: 0, n: 'GRAND STAIRCASE', sn: 'STAIRS', fl: 'carpet', wl: 'panel', o: [
    ['stairs', 6, 2, { w: 4, h: 3, to: 'landing', dir: 'up' }], ['pillar', 4, 3], ['pillar', 11, 3], ['portrait', 2], ['portrait', 13],
    ['statue', 3, 9], ['statue', 12, 9], ['candle', 2, 11], ['candle', 13, 11]] },
  library: { f: 1, gx: 1, gy: 0, n: 'LIBRARY', sn: 'LIBRRY', fl: 'wood', wl: 'panel', o: [
    ['shelf', 1, 2], ['shelf', 3, 2], ['shelf', 5, 2], ['fireplace', 7], ['shelf', 10, 2], ['shelf', 12, 2], ['rug', 5, 5, { w: 4, h: 4, c: 'green' }],
    ['shelf', 3, 9], ['shelf', 10, 9], ['table', 6, 6], ['chair', 5, 6, { arm: 1 }], ['chair', 8, 7, { arm: 1 }], ['statue', 4, 5], ['statue', 11, 5],
    ['item', 13, 11, { it: 'battery' }], ['candle', 14, 3]] },
  conserv: { f: 1, gx: 0, gy: 0, n: 'CONSERVATORY', sn: 'CONSRV', fl: 'terra', wl: 'green', o: [
    ['window', 2], ['window', 5], ['window', 10], ['window', 12], ['plant', 2, 4, { big: 1 }], ['plant', 5, 4, { big: 1 }], ['plant', 10, 4, { big: 1 }], ['plant', 13, 4, { big: 1 }],
    ['fountain', 7, 6], ['statue', 4, 9], ['sofa', 10, 10, { bench: 1 }], ['table', 2, 8, { pot: 1 }], ['plant', 2, 11, { big: 1 }], ['plant', 13, 11, { big: 1 }],
    ['item', 12, 8, { it: 'handle' }]] },
  music: { f: 1, gx: 0, gy: 1, n: 'MUSIC ROOM', sn: 'MUSIC', fl: 'wood', wl: 'paper2', o: [
    ['rug', 6, 6, { w: 4, h: 3, c: 'red' }], ['piano', 3, 3], ['chair', 4, 5, { bench: 1 }], ['gramo', 11, 3], ['plant', 13, 3], ['sofa', 9, 10], ['chair', 3, 10, { arm: 1 }],
    ['chair', 12, 8, { arm: 1 }], ['item', 2, 7, { it: 'battery' }], ['portrait', 10]] },
  dining: { f: 1, gx: 1, gy: 1, n: 'DINING ROOM', sn: 'DINING', fl: 'carpet', wl: 'paper', o: [
    ['window', 3], ['portrait', 7], ['window', 10], ['longtable', 5, 6], ['chair', 5, 5], ['chair', 7, 5], ['chair', 6, 8, { up: 1 }], ['chair', 8, 8, { up: 1 }],
    ['chair', 4, 6], ['chair', 9, 7], ['dresser', 13, 2], ['candle', 2, 2], ['clock', 13, 11]] },
  kitchen: { f: 1, gx: 1, gy: 2, n: 'KITCHEN', sn: 'KITCHN', fl: 'tile', wl: 'tile', o: [
    ['stove', 2, 2], ['counter', 4, 2], ['counter', 10, 2], ['sink', 12, 2], ['counter', 13, 2, { w1: 1 }], ['table', 5, 8], ['chair', 4, 8], ['chair', 7, 9],
    ['stairs', 11, 9, { w: 2, h: 2, to: 'cstairs', dir: 'down', locked: 'key' }], ['note', 9, 11, { text: NOTE_KITCHEN }], ['barrel', 13, 11], ['crate', 2, 11]] },
  pantry: { f: 1, gx: 0, gy: 2, n: 'PANTRY', sn: 'PANTRY', fl: 'wood', wl: 'plain', o: [
    ['pshelf', 1, 2], ['pshelf', 3, 2], ['pshelf', 5, 2], ['pshelf', 9, 2], ['pshelf', 11, 2], ['pshelf', 13, 2], ['crate', 2, 10], ['crate', 3, 10], ['crate', 2, 11],
    ['barrel', 12, 10], ['barrel', 13, 10], ['sack', 6, 11], ['sack', 5, 11], ['item', 10, 8, { it: 'battery' }]] },
  shall: { f: 1, gx: 2, gy: 2, n: "SERVANTS' HALL", sn: 'SERVNT', fl: 'wood', wl: 'plain', o: [
    ['stairs', 2, 2, { w: 2, h: 2, to: 'squart', dir: 'up' }], ['longtable', 6, 5, { plain: 1 }], ['chair', 6, 4], ['chair', 8, 4], ['chair', 7, 7, { up: 1 }], ['chair', 9, 7, { up: 1 }],
    ['wardrobe', 12, 2], ['item', 11, 11, { it: 'battery' }], ['candle', 13, 11]] },
  mud: { f: 1, gx: 3, gy: 2, n: 'MUDROOM', sn: 'MUDRM', fl: 'stone', wl: 'plank', o: [
    ['window', 3], ['sofa', 2, 3, { bench: 1 }], ['wardrobe', 11, 2], ['crate', 12, 10], ['crate', 13, 10], ['crate', 13, 11], ['barrel', 2, 11]] },
  smoke: { f: 1, gx: 3, gy: 1, n: 'SMOKING ROOM', sn: 'SMOKE', fl: 'carpetG', wl: 'panel', o: [
    ['billiard', 6, 6], ['chair', 3, 10, { arm: 1 }], ['chair', 12, 4, { arm: 1 }], ['sofa', 10, 10], ['shelf', 11, 2], ['plant', 2, 2], ['portrait', 4], ['candle', 14, 11]] },
  parlor: { f: 1, gx: 3, gy: 0, n: 'PARLOR', sn: 'PARLOR', fl: 'wood', wl: 'paper2', o: [
    ['rug', 4, 4, { w: 7, h: 6, c: 'purple' }], ['fireplace', 6], ['portrait', 3], ['portrait', 11], ['sofa', 5, 8], ['chair', 3, 5, { arm: 1 }], ['chair', 10, 5, { arm: 1 }],
    ['table', 8, 5, { small: 1 }], ['clock', 13, 3], ['wardrobe', 12, 10]] },
  // ===== second floor =====
  landing: { f: 2, gx: 2, gy: 1, n: 'UPPER LANDING', sn: 'LANDNG', fl: 'carpet', wl: 'paper', o: [
    ['stairs', 6, 2, { w: 4, h: 2, to: 'grand', dir: 'down' }], ['plant', 2, 3], ['plant', 13, 3], ['statue', 3, 10], ['candle', 12, 11], ['portrait', 3], ['portrait', 12]] },
  gallery: { f: 2, gx: 1, gy: 1, n: 'PORTRAIT GALLERY', sn: 'GALLRY', fl: 'wood', wl: 'green', o: [
    ['portrait', 2], ['portrait', 4], ['portrait', 11], ['portrait', 13], ['rug', 4, 5, { w: 8, h: 2, c: 'red' }], ['statue', 2, 6], ['statue', 12, 9], ['sofa', 6, 9, { bench: 1 }]] },
  master: { f: 2, gx: 1, gy: 0, n: 'MASTER BEDROOM', sn: 'MASTER', fl: 'carpet', wl: 'paper', o: [
    ['window', 4], ['window', 10], ['rug', 6, 5, { w: 4, h: 2, c: 'purple' }], ['bed', 7, 2, { c: 'red' }], ['nightstand', 6, 2], ['nightstand', 9, 2], ['wardrobe', 2, 2],
    ['dresser', 12, 2], ['chair', 11, 9, { arm: 1 }], ['item', 3, 11, { it: 'battery' }]] },
  mbath: { f: 2, gx: 2, gy: 0, n: 'MASTER BATH', sn: 'BATH', fl: 'bath', wl: 'bathtile', o: [
    ['window', 7], ['tub', 10, 2], ['toilet', 3, 2], ['sink', 5, 2], ['dresser', 13, 9, { w1: 1 }], ['rug', 6, 6, { w: 3, h: 2, c: 'blue' }], ['item', 12, 11, { it: 'battery' }]] },
  attic: { f: 2, gx: 3, gy: 0, n: 'ATTIC STAIRS', sn: 'ATTIC', fl: 'wood', wl: 'plank', o: [
    ['atticdoor', 7], ['astairs', 7, 2], ['crate', 2, 3], ['crate', 3, 3], ['crate', 2, 4], ['crate', 12, 3], ['crate', 13, 4], ['chair', 11, 9], ['sheet', 4, 9]] },
  guest: { f: 2, gx: 3, gy: 1, n: 'GUEST BEDROOM', sn: 'GUEST', fl: 'carpet', wl: 'paper2', o: [
    ['window', 4], ['bed', 11, 8, { c: 'blue' }], ['nightstand', 13, 8], ['wardrobe', 2, 2], ['dresser', 11, 2], ['chair', 4, 10, { arm: 1 }]] },
  linen: { f: 2, gx: 2, gy: 2, n: 'LINEN HALL', sn: 'LINEN', fl: 'wood', wl: 'plain', o: [
    ['lshelf', 2, 2], ['lshelf', 4, 2], ['lshelf', 10, 2], ['lshelf', 12, 2], ['wardrobe', 2, 10], ['basket', 10, 10], ['item', 12, 11, { it: 'battery' }]] },
  squart: { f: 2, gx: 3, gy: 2, n: "SERVANTS' QUARTERS", sn: 'QUARTR', fl: 'wood', wl: 'plank', o: [
    ['stairs', 12, 2, { w: 2, h: 2, to: 'shall', dir: 'down' }], ['window', 4], ['bed', 2, 9, { c: 'grey' }], ['bed', 5, 9, { c: 'grey' }], ['crate', 9, 11], ['chair', 9, 4], ['dresser', 2, 2]] },
  nursery: { f: 2, gx: 0, gy: 0, n: 'NURSERY', sn: 'NURSRY', fl: 'wood', wl: 'nursery', o: [
    ['window', 10], ['rug', 4, 6, { w: 5, h: 4, c: 'pink' }], ['crib', 2, 2], ['rocker', 10, 5], ['musicbox', 5, 4], ['toybox', 12, 10], ['horse', 3, 10]] },
  play: { f: 2, gx: 0, gy: 1, n: 'PLAYROOM', sn: 'PLAY', fl: 'carpetB', wl: 'nursery', o: [
    ['toybox', 2, 3], ['horse', 12, 4], ['table', 5, 6, { small: 1 }], ['chair', 4, 6], ['chair', 7, 7], ['dollhouse', 11, 9], ['item', 3, 11, { it: 'battery' }]] },
  sewing: { f: 2, gx: 0, gy: 2, n: 'SEWING ROOM', sn: 'SEWING', fl: 'wood', wl: 'paper', o: [
    ['dummy', 3, 5], ['dummy', 10, 4], ['dummy', 5, 10], ['desk', 11, 9, { sew: 1 }], ['chair', 12, 10], ['dresser', 2, 2], ['wardrobe', 12, 2]] },
  study: { f: 2, gx: 1, gy: 2, n: 'STUDY', sn: 'STUDY', fl: 'wood', wl: 'panel', o: [
    ['rug', 5, 5, { w: 6, h: 4, c: 'red' }], ['shelf', 2, 2], ['shelf', 4, 2], ['shelf', 10, 2], ['shelf', 12, 2], ['portrait', 7, { master: 1 }], ['desk', 7, 6, { item: 'key' }],
    ['chair', 8, 5, { arm: 1 }], ['globe', 12, 9], ['chair', 3, 10, { arm: 1 }], ['candle', 13, 11]] },
  // ===== basement =====
  cstairs: { f: 0, gx: 2, gy: 0, n: 'CELLAR STAIRS', sn: 'CELLAR', fl: 'stone', wl: 'stone', o: [
    ['stairs', 7, 2, { w: 2, h: 2, to: 'kitchen', dir: 'up' }], ['barrel', 2, 3], ['barrel', 13, 3], ['crate', 3, 10], ['crate', 12, 11]] },
  wine: { f: 0, gx: 1, gy: 0, n: 'WINE CELLAR', sn: 'WINE', fl: 'stone', wl: 'brick', o: [
    ['rack', 2, 2], ['rack', 4, 2], ['rack', 10, 2], ['rack', 12, 2], ['rack', 4, 9], ['rack', 10, 9], ['barrel', 6, 11], ['barrel', 9, 11], ['statue', 8, 4]] },
  crawl: { f: 0, gx: 0, gy: 0, n: 'CRAWLSPACE', sn: 'CRAWL', fl: 'dirt', wl: 'dirtwall', o: [
    ['post', 4, 4], ['post', 4, 9], ['post', 10, 4], ['post', 10, 9], ['crate', 12, 3], ['crate', 13, 3], ['crate', 2, 3], ['item', 2, 11, { it: 'fuse' }]] },
  storage: { f: 0, gx: 0, gy: 1, n: 'STORAGE', sn: 'STORE', fl: 'stone', wl: 'stone', o: [
    ['crate', 2, 2], ['crate', 3, 2], ['crate', 2, 3], ['crate', 11, 2], ['crate', 12, 2], ['crate', 13, 3], ['sheet', 5, 8], ['sheet', 10, 9], ['wardrobe', 12, 10], ['item', 3, 11, { it: 'battery' }]] },
  boiler: { f: 0, gx: 1, gy: 1, n: 'BOILER ROOM', sn: 'BOILER', fl: 'stone', wl: 'brick', o: [
    ['boiler', 6, 2], ['barrel', 2, 10], ['barrel', 13, 10], ['crate', 3, 10], ['item', 12, 4, { it: 'battery' }]] },
  laundry: { f: 0, gx: 2, gy: 1, n: 'LAUNDRY', sn: 'LAUNDR', fl: 'tile', wl: 'stone', o: [
    ['washtub', 2, 2], ['washer', 4, 2], ['desk', 11, 2, { iron: 1 }], ['hang', 4, 5], ['hang', 10, 5], ['basket', 12, 10]] },
  workshop: { f: 0, gx: 3, gy: 1, n: 'WORKSHOP', sn: 'WORKSH', fl: 'plank', wl: 'plank', o: [
    ['tools', 4], ['bench', 2, 2], ['bench', 10, 2], ['crate', 2, 10], ['crate', 13, 10], ['note', 11, 3, { text: NOTE_WORK }]] },
  coal: { f: 0, gx: 3, gy: 0, n: 'COAL ROOM', sn: 'COAL', fl: 'dirt', wl: 'brick', o: [
    ['coal', 10, 3], ['crate', 3, 3], ['barrel', 2, 10], ['item', 12, 10, { it: 'battery' }]] },
  cistern: { f: 0, gx: 0, gy: 2, n: 'CISTERN', sn: 'CISTRN', fl: 'stone', wl: 'stone', o: [
    ['pool', 4, 5], ['post', 3, 3], ['post', 10, 3], ['post', 3, 10], ['post', 10, 10]] },
  rootc: { f: 0, gx: 1, gy: 2, n: 'ROOT CELLAR', sn: 'ROOTS', fl: 'dirt', wl: 'dirtwall', o: [
    ['pshelf', 2, 2], ['pshelf', 4, 2], ['pshelf', 10, 2], ['sack', 3, 10], ['sack', 4, 10], ['barrel', 11, 10], ['crate', 12, 10]] },
  breaker: { f: 0, gx: 2, gy: 2, n: 'BREAKER ROOM', sn: 'BREAKR', fl: 'stone', wl: 'stone', o: [
    ['breaker', 7], ['crate', 2, 3], ['crate', 13, 3], ['chair', 7, 8, { up: 1 }], ['barrel', 2, 11], ['barrel', 13, 11]] },
  kennel: { f: 0, gx: 3, gy: 2, n: 'OLD KENNEL', sn: 'KENNEL', fl: 'dirt', wl: 'plank', o: [
    ['doghouse', 11, 3], ['crate', 2, 10], ['sack', 3, 10]] },
};
const EDGES = [
  'foyer-grand', 'foyer-dining', 'foyer-smoke', 'grand-library', 'grand-parlor', 'library-conserv', 'conserv-music', 'music-dining', 'dining-kitchen',
  'kitchen-pantry', 'kitchen-shall', 'shall-mud', 'mud-smoke', 'smoke-parlor',
  'landing-gallery', 'landing-guest', 'landing-linen', 'gallery-master', 'master-mbath', 'master-nursery', 'nursery-play', 'play-sewing', 'sewing-study',
  'guest-attic', 'linen-squart',
  'cstairs-wine', 'cstairs-coal', 'cstairs-laundry', 'wine-crawl', 'crawl-storage', 'storage-boiler', 'storage-cistern', 'cistern-rootc', 'rootc-breaker',
  'boiler-laundry', 'laundry-workshop', 'coal-workshop', 'workshop-kennel', 'kennel-breaker',
];
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const ROOMS = {};
for (const id in RD) { const d = RD[id]; ROOMS[id] = { id, ...d, doors: {}, visited: false, objs: [], built: false, enters: 0 }; }
for (const e of EDGES) {
  const [a, b] = e.split('-'); const A = ROOMS[a], B = ROOMS[b];
  if (!A || !B || A.f !== B.f) throw new Error('bad edge ' + e);
  const dx = B.gx - A.gx, dy = B.gy - A.gy; const d = dx === 1 ? 'E' : dx === -1 ? 'W' : dy === 1 ? 'S' : 'N';
  if (Math.abs(dx) + Math.abs(dy) !== 1) throw new Error('non-adjacent ' + e);
  A.doors[d] = b; B.doors[OPP[d]] = a;
}
// object type table: w,h footprint (tiles), solid, wall (on top wall face), flavour text
const OT = {
  shelf: { w: 2, h: 2, s: 1, t: 'ROWS OF CRUMBLING BOOKS. ONE IS TITLED WITH YOUR NAME.' },
  pshelf: { w: 2, h: 2, s: 1, t: 'JARS OF SOMETHING DARK. BETTER NOT.' },
  lshelf: { w: 2, h: 2, s: 1, t: 'FOLDED SHEETS. ONE STILL HOLDS THE SHAPE OF A BODY.' },
  rack: { w: 2, h: 2, s: 1, t: 'DUSTY BOTTLES. VINTAGE 1898.' },
  table: { w: 2, h: 2, s: 1, t: 'A TABLE. A FINGER HAS WRITTEN "WHO?" IN THE DUST.' },
  longtable: { w: 4, h: 2, s: 1, t: 'SET FOR SEVEN. ONE PLATE HAS BEEN EATEN FROM.' },
  billiard: { w: 4, h: 2, s: 1, t: 'A BILLIARD TABLE. ONE BALL ROLLS SLOWLY, THEN STOPS.' },
  chair: { w: 1, h: 1, s: 1, move: 1, t: 'A CHAIR. THE SEAT IS WARM.' },
  bed: { w: 2, h: 3, s: 1, t: 'THE SHEETS ARE TURNED DOWN. SOMEONE WAS EXPECTED.' },
  wardrobe: { w: 2, h: 2, s: 1, hide: 1, t: 'A WARDROBE. ROOM ENOUGH TO HIDE.' },
  statue: { w: 1, h: 1, s: 1, creep: 1, t: 'COLD MARBLE. WASN\'T IT FACING THE WALL?' },
  dummy: { w: 1, h: 1, s: 1, creep: 1, t: 'A DRESS FORM, BRISTLING WITH PINS.' },
  sheet: { w: 1, h: 1, s: 1, creep: 1, t: 'SOMETHING UNDER A DUST SHEET. IT IS BREATHING. NO - IT ISN\'T.' },
  rocker: { w: 1, h: 1, s: 1, t: 'A ROCKING CHAIR. STILL WARM.' },
  piano: { w: 3, h: 2, s: 1, t: 'YOU PRESS A KEY. THE NOTE COMES A SECOND LATE.' },
  crib: { w: 2, h: 2, s: 1, t: 'AN EMPTY CRIB. THE BLANKET IS DAMP.' },
  tub: { w: 3, h: 2, s: 1, t: 'A CLAWFOOT TUB. A RING OF RUST - OR SOMETHING.' },
  toilet: { w: 1, h: 1, s: 1, t: 'NOTHING HERE. THANK GOODNESS.' },
  sink: { w: 1, h: 1, s: 1, t: 'THE TAP DRIPS. THE WATER IS WARM.' },
  stove: { w: 2, h: 2, s: 1, t: 'AN IRON STOVE, COLD AS A GRAVE.' },
  counter: { w: 2, h: 1, s: 1, t: 'KNIVES, ALL POINTING THE SAME WAY.' },
  crate: { w: 1, h: 1, s: 1, t: 'A NAILED CRATE.' },
  barrel: { w: 1, h: 1, s: 1, t: 'A BARREL. SOMETHING SLOSHES.' },
  sack: { w: 1, h: 1, s: 1, t: 'A SACK OF POTATOES. IT MOVED. RATS, SURELY.' },
  boiler: { w: 3, h: 3, s: 1, t: 'THE BOILER TICKS AS IT COOLS.' },
  plant: { w: 1, h: 1, s: 1, t: 'A WITHERED PLANT.' },
  clock: { w: 1, h: 1, s: 1, t: 'A GRANDFATHER CLOCK. IT TICKS, THOUGH THE PENDULUM HANGS STILL.' },
  sofa: { w: 3, h: 1, s: 1, t: 'A SOFA. THE CUSHIONS ARE DENTED AS IF SOMEONE JUST STOOD.' },
  desk: { w: 2, h: 1, s: 1, t: 'A DESK. PAPERS, CANDLE STUBS.' },
  bench: { w: 3, h: 1, s: 1, t: 'A WORKBENCH, TOOLS LAID OUT NEATLY.' },
  candle: { w: 1, h: 1, s: 1, t: 'A CANDELABRA. NO MATCHES. OF COURSE.' },
  pillar: { w: 1, h: 1, s: 1, t: 'A MARBLE PILLAR.' },
  gramo: { w: 1, h: 1, s: 1, t: 'A GRAMOPHONE. THE NEEDLE IS STILL ON THE RECORD.' },
  musicbox: { w: 1, h: 1, s: 1, t: 'A MUSIC BOX. THE DANCER FACES YOU.' },
  toybox: { w: 1, h: 1, s: 1, t: 'A TOY CHEST. SOMETHING INSIDE SCRATCHES.' },
  horse: { w: 1, h: 1, s: 1, t: 'A ROCKING HORSE WITH CHIPPED EYES.' },
  dollhouse: { w: 2, h: 2, s: 1, t: 'A DOLLHOUSE OF THIS MANOR. A TINY FIGURE STANDS IN YOUR ROOM.' },
  globe: { w: 1, h: 1, s: 1, t: 'A GLOBE. SOMEONE CIRCLED THIS HOUSE.' },
  fountain: { w: 2, h: 2, s: 1, t: 'A DRY FOUNTAIN. A CHERUB WITH NO FACE.' },
  post: { w: 1, h: 1, s: 1, t: 'A ROTTING SUPPORT POST.' },
  pool: { w: 5, h: 4, s: 1, t: 'BLACK WATER. YOUR REFLECTION BLINKS FIRST.' },
  coal: { w: 2, h: 2, s: 1, t: 'A HEAP OF COAL.' },
  doghouse: { w: 2, h: 2, s: 1, t: 'A KENNEL. A CHAIN LEADS INSIDE. IT IS TAUT.' },
  washtub: { w: 2, h: 1, s: 1, t: 'A WASHTUB OF GREY WATER.' },
  washer: { w: 1, h: 1, s: 1, t: 'A MANGLE.' },
  hang: { w: 2, h: 1, s: 0, t: 'HANGING SHEETS.' },
  basket: { w: 1, h: 1, s: 1, t: 'A LAUNDRY BASKET.' },
  nightstand: { w: 1, h: 1, s: 1, t: 'A NIGHTSTAND. A GLASS OF WATER, STILL RIPPLING.' },
  dresser: { w: 2, h: 1, s: 1, t: 'A DRESSER. THE MIRROR HAS BEEN TURNED TO THE WALL.' },
  astairs: { w: 2, h: 2, s: 1, t: 'NARROW STEPS UP TO THE ATTIC DOOR. CHAINED SHUT. SOMETHING SHUFFLES ABOVE.' },
  stairs: { w: 2, h: 2, s: 0 },
  rug: { w: 1, h: 1, s: 0, floor: 1 },
  note: { w: 1, h: 1, s: 0 },
  item: { w: 1, h: 1, s: 0 },
  // wall objects (x only; occupy rows 0-1)
  window: { w: 2, h: 2, wall: 1, t: 'RAIN STREAKS THE GLASS. SOMETHING OUT THERE IS WATCHING THE HOUSE.' },
  portrait: { w: 1, h: 2, wall: 1, t: 'A PORTRAIT. ITS EYES ARE WET.' },
  fireplace: { w: 3, h: 3, wall: 1, s: 1, t: 'A COLD FIREPLACE. FRESH ASH.' },
  breaker: { w: 2, h: 2, wall: 1 },
  atticdoor: { w: 2, h: 2, wall: 1, t: 'THE ATTIC DOOR IS CHAINED. NOT TONIGHT.' },
  tools: { w: 2, h: 2, wall: 1, t: 'A PEGBOARD OF TOOLS. ONE HOOK IS EMPTY.' },
  frontdoor: { w: 2, h: 1, wall: 2, t: 'THE FRONT DOOR. THE STORM HAS SWOLLEN IT SHUT. LIGHTS FIRST.' },
};
const ITEMS = {
  key: { n: 'CELLAR KEY', msg: 'YOU FOUND THE CELLAR KEY. THE BASEMENT DOOR IS IN THE KITCHEN.' },
  handle: { n: 'BREAKER HANDLE', msg: 'YOU FOUND THE BREAKER HANDLE. HEAVY, COLD IRON.' },
  fuse: { n: 'MAIN FUSE', msg: 'YOU FOUND A MAIN FUSE. THE GLASS IS UNCRACKED.' },
  battery: { n: 'BATTERY', msg: 'BATTERIES. THE BEAM STEADIES.' },
};
