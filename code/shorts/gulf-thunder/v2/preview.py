import sys; sys.argv=['x','list']
sys.path.insert(0,'/workspace/work/shorts/gulf-thunder')
import build2 as B
from PIL import Image, ImageDraw
picks=[]
for s in B.SEGS:
    n=len(s['frames']); picks += [(s,int(n*0.15)),(s,int(n*0.6))]
tw,th=216,384; cols=10
S=Image.new('RGB',(cols*tw,((len(picks)+cols-1)//cols)*(th+16)),'black'); D=ImageDraw.Draw(S)
for j,(s,k) in enumerate(picks):
    fr=B.render_frame(s,k,s['frames'][k]).resize((tw,th))
    x,y=(j%cols)*tw,(j//cols)*(th+16); S.paste(fr,(x,y+16)); D.text((x+2,y+2),f"{s['name']} k{k}",fill='yellow')
S.save('/workspace/work/shorts/gulf-thunder/v2/preview.png')
