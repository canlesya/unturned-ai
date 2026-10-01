import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { setupEnvironment } from '../maps/environment.js';
import { buildKasaba } from '../maps/kasaba.js';
import { createCharacter, CLASSES } from '../models/character.js';

const q = new URLSearchParams(location.search);
const shot = q.get('shot') || 'aerial';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
setupEnvironment(scene, renderer);

const t0 = performance.now();
const map = buildKasaba();
scene.add(map.group);
console.log(`harita üretildi: ${(performance.now() - t0).toFixed(0)} ms, ${map.colliders.length} çarpışma kutusu`);

// ── ölçek için botlar ──
const CLS = Object.keys(CLASSES);
function place(team, i, x, z, ry) {
  const ch = createCharacter({ team, cls: CLS[i % CLS.length], skinIndex: i });
  ch.root.position.set(x, 0, z);
  ch.root.rotation.y = ry;
  scene.add(ch.root);
}
if (q.get('bots') !== '0') {
  for (let i = 0; i < 5; i++) {
    const s = map.spawns.blue[i], r = map.spawns.red[i];
    place('blue', i, s.x, s.z, s.ry);
    place('red', i, r.x, r.z, r.ry);
  }
  place('blue', 0, -9, 2.2, -Math.PI / 2 + 0.3);
  place('red', 0, 9, -2.2, Math.PI / 2 + 0.3);
  place('blue', 2, 17, -6, -Math.PI / 2 + 0.2);
  place('red', 3, 24, 9, Math.PI / 2 + 1.2);
}

// ── plan işaretleri (yalnızca top/aerial) ──
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
    const m = new THREE.Mesh(new THREE.RingGeometry(o.r - 0.6, o.r, 40), ringMat('#ffffff'));
    m.rotation.x = -Math.PI / 2; m.position.set(o.x, 0.3, o.z); scene.add(m);
    addLabel([o.x, 14, o.z], o.name, '#ffffff');
  }
  for (const [team, c, nm] of [['blue', '#4aa3ff', 'MAVİ DOĞUŞ'], ['red', '#ff5a43', 'KIRMIZI DOĞUŞ']]) {
    const sp = map.spawns[team];
    const cx = sp.reduce((a, s) => a + s.x, 0) / sp.length, cz = sp.reduce((a, s) => a + s.z, 0) / sp.length;
    const m = new THREE.Mesh(new THREE.RingGeometry(8, 9, 40), ringMat(c));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.3, cz); scene.add(m);
    addLabel([cx, 14, cz], nm, c);
  }
}

// ── kamera ──
const PRESETS = {
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
};

let camera;
const controls = (cam) => { const c = new OrbitControls(cam, renderer.domElement); c.enableDamping = true; return c; };
let orbit;
if (shot === 'top') {
  const hh = 56, ha = innerWidth / innerHeight;
  camera = new THREE.OrthographicCamera(-hh * ha, hh * ha, hh, -hh, 1, 400);
  camera.position.set(0, 200, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  // üstten bakışta çatı yerine plan: bulutları gizle
  scene.traverse((o) => { if (o.isMesh && o.position.y > 60) o.visible = false; });
} else {
  const p = PRESETS[shot] || PRESETS.aerial;
  camera = new THREE.PerspectiveCamera(p.fov, innerWidth / innerHeight, 0.1, 900);
  camera.position.set(...p.pos);
  orbit = controls(camera);
  orbit.target.set(...p.target);
  orbit.update();
}
if (q.get('cam')) camera.position.set(...q.get('cam').split(',').map(Number));
if (q.get('target') && orbit) { orbit.target.set(...q.get('target').split(',').map(Number)); orbit.update(); }

document.getElementById('title').innerHTML = `Harita: ${map.name}<small>${{
  aerial: 'Kuş bakışı', top: 'Üstten plan (hedefler ve doğuş alanları işaretli)', blue: 'Mavi doğuş noktasından bakış', red: 'Kırmızı doğuş noktasından bakış',
  street: 'Ana cadde', gas: 'Benzinlik', market: 'Pazar (2 katlı)', church: 'Kilise', farm: 'Mavi üs: çiftlik', depot: 'Kırmızı üs: depo', tower: 'Gözetleme kulesi', interior: 'Ev içi (girilebilir)', upstairs: 'Pazar üst kat (pencereden bakış)', churchin: 'Kilise içi',
}[shot] || ''}</small>`;
document.getElementById('nav').style.display = 'none';

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
