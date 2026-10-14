// node render.js clipN outBase   -> outBase.mp4 (1080x1920 30fps H.264 + AAC audio)
const {chromium}=require('/workspace/work/trailer_v2/node_modules/playwright-core');const fs=require('fs');const {spawn,execFileSync}=require('child_process');
(async()=>{const [clip,out]=process.argv.slice(2);const tmp='/tmp/mb_'+clip;const b=await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const url='file:///workspace/work/mashup-brawler/dist/index.html?capture=1&clip='+clip;
 // 1) audio pass (same deterministic sim, no drawing)
 const pa=await b.newPage();await pa.goto(url);const ar=await pa.evaluate(()=>MB.audioRun());const wav=await pa.evaluate(d=>MB.renderAudio(d),ar.dur+0.5);fs.writeFileSync(out+'.wav',Buffer.from(wav,'base64'));await pa.close();
 console.log('audio',ar);
 // 2) frames -> ffmpeg
 const p=await b.newPage({viewport:{width:1080,height:1920}});p.on('pageerror',e=>console.log('ERR',e.message));await p.goto(url);await p.waitForTimeout(200);
 const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-r','30',tmp+'_v.mp4']);
 let n=0;const t0=Date.now();
 while(true){const r=await p.evaluate(()=>{const d=MB.frame(2);return{d,img:d?null:document.getElementById('c').toDataURL('image/jpeg',.93)}});if(r.d)break;
  const buf=Buffer.from(r.img.split(',')[1],'base64');if(!ff.stdin.write(buf))await new Promise(res=>ff.stdin.once('drain',res));n++;if(n%150==0)console.log('frames',n,((Date.now()-t0)/1000).toFixed(0)+'s');if(n>3000)break}
 ff.stdin.end();await new Promise(res=>ff.on('close',res));const qa=await p.evaluate(()=>MB.qa());await b.close();
 const dur=n/30;console.log('frames',n,'dur',dur.toFixed(3));
 execFileSync('ffmpeg',['-y','-loglevel','error','-i',tmp+'_v.mp4','-i',out+'.wav','-t',dur.toFixed(3),'-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart','-shortest',tmp+'.mp4']);
 fs.copyFileSync(tmp+'.mp4',out+'.mp4');fs.unlinkSync(tmp+'_v.mp4');fs.unlinkSync(tmp+'.mp4');fs.writeFileSync(out+'_qa.json',JSON.stringify(qa));console.log('QA miss',qa.filter(q=>q[3]!=='OK').length,'/',qa.length);console.log('DONE',out+'.mp4')})();
