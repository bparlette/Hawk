import sys; sys.path.insert(0,'.')
import build, numpy as np
c=build.Cap("level8"); m=build.find_moments(c)
st,kind=build.best_moment(c,m); n=build.MOMENT_BEATS*build.BEAT
print(st,kind,n,m.get("boss_intro"),m.get("boss_ko"))
cx,cy=c.track(st,n); nw=1280
from PIL import Image
nw,nh=Image.open(c.dir+"/frames/"+c.meta[0]["file"]).size; print(nw,nh)
print(np.round(cx[::6]/nw,2))
