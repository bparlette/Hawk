// ================= boot, live loop, capture API =================
if(typeof LEVELS_INIT==='function')LEVELS_INIT();
G.segs=segsFromQuery();startSeg(0);
window.MB={G,
 frame(n=2){for(let i=0;i<n;i++)step(STEP);render();return G.done},
 skip(frames,n=2){for(let f=0;f<frames;f++)for(let i=0;i<n;i++)step(STEP)},
 audioRun(){AUDIO_LOG=[];G.rec0=G.rt;let f=0;while(!G.done&&f<60*120){step(STEP);f++}return{dur:f/60,events:AUDIO_LOG.length}},
 renderAudio,qa(){return G.qa}};
if(!CAP){let last=performance.now(),acc=0;
 function loop(now){requestAnimationFrame(loop);acc+=Math.min(.1,(now-last)/1000);last=now;while(acc>=STEP){step(STEP);acc-=STEP}render();if(!AC||AC.state!=='running'){x.save();x.setTransform(BASE,0,0,BASE,0,0);stext('🔊 TAP FOR SOUND',540,1800,40,'#fff',{a:.8+.2*Math.sin(now/200)});x.restore()}}
 requestAnimationFrame(loop);addEventListener('pointerdown',unlockAudio);addEventListener('keydown',unlockAudio)}
