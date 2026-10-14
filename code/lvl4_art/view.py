from PIL import Image, ImageDraw
import json
im=Image.open('jw_rgba.png'); m=json.load(open('meta.json'))
names=list(m); out=Image.new('RGB',(1500,520),(60,70,90)); d=ImageDraw.Draw(out)
ix,iy,iw,ih,iax,ify=m['idle'][:6]; ic=im.crop((ix,iy,ix+iw,iy+ih)).copy(); ic.putalpha(ic.split()[3].point(lambda v:v*0.3))
for i,k in enumerate(names):
  x,y,w,h,ax,fy,gx,gy=m[k]; c=im.crop((x,y,x+w,y+h)); X=110+(i%6)*240; Y=230+(i//6)*250
  out.paste(ic,(X-iax,Y-ify),ic); out.paste(c,(X-ax,Y-fy),c); d.line([X,Y-200,X,Y+10],fill=(0,255,255)); d.line([X-60,Y,X+60,Y],fill=(255,0,255))
  if gx>=0: d.ellipse([X-ax+gx-4,Y-fy+gy-4,X-ax+gx+4,Y-fy+gy+4],outline=(255,255,0))
  d.text((X-100,Y+12),k,fill=(255,255,0))
out.save('view/anchors.png')
