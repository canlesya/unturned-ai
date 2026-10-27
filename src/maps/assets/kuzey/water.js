import * as THREE from 'three';
import { LAKE, KZ_LAKE } from './layout.js';
import { outerHeight } from './terrain.js';
import { TERRAIN_U } from './terrainMat.js';

// Kuzey Vadisi suyu (12.172, yalnız görsel): baraj gölü (12.182: ortadaki nehir şeridi kalktı). Köşe başına derinlik (su − zemin)
// → sığda açık / yarı saydam, derinde koyu; kıyıda köpük; akış yönünde kayan dalga normali, Fresnel ile gök rengi, güneş parıltısı. Sis (three) uygulanır.
// 12.180: iki yüzlü — alttan (dalan oyuncu) yüzeyin alt yüzü görünür: dalgalı açık turkuaz, uzakta koyulaşır (tam iç yansıma hissi; Snell penceresi yok),
// gün ışığıyla (gök rengi) kararır. Üstten: yakında dalga normali yumuşatıldı (beyaz leke parıltısı yok), akış yönünde uzayan köpük çizgileri.
function ribbon(P, y, pad, step, T, lateral = 10) {
  // Chaikin + eşit aralık
  let p = P.map((q) => [q[0], q[1], q[2]]);
  for (let it = 0; it < 3; it++) {
    const o = [p[0]];
    for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; o.push(a.map((v, k) => v * 0.75 + b[k] * 0.25), a.map((v, k) => v * 0.25 + b[k] * 0.75)); }
    o.push(p[p.length - 1]); p = o;
  }
  const s = [p[0]];
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / step));
    for (let k = 1; k <= n; k++) s.push(a.map((v, j) => v + (b[j] - v) * k / n));
  }
  const pos = [], dep = [], uv = [], idx = [], H = (x, z) => (T && Math.abs(x) <= 799 && Math.abs(z) <= 799 ? T.heightAt(x, z) : outerHeight(x, z));
  let dist = 0;
  for (let i = 0; i < s.length; i++) {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)], tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
    const nx = -tz / L, nz = tx / L, half = s[i][2] + pad;
    if (i) dist += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
    for (let k = 0; k <= lateral; k++) {
      const f = k / lateral * 2 - 1, x = s[i][0] + nx * half * f, z = s[i][1] + nz * half * f;
      pos.push(x, y, z); dep.push(y - H(x, z)); uv.push(dist, f * half);
    }
  }
  const W = lateral + 1;
  for (let i = 0; i < s.length - 1; i++) for (let k = 0; k < lateral; k++) {
    const a = i * W + k, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, b, c, b, d, c);                                   // yukarı bakar
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}

