from PIL import Image, ImageDraw
import json
im=Image.open('gator_rgba.png'); m=json.load(open('meta.json'))
rafe=Image.open('ref_rafe.png').crop((0,2,99,152)); TK=float(open('tk.txt').read()); GK=0.5
rafe=rafe.resize((round(99*TK*3),round(150*TK*3)),Image.LANCZOS)
S=3; names=list(m); cols=6
out=Image.new('RGB',(cols*300,((len(names)+cols-1)//cols)*400),(60,70,90)); d=ImageDraw.Draw(out)
for i,k in enumerate(names):
  x,y,w,h,ax=m[k]; c=im.crop((x,y,x+w,y+h)); c=c.resize((round(w*GK*S),round(h*GK*S)),Image.LANCZOS)
  X=170+(i%cols)*300; Y=370+(i//cols)*400
  out.paste(rafe,(X-150-rafe.width//2,Y-rafe.height),rafe)
  out.paste(c,(X-round(ax*GK*S),Y-c.height),c); d.line([X,Y-330,X,Y],fill=(0,255,255)); d.text((X-60,Y+5),k,fill=(255,255,0))
out.save('view/frames.jpg',quality=88)
