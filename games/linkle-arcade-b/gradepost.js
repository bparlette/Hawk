// GradePost — Attempt B's finish: ONE light pass, no Kuwahara, no bloom chain,
// no per-frame repaint. The scene renders once into an MSAA target and the
// quad applies the warm anime grade: ACES filmic, a saturation lift, cool
// shadows / warm highlights split, gamma, and a whisper of vignette. This is
// the hoshi post philosophy (print curve + grade) shrunk to phone budget.
export class GradePost {
  constructor(THREE, renderer) {
    this.THREE = THREE; this.r = renderer;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor;
        varying vec2 vUv;
        vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        void main() {
          vec3 c = texture2D(tColor, vUv).rgb * 1.05;
          c = aces(c);
          float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(lum), c, 1.16);
          c = mix(c * vec3(0.94, 0.99, 1.08), c * vec3(1.07, 1.00, 0.90), smoothstep(0.10, 0.80, lum));
          c = pow(c, vec3(1.0 / 2.2));
          vec2 q = vUv - 0.5;
          float vg = smoothstep(0.95, 0.35, length(q * vec2(1.0, 0.8)));
          c *= mix(0.88, 1.0, vg);
          gl_FragColor = vec4(c, 1.0);
        }`,
      uniforms: { tColor: { value: null } },
      depthTest: false, depthWrite: false,
    });
    this.quad.material = this.mat;
    this.rt = null;
  }
  setSize(w, h) {
    const T = this.THREE;
    if (this.rt) this.rt.dispose();
    this.rt = new T.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), {
      type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter,
      depthBuffer: true, samples: 4,
    });
  }
  render(scene, camera) {
    this.r.setRenderTarget(this.rt);
    this.r.render(scene, camera);
    this.mat.uniforms.tColor.value = this.rt.texture;
    this.r.setRenderTarget(null);
    this.r.render(this.qs, this.cam);
  }
}
