from PIL import Image
import numpy as np, json, os
from scipy import ndimage as ndi
from seg import load, comps
S='/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/levels/'
_c={}
def frame(f,idx,k):
    if f not in _c: a=load(f); _c[f]=(a,)+comps(a)
    a,lab,cs=_c[f]; c=cs[idx]; m=lab==c[0]
    x0,y0,x1,y1=c[2:]; sub=a[y0:y1,x0:x1].copy(); mm=m[y0:y1,x0:x1]
    al=np.where(mm,sub[...,3],0)
    al=np.minimum(al,ndi.grey_erosion(al,size=(3,3))*0.5+al*0.5)
    r,g,b=sub[...,0],sub[...,1],sub[...,2]; mx=np.maximum(r,b)
    sub[...,1]=np.where(g>mx+8,mx+(g-mx)*0.2,g)   # despill
    sub[...,3]=al
    im=Image.fromarray(sub.clip(0,255).astype(np.uint8),'RGBA')
    return im.resize((max(1,round(im.width*k)),max(1,round(im.height*k))),Image.LANCZOS)
def anchor(im,lying=False,band=(0.3,0.7)):
    A=np.asarray(im)[...,3]
    if lying: return im.width//2
    h=im.height; ys,xs=np.nonzero(A[int(h*band[0]):int(h*band[1])]>100)
    return int(round(np.median(xs))) if len(xs) else im.width//2
def append(base,frames):
    W=base.width+sum(f.width+4 for _,f,_ in frames)+4; H=max([base.height]+[f.height for _,f,_ in frames])
    out=Image.new('RGBA',(W,H),(0,0,0,0)); out.paste(base,(0,0)); x=base.width+4; meta={}
    for n,f,ax in frames:
        y=H-f.height; out.paste(f,(x,y)); meta[n]=[x,y,f.width,f.height,ax]; x+=f.width+4
    return out,meta
meta={}
# ---- Shredder: keep old 5 frames byte-for-byte position, append fall/down/ko/taunt
K=190/512
old=Image.open(S+'level15_shredder.png').convert('RGBA')
fall=frame('k_shred_fall.png',0,K*0.85)
down=frame('k_shred_new.png',3,K)          # face-down, head right
ko=frame('k_shred_kneel.png',0,140/1082)   # defeated kneel
taunt=frame('k_shred_new.png',4,K)
fr=[('fall',fall,anchor(fall,band=(0.45,0.75))),('down',down,anchor(down,True)),('ko',ko,anchor(ko,band=(0.45,0.8))),('taunt',taunt,anchor(taunt))]
sh,m=append(old,fr); sh.save('level15_shredder.png',optimize=True); meta['shredder']=m
# ---- Super: append fall + ko (kneel), keep existing down
K2=260/712
olds=Image.open(S+'level15_super.png').convert('RGBA')
sf=frame('k_super_new.png',0,K2); sk=frame('k_super_new.png',2,K2)
su,m=append(olds,[('fall',sf,anchor(sf,band=(0.45,0.75))),('ko',sk,anchor(sk,band=(0.4,0.8)))]); su.save('level15_super.png',optimize=True); meta['super']=m
# ---- Elite: new sheet, idle stored 160px
ke=160/484
spec=[('idle','k_elite.png',0),('walk','k_elite.png',1),('walk2','k_elite2.png',3),('attack','k_elite.png',2),('jump','k_elite.png',3),('hurt','k_elite.png',4),
      ('down','k_elite.png',5),('throw','k_elite2.png',0),('grab','k_elite2.png',1),('dash','k_elite2.png',2)]
fr=[]
for n,f,i in spec:
    im=frame(f,i,ke)
    A=np.asarray(im).astype(int); r,g,b,a=[A[...,j] for j in range(4)]
    h=im.height; yy=np.mgrid[0:h,0:im.width][0]
    sash=(a>150)&(r>90)&(r>g*2.2)&(r>b*1.8)&(yy>h*0.3)&(yy<h*0.7)
    ys,xs=np.nonzero(sash)
    ax=im.width//2 if n=='down' else anchor(im,band=(0.45,0.62))
    fr.append((n,im,ax))
el,m=append(Image.new('RGBA',(1,1)),fr); el.save('level15_elite.png',optimize=True); meta['elite']=m
for f in ['level15_shredder.png','level15_super.png','level15_elite.png']: print(f,Image.open(f).size,os.path.getsize(f))
json.dump(meta,open('meta.json','w')); print(json.dumps(meta))
