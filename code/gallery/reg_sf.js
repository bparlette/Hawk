  // GALLERY REGISTRY (Street Fighter: World Brawl) - one line per painted character; galRegistry() is read lazily on first use.
  //   grp: HERO | BOSS | MINI-BOSS | ENEMY | ALLY     lv: stage number (0 = every stage)
  //   sheet: { atlas: "x" } (engine <img id="atlas-x"> + ATLAS.x) | { atlas: "e-x", fr: ATLAS_E.x } |
  //          { src: "levels/levelN_x.png", js: "levels/levelN.js", fr: "CONST_NAME" [, sub: "key"] }  (fr omitted = first
  //          `NAME = { idle: [...] ... }` literal after the src string in that script; missing script/sheet = skipped)
  //   sp: [sheet...] extra painted poses at the same scale (atlas_sp_* specials); skip: /regex/ pose names; face: -1 = faces left
  // New painted enemy / boss -> add one line (stage 2+ bosses appear by themselves once levels/levelN.js ships).
  function galRegistry() {
    const E = (k, name, lv) => ({ name, grp: "ENEMY", lv, atlas: "e-" + k, fr: ATLAS_E[k] });
    const L = (n, file, fr) => ({ src: "levels/level" + n + "_" + file + ".png", js: "levels/level" + n + ".js", fr });
    return [
      ...BROTHERS.map((b) => ({ name: b.name, grp: "HERO", lv: 0, atlas: b.key, sp: ATLAS_SP[b.key] ? [{ atlas: "sp-" + b.key, fr: ATLAS_SP[b.key] }] : [] })),
      { name: "EVIL RYU", grp: "BOSS", lv: 1, atlas: "evil" },
      { name: "SODOM", grp: "BOSS", lv: 2, ...L(2, "sodom") },
      { name: "BIRDIE", grp: "BOSS", lv: 3, ...L(3, "birdie") },
      { name: "KEN MASTERS", grp: "MINI-BOSS", lv: 1, atlas: "ken" },
      { name: "SCOUT", grp: "ENEMY", lv: 0, atlas: "ninja" },
      { name: "KARATEKA", grp: "ENEMY", lv: 0, atlas: "gunner" },
      E("purple", "SHADALOO BRAWLER", 0), E("blue", "SHOCK TROOPER", 0), E("star", "SHINOBI", 0),
      E("sword", "RONIN", 0), E("dasher", "SLIDE TACKLER", 0), E("heavy", "HEAVY KARATEKA", 0),
    ];
  }
