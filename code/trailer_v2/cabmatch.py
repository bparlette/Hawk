"""Post-process the trailer page (output of make_page2.py, or site_final/index.html in place) so that:
  * 22:05 lock: no native controls / fullscreen / PiP / AirPlay on any video (idempotent).
  * 22:20 cabinet match: the hero is the game's OWN cabinet exactly as shellshock-live.surge.sh lays it out in
    portrait "normal" mode (cabinet_special.png, #cab/#screen/x-cap/x-ring/x-fx/x-stick CSS copied from the game,
    and the game's fit: S=min(vw/470,vh/900), left=(vw-470S)/2-150S, top=(vh-900S)/2-140S) in a viewport-sized
    #hero box; title + sections follow below.
Usage: python3 cabmatch.py site_final/index.html   (rewrites in place)   |   from cabmatch import finalize
"""
import re, sys

GAME_CAB_CSS = r'''#hero{position:relative;width:100%;height:100vh;overflow:hidden;background:#07070a;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
#cab{--S:1px;position:absolute;z-index:1;left:0;top:0;width:calc(704 * var(--S));height:calc(1520 * var(--S));background:url(cab/cabinet_special.png) 0 0/100% 100% no-repeat;touch-action:manipulation;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.x-stick{position:absolute;left:26.99%;top:57.50%;width:8.24%;height:5.39%;transform-origin:50% 95.1%;transition:transform 70ms ease-out;pointer-events:none;z-index:3}
.x-cap,.x-ring{position:absolute;pointer-events:none;border-radius:50%}
.x-cap{z-index:2;opacity:0;background:url(cab/cabinet_special.png) no-repeat;background-size:calc(704 * var(--S)) calc(1520 * var(--S));background-position:calc(var(--x) * -1 * var(--S)) calc(var(--y) * -1 * var(--S));transition:transform 50ms linear,filter 50ms linear}
.x-cap.on{opacity:1;transform:translateY(calc(3 * var(--S)));filter:brightness(.72);box-shadow:inset 0 calc(2 * var(--S)) calc(5 * var(--S)) rgba(0,0,0,.65),inset 0 0 calc(3 * var(--S)) rgba(0,0,0,.4)}
.x-ring{z-index:1;opacity:0;background:radial-gradient(circle,#0b0b0e 55%,#050507 72%,rgba(0,0,0,.6) 100%)}
.x-ring.on{opacity:1}
#screen{position:absolute;left:23.72%;top:34.41%;width:53.41%;height:17.83%;overflow:hidden;background:#000;--row:1px}
#screen video{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;display:block;background:#000;max-width:none;aspect-ratio:auto;border-radius:0;box-shadow:none;margin:0;z-index:0}
#screen::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;background:radial-gradient(120% 90% at 30% 18%,rgba(255,255,255,.08),transparent 55%);box-shadow:inset 0 0 4px 1px rgba(0,0,0,.9)}
#screen.crt::after{background:radial-gradient(120% 90% at 30% 18%,rgba(255,255,255,.10),rgba(255,255,255,.03) 35%,transparent 60%),radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.25) 100%),repeating-linear-gradient(to bottom,transparent 0 var(--row),rgba(0,0,0,.09) var(--row) calc(var(--row) * 2)),repeating-linear-gradient(to right,rgba(255,40,40,.05) 0 1px,rgba(40,255,80,.05) 1px 2px,rgba(60,90,255,.05) 2px 3px);
 box-shadow:inset 0 0 28px 8px rgba(0,0,0,.35),inset 0 0 10px 2px rgba(0,0,0,.3),inset 0 0 4px 1px rgba(0,0,0,.6);border-radius:6%/9%}
.x-fx{position:absolute;pointer-events:none;transform:translate(-50%,-50%);border-radius:50%;aspect-ratio:1;opacity:0;transition:opacity 60ms linear}
.x-btn{width:9%}
.x-btn.on{opacity:1;box-shadow:0 0 0 1px var(--c),0 0 7px 2px var(--c),inset 0 0 5px 1px var(--c)}
'''

LOCK_CSS = '''#screen video{pointer-events:none}
video::-webkit-media-controls,video::-webkit-media-controls-enclosure,video::-webkit-media-controls-panel,video::-webkit-media-controls-start-playback-button,video::-webkit-media-controls-fullscreen-button{display:none!important;-webkit-appearance:none}
video.mini{cursor:pointer;touch-action:manipulation}
'''

LOCK_ATTRS = 'playsinline webkit-playsinline disablepictureinpicture disableremoteplayback x-webkit-airplay="deny"'

