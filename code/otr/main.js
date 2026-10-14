/* Off The Rip: tiny, dependency-free site script. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* analytics hook (Plausible custom events if switched on; harmless otherwise) */
  const track = (name, props) => { try { window.plausible && window.plausible(name, { props }); } catch (_) {} };
  window.otrTrack = track;

  /* mobile nav */
  const tog = $(".navtoggle"), nav = $("#nav");
  if (tog && nav) tog.addEventListener("click", () => { const o = nav.classList.toggle("is-open"); tog.setAttribute("aria-expanded", o); });

  /* remember where a visitor came from: utm_* / src travel with every form post */
  const KEYS = ["utm_source", "utm_medium", "utm_campaign", "src"];
  try {
    const q = new URLSearchParams(location.search);
    KEYS.forEach((k) => q.get(k) && sessionStorage.setItem("otr_" + k, q.get(k).slice(0, 80)));
  } catch (_) {}
  const attribution = () => Object.fromEntries(KEYS.map((k) => [k, (() => { try { return sessionStorage.getItem("otr_" + k) || ""; } catch (_) { return ""; } })()]));

  /* eBay / YouTube click tracking */
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    if (/ebay\.com/.test(a.hostname)) track("eBay Click", { page: location.pathname });
    else if (/youtube\.com|youtu\.be/.test(a.hostname)) track("YouTube Click", { page: location.pathname });
  });

  /* promo countdown */
  const promo = $(".promo[data-ends]");
  if (promo && promo.dataset.ends) {
    const end = Date.parse(promo.dataset.ends), t = $(".promo__t", promo);
    const tick = () => {
      const s = Math.floor((end - Date.now()) / 1000);
      if (s <= 0) { promo.remove(); return; }
      const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
      t.textContent = `· ends in ${d ? d + "d " : ""}${h}h ${m}m`;
      setTimeout(tick, 30000);
    };
    if (!Number.isNaN(end)) tick();
  }

  /* forms: POST JSON to /api/<type> (Cloudflare Pages Function) */
  const loadedAt = Date.now();
  let turnstileLoaded = false;
  const loadTurnstile = () => { if (turnstileLoaded) return; turnstileLoaded = true; const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"; s.async = true; document.head.appendChild(s); };
  $$("form[data-form]").forEach((form) => {
    const status = $(".form__status", form);
    const say = (msg, cls) => { status.textContent = msg; status.className = "form__status " + (cls || ""); };
    if ($(".cf-turnstile", form)) form.addEventListener("focusin", loadTurnstile, { once: true });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const fd = new FormData(form);
      const body = { type: form.dataset.form, elapsedMs: Date.now() - loadedAt, ...attribution() };
      for (const [k, v] of fd.entries()) {
        if (k === "interests") (body.interests = body.interests || []).push(v);
        else if (k !== "consent") body[k] = v;
      }
      body.consent = !!fd.get("consent");
      form.classList.add("is-busy"); say("Sending…");
      try {
        const r = await fetch(`/api/${form.dataset.form}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again.");
        say(form.dataset.form === "wantlist" ? "Got it! Clayton will email you if something matches." : "You're on the list! Check your inbox to confirm.", "ok");
        track(form.dataset.form === "wantlist" ? "Want List" : "Newsletter Signup", { page: location.pathname });
        form.reset();
      } catch (err) { say(err.message, "err"); }
      finally { form.classList.remove("is-busy"); }
    });
  });
  /* video hover previews: muted autoplay on devices with hover */
  try {
    if (window.matchMedia("(hover: hover)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const buildFrame = (id) => {
        const f = document.createElement("iframe");
        f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&mute=1&controls=0&loop=1&playlist=" + encodeURIComponent(id) + "&rel=0&playsinline=1";
        f.title = "Video preview";
        f.setAttribute("aria-hidden", "true");
        f.tabIndex = -1;
        return f;
      };
      document.addEventListener("mouseover", (e) => {
        const thumb = e.target.closest && e.target.closest(".vcard__thumb[data-video-id]");
        if (!thumb || thumb.dataset.previewing) return;
        thumb.dataset.previewing = "1";
        const card = thumb.closest(".vcard");
        if (card) card.classList.add("is-previewing");
        thumb.appendChild(buildFrame(thumb.dataset.videoId));
      });
      document.addEventListener("mouseout", (e) => {
        const thumb = e.target.closest && e.target.closest(".vcard__thumb[data-video-id]");
        if (!thumb || !thumb.dataset.previewing) return;
        if (thumb.contains(e.relatedTarget)) return;
        delete thumb.dataset.previewing;
        const card = thumb.closest(".vcard");
        if (card) card.classList.remove("is-previewing");
        const f = thumb.querySelector("iframe");
        if (f) f.remove();
      });
    }
  } catch (_) {}
  /* tap-to-play inline: first tap plays the video here (Ashley pattern);
     title taps still go to YouTube. Hover keeps the muted preview on desktop. */
  document.addEventListener("click", (e) => {
    const thumb = e.target.closest && e.target.closest(".vcard__thumb[data-video-id]");
    if (!thumb || thumb.dataset.playing) return;
    e.preventDefault();
    thumb.dataset.playing = "1";
    delete thumb.dataset.previewing;
    const card = thumb.closest(".vcard");
    if (card) card.classList.add("is-previewing");
    const id = thumb.dataset.videoId;
    const f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0&playsinline=1";
    f.title = "Video player";
    f.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
    f.setAttribute("allowfullscreen", "");
    thumb.innerHTML = "";
    thumb.appendChild(f);
    try { track("Video Inline Play", { page: location.pathname }); } catch (_) {}
  });
})();
