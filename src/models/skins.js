import * as THREE from 'three';
import { SKIN_IDS } from '../game/stats.js';

// Kaplama (skin) sistemi (silah laboratuvarından, 12.122): TEK gölgelendirici programı (tüm S3 silahları / nişangâhları / kaplamaları aynı program, önbellek anahtarı sabit), kaplama = uniform paleti.
// Yuva rengi + pürüzlülük / metaliklik / kamuflaj maskesi köşe gölgelendiricisinde uniform dizisinden okunur; kamuflaj model uzayı konumundan prosedürel lekeler (doku yok, UV yok).
// setSkin(mat, id) → yalnız uniform yazılır (geometri / program yeniden kurulmaz). Birinci şahıs / vitrin: silah başına kendi malzemesi; 3. şahıs: (silah, kaplama) başına paylaşılan malzeme.
// uAlpha: telefonda nişan soluklaşması (setFade) — ışıyan retikül opak kalır · uProbe (ortak): adsalign testi retikülü saf eflatun çizer (ekrandaki merkezini ölçmek için).
const h = (c) => new THREE.Color(c);
// Silah başına "Standart" palet: [gövde, mobilya, metal, aksesuar] (renk, pürüzlülük, metaliklik); optic = eski silahlara takılan S3 nişangâhı
export const STD = {
  ak47: { body: ['#36383c', 0.5, 0.4], furn: ['#7a4426', 0.45, 0], metal: ['#38393c', 0.42, 0.6], acc: ['#1c1d20', 0.6, 0.2] },
  m4a1: { body: ['#35373b', 0.55, 0.3], furn: ['#25272a', 0.7, 0], metal: ['#333437', 0.4, 0.6], acc: ['#18191b', 0.6, 0.2] },
  pistol: { body: ['#36383c', 0.5, 0.35], furn: ['#232427', 0.72, 0], metal: ['#3a3b3f', 0.38, 0.65], acc: ['#151618', 0.6, 0.2] },
  sniper: { body: ['#36383c', 0.5, 0.4], furn: ['#565c45', 0.75, 0], metal: ['#333437', 0.4, 0.6], acc: ['#1e1f22', 0.5, 0.25] },
  shotgun: { body: ['#2a2b2e', 0.5, 0.4], furn: ['#1e1f22', 0.72, 0], metal: ['#38393c', 0.42, 0.6], acc: ['#18191b', 0.6, 0.2] },
  optic: { body: ['#1d1e21', 0.6, 0.2], furn: ['#25272a', 0.7, 0], metal: ['#333437', 0.4, 0.6], acc: ['#1c1d20', 0.6, 0.2] },
};
const LENS = ['#10201f', 0.06, 0.6], GLOW = ['#ff2a1f', 1, 0];
// 12.190 retikül rengi (Ayarlar; PUBG gibi): HUD retikülleri CSS --rc, 3B ışıyan retikül GLOW (sonra kurulan silah malzemeleri; maç başında kurulur)
export const RET_COLORS = { red: '#ff2a1a', green: '#3dff5c', yellow: '#ffd21a', cyan: '#2ee6ff' };
export function setReticleColor(k) {
  const c = RET_COLORS[k] || RET_COLORS.red;
  GLOW[0] = k === 'red' || !RET_COLORS[k] ? '#ff2a1f' : c;
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--rc', c);
}
// 12.157 Uzay modu enerji silahları: kırık beyaz kabuk, koyu iskelet; en = ışıyan enerji parçalarının rengi (desen 3, uEn)
Object.assign(STD, {
  laser: { body: ['#d6d6d0', 0.42, 0.05], furn: ['#2c3036', 0.6, 0.1], metal: ['#4a5058', 0.35, 0.65], acc: ['#1e2126', 0.5, 0.25], en: '#3fe2ff' },
  plasma: { body: ['#cfd2d6', 0.42, 0.05], furn: ['#2a2b33', 0.6, 0.1], metal: ['#4b4f58', 0.35, 0.65], acc: ['#1f1f26', 0.5, 0.25], en: '#b46cff' },
  epistol: { body: ['#dcdbd4', 0.4, 0.05], furn: ['#2b2f33', 0.62, 0.1], metal: ['#4a5056', 0.35, 0.65], acc: ['#1d2024', 0.5, 0.25], en: '#5cff9c' },
  railgun: { body: ['#d3d6da', 0.4, 0.08], furn: ['#2a2e35', 0.6, 0.1], metal: ['#59616b', 0.3, 0.75], acc: ['#1c1f24', 0.5, 0.3], en: '#8fd8ff' },
  elmg: { body: ['#cfccc4', 0.45, 0.06], furn: ['#2c2e33', 0.6, 0.1], metal: ['#4f5359', 0.35, 0.65], acc: ['#1e1f23', 0.5, 0.25], en: '#ff6a3a' },
  scatter: { body: ['#d8d4cb', 0.45, 0.05], furn: ['#32302d', 0.62, 0.1], metal: ['#55575a', 0.35, 0.65], acc: ['#211f1d', 0.5, 0.25], en: '#ffa040' },
});
// Kaplamalar: yuva geçersiz kılma + kamuflaj (mode 1 orman lekeleri, 2 şehir dijital piksel); cm = kamuflajın uygulandığı yuvalar. Adlar arayüzde i18n (src/i18n/skins.js)
export const SKINS = {
  std: {},
  desert: { body: ['#a8895c', 0.62, 0.05], furn: ['#b89a6a', 0.7, 0], acc: ['#8e7550', 0.65, 0.05] },
  wood: { camo: 1, cm: ['body', 'furn'], cc: ['#56603a', '#6e5435', '#23241e', '#8f8a5e'], cs: 24, body: ['#56603a', 0.66, 0.05], furn: ['#56603a', 0.7, 0] },
  urban: { camo: 2, cm: ['body', 'furn'], cc: ['#7d8187', '#4f5359', '#26282c', '#b3b6ba'], cs: 19, body: ['#7d8187', 0.6, 0.1], furn: ['#7d8187', 0.65, 0] },
  gold: { body: ['#d9a93c', 0.24, 1], furn: ['#c99a30', 0.3, 1], acc: ['#1b1b1d', 0.45, 0.4], metal: ['#2a2a2c', 0.3, 0.8] },
};
export { SKIN_IDS };
// Menü çipi rengi (kaplamanın baskın rengi)
export const SKIN_SWATCH = { std: '#3a3c40', desert: '#a8895c', wood: '#56603a', urban: '#7d8187', gold: '#d9a93c' };
const ORDER = ['body', 'furn', 'metal', 'acc'];
const PROBE = { value: 0 };
export const SKIN_PROBE = PROBE;      // 12.128: ACOG mercek gölgelendiricisi de aynı adsalign bayrağını okur
export function setSkinProbe(on) { PROBE.value = on ? 1 : 0; }

