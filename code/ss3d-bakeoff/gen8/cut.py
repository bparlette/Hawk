import numpy as np, json
from PIL import Image, ImageDraw
from scipy import ndimage
def figs(path):
    im=Image.open(path).convert('RGBA'); A=np.array(im); a=A[:,:,3]>40
    lab,n=ndimage.label(a, structure=np.ones((3,3)))
    sizes=ndimage.sum(a,lab,range(1,n+1)); objs=ndimage.find_objects(lab)
    big=[i for i in range(n) if sizes[i]>8000]
    cent={i:((objs[i][1].start+objs[i][1].stop)/2,(objs[i][0].start+objs[i][0].stop)/2) for i in big}
    assign={i:i for i in big}
    for i in range(n):
        if i in assign or sizes[i]<30: continue
        s=objs[i]; cx=(s[1].start+s[1].stop)/2; cy=(s[0].start+s[0].stop)/2
        # nearest big whose bbox vertically contains it, by horizontal distance to bbox
        best=min(big,key=lambda b: max(0,objs[b][1].start-cx,cx-objs[b][1].stop)+ (0 if objs[b][0].start-20<=cy<=objs[b][0].stop+20 else 9999))
        assign[i]=best
    out=[]
    for b in sorted(big,key=lambda b:(round(cent[b][1]/300),cent[b][0])):
        m=np.isin(lab,[i+1 for i,v in assign.items() if v==b])
        ys,xs=np.where(m); y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
        C=A[y0:y1,x0:x1].copy(); C[~m[y0:y1,x0:x1]]=0
        out.append(Image.fromarray(C))
    return out
names=['lenny','rafe','miko','donny','thug2']
sheet=Image.new('RGB',(2400,1400),(255,0,255)); d=ImageDraw.Draw(sheet); y=0
for nm in names:
    F=figs(f'turn_{nm}.png'); x=0
    for i,f in enumerate(F):
        f.save(f'fig_{nm}_{i}.png'); t=f.resize((max(1,f.width*260//max(f.height,1)),260)); sheet.paste(t,(x,y),t); d.text((x+5,y+5),f'{nm}{i}',fill=(255,255,255)); x+=t.width+10
    y+=275
sheet.save('figs.png')
