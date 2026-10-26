import * as THREE from 'three';
import { box, cylY, mat } from '../core/geo.js';
import { CLASS_WEAR, GLOW_ITEMS as GLOW_LIST, WEAR_SLOTS } from '../game/wearIds.js';
import { TEAMS } from '../core/palette.js';
const TEAMS_FALLBACK = (t) => TEAMS[t] || TEAMS.blue;
export { CLASS_WEAR };

// 12.167 Karakter v2 + kıyafet kaplamaları Gövde iki yönde kurulabilir: 'A' (mevcut iskelet, rafine; oyunda bu) / 'B' (kahraman oranı, yalnız lab).
// Kıyafet = 5 yuva (head · top · back · legs · feet) + her yuvada renk / desen paleti. TEK paylaşılan malzeme (WEAR_MAT): köşe rengine işaret
// (+2 ışıma, +4 kamuflaj, +6 metal, +8 cam; +20 = pelerin köşesi, hıza bağlı salınım) gömülür → kaplama / ışık / kamuflaj asker başına ek malzeme ya da çizim çağrısı getirmez.
// Takım okunurluğu: kollar (gömlek) + iki kolda takım bandı + omuz başı + başlık şeridi + sırt / göğüs takım yaması kaplamadan bağımsızdır.

// ── Paylaşılan malzeme: kamuflaj paletleri uniform dizisinde (indeks köşe renginde) ──
export const CAMO = {               // id → [renk ×4, mod (1 leke, 2 dijital), ölçek]
  desert: [['#b39a6e', '#8f7650', '#cdb98d', '#6f5a3e'], 1, 7],
  wood: [['#56603a', '#6e5435', '#23241e', '#8f8a5e'], 1, 8],
  urban: [['#7d8187', '#4f5359', '#26282c', '#b3b6ba'], 2, 7],
  snow: [['#e4e6e8', '#b9bec4', '#8a9096', '#f4f5f6'], 1, 7],
  night: [['#2a2d33', '#1c1e22', '#3b3f46', '#121316'], 2, 8],
};
const CAMO_IDS = Object.keys(CAMO);
const U = {
  uCC: { value: [] }, uCM: { value: [] }, uCS: { value: [] }, uGlowK: { value: 2.4 }, uSway: { value: new THREE.Vector4() },
};
CAMO_IDS.forEach((id) => { const [cc, m, s] = CAMO[id]; cc.forEach((c) => U.uCC.value.push(new THREE.Color(c))); U.uCM.value.push(m); U.uCS.value.push(s); });
while (U.uCM.value.length < 8) { U.uCM.value.push(0); U.uCS.value.push(1); for (let i = 0; i < 4; i++) U.uCC.value.push(new THREE.Color()); }
export const WEAR_U = U;
// uSway (asker başına; yalnız pelerinli askerin gövde ağında kendi malzeme örneği): x geriye savrulma, y yana, z zaman, w dalgalanma gücü
function wearCompile(sh) {
  Object.assign(sh.uniforms, U, this.userData.sway ? { uSway: this.userData.sway } : {});
  sh.vertexShader = 'varying vec3 vOP; uniform vec4 uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
 vOP = position;
 #ifdef USE_COLOR
 if (color.r > 19.5) { float k = clamp((0.25 - position.y) / 0.9, 0.0, 1.0); k *= k;
   transformed.z += k * (uSway.x + 0.014 * uSway.w * sin(uSway.z * 7.0 + position.x * 11.0 + position.y * 6.0)); transformed.x += k * uSway.y; }
 #endif`);
  sh.fragmentShader = `varying vec3 vOP; uniform vec3 uCC[32]; uniform float uCM[8]; uniform float uCS[8]; uniform float uGlowK;
float wh(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float wn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wh(i), wh(i + vec3(1,0,0)), f.x), mix(wh(i + vec3(0,1,0)), wh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(wh(i + vec3(0,0,1)), wh(i + vec3(1,0,1)), f.x), mix(wh(i + vec3(0,1,1)), wh(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec3 wcamo(vec3 p, int k){
  float md = 0.0, cs = 1.0; vec3 c0, c1, c2, c3;
  for (int i = 0; i < 8; i++) if (i == k) { md = uCM[i]; cs = uCS[i]; c0 = uCC[i*4]; c1 = uCC[i*4+1]; c2 = uCC[i*4+2]; c3 = uCC[i*4+3]; }
  if (md > 1.5) p = (floor(p * 70.0) + 0.5) / 70.0;
  vec3 q = p * cs; float a = wn(q) * 0.65 + wn(q * 2.3 + 7.1) * 0.35, b = wn(q * 1.2 + 19.7) * 0.6 + wn(q * 2.9 + 3.3) * 0.4, c = wn(q * 0.8 + 41.0);
  vec3 col = c0; if (c < 0.3) col = c3; if (a > 0.58) col = c1; if (b > 0.64) col = c2; return col; }
` + sh.fragmentShader
    .replace('#include <color_fragment>', `
  vec3 wc = vColor.rgb; if (wc.r > 19.5) wc -= 20.0; float wk = floor(wc.r * 0.5 + 0.001); wc -= 2.0 * wk;
  float wGlow = 0.0, wMet = 0.0, wRough = 0.82;
  if (wk > 0.5 && wk < 1.5) wGlow = 1.0;
  else if (wk > 1.5 && wk < 2.5) { int ci = int(wc.r * 16.0 + 0.5); wc = wcamo(vOP, ci) * wc.g; wRough = 0.9; }
  else if (wk > 2.5 && wk < 3.5) { wMet = 1.0; wRough = 0.3; }
  else if (wk > 3.5) { wMet = 0.55; wRough = 0.12; }
  else { wc *= 0.95 + 0.1 * wh(floor(vOP * 90.0)); }
  diffuseColor.rgb *= wc * (1.0 - 0.7 * wGlow);`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = wRough;')
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = wMet;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += wc * wGlow * uGlowK;');
}
const wearMat = (sway) => { const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0 }); m.userData.sway = sway; m.onBeforeCompile = wearCompile; m.customProgramCacheKey = () => 'wb-wear-2'; return m; };
export const WEAR_MAT = wearMat(null);
// Pelerin salınımı: ek kemik / çizim çağrısı yok — gövde ağı kendi malzeme örneğini alır (aynı program), onBeforeRender'da kökün hızından uSway yazılır
const SWAY_POOL = [];
export function attachCapeSway(root, torso) {
  const mesh = torso.children.find((o) => o.isMesh && o.material === WEAR_MAT);
  if (!mesh) return;
  const m = SWAY_POOL.pop() || wearMat({ value: new THREE.Vector4() });
  m.userData.sway.value.set(0, 0, 0, 0);
  mesh.material = m; root.userData.swayMat = m;
  const st = { t: 0, x: 0, z: 0, vx: 0, vz: 0, sx: 0, sy: 0 }, V = m.userData.sway.value;
  mesh.onBeforeRender = () => {
    const now = performance.now(), dt = Math.min(0.1, (now - st.t) / 1000);
    if (dt < 0.004) return;
    const e = root.matrixWorld.elements, x = e[12], z = e[14];
    if (st.t) { const k = Math.min(1, dt * 8); st.vx += ((x - st.x) / dt - st.vx) * k; st.vz += ((z - st.z) / dt - st.vz) * k; }
    st.t = now; st.x = x; st.z = z;
    const ry = root.rotation.y, f = -(st.vx * Math.sin(ry) + st.vz * Math.cos(ry)), r = st.vx * Math.cos(ry) - st.vz * Math.sin(ry), sp = Math.hypot(st.vx, st.vz);
    const tx = Math.max(-0.04, Math.min(0.13, f * 0.016)), ty = Math.max(-0.05, Math.min(0.05, -r * 0.008)), k2 = Math.min(1, dt * 6);
    st.sx += (tx - st.sx) * k2; st.sy += (ty - st.sy) * k2;
    V.set(st.sx, st.sy, now / 1000, Math.min(1, sp / 5));
    m.uniformsNeedUpdate = true;
  };
}
export function releaseCapeSway(root) { const m = root.userData.swayMat; if (m) { root.userData.swayMat = null; SWAY_POOL.push(m); } }

