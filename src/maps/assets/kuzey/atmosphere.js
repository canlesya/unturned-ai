import * as THREE from 'three';

// Kuzey Vadisi atmosferi (12.172, yalnız görsel):
// - Gün saati anahtar kareleri (KEYS): güneş yüksekliği / rengi, gök (tepe / orta / ufuk), yarımküre ışığı, sis rengi / mesafesi, pus miktarı.
//   setHour(h) bunları ara değerler ve sahneye uygular (gök kubbesi, güneş, sis, yarımküre, bulut, su); maç içinde zamanla değişen ışık için de aynı yol.
// - Bulut katmanı: 1,4 km yükseklikte 30 km'lik düzlem, kayan fbm bulutları (güneş tarafı parlak, alt yüzey gölgeli, ufka doğru incelir) — 1 çizim.
// - Vadi pusu: 3 yatay katman (y 3 / 6 / 10 m); arazi yükseklik dokusundan (half float) zemine yakın yerde söner → tepeyi kesen sert çizgi yok,
//   pus yalnız vadi tabanında / göl üstünde toplanır; kameraya yakında söner (içinden geçerken perde görünmez).

// [saat, güneş yüksekliği (°), güneş rengi, güneş gücü, gök tepe, gök orta, ufuk, yarımküre üst, yarımküre alt, yarımküre gücü, sis rengi, sis yakın, sis uzak, pus]
export const KEYS = [
  [5.6, -3, '#ff9a6a', 0.35, '#16213f', '#5a5b7c', '#d58d6c', '#7c86aa', '#2c2b2b', 0.45, '#b98f84', 40, 700, 0.9],
  [6.8, 8, '#ffbf86', 1.5, '#3f5f95', '#a5afc6', '#efc9a5', '#a8b6d2', '#45413a', 0.75, '#d8c4b0', 30, 850, 1.0],
  [8.5, 24, '#ffe6c4', 2.2, '#4a7fbd', '#9ec0de', '#dfe1df', '#bcd2ea', '#5b5440', 1.0, '#d2dbe0', 70, 1300, 0.45],
  [11, 46, '#fff3e2', 2.55, '#4683c8', '#93bde0', '#cddfea', '#bcd8ff', '#6b6248', 1.15, '#c9d8e3', 120, 1650, 0.08],
  [14, 50, '#fff5e8', 2.6, '#4383c9', '#91bbe0', '#cadcea', '#bcd8ff', '#6b6248', 1.15, '#c7d6e2', 130, 1700, 0.0],
  [16.8, 28, '#ffe6bf', 2.35, '#4a7bb8', '#a2bfd8', '#e2dcc8', '#c3cfe2', '#615845', 1.0, '#d3d3c9', 100, 1500, 0.12],
  [18.6, 9, '#ffa75a', 2.1, '#33467c', '#cf8d63', '#ffc287', '#ffb88f', '#4a3b36', 0.78, '#cfa286', 70, 1550, 0.35],
  [19.6, 1, '#ff7f45', 1.1, '#202a55', '#8f5d64', '#e9895d', '#c0889a', '#382d33', 0.6, '#a58c84', 55, 1250, 0.5],
  [20.4, -5, '#9a86c0', 0.35, '#0f1632', '#3e3858', '#8c5a5c', '#6a6c9a', '#24222c', 0.5, '#5d4f5c', 35, 700, 0.6],
];
const lerpC = (a, b, t, out) => out.set(a).lerp(_c2.set(b), t);
const _c2 = new THREE.Color();
export function sampleHour(h) {
  const K = KEYS; let i = 0;
  if (h <= K[0][0]) i = 0; else if (h >= K[K.length - 1][0]) i = K.length - 2; else while (i < K.length - 2 && h > K[i + 1][0]) i++;
  const a = K[i], b = K[i + 1], t = Math.max(0, Math.min(1, (h - a[0]) / (b[0] - a[0])));
  const C = (k) => lerpC(a[k], b[k], t, new THREE.Color());
  const n = (k) => a[k] + (b[k] - a[k]) * t;
  return { alt: n(1), sun: C(2), sunI: n(3), sky: [C(4), C(5), C(6)], hemi: [C(7), C(8), n(9)], fog: [C(10), n(11), n(12)], mist: n(13) };
}
// güneş yönü: sabah doğu (+x), öğle güney (+z), akşam batı (−x)
export function sunDirAt(h, alt) {
  const H = (h - 12) / 12 * Math.PI, a = alt * Math.PI / 180, ca = Math.cos(a);
  return new THREE.Vector3(-Math.sin(H) * ca, Math.sin(a), Math.cos(H) * ca * 0.75 + 0.25 * ca).normalize();
}
// harita env (setupEnvironment) için bir saatin değerleri: [renk dizeleri]
export function envAtHour(h, extra = {}) {
  const s = sampleHour(h), d = sunDirAt(h, Math.max(s.alt, 3)).multiplyScalar(160);
  const hex = (c) => '#' + c.getHexString();
  return { sky: s.sky.map(hex), fog: [hex(s.fog[0]), s.fog[1], s.fog[2]], sun: [hex(s.sun), s.sunI], hemi: [hex(s.hemi[0]), hex(s.hemi[1]), s.hemi[2]], sunPos: [d.x, d.y, d.z], ...extra };
}

