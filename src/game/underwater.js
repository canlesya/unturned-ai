import * as THREE from 'three';
import { waterYAt } from '../sim/swim.js';

// 12.180 Su altı görünümü (yalnız tarayıcı; su veren her haritada — terrain.waterY). Ucuz: tek sis ayarı + tek tam ekran ton geçişi + boğuk ses.
// Kare başına (Game.render): begin() kamera su altındaysa sisi kısa / mavi-yeşil yapar (derinlikle kararır, gece koyu), gök kubbesini gizler, uzak düzlemi
// 90 m'ye çeker (uzak dağ / bulut çizilmez → telefonda da ucuz), sesi alçak geçirgenle boğar; overlay() ton + vinyet + ışık hüzmesi çizer; end() hepsini geri alır
// (hava / gün döngüsü sis değerlerini kendisi yönetmeye devam eder). Yüzey çizgisi: kamera su düzleminin ±BAND içine girerse bulunduğu tarafa itilir
// (yarısı suda yarısı dışarıda kare yok) ve geçiş ~0,1 sn'de yumuşar (titreme yok).
const BAND = 0.09;
const _m = new THREE.Matrix4(), _q = new THREE.Vector3();
const SHALLOW = new THREE.Color('#2f7c80'), DEEP = new THREE.Color('#0a2a32');
const VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FS = /* glsl */ `
uniform float uK, uTime, uDepth, uPitch, uAspect, uLight; uniform vec3 uCol; varying vec2 vUv;
void main(){
  vec2 q = vUv - 0.5; q.x *= uAspect;
  float vig = smoothstep(0.28, 1.0, length(q));
  // ışık hüzmeleri: yukarıdan yelpaze, yavaş kayar; yukarı bakınca ve sığda belirgin
  float fx = q.x / (1.35 - vUv.y * 0.55);
  float ray = (0.5 + 0.5 * sin(fx * 21.0 + uTime * 0.55)) * (0.5 + 0.5 * sin(fx * 8.3 - uTime * 0.37 + 1.7)) * (0.5 + 0.5 * sin(fx * 47.0 + uTime * 1.1));
  ray *= smoothstep(0.15, 1.05, vUv.y + uPitch * 0.45) * (1.0 - smoothstep(3.0, 12.0, uDepth)) * uLight;
  vec3 c = uCol * (1.0 - vig * 0.55) + vec3(0.55, 0.85, 0.8) * ray * 0.32;
  float a = uK * clamp(0.16 + vig * 0.5 + ray * 0.12, 0.0, 0.8);
  gl_FragColor = vec4(c, a);
}`;

