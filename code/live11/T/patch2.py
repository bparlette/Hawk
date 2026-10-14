def sub(f, a, b):
    s = open(f).read(); assert s.count(a) == 1, (f, a[:70], s.count(a)); s = s.replace(a, b); open(f, 'w').write(s)
N = '/workspace/work/live11/src/07_news.js'
G = '/workspace/work/live11/src/06_game.js'
M = '/workspace/work/live11/src/09_main.js'
H = '/workspace/work/live11/site/index.html'
# 1 wipe: park the band far off-screen, only visible while sweeping
sub(H, "position: absolute; top: -20%; bottom: -20%; width: 70vw; left: -80vw;", "position: absolute; top: -20%; bottom: -20%; width: 70vw; left: -220vw; visibility: hidden;")
sub(H, "#wipe.go::before { animation: wipe .5s ease-in-out; }\n  @keyframes wipe { from { left: -80vw; } to { left: 120vw; } }",
       "#wipe.go::before { animation: wipe .55s ease-in-out; }\n  @keyframes wipe { from { left: -130vw; visibility: visible; } to { left: 160vw; visibility: visible; } }")
# 2 the crew yields to everyone (never shoves the hero around)
sub(G, "    if (d < m && d > 1e-4) { const k = (m - d) / 2; a.pos.x -= dx / d * k; a.pos.z -= dz / d * k; b.pos.x += dx / d * k; b.pos.z += dz / d * k; }",
       "    if (d < m && d > 1e-4) { const k = (m - d) / 2, ka = a.crew ? 2 * k : b.crew ? 0 : k, kb = b.crew ? 2 * k : a.crew ? 0 : k; a.pos.x -= dx / d * ka; a.pos.z -= dz / d * ka; b.pos.x += dx / d * kb; b.pos.z += dz / d * kb; }")
sub(N, "CREW.op.set('film'); CREW.rep.set('film'); ALL.push(CREW.op);", "CREW.op.set('film'); CREW.rep.set('film'); CREW.op.crew = true; ALL.push(CREW.op);")
# 3 crew attacks land more reliably: the operator freezes (keeps filming) when a thug charges him; misses retry twice
sub(N, "    let sp = d < 0.4 ? 0 : Math.min(top, d * 2.2),", "    const charged = enemies.some((e) => e.tgtCrew && Math.hypot(e.pos.x - o.pos.x, e.pos.z - o.pos.z) < 3.2);\n    let sp = d < 0.4 || charged ? 0 : Math.min(top, d * 2.2),")
sub(G, "        if (e.tgtCrew) { const o = CREW.op; if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 2.1 * e.scale) NEWS.hitCrew(e); }",
       "        if (e.tgtCrew) { const o = CREW.op; if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 2.3 * e.scale) { NEWS.hitCrew(e); e.crewTries = 0; } else e.crewTries = (e.crewTries || 0) + 1; }")
sub(G, "      if (e.st > 0.55) { e.hitDone = false; e.tgtCrew = false;", "      if (e.st > 0.55) { e.hitDone = false; const retry = e.tgtCrew && e.crewTries > 0 && e.crewTries < 3 && CREW.state === 'film'; e.tgtCrew = retry; if (retry) { e.set('crewrun'); e.cool = 0; ATTACKERS = Math.max(0, ATTACKERS - 1); break; }")
sub(G, "pose = THUG_POSES.attack(e.st / 0.3, J); rate = 26; const lunge = e.st < 0.12 ? 4 : 0;", "pose = THUG_POSES.attack(e.st / 0.3, J); rate = 26; if (e.tgtCrew) e.yaw += angTo(e.yaw, Math.atan2(CREW.op.pos.x - e.pos.x, CREW.op.pos.z - e.pos.z)) * 0.5; const lunge = e.st < 0.12 ? (e.tgtCrew ? 6 : 4) : 0;")
# 4 good frame = a two-shot: hero in the centre box, close enough, and the opponent on screen too. Ratings re-tuned.
sub(N, "  r.ok = true; r.why = ''; r.good = Math.abs(_p.x) < 0.4 && Math.abs(_p.y) < 0.55;\n}",
       "  r.ok = true; r.why = ''; r.dist = Math.hypot(hx - e.x, hz - e.z); r.good = frameGood(lockT && lockT.alive ? lockT : null);\n}\n"
       "function frameGood(foe) {\n  const r = NEWS.seen; if (!r.ok || Math.abs(r.x) > 0.4 || Math.abs(r.y) > 0.55 || r.dist > 10.5) return false;\n"
       "  if (foe) { _w2.set(foe.pos.x, foe.pos.y + 1.0 + foe.y, foe.pos.z).project(camera); if (_w2.z > 1 || Math.abs(_w2.x) > 0.88 || Math.abs(_w2.y) > 0.92) return false; }\n  return true;\n}")
