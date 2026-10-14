# cut, scale (sheet px = 2x world px, drawn at k=0.5), de-fringe, pack one sheet per level + meta.json
from PIL import Image
import numpy as np, json, os
from scipy import ndimage as ndi
from seg import load, comps, cut
S={}
def get(f):
    if f not in S: a=load(f); S[f]=(a,)+comps(a)
    return S[f]
def frame(f,idx,extra=None,largest=False):
    a,lab,cs=get(f)
    c=max(cs,key=lambda c:c[1]) if largest else cs[idx]
    return cut(a,lab,c,extra)
def defringe(s):
    al=s[...,3]; er=ndi.grey_erosion(al,size=(3,3)); s[...,3]=np.minimum(al,er*0.5+al*0.5); return s
def scale(s,w=None,h=None):
    im=Image.fromarray(np.clip(s,0,255).astype(np.uint8),'RGBA')
    # premultiplied resize to avoid dark/green halos
    a=np.asarray(im).astype(np.float32); A=a[...,3:]/255; pm=np.concatenate([a[...,:3]*A,a[...,3:]],-1)
    k=(h/im.height) if h else (w/im.width)
    W=max(1,round(w if (w and h) else im.width*k)); H=max(1,round(h if h else im.height*k))
    ch=[Image.fromarray(pm[...,i].astype(np.float32),'F').resize((W,H),Image.LANCZOS) for i in range(4)]
    o=np.dstack([np.asarray(c) for c in ch]); A=np.clip(o[...,3:],0,255)/255
    rgb=np.where(A>0.01,o[...,:3]/np.maximum(A,1e-3),0)
    return np.dstack([rgb,o[...,3:]]).clip(0,255)
def mod(s,fn): s=s.copy(); fn(s); return s
def dim_red(s): # laser lenses off: darken saturated red pixels
    r,g,b=s[...,0],s[...,1],s[...,2]; m=(r>70)&(r>g+35)&(r>b+25)
    m=ndi.binary_dilation(m,iterations=1)&(r>g)
    l=(r+g+b)/3; s[m,0]=l[m]*0.55+12; s[m,1]=l[m]*0.3; s[m,2]=l[m]*0.35
def dim_orange(s): # vent cold: dim the glowing orange interior
    r,g,b=s[...,0],s[...,1],s[...,2]; m=(r>110)&(r>b*1.5)&(g>40)
    l=(r+g+b)/3; s[m,0]=l[m]*0.45; s[m,1]=l[m]*0.4; s[m,2]=l[m]*0.45
def whiten_water(s): # remove residual green tint from the jet
    r,g,b=s[...,0],s[...,1],s[...,2]; l=np.maximum(np.maximum(r,g),b)
    s[...,0]=l*0.86; s[...,1]=l*0.94; s[...,2]=np.minimum(255,l*1.0+10)
def build(name,spec):
    imgs=[]
    for nm,src,(w,h),fx in spec:
        f=src() if callable(src) else src
        f=defringe(f); f=scale(f,w and w*2,h and h*2)
        if fx: f=mod(f,fx)
        imgs.append((nm,f))
    Wt=sum(i.shape[1]+4 for _,i in imgs); Ht=max(i.shape[0] for _,i in imgs)
    sh=np.zeros((Ht,Wt,4),np.float32); x=0; meta={}
    for nm,i in imgs:
        h,w=i.shape[:2]; y=Ht-h; sh[y:y+h,x:x+w]=i; meta[nm]=[x,y,w,h]; x+=w+4
    im=Image.fromarray(sh.clip(0,255).astype(np.uint8),'RGBA'); im.save(name+'_rgba.png')
    q=im.quantize(colors=256,method=Image.FASTOCTREE,dither=Image.FLOYDSTEINBERG); q.save(name+'.png',optimize=True)
    bg=Image.new('RGB',im.size,(60,70,90)); bg.paste(im,(0,0),im); bg.resize((im.width*2,im.height*2),Image.NEAREST).save('view/pack_'+name+'.png')
    print(name,im.size,os.path.getsize(name+'.png')); print(json.dumps(meta)); return meta
M={}
# ---- L2 ----
M['level2_props']=build('level2_props',[
 ('hydrant',frame('l2_props.png',0),(None,26),None),
 ('hole',frame('l2_props2.png',0),(30,None),None),
 ('cover',frame('l2_props.png',2),(24,None),None),
 ('jet',lambda:frame('l2_props2.png',1,extra=(760,200,1575,440)),(120,None),whiten_water),
])
# ---- L6 ----
M['level6_props']=build('level6_props',[
 ('icicle',frame('l6_props.png',0),(None,36),None),
 ('snowball',frame('l6_props.png',1),(10,None),None),
 ('chunk',frame('l6_props.png',2),(15,None),None),
 ('iceblock',frame('l6_props.png',3),(None,50),None),
 ('icepatch',frame('l6_props.png',4),(120,None),None),
 ('plow',frame('l6_plow.png',0,largest=True),(174,None),None),
])
# ---- L8 ----
pyl=frame('l8_props.png',0)
vent=frame('l8_props.png',2)
spec=[('pylonOn',pyl,(None,40),None),('pylonOff',pyl,(None,40),dim_red),
 ('ventHot',vent,(26,None),None),('ventOff',vent,(26,None),dim_orange),
 ('panel',frame('l8_props.png',3),(42,16),None),
 ('cageBase',frame('l8_props.png',4),(38,None),None),
 ('cageTop',frame('l8_glass.png',7),(32,None),None)]
for i in range(7): spec.append((f'glass{i}',frame('l8_glass.png',i),(None,7),None))
M['level8_props']=build('level8_props',spec)
json.dump(M,open('meta.json','w'))