const VERT_HEAD = /* glsl */ `
attribute vec3 wf; uniform vec3 uCol[6]; uniform vec3 uPBR[6];
varying vec3 vCol; varying vec3 vPBR; varying vec3 vOP; varying vec2 vSP;`;
const VERT_BODY = /* glsl */ `
  { int s = int(wf.x + 0.5); vCol = uCol[s]; vPBR = uPBR[s]; vOP = position; vSP = vec2(wf.y, wf.z + (s == 5 ? 10.0 : 0.0)); }`;
const FRAG_HEAD = /* glsl */ `
uniform int uCamo; uniform vec3 uCC[4]; uniform float uCS; uniform float uAlpha; uniform float uGlowA; uniform float uProbe; uniform vec3 uEn; uniform float uEnK;
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
  if (wpat > 9.5) { wglow = 1.0; wpat -= 10.0; if (uGlowA < 0.01) discard; }      // sönmüş retikül derinlik yazmasın (arkasındaki cam halka şeklinde kesilmesin)
  if (uCamo > 0 && vPBR.z > 0.5) wcol = camo(vOP);
  wcol *= wsh;
  float wen = 0.0;                                                                         // 12.157: desen 3 = ışıyan enerji parçası (silahın enerji rengi; adsalign eflatun ölçümünde sönük)
  if (wpat > 2.5 && wpat < 3.5) { wen = uProbe > 0.5 ? 0.0 : 1.0; wcol = uEn * (uProbe > 0.5 ? 0.25 : min(1.0, 0.35 + 0.65 * uEnK)); wpat = 0.0; }      // uEnK: ışıma gücü (ray tüfeği şarjı, makineli ısınması; space.js)
  if (wpat > 0.5 && wpat < 1.5) { float st = h31(floor(vOP * 700.0)); wcol *= 0.78 + 0.34 * st; wrough = min(1.0, wrough + 0.2); }     // benekli kabza (stipple)
  else if (wpat > 1.5) { wcol *= 0.82 + 0.22 * step(0.5, fract(vOP.z * 260.0 + vOP.y * 120.0)); }                                            // tırtıl / oluk
  diffuseColor.rgb = wcol * (1.0 - wglow); diffuseColor.a = opacity * (wglow > 0.5 ? uGlowA : uAlpha);      // 12.139: ışıyan retikül ışıklandırılmaz (yalnız kendi rengi)`;

