import * as THREE from 'three';

// Kuzey Vadisi arazi malzemesi (12.172): köşe rengi (yüzey sınıfı + gürültü + AO) üstüne dünya koordinatlı prosedürel ayrıntı.
// aW = [kaya, çimen, yol, tarla] ağırlığı (köşeler arasında yumuşak karışır). Ayrıntı piksel boyutuna göre söner (uzakta titreme yok).
// outer = true: harita dışı dağlar — "hava perspektifi" sisi (üstel, yükseklikle incelir): 5 km'deki dağ silueti gün ışığında seçilir; hava sisi (fogFar küçük) yine örter.
const NOISE = `
float th(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(th(i), th(i+vec2(1.,0.)), f.x), mix(th(i+vec2(0.,1.)), th(i+vec2(1.,1.)), f.x), f.y); }
float tf(vec2 p){ return tn(p) * 0.55 + tn(p * 2.07 + 3.1) * 0.3 + tn(p * 4.3 + 7.7) * 0.15; }
`;

export function makeTerrainMaterial(outer = false) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aW;\nattribute vec2 aRoad;\nvarying vec4 vW;\nvarying vec2 vRoad;\nvarying vec3 vTP;\nvarying vec3 vTN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTN = normalize(mat3(modelMatrix) * objectNormal);\nvW = aW;\nvRoad = aRoad;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec4 vW;\nvarying vec2 vRoad;\nvarying vec3 vTP;\nvarying vec3 vTN;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec2 p = vTP.xz; vec3 c = diffuseColor.rgb; vec3 n = normalize(vTN);
  float pxw = max(fwidth(vTP.x) + fwidth(vTP.z), 1e-4);
  float aN = 1.0 - smoothstep(0.03, 0.12, pxw), aM = 1.0 - smoothstep(0.15, 0.6, pxw), aF = 1.0 - smoothstep(0.8, 4.0, pxw);
  // genel: büyük ölçekli leke (tekdüzelik kırılır)
  c *= 0.9 + 0.2 * tf(p * 0.013) * aF + 0.08 * (tn(p * 0.11) - 0.5) * aF;
  // çimen: tutam benekleri, kuru ot, yakın planda ince taneler
  float gw = vW.y;
  if (gw > 0.01) {
    float g = 0.86 + 0.2 * tn(p * 0.9) * aM + 0.14 * (th(floor(p * 7.0)) - 0.5) * aN;
    vec3 gc = c * g;
    gc = mix(gc, gc * vec3(1.22, 1.12, 0.72), smoothstep(0.62, 0.8, tf(p * 0.045 + 3.0)) * 0.55);              // kuru / sararmış çayır lekesi
    gc = mix(gc, gc * vec3(0.7, 0.8, 0.62), smoothstep(0.55, 0.75, tf(p * 0.2 + 9.0)) * 0.35 * aM);            // koyu nemli tutam
    gc = mix(gc, vec3(0.62, 0.6, 0.35), step(0.985, th(floor(p * 5.0 + 0.5))) * 0.35 * aN);                    // kır çiçeği / kuru sap
    c = mix(c, gc, gw);
  }
  // kaya: katman çizgileri + çatlak, yüzeye dik (yamaç) bakan yerde
  float rw = vW.x;
  if (rw > 0.01) {
    vec2 wt = normalize(vec2(-n.z, n.x) + 1e-4); float u = dot(p, wt);
    float strata = tn(vec2(u * 0.12, vTP.y * 0.9)) * 0.6 + tn(vec2(u * 0.5, vTP.y * 3.1)) * 0.4;
    vec3 rc = c * (0.72 + 0.5 * strata * aF);
    rc *= 1.0 - 0.3 * smoothstep(0.82, 0.95, tn(vec2(u * 1.7, vTP.y * 0.7) + 5.0)) * aM;
    rc = mix(rc, rc * vec3(0.78, 0.86, 0.68), smoothstep(0.55, 0.8, tf(p * 0.07 + vTP.y * 0.05)) * 0.5 * step(0.4, n.y));   // yosun / liken (yatay yüzde)
    c = mix(c, rc, rw);
  }
  // yol: asfalt tanesi, yamalar / toprak yolda tekerlek izi çukuru
  float yw = vW.z;
  if (yw > 0.01) {
    vec3 yc = c * (0.88 + 0.16 * tn(p * 3.1) * aN + 0.1 * tf(p * 0.15));
    yc *= 1.0 - 0.12 * smoothstep(0.6, 0.75, tf(p * 0.06 + 11.0));
    c = mix(c, yc, yw);
  }
  // yol (yakın kademe): kenara işaretli uzaklık köşeler arasında doğrusal → keskin, merdivensiz kenar. tür: 1 asfalt · 2 toprak · 3 ana yol (kenar çizgisi)
  float rty = vRoad.y * 127.0 / 40.0;
  if (rty > 0.2) {
    float de = vRoad.x * 3.97, aw = max(fwidth(de), 0.02);
    float m = 1.0 - smoothstep(-aw, aw, de);
    vec3 asph = vec3(0.064, 0.066, 0.07) * (0.86 + 0.2 * tn(p * 3.3) * aN + 0.12 * tf(p * 0.18)), dirt = vec3(0.21, 0.16, 0.1) * (0.85 + 0.25 * tf(p * 0.7));
    float isD = smoothstep(1.5, 1.9, rty) * (1.0 - smoothstep(2.4, 2.6, rty));
    vec3 rc = mix(asph, dirt, isD);
    float axis = de + (isD > 0.5 ? 2.25 : rty > 2.5 ? 4.5 : 3.25);                                    // eksene uzaklık (yarı genişlik + kenar uzaklığı)
    rc *= 1.0 - isD * 0.22 * (1.0 - smoothstep(0.25, 0.6, abs(axis - 1.0)));                         // toprak yolda tekerlek izi
    rc *= 1.0 - (1.0 - isD) * 0.1 * smoothstep(0.6, 0.8, tf(p * 0.05 + 3.0));                       // asfalt yaması
    float edge = (1.0 - smoothstep(0.0, aw, abs(de + 0.42) - 0.07)) * step(2.5, rty) * aM;           // ana yol: beyaz kenar çizgisi
    rc = mix(rc, vec3(0.62, 0.62, 0.58), edge);
    float sh = (1.0 - smoothstep(0.55, 1.0, de)) * (1.0 - m) * (1.0 - isD);                            // banket çakılı
    c = mix(c, c * 0.55 + vec3(0.12, 0.11, 0.09), sh * 0.7);
    c = mix(c, rc, m);
  }
  // tarla: ekin / sürüm sıraları (x boyunca 0,7 m), sıra arası koyu
  float fw = vW.w;
  if (fw > 0.01) {
    float row = abs(fract(vTP.z / 0.72 + tn(p * 0.02) * 0.6) - 0.5) * 2.0;
    vec3 fc = c * (0.82 + 0.3 * smoothstep(0.2, 0.9, row) * aM) * (0.92 + 0.14 * tn(p * 0.6) * aN);
    c = mix(c, fc, fw);
  }
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`);
    // sis (FogExp2): oyun içi standart üstel² + üst sınır; dağlarda yükseklikle incelir. Böylece uzak vadi tabanı önündeki dağdan daha sisli olmaz
    // (doğrusal / sınırsız sisle oynanır alanın uzak ucu düz bir "sis bandı" gibi görünüyordu). Hava sisi (yoğunluk büyük) sınırı kaldırır.
    sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fdd = fogDensity * vFogDepth;
    float fogFactor = 1.0 - exp(-fdd * fdd);
    float wx = smoothstep(0.0012, 0.004, fogDensity);
    fogFactor = min(fogFactor, mix(${outer ? '0.8' : '0.8'}, 1.0, wx));
    ${outer ? 'fogFactor *= 1.0 - 0.3 * smoothstep(120.0, 1500.0, vTP.y) * (1.0 - wx);' : ''}
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, clamp(fogFactor, 0.0, 1.0));
#endif`);
  };
  m.customProgramCacheKey = () => 'kuzey-terrain-v1' + (outer ? 'o' : '');
  return m;
}
