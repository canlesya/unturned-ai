// Admin paneli 3D önizleme: oyunun kendi modelleri (silah / eşya / karakter / zombi). Büyük sahne + küçük resimler.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createWeapon } from '../src/models/weapons.js';
import { createItem } from '../src/models/items.js';
import { createCharacter } from '../src/models/character.js';
import { BOSS } from '../src/game/stats.js';

// spec: { kind: 'weapon'|'item'|'char'|'zombie'|'icon', id, cls, team, zt }
function build(spec) {
  if (spec.kind === 'weapon') {
    const g = createWeapon(spec.id);
    g.rotation.y = -Math.PI / 2;               // yandan
    return { obj: g, flat: true };
  }
  if (spec.kind === 'item') {
    if (spec.id === 'medkit') return { obj: createItem('medkit'), flat: false };
    return { obj: createWeapon(spec.id), flat: false };
  }
  if (spec.kind === 'char') {
    const ch = createCharacter({ team: spec.team || 'blue', cls: spec.cls || 'assault', skinIndex: 1, weapon: spec.weapon || null });
    return { obj: ch.root, char: true };
  }
  if (spec.kind === 'zombie') {
    const boss = spec.zt === 'boss';
    const ch = createCharacter({ team: 'zomb', cls: 'zombie', ztype: spec.zt || 'walker', skinIndex: 2 });
    if (boss) ch.root.scale.set(...BOSS.scale);
    return { obj: ch.root, char: true };
  }
  return null;
}

function frame(obj) {
  const g = new THREE.Group();
  g.add(obj);
  const bb = new THREE.Box3().setFromObject(obj), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
  obj.position.sub(c);
  return { g, size: sz };
}

function stage(renderer) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight('#c9d6ff', '#3a2a18', 1.1));
  const key = new THREE.DirectionalLight('#fff1dc', 1.9); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight('#ff9a3a', 2.2); rim.position.set(-4, 2, -3); scene.add(rim);
  return scene;
}

function makeRenderer(canvas, alpha = true) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, preserveDrawingBuffer: !canvas.isConnected });
  r.toneMapping = THREE.NeutralToneMapping;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor(0x000000, 0);
  return r;
}

// Büyük, dönen önizleme
export class Preview {
  constructor(host) {
    this.host = host;
    this.canvas = document.createElement('canvas');
    host.appendChild(this.canvas);
    this.r = makeRenderer(this.canvas);
    this.r.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = stage(this.r);
    // zemin: yumuşak turuncu hale + gölge diski
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    this.disc = disc; this.scene.add(disc);
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    this.ctl = new OrbitControls(this.cam, this.canvas);
    this.ctl.enableDamping = true; this.ctl.enablePan = false; this.ctl.autoRotate = true; this.ctl.autoRotateSpeed = 1.6;
    this.ctl.addEventListener('start', () => { this.ctl.autoRotate = false; clearTimeout(this._ar); });
    this.ctl.addEventListener('end', () => { this._ar = setTimeout(() => { this.ctl.autoRotate = true; }, 2500); });
    this.cur = null; this.key = '';
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    const loop = () => { requestAnimationFrame(loop); if (!this.host.isConnected) return; this.ctl.update(); this.r.render(this.scene, this.cam); };
    loop();
  }
  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.r.setSize(w, h, false);
    this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
  }
  show(spec) {
    const key = JSON.stringify(spec);
    if (key === this.key) return;
    this.key = key;
    if (this.cur) this.scene.remove(this.cur);
    this.cur = null;
    const b = spec && build(spec);
    this.host.classList.toggle('empty', !b);
    if (!b) return;
    const { g, size } = frame(b.obj);
    const R = Math.max(size.x, size.y, size.z);
    if (b.char) { g.position.y = size.y / 2; this.disc.position.y = 0.001; this.disc.scale.setScalar(size.y * 0.32); this.ctl.target.set(0, size.y * 0.52, 0); this.cam.position.set(size.y * 1.3, size.y * 0.95, size.y * 2.9); }
    else { const s = (b.flat ? 1 : 0.5) / R; g.scale.setScalar(s); g.position.y = 0.32; this.disc.position.y = 0; this.disc.scale.setScalar(0.42); this.ctl.target.set(0, 0.3, 0); this.cam.position.set(0.25, 0.55, 2.3); }
    this.ctl.autoRotate = true;
    this.cur = g;
    this.scene.add(g);
  }
}

// Küçük resimler: tek gizli renderer, sonuç önbellekte (dataURL)
let tr = null, tscene = null, tcam = null;
const cache = new Map();
export function thumb(spec, w = 168, h = 96) {
  const key = JSON.stringify(spec) + w + 'x' + h;
  if (cache.has(key)) return cache.get(key);
  const b = spec && build(spec);
  if (!b) { cache.set(key, ''); return ''; }
  if (!tr) {
    const c = document.createElement('canvas');
    tr = makeRenderer(c); tscene = stage(tr); tcam = new THREE.PerspectiveCamera(26, 1, 0.01, 100);
  }
  tr.setPixelRatio(2); tr.setSize(w, h, false);
  tcam.aspect = w / h; tcam.updateProjectionMatrix();
  const { g, size } = frame(b.obj);
  if (b.char) { tcam.position.set(size.y * 0.55, size.y * 0.5, size.y * 2.2); tcam.lookAt(0, size.y * 0.05, 0); }
  else {
    if (!b.flat) g.rotation.y = 0.7;
    const s = 1 / Math.max(size.x / (w / h), size.y, size.z * 0.6); g.scale.setScalar(s * 0.9);
    tcam.position.set(0, 0.15, 2.4); tcam.lookAt(0, 0, 0);
  }
  tscene.add(g);
  tr.render(tscene, tcam);
  const url = tr.domElement.toDataURL('image/png');
  tscene.remove(g);
  cache.set(key, url);
  return url;
}
