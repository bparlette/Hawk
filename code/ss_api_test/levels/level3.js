// v1.1 API smoke test (temp copy only; never shipped)
(function () {
  const SS = window.SS, A = SS.api, hit = {};
  const mark = (k) => { if (!hit[k]) { hit[k] = 1; console.log("API_OK " + k); } };
  let tg = null, held = 0;
  const probe = {
    init(api) { tg = api.registerTarget({ x: 300, y: 190, z: 0, w: 20, h: 30, onHit(api, t, info) { mark("target:" + info.kind); return false; } }); api.addZone({ x0: 0, x1: 2000, y0: 0, y1: 300, speed: 0.9 }); return { t: 0 }; },
    update(st, api, p) {
      st.t++;
      if (st.t === 5) { const e = api.spawnEnemyAt("purple", api.camX + 200, 190, { from: "pipe", fallFrames: 20 }); if (e && e.state === "drop") mark("spawnEnemyAt-pipe"); }
      if (st.t === 6) { const e = api.spawnEnemyAt("blue", api.camX + 120, undefined, { from: "door" }); if (e) mark("spawnEnemyAt-door"); }
      if (st.t === 8) { api.spawnProp({ kind: "barrel", x: p.x + 30, y: p.y }); api.spawnPickup({ kind: "pizza", x: p.x + 10, y: p.y }); if (api.props.length && api.pickups.length) mark("spawnProp/Pickup"); }
      if (st.t > 20 && !api.pickups.length && !hit.pickup) mark("pickup");
      if (st.t >= 40 && st.t < 70) { api.holdPlayer(p.x, p.y, 20); if (api.playerHeld) held++; }
      if (st.t === 70) { api.releasePlayer(1, 1); if (held > 20) mark("hold/releasePlayer"); }
      if (st.t === 200) { api.freezePlayer(30); if (p.stunT === 30) mark("freezePlayer"); }
      if (st.t === 260) { api.stunPlayer(20); mark("stunPlayer"); }
      if (st.t > 300 && st.t < 330) api.playerDrawOffset(0, -2);
      if (api.difficultyName) mark("difficulty=" + api.difficultyName);
    },
  };
  SS.registerLevel({
    number: 3, name: "API TEST", final: true,
    sections: [
      { bg: "levels/level2_street.jpg", bgMirror: true, floor: [168, 218], length: 900, locks: [0, 400], waves: [["purple", { type: "purple", from: "door", x: 250 }], [{ type: "blue", from: "drop" }, "purple"]],
        props: [{ kind: "crate", x: 150, y: 200, drop: "slice" }], pickups: [{ kind: "slice", x: 90, y: 210 }], hazards: [probe],
        onSpawn(api, e) { mark("onSpawn"); } },
      { arena: true, bg: "levels/level2_street.jpg", floor: [168, 218], auto: 0 },
    ],
    boss: { name: "TESTO", hp: 24, moves: ["charge", "kick"], hittable: ["zap2"],
      pickMove(api, e, p) { mark("pickMove"); { api.setBossState(e, "zap2", { hittable: true, pose: "fire", warn: true }); return true; } return false; },
      update(api, e, p) { if (e.state === "zap2") { if (api.hittable(e)) mark("custom state hittable"); if (e.flash > 0) mark("custom state got hit"); if (e.t > 40) { e.state = "walk"; e.t = 0; } return true; } return false; },
      drawOver(api, e, sx, sy) { mark("drawOver"); api.drawTinted(api.warnFlash(e) ? "red" : null, () => {}); },
      onDefeat() { mark("boss defeated"); } },
    onUnload() { tg = null; },
  });
})();
