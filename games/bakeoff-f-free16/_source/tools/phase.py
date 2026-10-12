# per-sheet pixel grid of the 16-bit sprite sheets (art blocks ~2.44 sheet px): blob bboxes + per-blob grid phase -> pxgrid.json
from PIL import Image
import numpy as np, json, sys
from scipy import ndimage
SRC='/workspace/work/aistudio-games/games/shell-shock-16bit/'
SHEETS=['atlas_lenny','atlas_rafe','atlas_miko','atlas_donny','atlas_ninja','atlas_zap','atlas_ramrod','atlas_scorcher','sp_lenny','sp_rafe','sp_miko','sp_donny','shared_sprites','drill','levels/enemies_street']
def fitB(pos):
  best=(2.44,0)
  for B in np.arange(2.40,2.48,0.0025):
    s=abs(np.exp(2j*np.pi*pos/B).mean())
    if s>best[1]: best=(B,s)
  return best
def phase(pos,B):
  if len(pos)<20: return None
  m=np.exp(2j*np.pi*pos/B).mean()
  return (np.angle(m)/(2*np.pi)*B)%B, abs(m)
out={}
for s in SHEETS:
  a=np.array(Image.open(SRC+s+'.webp').convert('RGBA')).astype(int)
  h,w=a.shape[:2]
  dx=np.abs(np.diff(a,axis=1)).sum(2)>40; dy=np.abs(np.diff(a,axis=0)).sum(2)>40
  ys,xs=np.nonzero(dx); Bx,_=fitB(xs+1.0)
  yy,xx=np.nonzero(dy); By,_=fitB(yy+1.0)
  B=(Bx+By)/2
  lab,n=ndimage.label(ndimage.binary_dilation(a[:,:,3]>20,iterations=2))
  blobs=[]
  for i,sl in enumerate(ndimage.find_objects(lab)):
    y0,y1,x0,x1=sl[0].start,sl[0].stop,sl[1].start,sl[1].stop
    if (y1-y0)*(x1-x0)<30: continue
    mx=(xs>=x0)&(xs<x1)&(ys>=y0)&(ys<y1); my=(xx>=x0)&(xx<x1)&(yy>=y0)&(yy<y1)
    px=phase(xs[mx]+1.0,B); py=phase(yy[my]+1.0,B)
    blobs.append([int(x0),int(y0),int(x1),int(y1),round(px[0],2) if px else None,round(py[0],2) if py else None, round(px[1],2) if px else 0, round(py[1],2) if py else 0])
  gx=phase(xs+1.0,B)[0]; gy=phase(yy+1.0,B)[0]
  for b in blobs:
    if b[4] is None: b[4]=round(gx,2)
    if b[5] is None: b[5]=round(gy,2)
  out[s+'.webp']={'w':w,'h':h,'B':round(B,4),'blobs':[b[:6] for b in blobs]}
  print(s,w,h,'B=%.4f'%B,'n=%d'%len(blobs),'phx',sorted(set(round(b[4],1) for b in blobs)),'coh',[ (b[6],b[7]) for b in blobs][:6])
json.dump(out,open('../pxgrid.json','w'))
