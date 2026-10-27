// Dig Flop × gamepress touch standard (gptouch.js): floating stick + round
// buttons, shown ONLY during the race — the dig phase needs raw canvas taps,
// so the controller is created/destroyed as the phase flips. Stick/buttons are
// translated into the game's existing keyboard events, so keyboard and touch
// share one input path (the TOUCH.md merge pattern).
import { TouchController, isTouchDevice } from './gptouch.js';

if (isTouchDevice()) {
  let TC = null;
  const held = {};
  function set(code, on) {
    if (!!held[code] === !!on) return;
    held[code] = !!on;
    window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code, key: code, bubbles: true, cancelable: true }));
  }
  function releaseAll() { Object.keys(held).forEach(c => set(c, false)); }
  function poll() {
    const racing = window.__phase === 'race' || window.__phase === 'countdown';
    if (racing && !TC) {
      TC = new TouchController({ buttons: [ { id: 'a', label: 'ACT', size: 84 }, { id: 'b', label: 'DIG', size: 66 } ], maxRadius: 56, deadzone: 0.18 });
    } else if (!racing && TC) {
      releaseAll(); TC.destroy(); TC = null;
    }
    if (TC && TC.enabled) {
      const ti = TC.getInput();
      set('ArrowLeft', ti.x < -0.35);
      set('ArrowRight', ti.x > 0.35);
      set('ArrowDown', ti.y > 0.55);
      set('Space', !!ti.a);
      set('KeyS', !!ti.b);
    }
    requestAnimationFrame(poll);
  }
  requestAnimationFrame(poll);
  window.__pad = () => !!TC;
}
