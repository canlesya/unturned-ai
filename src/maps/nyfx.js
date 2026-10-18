import * as THREE from 'three';
import { cityTime } from './citySurface.js';

// New York gece efektleri (yalnız görsel; çarpışma / görüş / nav'a dokunmaz):
//  · az sayıda gerçek nokta ışığı (gölgesiz) yanan araçlarda + ateş varillerinde, titrer (dokunmatikte 2)
//  · parlama billboard'ları, yerde ışık lekeleri, kıvılcımlar: TEK örneklenmiş ağ (toplamalı, 1 çizim çağrısı), hareket köşe gölgelendiricide
//  · duman sütunları: TEK örneklenmiş ağ (normal karışım), hareket köşe gölgelendiricide (işlemci yükü yok)
//  · ateş / pencere ışıyan malzemelerine titreme + jaluzi deseni (malzeme kopyası; diğer haritaların ortak malzemesi değişmez)
const touch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

const FOG_V = `uniform float fogNear; uniform float fogFar; varying float vFog;`;
const NOISE = `float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1.,0.)), f.x), mix(h21(i+vec2(0.,1.)), h21(i+vec2(1.,1.)), f.x), f.y); }`;

// örnek verisi: p = [x, y, z, boy], c = [r, g, b, alfa], a = [faz, tür]
function instGeo(items) {
  const plane = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = plane.index; g.setAttribute('position', plane.attributes.position);
  const P = new Float32Array(items.length * 4), C = new Float32Array(items.length * 4), A = new Float32Array(items.length * 2);
  items.forEach((it, i) => { P.set(it.p, i * 4); C.set(it.c, i * 4); A.set(it.a, i * 2); });
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(P, 4));
  g.setAttribute('iCol', new THREE.InstancedBufferAttribute(C, 4));
  g.setAttribute('iAux', new THREE.InstancedBufferAttribute(A, 2));
  g.instanceCount = items.length;
  return g;
}

