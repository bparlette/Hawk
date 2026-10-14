// Render Toad City's own Web Audio club-beat instruments (music.html = verbatim copy of the game's Voltage Vic synth) to WAV beds + one-shots.
// node music.js <outdir>
const fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright-core'); } catch (e) { pw = require('/workspace/work/trailer_v2/node_modules/playwright-core'); }
const out = process.argv[2] || 'music'; fs.mkdirSync(out, { recursive: true });
const STYLES = {
  // pi per bar (the game's own phase intensity: 0 drums, 1 + bass stabs, 2 + chants + busy hats), drop = sub stab bars
  club_a: { bars: 22, pi: (b) => (b < 1 ? 0 : b < 4 ? 1 : 2), drop: [7, 11, 15, 19] },
  club_b: { bars: 22, pi: (b) => (b < 6 ? 1 : 2), drop: [5, 13, 17] },
  club_c: { bars: 22, pi: (b) => (b < 2 ? 1 : 2), drop: [9, 13, 17, 21] },
  chill: { bars: 22, pi: () => 1, drop: [], vol: 0.8, noChant: true },
  night: { bars: 22, pi: () => -1, drop: [] },
};
(async () => {
  const b = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext()).newPage();
  await p.goto('file://' + path.resolve(__dirname, 'music.html'));
  const render = async (name, fnSrc, secs) => {
    const r = await p.evaluate(async ([fnSrc, secs]) => { setup(secs); const { I, KICK, SNARE, HAT, BASS } = MUSIC; (new Function('I', 'KICK', 'SNARE', 'HAT', 'BASS', fnSrc))(I, KICK, SNARE, HAT, BASS);
      const buf = await AC.startRendering(); const n = buf.length, c0 = buf.getChannelData(0), c1 = buf.getChannelData(1); const o = new Int16Array(n * 2); let pk = 0;
      for (let i = 0; i < n; i++) { pk = Math.max(pk, Math.abs(c0[i]), Math.abs(c1[i])); o[2 * i] = Math.max(-32768, Math.min(32767, c0[i] * 32767)); o[2 * i + 1] = Math.max(-32768, Math.min(32767, c1[i] * 32767)); }
      const u = new Uint8Array(o.buffer); let s = ''; for (let k = 0; k < u.length; k += 32768) s += String.fromCharCode.apply(null, u.subarray(k, k + 32768)); return { pk, b64: btoa(s) }; }, [fnSrc, secs]);
    const data = Buffer.from(r.b64, 'base64'), h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(44100, 24); h.writeUInt32LE(176400, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
    fs.writeFileSync(path.join(out, name + '.wav'), Buffer.concat([h, data])); console.log(name, 'peak', r.pk.toFixed(3), 'secs', secs);
  };
  const SP = 60 / 130 / 4; // 16th at 130 bpm (the game's proc bpm)
  for (const [name, st] of Object.entries(STYLES)) {
    const src = `const SP=${SP}, bars=${st.bars}, drop=${JSON.stringify(st.drop)}, V=${st.vol || 1}, noChant=${!!st.noChant}; const piOf=${st.pi.toString()};
      for (let bar=0; bar<bars; bar++) { const pi=piOf(bar); for (let s=0;s<16;s++) { const t=(bar*16+s)*SP+0.02;
        if (pi<0) { /* night: heartbeat kick, sparse hat, sub stab every 2 bars */ if (s===0||s===3) I.kick(t, s?0.55:0.9); if (s===10&&bar%2===1) I.hat(t,0.5,true); if (s===0&&bar%2===0) I.stab(t,55,0.7); if (s===8&&bar%4===3) I.stab(t,58.3,0.5); continue; }
        if (KICK[s] || (pi>=1 && (s===3||s===11) && bar%2) || (pi===2 && s===14 && bar%4===3)) I.kick(t, (KICK[s]?1:0.6)*V);
        if (SNARE[s] && (s!==15 || bar%2)) I.snare(t, (s===15?0.5:1)*V);
        if (HAT[s]) I.hat(t, 0.9*V, s===14 && bar%2===1); else if (pi===2 && s%2===1) I.hat(t, 0.35*V);
        if (pi>=1) for (const [st2,hz] of BASS) if (st2===s) I.stab(t, hz*(bar%4===3&&s>=10?1.122:1), 0.9*V);
        if (!noChant && pi===2 && (s===4||s===12) && bar%2===0) I.chant(t, s===4?'HEY':'HO', 0.9);
        if (drop.includes(bar) && s%4===0) I.stab(t, 55, 1.1); } }`;
    await render(name, src, st.bars * 16 * SP + 1.5);
  }
  // one-shots (the game's own tail hit: kick + 110 Hz stab + 'HO', plus Vic's drop sub stab); scare = Vic's scratch + zap + 'HEY'
  await render('hit', `I.kick(0.02,1.1); I.stab(0.02,110,1); I.stab(0.02,55,1.1); I.chant(0.02,'HO',0.9); I.hat(0.02,0.8,true); I.kick(0.48,0.5); I.stab(0.48,55,0.6);`, 2.5);
  await render('scare', `I.zap(0.02); I.scratch(0.02,0.7); I.stab(0.02,55,1.2); I.chant(0.05,'HEY',0.8); I.stab(0.5,58.3,0.8);`, 2.0);
  await render('whoosh', `I.scratch(0.02,0.45);`, 0.8);
  await render('endcard', `I.stab(0.02,110,0.7); I.stab(0.02,220,0.5); I.blip(0.02,1320,0.18,'sine',0.05); I.blip(0.25,1760,0.18,'sine',0.08);`, 1.6);
  await b.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
