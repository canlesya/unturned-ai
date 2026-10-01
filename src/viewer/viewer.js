import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCharacter, CLASSES } from '../models/character.js';
import { createWeapon, WEAPONS, WEAPON_INFO } from '../models/weapons.js';
import { createItem, ITEMS, ITEM_LABELS } from '../models/items.js';
import { box, cylY, ico, mat } from '../core/geo.js';
import { TEAMS } from '../core/palette.js';

const q = new URLSearchParams(location.search);
const view = q.get('view') || 'characters';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const labels = document.getElementById('labels');
const tracked = [];
function label(obj3d, title, sub, offset = new THREE.Vector3(), color = '') {
  const el = document.createElement('div');
  el.className = 'lbl';
  el.innerHTML = `<b${color ? ` style="color:${color}"` : ''}>${title}</b>${sub ? `<span>${sub}</span>` : ''}`;
  labels.appendChild(el);
  tracked.push({ el, obj3d, offset });
}
function setTitle(t, s) {
  document.getElementById('title').innerHTML = `${t}<small>${s || ''}</small>`;
}

// ───────────── Sahneler ─────────────
function lights(sunPos = [7, 11, 6], sunInt = 2.4, shadowSize = 12) {
  scene.add(new THREE.HemisphereLight('#bcd9ff', '#7a6a48', 1.25));
  const sun = new THREE.DirectionalLight('#fff0d2', sunInt);
  sun.position.set(...sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = shadowSize;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 50 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
}

function skyGradient() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5f9bd6');
  grad.addColorStop(0.55, '#a9cfe9');
  grad.addColorStop(1, '#dce8ee');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function pine(x, z, s = 1) {
  const g = new THREE.Group();
  cylY(g, 0.12 * s, 0.16 * s, 1.2 * s, '#5a3d24', [0, 0.6 * s, 0], 6);
  for (let i = 0; i < 4; i++) {
    const r = (1.25 - i * 0.28) * s;
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, 1.4 * s, 7), mat(i % 2 ? '#2f5a2c' : '#2a4f28'));
    m.position.y = (1.6 + i * 0.85) * s;
    m.castShadow = true;
    g.add(m);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rnd() * 6;
  scene.add(g);
}

function house(x, z, rot = 0) {
  const g = new THREE.Group();
  box(g, [6, 2.6, 4], '#d9c79a', [0, 1.3, 0]);
  // kırmızı çatı (iki eğimli kutu)
  const roofL = box(g, [6.4, 0.18, 2.8], '#a8432f', [0, 3.05, -1.05], [0.55, 0, 0]);
  const roofR = box(g, [6.4, 0.18, 2.8], '#a8432f', [0, 3.05, 1.05], [-0.55, 0, 0]);
  box(g, [0.9, 1.7, 0.1], '#6b4a2a', [-1.2, 0.85, 2.03]);
  box(g, [1.0, 0.9, 0.1], '#7fb0c9', [1.4, 1.5, 2.03]);
  box(g, [1.2, 0.12, 0.2], '#6b4a2a', [1.4, 0.98, 2.1]);
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  scene.add(g);
}

function lowPolyClouds() {
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2 + rnd() * 2.5, 0),
      new THREE.MeshStandardMaterial({ color: '#f2f4f6', flatShading: true, roughness: 1 })
    );
    m.scale.set(1.6 + rnd(), 0.6 + rnd() * 0.4, 1 + rnd() * 0.6);
    m.position.set(-60 + rnd() * 120, 22 + rnd() * 14, -50 - rnd() * 40);
    m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    scene.add(m);
  }
}

function outdoor() {
  scene.background = skyGradient();
  scene.fog = new THREE.Fog('#cfe0e8', 40, 130);
  lights();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(160, 24), mat('#7f9448', { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  scene.add(ground);
  // toprak yol/platform
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.9, 0.12, 8), mat('#b08a5f', { roughness: 1 }));
  pad.position.y = -0.06;
  pad.receiveShadow = true;
  scene.add(pad);
  // uzak tepeler
  for (let i = 0; i < 9; i++) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(14 + rnd() * 14, 8 + rnd() * 14, 6), mat(i % 2 ? '#6a5a42' : '#5d6b3d', { roughness: 1 }));
    h.position.set(-80 + i * 22 + rnd() * 6, 3, -75 - rnd() * 20);
    h.rotation.y = rnd() * 3;
    scene.add(h);
  }
  for (let i = 0; i < 26; i++) pine(-40 + rnd() * 80, -16 - rnd() * 30, 0.9 + rnd() * 0.9);
  house(-17, -14, 0.35);
  house(19, -16, -0.4);
  lowPolyClouds();
}

