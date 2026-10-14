exec(open('/workspace/work/vo2/push.py').read().split("g=get(")[0])
src=open('index.html').read()
emb='<script src="../../demo-embed.js"></script>\n<style id="demo-embed-css">\n</style>\n'
src=src.replace('<meta charset="UTF-8">','<meta charset="UTF-8">\n'+emb,1)
P='brad-demos/g/drift-survivors-after-hark/index.html'
ex=get(P); put(P,src.encode(),"Brad's Demos: add Drift Survivors (other AI, after Hark instructions), as-is",ex and ex['sha'])
g=get('brad-demos/games.json'); gj=json.loads(base64.b64decode(g['content'])); G=gj['games']
if not any(x['id']=='drift-survivors-after-hark' for x in G):
    i=[x['id'] for x in G].index('viral-overdrive-2')
    e=dict(G[i]); e.update(id='drift-survivors-after-hark',title='DRIFT SURVIVORS — Toon 3D Fan Game - after harkinstructions',path='g/drift-survivors-after-hark/index.html',
      keys={"up":"KeyW","down":"KeyS","left":"KeyA","right":"KeyD","attack":"Space","jump":"KeyF","special":"KeyE","start":"Enter"},
      labels={"attack":"SPACE · DODGE","jump":"F · HOOK","special":"E · EMP"},extras=[{"label":"PAUSE","key":"KeyP"},{"label":"MUTE","key":"KeyM"}],
      note='Pasted by Brad 2026-10-13: the other AI\'s official remake after reading Hark\'s instructions. Added as-is with no fixes.')
    e.pop('thumb',None)
    G.insert(i+1,e)
    put('brad-demos/games.json',(json.dumps(gj,indent=2,ensure_ascii=False)+'\n').encode(),"Brad's Demos: list Drift Survivors (after Hark instructions)",g['sha'])
