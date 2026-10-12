import json
from PIL import Image, ImageDraw
R=json.load(open('art/atlas_sp_rects.json'))
import re
html=open('game/index.html').read()
keys=["ryu","kenp","chunli","guile","blanka","honda","zangief","dhalsim","cammy","feilong","deejay","thawk"]
rows=[]
for k in keys:
    m=re.search(r'\n    %s: \{ idle: \[(\d+), (\d+), (\d+), (\d+)\]'%k, html); x,y,w,h=map(int,m.groups())
    a=Image.open('game/atlas_%s.png'%k).crop((x,y,x+w,y+h))
    sp=Image.open('game/atlas_sp_%s.png'%k)
    fr=[a]+[sp.crop((r[0],r[1],r[0]+r[2],r[1]+r[3])) for r in R[k].values()]
    W=sum(f.width for f in fr)+10*len(fr); H=220
    c=Image.new('RGB',(W,H),(110,110,110)); xx=0
    for f in fr: c.paste(f,(xx,H-10-f.height),f); xx+=f.width+10
    ImageDraw.Draw(c).text((4,4),k,fill=(255,255,0)); rows.append(c)
fx=Image.open('game/atlas_fx.png'); c=Image.new('RGB',(fx.width+10,110),(30,30,30)); c.paste(fx,(5,10),fx); rows.append(c)
W=max(r.width for r in rows); half=(len(rows)+1)//2
cols=[rows[:half],rows[half:]]
imgs=[]
for col in cols:
    H=sum(r.height for r in col); c=Image.new('RGB',(W,H),(0,0,0)); y=0
    for r in col: c.paste(r,(0,y)); y+=r.height
    imgs.append(c)
out=Image.new('RGB',(W*2,max(i.height for i in imgs))); out.paste(imgs[0],(0,0)); out.paste(imgs[1],(W,0)); out.save('work_sp_prev.png')
print(out.size)