// ── Yardımcılar: işaretli parça (köşe rengine ofset) + pahlı kutu ──
const G = 2, CM = 4, MET = 6, GL = 8;
const tag = (m, off) => { m.userData.vcOff = off; return m; };
// kamuflaj parçası: renk = (indeks / 16, gölge, 0) + 4
function camoColor(id, shade = 1) { const i = CAMO_IDS.indexOf(id); return new THREE.Color(i / 16, shade, 0); }
const RAW = new Map();
function rawMat(k) {                 // renk doğrusal uzayda olduğu gibi (sRGB çevrimi yok: kamuflaj indeksi bozulmasın)
  const key = k.r.toFixed(4) + ',' + k.g.toFixed(4);
  let m = RAW.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.82, metalness: 0 }); m.color.setRGB(k.r, k.g, k.b, THREE.LinearSRGBColorSpace); RAW.set(key, m); }
  return m;
}
const dk = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

// Pahlı kutu: sekizgen kesit (dikey kenarlar pahlı) + üst / alt kenar pahı; top / bot = [x, z] ölçeği (konik). ~60 üçgen.
const BEV_CACHE = new Map();
function bevGeo(w, h, d, c, top, bot) {
  const lite = c < 0.035, key = [w, h, d, c, ...top, ...bot].join(',');      // lite: yalnız dikey kenarlar pahlı (28 üçgen); c ≥ 3,5 cm: üst / alt kenar da (60)
  if (BEV_CACHE.has(key)) return BEV_CACHE.get(key).clone();
  c = Math.min(c, w * 0.3, d * 0.3, h * 0.3);
  const ring = (y, ww, dd, cc, s) => {
    const x = ww / 2 * s[0], z = dd / 2 * s[1], cx = cc * s[0], cz = cc * s[1];
    return [[-x + cx, y, -z], [x - cx, y, -z], [x, y, -z + cz], [x, y, z - cz], [x - cx, y, z], [-x + cx, y, z], [-x, y, z - cz], [-x, y, -z + cz]];
  };
  const R = lite ? [ring(-h / 2, w, d, c, bot), ring(h / 2, w, d, c, top)] : [ring(-h / 2, w - 2 * c, d - 2 * c, c * 0.6, bot), ring(-h / 2 + c, w, d, c, bot), ring(h / 2 - c, w, d, c, top), ring(h / 2, w - 2 * c, d - 2 * c, c * 0.6, top)];
  const P = [];
  const tri = (a, b, cc) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), C3 = new THREE.Vector3(...cc);
    const n = B.clone().sub(A).cross(C3.clone().sub(A)), m = A.clone().add(B).add(C3);
    if (n.dot(m) < 0) P.push(...a, ...cc, ...b); else P.push(...a, ...b, ...cc);
  };
  for (let r = 0; r < R.length - 1; r++) for (let k = 0; k < 8; k++) { const k2 = (k + 1) % 8; tri(R[r][k], R[r][k2], R[r + 1][k2]); tri(R[r][k], R[r + 1][k2], R[r + 1][k]); }
  for (const r of [0, R.length - 1]) for (let k = 1; k < 7; k++) tri(R[r][0], R[r][k], R[r][k + 1]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
  BEV_CACHE.set(key, g);
  return g.clone();
}
// Üçgen bütçesi: küçük parçalar (en uzun kenar < 15 cm) düz kutu (12 üçgen) — pah yalnız silüeti taşıyan hacimlerde
function bev(p, size, color, pos = [0, 0, 0], rot = [0, 0, 0], c = 0.025, top = [1, 1], bot = [1, 1]) {
  if (Math.max(size[0], size[1], size[2]) < 0.15) return box(p, size, color, pos, rot);
  const m = new THREE.Mesh(bevGeo(size[0], size[1], size[2], c, top, bot), mat(color));
  m.position.set(...pos); m.rotation.set(...rot); m.castShadow = m.receiveShadow = true; p.add(m); return m;
}
// Kumaş rengi: palet "fab" { col, camo } → kamuflajlıysa işaretli parça
function fab(p, F, kind, size, pos, rot, c, top, bot, shade = 1) {
  if (F.camo) {
    const m = kind === 'box' ? box(p, size, '#808080', pos, rot) : bev(p, size, '#808080', pos, rot, c, top, bot);
    m.userData.vcColor = camoColor(F.camo, shade); return tag(m, CM);
  }
  const col = shade === 1 ? F.col : dk(F.col, shade);
  const m = kind === 'box' ? box(p, size, col, pos, rot) : bev(p, size, col, pos, rot, c, top, bot);
  if (F.metal) tag(m, MET);
  return m;
}
const glowBox = (p, size, col, pos, rot) => tag(box(p, size, col, pos, rot), G);
const glass = (p, size, col, pos, rot) => tag(box(p, size, col, pos, rot), GL);

// ── Paletler (renk / desen). Kumaş yuvaları: main (ana kumaş), sec (ikinci kumaş / dolgu), dark (kayış, cep, taban), metal ──
// 'team' = takım tonları (Standart). Altın: ana yüzeyler metal. Gece: koyu grafit (ışıklı setle uyumlu).
export const PALETTES = {
  std: { name: 'Standart', sw: '#3a4656' },
  desert: { name: 'Çöl', sw: '#a8895c', main: { col: '#a8895c', camo: 'desert' }, sec: { col: '#b89a6a' }, dark: '#5a4a34', boot: '#6b5640' },
  wood: { name: 'Orman', sw: '#56603a', main: { col: '#56603a', camo: 'wood' }, sec: { col: '#4b5233' }, dark: '#2b2d24', boot: '#3a2e22' },
  urban: { name: 'Şehir', sw: '#7d8187', main: { col: '#7d8187', camo: 'urban' }, sec: { col: '#4f5359' }, dark: '#26282c', boot: '#1e1f22' },
  snow: { name: 'Kar', sw: '#e4e6e8', main: { col: '#e4e6e8', camo: 'snow' }, sec: { col: '#cfd3d7' }, dark: '#5d636a', boot: '#3b3f45' },
  gold: { name: 'Altın', sw: '#d9a93c', main: { col: '#d9a93c', metal: true }, sec: { col: '#1d1d20' }, dark: '#141416', boot: '#141416' },
  night: { name: 'Gece', sw: '#22252b', main: { col: '#24272d' }, sec: { col: '#1a1c20' }, dark: '#121316', boot: '#111214' },
};
export const NEON = { blue: '#39b6ff', red: '#ff3d2e', ffa: '#e8ecf0' };