function studio() {
  scene.background = new THREE.Color('#2b2f38');
  scene.fog = null;
  lights([5, 9, 7], 2.2, 10);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: '#363b46', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(60, 60, '#59606e', '#434955');
  grid.position.y = 0.002;
  scene.add(grid);
}

// ───────────── Görünümler ─────────────
function setCam(pos, target) {
  camera.position.set(...pos);
  controls.target.set(...target);
  controls.update();
}

function viewCharacters() {
  outdoor();
  setTitle('Karakterler', 'Ön sıra: Mavi Takım · Arka sıra: Kırmızı Takım · 5 sınıf');
  const classes = Object.keys(CLASSES);
  ['blue', 'red'].forEach((team, row) => {
    classes.forEach((cls, i) => {
      const ch = createCharacter({ team, cls, skinIndex: i + row * 2 });
      ch.root.position.x = (i - 2) * 1.6 + (row ? 0.8 : 0);
      ch.root.position.z = row === 0 ? 2.6 : -2.6;
      ch.root.rotation.y = Math.PI + (row === 0 ? 0.85 : -0.85) + (q.get('back') === '1' ? Math.PI - (row === 0 ? 1.7 : -1.7) : 0);
      scene.add(ch.root);
      label(ch.root, CLASSES[cls].label, '', new THREE.Vector3(0, 2.0, 0), team === 'blue' ? '#8cc4ff' : '#ff9a88');
    });
  });
  setCam([0.2, 3.5, 13.2], [0.2, 1.05, 0]);
}

function viewCloseup() {
  outdoor();
  const cls = q.get('cls') || 'assault';
  const team = q.get('team') || 'blue';
  const weapon = q.get('weapon') || undefined;
  setTitle(CLASSES[cls].label + ' · ' + TEAMS[team].name, 'Yakın plan');
  const angles = (q.get('angles') || '0.7,-0.7,3.4').split(',').map(Number);
  angles.forEach((a, i) => {
    const ch = createCharacter({ team, cls, skinIndex: 0, weapon, optic: q.get('optic') || 'reddot' });
    // poz sınaması: ?melee=rl&k=0.4 · ?reload=mag&k=0.3&empty=1 · ?sprint=1
    const o = { sprint: +(q.get('sprint') || 0) };
    if (q.get('melee')) o.melee = { kind: q.get('melee'), k: +(q.get('k') || 0.4) };
    if (q.get('reload')) o.reload = { style: q.get('reload'), k: +(q.get('k') || 0.3), empty: q.get('empty') !== '0', ph: +(q.get('ph') || 0.3) };
    if (o.sprint || o.melee || o.reload) ch.refreshHold(o);
    ch.root.position.x = (i - (angles.length - 1) / 2) * 2.2;
    ch.root.rotation.y = Math.PI + a;
    scene.add(ch.root);
  });
  setCam([0, 1.45, angles.length > 1 ? 6.2 : 4.0], [0, 1.0, 0]);
}

function wall() {
  scene.background = new THREE.Color('#3b414f');
  lights([5, 9, 9], 2.3, 10);
  const grid = new THREE.GridHelper(80, 80, '#5a6273', '#4c5362');
  grid.rotation.x = Math.PI / 2;
  grid.position.z = -1.2;
  scene.add(grid);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#434a59', roughness: 1 }));
  back.position.z = -1.25;
  scene.add(back);
}

