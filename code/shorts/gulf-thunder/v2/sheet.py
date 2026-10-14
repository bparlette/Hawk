import sys
from PIL import Image, ImageDraw
d,a,b,st,every,out=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),int(sys.argv[4]),int(sys.argv[5]),sys.argv[6]
fr=list(range(a,b,st)); cols=10; tw,th=135,240
S=Image.new('RGB',(cols*tw,((len(fr)+cols-1)//cols)*(th+14)),'black'); D=ImageDraw.Draw(S)
for i,f in enumerate(fr):
    im=Image.open(f'{d}/{f:05d}.png').convert('RGB').resize((tw,th))
    x,y=(i%cols)*tw,(i//cols)*(th+14); S.paste(im,(x,y+14)); D.text((x+2,y),f'{f}:{f*every}',fill='yellow')
S.save(out)
