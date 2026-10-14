f='/workspace/work/ss3d/src/game.js'; s=open(f).read()
R=[
# one-shot: the elevator becomes a crane shot up the building; no box clamps / snaps mid-transit
('    if (p.climb) _t.y = p.gy + 0.9;\n',
 '    if (p.climb) _t.y = p.gy + 0.9;\n    const transit = oneShot() && (p.climb || CAMS.afterT > 0);\n    if (transit) CAM.snap = false;\n    if (oneShot() && p.climb && p.climb.it.kind === "elev" && STATE.elev) { const to = p.climb.it.to, k = STATE.elev.k, kk = k * k * (3 - 2 * k); _t.x = lerp(_t.x, to.x, kk); _t.z = lerp(_t.z, to.z, kk); _t.y = lerp(_t.y, (floorAt(to.layer, to.x, to.z) || 0) + 1, kk); }\n'),
('    if (p.climb && (p.climb.it.kind === "climb" || p.climb.it.kind === "down")) {',
 '    if (transit && p.climb) { /* one continuous move: no zone box mid-transit */ }\n    else if (p.climb && (p.climb.it.kind === "climb" || p.climb.it.kind === "down")) {'),
('    _want.y = Math.min(_want.y, B[4]);\n    if (z.reg === "sewer") _want.y = Math.min(_want.y, WORLD.SC - 0.3);',
 '    if (!(transit && p.climb)) { _want.y = Math.min(_want.y, B[4]); if (z.reg === "sewer") _want.y = Math.min(_want.y, WORLD.SC - 0.3); }'),
('    const k = CAM.snap ? 1 : 1 - Math.exp(-dt * (4.5 + 4 * (CAM.sk || 0)));',
 '    const k = CAM.snap ? 1 : 1 - Math.exp(-dt * (transit ? 2.6 : 4.5 + 4 * (CAM.sk || 0)));'),
('    CAM.pos.lerp(_want, k); CAM.look.lerp(_look, CAM.snap ? 1 : 1 - Math.exp(-dt * 6));\n    if (z.reg === "sewer") CAM.pos.y = Math.min(CAM.pos.y, WORLD.SC - 0.3);',
 '    CAM.pos.lerp(_want, k); CAM.look.lerp(_look, CAM.snap ? 1 : 1 - Math.exp(-dt * (transit ? 3.2 : 6)));\n    if (z.reg === "sewer" && !transit) CAM.pos.y = Math.min(CAM.pos.y, WORLD.SC - 0.3);\n    else if (z.reg === "sewer" && CAM.pos.y > WORLD.SC - 0.3) CAM.pos.y = lerp(CAM.pos.y, WORLD.SC - 0.3, 1 - Math.exp(-dt * 3));'),
('    camera.position.copy(CAM.pos);\n    if (STATE.shake > 0) { const s = Math.min(0.25, STATE.shake * 0.012); camera.position.x += rnd(-s, s); camera.position.y += rnd(-s, s); }\n    camera.lookAt(CAM.look);\n    if (Math.abs(camera.fov - CAM.fov) > 0.05) { camera.fov = CAM.fov; camera.updateProjectionMatrix(); }\n    camBasis(z);',
 '    camFinal(dt, p, z);\n    camBasis(z);'),
# titles: keep the stick basis sane
('    camBasis(zoneById("block1"));\n    REGION.cur = "street";',
 '    camBasis(zoneById("block1")); CAM.sr.copy(CAM.right); CAM.sf.copy(CAM.fwd);\n    REGION.cur = "street";'),
# lights: time of day
('      P.position.set(L.x, L.y, L.z); P.color.setHex(L.c); P.intensity = L.i * L.fl; P.distance = L.d; P.decay = 1.4;',
 '      P.position.set(L.x, L.y, L.z); P.color.setHex(L.c); P.intensity = L.i * L.fl * dayLightScale(L); P.distance = L.d; P.decay = 1.4;'),
('    const out = !under; WORLD.groups.subway.visible = reg === "subway"; WORLD.groups.street.visible = out; WORLD.groups.roof.visible = out; WORLD.groups.sewer.visible = reg === "sewer"; WORLD.groups.inside.visible = reg === "inside";',
 '    const out = !under; WORLD.groups.subway.visible = reg === "subway"; WORLD.groups.street.visible = out; WORLD.groups.roof.visible = out; WORLD.groups.sewer.visible = reg === "sewer"; WORLD.groups.inside.visible = reg === "inside";\n    const fr = CAMS.fromReg; if (oneShot() && fr && fr !== reg) { const fo = fr === "street"; if (fo) { WORLD.groups.street.visible = true; WORLD.groups.roof.visible = true; } else if (WORLD.groups[fr]) WORLD.groups[fr].visible = true; if (out && !fo) { scene.fog.density *= 0.6; } } // one-shot: both spaces exist mid-transit\n    if (STATE.scene !== "title" && STATE.scene !== "boot") dayApply(reg, under); else dayApply(reg, under);'),
('    stepDecor(dt, t, REGION.cur);\n','    stepDecor(dt, t, REGION.cur); stealthDraw(); vanFrame(dt);\n'),
('    renderer.render(scene, camera);\n  }','    renderFinal();\n  }'),
]
for a,b in R:
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
open(f,'w').write(s)
f='/workspace/work/ss3d/src/hud.js'; s=open(f).read()
R=[
('    drawFFHUD();\n','    drawStealthHUD(); drawFFHUD(); drawCamHUD(); drawVanHUD(); drawDayHUD();\n'),
('    if (CAM.fade > 0) {','    if (CAM.fade > 0 && !oneShot()) {'),
('    if (STATE.elev) {','    if (STATE.elev && !oneShot()) {'),
('    ptext("C COUNTER  B SKATEBOARD (SEWERS)  V CRT", W / 2, 208, 1, "#9aa0b8");','    ptext("C COUNTER  B BOARD  X SNEAK  Q CAMERA  T TIME  V CRT", W / 2, 208, 1, "#9aa0b8");'),
]
for a,b in R:
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
open(f,'w').write(s)
f='/workspace/work/ss3d/src/actors.js'; s=open(f).read()
a='      if (sk && !(p.sk.bailT > 0)) { heroLean(b); b.lean = true; } else b.lean = false;'
assert s.count(a)==1
s=s.replace(a, a+'\n      if (p.crouch) { b.mesh.scale.y *= 0.72; b.mesh.scale.x *= 1.08; }')
open(f,'w').write(s)
f='/workspace/work/ss3d/build.py'; s=open(f).read()
a="['head', 'world', 'sewer', 'subway', 'decor', 'actors', 'game', 'skate', 'freeflow', 'hud']"
assert s.count(a)==1
s=s.replace(a,"['head', 'world', 'sewer', 'subway', 'decor', 'actors', 'game', 'skate', 'freeflow', 'daynight', 'stealth', 'cams', 'van', 'hud']")
open(f,'w').write(s)
print('ok')
