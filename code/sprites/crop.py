import json,re,os
from PIL import Image
m=json.load(open('manifest.json'))
P='/workspace/work/deploy/shell-shock-live-action/'; B='/workspace/work/g16js/site/'
from collections import Counter
cnt=Counter(e['name'] for e in m)
base='https://shellshock-sprites.surge.sh'
out=[];cache={};issues=[]
def img(root,src):
    k=root+src
    if k not in cache: cache[k]=Image.open(k).convert('RGBA')
    return cache[k]
for e in m:
    slug=re.sub(r'[^a-z0-9]+','-',e['name'].lower()).strip('-')
    if cnt[e['name']]>1: slug+=f"-lv{e['lv']}"
    seen=Counter(); poses=[]
    for p in e['poses']:
        n=re.sub(r'[^A-Za-z0-9_-]+','_',p['n']); seen[n]+=1
        if seen[n]>1: n=f"{n}-{seen[n]}"
        x,y,w,h=[int(round(v)) for v in p['f']]
        for root,d in ((P,'painted'),(B,'16bit')):
            im=img(root,p['src'])
            if x<0 or y<0 or x+w>im.width or y+h>im.height: issues.append((e['name'],p['n'],d,'rect out of bounds',im.size,(x,y,w,h)))
            c=im.crop((x,y,x+w,y+h))
            if c.getbbox() is None or c.split()[3].getbbox() is None: issues.append((e['name'],p['n'],d,'blank'))
            os.makedirs(f'out/{d}/{slug}',exist_ok=True); c.save(f'out/{d}/{slug}/{n}.png',optimize=True)
        if img(P,p['src']).size!=img(B,p['src']).size: issues.append((p['src'],'size mismatch'))
        poses.append({'n':n,'w':w,'h':h,'painted':f'{base}/painted/{slug}/{n}.png','bit16':f'{base}/16bit/{slug}/{n}.png'})
    out.append({'name':e['name'],'slug':slug,'grp':e['grp'],'lv':e['lv'],'poses':poses})
json.dump(out,open('out/sprites.json','w'),indent=1)
print(len(out),sum(len(e['poses']) for e in out)); print(sorted(set(map(str,issues))))
# index
L=['<!doctype html><meta charset=utf-8><title>Shell Shock Live sprites</title><body style="font-family:monospace"><h1>Shell Shock Live sprite poses</h1><p><a href="sprites.json">sprites.json</a> &middot; <a href="contact.png">contact.png</a></p>']
for e in out:
    L.append(f"<h3>{e['name']} ({e['grp']}, lv {e['lv']})</h3><ul>")
    for p in e['poses']: L.append(f"<li>{p['n']} {p['w']}x{p['h']}: <a href=\"painted/{e['slug']}/{p['n']}.png\">painted</a> | <a href=\"16bit/{e['slug']}/{p['n']}.png\">16bit</a></li>")
    L.append('</ul>')
open('out/index.html','w').write('\n'.join(L))
# contact sheet: idle = first pose
from PIL import ImageDraw
TH=120; cols=6; cw=260; ch=TH+30
rows=(len(out)+cols-1)//cols
sheet=Image.new('RGBA',(cols*cw,rows*ch),(40,40,56,255)); dr=ImageDraw.Draw(sheet)
for i,e in enumerate(out):
    p=e['poses'][0]; cx,cy=(i%cols)*cw,(i//cols)*ch
    for j,d in enumerate(('painted','16bit')):
        c=Image.open(f"out/{d}/{e['slug']}/{p['n']}.png"); s=min(TH/c.height,120/c.width)
        c=c.resize((max(1,int(c.width*s)),max(1,int(c.height*s))),Image.NEAREST)
        sheet.alpha_composite(c,(cx+5+j*125+(120-c.width)//2,cy+5+TH-c.height))
    dr.text((cx+5,cy+TH+10),f"{e['name']} [{p['n']}]",fill='white')
sheet.save('contact.png'); sheet.save('out/contact.png'); print(sheet.size)
