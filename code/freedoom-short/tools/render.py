from wad import maps
import struct, sys
from PIL import Image, ImageDraw
M=maps('/workspace/work/freedoom-short/freedoom-0.13.0/freedoom2.wad')
COL={3004:(0,200,0),9:(0,255,120),3001:(255,140,0),3002:(255,0,255),58:(180,0,180),3006:(255,255,0),3005:(255,0,0),3003:(0,120,255),69:(120,180,255),68:(0,255,255),71:(255,120,120),66:(255,255,255),67:(160,100,40),64:(255,200,200),65:(0,150,60),16:(255,0,0),7:(255,0,0),84:(0,90,0)}
def render(name, cx, cy, R, out):
    m=M[name]; V=[struct.unpack('<2h',m['VERTEXES'][i:i+4]) for i in range(0,len(m['VERTEXES']),4)]
    LD=[struct.unpack('<7h',m['LINEDEFS'][i:i+14]) for i in range(0,len(m['LINEDEFS']),14)]
    T=[struct.unpack('<5h',m['THINGS'][i:i+10]) for i in range(0,len(m['THINGS']),10)]
    S=1000; sc=S/(2*R); img=Image.new('RGB',(S,S),(10,10,10)); d=ImageDraw.Draw(img)
    f=lambda x,y:((x-cx)*sc+S/2, S/2-(y-cy)*sc)
    for v1,v2,fl,sp,tag,r,l in LD:
        c=(220,220,220) if l==-1 else (100,100,100)
        if sp: c=(220,200,0)
        d.line([f(*V[v1]),f(*V[v2])],fill=c,width=1)
    for x,y,a,t,fl in T:
        if t in COL and fl&4:
            p=f(x,y); d.ellipse([p[0]-4,p[1]-4,p[0]+4,p[1]+4],fill=COL[t])
        elif t==2035:
            p=f(x,y); d.rectangle([p[0]-3,p[1]-3,p[0]+3,p[1]+3],fill=(255,60,0))
    g=128 if R<900 else 256
    for gx in range(int((cx-R)//g)*g, int(cx+R), g):
        d.line([f(gx,cy-R),f(gx,cy+R)],fill=(25,25,60)); d.text((f(gx,cy+R)[0]+2,2),str(gx),fill=(90,90,255))
    for gy in range(int((cy-R)//g)*g, int(cy+R), g):
        d.line([f(cx-R,gy),f(cx+R,gy)],fill=(25,25,60)); d.text((2,f(cx-R,gy)[1]),str(gy),fill=(90,90,255))
    img.save(out)
for a in sys.argv[1:]:
    n,cx,cy,R=a.split(','); render(n,int(cx),int(cy),int(R),f'/workspace/work/freedoom-short/tools/{n}_{cx}_{cy}.png')
