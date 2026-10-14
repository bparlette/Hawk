import json
from PIL import Image, ImageDraw, ImageFont
M=json.load(open('out/meta.json')); f=ImageFont.load_default(size=14)
LV={'street':'L1-2','sewer':'L3','biker':'L4','dock':'L5','snow':'L6','scrap':'L7','guard':'L8','edo':'L9','pirate':'L10','swamp':'L11','trooper':'L12-14','foot':'L15 heavy/gunner'}
for fam,m in M.items():
    sh=Image.open('out/enemies_%s_rgba.png'%fam).convert('RGBA')
    rows=[]
    for role,fr in m.items():
        W=sum(v[2]+10 for v in fr.values())+10; H=max(v[3] for v in fr.values())+40
        o=Image.new('RGBA',(W,H),(70,74,86,255)); d=ImageDraw.Draw(o); x=10
        for n,v in fr.items():
            c=sh.crop((v[0],v[1],v[0]+v[2],v[1]+v[3])); o.alpha_composite(c,(x,H-20-v[3])); d.line([(x+v[4],H-20-v[3]),(x+v[4],H-20)],fill=(255,60,60,120))
            d.text((x,H-17),n,fill=(255,255,0),font=f); x+=v[2]+10
        d.text((6,4),'%s %s (%s)'%(fam,role,LV[fam]),fill=(255,255,255),font=f); rows.append(o)
    W=max(r.width for r in rows); out=Image.new('RGB',(W,sum(r.height for r in rows)),(70,74,86)); y=0
    for r in rows: out.paste(r.convert('RGB'),(0,y)); y+=r.height
    out.save('contact/%s.jpg'%fam,quality=88)
print('ok')