// türler (iAux.y): 0 ateş halesi (titrer) · 0.5 sabit lamba / neon halesi · 1 yerde ışık lekesi · 2 kıvılcım · 3 sokak lambası ışık konisi (dikey, Y eksenli pano)
// · 4 alev (Y eksenli pano, tabandan; şekil + hareket parça gölgelendiricide) · 5 yanıp sönen neon halesi
const GLOW_VS = `uniform float uTime; attribute vec4 iPos; attribute vec4 iCol; attribute vec2 iAux; varying vec2 vUv; varying vec4 vC; varying float vK; varying float vPh; ${FOG_V}
void main(){
  float ph = iAux.x, kind = iAux.y; vec3 wp = iPos.xyz; float sz = iPos.w; float a = iCol.a;
  float fl = 0.78 + 0.22 * sin(uTime * 9.0 + ph * 7.0) * sin(uTime * 13.7 + ph * 3.0) + 0.08 * sin(uTime * 31.0 + ph);
  vec4 mv;
  if (kind > 0.75 && kind < 1.25) {                                // yerde ışık lekesi (yatay)
    a *= mix(1.0, fl, iCol.a > 0.3 ? 0.6 : 0.0);
    mv = viewMatrix * vec4(wp + vec3(position.x * sz, 0.0, -position.y * sz), 1.0);
  } else if (kind > 2.75 && kind < 4.25) {                         // ışık konisi / alev: kameraya Y ekseni etrafında döner (dik kalır)
    vec3 toC = cameraPosition - wp; vec3 r = normalize(vec3(toC.z, 0.0, -toC.x) + 1e-5);
    float t = position.y + 0.5;
    vec3 P;
    if (kind < 3.25) P = wp + vec3(0.0, -(1.0 - t) * sz, 0.0) + r * position.x * mix(sz * 0.62, 0.4, t);   // koni: tepede dar, yerde geniş
    else { P = wp + r * position.x * sz + vec3(0.0, t * sz * 1.7, 0.0); a *= 0.85 + 0.15 * fl; }           // alev: tabandan yukarı
    mv = viewMatrix * vec4(P, 1.0);
    if (kind > 3.75) mv.xyz += normalize(-mv.xyz) * 0.25;
  } else {
    if (kind > 1.75 && kind < 2.25) {                              // kıvılcım: yükselir, savrulur, söner
      float t = fract(uTime * (0.28 + 0.2 * fract(ph * 7.1)) + ph);
      wp += vec3(sin(ph * 40.0 + uTime * 1.3) * 0.9 * t, t * (4.0 + 3.0 * fract(ph * 3.7)), cos(ph * 23.0 + uTime * 1.1) * 0.9 * t);
      a *= (1.0 - t) * smoothstep(0.0, 0.08, t) * step(0.3, fract(uTime * 3.0 + ph * 11.0) + 0.4);
    } else if (kind < 0.25) { a *= fl; sz *= 0.94 + 0.06 * fl; }   // ateş parlaması titrer
    else if (kind > 4.75) a *= 0.25 + 0.75 * step(0.18, fract(floor(uTime * 7.0 + ph * 50.0) * 0.6180339));   // bozuk neon: ara ara söner (tabelayla aynı dizi)
    mv = viewMatrix * vec4(wp, 1.0);
    mv.xyz += normalize(-mv.xyz) * min(sz * 0.45, 1.4);           // kameraya çek: geometriye gömülüp kesik görünmesin
    mv.xy += position.xy * sz;
  }
  vUv = position.xy * 2.0; vC = vec4(iCol.rgb, a); vK = kind; vPh = ph;
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FS = `uniform float uTime; varying vec2 vUv; varying vec4 vC; varying float vK; varying float vPh; ${FOG_V}
${NOISE}
void main(){
  float ff = 1.0 - smoothstep(fogNear, fogFar * 1.25, vFog);
  vec3 col = vC.rgb; float g;
  if (vK > 2.75 && vK < 3.25) {                                    // ışık konisi: tepede yoğun, kenarları yumuşak, içinde ağır ağır süzülen toz
    float t = vUv.y * 0.5 + 0.5;
    g = (1.0 - smoothstep(0.35, 1.0, abs(vUv.x))) * (0.18 + 0.82 * t * t) * smoothstep(0.0, 0.2, t);
    g *= 0.75 + 0.25 * vn(vec2(vUv.x * 4.0, vUv.y * 3.0 - uTime * 0.15) + vPh * 10.0);
  } else if (vK > 3.75 && vK < 4.25) {                             // alev: gürültüyle kıvrılan, yukarı incelen dil; sarı çekirdek → kızıl uç
    vec2 q = vec2(vUv.x * 0.5, vUv.y * 0.5 + 0.5);
    float t = uTime * (1.8 + vPh);
    float n = vn(vec2(q.x * 4.0 + vPh * 17.0, q.y * 3.0 - t * 1.7)) * 0.6 + vn(vec2(q.x * 9.0 + vPh * 5.0, q.y * 7.0 - t * 3.3)) * 0.4;
    float x = abs(q.x + (n - 0.5) * 0.3 * q.y);
    float w = (1.0 - q.y) * 0.42 * (0.65 + 0.7 * n);
    float body = (1.0 - smoothstep(w * 0.55, w, x)) * smoothstep(0.0, 0.06, q.y) * (1.0 - smoothstep(0.45 + 0.4 * n, 1.0, q.y));
    float core = (1.0 - smoothstep(w * 0.12, w * 0.5, x)) * (1.0 - smoothstep(0.05, 0.55, q.y));
    col = mix(vec3(1.0, 0.22, 0.03), vec3(1.0, 0.62, 0.18), smoothstep(0.2, 0.9, body));
    col = mix(col, vec3(1.0, 0.92, 0.7), core);
    g = body * (0.65 + 0.35 * n) + core * 0.5;
  } else {
    float r = length(vUv); if (r > 1.0) discard;
    g = exp(-r * r * 3.2) - 0.04 * r;
  }
  gl_FragColor = vec4(col, clamp(g * vC.a * ff, 0.0, 1.0));
}`;

const SMOKE_VS = `uniform float uTime; attribute vec4 iPos; attribute vec4 iCol; attribute vec2 iAux; varying vec2 vUv; varying vec4 vC; varying float vPh; ${FOG_V}
void main(){
  float ph = iAux.x, H = iAux.y; vec3 wp = iPos.xyz;
  float t = fract(uTime * (0.045 + 0.025 * fract(ph * 5.3)) + ph);
  wp += vec3(t * t * H * 0.35 + sin(ph * 17.0 + uTime * 0.3) * 0.8 * t, t * H, t * H * 0.12 + cos(ph * 9.0) * 0.6 * t);   // yükselir, rüzgârla doğuya eğilir
  float sz = iPos.w * (0.45 + 1.15 * t);
  float a = iCol.a * smoothstep(0.0, 0.12, t) * (1.0 - t);
  vec3 col = mix(vec3(0.55, 0.26, 0.1), iCol.rgb, smoothstep(0.02, 0.3, t));         // alt kısım ateşten turuncu aydınlanır
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  float ang = ph * 6.28 + t * 1.5; mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  mv.xy += R * position.xy * sz;
  vUv = position.xy * 2.0; vC = vec4(col, a); vPh = ph;
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const SMOKE_FS = `uniform vec3 fogColor; varying vec2 vUv; varying vec4 vC; varying float vPh; ${FOG_V}
${NOISE}
void main(){
  float r = length(vUv); if (r > 1.0) discard;
  float n = vn(vUv * 2.2 + vPh * 31.0) * 0.6 + vn(vUv * 4.7 + vPh * 13.0) * 0.4;
  float a = (1.0 - smoothstep(0.25, 1.0, r)) * (0.45 + 0.75 * n) * vC.a;
  float ff = smoothstep(fogNear, fogFar, vFog);
  gl_FragColor = vec4(mix(vC.rgb, fogColor, ff), clamp(a * (1.0 - ff * 0.6), 0.0, 1.0));
}`;

const hex = (h, a) => { const o = { r: 0, g: 0, b: 0 }; new THREE.Color(h).getRGB(o, THREE.SRGBColorSpace); return [o.r, o.g, o.b, a]; };      // sRGB değerleri (gölgelendirici çıktısı renk uzayı dönüşümünden geçmez)
const _c = new THREE.Color();
const FIRE = new Set(['#ff8a3d']);                            // ateş varili ağzı: kor yatağı (koyu, çatlaklarından parlar)
const FLOAT_FIRE = new Set(['#ff7a2a', '#ffd27a']);           // havada duran parlak "ateş küpleri": gizlenir, yerine alev panoları (cityFx flames)
const WINDOW = new Set(['#ffcf7a', '#ffb455', '#cfe9ff']);

function patchGlow(group, uTime) {
  const done = new Map();
  group.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material) || !o.material.userData?.glow || !o.material.isMeshStandardMaterial) return;
    const hx = '#' + o.material.color.getHexString();
    if (FLOAT_FIRE.has(hx)) { o.visible = false; return; }
    const fire = FIRE.has(hx), win = WINDOW.has(hx);
    if (!fire && !win) return;
    let m = done.get(o.material);
    if (!m) {
      m = o.material.clone();
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = uTime;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vGWP;\nuniform float uTime;\n${NOISE}`)
          .replace('#include <emissivemap_fragment>', fire
            ? `#include <emissivemap_fragment>
{ float fl = vn(vec2(uTime * 5.0 + vGWP.x * 1.3, vGWP.z * 1.7)); float ck = vn(vGWP.xz * 9.0 + vec2(0.0, uTime * 0.4)) * 0.6 + vn(vGWP.xz * 23.0) * 0.4;
  float hot = smoothstep(0.45, 0.62, ck);                                    // kor: koyu kömür, çatlaklarında sarı-turuncu parlama
  totalEmissiveRadiance *= (0.12 + 1.1 * hot) * (0.6 + 0.6 * fl); diffuseColor.rgb = mix(vec3(0.04, 0.03, 0.025), diffuseColor.rgb, hot); }`
            : `#include <emissivemap_fragment>
{ float w = 0.55 + 0.6 * vn(vGWP.xy * 0.8 + vGWP.zz * 0.9 + 3.0); float bl = 0.78 + 0.22 * step(0.45, fract(vGWP.y * 6.5));
  totalEmissiveRadiance *= w * bl * (0.82 + 0.18 * smoothstep(0.2, 1.0, fract(vGWP.y / 3.1 + 0.2))); }`);
      };
      m.customProgramCacheKey = () => (fire ? 'ny-fire-v2' : 'ny-win-v1');
      done.set(o.material, m);
    }
    o.material = m;
  });
}

// fires: [{x, y, z, s (boyut)}], lamps: [{x, y, z, cone?}], pools: [{x, z, r, color, a}], smoke: [{x, y, z, s, h, n}], embers: [{x, y, z, n}],
// flames: [{x, y, z, s}] (alev dili, tabandan), neon: [{x, y, z, w, color, blink, mesh}] (tabela halesi; blink: ara ara söner, tabela da)
export function cityFx(group, { fires = [], lamps = [], pools = [], smoke = [], embers = [], lights = [], flames = [], neon = [] }) {
  if (typeof document === 'undefined') return null;
  const uTime = cityTime;
  patchGlow(group, uTime);
  // ── nokta ışıkları (gölgesiz) ──
  const pl = [];
  const maxL = touch() ? 2 : lights.length;
  for (const L of lights.slice(0, maxL)) {
    const l = new THREE.PointLight(L.color || '#ff8a3a', L.i || 60, L.d || 18, 2);
    l.position.set(L.x, L.y, L.z); l.castShadow = false;
    group.add(l); pl.push({ l, base: L.i || 60, ph: Math.random() * 10, x: L.x, y: L.y, z: L.z });
  }
  // ── parlamalar (toplamalı) ──
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const G = [];
  for (const f of fires) {
    G.push({ p: [f.x, f.y, f.z, f.s * 2.4], c: hex('#ff7a2a', f.wall ? 0.3 : 0.55), a: [rnd(), 0] });       // geniş turuncu hale (cephe deliğinde hafif: içerideki oda görünsün)
    if (!f.wall) G.push({ p: [f.x, f.y + 0.1, f.z, f.s * 1.1], c: hex('#ffd27a', 0.7), a: [rnd(), 0] });   // sıcak çekirdek
    if (!f.wall) G.push({ p: [f.x, 0.07, f.z, f.s * 3.4], c: hex('#ff6a1e', 0.42), a: [rnd(), 1] });       // yerde ateş ışığı (yalnız yerdeki ateşte)
  }
  for (const L of lamps) {
    G.push({ p: [L.x, L.y, L.z, L.s || 1.6], c: hex(L.color || '#ffd9a0', L.a ?? 0.55), a: [0, 0.5] });
    if (L.pool !== false) { G.push({ p: [L.x, 0.07, L.z, 6.4], c: hex(L.color || '#ffc88a', 0.3), a: [0, 1] }); G.push({ p: [L.x, 0.075, L.z, 2.8], c: hex('#ffdcae', 0.26), a: [0, 1] }); }   // geniş ışık lekesi + parlak merkez
    if (L.cone) G.push({ p: [L.x, L.y - 0.1, L.z, L.y - 0.1], c: hex('#ffd8a0', 0.075), a: [rnd(), 3] });     // sisli havada ışık konisi
  }
  for (const f of fires) {                                                       // alev dilleri (yanan araç: 3-4, varil: 1; cephe deliği: flames listesinde)
    if (f.wall) continue;
    const k = f.s > 1 ? 4 : 1;
    for (let i = 0; i < k; i++) flames.push({ x: f.x + (k > 1 ? (rnd() - 0.5) * 1.8 : 0), y: f.y - (k > 1 ? 0.55 : 0.2), z: f.z + (k > 1 ? (rnd() - 0.5) * 0.9 : 0), s: f.s * (k > 1 ? 0.5 + rnd() * 0.35 : 0.75) });
  }
  for (const F of flames) G.push({ p: [F.x, F.y, F.z, F.s], c: [1, 1, 1, 0.95], a: [rnd(), 4] });
  const blinkers = [];
  for (const N of neon) {                                                        // neon halesi (tabelanın rengi): geniş + yoğun iki katman
    const ph = rnd();
    G.push({ p: [N.x, N.y, N.z, N.w * 0.85], c: hex(N.color, 0.2), a: [ph, N.blink ? 5 : 0.5] });
    G.push({ p: [N.x, N.y, N.z, N.w * 0.4], c: hex(N.color, 0.22), a: [ph, N.blink ? 5 : 0.5] });
    if (N.blink && N.mesh) blinkers.push({ m: N.mesh, ph });
  }
  for (const P of pools) G.push({ p: [P.x, P.y ?? 0.07, P.z, P.r], c: hex(P.color, P.a), a: [rnd(), 1] });
  for (const e of embers) for (let i = 0; i < e.n; i++) G.push({ p: [e.x + (rnd() - 0.5) * 1.2, e.y, e.z + (rnd() - 0.5) * 1.0, 0.09 + rnd() * 0.07], c: hex(rnd() < 0.5 ? '#ffb040' : '#ff7020', 1), a: [rnd(), 2] });
  const fogU = () => ({ fogNear: { value: 1 }, fogFar: { value: 1000 }, fogColor: { value: new THREE.Color() } });
  const glowMat = new THREE.ShaderMaterial({ uniforms: { uTime, ...fogU() }, vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  const glow = new THREE.Mesh(instGeo(G), glowMat); glow.name = 'nyGlow'; glow.frustumCulled = false; glow.renderOrder = 3; group.add(glow);
  // ── duman ──
  const S = [];
  for (const s of smoke) for (let i = 0; i < s.n; i++) S.push({ p: [s.x + (rnd() - 0.5) * 0.8, s.y, s.z + (rnd() - 0.5) * 0.8, s.s], c: hex(s.color || '#24252b', s.a ?? 0.5), a: [i / s.n + rnd() * 0.05, s.h] });
  let smokeMesh = null;
  if (S.length) {
    const sm = new THREE.ShaderMaterial({ uniforms: { uTime, ...fogU() }, vertexShader: SMOKE_VS, fragmentShader: SMOKE_FS, transparent: true, depthWrite: false, fog: true });
    smokeMesh = new THREE.Mesh(instGeo(S), sm); smokeMesh.name = 'nySmoke'; smokeMesh.frustumCulled = false; smokeMesh.renderOrder = 2; group.add(smokeMesh);
  }
  return {
    lights: pl.map((p) => p.l),
    update(t) {
      uTime.value = t;
      for (const b of blinkers) { const v = Math.floor(t * 7 + b.ph * 50) * 0.6180339; b.m.material.opacity = v - Math.floor(v) > 0.18 ? 1 : 0.25; }     // halesiyle aynı anda söner
      for (const p of pl) {
        const f = 0.72 + 0.18 * Math.sin(t * 8.3 + p.ph) * Math.sin(t * 13.1 + p.ph * 2) + 0.1 * Math.sin(t * 27 + p.ph * 3);
        p.l.intensity = p.base * f;
        p.l.position.set(p.x + Math.sin(t * 5.1 + p.ph) * 0.12, p.y + Math.sin(t * 7.3 + p.ph) * 0.1, p.z + Math.cos(t * 4.7 + p.ph) * 0.12);
      }
    },
  };
}
