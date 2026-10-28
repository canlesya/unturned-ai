import * as THREE from 'three';
import { mat } from '../core/geo.js';

// Gökyüzü, güneş/gölge, sis, bulutlar. Hem harita önizleme hem oyun içi kullanılır.
const DEFAULT_ENV = {
  sky: ['#5f9bd6', '#a9cfe9', '#dce8ee'], fog: ['#d3e2ea', 120, 420],
  sun: ['#fff0d2', 2.5], hemi: ['#bcd9ff', '#7a6a48', 1.2], cloud: '#f4f6f8', clouds: 18,
};

// ── Günün saati: gündüz / gün batımı / gece ──
export const TODS = { day: 'Gündüz', sunset: 'Gün batımı', night: 'Gece' };
const TOD_PRESETS = {
  sunset: {
    sky: ['#2b3a73', '#e0794a', '#ffc47e'], fog: ['#d89c78', 0.55, 0.9], sun: ['#ff9c4e', 2.3], hemi: ['#ffb690', '#4a3a3e', 0.85],
    cloud: '#ffc2a0', cloudGlow: 0.62, sunPos: [-85, 26, 45], envI: 0.3, glow: 0.55,
  },
  night: {
    sky: ['#050a18', '#10204a', '#233a68'], fog: ['#13203f', 0.35, 0.6], sun: ['#a9c2ff', 1.25], hemi: ['#6075b8', '#232a40', 1.0],
    cloud: '#27304d', cloudGlow: 0.25, sunPos: [-45, 70, -35], envI: 0.2, glow: 1.5, stars: true,
  },
};

// Günün saatine göre renk ayarı: pozlama (her kalitede) + son işleme tonu (yalnız Yüksek + son işleme): tint çarpanı, doygunluk, kontrast, vinyet, parıltı eşiği / gücü
const GRADE = {
  day: { exposure: 1.0, tint: [1.02, 1.0, 0.97], sat: 1.07, contrast: 1.05, vig: 0.16, bloom: 0.1, thr: 1.6 },
  sunset: { exposure: 1.04, tint: [1.03, 0.99, 0.95], sat: 1.04, contrast: 1.04, vig: 0.2, bloom: 0.16, thr: 1.2 },
  night: { exposure: 1.08, tint: [0.96, 0.98, 1.04], sat: 0.95, contrast: 1.0, vig: 0.16, bloom: 0.22, thr: 0.9 },
};
export const todGrade = (tod, env = {}) => ({ ...(GRADE[tod] || GRADE.day), ...((env[tod] || env).grade || {}) });

export function todEnv(env = {}, sunPos, tod = 'day') {
  const P = TOD_PRESETS[tod] && { ...TOD_PRESETS[tod], ...(env[tod] || {}) };          // env.night / env.sunset: haritaya özel saat ayarı (ör. New York: daha karanlık, dumanlı gece)
  const E = { ...DEFAULT_ENV, ...env };
  if (!P) return { E, sunPos, envI: 0.5, glow: 0, stars: false };
  const fog = [P.fog[0], Math.max(12, E.fog[1] * P.fog[1]), Math.max(110, E.fog[2] * P.fog[2])];
  return {
    E: { ...E, sky: P.sky, fog, sun: P.sun, hemi: P.hemi, cloud: P.cloud, cloudGlow: P.cloudGlow },
    sunPos: P.sunPos, envI: P.envI, glow: P.glow, stars: !!P.stars,
  };
}

// Gök kubbesi: yöne bağlı degrade (ufuk = sky[2] ≈ sis rengi, 30° = sky[1], tepe = sky[0]) + güneş diski ve halesi. Kamera ile döner, hep en uzakta (z = w),
// sahne ışığı / sis yok; hava durumu (yağmur, şimşek) scene.backgroundIntensity ile parlaklığı değiştirir. env: true → yansıma haritası için (ufkun altı zemin rengi, disk daha parlak)
function skyDome(E, sunDir, tod, ground, env = false) {
  const col = (c) => new THREE.Color(c);
  const sunC = col(E.sun[0]), night = tod === 'night';
  const m = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: col(E.sky[0]) }, mid: { value: col(E.sky[1]) }, hor: { value: col(E.sky[2]) }, ground: { value: col(ground) },
      sunC: { value: sunC }, sunDir: { value: sunDir.clone() }, disk: { value: night ? 0 : env ? 14 : 5 }, halo: { value: night ? 0.12 : tod === 'sunset' ? 0.75 : 0.32 }, uI: { value: 1 }, desat: { value: env ? 0.8 : 0 }, gain: { value: env ? envGain(E, ground) : 1 },
    },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top, mid, hor, ground, sunC, sunDir; uniform float disk, halo, uI, desat, gain; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float y = d.y;
        vec3 c = mix(mix(hor, mid, smoothstep(-0.02, 0.16, y)), top, smoothstep(0.12, 0.55, y));
        c = mix(c, ground, smoothstep(0.0, -0.08, y)) * gain;
        float s = max(dot(d, sunDir), 0.0);
        c += min(gain, 3.0) * sunC * (halo * (0.25 * pow(s, 5.0) + 0.5 * pow(s, 48.0)) + disk * smoothstep(0.99955, 0.99975, s));
        if (desat > 0.0) c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, 1.0 - desat);   // yansıma haritası: gök mavisi zemini / duvarları boyamasın (oda ortamı gibi nötr kalsın)
        gl_FragColor = vec4(c * uI, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), m);
  dome.frustumCulled = false; dome.renderOrder = -1000;
  dome.onBeforeRender = (r, scene) => { m.uniforms.uI.value = scene.backgroundIntensity ?? 1; };
  return dome;
}

