import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { setupEnvironment } from '../maps/environment.js';
import { MAPS, DEFAULT_MAP } from '../maps/index.js';
import { createCharacter, CLASSES } from '../models/character.js';

const q = new URLSearchParams(location.search);
const shot = q.get('shot') || 'aerial';
const mapId = q.get('map') || DEFAULT_MAP;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const t0 = performance.now();
const map = MAPS[mapId].build();
const sunPos = map.env?.sunPos || [60, 90, 40];
const envApi = setupEnvironment(scene, renderer, { env: map.env, sunPos, tod: q.get('tod') || 'day' });
scene.add(map.group);
envApi.applyGlow(map.group);
console.log(`harita üretildi: ${map.name} ${(performance.now() - t0).toFixed(0)} ms, ${map.colliders.length} çarpışma kutusu`);

const gh = (x, z) => (map.terrain ? map.terrain.heightAt(x, z) : 0);

// ── ölçek için botlar ──
const CLS = Object.keys(CLASSES);
function place(team, i, x, z, ry) {
  const ch = createCharacter({ team, cls: CLS[i % CLS.length], skinIndex: i });
  ch.root.position.set(x, gh(x, z), z);
  ch.root.rotation.y = ry;
  scene.add(ch.root);
}
if (q.get('bots') !== '0') {
  for (let i = 0; i < 5; i++) {
    const s = map.spawns.blue[i], r = map.spawns.red[i];
    place('blue', i, s.x, s.z, s.ry);
    place('red', i, r.x, r.z, r.ry);
  }
}

// ── plan işaretleri ──
const labels = document.getElementById('labels');
const tracked = [];
function addLabel(pos, html, color) {
  const el = document.createElement('div');
  el.className = 'lbl';
  el.innerHTML = `<b style="color:${color}">${html}</b>`;
  labels.appendChild(el);
  tracked.push({ el, pos: new THREE.Vector3(...pos) });
}
if (q.get('markers') === '1') {
  const ringMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  for (const o of map.objectives) {
    const m = new THREE.Mesh(new THREE.RingGeometry(o.r - 0.6, o.r, 40), ringMat(o.core ? '#ffffff' : '#ffd27a'));
    m.rotation.x = -Math.PI / 2; m.position.set(o.x, gh(o.x, o.z) + 0.4, o.z); scene.add(m);
    addLabel([o.x, gh(o.x, o.z) + 14, o.z], o.name, o.core ? '#ffffff' : '#ffd27a');
  }
  for (const [team, c, nm] of [['blue', '#4aa3ff', 'MAVİ DOĞUŞ'], ['red', '#ff5a43', 'KIRMIZI DOĞUŞ']]) {
    const sp = map.spawns[team];
    const cx = sp.reduce((a, s) => a + s.x, 0) / sp.length, cz = sp.reduce((a, s) => a + s.z, 0) / sp.length;
    const m = new THREE.Mesh(new THREE.RingGeometry(8, 9, 40), ringMat(c));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, gh(cx, cz) + 0.4, cz); scene.add(m);
    addLabel([cx, gh(cx, cz) + 14, cz], nm, c);
  }
}

