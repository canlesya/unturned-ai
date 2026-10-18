import * as THREE from 'three';
import { C } from '../core/palette.js';

// Silah yüzey cilası (PBR, doku dosyası yok): malzemeye shader enjekte edilir; gürültü model uzayındaki konumdan (UV gerekmez, birleştirilmiş geometride de çalışır).
// Türler: parkerize çelik · eloksallı alüminyum (gövde) · koyu metal · işlenmiş parlak çelik (krom) · pirinç · polimer · kauçuk (kabza) · verniklı ahşap · cerakote boya · kaplamalı optik cam / mercek.
// Kenar aşınması: birleştirmeden ÖNCE her parçaya yerel konum (wl) + yarı boyut (wh) özniteliği yazılır (prepWear); shader yüzün en yakın kenarına uzaklığı metre olarak bulur.
// Normal ayrıntısı (mikro benek, lif, tırtıl): yükseklik gürültüsünün ekran türevinden tümsek (bump) — ek doku / çizim çağrısı yok.
// Malzemeler BİRLEŞTİRMEDEN ÖNCE tür+renk başına tek kopyaya bağlanır: aynı türdeki "M'li / M'siz" parçalar tek ağda birleşir (çizim çağrısı eşit ya da az).
// Yalnızca birinci şahıs / vitrin silahları; uzak savaşçı silahı (lod, köşe renkli) ve harita / karakter malzemeleri etkilenmez.

const hex = (c) => c.toLowerCase();
const KIND = new Map([
  [C.steel, 'steel'], ['#8f959c', 'steel'], ['#7a8088', 'steel'], ['#6c7278', 'steel'],
  [C.gun, 'anod'], [C.gunLight, 'anod'], ['#2a2c30', 'anod'], ['#3b3f46', 'anod'], ['#2a2d33', 'anod'],
  [C.chrome, 'mach'], [C.brass, 'brass'],
  [C.black, 'poly'], ['#2b2d31', 'poly'], ['#15161a', 'poly'], ['#111214', 'poly'], ['#2e3238', 'poly'], ['#3b3e44', 'poly'], ['#2a2d30', 'poly'], ['#8a919b', 'poly'],
  ['#101012', 'rubber'],
  [C.wood, 'wood'], [C.woodDark, 'wood'], ['#6b3a2a', 'wood'], ['#3a281a', 'wood'], ['#241608', 'wood'], ['#2a1608', 'wood'],
  [C.olive, 'paint'], [C.oliveDark, 'paint'], [C.tan, 'paint'],
  ['#a8d8ff', 'glass'], [C.lens, 'lens'], ['#3fb7ff', 'lens'],
].map(([c, k]) => [hex(c), k]));
// Tür başına temel PBR değerleri (shader bunları gürültü / aşınmayla değiştirir)
const BASE = {
  steel: { metalness: 0.32, roughness: 0.55 }, anod: { metalness: 0.36, roughness: 0.46 }, dmetal: { metalness: 0.3, roughness: 0.52 },   // fosfat / eloksal kaplama yarı yalıtkan: çıplak metal yalnız aşınan kenarda
  mach: { metalness: 0.92, roughness: 0.2 }, brass: { metalness: 0.9, roughness: 0.3 },
  poly: { metalness: 0.0, roughness: 0.62 }, rubber: { metalness: 0.0, roughness: 0.9 }, wood: { metalness: 0.0, roughness: 0.42 },
  paint: { metalness: 0.0, roughness: 0.6 }, glass: { roughness: 0.04, metalness: 0.1 }, lens: { roughness: 0.06, metalness: 0.25 },
};

const NOISE = /* glsl */ `
varying vec3 vOP; varying vec3 vWL; varying vec3 vWH;
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float vn(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float wfEdge(){ vec3 d = max(vWH - abs(vWL), 0.0); float a = min(d.x, min(d.y, d.z)), b = max(d.x, max(d.y, d.z)); return d.x + d.y + d.z - a - b; }   // ikinci en küçük = bu yüzün en yakın kenarına uzaklık (m)
void wfBump(inout vec3 n, float h, float k){ vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1);
  vec2 dh = vec2(dFdx(h), dFdy(h)) * k; n = normalize(abs(det) * n - sign(det) * (dh.x * r1 + dh.y * r2)); }`;

