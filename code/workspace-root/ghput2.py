import sys, base64, runpy, json, io, contextlib, os
def call(args):
    out=io.StringIO(); sys.argv=['apicall','github']+args
    try:
        with contextlib.redirect_stdout(out): runpy.run_path('/usr/local/bin/apicall',run_name='__main__')
    except SystemExit: pass
    return out.getvalue()
for folder in ['shell-shock','shell-shock-live-action']:
    for f in sorted(os.listdir(folder), key=lambda x: x=='index.html'):
        remote=f'public/{folder}/{f}'
        b=base64.b64encode(open(f'{folder}/{f}','rb').read()).decode()
        sha=None
        try: sha=json.loads(call(['contents_get','owner=bparlette','repo=Aistudio',f'path={remote}'])).get('sha')
        except Exception: pass
        a=['contents_put','owner=bparlette','repo=Aistudio',f'path={remote}',f'message=Add {remote}',f'content={b}']
        if sha: a.append(f'sha={sha}')
        r=call(a)
        try: print('OK',json.loads(r)['content']['path'])
        except Exception: print('ERR',remote,r[:200])
