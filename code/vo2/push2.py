exec(open('push.py').read().split("g=get(")[0])
src=open('index.html').read()
emb='<script src="../../demo-embed.js"></script>\n<style id="demo-embed-css">\n</style>\n'
src=src.replace('<meta charset="UTF-8" />','<meta charset="UTF-8" />\n'+emb,1)
ex=get('brad-demos/g/viral-overdrive-2/index.html')
c1=put('brad-demos/g/viral-overdrive-2/index.html',src.encode(),"Brad's Demos: add Viral Overdrive 2.0 (pasted as-is)",ex and ex['sha'])
g=get('brad-demos/games.json'); gj=json.loads(base64.b64decode(g['content']))
G=gj['games']
if not any(x['id']=='viral-overdrive-2' for x in G):
    i=[x['id'] for x in G].index('viral-overdrive')
    e=dict(G[i]); e.update(id='viral-overdrive-2',title='VIRAL OVERDRIVE 2.0 // Hawk Edition (PolyTrack x Survivors)',path='g/viral-overdrive-2/index.html',note='Pasted by Brad 2026-10-13 (second attempt by the other AI), added as-is with no fixes.')
    G.insert(i+1,e)
    c2=put('brad-demos/games.json',(json.dumps(gj,indent=2,ensure_ascii=False)+'\n').encode(),"Brad's Demos: list Viral Overdrive 2.0",g['sha'])