const GLOW_ITEMS = new Set(GLOW_LIST);

// ── Gövde oranları ──
export const BODY = {
  A: { torsoY: 1.17, headY: 0.47, headS: [0.27, 0.29, 0.28], shX: 0.3, shY: 0.22, chest: [0.44, 0.34, 0.25], waist: [0.38, 0.24, 0.22], hipX: 0.105, hipY: 0.88, thigh: [0.17, 0.46, 0.2], shin: [0.15, 0.43, 0.175], knee: 0.45, ankle: 0.37, l1: 0.32, l2: 0.3, arm: 0.13, fore: 0.118 },
  B: { torsoY: 1.21, headY: 0.45, headS: [0.245, 0.265, 0.255], shX: 0.345, shY: 0.225, chest: [0.56, 0.35, 0.28], waist: [0.34, 0.22, 0.2], hipX: 0.1, hipY: 0.92, thigh: [0.16, 0.48, 0.19], shin: [0.135, 0.45, 0.16], knee: 0.47, ankle: 0.39, l1: 0.33, l2: 0.31, arm: 0.142, fore: 0.118 },
};

// palet + takım → yuva renkleri
function colors(team, c, palId) {
  const P = PALETTES[palId] || PALETTES.std, neon = NEON[team] || NEON.ffa;
  if (!P.main) return { main: { col: c.vest }, pants: { col: c.pants }, helm: { col: c.helmet }, sec: { col: team === 'red' ? '#4a4434' : '#3f4535' }, dark: '#1b1c20', boot: c.boots, neon, pal: 'std' };
  return { main: P.main, pants: P.main, helm: P.main, sec: P.sec, dark: P.dark, boot: P.boot, neon, pal: palId };
}

function face(head, skin, S, o = {}) {
  const [w, h, d] = S, fz = -d / 2, dark = dk(skin, 0.82), hair = o.hair || '#3a2a1c';
  bev(head, S, skin, [0, 0, 0], [0, 0, 0], 0.04, [1, 1], [0.9, 0.92]);
  bev(head, [0.045, 0.06, 0.04], dark, [0, -0.02, fz - 0.008], [0, 0, 0], 0.012, [0.8, 0.8], [1, 1]);   // burun
  for (const sx of [-1, 1]) {
    box(head, [0.024, 0.07, 0.045], dark, [sx * (w / 2 + 0.008), -0.012, 0.005]);                    // kulak
    box(head, [0.05, 0.032, 0.012], '#f0ece4', [sx * 0.064, 0.022, fz - 0.002]);                       // göz akı
    box(head, [0.026, 0.032, 0.014], '#1a1a1e', [sx * 0.07, 0.022, fz - 0.004]);                       // göz bebeği
    box(head, [0.066, 0.016, 0.014], hair, [sx * 0.066, 0.058, fz - 0.003], [0, 0, sx * -0.08]);       // kaş
  }
  box(head, [0.07, 0.014, 0.012], '#8a4a3c', [0, -0.078, fz - 0.002]);                                   // ağız
  box(head, [w * 0.62, 0.05, 0.02], dark, [0, -h / 2 + 0.03, fz + 0.012]);                              // çene gölgesi
  if (!o.noHair) {
    bev(head, [w + 0.012, 0.07, d + 0.012], hair, [0, h / 2 - 0.02, 0.006], [0, 0, 0], 0.025, [0.9, 0.9], [1, 1]);
    box(head, [w + 0.012, 0.15, 0.05], hair, [0, 0.06, d / 2 - 0.012]);
    for (const sx of [-1, 1]) box(head, [0.02, 0.07, 0.07], hair, [sx * (w / 2 + 0.004), 0.08, 0.03]);  // favori
  }
}

