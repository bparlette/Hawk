import sys, json, base64, runpy, io, contextlib, hashlib
R=['owner=bparlette','repo=Hawk']
def call(args):
    sys.argv=['apicall','github']+args; out=io.StringIO()
    with contextlib.redirect_stdout(out):
        try: runpy.run_path('/usr/local/bin/apicall', run_name='__main__')
        except SystemExit: pass
    s=out.getvalue()
    try: return json.loads(s)
    except Exception: return s
def get(p):
    r=call(['contents_get']+R+['path='+p,'ref=main'])
    return r if isinstance(r,dict) and r.get('sha') else None
def blob_sha(d): return hashlib.sha1(b'blob %d\0'%len(d)+d).hexdigest()
def put(p,data,msg,sha=None):
    a=['contents_put']+R+['path='+p,'message='+msg,'branch=main','content='+base64.b64encode(data).decode()]
    if sha: a.append('sha='+sha)
    r=call(a); c=r.get('commit',{}).get('sha') if isinstance(r,dict) else None
    print(p, c or ('FAIL '+str(r)[:300]), flush=True); return c
