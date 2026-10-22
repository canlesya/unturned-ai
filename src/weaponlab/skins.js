import * as THREE from 'three';

// Kaplama (skin) sistemi: TEK gölgelendirici programı (tüm silahlar / kaplamalar aynı program, önbellek anahtarı sabit), kaplama = uniform paleti.
// Yuva rengi + pürüzlülük / metaliklik / kamuflaj maskesi köşe gölgelendiricisinde uniform dizisinden okunur; kamuflaj model uzayı konumundan prosedürel lekeler (doku yok, UV yok).
// Kaplama değiştirmek: setSkin(mat, id) → yalnız uniform yazılır, geometri / program yeniden kurulmaz. Silah başına 1 malzeme örneği (şarjör ağı da aynı örneği kullanır).
const h = (c) => new THREE.Color(c);
// Silah başına "Standart" palet: [gövde, mobilya, metal, aksesuar] (renk, pürüzlülük, metaliklik)
export const STD = {
  ak47: { body: ['#36383c', 0.5, 0.4], furn: ['#7a4426', 0.45, 0], metal: ['#38393c', 0.42, 0.6], acc: ['#1c1d20', 0.6, 0.2] },
  m4a1: { body: ['#35373b', 0.55, 0.3], furn: ['#25272a', 0.7, 0], metal: ['#333437', 0.4, 0.6], acc: ['#18191b', 0.6, 0.2] },
  pistol: { body: ['#36383c', 0.5, 0.35], furn: ['#232427', 0.72, 0], metal: ['#3a3b3f', 0.38, 0.65], acc: ['#151618', 0.6, 0.2] },
  sniper: { body: ['#36383c', 0.5, 0.4], furn: ['#565c45', 0.75, 0], metal: ['#333437', 0.4, 0.6], acc: ['#1e1f22', 0.5, 0.25] },
  shotgun: { body: ['#2a2b2e', 0.5, 0.4], furn: ['#1e1f22', 0.72, 0], metal: ['#38393c', 0.42, 0.6], acc: ['#18191b', 0.6, 0.2] },
};
const LENS = ['#1d3b3a', 0.08, 0.6], GLOW = ['#ff2a1f', 1, 0];
// Kaplamalar: yuva geçersiz kılma + kamuflaj (mode 1 orman lekeleri, 2 şehir dijital piksel) ; cm = kamuflajın uygulandığı yuvalar
export const SKINS = {
  std: { name: 'Standart' },
  desert: { name: 'Çöl', body: ['#a8895c', 0.62, 0.05], furn: ['#b89a6a', 0.7, 0], acc: ['#8e7550', 0.65, 0.05] },
  wood: { name: 'Orman camo', camo: 1, cm: ['body', 'furn'], cc: ['#56603a', '#6e5435', '#23241e', '#8f8a5e'], cs: 24, body: ['#56603a', 0.66, 0.05], furn: ['#56603a', 0.7, 0] },
  urban: { name: 'Şehir camo', camo: 2, cm: ['body', 'furn'], cc: ['#7d8187', '#4f5359', '#26282c', '#b3b6ba'], cs: 19, body: ['#7d8187', 0.6, 0.1], furn: ['#7d8187', 0.65, 0] },
  gold: { name: 'Altın', body: ['#d9a93c', 0.24, 1], furn: ['#c99a30', 0.3, 1], acc: ['#1b1b1d', 0.45, 0.4], metal: ['#2a2a2c', 0.3, 0.8] },
};
export const SKIN_IDS = Object.keys(SKINS);
const ORDER = ['body', 'furn', 'metal', 'acc'];

const VERT_HEAD = /* glsl */ `
attribute vec3 wf; uniform vec3 uCol[6]; uniform vec3 uPBR[6];
varying vec3 vCol; varying vec3 vPBR; varying vec3 vOP; varying vec2 vSP;`;
const VERT_BODY = /* glsl */ `
  { int s = int(wf.x + 0.5); vCol = uCol[s]; vPBR = uPBR[s]; vOP = position; vSP = vec2(wf.y, wf.z + (s == 5 ? 10.0 : 0.0)); }`;
