import sys,re
L=open('/workspace/work/enemies/gal_lines.txt').read()
ANCH='      { name: "AMBER", grp: "ALLY", lv: 1, atlas: "amber" },\n'
for p in sys.argv[1:]:
    s=open(p).read(); s=re.sub(r'      \{ name: "[^"]*", grp: "ENEMY"[^\n]*// painted enemies \(enemySkins\)\n','',s)
    assert s.count(ANCH)==1,p; s=s.replace(ANCH,L+ANCH); open(p,'w').write(s); print('gallery',p)
