s=open('qp/q3a.html').read()
a='            x.fillStyle = "#fff";\n            for (i = 0; i < 6; i++) { sx = ((i * 90'
assert s.count(a)==1
far='''            // far: glowing sun, drifting distant flock
            x.fillStyle = "rgba(255,240,170,0.35)"; x.fillRect(372, 22, 30, 30); x.fillStyle = "rgba(255,244,190,0.7)"; x.fillRect(377, 27, 20, 20); x.fillStyle = "#fffbe0"; x.fillRect(381, 31, 12, 12);
            x.fillStyle = "#2a4a9a"; for (i = 0; i < 4; i++) { sx = ((i * 70 - t * 0.25 - c * 0.08) % 380 + 380) % 380 + 40; var by = 18 + i * 6 + Math.round(Math.sin(t / 14 + i) * 2), fl = ((t >> 3) + i) % 2; x.fillRect(sx - 2, by + fl, 2, 1); x.fillRect(sx, by, 1, 1); x.fillRect(sx + 1, by + fl, 2, 1); }
'''
s=s.replace(a,far+a)
b='            var s = this.spring, ssx'
assert s.count(b)==1
near='''            // mid: water sparkle glints and pollen drifting over the hills
            for (i = 0; i < 14; i++) { if (((t >> 3) + i * 5) % 7 < 2) { sx = ((i * 37 - c * 0.35) % 480 + 480) % 480; x.fillStyle = "#fff"; x.fillRect(sx, 136 + (i * 13) % 50, 2, 1); } }
            for (i = 0; i < 10; i++) { sx = ((i * 53 - t * 0.5 - c * 0.7) % 500 + 500) % 500 - 10; var py = 60 + ((i * 29) % 70) + Math.round(Math.sin(t / 20 + i) * 6); x.fillStyle = "rgba(255,255,200,0.8)"; x.fillRect(sx, py, 1, 1); }
'''
s=s.replace(b,near+b)
# near layer: swaying foreground grass blades before the HUD/end of draw
open('qp/q3b.html','w').write(s)
