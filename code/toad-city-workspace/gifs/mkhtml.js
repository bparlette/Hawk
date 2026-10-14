// mkhtml.js <home/index.html> : insert (or replace) the home-page Gallery section from out/index.json.
// Idempotent: everything between <!-- GALLERY:START --> and <!-- GALLERY:END --> is regenerated; the first time it is
// inserted just before the "coming" section (or before </main> as a fallback). Own class prefix x-gal* and id "gallery",
// so it never collides with the Shorts builder's "Clips" section.
// Media live in home/gallery/: <name>.mp4 (plays in the grid, loaded only when near the viewport), <name>.jpg (poster,
// loading=lazy), <name>.gif (the looping GIF, linked from each card).
const fs = require('fs'), path = require('path');
const file = process.argv[2]; if (!file) { console.error('usage: node mkhtml.js <home/index.html>'); process.exit(2); }
const idx = JSON.parse(fs.readFileSync(path.join(__dirname, 'out/index.json'), 'utf8'));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mb = (b) => (b / 1048576).toFixed(1) + ' MB';
const title = (s) => s.toLowerCase().replace(/(^|[\s/(&-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bM&t\b/g, 'M&T').replace(/\bAi\b/g, 'AI').replace(/\bWtc\b/g, 'WTC').replace(/\bUss\b/g, 'USS').replace(/\bDr\./g, 'Dr.').replace(/\bB-More\b/g, 'B-MORE').replace(/\bQte\b/g, 'QTE');
const GROUPS = [
  ['Landmarks', 'The tour', 'Fly the whole Inner Harbor'],
  ['Bosses', 'The roster', 'Every boss, mid-fight'],
  ['Fighters', 'The crews', 'Harold, Mavis and the gangs'],
  ['Special Moves', 'Signature hits', 'Specials and tag-team finishers'],
  ['Features', 'Only in Toad City', 'The stuff that makes it Baltimore'],
];
let cards = '';
// Featured: the Ending video (publish.sh -> gallery/ending/, listed in out/ending.json). Plays with sound on click only.
let ending = null; try { ending = JSON.parse(fs.readFileSync(path.join(__dirname, 'out/ending.json'), 'utf8')); } catch (e) {}
if (ending) {
  const t = `${Math.floor(ending.secs / 60)}:${String(ending.secs % 60).padStart(2, '0')}`;
  cards += `
          <h3 class="x-h3 x-gal__group">The Ending <span class="x-badge x-badge--green">Featured</span></h3>
          <figure class="x-ink x-gal__card x-gal__feat">
            <div class="x-gal__media x-gal__media--tall x-gal__feat-media"><video controls playsinline preload="none" poster="gallery/ending/${ending.name}.jpg" src="gallery/ending/${ending.name}.mp4" aria-label="Toad City: the ending, with sound"></video></div>
            <figcaption class="x-ink__body"><h4>${esc(ending.title)}</h4><p class="sub">Beat the Brewmaster and see how Toad City's story wraps up. Spoilers, with sound · ${t}</p><a class="x-gal__gif" href="gallery/ending/${ending.name}.mp4" target="_blank" rel="noopener">Open full screen · ${mb(ending.bytes)}</a></figcaption>
          </figure>`;
}
// Shorts (vertical, from shorts/batch1/final via publish.sh -> gallery/shorts/), listed in out/shorts.json
let shorts = []; try { shorts = JSON.parse(fs.readFileSync(path.join(__dirname, 'out/shorts.json'), 'utf8')); } catch (e) {}
if (shorts.length) {
  cards += `\n          <h3 class="x-h3 x-gal__group">The Shorts <span class="x-badge x-badge--cream">${shorts.length} vertical cuts</span></h3>\n          <div class="x-gal__grid x-gal__grid--tall">`;
  for (const s of shorts) cards += `
            <figure class="x-ink x-gal__card">
              <div class="x-gal__media x-gal__media--tall"><video class="x-gal__vid" muted loop playsinline preload="none" poster="gallery/shorts/${s.name}.jpg" data-src="gallery/shorts/${s.name}.mp4" aria-label="${esc(s.title)}: vertical Short"></video></div>
              <figcaption class="x-ink__body"><h4>${esc(s.title)}</h4><a class="x-gal__gif" href="gallery/shorts/${s.name}.mp4" target="_blank" rel="noopener">Watch with sound · ${mb(s.bytes)}</a></figcaption>
            </figure>`;
  cards += `\n          </div>`;
}
for (const [g, eyebrow, h] of GROUPS) {
  const items = idx.filter((i) => i.group === g); if (!items.length) continue;
  const wide = g === 'Landmarks' || g === 'Bosses';
  cards += `\n          <h3 class="x-h3 x-gal__group">${esc(h)} <span class="x-badge x-badge--cream">${items.length === 1 ? eyebrow : items.length + ' loops'}</span></h3>\n          <div class="x-gal__grid${wide ? ' x-gal__grid--wide' : ''}">`;
  for (const it of items) {
    const name = wide ? it.title : title(it.title);
    const sub = wide ? `${it.segs.length} ${g === 'Landmarks' ? 'landmarks' : 'bosses'}, back to back` : title(it.sub || '');
    cards += `
            <figure class="x-ink x-gal__card">
              <div class="x-gal__media"><video class="x-gal__vid" muted loop playsinline preload="none" poster="gallery/${it.name}.jpg" data-src="gallery/${it.name}.mp4" aria-label="${esc(name)}: looping gameplay clip"></video>
                <noscript><img src="gallery/${it.name}.gif" alt="${esc(name)}: looping gameplay GIF" loading="lazy" /></noscript></div>
              <figcaption class="x-ink__body"><h4>${esc(name)}</h4>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}<a class="x-gal__gif" href="gallery/${it.name}.gif" target="_blank" rel="noopener">GIF · ${mb(it.gif)}</a></figcaption>
            </figure>`;
  }
  cards += `\n          </div>`;
}
const total = idx.length;
const block = `<!-- GALLERY:START (generated by gifs/mkhtml.js; re-run gifs/recapture.sh, do not hand-edit) -->
        <style>
          .x-gal__group { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 28px 0 14px; }
          .x-gal__grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); }
          .x-gal__grid--wide { grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); }
          .x-gal__grid--tall { grid-template-columns: repeat(auto-fill, minmax(min(46%, 200px), 1fr)); }
          .x-gal__media--tall { aspect-ratio: 9 / 16; }
          .x-gal__card { margin: 0; }
          .x-gal__feat { display: grid; grid-template-columns: minmax(0, 300px) 1fr; align-items: center; }
          .x-gal__feat .x-gal__feat-media { aspect-ratio: 9 / 16; border-bottom: 0; border-right: 3px solid var(--x-line); }
          .x-gal__feat-media video { object-fit: contain; background: #000; } .x-gal__feat .x-ink__body { padding: 24px 32px; } .x-gal__feat h4 { font-size: clamp(28px, 5vw, 44px); }
          @media (max-width: 640px) { .x-gal__feat { grid-template-columns: 1fr; } .x-gal__feat .x-gal__feat-media { border-right: 0; border-bottom: 3px solid var(--x-line); } }
          .x-gal__media { aspect-ratio: 16 / 9; background: var(--x-ink); border-bottom: 3px solid var(--x-line); }
          .x-gal__media video, .x-gal__media img { display: block; width: 100%; height: 100%; object-fit: cover; }
          .x-gal__card .x-ink__body { padding: 12px 16px 16px; gap: 4px; }
          .x-gal__card h4 { font-family: var(--x-display); font-weight: 400; font-size: clamp(22px, 4vw, 26px); letter-spacing: 0.04em; line-height: 1; margin: 0; }
          .x-gal__gif { justify-self: start; margin-top: 6px; font: var(--type-small); color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
        </style>
        <section class="section" id="gallery" data-nav="Gallery">
          <div class="head">
            <p class="head__eyebrow">Gallery · captured in-engine</p>
            <h2 class="x-h2">See it move</h2>
            <p class="head__sub">${ending ? 'The ending, ' : ''}${shorts.length ? shorts.length + ' Shorts and ' : ''}${total} looping clips straight from the current build: every landmark, every boss, the crews, the specials and the features.</p>
          </div>${cards}
        </section>
        <script>
          /* Gallery: load each clip only when it nears the viewport, play while visible, pause when not. */
          (function () {
            var vids = [].slice.call(document.querySelectorAll(".x-gal__vid"));
            if (!("IntersectionObserver" in window)) { vids.forEach(function (v) { v.src = v.dataset.src; v.autoplay = true; }); return; }
            var io = new IntersectionObserver(function (es) {
              es.forEach(function (e) { var v = e.target;
                if (e.isIntersecting) { if (!v.src) { v.src = v.dataset.src; } var p = v.play(); if (p && p.catch) p.catch(function () {}); }
                else if (v.src) v.pause(); });
            }, { rootMargin: "200px 0px" });
            vids.forEach(function (v) { io.observe(v); });
          })();
        </script>
        <!-- GALLERY:END -->`;
let html = fs.readFileSync(file, 'utf8');
const re = /<!-- GALLERY:START[\s\S]*?<!-- GALLERY:END -->/;
if (re.test(html)) html = html.replace(re, block);
else {
  const anchor = html.indexOf('<section class="section" id="coming"');
  const at = anchor >= 0 ? anchor : html.indexOf('</main>');
  if (at < 0) { console.error('no anchor for the gallery'); process.exit(1); }
  html = html.slice(0, at) + block + '\n\n        ' + html.slice(at);
}
fs.writeFileSync(file, html);
console.log('gallery section:', total, 'items ->', file);
