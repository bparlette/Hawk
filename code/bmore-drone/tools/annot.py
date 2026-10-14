import json,re,sys
from PIL import Image,ImageDraw
im=Image.open('qa/hf_top.png').convert('RGB'); W,H=im.size
X0,X1,Z0,Z1=-142,222,-112,112
sx=W/(X1-X0); sz=H/(Z1-Z0)
P=lambda x,z:((x-X0)*sx,(z-Z0)*sz)
im=im.resize((W*2,H*2)); d=ImageDraw.Draw(im); P2=lambda x,z:(P(x,z)[0]*2,P(x,z)[1]*2)
for x in range(-140,221,10):
  c=(255,255,0) if x%50==0 else (90,90,0); d.line([P2(x,Z0),P2(x,Z1)],fill=c,width=1)
  if x%50==0: d.text(P2(x+0.5,-111),str(x),fill=(255,255,0))
for z in range(-110,111,10):
  c=(255,255,0) if z%50==0 else (90,90,0); d.line([P2(X0,z),P2(X1,z)],fill=c,width=1)
  if z%50==0: d.text(P2(-141,z+0.5),str(z),fill=(255,255,0))
info=json.load(open('qa/probe.json'))
for id,x,z,r in info['lm']:
  d.text(P2(x,z),id,fill=(255,60,60))
src=open('src/08_course.js').read()
gs=re.findall(r"p: \[(-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\]",src)
prev=None
for i,(x,y,z) in enumerate(gs):
  x,y,z=float(x),float(y),float(z); px,pz=P2(x,z)
  if i==0: continue  # start pos line
  d.ellipse([px-6,pz-6,px+6,pz+6],outline=(0,255,0),width=2); d.text((px+7,pz-6),"%d y%.0f"%(i-1,y),fill=(0,255,0))
  if prev: d.line([prev,(px,pz)],fill=(0,200,0),width=1)
  prev=(px,pz)
im.save('qa/hf_annot.png')
