import * as THREE from 'three';

// Ucuz son işleme (yalnız Yüksek kalite + "Son işleme" açık; telefonda varsayılan kapalı): sahne + birinci şahıs silah MSAA'lı doğrusal (HalfFloat) hedefe çizilir,
// parlak bölgeler 1/4 ve 1/8 çözünürlükte iki kademe bulanıklaştırılıp (parıltı / bloom) eklenir; günün saatine göre renk tonu, doygunluk, kontrast, vinyet,
// sonra ton eşleme + sRGB (renderer ayarıyla). Toplam ~7 tam ekran üçgen çizimi; FXAA gerekmez (hedef 4× MSAA).
const VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const DOWN = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 texel; uniform float thr, knee; varying vec2 vUv;
void main(){
  vec3 c = 0.25 * (texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb
                 + texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb);
  float l = max(c.r, max(c.g, c.b)), s = clamp(l - thr + knee, 0.0, 2.0 * knee); s = s * s / (4.0 * knee + 1e-4);
  gl_FragColor = vec4(min(c * max(s, l - thr) / max(l, 1e-4), vec3(12.0)), 1.0);              // yumuşak eşik (parlaklık > thr), aşırı değer kırpılır (ateş kıvılcımı titremesin)
}`;
const BLUR = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
void main(){                                                                                  // 9 dokulu Gauss (doğrusal örneklemeyle 5 okuma)
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270;
  c += (texture2D(tSrc, vUv + dir * 1.3846154).rgb + texture2D(tSrc, vUv - dir * 1.3846154).rgb) * 0.3162162;
  c += (texture2D(tSrc, vUv + dir * 3.2307692).rgb + texture2D(tSrc, vUv - dir * 3.2307692).rgb) * 0.0702703;
  gl_FragColor = vec4(c, 1.0);
}`;
const COMP = /* glsl */ `
uniform sampler2D tScene, tB1, tB2; uniform float bloom, sat, contrast, vig, aspect; uniform vec3 tint; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tScene, vUv).rgb + (texture2D(tB1, vUv).rgb * 0.6 + texture2D(tB2, vUv).rgb * 0.4) * bloom;
  c *= tint;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = max(mix(vec3(l), c, sat), 0.0);         // doygunluk (sahne doğrusal)
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
  gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(contrast)) * (1.0 - vig * smoothstep(0.35, 1.05, dot(q, q) * 1.6));   // kontrast + vinyet (ekran uzayı)
  #include <colorspace_fragment>
}`;

export class Post {
  constructor(renderer) {
    this.r = renderer; this.on = false; this.w = 0; this.h = 0;
    const rt = (o = {}) => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, ...o });
    this.rt = rt({ samples: 4, depthBuffer: true });
    this.a1 = rt(); this.b1 = rt(); this.a2 = rt(); this.b2 = rt();
    const mk = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false, toneMapped: false });
    this.mDown = mk(DOWN, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, thr: { value: 1.4 }, knee: { value: 0.5 } });
    this.mBlur = mk(BLUR, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mComp = mk(COMP, { tScene: { value: this.rt.texture }, tB1: { value: this.b1.texture }, tB2: { value: this.b2.texture }, bloom: { value: 0.12 }, sat: { value: 1 }, contrast: { value: 1 }, vig: { value: 0.18 }, aspect: { value: 1 }, tint: { value: new THREE.Vector3(1, 1, 1) } });
    this.mComp.toneMapped = true;                                                           // ton eşleme + çıktı renk uzayı bu geçişte (ekrana) uygulanır
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mDown); this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  // Günün saati renk ayarı: { tint:[r,g,b], sat, contrast, vig, bloom, thr }
  setGrade(g = {}) {
    const u = this.mComp.uniforms;
    u.tint.value.set(...(g.tint || [1, 1, 1])); u.sat.value = g.sat ?? 1.05; u.contrast.value = g.contrast ?? 1.04; u.vig.value = g.vig ?? 0.18; u.bloom.value = g.bloom ?? 0.12;
    this.mDown.uniforms.thr.value = g.thr ?? 1.4;
  }

  _size() {
    const v = this.r.getDrawingBufferSize(_v), w = v.x | 0, h = v.y | 0;
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.rt.setSize(w, h);
    const w1 = Math.max(1, w >> 2), h1 = Math.max(1, h >> 2), w2 = Math.max(1, w >> 3), h2 = Math.max(1, h >> 3);
    this.a1.setSize(w1, h1); this.b1.setSize(w1, h1); this.a2.setSize(w2, h2); this.b2.setSize(w2, h2);
    this.mComp.uniforms.aspect.value = w / h;
  }

  // Sahne çizimi bu hedefe yönlendirilir (çağıran: clear + render sahne + silah)
  begin() { this._size(); this.r.setRenderTarget(this.rt); }

  _pass(m, target) { this.quad.material = m; this.r.setRenderTarget(target); this.r.render(this.scene, this.cam); }
  end() {
    const r = this.r, d = this.mDown.uniforms, b = this.mBlur.uniforms;
    // eşik + 1/4 küçültme (tam çözünürlükten 4 bilinear okuma ≈ 16 doku), sonra 1/8
    d.tSrc.value = this.rt.texture; d.texel.value.set(1 / this.w, 1 / this.h); this._pass(this.mDown, this.a1);
    b.tSrc.value = this.a1.texture; b.dir.value.set(1 / this.a1.width, 0); this._pass(this.mBlur, this.b1);
    b.tSrc.value = this.b1.texture; b.dir.value.set(0, 1 / this.a1.height); this._pass(this.mBlur, this.a1);
    const t0 = d.thr.value, k0 = d.knee.value; d.thr.value = 0; d.knee.value = 1e-3; d.tSrc.value = this.a1.texture; d.texel.value.set(0.5 / this.a1.width, 0.5 / this.a1.height); this._pass(this.mDown, this.a2); d.thr.value = t0; d.knee.value = k0;
    b.tSrc.value = this.a2.texture; b.dir.value.set(1 / this.a2.width, 0); this._pass(this.mBlur, this.b2);
    b.tSrc.value = this.b2.texture; b.dir.value.set(0, 1 / this.a2.height); this._pass(this.mBlur, this.a2);
    const u = this.mComp.uniforms; u.tB1.value = this.a1.texture; u.tB2.value = this.a2.texture;
    this._pass(this.mComp, null);
  }

  dispose() {
    for (const t of [this.rt, this.a1, this.b1, this.a2, this.b2]) t.dispose();
    for (const m of [this.mDown, this.mBlur, this.mComp]) m.dispose();
    this.quad.geometry.dispose();
  }
}
const _v = new THREE.Vector2();