// Ortak başlangıç: kenar uzaklığı, orta ölçek yama (n1), ince tane (nf); wfR / wfM / wfH / wfK sonraki bölümlerde pürüzlülük, metaliklik, tümsek olur
const HEAD = /* glsl */ `
  float wfE = wfEdge(), n1 = vn(vOP * 60.0 + 1.3), nf = vn(vOP * 650.0), wfR = roughness, wfM = metalness, wfH = 0.0, wfK = 0.0;
  float wn = vn(vOP * 160.0 + 5.0), wfAA = length(fwidth(vOP));                                             // wfAA: piksel başına model uzayı (m): ekrandan ince ayrıntı söner (parıldama yok)
  float ew = (1.0 - smoothstep(0.0, 0.0009 + 0.0024 * wn, wfE)) * smoothstep(0.3, 0.65, n1 + 0.35 * wn);   // yamalı kenar aşınması
`;
const KIND_CODE = {
  steel: /* glsl */ `
    float sc = smoothstep(0.74, 0.96, vn(vec3(vOP.x * 190.0, vOP.y * 190.0, vOP.z * 7.0)));                 // namlu yönünde ince çizik
    diffuseColor.rgb *= 0.9 + 0.2 * nf + 0.12 * (n1 - 0.5);                                                   // parkerize kristal benek
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.51, 0.53), ew * 0.9) + sc * 0.03;                    // aşınan kenarda çıplak çelik
    wfR = roughness * (0.84 + 0.32 * nf) * mix(1.0, 0.4, ew) * (1.0 - 0.3 * sc); wfM = mix(metalness, 1.0, ew); wfH = nf; wfK = 0.00004;`,
  anod: /* glsl */ `
    diffuseColor.rgb *= 0.97 + 0.06 * nf;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.63, 0.65), ew);                                     // eloksal kenarda açık alüminyum
    wfR = roughness * (0.92 + 0.16 * nf) * mix(1.0, 0.5, ew); wfM = mix(metalness, 1.0, ew); wfH = nf; wfK = 0.000015;`,
  dmetal: /* glsl */ `
    diffuseColor.rgb *= 0.9 + 0.2 * nf;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.43, 0.45), ew * 0.85);
    wfR = roughness * (0.86 + 0.28 * nf) * mix(1.0, 0.45, ew); wfM = mix(metalness, 1.0, ew); wfH = nf; wfK = 0.00003;`,
  mach: /* glsl */ `
    float lr = 0.5 + 0.5 * sin(vOP.z * 2600.0 + nf * 2.5);                                                    // torna izi (namlu ekseni boyunca halkalar)
    diffuseColor.rgb *= 0.92 + 0.12 * lr;
    wfR = roughness * (0.7 + 0.6 * lr) + 0.08 * (n1 - 0.5); wfH = lr; wfK = 0.00002;`,
  brass: /* glsl */ `
    float tn = smoothstep(0.4, 0.85, n1);                                                                     // kararmış (oksit) yamalar
    diffuseColor.rgb *= mix(1.05, 0.62, tn) * (0.95 + 0.1 * nf);
    wfR = roughness * mix(0.8, 1.7, tn) * mix(1.0, 0.6, ew); wfH = nf; wfK = 0.00003;`,
  poly: /* glsl */ `
    float st = vn(vOP * 1800.0);                                                                              // ince polimer dokusu (kumlama)
    diffuseColor.rgb *= 0.95 + 0.08 * nf + 0.06 * (n1 - 0.5);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.7 + 0.012, ew * 0.55);                     // kenarda ele sürtünmüş açık iz
    wfR = roughness * (0.92 + 0.16 * st) * mix(1.0, 0.65, ew); wfM = 0.0; wfH = st; wfK = 0.000012 * (1.0 - smoothstep(0.25, 0.7, wfAA * 1800.0));`,
  rubber: /* glsl */ `
    float st = vn(vOP * 1900.0);
    diffuseColor.rgb *= 0.85 + 0.25 * st;
    wfR = 0.86 + 0.12 * st; wfM = 0.0; wfH = st; wfK = 0.00008 * (1.0 - smoothstep(0.25, 0.7, wfAA * 1900.0));`,
  wood: /* glsl */ `
    float rg = vOP.y * 230.0 + vOP.x * 80.0 + vn(vec3(vOP.xy * 26.0, vOP.z * 2.5)) * 6.5;                     // lif (dipçik / kundak boyunca)
    float gr = 0.5 + 0.5 * sin(rg), fig = vn(vec3(vOP.xy * 11.0, vOP.z * 1.4)), pore = smoothstep(0.72, 1.0, vn(vec3(vOP.xy * 380.0, vOP.z * 34.0)));
    diffuseColor.rgb *= (0.76 + 0.32 * gr) * (0.88 + 0.24 * fig) * (1.0 - 0.28 * pore);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.45, ew * 0.6);                              // kenarda aşınan vernik: açık ham ahşap
    wfR = mix(0.3, 0.62, clamp(pore + 0.25 * gr, 0.0, 1.0)); wfR = mix(wfR, 0.75, ew); wfM = 0.0; wfH = gr * 0.6 + pore * 0.5; wfK = 0.00006;`,
  paint: /* glsl */ `
    float chip = max(smoothstep(0.8, 0.9, vn(vOP * 85.0)), ew * step(0.45, wn));                             // boya kırığı: yüzeyde seyrek + kenarda sık
    diffuseColor.rgb *= 0.93 + 0.12 * nf;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.21, 0.22), chip * 0.85);                             // altından çelik
    wfR = mix(roughness * (0.9 + 0.2 * nf), 0.35, chip); wfM = mix(0.0, 0.85, chip); wfH = nf * 0.6 + chip * 0.6; wfK = 0.00005;`,
  glass: '', lens: '',
};
// Kaplamalı cam: bakış açısına göre yeşil-mor yansıma (yüz ortası daha saydam), mercek: kenara doğru mor / amber kaplama ışıltısı
const POST_NORMAL = {
  glass: /* glsl */ `
    { float fr = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);
      diffuseColor.rgb = mix(vec3(0.42, 0.78, 0.6), vec3(0.72, 0.38, 0.95), fr); diffuseColor.a = clamp(diffuseColor.a * (1.0 + 2.5 * fr), 0.0, 0.5); }`,
  lens: /* glsl */ `
    { float fr = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 1.5);
      diffuseColor.rgb *= 0.25; wfLensTint = mix(vec3(0.45, 0.7, 1.0), vec3(1.25, 0.55, 1.35), fr) * (0.55 + 0.45 * vn(vOP * 90.0)); }`,
};

