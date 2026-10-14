from PIL import Image, ImageDraw; import json
im=Image.open('cf_rgba.png'); m=json.load(open('meta.json'))
T=Image.open('/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/atlas_lenny.png').convert('RGBA')
# turtle idle at same world scale: TURTLE_K world, boss K=0.5 -> turtle pixels * TURTLE_K/0.5
TK=42*1.6*0.92/150/0.5; t=T.crop((0,7,122,157)); t=t.resize((round(122*TK),round(150*TK)))
out=Image.new('RGB',(1800,520),(60,70,90)); d=ImageDraw.Draw(out)
ix,iy,iw,ih,iax=m['idle']; ic=im.crop((ix,iy,ix+iw,iy+ih)); g=ic.copy(); g.putalpha(g.split()[3].point(lambda v:v*0.3))
names=[k for k in m]
for i,k in enumerate(names):
  x,y,w,h,ax=m[k]; c=im.crop((x,y,x+w,y+h)); X=110+(i%8)*215; Y=230+(i//8)*250
  if k not in('shard','snowball','puff','down'): out.paste(g,(X-iax,Y-ih),g)
  out.paste(c,(X-ax,Y-h),c); d.line([X,Y-190,X,Y],fill=(0,255,255)); d.text((X-90,Y+4),k,fill=(255,255,0))
out.paste(t,(1650-t.width//2,480-t.height),t); x,y,w,h,ax=m['idle']; c=im.crop((x,y,x+w,y+h)); out.paste(c,(1560-ax,480-h),c)
out.save('view/anchors.png')
