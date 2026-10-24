// 12.157 Uzay modu görsel sayfaları (spacelab.html): oyunun kendi modelleri / malzemeleriyle — silah sayfası, karakter sayfası, doku örnekleri.
//   ?v=weapons   5 enerji silahı yandan (dik izdüşüm) + 3/4 görünüm, adlar ve sayılar
//   ?v=chars     iki takım × önden / yandan / arkadan + sınıf sırası
//   ?v=tex       regolit / kaya / gövde / iç zemin / güneş paneli / iniş pisti / ızgara örnekleri + gök (Dünya, yıldız, güneş)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createWeapon } from '../models/weapons.js';
import { createCharacter } from '../models/character.js';
import { WSTATS } from '../game/stats.js';
import { makeYorungeMaterial, YK } from '../maps/yorungeSurface.js';
import { earthTexture } from '../maps/yorunge.js';

const q = new URLSearchParams(location.search), view = q.get('v') || 'weapons';
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#12151c');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5;
scene.add(new THREE.HemisphereLight('#c8d4e8', '#2a2c30', 0.9));
const sun = new THREE.DirectionalLight('#fff6e6', 2.4); sun.position.set(4, 8, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 }); scene.add(sun);
const labels = document.getElementById('labels'), tracked = [];
const label = (obj, title, sub, off = new THREE.Vector3()) => { const el = document.createElement('div'); el.className = 'lbl'; el.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`; labels.appendChild(el); tracked.push({ el, obj, off }); };
const title = (t, s) => { document.getElementById('title').innerHTML = `${t}<small>${s}</small>`; };
let camera;
const A = innerWidth / innerHeight;

if (view === 'weapons') {
  title('UZAY MODU · ENERJİ SİLAHLARI', 'S3 kiti (BattleBit dili) · ışıyan enerji parçaları · aynı tutuş / nişan sözleşmesi');
  const H = 4.4; camera = new THREE.OrthographicCamera(-H * A / 2, H * A / 2, H / 2, -H / 2, 0.1, 50); camera.position.set(12, 0, 0); camera.lookAt(0, 0, 0);
  const ids = ['laser', 'plasma', 'epistol', 'railgun', 'scatter', 'elmg'], optic = { laser: 'iron', plasma: 'iron', epistol: 'iron', railgun: 'scope', scatter: 'iron', elmg: 'iron' };
  ids.forEach((id, i) => {
    const col = i % 2, row = Math.floor(i / 2), y = 1.05 - row * 1.32, zc = col ? -1.95 : 1.95, st = WSTATS[id];
    const w = createWeapon(id, optic[id], false); w.scale.setScalar(2.1); w.position.set(0, y, zc + 0.45 * 2.1 * (WSTATS[id].slot === 'secondary' ? 0.2 : 1)); scene.add(w);
    const w2 = createWeapon(id, id === 'railgun' ? 'scope' : id === 'epistol' ? 'reddot' : 'holo', false); w2.scale.setScalar(0.95); w2.position.set(0, y + 0.42, zc - 1.05); w2.rotation.set(0.25, -0.85, 0.08); scene.add(w2);
    label(w, st.name, `${st.dmg}${st.pellets ? '×' + st.pellets : ''} hasar · ${st.rpm} atış/dk · şarjör ${st.mag}${st.scope ? ' · 4× dürbün' : ''}${st.heat ? ' · ısınan namlu' : ''}`, new THREE.Vector3(0, -0.36, -0.6));
  });
  const grid = new THREE.GridHelper(20, 40, '#2a3040', '#1c212c'); grid.rotation.z = Math.PI / 2; grid.position.x = -2; scene.add(grid);
} else if (view === 'one') {
  const id = q.get('id') || 'railgun', w = createWeapon(id, q.get('o') || 'iron', q.get('lod') === '1'); scene.add(w);
  title(WSTATS[id].name, JSON.stringify(w.userData.stats || {}));
  camera = new THREE.PerspectiveCamera(30, A, 0.01, 50); const ry = +(q.get('ry') || 0.6); camera.position.set(Math.sin(ry) * 1.6, 0.35, Math.cos(ry) * 1.6 - 0.35); camera.lookAt(0, 0.03, -0.35);
} else if (view === 'chars') {
  title('UZAY MODU · UZAY KIYAFETLERİ', 'Mavi / Kırmızı · önden · yandan · arkadan · alttaki sıra: sınıflar (Saldırı, Sıhhiye, Keskin Nişancı, Ağır Destek, Mühendis)');
  camera = new THREE.PerspectiveCamera(28, A, 0.1, 100); camera.position.set(0, 4.2, 17); camera.lookAt(0, 1.0, -1.5);
  const ground = new THREE.Mesh(new THREE.BoxGeometry(30, 0.2, 12), makeYorungeMaterial()); ground.position.y = -0.1; ground.receiveShadow = true;
  const n = ground.geometry.attributes.position.count; ground.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.3), 3)); ground.geometry.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(n).fill(YK.REGOLITH), 1));
  scene.add(ground);
  const views = [['blue', Math.PI, 'önden'], ['blue', -Math.PI / 2, 'yandan'], ['blue', 0, 'arkadan'], ['red', Math.PI, 'önden'], ['red', Math.PI / 2, 'yandan'], ['red', 0, 'arkadan']];
  views.forEach(([team, ry, t], i) => {
    const ch = createCharacter({ team, cls: 'assault', weapon: team === 'blue' ? 'laser' : 'plasma', outfit: 'space', optic: 'holo' });
    ch.root.position.set(-6.0 + i * 2.4, 0, 1.5); ch.root.rotation.y = ry + (ry === Math.PI ? -0.25 : 0); scene.add(ch.root);
    ch.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    label(ch.root, team === 'blue' ? 'Mavi' : 'Kırmızı', t, new THREE.Vector3(0, -0.05, 0));
  });
  const cls = [['assault', 'laser', 'Saldırı'], ['medic', 'plasma', 'Sıhhiye'], ['sniper', 'railgun', 'Keskin N.'], ['heavy', 'laser', 'Ağır Destek'], ['engineer', 'scatter', 'Mühendis']];
  cls.forEach(([c, w, nm], i) => {
    const team = i % 2 ? 'red' : 'blue', ch = createCharacter({ team, cls: c, weapon: w, outfit: 'space', optic: 'reddot' });
    ch.root.position.set(-5.6 + i * 2.8, 0, -5); ch.root.rotation.y = Math.PI - 0.5; scene.add(ch.root);
    label(ch.root, nm, '', new THREE.Vector3(0, -0.05, 0));
  });
  sun.position.set(5, 9, 8);
} else {
  title('YÖRÜNGE ÜSSÜ · YÜZEY + GÖK ÖRNEKLERİ', 'Prosedürel gölgelendirici (dünya koordinatlı, doku dosyası yok) · uzay göğü: yıldız alanı, Dünya, güneş parlaması');
  camera = new THREE.PerspectiveCamera(32, A, 0.1, 200); camera.position.set(0, 15, 25); camera.lookAt(0, -0.5, -1);
  const M = makeYorungeMaterial();
  const sample = (kind, color, x, z, size = [3.2, 1.2, 3.2], name = '', sub = '') => {
    const g = new THREE.BoxGeometry(...size).toNonIndexed(), n = g.attributes.position.count, c = new THREE.Color(color);
    const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(n).fill(kind + 16 * ((x * 7 + z * 3) & 15)), 1));
    const m = new THREE.Mesh(g, M); m.position.set(x, size[1] / 2, z); m.castShadow = m.receiveShadow = true; scene.add(m);
    label(m, name, sub, new THREE.Vector3(0, -size[1] / 2 - 0.15, size[2] / 2));
  };
  const S = [[YK.REGOLITH, '#8d8c88', 'Regolit', 'Ay tozu · krater çukurları'], [YK.ROCK, '#6e6c68', 'Ay kayası', 'köşeli · tozlu tepe'], [YK.HULL, '#d9d7cf', 'Modül gövdesi', 'panel derzi · perçin'], [YK.PLATE, '#7d838a', 'İç zemin', 'plaka + tırtıl'],
    [YK.SOLAR, '#1d2c4a', 'Güneş paneli', 'hücre ızgarası'], [YK.PAD, '#9a9890', 'İniş pisti', 'döşeme + is'], [YK.GRATE, '#4a4f55', 'Izgara', 'iskele / köprü'], [YK.STRIPE, '#e2b52c', 'Uyarı şeridi', 'kapı eşiği']];
  S.forEach(([k, c, nm, sub], i) => sample(k, c, -10.5 + (i % 4) * 7, i < 4 ? -4 : 3.2, [5.6, i % 4 === 2 ? 2.6 : 1.0, 4.2], nm, sub));
  scene.background = new THREE.Color('#020308');
  const earth = new THREE.Mesh(new THREE.SphereGeometry(3.2, 48, 32), new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.85, emissive: '#0a1a33', emissiveIntensity: 0.25 }));
  earth.position.set(14, 4.2, -12); earth.rotation.set(0.35, 2.2, 0.15); scene.add(earth);
  label(earth, 'Dünya', 'prosedürel doku · gökte ≈ 12°', new THREE.Vector3(0, -3.6, 0));
  const n = 900, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 120; pos[i * 3 + 1] = Math.random() * 50 + 2; pos[i * 3 + 2] = -40 - Math.random() * 20; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, color: '#dfe6ff' })));
  sun.position.set(-6, 8, 10);
}
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  const v = new THREE.Vector3();
  for (const t of tracked) { t.obj.getWorldPosition(v).add(t.off).project(camera); t.el.style.left = ((v.x + 1) / 2) * innerWidth + 'px'; t.el.style.top = ((1 - v.y) / 2) * innerHeight + 'px'; }
});
window.__ready = true;
