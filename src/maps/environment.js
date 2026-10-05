import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
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

export function todEnv(env = {}, sunPos, tod = 'day') {
  const P = TOD_PRESETS[tod];
  const E = { ...DEFAULT_ENV, ...env };
  if (!P) return { E, sunPos, envI: 0.5, glow: 0, stars: false };
  const fog = [P.fog[0], Math.max(12, E.fog[1] * P.fog[1]), Math.max(110, E.fog[2] * P.fog[2])];
  return {
    E: { ...E, sky: P.sky, fog, sun: P.sun, hemi: P.hemi, cloud: P.cloud, cloudGlow: P.cloudGlow },
    sunPos: P.sunPos, envI: P.envI, glow: P.glow, stars: !!P.stars,
  };
}

// env: harita bazlı atmosfer (gökyüzü renkleri, sis, güneş, bulut) — verilmeyen alan varsayılanı kullanır
export function setupEnvironment(scene, renderer, { shadowSize = 85, sunPos: sunPos0 = [60, 90, 40], env: envOpt = {}, tod = 'day' } = {}) {
  const T = todEnv(envOpt, sunPos0, tod);
  const E = T.E, sunPos = T.sunPos;
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, E.sky[0]);
  grad.addColorStop(0.55, E.sky[1]);
  grad.addColorStop(1, E.sky[2]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
  scene.fog = new THREE.Fog(E.fog[0], E.fog[1], E.fog[2]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = T.envI;

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
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#dfe8ff', size: 2.2, sizeAttenuation: false, fog: false })));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 14, 10), new THREE.MeshBasicMaterial({ color: '#f1f5ff', fog: false }));
    moon.position.set(sunPos[0], sunPos[1], sunPos[2]).normalize().multiplyScalar(430);
    scene.add(moon);
  }
  // ışıyan malzemeler (lamba / pencere): çağrıldığında sahnedekileri günün saatine göre ayarlar
  const applyGlow = (root = scene) => root.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) if (m.userData && m.userData.glow) m.emissiveIntensity = T.glow;
  });
  applyGlow();
  return { sun, tod, night: tod === 'night', sunset: tod === 'sunset', sunPos, applyGlow };
}