sub(N, "function gain(amt, label, force) {\n  const s = NEWS.seen;\n  if (!force && !s.ok) { offCamera(s.why); return 0; }\n  const m = force ? 1 : (s.good ? 2 : 1); const g = amt * m;",
       "function gain(amt, label, force, foe) {\n  const s = NEWS.seen;\n  if (!force && !s.ok) { offCamera(s.why); return 0; }\n  const m = force ? 1 : (frameGood(foe) ? 2 : 1); const g = amt * m;")
sub(N, "const g = gain((heavy ? 2.6 : 1.3) * (1 + Math.min(S.combo, 12) * 0.08) * (air ? 1.3 : 1), S.combo >= 3 ? S.combo + ' HITS' : '');",
       "const g = gain((heavy ? 2.0 : 1.0) * (1 + Math.min(S.combo, 12) * 0.06) * (air ? 1.3 : 1), S.combo >= 3 ? S.combo + ' HITS' : '', false, e);")
sub(N, "const g = gain(9 + (e.big ? 5 : 0), 'TAKEDOWN');", "const g = gain(7 + (e.big ? 4 : 0), 'TAKEDOWN', false, e);")
sub(N, "if (idle > 3) RT.v = Math.max(0, RT.v - (NEWS.seen.why === 'NO FEED' ? 1.8 : 0.9) * dt);", "if (idle > 2.5) RT.v = Math.max(0, RT.v - (NEWS.seen.why === 'NO FEED' ? 2.0 : 1.1) * dt);")
# 5 replay angle: pick the side with nobody standing between the lens and the action, a bit higher
sub(N, "  REPLAY.ang = Math.atan2(camera.position.x - REPLAY.focus.x, camera.position.z - REPLAY.focus.z) + (Math.random() < 0.5 ? 1 : -1) * rnd(1.4, 2.0); // a different angle from the live shot",
       "  const live = Math.atan2(camera.position.x - REPLAY.focus.x, camera.position.z - REPLAY.focus.z), F = REPLAY.focus, others = [CREW.op, CREW.rep, COP.f, ...enemies.filter((q) => q !== e && q.alive && q.state !== 'dead')];\n"
       "  let best = live + 1.7, bs = -1e9; // a different angle from the live shot, with a clear line to the action\n"
       "  for (let k = 0; k < 16; k++) { const a = live + 1.1 + k / 16 * (TAU - 2.2), cx = F.x + Math.sin(a) * 4.4, cz = F.z + Math.cos(a) * 4.4; let clear = 9;\n"
       "    for (const q of others) { if (!q.root.visible) continue; const vx = F.x - cx, vz = F.z - cz, L = Math.hypot(vx, vz), u = clamp(((q.pos.x - cx) * vx + (q.pos.z - cz) * vz) / (L * L), 0, 1); clear = Math.min(clear, Math.hypot(q.pos.x - (cx + vx * u), q.pos.z - (cz + vz * u))); }\n"
       "    if (blockedAt(cx, cz, 0.3)) clear -= 5; const sc = Math.min(clear, 2.5) - Math.abs(angTo(live + Math.PI, a)) * 0.15; if (sc > bs) { bs = sc; best = a; } }\n"
       "  REPLAY.ang = best;")
sub(N, "  const a = REPLAY.ang + u * 0.55, R = 4.6 - u * 0.8, F = REPLAY.focus;\n  camera.position.set(F.x + Math.sin(a) * R, 0.75 + u * 0.35, F.z + Math.cos(a) * R);",
       "  const a = REPLAY.ang + u * 0.4, R = 4.4 - u * 0.7, F = REPLAY.focus;\n  camera.position.set(F.x + Math.sin(a) * R, 1.0 + u * 0.3, F.z + Math.cos(a) * R);")
# 7 cop pulls up out on the arm when the hero is in the middle of the intersection
sub(N, "  else { stop = [mid[0] * 0.3, mid[1] * 0.3]; }", "  else { stop = [A[0] * 12 + (A[1] ? -A[1] * lane : 0), A[1] * 12 + (A[0] ? A[0] * lane : 0)]; }")
# 6 bot: kite loop south of the start, direction chosen away from the officer
sub(M, "    else { tx = 0; tz = 33; stopAt = 0.6; }", "    else { tx = 0; tz = 34; stopAt = 0.6; }")
sub(M, "        const a = Math.atan2(hero.pos.x - 0, hero.pos.z - 33) + 0.7; BOTR.wp = [Math.sin(a) * 6, 33 + Math.cos(a) * 6]; BOTR.fleeT = 1;",
       "        if (!BOTR.dir) { const a0 = Math.atan2(hero.pos.x - cop.pos.x, hero.pos.z - cop.pos.z); BOTR.dir = Math.sin(a0) >= 0 ? 1 : -1; }\n"
       "        const a = Math.atan2(hero.pos.x, hero.pos.z - 34) + 0.75 * BOTR.dir; BOTR.wp = [Math.sin(a) * 5.5, 34 + Math.cos(a) * 5.5]; BOTR.fleeT = 1;")
print('ok')
