import sys,glob,os,re
root=sys.argv[1]
names=sorted({os.path.basename(p)[:-4] for p in glob.glob(root+'/*.png')+glob.glob(root+'/levels/*.png') if not os.path.basename(p).startswith('icon') and os.path.exists(p[:-4]+'.webp')})
pat=re.compile(r'(?<![A-Za-z0-9_])('+'|'.join(map(re.escape,names))+r')\.png\b')
files=[root+'/index.html',root+'/assets.json',root+'/sw.js']+glob.glob(root+'/levels/*.js')
for f in files:
    s=open(f).read(); n=len(pat.findall(s)); s2=pat.sub(r'\1.webp',s)
    if f.endswith('index.html'):
        old='"_" + file + ".png"'; c=s2.count(old); s2=s2.replace(old,'"_" + file + ".webp"'); n+=c
        s2=s2.replace('{ src: "levels/levelN_x.png"','{ src: "levels/levelN_x.webp"')
    if s2!=s: open(f,'w').write(s2)
    print(os.path.relpath(f,root),n)