const cache = new Map();
function finished(material) {
  if (!material || Array.isArray(material) || !material.isMeshStandardMaterial) return material;
  const h = '#' + material.color.getHexString();
  let kind = KIND.get(h);
  if (kind === 'poly' && h === hex(C.black) && material.metalness > 0) kind = 'dmetal';                     // M'li siyah = metal parça (alt gövde, alev gizleyici)
  if (!kind) return material;
  if (kind === 'glass' ? !material.transparent : kind === 'lens' ? !material.emissive.getHex() : (material.transparent || material.emissive.getHex() !== 0 || material.userData.glow)) return material;   // cam saydam, mercek ışıyan olmalı; diğerleri düz
  const key = kind + h + (material.transparent ? 't' + material.opacity : '') + (material.emissive.getHex() ? 'e' + material.emissiveIntensity : '');
  let m = cache.get(key);
  if (m) return m;
  m = material.clone();
  Object.assign(m, BASE[kind]);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vOP; varying vec3 vWL; varying vec3 vWH;\nattribute vec3 wl; attribute vec3 wh;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vOP = position; vWL = wl; vWH = wh;');
    let f = sh.fragmentShader
      .replace('#include <clipping_planes_pars_fragment>', '#include <clipping_planes_pars_fragment>\n' + NOISE)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + HEAD + KIND_CODE[kind] + (kind === 'lens' ? '\n  vec3 wfLensTint = vec3(1.0);' : ''))
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = clamp(wfR, 0.04, 1.0);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = clamp(wfM, 0.0, 1.0);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  wfK *= 1.0 - smoothstep(0.35, 0.9, wfAA * 650.0) * 0.7;\n  if (wfK > 0.0) wfBump(normal, wfH, wfK);' + (POST_NORMAL[kind] || ''));
    if (kind === 'lens') f = f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= wfLensTint;');
    sh.fragmentShader = f;
  };
  m.customProgramCacheKey = () => 'wfin2-' + kind;
  const base = THREE.MeshStandardMaterial.prototype.clone;
  m.clone = function () { const c = base.call(this); c.onBeforeCompile = this.onBeforeCompile; c.customProgramCacheKey = this.customProgramCacheKey; c.clone = this.clone; return c; };   // saydamlaştırma kopyası (setFade) cilayı korusun
  cache.set(key, m);
  return m;
}

