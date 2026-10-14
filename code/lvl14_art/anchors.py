# recompute anchorX per frame = median x of the maroon briefs (hip centre); gold-belt median drifted (side disc). Writes meta.json col 4.
from PIL import Image, ImageDraw
import json, numpy as np
im=Image.open('krang_rgba_fixed.png');m=json.load(open('meta.json'))
A=np.asarray(im).astype(int)
for k,v in m.items():
  if k in('down','empty'): continue
  x,y,w,h=v[:4]; c=A[y:y+h,x:x+w]; r,g,b,a=[c[...,i] for i in range(4)]
  mar=(a>150)&(r>70)&(r>g*1.8)&(r>b*1.5)&(g<70)
  yy=np.mgrid[0:h,0:w][0]; mar&=(yy>h*0.42)&(yy<h*0.66)
  ys,xs=np.nonzero(mar); old=v[4]
  if len(xs)>50: v[4]=int(np.median(xs))
  print(k,old,'->',v[4],len(xs))
json.dump(m,open('meta.json','w'))
names=[k for k in m if k not in('down','empty')]
out=Image.new('RGB',(1700,440),(60,70,90)); d=ImageDraw.Draw(out)
ix,iy,iw,ih,iax=m['idle'][:5]; ic=im.crop((ix,iy,ix+iw,iy+ih)).copy(); ic.putalpha(ic.split()[3].point(lambda v:v*0.35))
for i,k in enumerate(names):
  x,y,w,h,ax=m[k][:5]; c=im.crop((x,y,x+w,y+h)); X=120+(i%7)*250; Y=200+(i//7)*220
  out.paste(ic,(X-iax,Y-ih),ic); out.paste(c,(X-ax,Y-h),c); d.line([X,Y-200,X,Y],fill=(0,255,255)); d.text((X-100,Y+3),k,fill=(255,255,0))
out.save('view/anchors2.png')
