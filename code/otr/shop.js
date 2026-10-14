/* Shop page: filter/sort the pre-rendered grid; ?preview=1 loads sample data for design work. */
(() => {
  "use strict";
  const grid = document.getElementById("grid");
  if (!grid) return;
  const filters = document.getElementById("filters");
  const q = document.getElementById("q"), cat = document.getElementById("cat"), sort = document.getElementById("sort");
  const money = (n) => (typeof n === "number" ? "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const wire = () => {
    const cards = [...grid.querySelectorAll(".lcard")];
    if (!cards.length) return;
    filters.hidden = false;
    const apply = () => {
      const term = q.value.trim().toLowerCase();
      let list = cards.filter((c) => (!term || c.dataset.title.includes(term)) && (!cat.value || c.dataset.cat === cat.value));
      if (sort.value) list = [...list].sort((a, b) => ((parseFloat(a.dataset.price) || 0) - (parseFloat(b.dataset.price) || 0)) * (sort.value === "lo" ? 1 : -1));
      cards.forEach((c) => (c.hidden = true));
      list.forEach((c) => { c.hidden = false; grid.appendChild(c); });
    };
    [q, cat, sort].forEach((el) => el.addEventListener("input", apply));
  };

  if (!+grid.dataset.count && new URLSearchParams(location.search).get("preview") === "1") {
    fetch("/data/listings.sample.json").then((r) => r.json()).then((d) => {
      grid.className = "grid";
      grid.innerHTML = d.items.map((i) => `<a class="lcard" data-cat="${esc(i.category)}" data-price="${i.price ?? ""}" data-title="${esc(i.title.toLowerCase())}" href="${esc(i.url)}" target="_blank" rel="noopener"><span class="lcard__img"></span><span class="lcard__title">${esc(i.title)}</span><span class="lcard__price">${money(i.price)}</span></a>`).join("");
      grid.insertAdjacentHTML("beforebegin", '<p class="fine">Preview data: not live inventory.</p>');
      wire();
    });
  } else wire();
})();