LOCK_JS = '''<script>
(function(){
  /* keep every video inside the page/cabinet: never native fullscreen or PiP */
  var vids=[].slice.call(document.querySelectorAll("video"));
  function back(v){ try{ if(v.webkitDisplayingFullscreen&&v.webkitExitFullscreen) v.webkitExitFullscreen(); }catch(e){}
    try{ if(document.fullscreenElement&&document.exitFullscreen) document.exitFullscreen(); }catch(e){}
    try{ if(document.webkitFullscreenElement&&document.webkitExitFullscreen) document.webkitExitFullscreen(); }catch(e){}
    try{ if(document.pictureInPictureElement) document.exitPictureInPicture(); }catch(e){} }
  vids.forEach(function(v){
    v.playsInline=true; v.setAttribute("playsinline",""); v.setAttribute("webkit-playsinline",""); v.disablePictureInPicture=true; v.controls=false;
    ["webkitbeginfullscreen","enterpictureinpicture","webkitpresentationmodechanged"].forEach(function(ev){ v.addEventListener(ev,function(){ setTimeout(function(){back(v);},0); try{ if(v.webkitSetPresentationMode) v.webkitSetPresentationMode("inline"); }catch(e){} }); });
    v.addEventListener("dblclick",function(e){ e.preventDefault(); });
    if(v.classList.contains("mini")) v.addEventListener("click",function(e){ e.preventDefault();
      if(v.paused){ vids.forEach(function(o){ if(o!==v&&o.classList.contains("mini")) o.pause(); }); var p=v.play(); if(p&&p.catch)p.catch(function(){}); } else v.pause(); });
  });
  ["fullscreenchange","webkitfullscreenchange"].forEach(function(ev){ document.addEventListener(ev,function(){ vids.forEach(back); }); });
})();
</script>
'''

# the game's portrait/landscape "normal" fit (shellshock-live index.html resize(), non-fill branch), applied to #hero
FIT_JS = '''var hero=document.getElementById("hero"), scrEl=document.getElementById("screen"), lw=-1, lh=-1;
  function size(force){
    var vw=document.documentElement.clientWidth||innerWidth, vh=innerHeight;
    if(force!==true && vw===lw && Math.abs(vh-lh)<150) return; /* Safari toolbar show/hide while scrolling: keep the fit */
    lw=vw; lh=vh; hero.style.height=vh+"px";
    var S=Math.min(vw/470,vh/900);
    cab.style.setProperty("--S",S+"px");
    cab.style.left=((vw-470*S)/2-150*S)+"px";
    cab.style.top=((vh-900*S)/2-140*S)+"px";
    var sw=scrEl.clientWidth, sh=scrEl.clientHeight, ch=sw*224/384; if(ch>sh) ch=sh;
    scrEl.style.setProperty("--row",(ch/224)+"px");
  }
  size(true); window.addEventListener("resize",size); window.addEventListener("orientationchange",function(){ setTimeout(function(){size(true);},250); });'''


# 22:35 level clips + stills are game-only landscape (1068x624, no cabinet): shown at the game's aspect, never 9:16
GAME_ONLY_CSS = '''/*game-only-minis*/video.mini{max-width:820px;width:100%;aspect-ratio:1068/624;object-fit:cover;border-radius:10px;image-rendering:auto}
.gal{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
.gal img{aspect-ratio:1068/624;object-fit:cover}
'''


def finalize(page):
    if "/*game-only-minis*/" not in page:
        page = page.replace('</style></head>', GAME_ONLY_CSS + '</style></head>', 1)
    # ---- 22:05 lock (no-op when already present)
    if "keep every video inside the page/cabinet" not in page:
        page = page.replace('<video id="hv" autoplay muted loop playsinline webkit-playsinline preload',
                            '<video id="hv" autoplay muted loop ' + LOCK_ATTRS + ' preload')
        page = page.replace('<video controls playsinline preload="none"', '<video class="mini" ' + LOCK_ATTRS + ' preload="none"')
        page = page.replace('</style></head>', LOCK_CSS + '</style></head>', 1)
        page = page.replace('</body></html>', LOCK_JS + '</body></html>')
    if 'id="hero"' in page:
        return page
    # ---- CSS: game cabinet rules replace the old .cabwrap/#cab/... block (up to #snd)
    a = page.index('.cabwrap{'); b = page.index('#snd{')
    page = page[:a] + GAME_CAB_CSS + page[b:]
    page = page.replace('#screen video{pointer-events:none}\n', '#screen video{pointer-events:none}\n', 1)
    # ---- HTML: cabinet first (full viewport, game fit), header + rest below
    m = re.search(r'(<header>.*?</header>)\n<main>\n  <div class="cabwrap"><div id="cab">(.*?)\n  </div></div>\n', page, re.S)
    assert m, "hero markup not found"
    inner = m.group(2).replace(',.75)"', ',.48)"')  # game's fx glow colours
    page = page[:m.start()] + '<div id="hero"><div id="cab">' + inner + '\n</div></div>\n' + m.group(1) + '\n<main>\n' + page[m.end():]
    # ---- JS: game fit instead of width-only sizing
    old = re.search(r'function size\(\)\{ cab\.style\.setProperty\("--S",\(cab\.clientWidth/704\)\+"px"\); \}\n  size\(\); window\.addEventListener\("resize",size\); if\(window\.ResizeObserver\) new ResizeObserver\(size\)\.observe\(cab\);', page)
    assert old, "size() not found"
    page = page[:old.start()] + FIT_JS + page[old.end():]
    page = page.replace('header{text-align:center;padding:28px 16px 10px}', 'header{text-align:center;padding:22px 16px 10px}')
    return page


if __name__ == "__main__":
    p = sys.argv[1]
    s = open(p).read()
    open(p, "w").write(finalize(s))
    print("cabmatch applied:", p)
