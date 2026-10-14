from PIL import Image, ImageDraw
import json
m=json.load(open('meta.json'))
OLD={'shredder':{'idle':[0,0,102,190,42],'hurt':[488,29,108,161,63]},'super':{'idle':[0,1,105,260,49],'down':[528,212,169,49,92]}}
for sheet,fn in [('shredder','level15_shredder.png'),('super','level15_super.png'),('elite','level15_elite.png')]:
    im=Image.open(fn); fr=dict(OLD.get(sheet,{})); fr.update(m[sheet])
    H=im.height+40; out=Image.new('RGB',(len(fr)*230+40,H+20),(60,70,90)); d=ImageDraw.Draw(out)
    for i,(k,v) in enumerate(fr.items()):
        x,y,w,h,ax=v; c=im.crop((x,y,x+w,y+h)); X=110+i*230; Y=H
        out.paste(c,(X-ax,Y-h),c); d.line([X,Y-h-5,X,Y],fill=(0,255,255)); d.text((X-40,Y+3),k,fill=(255,255,0))
    out.save('view/anc_'+sheet+'.png')
