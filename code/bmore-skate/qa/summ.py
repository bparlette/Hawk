#!/usr/bin/env python3
# summarize a bot probe log: result, bot log (presses / stuck), notable events, trace samples
import json, sys, collections
lines = [l for l in open(sys.argv[1]) if l.startswith('{')]
ev = None; trace = None
for l in lines:
    o = json.loads(l)
    if 'eval' in o:
        r = o['r']
        try: d = json.loads(r)
        except Exception: d = r
        if isinstance(d, dict) and 'res' in d: print('RESULT', json.dumps(d['res'])); h = d.get('fpsHist') or []; print('FPS hist n=%d mean=%.1f' % (len(h), sum(h) / max(1, len(h)))); print('ERR', d.get('err'))
        elif isinstance(d, dict) and 'log' in d: print('BOTLOG', d['log']); ev = d['ev']
        elif isinstance(d, list): trace = d
        else: print('EVAL', str(d)[:300])
    elif 'errors' in o: print('CONSOLE ERRORS', o['errors'], o['list'])
    elif 'until' in o: print('UNTIL', o)
if ev:
    c = collections.Counter(e[0] for e in ev); print('EVENTS', dict(c))
    for e in ev:
        if e[0] in ('bail', 'letter', 'tape', 'gap', 'bank', 'grind', 'special', 'respawn') or (e[0] == 'trick' and e[2] >= 150): print('  ', e)
if trace and len(sys.argv) > 2:
    for t in trace: print('   T', t)
