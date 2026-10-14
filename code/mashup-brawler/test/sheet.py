import sys,glob
from PIL import Image
pre=sys.argv[1];fs=sorted(glob.glob(pre+'_*.jpg'),key=lambda f:(f.split('_')[-2][0] if False else 0))
order=lambda f:({'f':0,'r':1,'w':2}.get(f[len(pre)+1],3),float(f[len(pre)+2:-4].replace('_','.').split('.')[0]+'.'+''.join(f[len(pre)+2:-4].split('_')[1:2]) or 0))
fs=sorted(fs,key=order)
n=len(fs);cols=7;rows=(n+cols-1)//cols
sh=Image.new('RGB',(300*cols,534*rows))
for i,f in enumerate(fs):sh.paste(Image.open(f).resize((300,534)),((i%cols)*300,(i//cols)*534))
sh.save(pre+'_SHEET.jpg',quality=82);print(n)
