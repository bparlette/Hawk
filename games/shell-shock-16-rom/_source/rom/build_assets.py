# Converts the Shell Shock painted art into Genesis-legal SGDK resources (Auto 16-bit look).
# Every colour snapped to the 9-bit Genesis master palette; 4 palettes x 15 colours + transparent.
import numpy as np, json
from PIL import Image
from sklearn.cluster import MiniBatchKMeans
SRC='/workspace/work/deploy/shell-shock-live-action/'; OUT='/workspace/work/g16/rom/res/'
LV=np.array([0,36,73,109,146,182,219,255])
def snap(c): c=np.asarray(c,float); return LV[np.abs(c[...,None]-LV).argmin(-1)].astype(np.uint8)
def nearest(px,pal): return ((px[:,None,:].astype(int)-pal[None].astype(int))**2).sum(-1).argmin(1)
def lanczos(fr,k):
    w,h=fr.size; return fr.resize((max(1,round(w*k)),max(1,round(h*k))),Image.LANCZOS)
def save_indexed(idx,pal,path):  # idx: HxW uint8, pal: list of rgb (<=256)
    im=Image.fromarray(idx.astype(np.uint8),'P'); flat=[int(v) for c in pal for v in c]; flat+= [0]*(768-len(flat)); im.putpalette(flat)
    im.save(path, transparency=0)
# ---------------- sprites ----------------
def frames_from(src, frames, k):
    im=Image.open(SRC+src).convert('RGBA'); out={}
    for fn,f in frames.items():
        x,y,w,h=f[:4]; ax=f[4] if len(f)>4 else w/2
        t=lanczos(im.crop((x,y,x+w,y+h)),k); a=np.array(t); a[:,:,3]=np.where(a[:,:,3]>110,255,0); t=Image.fromarray(a)
        bb=t.getbbox(); t=t.crop(bb); out[fn]=(t, round(ax*k)-bb[0])
    return out
def joint_palette(framesets,n=15):
    px=np.concatenate([np.array(t)[np.array(t)[:,:,3]>0][:,:3] for fs in framesets for t,_ in fs.values()])
    side=int(np.ceil(np.sqrt(len(px)))); buf=np.zeros((side*side,3),np.uint8); buf[:len(px)]=px; buf[len(px):]=px[0]
    img=Image.fromarray(buf.reshape(side,side,3))
    for m in range(n,40):
        q=img.quantize(m,method=Image.FASTOCTREE,kmeans=4,dither=Image.NONE)
        cnt=np.bincount(np.array(q).ravel(),minlength=m); P=snap(np.array(q.getpalette()[:m*3]).reshape(m,3))
        u={}
        for i in np.argsort(-cnt):
            k=tuple(P[i]); u.setdefault(k,0); u[k]+=cnt[i]
        if len(u)>=n: break
    pal=np.array(sorted(u,key=lambda k:-u[k])[:n],np.uint8)
    return pal
def sheet(name, fs, rows, cw, ch, pal, pad_to=None):
    # rows: list of lists of frame names; cell cw x ch tiles; feet at cell bottom, anchor at cell centre
    W=cw*8; H=ch*8; ncol=max(len(r) for r in rows); idx=np.zeros((H*len(rows),W*ncol),np.uint8)
    for ri,r in enumerate(rows):
        for ci,fn in enumerate(r):
            t,ax=fs[fn]; a=np.array(t); m=a[:,:,3]>0; ii=np.zeros(m.shape,np.uint8); ii[m]=nearest(a[m][:,:3],pal)+1
            ox=W//2-ax; oy=H-ii.shape[0]
            for yy in range(ii.shape[0]):
                Y=oy+yy
                if Y<0: continue
                for_x=np.arange(ii.shape[1])+ox; ok=(for_x>=0)&(for_x<W)
                row=ii[yy,ok]; dst=idx[ri*H+Y, ci*W+for_x[ok]]; idx[ri*H+Y, ci*W+for_x[ok]]=np.where(row>0,row,dst)
    p=[(255,0,255)]+[tuple(c) for c in pal]; p+= [(0,0,0)]*(16-len(p)); save_indexed(idx,p,OUT+name+'.png')
    return idx
