import sys, base64, runpy, json, io, contextlib, os
files=json.loads(sys.argv[1])
for local,remote in files:
    b=base64.b64encode(open(local,'rb').read()).decode()
    # get sha if exists
    out=io.StringIO()
    sys.argv=['apicall','github','contents_get','owner=bparlette','repo=Aistudio',f'path={remote}']
    sha=None
    try:
        with contextlib.redirect_stdout(out): runpy.run_path('/usr/local/bin/apicall',run_name='__main__')
    except SystemExit: pass
    try: sha=json.loads(out.getvalue()).get('sha')
    except Exception: pass
    args=['apicall','github','contents_put','owner=bparlette','repo=Aistudio',f'path={remote}',f'message=Add {remote}',f'content={b}']
    if sha: args.append(f'sha={sha}')
    sys.argv=args; out=io.StringIO()
    try:
        with contextlib.redirect_stdout(out): runpy.run_path('/usr/local/bin/apicall',run_name='__main__')
    except SystemExit as e: pass
    r=out.getvalue()
    try: print(remote, json.loads(r)['content']['path'])
    except Exception: print(remote,'ERR',r[:300])
