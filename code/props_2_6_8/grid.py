import sys,glob
from PIL import Image, ImageDraw
pat,out=sys.argv[1],sys.argv[2]; cols=int(sys.argv[3]) if len(sys.argv)>3 else 3
fs=sorted(glob.glob(pat)); W,H=576,336
sh=Image.new('RGB',(W*cols,(H+14)*((len(fs)+cols-1)//cols)),(20,20,20)); d=ImageDraw.Draw(sh)
for i,f in enumerate(fs):
    x,y=(i%cols)*W,(i//cols)*(H+14); sh.paste(Image.open(f).convert('RGB').resize((W,H)),(x,y+14)); d.text((x+4,y+1),f.split('/')[-1],fill=(255,255,0))
sh.save(out); print(len(fs),sh.size)
