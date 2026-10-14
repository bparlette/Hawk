from PIL import Image
import numpy as np, json, os, sys
from scipy import ndimage as ndi
from tools import key_green, comps
D8=dict(idle=0,walk=1,walk2=2,attack=3,jump=4,hurt=5,down=6,special=7)
D9=dict(idle=0,walk=1,walk2=2,attack=3,grab=4,jump=5,hurt=6,down=7,special=8)
def d9ng(): d=dict(D9); d.pop('grab'); return d
MAP={
 'street_light':dict(idle=6,walk=0,walk2=1,attack=2,jump=3,hurt=4,down=7,special=8,grab=5),
 'sewer_light':dict(idle=6,walk=0,walk2=1,attack=5,jump=3,hurt=4,down=7,special=8),
 'sewer_weapon':dict(idle=6,walk=0,walk2=1,attack=2,jump=3,hurt=4,down=7,special=8,grab=5),
 'sewer_big':dict(idle=0,walk=1,walk2=3,attack=4,hurt=5,special=6,down=7),
 'street_big':d9ng(),'biker_big':d9ng(),'trooper_weapon':d9ng(),'biker_light':d9ng(),'scrap_light':d9ng(),
}
SPECIAL={'light':'dash','weapon':'throw','big':'shoot'}
FAM={'street':'L1-2','sewer':'L3','biker':'L4','dock':'L5','snow':'L6','scrap':'L7','guard':'L8','edo':'L9','pirate':'L10','swamp':'L11','trooper':'L12-14'}
WALK_H=168  # walk frame stored 168px tall (same as level15_elite); k in the engine maps this to world px
def frame_img(a,lab,c,k):
    x0,y0,x1,y1=c[2:]; sub=a[y0:y1,x0:x1].copy(); mm=lab[y0:y1,x0:x1]==c[0]
    mm=ndi.binary_fill_holes(mm)
    al=np.where(mm,sub[...,3],0)
    al=np.minimum(al,ndi.grey_erosion(al,size=(3,3))*0.5+al*0.5)
    r,g,b=sub[...,0],sub[...,1],sub[...,2]; mx=np.maximum(r,b)
    sub[...,1]=np.where(g>mx+4,mx+(g-mx)*0.15,g)
    sub[...,3]=al
    im=Image.fromarray(sub.clip(0,255).astype(np.uint8),'RGBA')
    im=im.resize((max(1,round(im.width*k)),max(1,round(im.height*k))),Image.LANCZOS)
    bb=im.getbbox(); return im.crop(bb) if bb else im
def anchor(im,name):
    A=np.asarray(im)[...,3]; h=im.height
    if name=='down': return im.width//2
    band=(0.42,0.62) if name not in ('special','attack','jump') else (0.4,0.65)
    ys,xs=np.nonzero(A[int(h*band[0]):int(h*band[1])]>120)
    return int(round(np.median(xs))) if len(xs) else im.width//2
def char_frames(name):
    role=name.split('_')[1]; a=key_green('gen/%s.png'%name); lab,cs=comps(a)
    m=MAP.get(name) or (D9 if len(cs)>=9 else D8)
    wh=[cs[m[w]][5]-cs[m[w]][3] for w in ('walk','walk2') if w in m]; WALK=sum(wh)/len(wh); k=WALK_H/WALK
    out=[]
    for fn,idx in m.items():
        c=cs[idx]; kk=k
        if fn not in ('down','jump','special') and (c[5]-c[3])>WALK*1.02: kk=k*WALK*0.98/(c[5]-c[3])  # model drew this pose larger: match the walk height
        hr=(c[5]-c[3])/WALK
        if role!='light' and fn in ('attack','special') and 0.6<hr<0.9: kk=k*0.92/hr  # upright swing/throw/shoot drawn smaller than the walk: match it
        im=frame_img(a,lab,c,kk); n=SPECIAL[role] if fn=='special' else fn
        out.append((n,im,anchor(im,fn)))
    return out
def pack(fam):
    rows=[(r,char_frames('%s_%s'%(fam,r))) for r in ('light','weapon','big') if os.path.exists('gen/%s_%s.png'%(fam,r))]
    W=max(sum(f.width+4 for _,f,_ in fr)+4 for _,fr in rows); H=sum(max(f.height for _,f,_ in fr)+4 for _,fr in rows)
    out=Image.new('RGBA',(W,H),(0,0,0,0)); meta={}; y=0
    for r,fr in rows:
        rh=max(f.height for _,f,_ in fr); x=4; m={}
        for n,f,ax in fr:
            yy=y+rh-f.height; out.paste(f,(x,yy)); m[n]=[x,yy,f.width,f.height,ax]; x+=f.width+4
        meta[r]=m; y+=rh+4
    return out,meta
if __name__=='__main__':
    os.makedirs('out',exist_ok=True); allm=json.load(open('out/meta.json')) if os.path.exists('out/meta.json') else {}
    for fam in sys.argv[1:]:
        im,meta=pack(fam)
        q=im.quantize(256,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.FLOYDSTEINBERG)
        im.save('out/enemies_%s_rgba.png'%fam,optimize=True); q.save('out/enemies_%s.png'%fam,optimize=True)
        allm[fam]=meta; print(fam,im.size,os.path.getsize('out/enemies_%s_rgba.png'%fam),os.path.getsize('out/enemies_%s.png'%fam))
    json.dump(allm,open('out/meta.json','w'))