const SHARED = new Map();
// Kaplama malzemesi: shared=true → (silah, kaplama) başına tek örnek (3. şahıs askerleri paylaşır; setSkin / setFade çağrılmaz)
export function skinMaterial(weapon = 'ak47', skin = 'std', shared = false) {
  const key = weapon + '|' + skin;
  if (shared && SHARED.has(key)) return SHARED.get(key);
  const U = {
    uCol: { value: Array.from({ length: 6 }, () => new THREE.Color()) }, uPBR: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
    uEn: { value: new THREE.Color('#44e0ff') }, uEnK: { value: 1 }, uCamo: { value: 0 }, uCC: { value: Array.from({ length: 4 }, () => new THREE.Color()) }, uCS: { value: 15 }, uAlpha: { value: 1 }, uGlowA: { value: 1 }, uProbe: PROBE,
  };
  const m = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1, metalness: 0 });
  m.userData.U = U; m.userData.weapon = weapon; m.userData.skinMat = true; m.userData.shared = shared;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = VERT_HEAD + '\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);
    sh.fragmentShader = FRAG_HEAD + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = wrough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = vPBR.y;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += wcol * wglow * 0.86 + uEn * wen * 1.15 * uEnK;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  if (uProbe > 0.5 && wglow > 0.5) gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);');
  };
  m.customProgramCacheKey = () => 'wb-skin-4';      // 12.139: ışıma ×3 → ×0,86 (doğrusal ≤ 1: Neutral ton eşlemede pembeleşmez, ACOG PiP şevronuyla aynı kırmızı)
  setSkin(m, skin);
  if (shared) SHARED.set(key, m);
  return m;
}
// Kaplamayı değiştir: yalnız uniform (geometri, program aynı)
export function setSkin(m, skin) {
  const U = m.userData.U, base = STD[m.userData.weapon] || STD.ak47, s = SKINS[skin] || SKINS.std;
  ORDER.forEach((k, i) => { const v = s[k] || base[k]; U.uCol.value[i].copy(h(v[0])); U.uPBR.value[i].set(v[1], v[2], s.cm && s.cm.includes(k) ? 1 : 0); });
  U.uCol.value[4].copy(h(LENS[0])); U.uPBR.value[4].set(LENS[1], LENS[2], 0);
  U.uCol.value[5].copy(h(GLOW[0])); U.uPBR.value[5].set(GLOW[1], GLOW[2], 0);
  U.uCamo.value = s.camo || 0; U.uCS.value = s.cs || 15;
  U.uEn.value.copy(h(base.en || '#44e0ff'));
  if (s.cc) s.cc.forEach((c, i) => U.uCC.value[i].copy(h(c)));
  m.userData.skin = SKINS[skin] ? skin : 'std';
  return m;
}
// Telefonda nişan soluklaşması: ışıyan retikül hariç tüm yuvalar saydamlaşır (setFade) · ga: ışıyan retikülün saydamlığı (telefonda HUD retikülü çıkarken 3B halka / nokta söner → tek halka)
export function setSkinAlpha(m, a, ga = 1) {
  const tr = a < 0.999 || ga < 0.999;
  m.userData.U.uAlpha.value = a; m.userData.U.uGlowA.value = ga;
  if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
}
// Bir modeldeki kaplama malzemelerini değiştir (menü önizlemesi: geometri aynı kalır)
export function applySkin(g, skin) { g.traverse((o) => { const m = o.material; if (m && m.userData?.skinMat && !m.userData.shared && m.userData.weapon !== 'optic') setSkin(m, skin); }); }
