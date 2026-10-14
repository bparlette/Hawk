# fit a generated zone-2 painting to the zone-1 bg size, aligning the floor-top line, then wrap-fade the seam
import sys, numpy as np
from PIL import Image
L='/workspace/work/deploy/shell-shock-live-action/levels/'
# level: (zone1 file, gen file, gen floor-top y (gen px), world floor top, out name)
J={8:('level8_fortress','l8_z2.png',430,172,'level8_reactor.jpg'),
   9:('level9_edo','l9_z2.png',430,172,'level9_bamboo.jpg'),
   10:('level10_galleon','l10_z2.png',380,166,'level10_gundeck.jpg'),
   11:('level11_train','r815_l11_z2b.png',410,147,'level11_saloon.jpg'),
   12:('level12_skyway','r815_l12_z2b.png',410,170,'level12_station.jpg'),
   13:('level13_dimx','l13_z2.png',350,150,'level13_canyon.jpg'),
   14:('level14_portal','r815_l14_z2b.png',430,170,'level14_elstreet.jpg'),
   15:('level15_lab','r815_l15_z2b.png',430,178,'level15_dojo.jpg')}
def fit(n, yfg=None):
    z1,g,yf,wf,out=J[n]; yf=yfg or yf
    W,H=Image.open(L+z1+'.jpg').size; yt=round(wf*H/224)
    im=Image.open('gen/'+g).convert('RGB'); gw,gh=im.size
    s=max(yt/yf,(H-yt)/(gh-yf), H/gh)          # vertical scale so floor lands at yt with enough floor below
    sx=W/gw
    if sx < s: sx = s                            # never squash horizontally more than vertical; crop width instead
    if sx/s > 1.10: s = sx/1.10                  # cap anisotropy at 10%
    r=im.resize((round(gw*sx),round(gh*s)),Image.LANCZOS)
    top=max(0,min(r.height-H,round(yf*s-yt))); left=(r.width-W)//2
    c=np.asarray(r.crop((left,top,left+W,top+H))).astype(np.float32)
    F=64; a=np.linspace(0,1,F)[None,:,None]       # fade the right edge into the left edge's mirror so tiles join
    c[:,W-F:]=c[:,W-F:]*(1-a)+c[:,:F][:,::-1]*a
    Image.fromarray(c.clip(0,255).astype(np.uint8)).save('out/'+out,quality=88,optimize=True)
    print(n,out,(W,H),'floor@',yt,'scale',round(sx,3),round(s,3),'top',top)
if __name__=='__main__':
    for n in J: fit(n)
