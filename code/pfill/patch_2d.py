#!/usr/bin/env python3
"""Portrait-fill "easy cheats" for the 2D games. Idempotent (markers PFILL / PFILLBG). Backs up to pfill/backup/.
  python3 patch_2d.py ss-live ss16 knockout hollow rta
"""
import json, os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
BG = open(os.path.join(HERE, 'pfill-bg.js')).read()
BK = os.path.join(HERE, 'backup')

def bak(f):
    os.makedirs(BK, exist_ok=True)
    d = os.path.join(BK, f.strip('/').replace('/', '_'))
    if not os.path.exists(d): shutil.copy2(f, d)

def script(cfg):
    return '<script>' + BG.replace('/*CFG*/', json.dumps(cfg)) + '</script>\n'

def edit(f, pairs, inject_before_body=None, head=False):
    s = open(f, encoding='utf-8').read()
    if 'PFILL' in s:
        if inject_before_body and '<script>/*PFILLBG*/' in s:  # refresh the injected backdrop script only
            i = s.index('<script>/*PFILLBG*/'); j = s.index('</script>', i) + len('</script>\n')
            s = s[:i] + s[j:]
            k = s.find('</head>') if head else s.rfind('</body>')
            s = s[:k] + inject_before_body + s[k:]; open(f, 'w', encoding='utf-8').write(s); print('refreshed', f)
        else: print('already', f)
        return
    bak(f)
    for a, b in pairs:
        if s.count(a) != 1: sys.exit(f'{f}: {s.count(a)} x {a[:70]}')
        s = s.replace(a, b)
    if inject_before_body:
        i = s.find('</head>') if head else s.rfind('</body>')
        if i < 0: sys.exit(f'{f}: no </body>/</head>')
        s = s[:i] + inject_before_body + s[i:]
    open(f, 'w', encoding='utf-8').write(s)
    print('patched', f)

def ss(f):  # Shell Shock Live / 16-Bit: full-screen-portrait uses all the height; blurred floor/wall extension in the bands
    edit(f, [('let gw = vw, gh = vw * 224 / 384;', 'let gw = vw, gh = portrait ? availH : vw * 224 / 384; /*PFILL*/')],
         script({'src': '#game', 'box': '#screen', 'lw': 384, 'top': {'rows': [0, 1], 'mode': 'mirror'}, 'bot': {'rows': [0, 1], 'mode': 'mirror'},
                 'blur': 10, 'fade': 0.9, 'near': 0.35}))

KO_TOP = r'''
/*PFILL*/ // portrait fill: the arena's upper decks above the ring (bgC + the live crowd, no ropes), tier on tier, darker as they go up
const pfTier = mk(W + 16, 58), pfTg = pfTier.getContext('2d');
window.pfKoTop = function (c, x, y0, w, h) {
  pfTg.clearRect(0, 0, W + 16, 58); pfTg.drawImage(bgC, 0, 40, W + 16, 58, 0, 0, W + 16, 58);
  pfTg.save(); pfTg.translate(0, -40); drawCrowd(pfTg, S.time, S.excite || 0); pfTg.restore();
  let i = 0;
  for (let yy = y0 + h - 58; yy > y0 - 58; yy -= 58, i++) {
    c.drawImage(pfTier, 8, 0, W, 58, x, Math.round(yy), w, 58);
    c.fillStyle = 'rgba(7,6,15,' + Math.min(0.85, 0.18 + i * 0.16) + ')'; c.fillRect(x, Math.round(yy), w, 58);
  }
};
'''

def knockout(d):
    edit(os.path.join(d, 'index.html'),
         [('</style>', '@media (orientation:portrait){#stage{align-items:flex-end}} /*PFILL: canvas sits on the ring apron, the crowd fills above*/\n</style>')],
         script({'src': '#screen', 'box': '#stage', 'lw': 256, 'topFn': 'pfKoTop', 'bg': '#07060f', 'rgb': '7,6,15', 'fade': 0.7, 'near': 0.0, 'every': 4}))
    gj = os.path.join(d, 'game.js'); s = open(gj, encoding='utf-8').read()
    if 'PFILL' not in s:
        bak(gj); open(gj, 'w', encoding='utf-8').write(s.rstrip('\n') + '\n' + KO_TOP); print('patched', gj)

HOLLOW_CSS = '''/*PFILL*/ @media (orientation:portrait){
 body{background:
  radial-gradient(ellipse 75% 55% at 50% 50%,rgba(0,0,0,0) 40%,rgba(0,0,0,.88) 100%),
  linear-gradient(180deg,#0a0608 0,#0a0608 5%,#2a1a12 5.4%,#0a0608 6.2%,rgba(0,0,0,0) 6.6%,rgba(0,0,0,0) 76%,#2a1a12 76.3%,#120b08 77%,#1a0f0a 77%,#1a0f0a 100%),
  repeating-linear-gradient(180deg,rgba(0,0,0,0) 0 3px,rgba(0,0,0,.18) 3px 4px),
  repeating-linear-gradient(90deg,#26151e 0 18px,#331d29 18px 20px,#1b1016 20px 38px,#140b10 38px 40px),#140b10}
 canvas#c{box-shadow:0 0 0 3px #4a3418,0 0 0 5px #120a06,0 0 0 6px #6a4c22,0 0 34px 10px #000}
}
'''

def hollow(d):
    edit(os.path.join(d, 'index.html'), [('</style>', HOLLOW_CSS + '</style>')])

RTA_CSS = '''/*PFILL*/ @media (orientation: portrait) {
        #stage { flex: 1 1 auto; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
        #wrap { padding-top: 0; }
      }
    </style>'''

def rta(d):
    for i in range(1, 8):
        edit(os.path.join(d, '0%dq.html' % i), [('    </style>', RTA_CSS)],
             script({'src': '#c', 'box': '#stage', 'lw': 320, 'top': {'rows': [0, 1], 'mode': 'mirror'}, 'bot': {'rows': [0, 1], 'mode': 'mirror'},
                     'blur': 8, 'fade': 0.88, 'near': 0.3}), head=True)  # head: the RTA loop stubs window.requestAnimationFrame

T = {'ss-live': lambda: ss('/workspace/work/deploy/shell-shock-live-action/index.html'),
     'ss16': lambda: ss('/workspace/work/g16js/site/index.html'),
     'knockout': lambda: knockout('/workspace/work/knockout/site'),
     'hollow': lambda: hollow('/workspace/work/hollow-manor/site'),
     'rta': lambda: rta('/workspace/work/rta-standalone')}
for a in sys.argv[1:]: T[a]()
