// input.js — touch-first: floating joystick on the left half, round action button bottom-right,
// and a smaller A button beside it (PUNCH on foot, TURBO or the job action in a car — see
// controls.js). Keyboard for desktop: arrows/WASD move, Space/E/Enter = action, F/X/J = A (hold for turbo).

export class Input {
  constructor(canvas, view) {
    this.canvas = canvas;
    this.view = view;               // { w, h } in view units, updated on resize
    this.stick = null;              // { id, bx, by, kx, ky }
    this.btnId = null;
    this.actionEdge = false;
    this.btnDown = false;
    this.fightId = null; this.fightDown = false; this.punchEdge = false;
    this.fightOn = true;            // main.js turns the fight button off when the player isn't on foot
    this.keys = {};
    this.R = 56;
    this.helpOpen = false; this.panelTap = null;        // HELP: main.js sets panelTap while a panel is up (it then owns every touch)
    this.mapOpen = false; this.safeTop = 0;   // the MAP toggle, top-right under the stars (main.js keeps safeTop fresh)
    this.onFirst = null;
    const opts = { passive: false };
    canvas.addEventListener('pointerdown', e => this.down(e), opts);
    canvas.addEventListener('pointermove', e => this.move(e), opts);
    canvas.addEventListener('pointerup', e => this.up(e), opts);
    canvas.addEventListener('pointercancel', e => this.up(e), opts);
    for (const ev of ['touchstart', 'touchmove', 'gesturestart']) document.addEventListener(ev, e => e.preventDefault(), opts);
    const map = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    addEventListener('keydown', e => {
      this.first();
      if (map[e.code]) { this.keys[map[e.code]] = true; e.preventDefault(); }
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') { this.actKey = true; if (!e.repeat) { this.actionEdge = true; e.preventDefault(); } }
      if (e.code === 'KeyM' && !e.repeat) this.mapOpen = !this.mapOpen;
      if ((e.code === 'KeyH' || e.code === 'Slash') && !e.repeat) this.helpOpen = !this.helpOpen;
      if (e.code === 'Escape') this.helpOpen = false;
      if (this.panelKey && this.panelKey(e.code)) { e.preventDefault(); return; }
      if (e.code === 'KeyF' || e.code === 'KeyX' || e.code === 'KeyJ') { if (!e.repeat) this.punchEdge = true; this.fightKey = true; e.preventDefault(); }
    });
    addEventListener('keyup', e => { if (map[e.code]) this.keys[map[e.code]] = false; if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') this.actKey = false; if (e.code === 'KeyF' || e.code === 'KeyX' || e.code === 'KeyJ') this.fightKey = false; });
  }

  first() { if (this.onFirst) { const f = this.onFirst; this.onFirst = null; f(); } }

  button() { return { x: this.view.w - 72, y: this.view.h - 120, r: 44 }; }
  fight() { return { x: this.view.w - 164, y: this.view.h - 82, r: 34 }; }
  helpBtn() { return { x: 12, y: this.safeTop + 62, w: 34, h: 28 }; }                 // top-left, under the clock
  mapBtn() { return { x: this.view.w - 70, y: this.safeTop + 62, w: 58, h: 28 }; }   // clear of the stick (left half) and the buttons (bottom)

  toView(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * this.view.w / r.width, y: (e.clientY - r.top) * this.view.h / r.height };
  }

  down(e) {
    e.preventDefault();
    this.first();
    const p = this.toView(e);
    if (this.panelTap) { this.panelTap(p); return; }       // a panel is up: it gets the touch, the game gets nothing
    const b = this.button(), f = this.fight(), m = this.mapBtn(), q = this.helpBtn();
    if (p.x > q.x - 8 && p.x < q.x + q.w + 8 && p.y > q.y - 8 && p.y < q.y + q.h + 8) { this.helpOpen = true; return; }
    if (p.x > m.x - 6 && p.x < m.x + m.w + 6 && p.y > m.y - 6 && p.y < m.y + m.h + 6) { this.mapOpen = !this.mapOpen; return; }
    if (this.fightOn && Math.hypot(p.x - f.x, p.y - f.y) < f.r + 6 && this.fightId === null) {
      this.fightId = e.pointerId; this.fightDown = true; this.punchEdge = true;
      return;
    }
    if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 14 && this.btnId === null) {
      this.btnId = e.pointerId; this.btnDown = true; this.actionEdge = true;
      return;
    }
    if (p.x < this.view.w / 2 && !this.stick) {
      this.stick = { id: e.pointerId, bx: p.x, by: p.y, kx: p.x, ky: p.y };
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
  }

  move(e) {
    if (!this.stick || e.pointerId !== this.stick.id) return;
    e.preventDefault();
    const p = this.toView(e);
    let dx = p.x - this.stick.bx, dy = p.y - this.stick.by;
    const l = Math.hypot(dx, dy);
    if (l > this.R) {  // drag the base along so the stick never "runs out"
      this.stick.bx += dx - dx / l * this.R; this.stick.by += dy - dy / l * this.R;
      dx = dx / l * this.R; dy = dy / l * this.R;
    }
    this.stick.kx = this.stick.bx + dx; this.stick.ky = this.stick.by + dy;
  }

  up(e) {
    if (this.stick && e.pointerId === this.stick.id) this.stick = null;
    if (e.pointerId === this.btnId) { this.btnId = null; this.btnDown = false; }
    if (e.pointerId === this.fightId) { this.fightId = null; this.fightDown = false; }
  }

  read() {
    let jx = 0, jy = 0, jm = 0;
    if (this.stick) {
      const dx = this.stick.kx - this.stick.bx, dy = this.stick.ky - this.stick.by, l = Math.hypot(dx, dy);
      jm = Math.min(1, l / this.R);
      if (l > 0.01) { jx = dx / l; jy = dy / l; }
    }
    const a = this.actionEdge, f = this.punchEdge;
    this.actionEdge = false; this.punchEdge = false;
    return { jx, jy, jm, action: a, punch: f, turbo: this.fightDown || !!this.fightKey, btn: this.btnDown || !!this.actKey, keys: this.keys };   // turbo = A held; btn = the big button held (the seaplane's throttle-down)
  }
}
