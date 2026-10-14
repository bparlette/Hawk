def sub(f, a, b):
    s = open(f).read(); assert s.count(a) == 1, (f, a[:70], s.count(a)); s = s.replace(a, b); open(f, 'w').write(s)
N = '/workspace/work/live11/src/07_news.js'
H = '/workspace/work/live11/site/index.html'
sub(N, "    if (blockedAt(cx, cz, 0.3)) clear -= 5; const sc = Math.min(clear, 2.5) - Math.abs(angTo(live + Math.PI, a)) * 0.15;",
       "    const axis = Math.atan2(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z), side = Math.abs(Math.sin(a - axis)); // side-on to the hero/thug line so both read\n"
       "    if (blockedAt(cx, cz, 0.3)) clear -= 5; const sc = Math.min(clear, 2.5) + side * 2.2 - Math.abs(angTo(live + Math.PI, a)) * 0.1;")
sub(N, "  const a = REPLAY.ang + u * 0.4, R = 4.4 - u * 0.7, F = REPLAY.focus;", "  const por = PORTRAIT(), a = REPLAY.ang + u * 0.4, R = (por ? 6.2 : 4.4) - u * 0.7, F = REPLAY.focus;")
sub(N, "  const fov = 50; if (Math.abs(camera.fov - fov) > 0.05)", "  const fov = por ? 72 : 50; if (Math.abs(camera.fov - fov) > 0.05)")
sub(H, "#ratGoal::after { content: \"GOAL\"; position: absolute; top: -11px;", "#ratGoal::after { content: \"GOAL\"; position: absolute; bottom: -12px;")
sub(H, "#ratBar { position: relative; height: 10px; margin: 5px 0 5px;", "#ratBar { position: relative; height: 10px; margin: 5px 0 9px;")
sub(H, "#hpbox { top: calc(var(--sat) + 118px); } #hpname, #hpbar { width: 120px; }", "#hpbox { top: calc(var(--sat) + 122px); } #hpname, #hpbar { width: 150px; } #hpname { font-size: 12px; } #obj { top: calc(var(--sat) + 122px) !important; }")
print('ok')
