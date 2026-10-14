const fs=require('fs');
const src=fs.readFileSync('/workspace/work/toad-city/game/src/08_radio.js','utf8');
const a=src.indexOf('const BYND'), b=src.indexOf('const shuffle');
const body=src.slice(a,b)+'; return {T, REMIX_PEAK, POOL, TRACKS};';
const {T,REMIX_PEAK,POOL,TRACKS}=new Function('Q',body)({get:()=>null});
const who=(t)=>(t.artist?t.artist:'')+(t.prod?(t.artist?' · ':'')+'prod. '+t.prod:'');
const credit=(t)=>`"${t.title}"${t.tag?` (${t.tag})`:''} · ${who(t)}${t.lic?` · ${t.lic}`:''}`;
const key=Object.fromEntries(Object.entries(T).map(([k,v])=>[v.id,k]));
const tracks=POOL.map((t,i)=>{const pk=REMIX_PEAK[t.id];return {n:i+1,key:key[t.id],youtube_id:t.id,youtube_url:t.yt,title:t.title,artist:t.artist,credit:credit(t),
 dial_station:TRACKS.club.includes(t)?'B-MORE CLUB':'B-MORE RAP',
 peak_start_s:pk!=null?pk:45,peak_source:pk!=null?'heatmap (REMIX_PEAK)':'fallback'};});
const out={station:'B-MORE 410 REMIX',station_id_prefix:'B-MORE 410 RADIO',source:'game/src/08_radio.js (copied to radio_ref.js)',
 default_station:true,order:'shuffled, no repeats until all 30 have played',
 clip_length_s:20, crossfade_s:3, crossfade_rule:'XF = min(3, CLIP/4); equal-power (cos out / sin in) with a 0.5x playbackRate tape-drag on the outgoing clip; next clip preloaded muted on a second hidden player',
 skip_crossfade_s:0.8, ios_mode:'one player, hard cut with a fast seek (iOS ignores setVolume)',
 peak_note:'REMIX_PEAK is null for all 30 tracks (YouTube Most Replayed heatmap fetch hit HTTP 429 at build time). Code fallback: start at 45 s until the duration is known, then fbStart(dur) = max(0, min(max(30, dur*0.35), dur - 20 - 5)), i.e. 35% into the track, at least 30 s in, at most length - 25 s. peak_start_s below is the pre-duration value 45.',
 fallback_formula:'max(0, min(max(30, duration*0.35), duration - 25))',
 audio_note:'Played through the official YouTube IFrame player (hidden, audio-only); no audio downloaded or shipped.',
 tracks};
fs.writeFileSync('/workspace/work/toad-city/home_assets/remix.json',JSON.stringify(out,null,1));
console.log(tracks.length, tracks[0], tracks[29]);
