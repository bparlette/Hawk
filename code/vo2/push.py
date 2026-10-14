import sys, json, base64, runpy, io, contextlib
def call(args):
    sys.argv=['apicall','github']+args; out=io.StringIO()
    with contextlib.redirect_stdout(out):
        try: runpy.run_path('/usr/local/bin/apicall', run_name='__main__')
        except SystemExit: pass
    s=out.getvalue()
    try: return json.loads(s)
    except Exception: return s
R=['owner=bparlette','repo=Hawk']
def get(p):
    r=call(['contents_get']+R+['path='+p,'ref=main']); return r if isinstance(r,dict) and r.get('sha') else None
def put(p,data,msg,sha=None):
    a=['contents_put']+R+['path='+p,'message='+msg,'branch=main','content='+base64.b64encode(data).decode()]
    if sha: a.append('sha='+sha)
    r=call(a); c=r.get('commit',{}).get('sha') if isinstance(r,dict) else None; print(p,c or str(r)[:300]); return c
g=get('brad-demos/games.json'); gj=json.loads(base64.b64decode(g['content']))
import pprint
items = gj if isinstance(gj,list) else gj.get('games', gj)
print(type(gj), list(gj.keys()) if isinstance(gj,dict) else len(gj))
for it in (items if isinstance(items,list) else []):
    if 'viral' in json.dumps(it).lower(): print(json.dumps(it))
ex=get('brad-demos/g/viral-overdrive/index.html'); print(base64.b64decode(ex['content']).decode()[:400])
