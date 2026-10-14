def sub(f, a, b):
    s = open(f).read(); assert s.count(a) == 1, (f, a[:70], s.count(a)); s = s.replace(a, b); open(f, 'w').write(s)
M = '/workspace/work/live11/src/09_main.js'
sub(M, "  if (tx === null) return;\n  const dx = tx - hero.pos.x, dz = tz - hero.pos.z, d = Math.hypot(dx, dz);",
       "  if (tx === null) return;\n"
       "  { // route through the intersection when a corner block is in the way\n"
       "    let cut = false; for (let i = 1; i < 12; i++) { const u = i / 12, x = lerp(hero.pos.x, tx, u), z = lerp(hero.pos.z, tz, u); if (Math.abs(x) > SW - 0.6 && Math.abs(z) > SW - 0.6) { cut = true; break; } }\n"
       "    if (cut) { tx = clamp(hero.pos.x, -4, 4) * 0.3; tz = clamp(hero.pos.z, -4, 4) * 0.3; stopAt = 0.3; }\n  }\n"
       "  const dx = tx - hero.pos.x, dz = tz - hero.pos.z, d = Math.hypot(dx, dz);")
print('ok')
