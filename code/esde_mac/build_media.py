import os, subprocess
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
B='/workspace/work/esde_mac'; G=B+'/app/games'; S=B+'/media_src'; M=B+'/pkg/downloaded_media/browsergames'
NAMES={'shellshock':'Shell Shock - Live Action','sfbrawl':'Street Fighter - World Brawl'}
for d in ['covers','marquees','screenshots','titlescreens','videos','miximages','fanart']: os.makedirs(f'{M}/{d}',exist_ok=True)
def font(sz):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf','/tmp/ba_root/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p,sz)
    import glob; f=glob.glob('/tmp/ba_root/usr/share/fonts/**/*Bold*.ttf',recursive=True); return ImageFont.truetype(f[0],sz)
def crop_canvas(p):  # 1280x720 window shot -> 1234x720 canvas
    im=Image.open(p).convert('RGB'); return im.crop((23,0,1257,720))
def cover_fit(im,w,h):
    return ImageOps.fit(im,(w,h),Image.LANCZOS,centering=(0.5,0.5))
logos={g:Image.open(f'{G}/{g}/title_logo.png').convert('RGBA') for g in NAMES}
shots={'shellshock':Image.open(S+'/ss_f40.png').convert('RGB').crop((0,74,1068,696)),'sfbrawl':crop_canvas(S+'/sfbrawl/shot_57.png')}
titles={g:crop_canvas(f'{S}/{g}/title_3.png') for g in NAMES}
for g,n in NAMES.items():
    lg=logos[g]; lg=lg.crop(lg.getbbox())
    lg.save(f'{M}/marquees/{n}.png')
    shots[g].save(f'{M}/screenshots/{n}.png')
    titles[g].save(f'{M}/titlescreens/{n}.png')
    bg=Image.open(f'{G}/{g}/title_bg.jpg').convert('RGB'); bg.save(f'{M}/fanart/{n}.jpg',quality=88)
    # cover / box art 2:3-ish
    W,H=640,900; cv=cover_fit(bg,W,H).convert('RGBA')
    grad=Image.new('L',(1,H)); [grad.putpixel((0,y),int(200*max(0,(y-H*0.55)/(H*0.45)))) for y in range(H)]
    cv=Image.composite(Image.new('RGBA',(W,H),(0,0,0,255)),cv,grad.resize((W,H)))
    l2=lg.copy(); l2.thumbnail((W-60,330),Image.LANCZOS); cv.alpha_composite(l2,((W-l2.width)//2,36))
    th=shots[g].copy(); th.thumbnail((W-120,400)); th=ImageOps.expand(th,6,'#ffd23a'); cv.alpha_composite(th.convert('RGBA'),((W-th.width)//2,H-th.height-110))
    d=ImageDraw.Draw(cv); d.rectangle((0,H-70,W,H),fill=(10,10,14,255)); f=font(30)
    t='BROWSER ARCADE'; d.text(((W-d.textlength(t,font=f))/2,H-55),t,font=f,fill='#ffd23a')
    d.rectangle((0,0,W-1,H-1),outline='#ffd23a',width=4)
    cv.convert('RGB').save(f'{M}/covers/{n}.png')
    # miximage: screenshot + cover + marquee, transparent 1280x960
    mx=Image.new('RGBA',(1280,960),(0,0,0,0)); sc=shots[g].copy(); sc=sc.resize((1180,int(1180*sc.height/sc.width)))
    mx.alpha_composite(sc.convert('RGBA'),(100,20)); c2=cv.copy(); c2.thumbnail((360,500)); mx.alpha_composite(c2,(1280-c2.width-10,960-c2.height-10))
    m2=lg.copy(); m2.thumbnail((620,280)); sh=Image.new('RGBA',m2.size,(0,0,0,0)); mx.alpha_composite(m2,(20,960-m2.height-20))
    mx.save(f'{M}/miximages/{n}.png')
# video: Shell Shock trailer (screen-only cut), first 30 s, letterbox cropped
subprocess.run(['ffmpeg','-v','error','-y','-i',S+'/ss_full_screen.mp4','-t','30','-vf','crop=1068:622:0:74,scale=960:-2','-c:v','libx264','-preset','slow','-crf','27','-pix_fmt','yuv420p','-movflags','+faststart','-c:a','aac','-b:a','96k',f'{M}/videos/{NAMES["shellshock"]}.mp4'],check=True)
# icons (1024 square: title bg + logo)
I=B+'/app/icons'; os.makedirs(I,exist_ok=True)
def mkicon(g):
    bg=cover_fit(Image.open(f'{G}/{g}/title_bg.jpg').convert('RGB'),1024,1024).convert('RGBA')
    bg=Image.alpha_composite(bg,Image.new('RGBA',bg.size,(0,0,0,70)))
    lg=logos[g].crop(logos[g].getbbox()); lg.thumbnail((900,700),Image.LANCZOS); bg.alpha_composite(lg,((1024-lg.width)//2,(1024-lg.height)//2))
    return bg
def rounded(im):
    m=Image.new('L',im.size,0); ImageDraw.Draw(m).rounded_rectangle((40,40,984,984),radius=200,fill=255)
    out=Image.new('RGBA',im.size,(0,0,0,0)); out.paste(im.resize((1024,1024)),(0,0),m); return out
ic={g:rounded(mkicon(g)) for g in NAMES}
for g in NAMES: ic[g].save(f'{I}/{g}.png'); ic[g].resize((512,512),Image.LANCZOS).save(f'{B}/app/launcher/{g}.png')
# Browser Arcade icon: split diagonally SS / SF
a=mkicon('shellshock'); b=mkicon('sfbrawl')
ma=Image.new('L',(1024,1024),0); ImageDraw.Draw(ma).polygon([(0,0),(1024,0),(0,1024)],fill=255)
la=logos['shellshock'].crop(logos['shellshock'].getbbox()); la.thumbnail((620,380)); lb=logos['sfbrawl'].crop(logos['sfbrawl'].getbbox()); lb.thumbnail((620,380))
ba=cover_fit(Image.open(f'{G}/shellshock/title_bg.jpg').convert('RGB'),1024,1024).convert('RGBA'); bb=cover_fit(Image.open(f'{G}/sfbrawl/title_bg.jpg').convert('RGB'),1024,1024).convert('RGBA')
comb=Image.composite(ba,bb,ma); comb=Image.alpha_composite(comb,Image.new('RGBA',comb.size,(0,0,0,60)))
comb.alpha_composite(la,(70,110)); comb.alpha_composite(lb,(1024-lb.width-70,1024-lb.height-110))
dd=ImageDraw.Draw(comb); dd.line((1024,0,0,1024),fill='#ffd23a',width=14)
arc=rounded(comb); arc.save(f'{I}/arcade.png')
arc.save(f'{B}/app/icons/arcade.icns',sizes=[(16,16),(32,32),(64,64),(128,128),(256,256),(512,512),(1024,1024)])
print('ok')
