from PIL import Image
import numpy as np
from seg import load, comps
S='/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/levels/'
def frame(f,idx):
    a=load(f); lab,cs=comps(a); c=cs[idx]; m=lab==c[0]
    x0,y0,x1,y1=c[2:]; sub=a[y0:y1,x0:x1].copy(); sub[...,3]*=m[y0:y1,x0:x1]
    return Image.fromarray(sub.clip(0,255).astype(np.uint8))
sh=Image.open(S+'level15_shredder.png').convert('RGBA'); idle=sh.crop((0,0,102,190))
K=190/512
out=Image.new('RGB',(1100,260),(60,70,90)); x=10
out.paste(idle,(x,240-190),idle); x+=110
for s in (0.75,0.85,0.95):
    f=frame('k_shred_fall.png',0); f=f.resize((int(f.width*K*s),int(f.height*K*s)),Image.LANCZOS); out.paste(f,(x,240-f.height),f); x+=f.width+10
for i in (3,4):
    f=frame('k_shred_new.png',i); f=f.resize((int(f.width*K),int(f.height*K)),Image.LANCZOS); out.paste(f,(x,240-f.height),f); x+=f.width+10
out.save('cal_shred.png')
su=Image.open(S+'level15_super.png').convert('RGBA'); sidle=su.crop((0,1,105,261)); K2=260/712
out=Image.new('RGB',(900,300),(60,70,90)); x=10; out.paste(sidle,(x,280-260),sidle); x+=115
dn=su.crop((528,212,697,261)); out.paste(dn,(x,280-49),dn); x+=180
for i in range(3):
    f=frame('k_super_new.png',i); f=f.resize((int(f.width*K2),int(f.height*K2)),Image.LANCZOS); out.paste(f,(x,280-f.height),f); x+=f.width+10
out.save('cal_super.png')
