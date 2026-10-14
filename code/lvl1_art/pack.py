from PIL import Image, ImageDraw
import numpy as np, json, os, sys
from scipy import ndimage as ndi
from seg import load
OUT_H_IDLE=190                  # idle stored height -> drawn at k=BOSS_ATLAS_K.ramrod*0.92 like the old tinted sheet
SC={'A':1.0,'B':1.0,'C':1.0}    # cross-sheet calibration (relative pixel scale of each raw sheet vs A)
if os.path.exists('sc.json'): SC.update(json.load(open('sc.json')))
NAMES={'A':['idle','walk1','walk2','tele','charge'],'B':['kwind','kick','throw1','throw2','release','hurt'],'C':['down','getup1','getup2','daze']}
def frames(s):
    a=load(f'scorch_{s}.png'); m=a[...,3]>40
    lab,n=ndi.label(m,structure=np.ones((3,3))); sl=ndi.find_objects(lab); cnt=ndi.sum(m,lab,range(1,n+1))
    big=[i for i in range(n) if cnt[i]>=20000]; big.sort(key=lambda i:sl[i][1].start)
    groups={i:[i] for i in big}
    for i in range(n):
        if i in big or cnt[i]<60: continue
        cx=(sl[i][1].start+sl[i][1].stop)/2
        # attach to the big comp whose x-range (padded) contains / is nearest
        best=min(big,key=lambda b:max(0,sl[b][1].start-cx,cx-sl[b][1].stop))
        if max(0,sl[best][1].start-cx,cx-sl[best][1].stop)<60: groups[best].append(i)
    out=[]
    for b in big:
        mm=np.isin(lab,[g+1 for g in groups[b]])
        ys,xs=np.nonzero(mm); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
        sub=a[y0:y1,x0:x1].copy(); msk=mm[y0:y1,x0:x1]
        al=np.where(msk,sub[...,3],0)
        al=np.minimum(al,ndi.grey_erosion(al,size=(3,3))*0.5+al*0.5)   # soften 1px fringe
        r,g,bb=sub[...,0],sub[...,1],sub[...,2]; mx=np.maximum(r,bb)
        g=np.where(g>mx+4,mx+(g-mx)*0.2,g)                               # despill chroma green
        out.append(np.dstack([r,g,bb,al]).clip(0,255).astype(np.uint8))
    return out
raw={s:frames(s) for s in 'ABC'}
for s in raw: assert len(raw[s])==len(NAMES[s]),(s,len(raw[s]))
base=OUT_H_IDLE/raw['A'][0].shape[0]
imgs=[]
for s in 'ABC':
    for nm,f in zip(NAMES[s],raw[s]):
        k=base/SC[s]; im=Image.fromarray(f,'RGBA')
        if nm=='down': im=im.transpose(Image.FLIP_LEFT_RIGHT)  # falls backward: head behind him (left when facing right)
        imgs.append((nm,im.resize((max(1,round(im.width*k)),max(1,round(im.height*k))),Image.LANCZOS)))
def anchor(nm,im):
    A=np.asarray(im).astype(int); h,w=A.shape[:2]; r,g,b,a=[A[...,i] for i in range(4)]
    if nm=='down': return int(w*0.5)
    # hip centre: median x of the brown welder's apron / belt band (falls back to opaque median)
    yy=np.mgrid[0:h,0:w][0]; band=(yy>h*0.45)&(yy<h*0.62)&(a>150)
    apr=band&(r>70)&(r>g+12)&(g>b+8)&(r<200)
    xs=np.nonzero(apr)[1] if apr.sum()>80 else np.nonzero(band)[1]
    return int(np.median(xs))
Wt=sum(im.width+4 for _,im in imgs); Ht=max(im.height for _,im in imgs)
sheet=Image.new('RGBA',(Wt,Ht),(0,0,0,0)); x=0; meta={}
for nm,im in imgs:
    y=Ht-im.height; sheet.paste(im,(x,y)); meta[nm]=[x,y,im.width,im.height,anchor(nm,im)]; x+=im.width+4
OVR={'kick':56,'kwind':78}   # one-leg poses: hip sits over the standing foot, apron median drifts with the raised leg
for nm,v in OVR.items(): meta[nm][4]=v
sheet.save('scorcher_rgba.png')
q=sheet.quantize(colors=256,method=Image.FASTOCTREE,dither=Image.FLOYDSTEINBERG)
q.save('atlas_scorcher.png',optimize=True)
json.dump(meta,open('meta.json','w'))
print(sheet.size,os.path.getsize('atlas_scorcher.png'),json.dumps(meta))
# review: every frame over a 35% ghost of idle, anchors aligned
ix,iy,iw,ih,iax=meta['idle']; ic=sheet.crop((ix,iy,ix+iw,iy+ih)); gh=ic.copy(); gh.putalpha(gh.split()[3].point(lambda v:v*0.35))
names=list(meta); cols=8
out=Image.new('RGB',(cols*240,((len(names)+cols-1)//cols)*230),(50,55,90)); d=ImageDraw.Draw(out)
for i,nm in enumerate(names):
    fx,fy,fw,fh,ax=meta[nm]; c=sheet.crop((fx,fy,fx+fw,fy+fh)); X=120+(i%cols)*240; Y=215+(i//cols)*230
    out.paste(gh,(X-iax,Y-ih),gh); out.paste(c,(X-ax,Y-fh),c); d.line([X,Y-205,X,Y],fill=(0,255,255)); d.text((X-110,Y+2),nm,fill=(255,255,0))
out.save('view/pack.png')
