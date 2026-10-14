import sys
from PIL import Image, ImageDraw
D="/workspace/work/sf_brawler/test/shots/run5/"
names=["01_title","02_map","e_idle","e_walk","e_attack","e_jump","e_hurt","e_down","p_props_food_shots","t_tea_break"]
for tag in ["before","after"]:
    ims=[Image.open(D+tag+"/"+n+".png").convert("RGB") for n in names]
    w,h=ims[0].size; w2,h2=w,h
    cv=Image.new("RGB",(w2*2+6,(h2+18)*5),(20,20,24)); d=ImageDraw.Draw(cv)
    for i,(n,im) in enumerate(zip(names,ims)):
        x=(i%2)*(w2+6); y=(i//2)*(h2+18); d.text((x+4,y+3),tag.upper()+"  "+n,fill=(255,220,120)); cv.paste(im.resize((w2,h2),Image.LANCZOS),(x,y+18))
    cv.save(D+"contact_"+tag+".png")
    print(tag, cv.size, w,h)
