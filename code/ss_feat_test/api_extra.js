    // ---------------- v1.1 additions (all additive; see ss_level_api.md "v1.1 additions") ----------------
    get difficulty() { return DIFF; }, get difficultyName() { return diff().name; },
    get props() { return STATE.props || []; }, get pickups() { return STATE.items || []; },
    spawnProp: (o) => spawnProp(o),                      // {kind:"barrel"|"crate"|"trash"|"cone", x, y, drop?:"slice"|"pizza"|"none", hp?, onBreak?}
    spawnPickup: (o) => spawnItem(o),                    // {kind:"slice"|"pizza", x, y, z?, vz?, life?}
    spawnEnemyAt(type, x, y, opts) { return spawnEnemy(Object.assign({}, opts || {}, { type, x, y })); }, // opts.from etc. like a wave entry
    hittable: (e) => canHitState(e),
    setBossState(e, name, o) { // a level-owned boss state: o.hittable, o.pose (atlas frame), o.warn (engine red warning flash)
      if (!e) return; o = o || {}; e.state = name; e.t = 0; e._ownState = name;
      e.hittable = o.hittable !== undefined ? !!o.hittable : true; e.pose = o.pose || null; e.warn = !!o.warn;
    },
    drawTinted(kind, fn) { // run fn() with the engine's hit tints: "red" (telegraph) or "white" (hit flash)
      const ft = frameTint, fa = flashAll;
      if (kind === "red") frameTint = "sepia(1) saturate(6) hue-rotate(-40deg) brightness(0.9)"; else if (kind === "white") flashAll = true;
      try { fn(); } catch (err) { console.warn("drawTinted", err); }
      frameTint = ft; flashAll = fa;
    },
    hitFlash: (e) => !!(e && e.flash > 0),               // true on the frames the engine flashes this actor white
    warnFlash: (e) => !!(e && e.t % 6 < 3),              // the engine's red-telegraph blink phase
    registerTarget(o) { // level-drawn things the player can hit: {x, y, z, w, h, d?, onHit(api, tg, {dmg, dir, kind}) -> true to remove}
      const tg = Object.assign({ x: 0, y: (FLOOR_TOP + FLOOR_BOT) / 2, z: 0, w: 16, h: 24, d: 6 }, o, { dead: false });
      tg.remove = () => { tg.dead = true; STATE.targets = (STATE.targets || []).filter((t) => t !== tg); };
      STATE.targets = STATE.targets || []; STATE.targets.push(tg); return tg;
    },
    addZone(z) { const o = Object.assign({}, z); o.remove = () => { o.dead = true; STATE.zones = (STATE.zones || []).filter((q) => q !== o); }; STATE.zones = STATE.zones || []; STATE.zones.push(o); return o; },
    holdPlayer(x, y, z) { const p = STATE.player; if (!p || p.deadT > 0) return false; if (p.grabbedBy) releaseGrab(false); if (p.hold) releaseHold(p, false); if (p.carry) dropProp(p); p.heldAt = { x, y, z: z || 0, f: STATE.t }; return true; },
    releasePlayer(dmg, dir) { const p = STATE.player; if (!p || !p.heldAt) return; p.heldAt = null; if (dmg) { p.inv = 0; hurtPlayer(dmg, false, dir || 0); } },
    get playerHeld() { const p = STATE.player; return !!(p && p.heldAt && STATE.t - p.heldAt.f <= 1); },
    stunPlayer(frames) { const p = STATE.player; if (!p || p.deadT > 0) return; p.stunT = Math.max(p.stunT || 0, frames | 0); p.frozen = false; p.attackT = 0; p.atk = null; p.walkT = 0; },
    freezePlayer(frames) { const p = STATE.player; if (!p || p.deadT > 0) return; p.stunT = Math.max(p.stunT || 0, frames | 0); p.frozen = true; p.attackT = 0; p.atk = null; p.walkT = 0; },
    playerDrawOffset(dx, dy) { STATE.pOff = { x: +dx || 0, y: +dy || 0, t: STATE.t }; }, // draw-only, this frame
