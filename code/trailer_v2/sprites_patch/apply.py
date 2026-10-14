# Re-apply THE CAST + LIVE VS 16-BIT sections onto a freshly generated site_final/index.html (make_page2.py does not know about them).
# Then runs secindex.py (section index under PLAY NOW + #fullplay in-cabinet trailer link).
# usage: python3 sprites_patch/apply.py [site_dir]   (also copies /workspace/work/sprites/out/sprites.json)
import sys, os, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
D=os.path.dirname(os.path.abspath(__file__)); site=sys.argv[1] if len(sys.argv)>1 else os.path.join(D,'..','site_final')
p=os.path.join(site,'index.html'); s=open(p).read()
if 'sprites-sections' in s:
    print('sprites already applied'); import secindex; secindex.patch(p); sys.exit(0)
a='  <a class="play" href="https://shellshock-live.surge.sh">▶ PLAY NOW<small>Grab a brother'
assert s.count(a)==1 and '</style></head>' in s
r=lambda f: open(os.path.join(D,f)).read()
s=s.replace('</style></head>',r('sprites.css')+'</style></head>',1).replace(a,r('sprites.html')+a,1).replace('</body></html>',r('sprites.js')+'</body></html>',1)
open(p,'w').write(s); shutil.copy('/workspace/work/sprites/out/sprites.json',os.path.join(site,'sprites.json')); print('applied')
sys.path.insert(0,D); import secindex; secindex.patch(p)  # jump-to section index + in-cabinet Full trailer link
