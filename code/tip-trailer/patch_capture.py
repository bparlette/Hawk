import sys
p=sys.argv[1]+'/js/core.js'; s=open(p).read()
if '__cap' in s: print('already'); sys.exit()
s=s.replace("GT.mute = Q.has('mute');","GT.mute = Q.has('mute');\nGT.capture = Q.has('capture');\nif (GT.capture) { let _s = (+(Q.get('seed')||12345))>>>0; Math.random = function(){ _s ^= _s << 13; _s >>>= 0; _s ^= _s >>> 17; _s ^= _s << 5; _s >>>= 0; return (_s % 1000000) / 1000000; }; }",1)
s=s.replace("function frame(ts) {\n  requestAnimationFrame(frame);","function frame(ts) {\n  requestAnimationFrame(frame);\n  if (GT.capture) return;",1)
s=s.replace("// extents of visible area","// deterministic frame-step capture hook (trailer only)\nwindow.__cap = {\n  step(n) { for (let i = 0; i < n; i++) step(); },\n  shots(count, every) { const out = []; for (let i = 0; i < count; i++) { for (let k = 0; k < every; k++) step(); render(); out.push(scr.toDataURL('image/png')); } return out; },\n  info() { return window.__gt; }\n};\n// extents of visible area",1)
assert s.count('__cap')==1 and 'if (GT.capture) return;' in s
open(p,'w').write(s); print('patched')