function cloudLayer() {
  const U = { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: new THREE.Color('#fff') }, uLit: { value: new THREE.Color('#f4f6f8') }, uShade: { value: new THREE.Color('#9aa3ad') },
    uHor: { value: new THREE.Color('#cddfea') }, uCov: { value: 0.46 } };
  const m = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vWP; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `
      uniform float uTime, uCov; uniform vec3 uSun, uSunC, uLit, uShade, uHor; varying vec3 vWP;
      float ch(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float cn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(ch(i), ch(i+vec2(1.,0.)), f.x), mix(ch(i+vec2(0.,1.)), ch(i+vec2(1.,1.)), f.x), f.y); }
      float cf(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += cn(p) * a; p = p * 2.07 + vec2(1.7, 9.2); a *= 0.5; } return s; }
      void main(){
        vec2 p = vWP.xz * 0.00042 + vec2(uTime * 0.0035, uTime * 0.0012);
        float d = cf(p) + 0.25 * cf(p * 3.1 + 5.0) - 0.12;
        float a = smoothstep(uCov, uCov + 0.22, d);
        float thick = smoothstep(uCov, uCov + 0.5, d);
        float dist = length(vWP.xz - cameraPosition.xz);
        a *= 1.0 - smoothstep(6000.0, 14000.0, dist);
        if (a < 0.005) discard;
        float sd = cf(p + uSun.xz * 0.04);                     // güneşe doğru kaydırılmış örnek: kenar ışığı
        float lit = clamp(0.55 + (d - sd) * 3.0, 0.0, 1.0);
        vec3 c = mix(uShade, uLit, lit * (1.0 - thick * 0.45));
        c += uSunC * pow(max(dot(normalize(vWP - cameraPosition), uSun), 0.0), 8.0) * 0.35 * (1.0 - thick);
        c = mix(c, uHor, smoothstep(2500.0, 12000.0, dist) * 0.85);
        gl_FragColor = vec4(c, a * 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000, 1, 1), m);
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = 1400; mesh.frustumCulled = false; mesh.renderOrder = -900;
  mesh.userData.U = U;
  return mesh;
}

function mistLayers(T) {
  // arazi yükseklik dokusu (half float, doğrusal süzme): pus zemin yakınında söner
  const n = 401, data = new Uint16Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[j * n + i] = THREE.DataUtils.toHalfFloat(T.heightAt(T.minX + i * 4, T.minZ + j * 4));
  const tex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const U = { uTime: { value: 0 }, uAmt: { value: 0.5 }, uH: { value: tex }, uCol: { value: new THREE.Color('#dfe3e2') }, uSunC: { value: new THREE.Color('#ffe') }, uSun: { value: new THREE.Vector3(0, 1, 0) },
    uB: { value: new THREE.Vector4(T.minX, T.minZ, T.maxX - T.minX, T.maxZ - T.minZ) } };
  const g = new THREE.Group(); g.name = 'kuzey-pus';
  const mat = (y, k) => new THREE.ShaderMaterial({
    uniforms: { ...U, uY: { value: y }, uK: { value: k } }, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vWP;
      #include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime, uAmt, uY, uK; uniform sampler2D uH; uniform vec4 uB; uniform vec3 uCol, uSunC, uSun; varying vec3 vWP;
      #include <fog_pars_fragment>
      float mh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float mn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mh(i), mh(i+vec2(1.,0.)), f.x), mix(mh(i+vec2(0.,1.)), mh(i+vec2(1.,1.)), f.x), f.y); }
      float mf(vec2 p){ return mn(p) * 0.5 + mn(p * 2.1 + 3.0) * 0.3 + mn(p * 4.3 + 7.0) * 0.2; }
      void main(){
        vec2 uv = (vWP.xz - uB.xy) / uB.zw;
        float gh = texture2D(uH, uv).r;
        float over = uY - gh;                                         // pus katmanının zeminden yüksekliği
        float a = smoothstep(0.3, 5.0, over) * (1.0 - smoothstep(18.0, 45.0, over));
        vec2 q = vWP.xz * 0.006 + vec2(uTime * 0.004, uTime * 0.0015) * uK;
        a *= smoothstep(0.32, 0.8, mf(q) * 0.75 + mf(q * 3.3 + 9.0) * 0.25);
        float dc = length(vWP - cameraPosition);
        a *= smoothstep(6.0, 60.0, dc) * (1.0 - smoothstep(380.0, 900.0, dc)) * uAmt * 0.3;     // yakında / uzakta söner: bakış açısında üst üste binip duvar olmasın
        vec2 eb = min(vWP.xz - uB.xy, uB.xy + uB.zw - vWP.xz); a *= smoothstep(0.0, 160.0, min(eb.x, eb.y));   // harita kenarında söner
        vec3 Vd = normalize(vWP - cameraPosition); a *= mix(0.45, 1.0, smoothstep(0.02, 0.25, abs(Vd.y)));     // yatay bakışta incelir
        if (a < 0.004) discard;
        vec3 V = normalize(vWP - cameraPosition);
        vec3 c = uCol + uSunC * pow(max(dot(V, uSun), 0.0), 6.0) * 0.25;
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mats = [];
  for (const [y, k] of [[3.2, 1], [6.2, 1.4], [10, 1.9]]) {
    const m = mat(y, k); m.uniforms = { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...m.uniforms };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(T.maxX - T.minX, T.maxZ - T.minZ, 1, 1), m);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set((T.minX + T.maxX) / 2, y, (T.minZ + T.maxZ) / 2); mesh.renderOrder = 3;
    g.add(mesh); mats.push(m);
  }
  return { group: g, U, mats };
}

export class Atmosphere {
  constructor(T, { hour = 10.5, mist = true } = {}) {
    this.group = new THREE.Group(); this.group.name = 'kuzey-atmosfer';
    this.clouds = cloudLayer(); this.group.add(this.clouds);
    this.mist = mist ? mistLayers(T) : null; if (this.mist) this.group.add(this.mist.group);
    this.hour = hour; this.sunDir = sunDirAt(hour, sampleHour(hour).alt);
    this._apply0 = sampleHour(hour);
    this.setMistAmt(this._apply0.mist);
  }
  setMistAmt(a) { if (this.mist) for (const m of this.mist.mats) m.uniforms.uAmt.value = a; if (this.mist) this.mist.group.visible = a > 0.01; }
  // Sahneye bir saati uygula (maç içi gün döngüsü / önizleme). game: Game (güneş, gök kubbesi, sis, yarımküre); water: Water
  setHour(h, game, water, weatherFog = null) {
    const s = sampleHour(h), d = sunDirAt(h, s.alt);
    this.hour = h; this.sunDir.copy(d);
    if (game) {
      const sc = game.scene, dome = game.env?.dome;
      // 12.184 hava: yağmur / sis gök kubbesini (mavi gök + güneş diski) ve güneş gücünü de bastırır — eskiden maç boyu gün döngüsü her 2 sn'de açık hava
      // değerlerini geri yazıyordu (yağmurda mavi gök, keskin güneş gölgesi). Gök sis rengine çekilir, güneş ×0,45 / ×0,6 (weather.js ile aynı), şimşek için sunI güncel.
      const wk = game.weather?.kind || 'clear', wet = wk === 'rain' || wk === 'fog';
      if (dome) {
        const U = dome.material.uniforms; U.top.value.copy(s.sky[0]); U.mid.value.copy(s.sky[1]); U.hor.value.copy(s.sky[2]); U.sunC.value.copy(s.sun); U.sunDir.value.copy(d); U.halo.value = s.alt < 14 ? 0.75 : 0.32; U.disk.value = s.alt > -1 ? 5 : 0;
        if (wet && sc.fog) { const fc = sc.fog.color, k = wk === 'fog' ? 1 : 0.7; U.top.value.lerp(fc, wk === 'fog' ? 1 : k * 0.85); U.mid.value.lerp(fc, k); U.hor.value.lerp(fc, Math.min(1, k + 0.2)); U.disk.value = 0; U.halo.value *= 0.25; if (wk === 'fog') { const bi = 1 / Math.max(0.3, sc.backgroundIntensity ?? 1); for (const q of [U.top, U.mid, U.hor]) q.value.copy(fc).multiplyScalar(bi); } }   // sis: gök tam sis renginde (kubbe backgroundIntensity ile kararıyordu → dağ arası koyu leke)
      }
      if (game.sun) {
        const base = s.sunI * Math.max(0, Math.min(1, (s.alt + 3) / 8));
        game.sun.color.copy(s.sun); game.sun.intensity = base * (wk === 'rain' ? 0.45 : wk === 'fog' ? 0.6 : 1);
        if (game.weather && wet) game.weather.sunI = base;
      }
      this.wet = wet ? wk : null;
      if (game.sunOff) game.sunOff.copy(sunDirAt(h, Math.max(3, s.alt))).multiplyScalar(160);
      sc.traverse((o) => { if (o.isHemisphereLight) { o.color.copy(s.hemi[0]); o.groundColor.copy(s.hemi[1]); o.intensity = s.hemi[2]; } });
      if (sc.fog && !weatherFog) { sc.fog.color.copy(s.fog[0]); sc.fog.near = s.fog[1]; sc.fog.far = s.fog[2]; }
      if (game.renderer) game.renderer.toneMappingExposure = s.alt < 4 ? 1.08 : 1.0;
    }
    const cu = this.clouds.userData.U;
    cu.uSun.value.copy(d); cu.uSunC.value.copy(s.sun);
    cu.uLit.value.copy(s.sun).lerp(new THREE.Color('#ffffff'), s.alt > 15 ? 0.75 : 0.25);
    cu.uShade.value.copy(s.sky[1]).lerp(s.hemi[1], 0.35).multiplyScalar(s.alt > 10 ? 1.0 : 0.8);
    cu.uHor.value.copy(s.sky[2]);
    if (this.wet) { cu.uLit.value.lerp(new THREE.Color('#9aa2ab'), 0.6); cu.uShade.value.multiplyScalar(0.72); cu.uSunC.value.multiplyScalar(0.3); cu.uCov.value = 0.3; } else cu.uCov.value = 0.46;   // 12.184 yağmur: kapalı, gri bulut
    this.clouds.visible = this.wet !== 'fog';                                                      // sisli havada bulut tabakası sisin üstünde koyu leke gibi kalıyordu
    if (this.mist) { this.mist.U.uCol.value.copy(s.fog[0]).lerp(new THREE.Color('#ffffff'), 0.25); this.mist.U.uSunC.value.copy(s.sun); this.mist.U.uSun.value.copy(d); this.setMistAmt(s.mist); }
    if (water) for (const m of water.mats) { const U = m.userData.U; U.uSky.value.copy(s.sky[1]); U.uHor.value.copy(s.sky[2]); U.uSunC.value.copy(s.sun); U.uSun.value.copy(d); }
    return s;
  }
  // gece: oyunun gece hazır ayarı (gök / sis / ay ışığı) korunur; yalnız bulut / pus / su renkleri karartılır
  setNight(water) {
    const cu = this.clouds.userData.U, dark = new THREE.Color('#1b2340');
    cu.uLit.value.set('#3a4566'); cu.uShade.value.copy(dark); cu.uHor.value.set('#233a68'); cu.uSunC.value.set('#6a7aa8'); cu.uCov.value = 0.52;
    this.sunDir.set(-0.4, 0.75, -0.3).normalize();
    if (this.mist) { this.mist.U.uCol.value.set('#2c3a58'); this.mist.U.uSunC.value.set('#000'); this.setMistAmt(0.45); }
    if (water) for (const m of water.mats) { const U = m.userData.U; U.uSky.value.set('#10204a'); U.uHor.value.set('#233a68'); U.uSunC.value.set('#9fb4ff'); U.uSun.value.copy(this.sunDir); }
  }
  update(t, cam) {
    this.clouds.userData.U.uTime.value = t;
    if (this.mist) this.mist.U.uTime.value = t;
    if (cam) { this.clouds.position.x = cam.x; this.clouds.position.z = cam.z; }
  }
}