// ── Kafa parçaları (baş grubu yerelinde; baş merkezi 0, üst = S[1]/2) ──
function headItem(id, head, K, team, c, S, skin, cls) {
  const [w, h, d] = S, top = h / 2, fz = -d / 2, A = c.accent, D = K.dark;
  const noHair = id !== 'cap' && id !== 'beanie';
  face(head, skin, S, { noHair: id === 'helmet' || id === 'neonhelm' || id === 'heavyhelm' || id === 'hood' || id === 'gasmask' });
  if (id === 'helmet' || id === 'neonhelm') {
    fab(head, K.helm, 'bev', [w + 0.065, 0.17, d + 0.07], [0, top - 0.035, 0.008], [0, 0, 0], 0.045, [0.78, 0.82], [1, 1]);
    box(head, [w + 0.07, 0.028, d + 0.075], D, [0, top - 0.115, 0.008]);                         // kenar
    box(head, [0.07, 0.022, d * 0.8], A, [0, top + 0.05, 0.02]);                                    // takım şeridi (kubbe)
    box(head, [0.07, 0.07, 0.02], A, [0, top - 0.005, d / 2 + 0.035], [0.2, 0, 0]);
    for (const sx of [-1, 1]) {
      box(head, [0.03, 0.04, 0.16], D, [sx * (w / 2 + 0.035), top - 0.06, 0.0]);                 // yan ray
      bev(head, [0.05, 0.09, 0.09], D, [sx * (w / 2 + 0.035), -0.02, 0.01], [0, 0, 0], 0.018);   // kulaklık
      box(head, [0.016, 0.12, 0.016], D, [sx * (w / 2 + 0.01), -0.09, -0.06]);                    // çene kayışı
    }
    box(head, [0.07, 0.05, 0.04], D, [0, top - 0.02, fz - 0.04]);                                   // gece görüş tutucu
    if (id === 'neonhelm') {
      glass(head, [w - 0.02, 0.06, 0.02], '#0b1420', [0, 0.03, fz - 0.03]);                         // vizör camı
      glowBox(head, [w + 0.02, 0.012, 0.012], K.neon, [0, 0.062, fz - 0.042]);
      glowBox(head, [w + 0.02, 0.012, 0.012], K.neon, [0, -0.002, fz - 0.042]);
      for (const sx of [-1, 1]) glowBox(head, [0.012, 0.07, 0.012], K.neon, [sx * (w / 2 + 0.002), 0.03, fz - 0.042]);
      glowBox(head, [0.074, 0.014, d * 0.6], K.neon, [0, top + 0.062, 0.02]);
    }
  } else if (id === 'heavyhelm') {
    fab(head, K.helm, 'bev', [w + 0.08, 0.2, d + 0.08], [0, top - 0.045, 0.01], [0, 0, 0], 0.05, [0.82, 0.85], [1, 1]);
    glass(head, [w + 0.04, 0.085, 0.03], '#0c141b', [0, 0.02, fz - 0.035]);
    bev(head, [w + 0.03, 0.1, 0.06], D, [0, -0.1, fz - 0.01], [0, 0, 0], 0.02, [1, 1], [0.75, 0.8]);   // çene siperi
    box(head, [0.08, 0.028, 0.012], A, [0, top + 0.02, fz - 0.03]);
    box(head, [0.07, 0.022, d * 0.8], A, [0, top + 0.058, 0.02]);
    for (const sx of [-1, 1]) bev(head, [0.06, 0.11, 0.12], D, [sx * (w / 2 + 0.04), -0.01, 0.02], [0, 0, 0], 0.02);
  } else if (id === 'beanie') {
    fab(head, K.helm, 'bev', [w + 0.025, 0.11, d + 0.025], [0, top + 0.01, 0.005], [0, 0, 0], 0.035, [0.82, 0.82], [1, 1]);
    fab(head, K.helm, 'box', [w + 0.035, 0.045, d + 0.035], [0, top - 0.055, 0.005], null, 0, 0, 0, 0.8);    // kıvrık bant
    box(head, [0.06, 0.03, 0.008], A, [0.06, top - 0.055, fz - 0.022]);                                    // takım etiketi
    box(head, [0.07, 0.022, 0.07], A, [0, top + 0.07, 0.005]);                                              // takım ponponu
  } else if (id === 'cap') {
    fab(head, K.helm, 'bev', [w + 0.02, 0.085, d + 0.02], [0, top + 0.0, 0.005], [0, 0, 0], 0.035, [0.86, 0.86], [1, 1]);
    fab(head, K.helm, 'box', [w * 0.82, 0.016, 0.12], [0, top - 0.035, fz - 0.05], [0.12, 0, 0], 0, 0, 0, 0.82);   // siperlik
    box(head, [0.08, 0.04, 0.008], A, [0, top - 0.0, fz - 0.013]);                                          // takım yaması
    for (const sx of [-1, 1]) bev(head, [0.05, 0.085, 0.085], D, [sx * (w / 2 + 0.025), -0.015, 0.01], [0, 0, 0], 0.016);   // kulaklık
    box(head, [w + 0.06, 0.018, 0.03], D, [0, top - 0.02, 0.01]);                                          // kafa bandı
  } else if (id === 'hood') {
    fab(head, K.helm, 'bev', [w + 0.07, 0.1, d + 0.06], [0, top + 0.0, 0.02], [0, 0, 0], 0.04, [0.8, 0.8], [1, 1]);
    for (const sx of [-1, 1]) fab(head, K.helm, 'box', [0.035, h * 0.92, d + 0.02], [sx * (w / 2 + 0.022), -0.015, 0.03]);
    fab(head, K.helm, 'box', [w + 0.07, h * 0.92, 0.04], [0, -0.015, d / 2 + 0.035]);
    fab(head, K.helm, 'box', [w * 0.9, 0.035, 0.05], [0, top - 0.04, fz - 0.005], [-0.25, 0, 0], 0, 0, 0, 0.82);   // ön kenar
    fab(head, K.sec, 'box', [w * 0.86, 0.11, 0.03], [0, -0.075, fz - 0.006]);                              // yüz örtüsü (şemah)
    box(head, [0.06, 0.06, 0.006], A, [0, top - 0.005, d / 2 + 0.058]);                                    // takım yaması (arka)
  } else if (id === 'gasmask') {
    fab(head, K.helm, 'bev', [w + 0.03, h + 0.02, d + 0.03], [0, 0.0, 0.005], [0, 0, 0], 0.04, [0.88, 0.88], [0.9, 0.92]);   // kar maskesi (balaklava)
    bev(head, [w + 0.0, 0.23, 0.07], '#2a2c30', [0, -0.02, fz - 0.03], [0, 0, 0], 0.03, [1, 1], [0.66, 0.8]);              // maske gövdesi
    for (const sx of [-1, 1]) {
      glass(head, [0.075, 0.065, 0.012], '#1d3242', [sx * 0.058, 0.03, fz - 0.07]);
      box(head, [0.092, 0.082, 0.01], '#101114', [sx * 0.058, 0.03, fz - 0.064]);
      box(head, [0.02, 0.04, d * 0.8], D, [sx * (w / 2 + 0.012), 0.03, 0.03]);                              // kayış
    }
    cylY(head, 0.05, 0.055, 0.07, '#3a3d42', [0, -0.09, fz - 0.09], 8, [Math.PI / 2, 0, 0]);               // filtre
    box(head, [0.11, 0.016, 0.012], A, [0, -0.09, fz - 0.128]);                                               // takım şeridi (filtre)
    box(head, [0.07, 0.022, d * 0.8], A, [0, top + 0.037, 0.02]);
  }
  void noHair; void cls;
}

