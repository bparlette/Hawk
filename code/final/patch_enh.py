import sys
p=sys.argv[1]; s=open(p).read()
if "(final v1)" in s: print("already"); sys.exit()
R=[
# store previous per-level best for the summary deltas
("    RUN.prevLv = prev || 0; RUN.newLv = !prev || RUN.lvT < prev;\n",
 "    RUN.prevLv = prev || 0; RUN.newLv = !prev || RUN.lvT < prev;\n    (RUN.prevs = RUN.prevs || {})[n] = prev || 0; // final v1: summary +/- vs the best before this run\n"),
# helpers after fmtT
("  function runStart(mode, from) {",
 "  // (final v1) Boss Rush counts every boss fight (L15 = Shredder + Super Shredder = 16); deltas vs best\n"
 "  const rushN = () => PROG_N + 1; // fn: PROG_N is declared further down\n"
 "  const rushDone = () => (RUN.from - 1) + RUN.bosses + (!RUN.lvDone && (STATE.level || 1) === PROG_N && STATE.section === \"L\" ? Math.max(0, STATE.sec | 0) : 0) + (RUN.lvDone && (STATE.level || 1) === PROG_N ? 1 : 0);\n"
 "  const fmtD = (d) => (d <= 0 ? \"-\" : \"+\") + (Math.abs(d) >= 3600 ? fmtT(Math.abs(d)) : (Math.abs(d) / 60).toFixed(2));\n"
 "  function runStart(mode, from) {"),
# HUD label + pips
('    const lab = RUN.mode === "rush" ? "BOSS " + Math.min(PROG_N, RUN.bosses + 1) + "/" + PROG_N : "SCENE " + (STATE.level || 1) + "/" + PROG_N;',
 '    const lab = RUN.mode === "rush" ? "BOSS " + Math.min(rushN(), rushDone() + (RUN.lvDone ? 0 : 1)) + "/" + rushN() : "SCENE " + (STATE.level || 1) + "/" + PROG_N; // final v1'),
('    if (RUN.mode === "rush") for (let i = 0; i < PROG_N; i++) rect(X - 45 + i * 6, y + 15, 5, 2, i < RUN.bosses ? M.c : "#3a2a48"); // progress pips',
 '    if (RUN.mode === "rush") { const k = rushDone(); for (let i = 0; i < rushN(); i++) rect(X - 45 + Math.round(i * 5.75), y + 15, 4, 2, i < k ? M.c : i < RUN.from - 1 ? "#24182e" : "#3a2a48"); } // progress pips (final v1: 16)'),
# banner count
('    ptext((RUN.mode === "rush" ? "BOSS DOWN!  " : "SCENE " + n + " CLEAR!  ") + RUN.bosses + "/" + PROG_N, W / 2, 90, 2, M.c);',
 '    ptext((RUN.mode === "rush" ? "BOSS DOWN!  " + rushDone() + "/" + rushN() : "SCENE " + n + " CLEAR!  " + RUN.bosses + "/" + PROG_N), W / 2, 90, 2, M.c); // final v1'),
# modeEnd total delta
('    ptext(R.newTotal ? "NEW BEST TOTAL!" : B.total ? "BEST TOTAL " + fmtT(B.total) : R.full ? "" : "START FROM SCENE 1 FOR A TOTAL BEST", W / 2, 56, 1, R.newTotal && Math.floor(STATE.t / 8) % 2 ? "#ffe060" : "#ffd27a");',
 '    ptext(R.newTotal ? "NEW BEST TOTAL!" + (R.prevTotal ? "  " + fmtD(R.t - R.prevTotal) + " VS OLD BEST" : "") : B.total ? "BEST TOTAL " + fmtT(B.total) + (R.full ? "  " + fmtD(R.t - B.total) : "") : R.full ? "" : "START FROM SCENE 1 FOR A TOTAL BEST", W / 2, 56, 1, R.newTotal && Math.floor(STATE.t / 8) % 2 ? "#ffe060" : "#ffd27a"); // final v1: total delta'),
# modeEnd rows: name 9 chars + delta column
('      ptext((LV_NAMES[n] || "").slice(0, 13), x + 19, y, 1, "#c8b8e0", "left");\n      ptext(fmtT(f), x + W / 2 - 26, y, 1, best && f <= best ? "#7fd85a" : "#fff", "right");',
 '      const pv = (R.prevs || {})[n] || 0; // final v1: split vs the best before this run\n'
 '      ptext((LV_NAMES[n] || "").slice(0, pv ? 9 : 13), x + 19, y, 1, "#c8b8e0", "left");\n'
 '      if (pv) ptext(fmtD(f - pv), x + 118, y, 1, f <= pv ? "#7fd85a" : "#ff8a7a", "right");\n'
 '      ptext(fmtT(f), x + W / 2 - 26, y, 1, !pv || f <= pv ? "#7fd85a" : "#fff", "right");'),
]
for a,b in R:
    c=s.count(a); assert c==1,(c,a[:70]); s=s.replace(a,b)
open(p,'w').write(s); print("ok",len(R))
