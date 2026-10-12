# Auto 16-bit conversion: Lanczos down to Genesis scale, 16-colour octree+kmeans, snap to 9-bit (3 bits/channel).
import json, numpy as np
from PIL import Image, ImageFilter
SRC='/workspace/work/deploy/shell-shock-live-action/'; OUT='/workspace/work/g16/game/'
def g9(a): return (np.round(np.asarray(a)/255*7)*255/7).astype(np.uint8)
def auto(fr,k,ncol=16):
    w,h=fr.size; fr=fr.resize((max(1,round(w*k)),max(1,round(h*k))),Image.LANCZOS)
    a=np.array(fr)[:,:,3]>110
    rgb=Image.new('RGB',fr.size); rgb.paste(fr,mask=Image.fromarray((a*255).astype(np.uint8)))
    q=np.array(rgb.quantize(ncol,method=Image.FASTOCTREE,kmeans=4,dither=Image.NONE).convert('RGB'))
    out=np.zeros((*a.shape,4),np.uint8); out[:,:,:3]=g9(q); out[:,:,3]=a*255
    im=Image.fromarray(out); return im
def sheet(name, src, frames, k, flipdefault=False):
    im=Image.open(SRC+src).convert('RGBA'); outs={}; tiles=[]
    for fn,f in frames.items():
        x,y,w,h=f[:4]; ax=f[4] if len(f)>4 else w/2
        c=im.crop((x,y,x+w,y+h)); bb=c.getbbox(); 
        t=auto(c,k); tb=t.getbbox() or (0,0,1,1)
        t=t.crop(tb); axs=round(ax*k)-tb[0]; foot=t.size[1]  # feet = bottom of crop
        tiles.append((fn,t,axs))
    W=sum(t.size[0]+2 for _,t,_ in tiles); H=max(t.size[1] for _,t,_ in tiles)
    S=Image.new('RGBA',(W,H)); x=0; fr={}
    for fn,t,axs in tiles:
        S.paste(t,(x,H-t.size[1])); fr[fn]=[x,H-t.size[1],t.size[0],t.size[1],axs]; x+=t.size[0]+2
    S.save(OUT+name+'.png'); return fr
F={}
A={'lenny':{'idle':[0,7,122,150],'walk':[124,8,85,149],'walk2':[211,12,115,145],'attack':[328,17,173,140],'jump':[503,25,164,132],'hurt':[669,0,95,157],'down':[766,101,158,56]},
   'ramrod':{'idle':[0,0,117,190],'walk':[119,4,127,186],'charge':[248,24,161,166],'kick':[411,4,153,186],'fire':[566,7,157,183],'hurt':[725,13,132,177],'down':[859,126,196,64]}}
F['lenny']=sheet('lenny','atlas_lenny.png',A['lenny'],0.41)
F['ramrod']=sheet('ramrod','atlas_ramrod.png',A['ramrod'],0.41)
F['spin']=sheet('lenny_sp','sp_lenny.png',{"spin1":[0,0,297,132],"spin2":[301,2,279,130],"land":[584,25,193,107]},0.41)
ES={"light":{"idle":[4,0,102,165,49],"walk":[110,0,90,165,44],"walk2":[204,2,83,163,38],"attack":[291,23,122,142,53],"jump":[417,22,137,143,60],"hurt":[558,23,79,142,39],"down":[641,124,183,41,91]},
    "weapon":{"idle":[4,173,60,165,32],"walk":[68,169,80,169,38],"walk2":[152,171,87,167,43],"attack":[243,182,145,156,50],"jump":[392,172,74,166,48],"hurt":[470,195,101,143,66],"down":[575,297,178,41,89],"throw":[757,185,115,153,56]},
    "big":{"idle":[4,348,91,163,40],"walk":[99,342,82,169,38],"walk2":[185,344,93,167,48],"attack":[282,348,146,163,54],"jump":[432,356,103,155,44],"hurt":[539,360,104,151,62],"down":[647,461,183,50,91]}}
for k,v in ES.items(): F[k]=sheet('punk_'+k,'levels/enemies_street.png',v,0.38 if k!='big' else 0.40)
# shared props: pizza, barrel, crate
F['props']=sheet('props','shared_sprites.png',{"barrel":[0,7,79,129],"crate":[204,34,104,102],"pizza":[460,12,136,124],"slice":[600,52,75,84]},0.22)
# portraits (72px tiles)
P=Image.open(SRC+'hud_portraits.png').convert('RGBA'); pr=[]
for i in (0,4):
    t=P.crop((i*72,0,i*72+72,72)); pr.append(auto(t,24/72,15))
S=Image.new('RGBA',(50,24)); S.paste(pr[0],(0,0)); S.paste(pr[1],(26,0)); S.save(OUT+'portraits.png')
# background: lobby to 224 tall, 31 colours, no dither, light mode filter
bg=Image.open(SRC+'l1_lobby.jpg').convert('RGB'); w,h=bg.size; g=bg.resize((round(w*224/h),224),Image.LANCZOS)
q=g.quantize(31,method=Image.FASTOCTREE,kmeans=6,dither=Image.NONE).convert('RGB')
Q=Image.fromarray(g9(np.array(q))); Q.save(OUT+'lobby.png')
a=np.array(Q); T=set(a[y:y+8,x:x+8].tobytes() for y in range(0,224,8) for x in range(0,a.shape[1]-7,8))
print('bg',Q.size,'tiles',len(T),'colors',len(np.unique(a.reshape(-1,3),axis=0)))
# title logo
L=Image.open(SRC+'title_logo.png').convert('RGBA'); k=250/L.size[0]; auto(L,k,16).save(OUT+'logo.png')
tb=Image.open(SRC+'title_bg.jpg').convert('RGB'); tb=tb.resize((round(tb.size[0]*224/tb.size[1]),224),Image.LANCZOS); x0=(tb.size[0]-320)//2; tb=tb.crop((x0,0,x0+320,224))
Image.fromarray(g9(np.array(tb.quantize(24,method=Image.FASTOCTREE,kmeans=4,dither=Image.NONE).convert('RGB')))).save(OUT+'title_bg.png')
json.dump(F,open(OUT+'frames.json','w'),separators=(',',':'))
for k,v in F.items(): print(k,{f:(d[2],d[3]) for f,d in v.items()})
