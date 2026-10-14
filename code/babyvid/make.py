from PIL import Image, ImageDraw, ImageFont
W,H=1920,1080
B="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
words=["mama","dada","baby","ball","dog","cat","milk","more","up","bye"]
def card(text,size=380,color=(220,20,40),sub=None):
    im=Image.new("RGB",(W,H),"white");d=ImageDraw.Draw(im)
    f=ImageFont.truetype(B,size);bb=d.textbbox((0,0),text,font=f)
    d.text(((W-(bb[2]-bb[0]))/2-bb[0],(H-(bb[3]-bb[1]))/2-bb[1]-(60 if sub else 0)),text,font=f,fill=color)
    if sub:
        f2=ImageFont.truetype(B,70);bb=d.textbbox((0,0),sub,font=f2)
        d.text(((W-(bb[2]-bb[0]))/2,H-230),sub,font=f2,fill=(60,60,60))
    return im
def pic(w):
    im=Image.new("RGB",(W,H),"white");p=Image.open(f"/workspace/w_{w}.png").convert("RGB")
    p.thumbnail((820,820));im.paste(p,((W-p.width)//2,40))
    d=ImageDraw.Draw(im);f=ImageFont.truetype(B,180);bb=d.textbbox((0,0),w,font=f)
    d.text(((W-(bb[2]-bb[0]))/2-bb[0],880-bb[1]),w,font=f,fill=(220,20,40));return im
seq=[]
card("My First Words",200,(30,60,180),"10 words your baby can read").save("s00.png");seq.append(("s00.png",3))
for i,w in enumerate(words,1):
    card(w).save(f"a{i:02d}.png");pic(w).save(f"b{i:02d}.png")
    seq+= [(f"a{i:02d}.png",2.5),(f"b{i:02d}.png",3),(f"a{i:02d}.png",1.5)]
card("Great job!",260,(30,140,60),"Watch again tomorrow").save("s99.png");seq.append(("s99.png",3))
with open("list.txt","w") as fh:
    for f,dur in seq: fh.write(f"file '{f}'\nduration {dur}\n")
    fh.write(f"file '{seq[-1][0]}'\n")
print(sum(d for _,d in seq))
