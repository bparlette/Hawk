import sys
src,dst,notes,step=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4]
s=open(src).read()
a='          if (pressed.mute) { muted = !muted; }\n'
assert s.count(a)==1
line='          if (state === "play" && !paused && !muted && t % STEP === 0) { var MUS = [NOTES]; var mi = Math.floor(t / STEP) % MUS.length; beep(MUS[mi], 0.1, "triangle", 0.03); if (mi % 4 === 0) beep(MUS[0] / 2, 0.16, "square", 0.018); }\n'
line=line.replace("STEP",step).replace("NOTES",notes)
s=s.replace(a,a+line)
open(dst,'w').write(s)