// ── Üst parçaları (gövde yerelinde) ──
function topItem(id, torso, K, team, c, B, cls) {
  const [cw, ch, cd] = B.chest, fz = -cd / 2, bz = cd / 2, A = c.accent, D = K.dark;
  const plate = (w, h, dz, y, z) => fab(torso, K.main, 'bev', [w, h, dz], [0, y, z], [0, 0, 0], 0.02);
  if (id === 'carrier' || id === 'neonvest') {
    plate(cw - 0.05, 0.36, 0.05, 0.06, fz - 0.015);
    plate(cw - 0.05, 0.38, 0.05, 0.06, bz + 0.015);
    fab(torso, K.main, 'bev', [cw + 0.03, 0.14, cd + 0.06], [0, -0.08, 0], [0, 0, 0], 0.03, [1, 1], [0.96, 0.96], 0.88);   // bel bandı
    for (const sx of [-1, 1]) fab(torso, K.main, 'box', [0.085, 0.05, cd + 0.08], [sx * 0.12, 0.27, 0], null, 0, 0, 0, 0.9);  // omuz askısı
    for (let i = 0; i < 3; i++) box(torso, [cw - 0.08, 0.01, 0.012], D, [0, 0.19 - i * 0.055, fz - 0.044]);              // MOLLE
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.105;
      fab(torso, K.sec, 'bev', [0.085, 0.12, 0.05], [x, -0.05, fz - 0.06], [0, 0, 0], 0.012);                             // şarjör cebi
      box(torso, [0.088, 0.025, 0.054], D, [x, 0.005, fz - 0.06]);
    }
    box(torso, [0.11, 0.05, 0.008], A, [-0.1, 0.2, fz - 0.046]);                                                           // göğüs takım yaması
    box(torso, [0.18, 0.09, 0.008], A, [0, 0.14, bz + 0.045]);                                                            // sırt takım yaması
    box(torso, [0.05, 0.1, 0.035], D, [0.17, 0.17, fz - 0.05]);                                                            // telsiz
    box(torso, [0.008, 0.12, 0.008], D, [0.17, 0.28, fz - 0.05]);
    if (id === 'neonvest') {
      const y0 = 0.06, hw = (cw - 0.05) / 2, hh = 0.18, z = fz - 0.043;
      glowBox(torso, [cw - 0.04, 0.012, 0.01], K.neon, [0, y0 + hh, z]); glowBox(torso, [cw - 0.04, 0.012, 0.01], K.neon, [0, y0 - hh, z]);
      for (const sx of [-1, 1]) glowBox(torso, [0.012, 0.36, 0.01], K.neon, [sx * hw, y0, z]);
      glowBox(torso, [cw + 0.04, 0.014, 0.014], K.neon, [0, -0.08, fz - 0.024]);
      glowBox(torso, [0.014, 0.36, 0.01], K.neon, [0, y0, bz + 0.043]);
      for (const sx of [-1, 1]) glowBox(torso, [0.012, 0.012, cd + 0.085], K.neon, [sx * 0.12, 0.297, 0]);
    }
  } else if (id === 'kevlar') {
    plate(cw + 0.0, 0.4, 0.07, 0.05, fz - 0.025);
    plate(cw + 0.0, 0.42, 0.07, 0.05, bz + 0.025);
    fab(torso, K.main, 'bev', [cw + 0.06, 0.16, cd + 0.1], [0, -0.1, 0], [0, 0, 0], 0.03, [1, 1], [0.96, 0.96], 0.85);
    fab(torso, K.main, 'bev', [0.26, 0.08, cd + 0.08], [0, 0.29, 0], [0, 0, 0], 0.025, [0.9, 0.9], [1, 1], 0.85);       // yaka / boğaz koruması
    fab(torso, K.main, 'bev', [0.18, 0.12, 0.04], [0, -0.24, fz - 0.03], [0.1, 0, 0], 0.015, [1, 1], [0.8, 1], 0.8);    // kasık plakası
    for (const sx of [-1, 1]) {
      fab(torso, K.main, 'bev', [0.2, 0.08, 0.24], [sx * (B.shX + 0.01), B.shY + 0.075, 0], [0, 0, sx * -0.2], 0.025, [0.9, 0.9], [1, 1], 0.9);   // omuzluk
      box(torso, [0.16, 0.025, 0.2], A, [sx * (B.shX + 0.02), B.shY + 0.115, 0], [0, 0, sx * -0.2]);                     // omuzluk takım şeridi
    }
    box(torso, [0.22, 0.05, 0.075], D, [0, -0.07, fz - 0.045]);
    box(torso, [0.14, 0.06, 0.008], A, [0, 0.15, fz - 0.062]);
    box(torso, [0.2, 0.1, 0.008], A, [0, 0.14, bz + 0.062]);
    for (let i = 0; i < 4; i++) box(torso, [0.022, 0.022, 0.01], '#6b6f75', [(i - 1.5) * 0.11, 0.24, fz - 0.062]);         // perçin
  } else if (id === 'rig') {
    fab(torso, K.main, 'bev', [cw - 0.08, 0.15, 0.06], [0, 0.0, fz - 0.025], [0, 0, 0], 0.018);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.1;
      fab(torso, K.sec, 'bev', [0.08, 0.1, 0.045], [x, 0.0, fz - 0.07], [0, 0, 0], 0.012);
      box(torso, [0.082, 0.022, 0.05], D, [x, 0.045, fz - 0.07]);
    }
    for (const sx of [-1, 1]) {
      box(torso, [0.06, 0.012, cd + 0.05], D, [sx * 0.12, 0.27, 0]);
      box(torso, [0.06, 0.26, 0.012], D, [sx * 0.12, 0.13, fz - 0.008]);
      box(torso, [0.05, 0.3, 0.012], D, [sx * 0.08, 0.1, bz + 0.008], [0, 0, sx * 0.45]);                                   // sırtta X askı
    }
    box(torso, [cw + 0.02, 0.035, cd + 0.03], D, [0, -0.08, 0]);
    box(torso, [0.1, 0.045, 0.008], A, [0.12, 0.2, fz - 0.012]);
    box(torso, [0.16, 0.08, 0.008], A, [0, 0.0, bz + 0.016]);
  } else if (id === 'jacket') {
    fab(torso, K.main, 'bev', [cw + 0.03, 0.54, cd + 0.03], [0, -0.01, 0], [0, 0, 0], 0.035, [1, 1], [0.9, 0.92]);
    fab(torso, K.main, 'bev', [0.24, 0.08, 0.2], [0, 0.29, 0.01], [0, 0, 0], 0.02, [1.05, 1.05], [1, 1], 0.85);         // dik yaka
    box(torso, [0.014, 0.5, 0.01], D, [0, -0.01, fz - 0.016]);                                                          // fermuar
    for (const sx of [-1, 1]) {
      fab(torso, K.main, 'box', [0.12, 0.1, 0.014], [sx * 0.12, 0.13, fz - 0.018], null, 0, 0, 0, 0.82);              // göğüs cebi
      box(torso, [0.12, 0.018, 0.016], D, [sx * 0.12, 0.18, fz - 0.019]);
      fab(torso, K.main, 'box', [0.012, 0.16, 0.12], [sx * (cw / 2 + 0.017), -0.15, -0.02], null, 0, 0, 0, 0.82);      // yan cep
      box(torso, [0.17, 0.06, 0.2], A, [sx * B.shX, B.shY + 0.05, 0]);                                               // takım rengi omuz boyunduruğu
    }
    fab(torso, K.main, 'box', [cw + 0.035, 0.05, cd + 0.035], [0, -0.26, 0], null, 0, 0, 0, 0.78);                    // etek bandı
    box(torso, [0.2, 0.1, 0.008], A, [0, 0.12, bz + 0.018]);
    box(torso, [0.1, 0.04, 0.008], c.cls === 'engineer' ? '#e0762b' : A, [0, -0.2, fz - 0.018]);
  }
  // sınıf işaretleri (kıyafetten bağımsız, küçük)
  if (cls === 'medic') for (const [w, h] of [[0.08, 0.025], [0.025, 0.08]]) box(torso, [w, h, 0.008], '#d23a2e', [0.12, 0.2, fz - 0.07]);
  if (cls === 'engineer') box(torso, [cw + 0.04, 0.035, cd + 0.09], '#e0762b', [0, 0.04, 0]);
}

