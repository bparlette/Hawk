import sys
from PIL import Image, ImageDraw, ImageFont
L,tag=sys.argv[1],sys.argv[2]; P=['idle','walk','walk2','attack','jump','hurt','down','grab']
ims=[Image.open('shots/%s_%s_%s.png'%(L,tag,p)).convert('RGB') for p in P]
w,h=ims[0].size; s=float(sys.argv[3]) if len(sys.argv)>3 else 0.5
tw,th=int(w*s),int(h*s); o=Image.new('RGB',(tw*2,th*4)); d=ImageDraw.Draw(o); f=ImageFont.load_default(size=22)
for i,(p,im) in enumerate(zip(P,ims)):
    x,y=(i%2)*tw,(i//2)*th; o.paste(im.resize((tw,th),Image.LANCZOS),(x,y)); d.text((x+6,y+4),p,fill=(255,255,0),font=f,stroke_width=2,stroke_fill=(0,0,0))
o.save('view/g_%s_%s.jpg'%(L,tag),quality=88); print(o.size)
