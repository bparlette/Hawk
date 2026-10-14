import math, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H=1080,1920; FPS=30
src=Image.open('pt/assets/img/p07c_strikeout.jpg').convert('RGB').resize((1288,1920),Image.LANCZOS)
F=ImageFont.truetype('pt/assets/fonts/Bangers-Regular.ttf',70)
# bubble layer (full frame RGBA)
B=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(B)
x,y,w,h=60,250,620,210; tx,ty=262,625; bw=8
sh=Image.new('RGBA',(W,H),(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle((x+10,y+12,x+w+10,y+h+12),60,fill=(0,0,0,90)); B=Image.alpha_composite(B,sh); d=ImageDraw.Draw(B)
p1=(228,456); p2=(296,456)
d.polygon([p1,(tx,ty),p2],fill='white'); d.line([p1,(tx,ty),p2],fill='#111',width=bw,joint='curve')
d.rounded_rectangle((x,y,x+w,y+h),60,fill='white',outline='#111',width=bw)
d.polygon([(p1[0]+bw,p1[1]-bw-4),(tx,ty-int(bw*1.8)),(p2[0]-bw,p2[1]-bw-4)],fill='white')
lines=['SO... COME HERE','OFTEN?']
def tw(s): return sum(F.getlength(c) for c in s)+2*(len(s)-1)
lh=72; y0=y+h/2-lh*len(lines)/2+2
for k,s in enumerate(lines):
    cx=x+w/2-tw(s)/2
    for c in s: d.text((cx,y0+k*lh),c,font=F,fill='#111'); cx+=F.getlength(c)+2
# vignette
yy,xx=np.mgrid[0:H,0:W]; r=np.sqrt(((xx-W/2)/(W/2))**2+((yy-H/2)/(H/2))**2)/math.sqrt(2)*1.0
r=np.sqrt(((xx-W/2)/(W*0.5))**2+((yy-H/2)/(H*0.5))**2)
va=np.clip((r-0.55)/(1.0-0.55),0,1)*0.45
V=Image.fromarray(np.dstack([np.zeros((H,W,3),np.uint8),(va*255).astype(np.uint8)]),'RGBA')
def clamp(s,X,Y):
    mx=(1288*s-1080)/2; my=(1920*s-1920)/2; return max(-mx,min(mx,X)),max(-my,min(my,Y))
s0,s1=1.06,1.0; (x0,y0_),(x1,y1)=clamp(s0,-30,0),clamp(s1,20,0); D=2.3
def backout(t,c=2.2): t-=1; return 1+(c+1)*t**3+c*t**2
p=subprocess.Popen(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r','30','-i','-','-c:v','libx264','-preset','ultrafast','-crf','12','-pix_fmt','yuv420p','cut4/p07c_new.mp4'],stdin=subprocess.PIPE)
for f in range(round(D*FPS)+FPS):
    t=min(f/FPS,(round(D*FPS)-1)/FPS)  # freeze on last moving frame
    e=0.5-0.5*math.cos(math.pi*min(t/D,1))
    s=s0+(s1-s0)*e; X=x0+(x1-x0)*e; Y=y0_+(y1-y0_)*e
    sw,shh=round(1288*s),round(1920*s); im=src.resize((sw,shh),Image.BILINEAR)
    fr=Image.new('RGB',(W,H)); fr.paste(im,(round(540+X-sw/2),round(960+Y-shh/2)))
    fr=fr.convert('RGBA')
    tb=t-0.4
    if tb>=0:
        k=min(tb/0.2,1); sc=0.1+0.9*backout(k); op=min(1,k*1.0+0.0) if k<1 else 1
        if abs(sc-1)<1e-3: L=B
        else:
            L=B.resize((max(1,round(W*sc)),max(1,round(H*sc))),Image.BILINEAR); C=Image.new('RGBA',(W,H),(0,0,0,0))
            C.paste(L,(round(tx-tx*sc),round(ty-ty*sc))); L=C
        if op<1: a=L.getchannel('A').point(lambda v:int(v*op)); L.putalpha(a)
        fr=Image.alpha_composite(fr,L)
    fr=Image.alpha_composite(fr,V).convert('RGB')
    p.stdin.write(fr.tobytes())
p.stdin.close(); p.wait(); print('done',p.returncode)