const ENV_K = 1.0;
// Yansıma haritası kazancı: göğün ortalama parlaklığı ENV_L'ye çekilir (eski oda ortamı kadar ortam ışığı; gece göğü çok karanlık olsa da sahne / silah okunur kalır)
const ENV_L = 0.8;
function envGain(E, ground) {
  const L = (c) => { const k = new THREE.Color(c); return 0.2126 * k.r + 0.7152 * k.g + 0.0722 * k.b; };
  const avg = 0.5 * L(ground) + 0.5 * (0.25 * L(E.sky[2]) + 0.3 * L(E.sky[1]) + 0.45 * L(E.sky[0]));
  return Math.min(60, Math.max(0.5, ENV_L / Math.max(avg, 1e-3)));
}

// env: harita bazlı atmosfer (gökyüzü renkleri, sis, güneş, bulut) — verilmeyen alan varsayılanı kullanır
export function setupEnvironment(scene, renderer, { shadowSize = 85, sunPos: sunPos0 = [60, 90, 40], env: envOpt = {}, tod = 'day' } = {}) {
  const T = todEnv(envOpt, sunPos0, tod);
  const E = T.E, sunPos = T.sunPos;
  const sunDir = new THREE.Vector3(...sunPos).normalize();
  const dome = skyDome(E, sunDir, tod, E.fog[0]);
  scene.background = null;
  scene.add(dome);
  scene.fog = new THREE.Fog(E.fog[0], E.fog[1], E.fog[2]);

  // ortam yansıması (metal / silah parlaklığı): odadan değil, haritanın kendi göğünden + zemin renginden; günün saatiyle uyumlu
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(skyDome(E, sunDir, tod, new THREE.Color(E.hemi[1]).lerp(new THREE.Color(E.fog[0]), 0.35).multiplyScalar(0.7), true));
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  envScene.children[0].geometry.dispose(); envScene.children[0].material.dispose(); pmrem.dispose();
  scene.environmentIntensity = T.envI * ENV_K;

  scene.add(new THREE.HemisphereLight(E.hemi[0], E.hemi[1], E.hemi[2]));
  const sun = new THREE.DirectionalLight(E.sun[0], E.sun[1]);
  sun.position.set(...sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const s = shadowSize;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 10, far: 300 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  // alçak poligon bulutlar
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cloudMat = new THREE.MeshStandardMaterial({ color: E.cloud, emissive: E.cloud, emissiveIntensity: E.cloudGlow ?? 0.3, flatShading: true, roughness: 1, fog: false });   // kendi ışığı: alt yüzler koyu kaya gibi görünmesin
  for (let i = 0; i < E.clouds; i++) {
    const cl = new THREE.Group();
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(10 + rnd() * 9, 1), cloudMat);
      m.scale.set(1.5 + rnd() * 0.8, 0.5 + rnd() * 0.25, 1.1 + rnd() * 0.5);
      m.position.set((k - n / 2) * 14 + rnd() * 6, rnd() * 4, rnd() * 10);
      cl.add(m);
    }
    const a = rnd() * Math.PI * 2, r = 220 + rnd() * 220;
    cl.position.set(Math.cos(a) * r, 130 + rnd() * 50, Math.sin(a) * r);
    cl.rotation.y = rnd() * 6;
    scene.add(cl);
  }
  if (T.stars) {
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(a) * r * 480; pos[i * 3 + 1] = Math.abs(u) * 480 * 0.9 + 20; pos[i * 3 + 2] = Math.sin(a) * r * 480;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    // 12.199c: yıldız / ay kameraya bağlı gök küresi (eskiden dünya merkezinde 480 m'lik küre: büyük haritada (Kuzey Vadisi) haritanın ortasında
    // dağların önünde bir kubbe gibi duruyordu). Gök kubbesinden hemen sonra, derinlik yazmadan çizilir → dağ / ağaç / bina hep önünde
    const follow = (o, base) => {
      o.frustumCulled = false; o.renderOrder = -999; o.matrixAutoUpdate = false;
      o.onBeforeRender = (r, sc, cam) => { o.matrixWorld.makeTranslation(cam.matrixWorld.elements[12] + base.x, cam.matrixWorld.elements[13] + base.y, cam.matrixWorld.elements[14] + base.z); };
      scene.add(o);
    };
    follow(new THREE.Points(g, new THREE.PointsMaterial({ color: '#dfe8ff', size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false, depthTest: false })), new THREE.Vector3());
    const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 14, 10), new THREE.MeshBasicMaterial({ color: '#f1f5ff', fog: false, depthWrite: false, depthTest: false }));
    follow(moon, new THREE.Vector3(sunPos[0], sunPos[1], sunPos[2]).normalize().multiplyScalar(430));
  }
  // ışıyan malzemeler (lamba / pencere): çağrıldığında sahnedekileri günün saatine göre ayarlar
  const applyGlow = (root = scene) => root.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) if (m.userData && m.userData.glow) m.emissiveIntensity = T.glow;
  });
  applyGlow();
  return { sun, tod, night: tod === 'night', sunset: tod === 'sunset', sunPos, applyGlow, E, grade: todGrade(tod, envOpt), dome };
}