// ── kamera ──
const PRESETS = {
  kasaba: {
    aerial: { pos: [-92, 78, 112], target: [2, 0, 4], fov: 38 },
    blue: { pos: [-66, 1.8, 5], target: [-20, 1.8, -1], fov: 62 },
    red: { pos: [66, 1.8, -5], target: [20, 1.8, 1], fov: 62 },
    street: { pos: [-22, 1.75, 2.5], target: [30, 2.2, -1], fov: 60 },
    gas: { pos: [4, 2.2, -2], target: [20, 2.2, -14], fov: 60 },
    market: { pos: [4, 2, 4.5], target: [20, 3, 18], fov: 60 },
    church: { pos: [-8, 2, 6], target: [-21, 4, 24], fov: 58 },
    farm: { pos: [-42, 2.4, 8], target: [-60, 3, -24], fov: 60 },
    depot: { pos: [44, 2.4, -6], target: [58, 3, -28], fov: 60 },
    tower: { pos: [-40, 6.5, -6], target: [-62, 6, -20], fov: 60 },
    interior: { pos: [-23.5, 1.65, -20.6], target: [-27, 1.3, -10], fov: 74 },
    upstairs: { pos: [21, 4.9, 24.2], target: [21, 4.3, 10], fov: 72 },
    churchin: { pos: [-21, 1.7, 33], target: [-21, 2.6, 18], fov: 68 },
  },
  vadi: {
    aerial: { pos: [-135, 95, 110], target: [0, 0, 0], fov: 40 },
    blue: { pos: [-70, 3.6, 8], target: [-20, 2.0, -2], fov: 62 },
    red: { pos: [70, 3.6, -4], target: [20, 2.0, 4], fov: 62 },
    bridge: { pos: [-22, 2.2, 3], target: [6, 1.2, 0], fov: 62 },
    bridge2: { pos: [14, 3.0, -9], target: [0, 0.4, 0], fov: 58 },
    ford: { pos: [-12, 1.8, 36], target: [8, 0.2, 24], fov: 62 },
    ridge: { pos: [-24, 15, -50], target: [4, 2, 10], fov: 60 },
    sniper: { pos: [-17, 15, -44], target: [30, 2, 25], fov: 40 },
    camp: { pos: [5, 12, 33], target: [18, 11, 40], fov: 60 },
    mill: { pos: [16, 3.5, -8], target: [32, 3, -22], fov: 60 },
    barn: { pos: [-48, 4.2, 6], target: [-70, 4, -14], fov: 60 },
    ambar: { pos: [-20, 3, 12], target: [-32, 3.5, 22], fov: 60 },
  },
  us: {
    aerial: { pos: [-118, 92, 124], target: [0, 0, 4], fov: 42 },
    aerial2: { pos: [112, 80, -126], target: [0, 0, 0], fov: 44 },
    blue: { pos: [-59, 2.0, 1], target: [-76, 1.4, -6], fov: 66 },
    campaerial: { pos: [-50, 16, 24], target: [-70, 0, -2], fov: 56 },
    red: { pos: [59, 2.0, -1], target: [76, 1.4, 6], fov: 66 },
    gate: { pos: [-44, 1.8, 0], target: [-57, 1.8, 0], fov: 72 },
    gateN: { pos: [-67, 1.8, -34], target: [-67, 1.8, -22], fov: 70 },
    street: { pos: [-50, 1.8, -9], target: [20, 3, -2], fov: 62 },
    avenue: { pos: [-30, 1.8, 2], target: [10, 3, -1], fov: 62 },
    command: { pos: [-6, 2, 25], target: [0, 5, 0], fov: 62 },
    commandin: { pos: [-3.4, 1.7, -6.2], target: [-3.4, 1.5, 5], fov: 76 },
    commandin0: { pos: [4.2, 1.7, -6.2], target: [7.5, 1.3, -0.5], fov: 78 },
    commandin1: { pos: [-3.4, 4.9, -6.2], target: [3.5, 4.3, 3], fov: 76 },
    commandin2: { pos: [9.2, 8.1, 6.1], target: [-0.5, 7.4, -2.5], fov: 76 },
    commandroof: { pos: [8, 11.2, 5.5], target: [-4, 10.4, -3], fov: 74 },
    hangar: { pos: [-4, 2, -26], target: [0, 3, -45], fov: 64 },
    hangarin: { pos: [0, 1.7, -37.5], target: [-3, 2.2, -50], fov: 76 },
    hangarmezz: { pos: [-11, 4.7, -49.5], target: [8, 2.5, -42], fov: 76 },
    radar: { pos: [-14, 2, 27], target: [0, 6, 44], fov: 62 },
    radarin: { pos: [-1.6, 1.7, 48.2], target: [2, 1.4, 41], fov: 78 },
    radartop: { pos: [-3.5, 11.6, 48], target: [2, 11.2, 40], fov: 74 },
    tunnel: { pos: [-52.8, 1.7, -36], target: [-28, 1.7, -36], fov: 72 },
    tunnelroof: { pos: [-46, 5.4, -40], target: [-28, 3.6, -36], fov: 66 },
    tower: { pos: [-30, 7, -16], target: [-20, 5.5, -22], fov: 62 },
    towertop: { pos: [-21, 8.4, -21], target: [-30, 7, -12], fov: 66 },
    kisla: { pos: [-20, 1.8, 3], target: [-34, 2, 14], fov: 62 },
    barracksin: { pos: [-36, 1.7, 8.5], target: [-40, 1.3, 14], fov: 76 },
    mess: { pos: [-36, 1.7, -9.8], target: [-36, 1.4, -14], fov: 78 },
    fuel: { pos: [14, 1.9, -8], target: [33, 3, -18], fov: 62 },
    heli: { pos: [34, 2.5, -36], target: [36, 3, -47], fov: 62 },
    ctower: { pos: [42, 1.8, -40], target: [51, 6, -44], fov: 62 },
    maze: { pos: [-56, 1.8, 30], target: [-70, 2, 42], fov: 70 },
    mazetop: { pos: [-60, 8, 30], target: [-70, 2, 44], fov: 70 },
    garage: { pos: [-56, 2, -40], target: [-66, 2, -55], fov: 66 },
    bunker: { pos: [-33, 1.8, -21], target: [-24, 1.4, -24], fov: 58 },
    outside: { pos: [-120, 18, -40], target: [-60, 3, -30], fov: 56 },
  },
};
const PR = PRESETS[mapId] || PRESETS.kasaba;

let camera, orbit;
if (shot === 'top') {
  scene.fog = null;
  const hh = 62, ha = innerWidth / innerHeight;
  camera = new THREE.OrthographicCamera(-hh * ha, hh * ha, hh, -hh, 1, 600);
  camera.position.set(0, 300, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  scene.traverse((o) => { if (o.isMesh && o.position.y > 60) o.visible = false; });
} else {
  const p = PR[shot] || PR.aerial;
  camera = new THREE.PerspectiveCamera(p.fov, innerWidth / innerHeight, 0.1, 900);
  camera.position.set(...p.pos);
  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.target.set(...p.target);
  orbit.update();
}
if (q.get('cam')) camera.position.set(...q.get('cam').split(',').map(Number));
if (q.get('target') && orbit) { orbit.target.set(...q.get('target').split(',').map(Number)); orbit.update(); }

document.getElementById('title').innerHTML = `Harita: ${map.name}<small>${shot}</small>`;
document.getElementById('nav').style.display = 'none';
if (q.get('clean') === '1') document.getElementById('title').style.display = 'none';

const tmp = new THREE.Vector3();
let frames = 0;
function frame() {
  orbit?.update();
  renderer.render(scene, camera);
  for (const t of tracked) {
    tmp.copy(t.pos).project(camera);
    t.el.style.left = ((tmp.x * 0.5 + 0.5) * innerWidth) + 'px';
    t.el.style.top = ((-tmp.y * 0.5 + 0.5) * innerHeight) + 'px';
  }
  if (++frames === 3) window.__ready = true;
  requestAnimationFrame(frame);
}
frame();
addEventListener('resize', () => {
  if (camera.isPerspectiveCamera) camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
