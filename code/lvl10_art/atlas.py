from PIL import Image
import numpy as np, json
src=np.array(Image.open('lvl10_gen_shark.png').convert('RGB')).astype(int)
lab=np.load('lab.npy')
r,g,b=src[...,0],src[...,1],src[...,2]
gk=g-np.maximum(r,b)
frames=[('idle',3),('idle2',7),('bite',2),('fire',6),('hurt',4),('walk',1)]
S=0.78
outs=[];meta={}
for name,i in frames:
  ys,xs=np.where(lab==i); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
  m=np.zeros(lab.shape,bool)
  # include all non-key pixels in bbox that are not other big comps (sparks etc)
  sub=lab[y0:y1,x0:x1]
  big=set([1,2,3,4,5,6,7])-{i}
  mm=(sub>0)&~np.isin(sub,list(big))
  rgb=src[y0:y1,x0:x1].copy()
  # despill
  mx=np.maximum(rgb[...,0],rgb[...,2]); gg=rgb[...,1]
  rgb[...,1]=np.where(gg>mx+8, mx+8, gg)
  a=np.where(mm,255,0).astype(np.uint8)
  img=Image.fromarray(np.dstack([rgb.clip(0,255).astype(np.uint8),a]),'RGBA')
  w,h=img.size; img=img.resize((round(w*S),round(h*S)),Image.LANCZOS)
  # anchor: median x of bottom 12% rows
  hh=y1-y0; fy,fx=np.where(mm[int(hh*0.80):])
  ax=float(np.median(fx))*S
  # torso centre (rows 30-55%)
  ty,tx=np.where(mm[int(hh*0.3):int(hh*0.55)])
  outs.append((name,img,ax,float(np.median(tx))*S))
W=sum(o[1].size[0] for o in outs)+4*len(outs); H=max(o[1].size[1] for o in outs)
at=Image.new('RGBA',(W,H),(0,0,0,0)); x=0
for name,img,ax,tx in outs:
  at.paste(img,(x,H-img.size[1]),img)
  meta[name]=dict(x=x,y=H-img.size[1],w=img.size[0],h=img.size[1],ax=round(ax,1),tx=round(tx,1))
  x+=img.size[0]+4
q=at.quantize(colors=255,method=Image.FASTOCTREE,dither=Image.FLOYDSTEINBERG)
q.save('level10_armaggon.png',optimize=True)
at.save('armaggon_rgba.png')
print(W,H,json.dumps(meta))
import os; print(os.path.getsize('level10_armaggon.png'))
