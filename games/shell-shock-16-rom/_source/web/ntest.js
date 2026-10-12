const GX=require('./gx.js'); const fs=require('fs');
GX().then(M=>{
  M.FS.writeFile('/rom.bin', fs.readFileSync('rom.bin'));
  const p=M._malloc(16); M.HEAPU8.set(Buffer.from('/rom.bin\0'),p);
  const sr=M._gx_init(p); console.log('rate',sr);
  let au=0; const t0=Date.now();
  for(let i=0;i<600;i++){ M._gx_pad(i>200&&i<210?(1<<3):0); M._gx_frame(); au+=M._gx_alen(); }
  console.log('600 frames ms',Date.now()-t0,'audio frames',au,'size',M._gx_w(),M._gx_h());
  const w=M._gx_w(),h=M._gx_h(),fb=M._gx_fb()>>2; const px=M.HEAPU32.subarray(fb,fb+w*h);
  fs.writeFileSync('/tmp/fb.raw',Buffer.from(px.buffer,px.byteOffset,w*h*4)); fs.writeFileSync('/tmp/fb.txt',w+' '+h);
});
