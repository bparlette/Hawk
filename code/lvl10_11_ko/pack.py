import numpy as np, json
from PIL import Image
from seg import load, comps
L='/workspace/work/deploy/shell-shock-live-action/levels/'
cfg={
 'l10':dict(gen='l10ko_gen1.png',sheet='level10_armaggon.png',scale=0.40,flip=[True,True,False],hip=[430,442,408],names=['fall','lie','getup']),
 'l11':dict(gen='l11ko_gen1.png',sheet='level11_gator.png',scale=0.42,flip=[False,False,False],hip=[400,402,310],names=['fall','lie','getup']),
}
import sys
meta={}
for k,c in cfg.items():
    a=load(c['gen']); cs=comps(a)
    old=Image.open(L+c['sheet']).convert('RGBA')
    frames=[]
    for (s,sub),fl,hip,nm in zip(cs,c['flip'],c['hip'],c['names']):
        im=Image.fromarray(sub)
        if fl: im=im.transpose(Image.FLIP_LEFT_RIGHT); hip=im.width-hip
        bb=im.getbbox(); im=im.crop(bb); hip-=bb[0]
        w,h=round(im.width*c['scale']),round(im.height*c['scale'])
        im=im.resize((w,h),Image.LANCZOS); frames.append((nm,im,round(hip*c['scale'])))
    W=old.width+sum(f[1].width+4 for f in frames); H=max(old.height,max(f[1].height for f in frames))
    out=Image.new('RGBA',(W,H)); out.paste(old,(0,H-old.height)); x=old.width+4; m={}
    for nm,im,hip in frames:
        out.paste(im,(x,H-im.height)); m[nm]=[x,H-im.height,im.width,im.height,hip]; x+=im.width+4
    assert H==old.height, (k,H)
    out.save(k+'_rgba.png')
    q=out.quantize(256,method=Image.FASTOCTREE); q.save(k+'_'+c['sheet'],optimize=True)
    meta[k]=m
json.dump(meta,open('meta.json','w')); print(meta)
