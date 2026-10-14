#!/usr/bin/env python3
# Additive publish of Toad City Rooftops (adapted from bmore-skate/publish.py; contents API, no clone needed) to bparlette/Hawk main (GitHub Pages source): only our files + one games.json entry.
# Run under the demos edit lock:  flock -w 900 /workspace/work/demos/.edit.lock python3 publish.py "<commit msg>"
# Never touches other games, never runs sync-main.sh, never replaces brad-demos/.
import sys, json, base64, runpy, io, contextlib, time, hashlib, os
HERE = os.path.dirname(os.path.abspath(__file__))
ID = 'toad-city-rooftops'
PUB = '/workspace/work/bmore-parkour/pub'
R = ['owner=bparlette', 'repo=Hawk']
def call(args):
    sys.argv = ['apicall', 'github'] + args; out = io.StringIO()
    with contextlib.redirect_stdout(out):
        try: runpy.run_path('/usr/local/bin/apicall', run_name='__main__')
        except SystemExit: pass
    s = out.getvalue()
    try: return json.loads(s)
    except Exception: return s
def get(p):
    r = call(['contents_get'] + R + ['path=' + p, 'ref=main'])
    return r if isinstance(r, dict) and r.get('sha') else None
def blob_sha(data): return hashlib.sha1(b'blob %d\0' % len(data) + data).hexdigest()
def put(p, data, msg, sha=None):
    a = ['contents_put'] + R + ['path=' + p, 'message=' + msg, 'branch=main', 'content=' + base64.b64encode(data).decode()]
    if sha: a.append('sha=' + sha)
    r = call(a); c = r.get('commit', {}).get('sha') if isinstance(r, dict) else None
    print(p, c or ('FAIL ' + str(r)[:300])); return c
msg = sys.argv[1] if len(sys.argv) > 1 else 'Brad Demos: Toad City Rooftops'
commits = []
files = [(os.path.join(PUB, 'index.html'), f'brad-demos/g/{ID}/index.html'),
         (os.path.join(PUB, 'three.module.min.js'), f'brad-demos/g/{ID}/three.module.min.js'),
         (os.path.join(PUB, 'thumb.webp'), f'brad-demos/thumbs/{ID}.webp')]
for src, dst in files:
    data = open(src, 'rb').read(); ex = get(dst)
    if ex and ex['sha'] == blob_sha(data): print(dst, 'unchanged'); continue
    c = put(dst, data, f'{msg}: {os.path.basename(dst)}', ex['sha'] if ex else None)
    if not c: sys.exit('PUT FAILED ' + dst)
    commits.append(c)
entry = json.load(open(os.path.join(PUB, 'entry.json'), encoding='utf-8'))
for attempt in range(4):
    g = get('brad-demos/games.json'); raw = base64.b64decode(g['content']).decode(); gj = json.loads(raw)
    games = [x for x in gj['games'] if x['id'] != ID]
    ids = [x['id'] for x in games]
    anchor = max([i for i, x in enumerate(games) if x['id'].startswith('toad-city-')] or [i for i, x in enumerate(games) if 'toad' in x['id']] or [len(games) - 1])
    games.insert(anchor + 1, entry); gj['games'] = games
    if entry['category'] not in gj['categories']: gj['categories'].append(entry['category'])
    nl = '\n' if raw.endswith('\n') else ''
    fmt = next(((ind, ea) for ind in (2, 1, 4, '\t') for ea in (False, True) if json.dumps(json.loads(raw), indent=ind, ensure_ascii=ea) + nl == raw), None)
    if not fmt: sys.exit('games.json format not reproducible - refusing to rewrite it')
    data = (json.dumps(gj, indent=fmt[0], ensure_ascii=fmt[1]) + nl).encode()  # the file's own current format, verified by exact round-trip
    c = put('brad-demos/games.json', data, f'{msg}: games.json entry (after {games[anchor]["id"]})', g['sha'])
    if c: commits.append(c); break
    time.sleep(5)
else: sys.exit('games.json PUT FAILED')
print('COMMITS', ' '.join(commits))
