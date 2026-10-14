import math
N=13; C=6
def masks():
    def circ(dx,dy,y): return dx*dx+dy*dy<=6.4**2
    def hexa(dx,dy,y): return abs(dy)<=5.6 and abs(dx)<=6.2-abs(dy)*0.6
    def dia(dx,dy,y): return abs(dx)+abs(dy)<=6.6
    def octa(dx,dy,y): return abs(dx)<=6 and abs(dy)<=6 and abs(dx)+abs(dy)<=9
    def tri(dx,dy,y): return abs(dx)<=(y+1)*0.5+0.3
    def sq(dx,dy,y): return abs(dx)<=6 and abs(dy)<=6 and abs(dx)+abs(dy)<=10.5
    return [circ,hexa,dia,octa,tri,sq]
def gen(f, shape):
    inside=[[f(x-C,y-C,y) for x in range(N)] for y in range(N)]
    def ins(x,y): return 0<=x<N and 0<=y<N and inside[y][x]
    rows=[]
    for y in range(N):
        s=""
        for x in range(N):
            if not inside[y][x]: s+="."; continue
            # erosion distance
            d=0
            for k in (1,2,3):
                if all(ins(x+i,y+j) for i in range(-k,k+1) for j in range(-k,k+1)): d=k
            dx,dy=x-C,y-C
            if shape==4: dy=y-8.5; dx=x-C
            if d>=2: ch="B"
            else:
                sd=dx+dy
                if shape==4: sd=dx*1.2+(dy-1)*0.5
                ch="L" if sd<0 or (sd==0 and dy<0) else "d"
            s+=ch
        rows.append(s)
    # glint
    out=[]
    placed=False
    for y,r in enumerate(rows):
        r=list(r)
        out.append(r)
    # white glint at first B pixel near top-left of table
    best=None
    for y in range(N):
        for x in range(N):
            if out[y][x]=="B":
                best=(x,y); break
        if best: break
    if best:
        out[best[1]][best[0]]="W"
        if out[best[1]+1][best[0]]=="B": out[best[1]+1][best[0]]="W"
    return ["".join(r) for r in out]
if __name__=="__main__":
    import json
    allr=[gen(f,i) for i,f in enumerate(masks())]
    for r in allr:
        print("\n".join(r)); print()
    json.dump(allr,open("gems4.json","w"))
