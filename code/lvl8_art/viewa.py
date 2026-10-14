from PIL import Image, ImageDraw
import json
im=Image.open('level8_razorback.png').convert('RGBA'); m=json.load(open('meta.json'))
ix,iy,iw,ih,iax=m['idle']; ic=im.crop((ix,iy,ix+iw,iy+ih)); ic.putalpha(ic.split()[3].point(lambda v:v*0.3))
out=Image.new('RGB',(8*260,2*250),(60,70,90)); d=ImageDraw.Draw(out)
for i,(n,v) in enumerate(m.items()):
  x,y,w,h,ax=v; c=im.crop((x,y,x+w,y+h)); X=130+(i%8)*260; Y=220+(i//8)*250
  out.paste(ic,(X-iax,Y-ih),ic); out.paste(c,(X-ax,Y-h),c); d.line([X,Y-200,X,Y],fill=(0,255,255)); d.text((X-120,Y+5),n,fill=(255,255,0))
out.save('view/anchors.png')