const FRAG_HEAD = /* glsl */ `
uniform int uCamo; uniform vec3 uCC[4]; uniform float uCS;
varying vec3 vCol; varying vec3 vPBR; varying vec3 vOP; varying vec2 vSP;
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec3 camo(vec3 p){                                                                    // keskin kenarlı 4 renkli lekeler; mode 2: önce 7 mm piksellere yuvarlanır (dijital)
  if (uCamo == 2) p = (floor(p * 140.0) + 0.5) / 140.0;
  vec3 q = p * uCS; float a = vn(q) * 0.65 + vn(q * 2.3 + 7.1) * 0.35, b = vn(q * 1.2 + 19.7) * 0.6 + vn(q * 2.9 + 3.3) * 0.4, c = vn(q * 0.8 + 41.0);
  vec3 col = uCC[0];
  if (c < 0.3) col = uCC[3];
  if (a > 0.58) col = uCC[1];
  if (b > 0.64) col = uCC[2];
  return col; }`;
const FRAG_COLOR = /* glsl */ `
  vec3 wcol = vCol; float wsh = vSP.x, wpat = vSP.y, wglow = 0.0, wrough = vPBR.x;
  if (wpat > 9.5) { wglow = 1.0; wpat -= 10.0; }
  if (uCamo > 0 && vPBR.z > 0.5) wcol = camo(vOP);
  wcol *= wsh;
  if (wpat > 0.5 && wpat < 1.5) { float st = h31(floor(vOP * 700.0)); wcol *= 0.78 + 0.34 * st; wrough = min(1.0, wrough + 0.2); }     // benekli kabza (stipple)
  else if (wpat > 1.5) { wcol *= 0.82 + 0.22 * step(0.5, fract(vOP.z * 260.0 + vOP.y * 120.0)); }                                            // tırtıl / oluk
  diffuseColor.rgb = wcol;`;

let sharedProgramKey = 'wlab-skin-1';
export function skinMaterial(weapon = 'ak47', skin = 'std') {
  const U = {
    uCol: { value: Array.from({ length: 6 }, () => new THREE.Color()) }, uPBR: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
    uCamo: { value: 0 }, uCC: { value: Array.from({ length: 4 }, () => new THREE.Color()) }, uCS: { value: 15 },
  };
  const m = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1, metalness: 0 });
  m.userData.U = U; m.userData.weapon = weapon;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = VERT_HEAD + '\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);
    sh.fragmentShader = FRAG_HEAD + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = wrough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = vPBR.y;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += wcol * wglow * 3.0;');
  };
  m.customProgramCacheKey = () => sharedProgramKey;
  setSkin(m, skin);
  return m;
}
// Kaplamayı değiştir: yalnız uniform (geometri, program aynı)
export function setSkin(m, skin) {
  const U = m.userData.U, base = STD[m.userData.weapon] || STD.ak47, s = SKINS[skin] || SKINS.std;
  ORDER.forEach((k, i) => { const v = s[k] || base[k]; U.uCol.value[i].copy(h(v[0])); U.uPBR.value[i].set(v[1], v[2], s.cm && s.cm.includes(k) ? 1 : 0); });
  U.uCol.value[4].copy(h(LENS[0])); U.uPBR.value[4].set(LENS[1], LENS[2], 0);
  U.uCol.value[5].copy(h(GLOW[0])); U.uPBR.value[5].set(GLOW[1], GLOW[2], 0);
  U.uCamo.value = s.camo || 0; U.uCS.value = s.cs || 15;
  if (s.cc) s.cc.forEach((c, i) => U.uCC.value[i].copy(h(c)));
  m.userData.skin = skin;
  return m;
}
