from PIL import Image, ImageDraw
import json
m=json.load(open('meta.json')); im=Image.open('krang_rgba.png')
b=Image.new('RGBA',im.size,(60,60,70,255)); b.alpha_composite(im); d=ImageDraw.Draw(b)
for n,(x,y,w,h,ax,wx,wy) in m.items():
    d.line([(x+ax,y),(x+ax,y+h)],fill=(0,255,255,255)); d.ellipse([x+wx-3,y+wy-3,x+wx+3,y+wy+3],outline=(255,0,0,255)); d.text((x+2,2),n,fill=(255,255,0,255))
b=b.resize((b.width,b.height)); b.convert('RGB').save('view/sheet_dbg.png')