export function makeWaterMaterial(env = {}) {
  const U = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0.4, 0.6, 0.3).normalize() }, uSunC: { value: new THREE.Color('#fff0d8') },
    uSky: { value: new THREE.Color(env.sky?.[1] || '#9cc2e0') }, uHor: { value: new THREE.Color(env.sky?.[2] || '#d5e2ea') },
    uDeep: { value: new THREE.Color('#1f3a3c') }, uShal: { value: new THREE.Color('#5b7a62') }, uFlow: { value: 1 },
  }]);
  const m = new THREE.ShaderMaterial({
    uniforms: U, fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute float aDepth; attribute vec2 aFlow; varying float vDepth; varying vec2 vFlow; varying vec3 vWP;
      #include <fog_pars_vertex>
      void main(){ vDepth = aDepth; vFlow = aFlow; vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFlow; uniform vec3 uSun, uSunC, uSky, uHor, uDeep, uShal; varying float vDepth; varying vec2 vFlow; varying vec3 vWP;
      #include <fog_pars_fragment>
      float wh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(wh(i), wh(i+vec2(1.,0.)), f.x), mix(wh(i+vec2(0.,1.)), wh(i+vec2(1.,1.)), f.x), f.y); }
      float wave(vec2 q){ return wn(q) * 0.5 + wn(q * 2.3 + 1.7) * 0.3 + wn(q * 5.1 + 4.2) * 0.2; }
      void main(){
        if (vDepth < -0.05) discard;
        vec3 V = normalize(cameraPosition - vWP); float dist = length(cameraPosition - vWP);
        vec2 q = vec2(vFlow.x - uTime * 0.9 * uFlow, vFlow.y) * 0.35;
        float e = 0.06, h0 = wave(q), hx = wave(q + vec2(e, 0.0)), hz = wave(q + vec2(0.0, e));
        float amp = mix(0.32, 0.12, smoothstep(30.0, 400.0, dist)) * mix(0.6, 1.0, smoothstep(2.0, 14.0, dist));
        vec3 N = normalize(vec3(-(hx - h0) / e * amp, 1.0, -(hz - h0) / e * amp));
        { vec2 q2 = q * 3.7 + vec2(-uTime * 0.6 * uFlow, uTime * 0.13); float d0 = wn(q2), dx = wn(q2 + vec2(0.05, 0.0)), dz = wn(q2 + vec2(0.0, 0.05));    // yakında ince dalgacık: güneş parıltısı leke değil pırıltı
          float a2 = 0.2 * (1.0 - smoothstep(6.0, 60.0, dist)); N = normalize(N + vec3(-(dx - d0) / 0.05 * a2, 0.0, -(dz - d0) / 0.05 * a2)); }
        if (!gl_FrontFacing) {                                                       // 12.180 alttan bakış: yüzeyin alt yüzü
          float lum = clamp(dot(uSky, vec3(0.3, 0.55, 0.15)) * 1.6, 0.08, 1.0);
          float rip = smoothstep(0.25, 0.85, wave(q * 1.9 + vec2(uTime * 0.12, 0.0))) * 0.6 + smoothstep(0.55, 0.95, wave(q * 4.3 - uTime * 0.2)) * 0.4;
          vec3 cu = mix(vec3(0.16, 0.42, 0.45), vec3(0.62, 0.86, 0.84), rip) * lum;
          cu = mix(cu, vec3(0.05, 0.16, 0.19) * lum, smoothstep(5.0, 26.0, dist));             // uzakta tam iç yansıma: koyu
          cu += uSunC * pow(max(dot(-V, normalize(uSun)), 0.0), 10.0) * 0.6 * lum * (0.6 + 0.4 * rip);       // güneş yönünde parlak bölge
          gl_FragColor = vec4(cu, 0.94);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
          return;
        }
        float fr = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        float dk = smoothstep(0.0, 2.6, vDepth);
        vec3 body = mix(uShal, uDeep, dk);
        vec3 sky = mix(uHor, uSky, smoothstep(0.0, 0.5, reflect(-V, N).y));
        vec3 col = mix(body, sky, clamp(fr * 1.15, 0.0, 0.92));
        float sp = pow(max(dot(reflect(-uSun, N), V), 0.0), 220.0);
        col += uSunC * sp * 2.2;
        float foam = (1.0 - smoothstep(0.02, 0.34, vDepth)) * (0.55 + 0.45 * wn(q * 6.0 + uTime * 0.6));
        foam += (1.0 - smoothstep(0.1, 0.9, vDepth)) * smoothstep(0.62, 0.9, wn(vec2(q.x * 1.4, q.y * 7.0) + vec2(-uTime * 0.25 * uFlow, 0.0))) * 0.45 * uFlow;   // akış yönünde köpük çizgileri (kıyıya yakın)
        col = mix(col, vec3(0.82, 0.84, 0.8), foam * 0.55);
        float a = mix(0.4, 0.86, smoothstep(0.0, 2.2, vDepth));
        a = max(a, fr * 0.9) * smoothstep(-0.05, 0.08, vDepth);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  m.userData.U = U;
  return m;
}

export class Water {
  constructor(T, env) {
    this.group = new THREE.Group(); this.group.name = 'kuzey-su';
    this.lakeMat = makeWaterMaterial(env); this.lakeMat.userData.U.uFlow.value = 0.08;
    this.mats = [this.lakeMat];
    this.lakeMat.userData.U.uDeep.value.set('#1a3236');
    const lake = new THREE.Mesh(ribbon(LAKE, KZ_LAKE, 70, 12, T, 12), this.lakeMat);
    lake.renderOrder = 2; this.group.add(lake);
  }
  update(t, sunDir) {
    TERRAIN_U.uTime.value = t % 3600;                                                     // su yatağı kostik deseni
    for (const m of this.mats) { m.userData.U.uTime.value = t; if (sunDir) m.userData.U.uSun.value.copy(sunDir); }
  }
}