// Parça geometrisine kenar aşınması öznitelikleri: kutu → yerel konum + yarı boyut; silindir → (yarıçap uzaklığı, eksen konumu) + (kesit yarıçapı, yarı boy); diğerleri kenarsız
const FAR = 1e3;
function wearAttrs(geo) {
  if (geo.attributes.wl) return;
  const p = geo.attributes.position, nrm = geo.attributes.normal, n = p.count, wl = new Float32Array(n * 3), wh = new Float32Array(n * 3);
  geo.computeBoundingBox();
  const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3()), hs = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const t = geo.type;
  if (t === 'BoxGeometry') {
    for (let i = 0; i < n; i++) { wl[i * 3] = p.getX(i) - c.x; wl[i * 3 + 1] = p.getY(i) - c.y; wl[i * 3 + 2] = p.getZ(i) - c.z; wh[i * 3] = hs.x; wh[i * 3 + 1] = hs.y; wh[i * 3 + 2] = hs.z; }
  } else if (t === 'CylinderGeometry' && nrm) {
    const ax = Math.abs(hs.x - hs.z) < 1e-5 ? 1 : Math.abs(hs.y - hs.z) < 1e-5 ? 0 : 2;                     // eksen: diğer iki yarı boyutu eşit olmayan
    const r1 = (ax + 1) % 3, r2 = (ax + 2) % 3, g = (i, k) => p.getComponent(i, k) - c.getComponent(k);
    const capR = [0, 0];
    for (let i = 0; i < n; i++) if (Math.abs(nrm.getComponent(i, ax)) > 0.9) { const s = g(i, ax) > 0 ? 1 : 0; capR[s] = Math.max(capR[s], Math.hypot(g(i, r1), g(i, r2))); }
    for (let i = 0; i < n; i++) {
      const rd = Math.hypot(g(i, r1), g(i, r2)), cap = Math.abs(nrm.getComponent(i, ax)) > 0.9;
      wl[i * 3] = rd; wl[i * 3 + 1] = g(i, ax); wl[i * 3 + 2] = 0;
      wh[i * 3] = cap ? capR[g(i, ax) > 0 ? 1 : 0] : rd; wh[i * 3 + 1] = hs.getComponent(ax); wh[i * 3 + 2] = FAR;
    }
  } else wh.fill(FAR);
  geo.setAttribute('wl', new THREE.BufferAttribute(wl, 3));
  geo.setAttribute('wh', new THREE.BufferAttribute(wh, 3));
}

// Birleştirmeden ÖNCE çağrılır: her parçaya aşınma öznitelikleri + cilalı malzeme (birleştirme aynı malzemeleri tek ağda toplar)
export function finishWeapon(group) {
  group.traverse((o) => { if (o.isMesh && !Array.isArray(o.material) && o.geometry) { wearAttrs(o.geometry); o.material = finished(o.material); } });
  return group;
}
