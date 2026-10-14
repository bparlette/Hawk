/* Daily Pack Verdict: result filter + running profit/loss chart (SVG, no libraries). */
(() => {
  "use strict";
  const table = document.getElementById("vtable");
  if (!table) return;
  const rows = [...table.tBodies[0].rows];
  const sel = document.getElementById("vfilter");
  if (sel) sel.addEventListener("change", () => rows.forEach((r) => (r.hidden = !!sel.value && r.dataset.result !== sel.value)));

  const box = document.getElementById("vchart");
  if (!box) return;
  const pts = rows.map((r) => ({ day: +r.dataset.day, cost: parseFloat(r.dataset.cost), value: parseFloat(r.dataset.value) }))
    .filter((p) => Number.isFinite(p.cost) && Number.isFinite(p.value)).sort((a, b) => a.day - b.day);
  if (pts.length < 2) { box.textContent = box.dataset.empty; return; }
  let run = 0; const series = pts.map((p) => ({ day: p.day, v: (run += p.value - p.cost) }));
  const W = 800, H = 280, P = 44, xs = series.map((s) => s.day);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), lo = Math.min(0, ...series.map((s) => s.v)), hi = Math.max(0, ...series.map((s) => s.v));
  const X = (d) => P + ((d - x0) / (x1 - x0 || 1)) * (W - P * 2), Y = (v) => H - P - ((v - lo) / (hi - lo || 1)) * (H - P * 2);
  const path = series.map((s, i) => `${i ? "L" : "M"}${X(s.day).toFixed(1)},${Y(s.v).toFixed(1)}`).join(" ");
  const last = series[series.length - 1];
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Running profit and loss across ${pts.length} days, currently ${last.v >= 0 ? "up" : "down"} $${Math.abs(last.v).toFixed(2)}">
    <line x1="${P}" x2="${W - P}" y1="${Y(0)}" y2="${Y(0)}" stroke="#999" stroke-dasharray="4 4"/>
    <path d="${path}" fill="none" stroke="${last.v >= 0 ? "#2f7d32" : "#b3361f"}" stroke-width="4" stroke-linejoin="round"/>
    ${series.map((s) => `<circle cx="${X(s.day)}" cy="${Y(s.v)}" r="5" fill="#0e0f0a"><title>Day ${s.day}: ${s.v >= 0 ? "+" : "-"}$${Math.abs(s.v).toFixed(2)}</title></circle>`).join("")}
    <text x="${P}" y="${H - 12}" font-size="14" fill="#555">Day ${x0}</text><text x="${W - P}" y="${H - 12}" font-size="14" fill="#555" text-anchor="end">Day ${x1}</text>
    <text x="${W - P}" y="${Y(last.v) + (last.v >= 0 ? -16 : 34)}" font-size="18" font-weight="800" text-anchor="end" fill="#0e0f0a">${last.v >= 0 ? "+" : "-"}$${Math.abs(last.v).toFixed(2)}</text></svg>`;
})();
