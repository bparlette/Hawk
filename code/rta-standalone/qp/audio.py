# python3 audio.py in.html out.html  -- adds shell music engine (2 voices + noise drums from GAMES[gi].music) and noise(); replaces old 1-line loop
import sys,re
s=open(sys.argv[1]).read()
if 'function playMusic()' not in s:
    a='        var SFX = {'; assert s.count(a)==1
    eng='''        var nbuf = null;
        function noise(dur, vol, hp) {
          if (muted) return;
          try {
            if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
            if (!nbuf) { nbuf = actx.createBuffer(1, actx.sampleRate * 0.5, actx.sampleRate); var nd = nbuf.getChannelData(0); for (var ni = 0; ni < nd.length; ni++) nd[ni] = Math.random() * 2 - 1; }
            var src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
            src.buffer = nbuf; f.type = "highpass"; f.frequency.value = hp || 1000;
            g.gain.value = vol || 0.05; g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
            src.connect(f); f.connect(g); g.connect(actx.destination); src.start(); src.stop(actx.currentTime + dur);
          } catch (e) {}
        }
        function kick() {
          if (muted) return;
          try {
            if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
            var o = actx.createOscillator(), g = actx.createGain(), n = actx.currentTime;
            o.type = "sine"; o.frequency.setValueAtTime(150, n); o.frequency.exponentialRampToValueAtTime(45, n + 0.12);
            g.gain.setValueAtTime(0.12, n); g.gain.exponentialRampToValueAtTime(0.0001, n + 0.16);
            o.connect(g); g.connect(actx.destination); o.start(); o.stop(n + 0.17);
          } catch (e) {}
        }
        /* music: GAMES[gi].music = { step: frames per 16th, mel: [Hz|0], bass: [Hz|0], drum: "k.h.s.h..." } */
        function playMusic() {
          var M = GAMES[gi] && GAMES[gi].music; if (!M || state !== "play" || paused || muted || t % M.step !== 0) return;
          var i = Math.floor(t / M.step);
          var m = M.mel[i % M.mel.length]; if (m) beep(m, M.step / 60 * 0.9, M.lead || "square", 0.022);
          var b = M.bass[i % M.bass.length]; if (b) beep(b, M.step / 60 * 1.8, "triangle", 0.05);
          var d = M.drum[i % M.drum.length];
          if (d === "k") kick(); else if (d === "s") noise(0.12, 0.05, 1200); else if (d === "h") noise(0.03, 0.025, 6000);
        }
'''
    s=s.replace(a,eng+a)
    old=re.search(r'\n          if \(state === "play" && !paused && !muted && t % \d+ === 0\) \{ var MUS = .*\n', s)
    assert old, "old music line"
    s=s.replace(old.group(0),'\n          playMusic();\n')
open(sys.argv[2],'w').write(s)
print("audio ok")
