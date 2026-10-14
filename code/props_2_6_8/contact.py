from PIL import Image, ImageDraw
import glob,os
# pairs: before | after, cropped to the region of interest (world px)
P=[('l2_hydrant_spray',(100,90,384,224)),('l2_manhole2',(130,130,384,224)),('l2_hydrant_warn',(100,90,384,224)),
   ('l6_plow_r',(0,90,384,224)),('l6_icicles_snowballs',(40,0,384,224)),('l6_ice',(0,140,384,224)),('l6_frozen',(40,60,330,224)),
   ('l8_laser_on',(0,100,260,224)),('l8_laser_warn_vent_blast',(0,100,260,224)),('l8_panels2',(20,140,300,224)),('l8_glass2',(220,80,384,224)),('l8_throne',(220,80,384,224))]
S=1.5; rows=[]
for n,(x0,y0,x1,y1) in P:
    ims=[Image.open(f'shots/{t}_{n}.png').convert('RGB').crop((x0*3,y0*3,x1*3,y1*3)) for t in ('before','after')]
    ims=[i.resize((int(i.width/3*S*2/2*1.0*2/1.0/2*1), int(i.height/3*S))) if False else i.resize((int(i.width/2),int(i.height/2))) for i in ims]
    rows.append((n,ims))
W=max(sum(i.width for i in ims)+30 for _,ims in rows); H=sum(ims[0].height+22 for _,ims in rows)+30
o=Image.new('RGB',(W,H),(18,18,22)); d=ImageDraw.Draw(o); y=6
d.text((8,y),'Shell Shock Live - L2/L6/L8 stage props: BEFORE (code-drawn)  |  AFTER (painted sprites)',fill=(255,230,80)); y+=20
for n,ims in rows:
    d.text((8,y),n+'   before | after',fill=(200,200,200)); y+=14
    x=8
    for i in ims: o.paste(i,(x,y)); x+=i.width+12
    y+=ims[0].height+8
o.save('contact_before_after.png'); o.convert('RGB').save('contact_before_after.jpg',quality=88); print(o.size)