// ── Sırt parçaları ──
function backItem(id, torso, K, team, c, B, cls) {
  const [cw, , cd] = B.chest, bz = cd / 2 + 0.04, A = c.accent, D = K.dark;
  if (id === 'pack') {
    const col = cls === 'medic' ? { col: '#e8e8e2' } : K.sec;
    fab(torso, col, 'bev', [0.32, 0.36, 0.15], [0, 0.0, bz + 0.075], [0, 0, 0], 0.035, [0.92, 0.9], [1, 1]);
    fab(torso, col, 'bev', [0.33, 0.07, 0.16], [0, 0.18, bz + 0.072], [0, 0, 0], 0.02, [1, 1], [1, 1], 0.85);
    fab(torso, col, 'bev', [0.24, 0.18, 0.04], [0, -0.05, bz + 0.165], [0, 0, 0], 0.012, [1, 1], [1, 1], 0.88);
    for (const sx of [-1, 1]) fab(torso, col, 'bev', [0.05, 0.2, 0.1], [sx * 0.19, -0.04, bz + 0.07], [0, 0, 0], 0.012, [1, 1], [1, 1], 0.85);
    for (let i = 0; i < 2; i++) box(torso, [0.26, 0.012, 0.012], D, [0, 0.1 - i * 0.12, bz + 0.188]);
    cylY(torso, 0.055, 0.055, 0.3, dk(K.sec.col || '#555', 0.7), [0, 0.25, bz + 0.07], 8, [0, 0, Math.PI / 2]);   // uyku tulumu
    if (cls === 'medic') for (const [w, h] of [[0.12, 0.035], [0.035, 0.12]]) box(torso, [w, h, 0.01], '#d23a2e', [0, -0.05, bz + 0.19]);
    else box(torso, [0.1, 0.05, 0.008], A, [0, -0.05, bz + 0.19]);
  } else if (id === 'radio') {
    bev(torso, [0.22, 0.3, 0.12], '#2d3034', [0, 0.02, bz + 0.06], [0, 0, 0], 0.02);
    bev(torso, [0.2, 0.1, 0.03], '#1c1e21', [0, 0.06, bz + 0.13], [0, 0, 0], 0.01);
    for (let i = 0; i < 3; i++) box(torso, [0.025, 0.025, 0.012], ['#58d68d', '#f0b443', A][i], [-0.05 + i * 0.05, 0.06, bz + 0.15]);
    box(torso, [0.012, 0.6, 0.012], '#1b1c1f', [0.08, 0.42, bz + 0.07], [0.1, 0, -0.05]);                  // anten
    fab(torso, K.sec, 'box', [0.26, 0.05, 0.13], [0, -0.15, bz + 0.06], null, 0, 0, 0, 0.9);
    box(torso, [0.04, 0.07, 0.03], D, [-0.16, 0.2, -cd / 2 - 0.05]);                                        // el telsizi (göğüste)
  } else if (id === 'cape' || id === 'lightcape' || id === 'shortcape') {
    const short = id === 'shortcape';
    const capeF = id === 'lightcape' ? { col: '#1c1e23' } : K.main;
    fab(torso, capeF, 'bev', [cw + 0.08, 0.09, cd + 0.08], [0, 0.27, 0.01], [0, 0, 0], 0.035, [0.86, 0.86], [1, 1], 0.9);   // omuz örtüsü
    for (const sx of [-1, 1]) fab(torso, capeF, 'bev', [0.17, 0.07, 0.22], [sx * (B.shX + 0.005), B.shY + 0.075, 0.01], [0, 0, sx * -0.28], 0.02, [1, 1], [1, 1], 0.9);
    // kumaş: 5 dikey şerit (kıvrım) — ortadaki geride, kenarlar öne / dışa döner; etek boyu şerit başına farklı (yırtık / dalgalı kenar)
    const rx = short ? 0.12 : 0.15, N = 5, Wt = cw + (short ? 0.16 : 0.1), sw = Wt / N, zAt = (yy) => bz + 0.02 + Math.sin(rx) * (0.25 - yy);
    const len = short ? [0.4, 0.46, 0.5, 0.46, 0.4] : [0.8, 0.86, 0.9, 0.84, 0.78];
    for (let i = 0; i < N; i++) {
      const u = i - (N - 1) / 2, Li = len[i], yy = 0.25 - Li / 2, flare = short ? 1.0 : 1.12;
      fab(torso, capeF, 'bev', [sw + 0.035, Li, 0.026], [u * sw * flare, yy, zAt(yy) + (i % 2 ? 0.01 : 0) - Math.abs(u) * 0.006], [rx, u * -0.07, u * -0.025], 0.01, [0.94, 1], [flare, 1], i % 2 ? 0.9 : 1);
    }
    fab(torso, capeF, 'box', [Wt * 0.7, 0.05, 0.03], [0, 0.2, zAt(0.2) + 0.012], [rx, 0, 0], 0, 0, 0, 0.8);    // yaka dikişi
    box(torso, [0.16, 0.1, 0.008], A, [0, 0.11, zAt(0.11) + 0.03], [rx, 0, 0]);                              // sırt takım yaması

    if (id === 'lightcape') {
      for (const i of [0, 2, 4]) { const u = i - 2, Li = len[i] - 0.1, yy = 0.25 - Li / 2 - 0.03; glowBox(torso, [0.014, Li, 0.01], K.neon, [u * sw * 1.12, yy, zAt(yy) + 0.028 - Math.abs(u) * 0.006], [rx, u * -0.07, u * -0.025]); }
      glowBox(torso, [Wt * 0.72, 0.016, 0.012], K.neon, [0, 0.175, zAt(0.175) + 0.03], [rx, 0, 0]);

    }
  }
}