K=0.41
lenny=frames_from('atlas_lenny.png',{'idle':[0,7,122,150],'walk':[124,8,85,149],'walk2':[211,12,115,145],'attack':[328,17,173,140],'jump':[503,25,164,132],'hurt':[669,0,95,157],'down':[766,101,158,56]},K)
spin=frames_from('sp_lenny.png',{"spin1":[0,0,297,132],"spin2":[301,2,279,130]},K)
ram=frames_from('atlas_ramrod.png',{'idle':[0,0,117,190],'walk':[119,4,127,186],'charge':[248,24,161,166],'kick':[411,4,153,186],'fire':[566,7,157,183],'hurt':[725,13,132,177],'down':[859,126,196,64]},K)
E=json.load(open('/dev/stdin')) if False else None
ES={"light":({"idle":[4,0,102,165,49],"walk":[110,0,90,165,44],"walk2":[204,2,83,163,38],"attack":[291,23,122,142,53],"hurt":[558,23,79,142,39],"down":[641,124,183,41,91]},0.38),
    "weapon":({"idle":[4,173,60,165,32],"walk":[68,169,80,169,38],"walk2":[152,171,87,167,43],"attack":[243,182,145,156,50],"hurt":[470,195,101,143,66],"down":[575,297,178,41,89]},0.38),
    "big":({"idle":[4,348,91,163,40],"walk":[99,342,82,169,38],"walk2":[185,344,93,167,48],"attack":[282,348,146,163,54],"hurt":[539,360,104,151,62],"down":[647,461,183,50,91]},0.40)}
punks={k:frames_from('levels/enemies_street.png',v,s) for k,(v,s) in ES.items()}
palL=joint_palette([lenny,spin]); palE=joint_palette([ram]+list(punks.values()))
print('lenny pal',len(palL),'enemy pal',len(palE))
std=[['idle'],['walk','idle','walk2','idle'],['attack'],['hurt'],['down']]
sheet('spr_lenny',lenny,[['idle'],['walk','idle','walk2','idle'],['attack'],['jump'],['hurt'],['down']],10,8,palL)
sheet('spr_spin',spin,[['spin1','spin2']],16,7,palL)
for k in punks: sheet('spr_'+k,punks[k],std,9,9,palE)
sheet('spr_ramrod',ram,[['idle'],['walk','idle'],['charge'],['kick'],['fire'],['hurt'],['down']],10,10,palE)
# ---------------- background ----------------
bg=Image.open(SRC+'l1_lobby.jpg').convert('RGB'); w,h=bg.size; g=bg.resize((round(w*224/h),224),Image.LANCZOS)
X0=110; g=np.array(g)[:, X0:X0+640]
SPLIT=19  # tile rows 0..18 walls (PAL0), 19..27 floor (PAL1)
def band_pal(arr,n):
    q=Image.fromarray(arr).quantize(n,method=Image.FASTOCTREE,kmeans=4,dither=Image.NONE)
    return np.unique(snap(np.array(q.getpalette()[:n*3]).reshape(n,3)),axis=0)
top=g[:SPLIT*8]; flo=g[SPLIT*8:]
pA=band_pal(top,12); pB=band_pal(flo,15)
def reduce_tiles(arr,pal,K):
    H,W,_=arr.shape; T=arr.reshape(H//8,8,W//8,8,3).transpose(0,2,1,3,4).reshape(-1,192).astype(float)
    km=MiniBatchKMeans(K,random_state=1,n_init=3,batch_size=2048).fit(T); C=km.cluster_centers_[km.labels_]
    out=C.reshape(H//8,W//8,8,8,3).transpose(0,2,1,3,4).reshape(H,W,3)
    return nearest(out.reshape(-1,3),pal).reshape(H,W)
iA=reduce_tiles(top,pA,620)+1; iB=reduce_tiles(flo,pB,300)+1
idx=np.vstack([iA, iB+16]).astype(np.uint8)
YEL=(255,219,0); WHT=(255,255,255)
P0=[(0,0,0)]+[tuple(c) for c in pA]; P0+=[(0,0,0)]*(13-len(P0)); P0+= [(0,0,0),YEL,WHT]
P1=[(0,0,0)]+[tuple(c) for c in pB]; P1+=[(0,0,0)]*(16-len(P1))
save_indexed(idx,P0+P1,OUT+'bg_lobby.png')
A=idx; T=set()
for y in range(0,224,8):
    for x in range(0,640,8): T.add(A[y:y+8,x:x+8].tobytes())
print('bg unique tiles',len(T))
prev=np.array(P0+P1,np.uint8)[idx]; Image.fromarray(prev).save('/workspace/work/g16/rom/bg_preview.png')
# ---------------- title ----------------
tb=Image.open(SRC+'title_bg.jpg').convert('RGBA'); tb=tb.resize((round(tb.size[0]*224/tb.size[1]),224),Image.LANCZOS); x0=(tb.size[0]-320)//2; tb=tb.crop((x0,0,x0+320,224))
lg=Image.open(SRC+'title_logo.png').convert('RGBA'); lg=lanczos(lg,280/lg.size[0]); tb.alpha_composite(lg,((320-lg.size[0])//2,18))
ta=np.array(tb.convert('RGB')); pT=band_pal(ta,14)
iT=reduce_tiles(ta,pT,900)+1
PT=[(0,0,0)]+[tuple(c) for c in pT]; PT+=[(0,0,0)]*(15-len(PT)); PT+=[WHT]
save_indexed(iT.astype(np.uint8),PT,OUT+'title.png'); Image.fromarray(np.array(PT,np.uint8)[iT]).save('/workspace/work/g16/rom/title_preview.png')
