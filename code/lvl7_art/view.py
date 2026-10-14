from PIL import Image, ImageDraw
import json
im=Image.open('rust_rgba.png');m=json.load(open('meta.json'))
names=list(m)
out=Image.new('RGB',(7*230+40,2*330+20),(60,70,90)); d=ImageDraw.Draw(out)
ix,iy,iw,ih,iax=m['idle'][:5]; ic=im.crop((ix,iy,ix+iw,iy+ih)); ic.putalpha(ic.split()[3].point(lambda v:v*0.3))
for i,k in enumerate(names):
  x,y,w,h,ax=m[k][:5]; c=im.crop((x,y,x+w,y+h)); X=120+(i%7)*230; Y=310+(i//7)*330
  out.paste(ic,(X-iax,Y-ih),ic); out.paste(c,(X-ax,Y-h),c); d.line([X,Y-290,X,Y],fill=(0,255,255)); d.text((X-100,Y+3),k,fill=(255,255,0))
out.save('view/anchors.png')