// ── Bacaklar (thigh = kalça grubu, knee = diz grubu, foot = bilek) ──
function legItem(id, leg, s, K, team, c, B) {
  const sx = s === 'R' ? 1 : -1, [tw, th, td] = B.thigh, [sw, shh, sd] = B.shin, D = K.dark, A = c.accent;
  const bag = id === 'cargo' ? 1.07 : id === 'slim' || id === 'neonlegs' ? 0.94 : 1;
  fab(leg.thigh, K.pants, 'bev', [tw * bag, th, td * bag], [0, -th / 2 + 0.01, 0], [0, 0, 0], 0.03, [1.04, 1], [0.88, 0.9]);
  fab(leg.knee, K.pants, 'bev', [sw * bag, shh, sd * bag], [0, -shh / 2 + 0.015, 0], [0, 0, 0], 0.028, [1, 1], [0.86, 0.88]);
  if (id === 'tactical') {
    bev(leg.knee, [sw + 0.01, 0.11, 0.06], D, [0, -0.04, -sd / 2 - 0.01], [0, 0, 0], 0.02);                           // dizlik
    box(leg.knee, [sw * 0.7, 0.02, 0.008], A, [0, -0.04, -sd / 2 - 0.042]);
    if (s === 'L') { fab(leg.thigh, K.pants, 'box', [0.04, 0.14, 0.13], [-tw / 2 - 0.01, -0.2, 0], null, 0, 0, 0, 0.85); box(leg.thigh, [0.044, 0.03, 0.134], D, [-tw / 2 - 0.01, -0.13, 0]); }
    else { bev(leg.thigh, [0.06, 0.15, 0.11], '#1a1b1e', [tw / 2 + 0.02, -0.2, -0.01], [0, 0, 0], 0.015); box(leg.thigh, [0.04, 0.05, 0.1], '#2b2c30', [tw / 2 + 0.02, -0.11, -0.01]); }   // tabanca kılıfı
    box(leg.thigh, [tw * 1.04, 0.022, td * 1.02], D, [0, -0.06, 0]);
  } else if (id === 'cargo') {
    fab(leg.thigh, K.pants, 'bev', [0.05, 0.15, 0.13], [sx * (tw * bag / 2 + 0.018), -0.22, 0], [0, 0, 0], 0.015, [1, 1], [1, 1], 0.86);
    fab(leg.thigh, K.pants, 'box', [0.054, 0.035, 0.134], [sx * (tw * bag / 2 + 0.018), -0.15, 0], null, 0, 0, 0, 0.75);
    fab(leg.knee, K.pants, 'box', [sw * bag + 0.012, 0.05, sd * bag + 0.012], [0, -shh + 0.06, 0], null, 0, 0, 0, 0.8);   // kıvrık paça
    box(leg.knee, [0.012, 0.06, 0.06], A, [sx * (sw * bag / 2 + 0.007), -0.1, 0]);                                     // takım şeridi (baldır)
  } else if (id === 'slim' || id === 'neonlegs') {
    box(leg.knee, [sw * 0.9, 0.05, sd * 0.9], D, [0, -shh + 0.045, 0]);                                                // manşet
    box(leg.thigh, [0.008, th * 0.8, 0.012], dk(id === 'neonlegs' ? '#202226' : (K.pants.col || '#444'), 0.7), [sx * (tw * bag / 2 + 0.003), -th / 2, 0]);   // dikiş
    if (id === 'neonlegs') {
      glowBox(leg.thigh, [0.012, th * 0.78, 0.016], K.neon, [sx * (tw * bag / 2 + 0.006), -th / 2 + 0.01, 0]);
      glowBox(leg.knee, [0.012, shh * 0.7, 0.016], K.neon, [sx * (sw * bag / 2 + 0.006), -shh / 2 + 0.01, 0]);
    }
  }
}
function footItem(id, ft, s, K, team, c) {
  const D = K.dark, boot = K.boot;
  if (id === 'sneakers' || id === 'glowsole') {
    const up = id === 'glowsole' ? '#1d1f24' : (K.pal === 'std' ? '#e9e7e1' : (K.sec.col || '#ddd'));
    bev(ft, [0.165, 0.1, 0.19], up, [0, 0.0, 0.0], [0, 0, 0], 0.025, [0.9, 0.9], [1, 1]);
    bev(ft, [0.165, 0.07, 0.29], up, [0, -0.03, -0.045], [0, 0, 0], 0.025, [0.92, 0.85], [1, 1]);
    box(ft, [0.175, 0.035, 0.315], id === 'glowsole' ? '#15161a' : '#f4f3ee', [0, -0.065, -0.045]);
    box(ft, [0.06, 0.04, 0.12], c.accent, [s === 'R' ? 0.084 : -0.084, -0.02, -0.04]);                               // takım rengi yan şerit
    for (let i = 0; i < 3; i++) box(ft, [0.07, 0.008, 0.012], id === 'glowsole' ? '#3a3d44' : '#cfd0d2', [0, 0.012, -0.08 - i * 0.028]);
    if (id === 'glowsole') { glowBox(ft, [0.18, 0.014, 0.32], K.neon, [0, -0.052, -0.045]); glowBox(ft, [0.012, 0.03, 0.06], K.neon, [0, 0.02, 0.098]); }
    return;
  }
  const hi = id === 'highboots';
  bev(ft, [0.17, 0.12, 0.2], boot, [0, 0, 0], [0, 0, 0], 0.025, [0.94, 0.94], [1, 1]);
  bev(ft, [0.17, 0.075, 0.3], boot, [0, -0.025, -0.045], [0, 0, 0], 0.03, [0.9, 0.85], [1, 1]);
  box(ft, [0.178, 0.03, 0.315], '#101012', [0, -0.065, -0.045]);
  box(ft, [0.07, 0.012, 0.11], '#c9c3b4', [0, 0.012, -0.08]);
  for (let i = 0; i < 3; i++) box(ft, [0.085, 0.006, 0.01], '#101012', [0, 0.02, -0.055 - i * 0.03]);
  if (hi) {
    bev(ft, [0.165, 0.16, 0.18], boot, [0, 0.12, 0.005], [0, 0, 0], 0.02, [1, 1], [1, 1]);
    for (let i = 0; i < 2; i++) box(ft, [0.172, 0.018, 0.186], D, [0, 0.08 + i * 0.07, 0.005]);
  } else box(ft, [0.176, 0.035, 0.206], dk(boot, 1.4), [0, 0.065, 0]);
}

// Eldiven tonu üstün paletinden (3. şahıs + birinci şahıs aynı). Koyu silahta (≈ #2a2c30) kaybolmasın: doğrusal parlaklık 0,035'in altındaysa bir kademe açılır.
const GLOVE = { desert: '#8a7454', wood: '#4d5338', urban: '#55595f', snow: '#c4c9ce', gold: '#7a6330', night: '#34373e' };
const lumL = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
export function gloveTone(col) {
  const k = new THREE.Color(col);
  for (let i = 0; i < 4 && lumL(k) < 0.035; i++) k.lerp(new THREE.Color('#9aa0a8'), 0.18);
  return '#' + k.getHexString();
}
const palOf = (wear, slot) => (typeof wear.pal === 'string' ? wear.pal : wear.pal?.[slot]) || 'std';
export function wearGloves(team, c, wear) { const pl = palOf(wear, 'top'); return gloveTone(GLOVE[pl] || c.gloves); }
// Birinci şahıs kolu (player.js vm.look; el geometrisi aynı): kol = üst parçanın kumaşı (yelek / ceket paleti; Standart'ta takım gömleği),
// eldiven = üst paletinin eldiven tonu (gerekirse açılmış), bilekte manşet (ışıklı üstte takım neonu). Kendi kolun: takım okunurluğu gerekmez.
export function fpWearLook(team, wear) {
  if (!wear) return null;
  const c = TEAMS_FALLBACK(team), pl = palOf(wear, 'top'), P = PALETTES[pl], glow = GLOW_ITEMS.has(wear.top);
  const shirt = glow ? (P?.main ? P.main.col : '#24272d') : P?.main ? P.main.col : wear.top === 'jacket' ? c.vest : c.shirt;
  const o = { shirt, gloves: wearGloves(team, c, wear) };
  if (glow) o.cuff = NEON[team] || NEON.ffa; else if (P?.main) o.cuff = dk(P.main.col, 0.7);
  return o;
}

