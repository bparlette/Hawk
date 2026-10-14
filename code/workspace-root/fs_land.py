import sys
OLD = '    if (navigator.standalone || matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches) setFill(true);\n'
NEW = OLD + '''    // Turning the phone sideways locks the game into full screen; turning it back upright restores the cabinet
    // (unless the player turned full screen on themselves with the button).
    const land = matchMedia("(orientation: landscape) and (pointer: coarse)");
    let auto = false;
    function onOrient() {
      const on = root.classList.contains("fill");
      if (land.matches && !on) { auto = true; setFill(true); }
      else if (!land.matches && on && auto) { auto = false; setFill(false); }
    }
    btn.addEventListener("pointerup", () => { auto = false; }, true);
    if (land.addEventListener) land.addEventListener("change", onOrient); else land.addListener(onOrient);
    addEventListener("orientationchange", () => setTimeout(onOrient, 50));
    onOrient();
'''
for f in sys.argv[1:]:
    h=open(f).read(); assert OLD in h; open(f,'w').write(h.replace(OLD,NEW)); print('ok')
