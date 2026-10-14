import sys; sys.path.insert(0,'.')
from sprites import *
T='/workspace/work/lvl15_test/levels/'
im=Image.open('l15_gen_super.png').convert('RGBA'); a=np.asarray(im); A=a[:,:,3]
lab,cs=comps(A)
big=sorted([c for c in cs if c[1]>3000],key=lambda c:(c[3]>600,c[2]))
small=[c for c in cs if c[1]<=3000]
def crop(mask):
    ys,xs=np.nonzero(mask); x1,x2,y1,y2=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    for s in small:
        if s[2]>=x1-6 and s[4]<=x2+6 and s[3]>=y1-6 and s[5]<=y2+6: mask=mask|(lab==s[0])
    ys,xs=np.nonzero(mask); x1,x2,y1,y2=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    arr=a[y1:y2,x1:x2].copy(); arr[:,:,3]=np.where(mask[y1:y2,x1:x2],arr[:,:,3],0); return Image.fromarray(arr)
fr=[]
X=np.tile(np.arange(A.shape[1]),(A.shape[0],1))
r,g,b=[a[:,:,i].astype(int) for i in range(3)]
purple=((b>r-10)&(b>g+40)&((r+b)>300))|((g>200)&(g>r+40))
for c in big:
    m=(lab==c[0])
    if c[4]-c[2]>400 and c[3]<600:
        blast=m&((X<833)|((X<856)&purple)); rest=m&~blast
        print(blast.sum(),rest.sum())
        fr+=[crop(blast),crop(rest)]
    else: fr.append(crop(m))
print([f.size for f in fr])
m2=pack(fr,['idle','walk','blast','raise','hurt','down'],260,T+'level15_super.png')
import json; print(json.dumps(m2))
for n in ['super','shredder']:
    s=Image.open(T+'level15_%s.png'%n); bg=Image.new('RGBA',s.size,(60,60,90,255)); bg.alpha_composite(s); bg.save('/tmp/%s_sheet.png'%n)