function viewWeapons() {
  wall();
  const all = Object.keys(WEAPONS);
  const per = 12, cols = 4, pages = Math.ceil(all.length / per);
  const page = Math.min(pages - 1, Math.max(0, +(q.get('page') || 0)));
  const ids = all.slice(page * per, page * per + per);
  setTitle('Silahlar', `${all.length} silah · sayfa ${page + 1}/${pages} · yan görünüş (?page=N)`);
  ids.forEach((id, i) => {
    const w = createWeapon(id);
    const col = i % cols, row = Math.floor(i / cols);
    const g = new THREE.Group();
    g.add(w);
    w.rotation.y = -Math.PI / 2;
    const bb = new THREE.Box3().setFromObject(w);
    w.position.sub(bb.getCenter(new THREE.Vector3()));
    const sz = bb.getSize(new THREE.Vector3());
    g.scale.setScalar(Math.min(1.5, 2.1 / sz.x, 0.75 / sz.y));
    g.position.set((col - (cols - 1) / 2) * 2.7, 1.5 - row * 1.5, 0);
    scene.add(g);
    label(g, w.userData.name, WEAPON_INFO[id], new THREE.Vector3(0, -0.4, 0));
  });
  setCam([0, 0.0, 9.4], [0, 0.0, 0]);
}

function spotlight() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 110, 10, 128, 128, 190);
  grad.addColorStop(0, '#59627a');
  grad.addColorStop(1, '#2a2f3b');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
  lights([4, 9, 7], 2.4, 6);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.28 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.0;
  shadow.receiveShadow = true;
  scene.add(shadow);
}

function viewWeapon() {
  spotlight();
  const id = q.get('id') || 'ak47';
  const w = createWeapon(id);
  setTitle(w.userData.name, WEAPON_INFO[id]);
  const g = new THREE.Group();
  g.add(w);
  w.rotation.y = -Math.PI / 2 + (Number(q.get('yaw')) || 0);
  const bb = new THREE.Box3().setFromObject(w);
  w.position.sub(bb.getCenter(new THREE.Vector3()));
  g.position.y = 0.55;
  scene.add(g);
  const d = Math.max(bb.getSize(new THREE.Vector3()).x, 0.6) * 1.3 + 0.3;
  setCam([d * 0.5, 0.95, d * 0.85], [0, 0.55, 0]);
}

function viewItems() {
  spotlight();
  setTitle('Eşyalar', 'Yerden toplanabilir');
  const ids = Object.keys(ITEMS);
  ids.forEach((id, i) => {
    const it = createItem(id);
    it.position.set((i - (ids.length - 1) / 2) * 0.7, 0, 0);
    it.rotation.y = -0.5;
    scene.add(it);
    label(it, ITEM_LABELS[id], '', new THREE.Vector3(0, -0.05, 0));
  });
  setCam([0, 0.8, 2.7], [0, 0.1, 0]);
}

const VIEWS = {
  characters: viewCharacters, closeup: viewCloseup, weapons: viewWeapons, weapon: viewWeapon, items: viewItems,
};
(VIEWS[view] || viewCharacters)();

if (q.get('cam')) {
  const [x, y, z] = q.get('cam').split(',').map(Number);
  camera.position.set(x, y, z);
}
if (q.get('target')) {
  const [x, y, z] = q.get('target').split(',').map(Number);
  controls.target.set(x, y, z);
}
controls.update();

// nav
const nav = document.getElementById('nav');
[['characters', 'Karakterler'], ['closeup', 'Yakın plan'], ['weapons', 'Silahlar'], ['items', 'Eşyalar']].forEach(([v, t]) => {
  const a = document.createElement('a');
  a.href = `?view=${v}`;
  a.textContent = t;
  if (v === view) a.className = 'on';
  nav.appendChild(a);
});
if (q.get('hud') === '0') { nav.style.display = 'none'; }

// ───────────── Döngü ─────────────
const tmp = new THREE.Vector3();
let frames = 0;
function frame() {
  controls.update();
  renderer.render(scene, camera);
  for (const t of tracked) {
    t.obj3d.getWorldPosition(tmp);
    tmp.add(t.offset).project(camera);
    t.el.style.left = ((tmp.x * 0.5 + 0.5) * innerWidth) + 'px';
    t.el.style.top = ((-tmp.y * 0.5 + 0.5) * innerHeight) + 'px';
  }
  if (++frames === 3) window.__ready = true;
  requestAnimationFrame(frame);
}
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
