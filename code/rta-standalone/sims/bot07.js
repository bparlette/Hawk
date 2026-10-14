module.exports = function (G, k, p, mem, run) {
  const skill = [1, 0.8, 0.6][run % 3];
  const d = G.ducks[0];
  if (!d || d.dead || d.away || G.state !== "fly") return;
  const tx = d.x + d.vx * 6, ty = d.y + d.vy * 6;
  const dx = tx - G.cx, dy = ty - G.cy;
  const err = (mem.e = mem.e || 0);
  if (dx > 2) k.right = true; else if (dx < -2) k.left = true;
  if (dy > 2) k.down = true; else if (dy < -2) k.up = true;
  mem.t = (mem.t || 0) + 1;
  if (Math.abs(G.cx - d.x) < 10 && Math.abs(G.cy - d.y) < 9 && G.ammo > 0 && G.cool === 0 && Math.random() < skill * 0.5) p.a = true;
};
