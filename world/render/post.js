/* 渲染层：合成后期。一张半浮点离屏图（带深度）加一遍全屏着色器：深度雾 → ACES 曝光 → 调色（LUT 占位：按时段的色偏）→ 暗角 → 画风（Kuwahara，开关）→ 颗粒。
   不引 EffectComposer（design/studio/proposals/05 第七条、04 第四条）。0 档不走这里，直接 renderer.render。
   场景渲到离屏图时 three 不做色调映射与色彩空间转换（渲染目标不为空时它们被跳过），所以这两步在这里做。 */
import * as THREE from "three";

export class Composite {
  constructor(renderer) {
    this.renderer = renderer; this.rt = null;
    this.scene = new THREE.Scene(); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() },
        uNear: { value: 0.5 }, uFar: { value: 600 },
        uFogColor: { value: new THREE.Color("#e6dcc0") }, uFogDensity: { value: 0.0 }, uFogStart: { value: 0 },
        uGrade: { value: new THREE.Vector3(1, 1, 1) }, uVignette: { value: 0.25 }, uGrain: { value: 0.02 }, uPaint: { value: 0 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse, tDepth; uniform vec2 uTexel; uniform float uNear, uFar;
        uniform vec3 uFogColor; uniform float uFogDensity, uFogStart; uniform vec3 uGrade; uniform float uVignette, uGrain, uPaint;
        varying vec2 vUv;
        float linDepth(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
        vec3 kuwahara(){
          const int R = 3; vec3 m0=vec3(0.),m1=vec3(0.),m2=vec3(0.),m3=vec3(0.),s0=vec3(0.),s1=vec3(0.),s2=vec3(0.),s3=vec3(0.);
          for (int j = 0; j <= R; j++) for (int i = 0; i <= R; i++) { vec2 o = vec2(float(i), float(j)) * uTexel;
            vec3 a = texture2D(tDiffuse, vUv + vec2(-o.x,-o.y)).rgb; m0+=a; s0+=a*a; vec3 b = texture2D(tDiffuse, vUv + vec2(o.x,-o.y)).rgb; m1+=b; s1+=b*b;
            vec3 c = texture2D(tDiffuse, vUv + vec2(o.x,o.y)).rgb; m2+=c; s2+=c*c; vec3 d = texture2D(tDiffuse, vUv + vec2(-o.x,o.y)).rgb; m3+=d; s3+=d*d; }
          float n = float((R+1)*(R+1)); vec3 col = m0/n; vec3 v = s0/n - col*col; float best = v.r+v.g+v.b;
          vec3 mm = m1/n; v = s1/n - mm*mm; float sv = v.r+v.g+v.b; if (sv < best) { best = sv; col = mm; }
          mm = m2/n; v = s2/n - mm*mm; sv = v.r+v.g+v.b; if (sv < best) { best = sv; col = mm; }
          mm = m3/n; v = s3/n - mm*mm; sv = v.r+v.g+v.b; if (sv < best) { best = sv; col = mm; }
          return col; }
        void main(){
          vec3 col = uPaint > 0.5 ? kuwahara() : texture2D(tDiffuse, vUv).rgb;
          /* 深度雾：线性深度（米），指数衰减；雾色在线性空间里给 */
          float d = max(0.0, linDepth(vUv) - uFogStart);
          float f = 1.0 - exp(-d * uFogDensity);
          col = mix(col, uFogColor, clamp(f, 0.0, 0.85));
          col *= uGrade;
          /* 暗角 */
          vec2 q = vUv - 0.5; float vig = 1.0 - uVignette * smoothstep(0.35, 0.95, length(q) * 1.4);
          col *= vig;
          float g = fract(sin(dot(vUv * vec2(1234.5, 789.1), vec2(12.9898, 78.233))) * 43758.5453);
          col += (g - 0.5) * uGrain * (col + 0.15);
          gl_FragColor = vec4(max(col, 0.0), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
  }
  /* 按 vis 条目（已插值好的数值）设置雾、调色、暗角 */
  setVis(v) {
    const u = this.mat.uniforms;
    u.uFogColor.value.set(v.fogColor).convertSRGBToLinear();
    u.uFogDensity.value = v.fogDensity * 0.012;  /* 表里 0.02 到 0.08 是"感觉值"，换算成每米衰减 */
    u.uFogStart.value = v.fogStart ?? 6;
    u.uVignette.value = v.vignette;
    u.uGrade.value.set(v.grade[0], v.grade[1], v.grade[2]);
  }
  render(scene, camera) {
    const r = this.renderer, w = r.domElement.width, h = r.domElement.height;
    if (!this.rt || this.rt.width !== w || this.rt.height !== h) {
      if (this.rt) this.rt.dispose();
      this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(w, h) });
      this.rt.depthTexture.format = THREE.DepthFormat; this.rt.depthTexture.type = THREE.UnsignedIntType;
    }
    r.setRenderTarget(this.rt); r.render(scene, camera); r.setRenderTarget(null);
    const u = this.mat.uniforms;
    u.tDiffuse.value = this.rt.texture; u.tDepth.value = this.rt.depthTexture; u.uTexel.value.set(1 / w, 1 / h);
    u.uNear.value = camera.near; u.uFar.value = camera.far;
    r.render(this.scene, this.cam);
  }
}