export class Underwater {
  constructor(game) {
    this.g = game; this.k = 0; this.under = false; this.depth = 0; this._s = null;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { uK: { value: 0 }, uTime: { value: 0 }, uDepth: { value: 0 }, uPitch: { value: 0 }, uAspect: { value: 1 }, uLight: { value: 1 }, uCol: { value: new THREE.Color() } },
    });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); q.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(q); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.col = new THREE.Color(); this._fc = new THREE.Color();
    // kabarcıklar: kameranın önünde 28 nokta, yükselir, yüzeyde / 1,6 m yukarıda yeniden aşağıdan başlar (tek çizim, yalnız su altında)
    const N = 28, pos = new Float32Array(N * 3);
    this.bub = Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 3, y: Math.random() * 2.4 - 1.2, z: -0.6 - Math.random() * 2.6, v: 0.35 + Math.random() * 0.5, w: Math.random() * 6 }));
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const R = 16, px = new Uint8Array(R * R * 4);                                       // yuvarlak kabarcık: parlak kenarlı halka (alfa)
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) { const d = Math.hypot(i + 0.5 - R / 2, j + 0.5 - R / 2) / (R / 2), a = d > 1 ? 0 : 0.35 + 0.65 * Math.pow(d, 3) * (d > 0.85 ? (1 - d) / 0.15 : 1); px.set([255, 255, 255, Math.round(a * 255)], (j * R + i) * 4); }
    const tex = new THREE.DataTexture(px, R, R); tex.needsUpdate = true;
    this.points = new THREE.Points(bg, new THREE.PointsMaterial({ color: '#d4f1f6', size: 0.05, map: tex, transparent: true, opacity: 0.7, depthWrite: false }));
    this.points.frustumCulled = false; this.points.visible = false; this.points.renderOrder = 3;
    game.scene.add(this.points);
  }
  _bubbles(dt, cam, wy) {
    const P = this.points.geometry.attributes.position, a = P.array, t = performance.now() / 1000;
    _m.copy(cam.matrixWorld);
    for (let i = 0; i < this.bub.length; i++) {
      const b = this.bub[i];
      b.y += b.v * dt;
      _q.set(b.x + Math.sin(t * 2 + b.w) * 0.04, b.y, b.z).applyMatrix4(_m);
      if (b.y > 1.4 || _q.y > wy - 0.03) { b.y = -1.3 - Math.random() * 0.4; b.x = (Math.random() - 0.5) * 3; b.z = -0.6 - Math.random() * 2.6; _q.set(b.x, b.y, b.z).applyMatrix4(_m); }
      a[i * 3] = _q.x; a[i * 3 + 1] = _q.y; a[i * 3 + 2] = _q.z;
    }
    P.needsUpdate = true;
  }

  begin(dt) {
    const g = this.g, cam = g.camera, sc = g.scene, T = g.world.terrain, p = cam.position;
    const wy = waterYAt(T, p.x, p.z);
    let d = wy > -1e9 ? wy - p.y : -1e9;
    this._camY = null;
    if (wy > -1e9 && Math.abs(d) < BAND) {                                              // yüzey çizgisi: kamerayı bulunduğu tarafa it (yarım kare yok)
      this._camY = p.y; const side = this.under ? 1 : -1;
      p.y = wy - side * BAND; d = side * BAND; cam.updateMatrixWorld();
    }
    this.under = d > 0; this.depth = Math.max(0, d);
    this.k += ((this.under ? 1 : 0) - this.k) * Math.min(1, dt * 16);
    if (this.k < 0.02 && !this.under) { this.k = 0; g.sfx?.setUnderwater?.(0); this._s = null; this.points.visible = false; return; }
    this.points.visible = this.under && this.k > 0.5;
    if (this.points.visible) this._bubbles(Math.min(0.1, dt), cam, wy);
    const k = this.k, f = sc.fog;
    // renk: sığda mavi-yeşil, derinde koyu; günün ışığı (orijinal sis parlaklığı) ile çarpılır → gece / gün batımında koyu
    const fc = f ? f.color : this._fc.set('#9cb0c0'), L = 0.2126 * fc.r + 0.7152 * fc.g + 0.0722 * fc.b, light = Math.max(0.12, Math.min(1, L * 1.5));
    const col = this.col.copy(SHALLOW).lerp(DEEP, Math.min(1, this.depth / 14)).multiplyScalar(light);
    const s = (this._s = { fogC: f ? f.color.clone() : null, den: f?.density, near: f?.near, far: f?.far, bg: sc.background, far0: cam.far, dome: g.env?.dome?.visible });
    if (f) {
      f.color.lerp(col, k);
      if (f.isFogExp2) f.density = s.den + (0.06 + this.depth * 0.004 - s.den) * k;
      else { f.near = s.near + (0.4 - s.near) * k; f.far = s.far + (26 - this.depth * 0.6 - s.far) * k; }
    }
    if (k > 0.5) {
      sc.background = col;                                                                 // temizleme rengi = su rengi; gök kubbesi / uzak dağ / bulut çizilmez
      if (g.env?.dome) g.env.dome.visible = false;
      if (cam.far > 90) { cam.far = 90; cam.updateProjectionMatrix(); }
    }
    const U = this.mat.uniforms;
    U.uK.value = k; U.uTime.value = performance.now() / 1000; U.uDepth.value = this.depth; U.uPitch.value = g.playerSoldier?.pitch || 0; U.uLight.value = light;
    U.uCol.value.copy(col); U.uAspect.value = cam.aspect || 1;
    g.sfx?.setUnderwater?.(k);
  }

  overlay(r) { if (this._s && this.k > 0.02) r.render(this.scene, this.cam); }

  end() {
    const g = this.g, cam = g.camera, sc = g.scene, s = this._s;
    if (this._camY != null) { cam.position.y = this._camY; cam.updateMatrixWorld(); this._camY = null; }
    if (!s) return;
    const f = sc.fog;
    if (f && s.fogC) { f.color.copy(s.fogC); if (f.isFogExp2) f.density = s.den; else { f.near = s.near; f.far = s.far; } }
    sc.background = s.bg;
    if (g.env?.dome && s.dome !== undefined) g.env.dome.visible = s.dome;
    if (cam.far !== s.far0) { cam.far = s.far0; cam.updateProjectionMatrix(); }
    this._s = null;
  }
}
