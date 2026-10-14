import sys,os,json,numpy as np
from PIL import Image
RAW='raw'; mom=json.load(open('_tmp/moments.json'))
L=144
def load(d,i,s=4):
    meta=[json.loads(l) for l in open(f'{RAW}/{d}/meta.jsonl')]
    return meta
for n in range(1,16):
    d=f'level{n}'; st=mom[str(n)][0]
    meta=[json.loads(l) for l in open(f'{RAW}/{d}/meta.jsonl')]
    fr=[np.asarray(Image.open(f'{RAW}/{d}/frames/'+meta[min(len(meta)-1,st+t)]['file']).convert('L').resize((288,168)),dtype=np.float32) for t in range(-4,L)]
    xs=[];ys=[]
    for t in range(4,len(fr)):
        df=np.abs(fr[t]-fr[t-4]); df[:int(.36*168)]=0; df[int(.92*168):]=0
        df[df<25]=0
        if df.sum()<50: xs.append(np.nan);ys.append(np.nan);continue
        col=df.sum(0); row=df.sum(1)
        xs.append((col*np.arange(288)).sum()/col.sum()/288); ys.append((row*np.arange(168)).sum()/row.sum()/168)
    xs=np.array(xs);ys=np.array(ys)
    print(n, 'x mean %.2f min %.2f max %.2f  y %.2f nan %d'%(np.nanmean(xs),np.nanmin(xs),np.nanmax(xs),np.nanmean(ys),np.isnan(xs).sum()), ' '.join('%.2f'%v for v in xs[::12]))
