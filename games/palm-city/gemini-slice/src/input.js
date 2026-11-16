// input.js — touch-first: floating joystick on the left half, one round action button bottom-right.
// Keyboard (arrows/WASD + Space/E) for desktop testing.

export class Input {
  constructor(canvas, view) {
    this.canvas = canvas;
    this.view = view;               // { w, h } in view units, updated on resize
    this.stick = null;              // { id, bx, by, kx, ky }
    this.btnId = null;
    this.actionEdge = false;
    this.btnDown = false;
    this.keys = {};
    this.R = 56;
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
      if ((e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') && !e.repeat) { this.actionEdge = true; e.preventDefault(); }
    });
    addEventListener('keyup', e => { if (map[e.code]) this.keys[map[e.code]] = false; });
  }

  first() { if (this.onFirst) { const f = this.onFirst; this.onFirst = null; f(); } }

  button() { return { x: this.view.w - 72, y: this.view.h - 120, r: 44 }; }

  toView(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * this.view.w / r.width, y: (e.clientY - r.top) * this.view.h / r.height };
  }

  down(e) {
    e.preventDefault();
    this.first();
    const p = this.toView(e);
    const b = this.button();
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
  }

  read() {
    let jx = 0, jy = 0, jm = 0;
    if (this.stick) {
      const dx = this.stick.kx - this.stick.bx, dy = this.stick.ky - this.stick.by, l = Math.hypot(dx, dy);
      jm = Math.min(1, l / this.R);
      if (l > 0.01) { jx = dx / l; jy = dy / l; }
    }
    const a = this.actionEdge;
    this.actionEdge = false;
    return { jx, jy, jm, action: a, keys: this.keys };
  }
}
