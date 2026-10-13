
// ======================= feature `lexington` runtime (geometry + anchors in 03d_lexington.js) =======================
// - landmark blurbs (GR4 writing for Lexington Market + Rash Field; short placeholders for Westminster + Hooters)
// - name popups for Westminster Burying Ground + Hooters (spots, not crime districts: they never show while a real landmark popup is up)
// - night glows (Lexington uplight washes, the Hooters sign halos) follow NIGHT
// - test param ?goto=lexington|westminster|rash|hooters frames a place for screenshots (free camera, sim paused); add &gotoplay=1 to just drop
//   Harold there and keep playing. Pair with ?tod=0.5 for night.
(function lexingtonRuntime() {
  // gr4_new_content.json landmarks.lexington_market / rash_field (Grok); westminster + hooters are placeholders until Grok writes them
  GR1.landmarks.lexington = { name: 'LEXINGTON MARKET', blurb: ['Founded in 1782, it\'s one of the oldest public markets in America.', 'Pit Beef Pete claims he\'s eaten at every stall since opening day.'] };
  GR1.landmarks.rashfield = { name: 'RASH FIELD', blurb: ['A waterfront park on the Inner Harbor\'s south shore by the Science Center.', 'Riptide Rodney calls it home turf and charges toads a toll.'] };
  GR1.landmarks.westminster = { name: 'WESTMINSTER BURYING GROUND', blurb: ['Edgar Allan Poe is buried at Westminster Burying Ground in downtown Baltimore.', 'The Raven King\'s crows keep watch here after dark.'] };
  GR1.landmarks.hooters = { name: 'HOOTERS', blurb: ['Wings, shrimp and burgers on the Light Street side of Harborplace.', 'Two big orange signs: one for the street, one for the harbor.'] };
  const SPOTS = [{ id: 'westminster', name: 'WESTMINSTER BURYING GROUND', x: -122, z: -58, r: 13 }, { id: 'hooters', name: 'HOOTERS', x: HOO.x - 2, z: HOO.z, r: 7.5 }];
  const LX = { spot: null, t: 0, log: [] };
  function spotTick(rdt) {
    LX.t -= rdt; if (LX.t > 0) return; LX.t = 0.25;
    let best = null; if (!CITY.lmk) for (const s of SPOTS) if (Math.hypot(s.x - hero.pos.x, s.z - hero.pos.z) < s.r) best = s;
    if (best === LX.spot) return; LX.spot = best;
    if (best) { const el = $('lmk'); el.textContent = best.name; el.classList.add('on'); CITY.lmkT = BARK.lmBlurb(best) || 3.2; LX.log.push(best.id + '@' + S.time.toFixed(1)); }
  }
  function nightTick() { const n = NIGHT.value; for (const m of LEXW.night) { m.material.opacity = n * 0.85; m.visible = n > 0.02; } }
  MODE.ticks.push((rdt) => { nightTick(); spotTick(rdt); });

  // ---- ?goto=<place>: showcase framing for screenshots
  const GOTO = {
    lexington: { hero: [-88, -44.2, Math.PI], cam: [-95, 7.5, -35], look: [-88, 7, -56], camP: [-104, 19, -31.5], lookP: [-88, 6.5, -55] },
    lexnear: { hero: [LEX_ANCHOR.x, LEX_ANCHOR.z + 2, Math.PI], cam: [-84, 3.2, -38.5], look: [-89.5, 4.6, -50] },
    westminster: { hero: [-108, -50, -Math.PI / 2], cam: [-101, 14, -36], look: [-122, 3, -58] },
    poe: { hero: [POE_ANCHOR.x + 1.5, POE_ANCHOR.z + 1.8, Math.PI], cam: [-108.5, 4.2, -43.5], look: [-115, 1.4, -51.5] },
    rash: { hero: [RSF.cx, 32, 0], cam: [-31.5, 11, 44.5], look: [-31.5, 0, 22] },
    hooters: { hero: [-63, 2, Math.PI / 2], cam: [-70.5, 4.6, 11.5], look: [-55.5, 4.4, 0.4], camP: [-75, 5.2, 6.5], lookP: [-55.5, 4.6, 0.6] },
    hootersharbor: { hero: [-48, 1, -Math.PI / 2], cam: [-41.5, 5.5, 9.5], look: [-54.5, 4.4, 0.6] },
  };
  const want = Q.get('goto'); const G = GOTO[want];
  const api = { LX, SPOTS, GOTO, get anchors() { return { LEX_ANCHOR, POE_ANCHOR, RASH_ANCHOR, HOOTERS_ANCHOR: window.HOOTERS_ANCHOR }; }, shown: null };
  if (G) {
    let n = 0, done = false;
    MODE.ticks.push(() => {
      if (done) return; n++;
      if (n === 2) { if (CINE.intro) CINE.intro.skip = true; const [x, z, yaw] = G.hero; hero.pos.set(x, groundY(x, z), z); hero.yaw = yaw; hero.vel.set(0, 0); hero.set('move'); hero.dry = { x, z };
        partner.pos.set(x + 1.2, groundY(x + 1.2, z + 0.8), z + 0.8); partner.set('move'); CAM.yaw = yaw; snapCam(); }
      if (n === 30 && !Q.has('gotoplay')) { done = true; window.__cel.pause = true; // freeze the sim; draw() keeps rendering through the showcase camera below
        const prev = scene.onBeforeRender;
        scene.onBeforeRender = (r, s, cam) => { if (window.__cel.pause && api.shown) { const P = innerWidth < innerHeight, C = P && G.camP ? G.camP : G.cam, Lk = P && G.lookP ? G.lookP : G.look, k = P && !G.camP ? (G.pk || 1.6) : 1; cam.position.set(Lk[0] + (C[0] - Lk[0]) * k, Lk[1] + (C[1] - Lk[1]) * k, Lk[2] + (C[2] - Lk[2]) * k); cam.lookAt(...Lk); cam.updateMatrixWorld(); window.__sky.position.copy(cam.position); } prev(r, s, cam); };
        camera.fov = 52; camera.updateProjectionMatrix(); scene.fog.near = 70; scene.fog.far = 240; OUT_U.fogN.value = 70; OUT_U.fogF.value = 240; api.shown = want; }
    });
  }
  window.__lex = api;
})();
