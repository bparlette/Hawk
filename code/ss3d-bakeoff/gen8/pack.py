import numpy as np, json
from PIL import Image, ImageOps
def trim(im):
    bb=im.getbbox(); return im.crop(bb)
def lenny_cuts():
    im=Image.open('turn_lenny.png').convert('RGBA'); row=im.crop((0,555,im.width,1005)); a=np.array(row)[:,:,3]>40
    col=a.sum(0); cuts=[]
    for lo,hi in [(240,300),(470,530),(690,760)]:
        cuts.append(lo+int(np.argmin(col[lo:hi])))
    xs=[0]+cuts+[im.width]; return [trim(row.crop((xs[i],0,xs[i+1],row.height))) for i in range(4)]
def figs(nm, idx): return [trim(Image.open(f'fig_{nm}_{i}.png')) for i in idx]
SETS={
 'lenny': (lenny_cuts(), [0,0,1,0], 300),
 'rafe': (figs('rafe',[0,1,4,2]), [0,0,0,0], 300),
 'miko': (figs('miko',[4,5,6,7]), [0,0,0,0], 300),
 'donny': (figs('donny',[0,1,2,3]), [0,0,0,0], 300),
 'thug': (figs('thug2',[0,1,2,3]), [0,0,0,0], 330),
}
meta={}
for nm,(F,mir,H) in SETS.items():
    out=[]
    for f,m in zip(F,mir):
        if m: f=ImageOps.mirror(f)
        w=round(f.width*H/f.height); out.append(f.resize((w,H),Image.LANCZOS))
    W=sum(o.width+4 for o in out); sheet=Image.new('RGBA',(W,H+4),(0,0,0,0)); x=2; fr=[]
    for o in out:
        sheet.paste(o,(x,2)); fr.append([x,2,o.width,H]); x+=o.width+4
    # alpha cleanup: kill green fringe
    A=np.array(sheet).astype(np.int16); g=A[:,:,1]; r=A[:,:,0]; b=A[:,:,2]
    spill=(g>r+20)&(g>b+20)&(A[:,:,3]<250); A[spill,1]=np.maximum(r[spill],b[spill])
    Image.fromarray(A.clip(0,255).astype(np.uint8)).save(f'../site/v8_{nm}.webp',quality=90,method=6)
    meta[nm]=fr
json.dump(meta,open('v8meta.json','w')); print(json.dumps(meta))