// ── Kol (gömlek = takım rengi; iki kolda takım bandı) ──
function makeArmW(torso, side, c, B, K, wear) {
  const upper = new THREE.Group(), fore = new THREE.Group(), hand = new THREE.Group(), sx = side === 'R' ? 1 : -1;
  const L1 = B.l1, L2 = B.l2, a = B.arm, f = B.fore;
  bev(upper, [a, L1 + 0.02, a * 1.02], c.shirt, [0, -L1 / 2, 0], [0, 0, 0], 0.025, [1.05, 1.05], [0.88, 0.88]);
  box(upper, [a * 1.08, 0.065, a * 1.1], c.accent, [0, -0.1, 0]);                                    // takım kol bandı (iki kol)
  box(upper, [a * 1.06, 0.03, a * 1.06], dk(c.shirt, 0.75), [0, -L1 + 0.035, 0]);                       // kol kıvrımı
  bev(fore, [f, L2 + 0.01, f * 1.02], c.shirt, [0, -L2 / 2, 0], [0, 0, 0], 0.022, [1, 1], [0.86, 0.86]);
  if (wear.top !== 'jacket') bev(fore, [f * 0.85, 0.09, 0.05], '#1c1d21', [0, -0.03, f / 2 + 0.015], [0, 0, 0], 0.012);   // dirsek koruyucu
  box(fore, [f * 1.08, 0.05, f * 1.08], c.gloves, [0, -L2 + 0.045, 0]);                               // bilek
  if (GLOW_ITEMS.has(wear.top)) glowBox(fore, [f * 1.1, 0.012, f * 1.1], K.neon, [0, -L2 + 0.075, 0]);
  bev(hand, [0.1, 0.11, 0.115], c.gloves, [0, -0.05, 0.0], [0, 0, 0], 0.018);
  box(hand, [0.085, 0.03, 0.04], c.gloves, [0, -0.1, -0.03]);
  for (let i = 0; i < 4; i++) box(hand, [0.02, 0.05, 0.02], c.gloves, [-0.036 + i * 0.024, -0.105, -0.045]);
  box(hand, [0.03, 0.045, 0.026], c.gloves, [-sx * 0.06, -0.07, -0.02], [0, 0, sx * 0.35]);
  box(hand, [0.102, 0.03, 0.117], '#15161a', [0, -0.02, 0.0]);
  torso.add(upper, fore, hand);
  return { upper, fore, hand, side, shoulder: new THREE.Vector3(sx * B.shX, B.shY, 0), l1: L1, l2: L2 };
}

// ── Asker gövdesi + kıyafet. Döner: { torso, head, legs, armR, armL } (character.js aynı hiyerarşiyi bekler) ──
export function buildWear(root, { team, cls, c, skin, wear, style = 'A' }) {
  const B = BODY[style] || BODY.A, base = CLASS_WEAR[cls] || CLASS_WEAR.assault, W = { ...base, ...(wear || {}) };
  const pal = typeof W.pal === 'string' ? Object.fromEntries(WEAR_SLOTS.map((k) => [k, W.pal])) : { ...base.pal, ...(W.pal || {}) };
  const Ks = Object.fromEntries(WEAR_SLOTS.map((k) => [k, colors(team, c, pal[k])])), K = Ks.top;
  c = { ...c, cls, gloves: wearGloves(team, c, { pal }) };                     // eldiven: üst paletinin tonu (birinci şahısla aynı)
  const torso = new THREE.Group(); torso.position.set(0, B.torsoY, 0); root.add(torso);
  // gövde: göğüs (V konik) + karın + leğen (pantolon) + kemer, boyun
  const [cw, chh, cd] = B.chest, [ww, wh, wd] = B.waist;
  bev(torso, [cw, chh, cd], c.shirt, [0, 0.29 - chh / 2, 0], [0, 0, 0], 0.04, [1, 1], [style === 'B' ? 0.7 : 0.9, 0.92]);
  bev(torso, [ww, wh, wd], c.shirt, [0, 0.29 - chh - wh / 2 + 0.02, 0], [0, 0, 0], 0.03, [1, 1], [0.96, 0.96]);
  fab(torso, Ks.legs.pants, 'bev', [ww + 0.02, 0.12, wd + 0.02], [0, -0.33, 0], [0, 0, 0], 0.03, [1, 1], [0.95, 0.95]);
  box(torso, [ww + 0.045, 0.05, wd + 0.04], '#17181b', [0, -0.27, 0]);                                         // kemer
  box(torso, [0.07, 0.045, 0.012], '#9aa0a6', [0, -0.27, -wd / 2 - 0.025]);
  for (const sx of [-1, 1]) {
    bev(torso, [0.17, 0.1, 0.18], c.shirt, [sx * B.shX, B.shY + 0.035, 0], [0, 0, 0], 0.035, [0.86, 0.9], [1, 1]);      // omuz başı
    box(torso, [0.12, 0.022, 0.13], c.accent, [sx * B.shX, B.shY + 0.087, 0]);                                       // omuz takım şeridi
  }
  bev(torso, [0.12, 0.08, 0.12], skin, [0, 0.31, 0], [0, 0, 0], 0.02);                                             // boyun
  bev(torso, [0.2, 0.04, 0.17], dk(c.shirt, 0.8), [0, 0.29, 0], [0, 0, 0], 0.012);                                 // yaka
  const head = new THREE.Group(); head.position.set(0, B.headY, 0); torso.add(head);
  // bacaklar
  const legs = {};
  for (const s of ['L', 'R']) {
    const sign = s === 'R' ? 1 : -1, hip = new THREE.Group(), knee = new THREE.Group(), foot = new THREE.Group();
    hip.position.set(sign * B.hipX, B.hipY, 0); knee.position.set(0, -B.knee, 0); foot.position.set(0, -B.ankle, 0);
    knee.add(foot); hip.add(knee); root.add(hip);
    legs[s] = { hip, knee, foot, thigh: hip };
  }
  legs.L.hip.rotation.x = 0.22; legs.L.knee.rotation.x = -0.18; legs.R.hip.rotation.x = -0.2; legs.R.knee.rotation.x = 0.22;
  headItem(W.head, head, Ks.head, team, c, B.headS, skin, cls);
  topItem(W.top, torso, K, team, c, B, cls);
  const n0 = torso.children.length;
  backItem(W.back, torso, Ks.back, team, c, B, cls);
  const cape = W.back === 'cape' || W.back === 'shortcape' || W.back === 'lightcape';
  if (cape) for (const o of torso.children.slice(n0)) if (o.isMesh && o.position.y < 0.2) o.userData.vcOff = (o.userData.vcOff || 0) + 20;     // pelerin kumaşı (omuz örtüsü hariç) salınır
  for (const s of ['L', 'R']) { legItem(W.legs, legs[s], s, Ks.legs, team, c, B); footItem(W.feet, legs[s].foot, s, Ks.feet, team, c); }
  const armR = makeArmW(torso, 'R', c, B, K, W), armL = makeArmW(torso, 'L', c, B, K, W);
  // kamuflaj parçalarının köşe rengi (mergeVC malzeme rengini okur → işaretli parçaya kendi rengini ver)
  root.traverse((o) => { if (o.isMesh && o.userData.vcColor) o.material = rawMat(o.userData.vcColor); });
  return { torso, head, legs, armR, armL, wear: { ...W, pal }, cape };
}
