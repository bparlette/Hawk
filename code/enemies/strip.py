import sys
from PIL import Image, ImageDraw, ImageFont
out=sys.argv[1]; Ls=sys.argv[2].split(); P=sys.argv[3].split() if len(sys.argv)>3 else ['walk','attack','hurt','down']
rows=[]; f=ImageFont.load_default(size=20)
for L in Ls:
    for p in P:
        a=Image.open('shots/%s_after_%s.png'%(L,p)).convert('RGB'); w,h=a.size
        c=a.crop((0,int(h*0.47),w,int(h*0.93))); c=c.resize((int(c.width*0.62),int(c.height*0.62)),Image.LANCZOS)
        ImageDraw.Draw(c).text((4,2),'L%s %s'%(L,p),fill=(255,255,0),font=f,stroke_width=2,stroke_fill=(0,0,0)); rows.append(c)
o=Image.new('RGB',(rows[0].width,sum(r.height for r in rows))); y=0
for r in rows: o.paste(r,(0,y)); y+=r.height
o.save('view/%s.jpg'%out,quality=86); print(o.size)
