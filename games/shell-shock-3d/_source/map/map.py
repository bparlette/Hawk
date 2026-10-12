import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Circle, FancyArrowPatch
fig,ax=plt.subplots(figsize=(11,10),dpi=160)
bg="#e8e8ea"; ink="#1d1d1f"
fig.patch.set_facecolor(bg); ax.set_facecolor(bg)
def R(x0,z0,x1,z1,**k): ax.add_patch(Rectangle((x0,z0),x1-x0,z1-z0,**k))
# street
for r in [(-12,-7,154,7),(154,-150,168,7)]: R(*r,fc="#4a4a52",ec="none",zorder=1)
for r in [(-12,-11,154,-7),(-12,7,172,11),(150,-150,154,-11),(168,-150,172,7)]: R(*r,fc="#9a9aa2",ec="none",zorder=1)
R(128,-188,172,-150,fc="#a08a78",ec="none",zorder=1)
blds=[(-40,-36,-12,-11),(-12,-36,15,-11),(15,-40,53,-11),(-40,11,-10,36),(-10,11,22,36),(22,11,60,38),(60,11,86,34),(86,11,124,40),(124,11,172,36),(172,-12,200,36),(-70,-11,-12,11),(124,-78,150,-40),(124,-112,150,-78),(124,-150,150,-112),(172,-40,200,-12),(172,-78,200,-40),(172,-116,200,-78),(172,-150,200,-116),(100,-215,200,-188),(100,-188,128,-150),(172,-188,200,-150)]
for b in blds: R(*b,fc="#c9c9cf",ec="#8a8a92",lw=.6,zorder=2)
R(53,-38,81.6,-11,fc="#e8875a",ec="#b0502a",lw=1,zorder=2); ax.text(67,-24,"BURNING\nBUILDING",ha="center",va="center",fontsize=8,weight="bold",color="#5a1a00",zorder=5)
roofs=[(81.6,-35,106.6,-11,"ROOF 1"),(108.6,-35,126,-11,"ROOF 2"),(128,-40,150,-11,"ROOF 3")]
for x0,z0,x1,z1,n in roofs:
    R(x0,z0,x1,z1,fc="#b1bcd2",ec="#5a6a8a",lw=1,zorder=2); ax.text((x0+x1)/2,z0+4,n,ha="center",fontsize=8,weight="bold",color="#2a3550",zorder=5)
R(123,-24,129.5,-22,fc="#8a6a40",zorder=3); ax.text(126,-27,"plank",ha="center",fontsize=6.5,color="#5a3a10",zorder=5)
R(131.2,-23.6,146.8,-11.2,fc="#d9c489",ec="#9a8030",lw=1,zorder=3); ax.text(139,-17,"LOBBY",ha="center",fontsize=7.5,weight="bold",color="#5a4a10",zorder=5)
R(139.4,-31.4,143,-28.6,fc="#9a8030",zorder=4)
# sewer
SA=dict(fc="#607868",alpha=.55,ec="#2f4a38",lw=1,ls="--",zorder=4)
R(20,-3,165,3,**SA); R(159,-96,165,-3,**SA)
R(85,3,99,11,fc="#7e9c9b",alpha=.8,ec="#2f4a38",lw=1,ls="--",zorder=4)
ax.text(92,13.5,"SECRET LAIR (sewer)",ha="center",fontsize=7,color="#1f3a2a",weight="bold",zorder=6)
ax.text(28,-4.5,"SEWER TUNNEL A (underground)",fontsize=7,color="#1f3a2a",zorder=6)
ax.text(157,-60,"SEWER TUNNEL B",fontsize=7,color="#1f3a2a",rotation=90,ha="right",va="center",zorder=6)
# markers
def M(x,z,c,s,lbl,dx=3,dz=0,ha="left"):
    ax.scatter([x],[z],s=s,c=c,ec=ink,lw=.8,zorder=8); ax.text(x+dx,z+dz,lbl,fontsize=7,ha=ha,va="center",color=ink,zorder=9,weight="bold")
for x,z in [(80,-2.5),(122,3),(161,-30),(158,-74),(149,-168),(8,-1)]: ax.scatter([x],[z],s=28,c="#888",ec=ink,lw=.5,zorder=7)
M(34,2,"#3aa860",110,"MANHOLE A (in/out)",dz=4.5)
M(162,-94.2,"#3aa860",110,"MANHOLE B (in/out)",dx=-3,ha="right")
M(97.6,-10.2,"#c9a3a8",90,"fire escape ↕ roof 1",dx=-3,dz=-2.5,ha="right")
M(151.2,-25,"#c9a3a8",90,"ladder ↕ roof 3",dx=3,dz=4)
M(140,-10.5,"#d9c489",90,"door",dx=3,dz=3,ha="left")
M(141.2,-29.5,"#ff4d00",90,"elevator → roof 3",dx=3,dz=-3)
# labels
ax.text(-2,0,"BLOCK 1",fontsize=11,weight="bold",color="#f5f5f7",zorder=6,va="center")
ax.text(161,-125,"BLOCK 2",fontsize=11,weight="bold",color="#f5f5f7",rotation=90,ha="center",zorder=6)
ax.text(150,-170,"RAMROD'S LOT\n(boss)",ha="center",fontsize=9,weight="bold",color="#4a2a10",zorder=6)
ax.annotate("START",xy=(-8,0),xytext=(-50,0),fontsize=9,weight="bold",color=ink,va="center",arrowprops=dict(arrowstyle="->",color=ink,lw=1.4),zorder=9)
ax.text(161,10,"ZAP-ROLLER",fontsize=6.5,ha="center",color="#f5f5f7",zorder=9,weight="bold")
ax.set_xlim(-75,205); ax.set_ylim(-220,45); ax.invert_yaxis(); ax.set_aspect("equal")
ax.set_xticks([]); ax.set_yticks([])
for s in ax.spines.values(): s.set_visible(False)
ax.text(-75,-232,"Shell Shock 3D — Level 1 world map",fontsize=15,weight="bold",color=ink)
ax.text(-75,-224,"Top-down, north up. Green dashed = sewer below the street; blue = walkable roofs; gray dots = decorative manholes.",fontsize=8.5,color="#1d1d1f80")
plt.savefig("/workspace/work/ss3d/map/world_map.png",bbox_inches="tight",facecolor=bg)
