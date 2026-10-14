# Jump-to section index directly under the first giant PLAY NOW button, plus the "Full trailer plays in the cabinet" (#fullplay) script.
# Idempotent: skips whatever is already there. Works on the Live page and the 16-bit page (versus label taken from the page's own #versus h2).
# usage: python3 sprites_patch/secindex.py [index.html ...]   (default: ../site_final/index.html). apply.py calls it too.
import sys, os, re
D = os.path.dirname(os.path.abspath(__file__))

CSS = ('/*secidx*/nav.secidx{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-width:980px;margin:-6px auto 22px;padding:0 4px}'
       'nav.secidx a{flex:1 1 auto;min-width:140px;white-space:nowrap;display:flex;align-items:center;justify-content:center;text-align:center;min-height:44px;padding:8px 10px;border:2px solid var(--y);border-radius:10px;'
       'background:#160f1d;color:var(--y);text-decoration:none;font:900 15px/1.1 Impact,\'Arial Black\',sans-serif;letter-spacing:1px;touch-action:manipulation;-webkit-tap-highlight-color:transparent}'
       '@media (hover:hover){nav.secidx a:hover{background:var(--y);color:#140d1b}}nav.secidx a:focus-visible{background:var(--y);color:#140d1b;outline:none}nav.secidx a:active{transform:translateY(2px)}'
       '@media (max-width:480px){nav.secidx{display:grid;grid-template-columns:1fr 1fr}nav.secidx a{min-width:0;white-space:normal}nav.secidx a{font-size:14px}nav.secidx a:last-child:nth-child(odd){grid-column:1/-1}}'
       '#hero,section.lvl,section.guide{scroll-margin-top:10px}')

JS = r'''<script>/*secidx*/(function(){var nav=document.querySelector("nav.secidx");if(!nav)return;var M=10,job=0;
function stop(){job++;}["wheel","touchstart","keydown"].forEach(function(ev){addEventListener(ev,stop,{passive:true});});
function go(t){var my=++job,last=-1,still=0,fixes=0,n=0;var top0=t.id==="hero";
function want(){return top0?0:Math.max(0,Math.min(scrollY+t.getBoundingClientRect().top-M,document.documentElement.scrollHeight-innerHeight));}
scrollTo({top:want(),behavior:"smooth"});
(function chk(){if(my!==job||++n>120)return;var y=scrollY;if(Math.abs(y-last)<1)still++;else still=0;last=y;
if(still>=3){var w=want();if(Math.abs(w-y)>4&&fixes<6){fixes++;still=0;scrollTo({top:w,behavior:fixes>2?"auto":"smooth"});}else return;}
setTimeout(chk,100);})();}
nav.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href^='#']");if(!a)return;var t=document.getElementById(a.getAttribute("href").slice(1));if(!t)return;
e.preventDefault();go(t);try{history.replaceState(null,"",a.getAttribute("href"));}catch(_){}});})();</script>'''

FULLPLAY = '<script>(function(){var a=document.getElementById("fullplay");if(!a)return;a.addEventListener("click",function(e){e.preventDefault();var v=document.getElementById("hv");if(!v)return;(document.getElementById("screen")||v).scrollIntoView({behavior:"smooth",block:"center"});try{v.currentTime=0;var b=document.getElementById("snd");if(v.muted&&b)b.click();}catch(_){}var p=v.play();if(p&&p.catch)p.catch(function(){v.muted=true;v.play();});});})();</script>'

def nav_html(s):
    m = re.search(r'id="versus"[^>]*>\s*<h2>([^<]+)</h2>', s)
    vs = m.group(1).strip() if m else 'LIVE VS 16-BIT'
    items = [('hero', '▶ TRAILER'), ('level1', 'LEVEL MOVIES'), ('levels', 'THE LEVELS'), ('cast', 'THE CAST'), ('versus', vs)]
    for i, _ in items:
        assert ('id="%s"' % i) in s, 'missing section id ' + i
    return '\n  <nav class="secidx" aria-label="Jump to a section">' + ''.join('<a href="#%s">%s</a>' % (i, t) for i, t in items) + '</nav>'

def patch(p):
    s = open(p).read(); done = []
    if '/*secidx*/' not in s:
        m = re.search(r'<a class="play"[^>]*>.*?</a>', s, re.S); assert m, 'no PLAY NOW button'
        s = s[:m.end()] + nav_html(s) + s[m.end():]
        s = s.replace('</style></head>', CSS + '</style></head>', 1)
        s = s.replace('</body></html>', JS + '</body></html>', 1)
        assert s.count('/*secidx*/') == 2; done.append('secidx')
    s2 = re.sub(r'<a href="[^"]+" download>Full trailer · ([^<]+)</a>', r'<a href="#top" id="fullplay">Full trailer · \1 · plays in the cabinet</a>', s, 1)
    if s2 != s: s = s2; done.append('fullplay-link')
    if 'getElementById("fullplay")' not in s and 'id="fullplay"' in s:
        s = s.replace('</body></html>', FULLPLAY + '</body></html>', 1); done.append('fullplay')
    open(p, 'w').write(s); print(p, done or 'already applied')

if __name__ == '__main__':
    for p in (sys.argv[1:] or [os.path.join(D, '..', 'site_final', 'index.html')]):
        patch(p)
