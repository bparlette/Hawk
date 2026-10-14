from PIL import Image
import numpy as np, json
src=np.array(Image.open('gen_l9_karai.png').convert('RGBA')).astype(np.float32)
lab=np.load('lab.npy')
# despill green
r,g,b,a=src[...,0],src[...,1],src[...,2],src[...,3]
m=np.maximum(r,b); spill=g>m
src[...,1]=np.where(spill,m+ (g-m)*0.15,g)
# soften edges: alpha erode-ish by multiplying with min of 4-neighbours
A=a.copy(); 
nb=np.minimum.reduce([np.roll(A,1,0),np.roll(A,-1,0),np.roll(A,1,1),np.roll(A,-1,1)])
src[...,3]=np.minimum(A,nb*1.0+A*0)  # 1px erode
frames={'idle':[3],'walk':[2],'slash':[4],'throw':[1],'hurt':[6],'down':[7],'kunai':[5]}
H,W=lab.shape
# attach small comps to nearest main frame by bbox containment
ids=np.unique(lab); 
main={c for v in frames.values() for c in v}
boxes={}
for k,v in frames.items():
  ys,xs=np.where(np.isin(lab,v)); boxes[k]=[xs.min(),xs.max(),ys.min(),ys.max()]
for c in ids:
  if c==0 or c in main: continue
  ys,xs=np.where(lab==c); cx,cy=xs.mean(),ys.mean()
  for k,(x0,x1,y0,y1) in boxes.items():
    if k in('kunai',): continue
    if x0-10<=cx<=x1+10 and y0-10<=cy<=y1+10 and len(xs)>8: frames[k].append(int(c)); break
S=0.5; out=[]; X=1; meta={}
for k,v in frames.items():
  mask=np.isin(lab,v); ys,xs=np.where(mask)
  x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
  crop=src[y0:y1,x0:x1].copy(); crop[...,3]*=mask[y0:y1,x0:x1]
  im=Image.fromarray(np.clip(crop,0,255).astype(np.uint8),'RGBA')
  im=im.resize((max(1,round(im.width*S)),max(1,round(im.height*S))),Image.LANCZOS)
  out.append((k,im))
Wt=sum(i.width+3 for _,i in out)+1; Ht=max(i.height for _,i in out)+2
sheet=Image.new('RGBA',(Wt,Ht),(0,0,0,0)); x=1
for k,im in out:
  sheet.paste(im,(x,1)); meta[k]=[x,1,im.width,im.height]; x+=im.width+3
sheet.save('level9_karai.png',optimize=True)
print(sheet.size, json.dumps(meta))
