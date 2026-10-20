// enhance.js — Toad Street 32 character upgrades (gamepress techniques).
// Applies to rigs built by the game's buildHero()/buildThug() — same characters,
// better: ink outlines visible in the 32-bit look, warm rim-glow shells
// (rim-light feel), and a springy hit-juice system (punch scale-pop,
// squash-and-stretch, hit flash). Chunky PS1 style is preserved throughout.
//
// Usage:
//   import * as THREE from './three.module.min.js';
//   import { enhanceRig, makeJuice, rimOutlineMat } from './enhance.js';
//   const J = buildHero();            // or buildThug(THUG_LOOKS[4])
//   enhanceRig(J);                    // outlines on + rim shells
//   const juice = makeJuice(J);       // per-frame: juice.update(dt); on hit: juice.hit()
import * as THREE from './three.module.min.js';

// Warm rim-glow hull: the same inverted-hull trick the game uses for ink
// outlines, pushed a little further out and tinted like caught sunlight.
// Rendered BackSide behind the ink hull, it reads as a light wrap / halo.
export function rimOutlineMat(width = 0.0075, color = '#ffd9a0') {
  return new THREE.ShaderMaterial({
    uniforms: { uW: { value: width }, uC: { value: new THREE.Color(color) } },
    vertexShader: `attribute vec3 odir; uniform float uW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.xyz += mat3(modelMatrix) * odir * uW * clamp(distance(wp.xyz, cameraPosition), 2.5, 36.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `uniform vec3 uC;
      void main() { gl_FragColor = vec4(uC, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });
}

// enhanceRig(J): turn the ink-outline hulls on (the game hides them outside HD).
// No rim glow — Cherie rejected the yellow highlight. Ink + juice only.
export function enhanceRig(J, opts = {}) {
  if (J.userData && J.userData.enhanced) return J;
  J.root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    const isHull =
      m.isShaderMaterial && m.side === THREE.BackSide &&
      m.uniforms && m.uniforms.uW !== undefined;
    if (isHull) o.visible = true; // ink outlines on, even in the 32-bit look
  });
  J.userData = J.userData || {};
  J.userData.enhanced = true;
  return J;
}

// makeJuice(J): springy hit reaction for a rig.
//   juice.hit(power) — call on impact
//   juice.update(dt) — call every frame (drives scale spring + flash decay)
// Requires the game's toonMat (userData.flash / userData.flashC).
export function makeJuice(J) {
  const base = J.root.scale.x || 1;
  const s = { x: 0, v: 0 }; // spring: damped oscillation -> juicy overshoot
  const api = {
    hit(power = 1) {
      s.x = 0; s.v = 7 * power;
      const mu = J.mat && J.mat.userData;
      if (mu && mu.flash) {
        mu.flash.value = 1;
        if (mu.flashC) mu.flashC.value.set('#ffffff');
      }
    },
    update(dt) {
      const k = 170, c = 11; // spring stiffness / damping
      s.v += (-k * s.x - c * s.v) * dt;
      s.x += s.v * dt;
      const pop = 1 + s.x * 0.11;
      const sy = pop > 0.2 ? 1 / Math.sqrt(Math.max(pop, 0.2)) : 1; // volume-ish squash & stretch
      J.root.scale.set(base * pop, base * sy, base * pop);
      const mu = J.mat && J.mat.userData;
      if (mu && mu.flash) mu.flash.value = Math.max(0, mu.flash.value - dt * 5);
    },
  };
  return api;
}
