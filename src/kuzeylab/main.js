import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MapBuilder } from '../maps/builder.js';
import { KK, makeKuzeyMaterial } from '../maps/assets/kuzey/surface.js';
import { house, barn, church } from '../maps/assets/kuzey/house.js';
import { hall, silo, chimney, tank, office } from '../maps/assets/kuzey/industry.js';
import { stoneBridge, trussBridge, pylon, pole } from '../maps/assets/kuzey/infra.js';
import { helipad, hangar, barracks, hesco, watchtower, radarTower } from '../maps/assets/kuzey/military.js';
import { fence, stoneWall, logStack, crate, barrel, hayBale, streetLamp, jersey, wreck } from '../maps/assets/kuzey/props.js';
import { FLORA, makeFloraMaterial } from '../maps/assets/common/kuzeyFlora.js';

// Kuzey Vadisi varlık sayfası (12.172, yalnız taslak görseli; oyun kodu değişmez): her parça kendi karosunda, kendi kamerasıyla (¾ üstten),
// harita malzemesi + yüzey gölgelendiricisiyle. Etiket: ad · ölçü · üçgen · çarpışma kutusu.  /kuzeylab.html
MapBuilder.zfix = true;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setScissorTest(true); renderer.autoClear = false;
document.body.appendChild(renderer.domElement);
const envTex = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
document.getElementById('title').innerHTML = 'Kuzey Vadisi · varlık kütüphanesi<small>src/maps/assets/kuzey/* + assets/common/kuzey* · görünen = çarpışma (eksen hizalı kutular) · prosedürel yüzey (UV / doku dosyası yok)</small>';

const flatT = { heightAt: () => 0, slopeAt: () => 0, roadAt: () => 0 };
const riverT = { heightAt: (x, z) => { const d = Math.abs(z); return d > 30 ? 6.6 : d > 18 ? -3 + (6.6 + 3) * Math.min(1, ((d - 18) / 12) ** 1.4) : -3; }, slopeAt: () => 0, roadAt: () => 0 };
const surface = (T) => ({ ground: (x, z) => T.heightAt(x, z), kindOf: () => KK.PLAIN, seeded: true, material: makeKuzeyMaterial });
const mat = makeKuzeyMaterial();

const TILES = [
  ['Köy evi · 2 kat', 'içine girilir · merdiven + kat · panjur', (b, T) => house(b, T, { x: 0, z: 0, w: 9.5, d: 7, floors: 2, wall: '#d8cfbd', seed: 4 })],
  ['Köy evi · 1 kat', 'sac çatı · eğimde taş kaide', (b, T) => house(b, T, { x: 0, z: 0, w: 8, d: 6.4, floors: 1, wall: '#cdbb98', roof: '#5d6670', roofKind: KK.SHEET, seed: 2 })],
  ['Ahır', 'ahşap · 3,8 m kapı · saman', (b, T) => barn(b, T, { x: 0, z: 0, w: 16, d: 10, h: 5.6 })],
  ['Kilise', 'taş · 19 m çan kulesi · apsis', (b, T) => church(b, T, { x: 0, z: 0 })],
  ['Fabrika hali', 'çelik çerçeve · oluklu sac · asma kat', (b, T) => hall(b, T, { x: 0, z: 0, w: 44, d: 24, h: 9 })],
  ['İdare binası', '2 kat · bant pencere', (b, T) => office(b, T, { x: 0, z: 0, w: 18, d: 10 })],
  ['Silo + baca', 'yuvarlak gövde: içe çizilmiş 4 kutu', (b, T) => { for (let i = 0; i < 3; i++) silo(b, T, { x: -9 + i * 7.5, z: 0, r: 3.2, h: 17 }); chimney(b, T, { x: 12, z: -6, h: 34 }); }],
  ['Yakıt tankı', 'Ø 12 m · merdiven bandı', (b, T) => { tank(b, T, { x: -4, z: 0, r: 6, h: 8 }); tank(b, T, { x: 10, z: 4, r: 4, h: 6, color: '#bfc4c0' }); }],
  ['Hangar', 'açık ön · sac çatı', (b, T) => hangar(b, T, { x: 0, z: 0, w: 26, d: 20, h: 9 })],
  ['Koğuş + HESCO', 'ahşap koğuş · 2 sıra sepet', (b, T) => { barracks(b, T, { x: 0, z: -4, w: 20, d: 7 }); hesco(b, T, -12, 6, 12, 6); }],
  ['Gözetleme kulesi', '7,5 m platform · merdiven', (b, T) => watchtower(b, T, { x: 0, z: 0, h: 7.5 })],
  ['Radar kulesi', '14 m · iç merdiven · kubbe', (b, T) => radarTower(b, T, { x: 0, z: 0 })],
  ['Helikopter pisti', 'Ø 20 m · H · kenar lambası', (b, T) => helipad(b, T, { x: 0, z: 0, r: 10, team: 'blue' })],
  ['Taş kemer köprü', 'boy araziden · basamaklı kemer', (b, T) => stoneBridge(b, T, { id: 'L', x: 0, z: 0, deck: 6.2, w: 11 }), riverT],
  ['Çelik kafes köprü', 'dikme + üst başlık katı · çapraz ince', (b, T) => trussBridge(b, T, { id: 'L2', x: 0, z: 0, deck: 6.5, w: 8.5 }), riverT],
  ['Enerji nakil direği', '30 m kafes · iki travers', (b, T) => pylon(b, T, 0, 0, 0)],
  ['Yol kenarı', 'elektrik direği · lamba · bariyer · araç', (b, T) => { pole(b, T, -6, -2); streetLamp(b, T, -2, -3); jersey(b, T, 3, 2, 'x', 3); wreck(b, T, -2, 4, 0, 'car', '#6e5a4a'); }],
  ['Çit · duvar · kütük', 'saman · varil · sandık', (b, T) => { fence(b, T, -8, -4, 8, -4); stoneWall(b, T, -8, 4, 4, 4); logStack(b, T, 2, 0, 'x', 6, 3); for (let i = 0; i < 3; i++) hayBale(b, T, -6 + i * 1.4, 0); barrel(b, T, 6, 1); barrel(b, T, 6.8, 1.6, '#a3392e'); crate(b, T, -2, 1.6); crate(b, T, -0.8, 1.9, 0.9); }],
  ['Ağaçlar · L0', 'çam · ladin · huş · meşe · çalı · kaya', 'flora0'],
  ['Ağaçlar · L1 (uzak)', 'aynı türlerin kaba silüeti', 'flora1'],
];

