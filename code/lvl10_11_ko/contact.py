import sys; from PIL import Image, ImageDraw
p=sys.argv[1]; names=['idle','down_fall','down_lie','getup','hurt','tele','dying_fall','dying_lie','outro']
ims=[]
for n in names:
    try: ims.append((n,Image.open(f'shots/{p}_{n}.png').convert('RGB')))
    except Exception as e: pass
w,h=ims[0][1].size; s=0.5; W,H=int(w*s),int(h*s)
out=Image.new('RGB',(W*3,H*((len(ims)+2)//3)))
for i,(n,im) in enumerate(ims):
    out.paste(im.resize((W,H)),((i%3)*W,(i//3)*H)); ImageDraw.Draw(out).text(((i%3)*W+5,(i//3)*H+5),n,fill=(255,255,0))
out.save(f'contact_{p}.jpg',quality=85); print(w,h)
