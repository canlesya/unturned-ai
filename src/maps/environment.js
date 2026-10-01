import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mat } from '../core/geo.js';

// Gökyüzü, güneş/gölge, sis, bulutlar. Hem harita önizleme hem oyun içi kullanılır.
export function setupEnvironment(scene, renderer, { shadowSize = 85, sunPos = [60, 90, 40] } = {}) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5f9bd6');
  grad.addColorStop(0.55, '#a9cfe9');
  grad.addColorStop(1, '#dce8ee');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
  scene.fog = new THREE.Fog('#d3e2ea', 120, 420);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  scene.add(new THREE.HemisphereLight('#bcd9ff', '#7a6a48', 1.2));
  const sun = new THREE.DirectionalLight('#fff0d2', 2.5);
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
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#f4f6f8', flatShading: true, roughness: 1, fog: false });
  for (let i = 0; i < 18; i++) {
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
  return { sun };
}
