# Thumbnail for the SHELL SHOCK 3D Short: in-engine frame skate/f0050 (kickflip air), zoomed; text overlay only.
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
R='/workspace/work/ss3d-trailer/short'
FONT='/workspace/work/ss3d-trailer/hfproj/assets/fonts/Anton.ttf'
src=Image.open(f'{R}/frames/skate/f0050.jpg').convert('RGB')
Z=2.6; cx,cy=545,895; ty=1040           # turtle centre lands at output y=ty
w,h=round(1080/Z),round(1920/Z); x0=cx-w//2; y0=round(cy-ty/Z)
bg=src.crop((x0,y0,x0+w,y0+h)).resize((1080,1920),Image.LANCZOS)
bg=bg.filter(ImageFilter.UnsharpMask(radius=3,percent=90,threshold=2))
bg=ImageEnhance.Color(bg).enhance(1.35); bg=ImageEnhance.Contrast(bg).enhance(1.12)
im=bg.convert('RGBA')
# darken top for text legibility
grad=Image.new('RGBA',(1080,1920),(0,0,0,0)); g=grad.load()
for y in range(760):
    a=round(170*(1-y/760)**1.3)
    for x in range(1080): g[x,y]=(0,0,0,a)
im.alpha_composite(grad)
# radial yellow glow behind the turtle
glow=Image.new('RGBA',(1080,1920),(0,0,0,0)); gd=ImageDraw.Draw(glow)
gx,gy=round((cx-x0)*Z),ty
gd.ellipse((gx-340,gy-340,gx+340,gy+340),fill=(255,220,60,95))
glow=glow.filter(ImageFilter.GaussianBlur(90))
im=Image.alpha_composite(im,glow)
dr=ImageDraw.Draw(im)
def line(text_parts,size,y):
    f=ImageFont.truetype(FONT,size)
    tot=sum(dr.textlength(t,font=f) for t,_ in text_parts)
    while tot>900:
        size-=4; f=ImageFont.truetype(FONT,size); tot=sum(dr.textlength(t,font=f) for t,_ in text_parts)
    sw=max(10,size//10); x=(1080-tot)/2
    bb=dr.textbbox((0,0),''.join(t for t,_ in text_parts),font=f,stroke_width=sw)
    for t,c in text_parts:
        dr.text((x+10,y-bb[1]+14),t,font=f,fill=(0,0,0,200),stroke_width=sw,stroke_fill=(0,0,0,200))
        dr.text((x,y-bb[1]),t,font=f,fill=c,stroke_width=sw,stroke_fill=(0,0,0,255))
        x+=dr.textlength(t,font=f)
    return y+bb[3]-bb[1], size
Y,W,RED,G=(255,222,40,255),(255,255,255,255),(255,40,40,255),(120,240,100,255)
y1,s1=line([('NINJA TURTLES',G)],230,215)
y2,s2=line([('x ',RED),('TONY HAWK?!',Y)],230,y1+8)
# red arrow pointing at the turtle (from right side)
ax,ay=gx+205,gy-175
arrow=[(ax+230,ay-170),(ax+70,ay-30),(ax+110,ay-75)]
A=Image.new('RGBA',(1080,1920),(0,0,0,0)); ad=ImageDraw.Draw(A)
shaft=[(ax+250,ay-210),(ax+300,ay-160),(ax+110,ay+10),(ax+60,ay-40)]
head=[(ax+5,ay+55),(ax+35,ay-110),(ax+170,ay+25)]
for poly in (shaft,head): ad.polygon(poly,fill=(0,0,0,255))
A=A.filter(ImageFilter.MaxFilter(17))
B=Image.new('RGBA',(1080,1920),(0,0,0,0)); bd=ImageDraw.Draw(B)
for poly in (shaft,head): bd.polygon(poly,fill=RED)
im.alpha_composite(A); im.alpha_composite(B)
out=im.convert('RGB'); out.save(f'{R}/thumbnail_9x16.png')
out.crop((0,150,1080,1770)).save(f'{R}/thumbnail_2x3_preview.png')
# check sheet with guides
chk=out.copy(); cd=ImageDraw.Draw(chk)
cd.rectangle((0,150,1079,1770),outline=(255,0,255),width=6); cd.line((0,1536,1080,1536),fill=(0,255,255),width=6)
chk.resize((540,960)).save('/tmp/thumb_check.png')
print('crop',x0,y0,w,h,'turtle at',gx,gy,'text bottom',y2,'sizes',s1,s2)
