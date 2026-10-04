import * as THREE from 'three';
import { C } from '../core/palette.js';

// Silah yüzey cilası (ince seviye): doku dosyası yok, malzemeye shader enjekte edilir.
// Model uzayındaki konumdan gürültü üretir (UV gerekmez; birleştirilmiş geometride de çalışır).
//   metal : yön çizikleri (namlu yönünde), mikro benek, aşınmış açık yamalar, hafif metalik parlaklık
//   ahşap : lif damarı + koyu çizgiler
//   boya  : boya kırıkları (altından çelik görünür)
// Yalnızca silah malzemeleri klonlanır; harita/karakter malzemeleri etkilenmez.

const METAL = new Set([C.steel, C.gun, C.gunLight, C.black, C.chrome].map((c) => c.toLowerCase()));
const WOOD = new Set([C.wood, C.woodDark].map((c) => c.toLowerCase()));
const PAINT = new Set([C.olive, C.oliveDark, C.tan].map((c) => c.toLowerCase()));

const NOISE = /* glsl */ `
varying vec3 vOP;
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float vn(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

const KIND_CODE = {
  metal: /* glsl */ `
    float sc = smoothstep(0.70, 0.92, vn(vec3(vOP.x * 150.0, vOP.y * 150.0, vOP.z * 10.0)));   // namlu yönünde çizik
    float sp = vn(vOP * 260.0);                                                                  // mikro benek
    float wear = smoothstep(0.58, 0.82, vn(vOP * 24.0 + 3.7));                                   // aşınmış yamalar
    diffuseColor.rgb *= 1.0 + 0.30 * sc + (sp - 0.5) * 0.16 + 0.20 * wear;`,
  wood: /* glsl */ `
    float gr = sin(vOP.x * 170.0 + vOP.y * 120.0 + vn(vec3(vOP.xy * 26.0, vOP.z * 4.0)) * 7.0);
    float st = smoothstep(0.82, 1.0, vn(vec3(vOP.x * 90.0, vOP.y * 90.0, vOP.z * 5.0)));
    diffuseColor.rgb *= 0.88 + 0.14 * gr - 0.22 * st;`,
  paint: /* glsl */ `
    float ch = smoothstep(0.76, 0.9, vn(vOP * 80.0));
    diffuseColor.rgb = mix(diffuseColor.rgb * (0.94 + 0.12 * vn(vOP * 200.0)), vec3(0.20, 0.21, 0.23), ch * 0.55);`,
};

const cache = new Map();
function finished(material) {
  const hex = '#' + material.color.getHexString();
  const kind = METAL.has(hex) ? 'metal' : WOOD.has(hex) ? 'wood' : PAINT.has(hex) ? 'paint' : null;
  if (!kind || material.transparent || material.emissive.getHex() !== 0) return material;
  let m = cache.get(material);
  if (m) return m;
  m = material.clone();
  if (kind === 'metal') { m.metalness = Math.max(m.metalness, 0.35); m.roughness = Math.min(m.roughness, 0.55); }
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vOP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vOP = position;');
    sh.fragmentShader = NOISE + '\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + KIND_CODE[kind]);
  };
  m.customProgramCacheKey = () => 'wfin-' + kind;
  cache.set(material, m);
  return m;
}

// Birleştirilmiş silah grubundaki (alt gruplar dahil) malzemeleri cilalı sürümleriyle değiştirir
export function finishWeapon(group) {
  group.traverse((o) => { if (o.isMesh && !Array.isArray(o.material)) o.material = finished(o.material); });
  return group;
}