const cols = 5, rows = Math.ceil(TILES.length / cols), top = 44, W = innerWidth, H = innerHeight - top, tw = W / cols, th = H / rows;
const labels = document.getElementById('labels');
const tiles = TILES.map(([name, sub, fn, T0], i) => {
  const T = T0 || flatT, scene = new THREE.Scene();
  scene.environment = envTex; scene.environmentIntensity = 0.4;
  scene.background = new THREE.Color('#9fb7c9');
  scene.add(new THREE.HemisphereLight('#bcd8ff', '#6b6248', 1.1));
  const sun = new THREE.DirectionalLight('#fff3e2', 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  let obj, tris = 0, cols0 = 0;
  if (typeof fn === 'function') {
    const b = new MapBuilder(); b.surface = surface(T);
    fn(b, T); obj = b.build(); cols0 = b.colliders.length;
  } else {
    obj = new THREE.Group(); const L = fn === 'flora0' ? 'L0' : 'L1', fm = makeFloraMaterial(false), rm = makeFloraMaterial(false);
    ['pine', 'spruce', 'birch', 'oak', 'bush', 'rock'].forEach((k, j) => {
      const s = k === 'bush' ? 2 : k === 'rock' ? 2.6 : FLORA[k].h[0] * 0.9 + 2, m = new THREE.Mesh(FLORA[k][L](), k === 'rock' ? rm : fm);
      m.scale.set(k === 'rock' ? s * 1.4 : s, s, k === 'rock' ? s * 1.2 : s); m.position.set((j - 2.5) * 6.4, 0, 0); m.castShadow = true; m.receiveShadow = true; obj.add(m);
    });
  }
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  scene.add(obj);
  const bb = new THREE.Box3().setFromObject(obj), size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  // zemin: düz çimen ya da (köprü) nehir kesiti
  if (T === riverT) {
    const g = new THREE.PlaneGeometry(90, 90, 90, 90); g.rotateX(-Math.PI / 2); const p = g.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, T.heightAt(p.getX(k), p.getZ(k)) - 0.02); g.computeVertexNormals();
    const gm = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#6e7e43', roughness: 1 })); gm.receiveShadow = true; scene.add(gm);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(90, 36), new THREE.MeshStandardMaterial({ color: '#2f4f55', roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 })); w.rotation.x = -Math.PI / 2; scene.add(w);
  } else { const gm = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#6e7e43', roughness: 1 })); gm.rotation.x = -Math.PI / 2; gm.position.y = -0.01; gm.receiveShadow = true; scene.add(gm); }
  const R = Math.max(size.x, size.y * 1.15, size.z) * 0.62 + 1;
  const cam = new THREE.PerspectiveCamera(32, tw / th, 0.1, 2000), dir = new THREE.Vector3(0.78, 0.55, 1.0).normalize();
  cam.position.copy(c).addScaledVector(dir, R / Math.tan((32 * Math.PI) / 360) * 0.92); cam.lookAt(c.x, c.y - size.y * 0.05, c.z);
  sun.position.copy(c).add(new THREE.Vector3(R * 1.2, R * 2.2, R * 0.9)); sun.target.position.copy(c);
  Object.assign(sun.shadow.camera, { left: -R * 1.5, right: R * 1.5, top: R * 1.5, bottom: -R * 1.5, near: 0.5, far: R * 6 }); sun.shadow.camera.updateProjectionMatrix();
  const x = (i % cols) * tw, y = top + Math.floor(i / cols) * th;
  const el = document.createElement('div'); el.className = 'lbl'; el.style.left = x + 'px'; el.style.top = y + 'px';
  el.innerHTML = `<b>${name}</b><span>${sub}</span><span>${size.x.toFixed(1)} × ${size.z.toFixed(1)} × ${size.y.toFixed(1)} m · ${Math.round(tris).toLocaleString('tr-TR')} üçgen${cols0 ? ` · ${cols0} kutu` : ''}</span>`;
  labels.appendChild(el);
  return { scene, cam, x, y };
});
renderer.setClearColor('#1d2022'); renderer.clear();
for (const t of tiles) {
  const yy = innerHeight - t.y - th;
  renderer.setViewport(t.x + 2, yy + 2, tw - 4, th - 4); renderer.setScissor(t.x + 2, yy + 2, tw - 4, th - 4);
  renderer.render(t.scene, t.cam);
}
window.__ready = true;
