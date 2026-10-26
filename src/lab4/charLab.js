// 12.167 Karakter v2 + kıyafet kaplamaları: taslak / son görsel sayfaları (oyunun kendi modeli, malzemesi ve son işlemesi).
//   ?v=bodyA | bodyB   yön sayfası: iki takım önden / yandan / arkadan + sınıf varsayılanları
//   ?v=slot&s=head|top|back|legs|feet   yuva sayfası (montaj: scripts/charsheets.py)
//   ?v=pal     aynı kıyafet 7 palette (iki takım)      ?v=glow   ışıklı set (gece)
//   ?v=combos  kombin örnekleri    ?v=compare  mevcut ↔ A ↔ B    ?v=far  30 / 40 m okunurluk (FOV 72)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCharacter } from '../models/character.js';
import { PALETTES, CLASS_WEAR, WEAR_U } from '../models/wear.js';
import { WEAR_ITEMS, botWear as botWearFor } from '../game/wearIds.js';
import { t } from '../i18n/index.js';
import '../i18n/wear.js';
const SLOTS = Object.fromEntries(Object.entries(WEAR_ITEMS).map(([k, ids]) => [k, { name: t('wear.slot.' + k), items: Object.fromEntries(ids.map((i) => [i, t('wear.it.' + i)])) }]));
import { Post } from '../game/post.js';

const q = new URLSearchParams(location.search), view = q.get('v') || 'bodyA', style = q.get('b') || (view === 'bodyB' ? 'B' : 'A');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1d24');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55;
const hemi = new THREE.HemisphereLight('#d6dcea', '#3a3530', 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3e2', 2.5); sun.position.set(5, 9, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 }); scene.add(sun);
const labels = document.getElementById('labels'), tracked = [];
const label = (obj, t, sub, off = new THREE.Vector3()) => { const el = document.createElement('div'); el.className = 'lbl'; el.innerHTML = `<b>${t}</b>${sub ? `<span>${sub}</span>` : ''}`; labels.appendChild(el); tracked.push({ el, obj, off }); };
const title = (t, s) => { document.getElementById('title').innerHTML = `${t}<small>${s}</small>`; };
const A = innerWidth / innerHeight;
let camera, post = null;
const ground = (col = '#8a7d66', size = [40, 0.2, 20]) => { const g = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color: col, roughness: 0.95 })); g.position.y = -0.1; g.receiveShadow = true; scene.add(g); return g; };
const WPN = { assault: { blue: 'm4a1', red: 'ak47' }, medic: { blue: 'mp5', red: 'mp5' }, sniper: { blue: 'sniper', red: 'sniper' }, heavy: { blue: 'lmg', red: 'lmg' }, engineer: { blue: 'shotgun', red: 'shotgun' } };
const CLS_TR = { assault: 'Saldırı', medic: 'Sıhhiye', sniper: 'Keskin Nişancı', heavy: 'Ağır Destek', engineer: 'Mühendis' };
function soldier({ team = 'blue', cls = 'assault', wear = {}, body = style, x = 0, z = 0, ry = Math.PI, old = false, skinIndex = 1, weapon }) {
  const ch = createCharacter({ team, cls, skinIndex, weapon: weapon ?? WPN[cls][team], optic: 'holo', ...(old ? { body: 'old' } : { wear, body }) });
  ch.root.position.set(x, 0, z); ch.root.rotation.y = ry; scene.add(ch.root);
  ch.root.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return ch;
}
const stats = (ch) => { let tri = 0, dc = 0; ch.root.traverse((o) => { if (o.isMesh) { dc++; tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } }); return { tri: Math.round(tri), dc }; };
window.__stats = {};

if (view === 'bodyA' || view === 'bodyB') {
  const B = view === 'bodyB';
  title(B ? 'YÖN B · KAHRAMAN ORANI' : 'YÖN A · RAFİNE (MEVCUT İSKELET)', B
    ? 'Geniş omuz (+10 %), V gövde, küçük baş, uzun / ince bacak · pahlı hacimler · takım rengi: kollar, iki kol bandı, omuz şeridi, başlık şeridi, sırt yaması'
    : 'Aynı eklem yerleri ve boy · pahlı (bevel) hacimler, konik gövde, yaka / cep / kemer / dizlik katmanları · takım rengi: kollar, iki kol bandı, omuz şeridi, başlık şeridi, sırt yaması');
  camera = new THREE.PerspectiveCamera(34, A, 0.1, 100); camera.position.set(0, 2.5, 12.6); camera.lookAt(0, 0.85, -1.2);
  ground('#7d7260');
  const views = [['blue', Math.PI - 0.3, 'önden'], ['blue', -Math.PI / 2, 'yandan'], ['blue', 0.25, 'arkadan'], ['red', Math.PI - 0.3, 'önden'], ['red', Math.PI / 2, 'yandan'], ['red', -0.25, 'arkadan']];
  views.forEach(([team, ry, t], i) => { const ch = soldier({ team, x: -5.1 + i * 2.04, z: 1.4, ry }); label(ch.root, team === 'blue' ? 'Mavi · Saldırı' : 'Kırmızı · Saldırı', t); if (!i) window.__stats.one = stats(ch); });
  Object.keys(CLS_TR).forEach((cls, i) => {
    const team = i % 2 ? 'red' : 'blue', ch = soldier({ team, cls, x: -5.6 + i * 2.8, z: -3.4, ry: Math.PI - 0.45 });
    const W = CLASS_WEAR[cls];
    label(ch.root, CLS_TR[cls], `${SLOTS.head.items[W.head]} · ${SLOTS.top.items[W.top]} · ${SLOTS.back.items[W.back]}`);
  });
} else if (view === 'slot') {
  const s = q.get('s') || 'head', S = SLOTS[s], ids = Object.keys(S.items);
  title(`KIYAFET YUVASI · ${S.name.toUpperCase()}`, 'Standart palet · diğer yuvalar sınıf varsayılanı · ✦ = ışıklı set');
  const frame = { head: [1.58, 0, 5.4], top: [1.2, 0, 7.4], back: [1.05, 0, 7.8], legs: [0.6, 0, 6.6], feet: [0.12, 0, 3.2] }[s];
  const n = ids.length, gap = s === 'head' ? 0.6 : s === 'feet' ? 0.5 : s === 'legs' ? 0.95 : 1.02;
  camera = new THREE.PerspectiveCamera(26, A, 0.05, 100); camera.position.set(0, frame[0] + (s === 'feet' ? 0.75 : 0.15), frame[2]); camera.lookAt(0, frame[0] - (s === 'head' ? 0.08 : 0), 0);
  ground('#7d7260');
  const back = s === 'back';
  ids.forEach((id, i) => {
    const team = i % 2 ? 'red' : 'blue', wear = { [s]: id }, ry = back ? 0.55 : Math.PI - 0.55;
    const ch = soldier({ team, wear, x: (i - (n - 1) / 2) * gap, z: 0, ry, weapon: s === 'head' || s === 'feet' ? null : undefined });
    label(ch.root, S.items[id], '', new THREE.Vector3(0, s === 'head' ? 1.3 : s === 'top' ? 0.55 : s === 'back' ? 0.25 : -0.04, 0));
  });
  if (s === 'head' || s === 'feet') sun.position.set(3, 6, 9);
} else if (view === 'pal') {
  title('RENK / DESEN PALETLERİ', 'Aynı kıyafet (Taktik Kask · Taktik Yelek · Sırt Çantası · Taktik · Taktik Bot) · kamuflaj tek gölgelendiricide (silah kaplamalarıyla aynı aile) · takım rengi yuvaları sabit');
  camera = new THREE.PerspectiveCamera(31, A, 0.1, 100); camera.position.set(0, 3.7, 12.8); camera.lookAt(0, 0.55, -0.9);
  ground('#7d7260');
  Object.keys(PALETTES).forEach((p, i) => {
    for (const [team, z, ry] of [['blue', 1.2, Math.PI - 0.35], ['red', -2.2, Math.PI - 0.35]]) {
      const ch = soldier({ team, wear: { pal: p }, x: -4.65 + i * 1.55, z, ry });
      if (team === 'blue') label(ch.root, t('wear.pal.' + p), '');
    }
  });
} else if (view === 'glow') {
  title('IŞIKLI / PARLAYAN SET (GECE)', 'Neon Vizör · Neon Yelek · Işık Pelerini · Neon Şerit · Işıklı Taban — ışık her zaman TAKIM RENGİNDE · tüm ışık tek malzemede (köşe işaretli), ek çizim çağrısı 0');
  scene.background = new THREE.Color('#06080d'); scene.environmentIntensity = 0.12; hemi.intensity = 0.18; sun.intensity = 0.35; sun.color.set('#9fb4ff');
  camera = new THREE.PerspectiveCamera(32, A, 0.1, 100); camera.position.set(0, 2.5, 12.4); camera.lookAt(0, 0.85, -1.0);
  ground('#2a2c30');
  const G = { head: 'neonhelm', top: 'neonvest', back: 'lightcape', legs: 'neonlegs', feet: 'glowsole', pal: 'night' };
  const row = [[{ ...G }, 'Tam ışıklı set', 'Gece paleti'], [{ ...G, back: 'pack' }, 'Neon Operatör', 'ışık pelerini yok'], [{ ...G, pal: 'urban', back: 'none' }, 'Şehir + neon', 'Şehir paleti'], [{ ...G, head: 'beanie', top: 'jacket', legs: 'neonlegs', back: 'lightcape' }, 'Sokak', 'Bere · Ceket']];
  row.forEach(([w, n, sub], i) => {
    for (const [team, dx] of [['blue', -0.75], ['red', 0.75]]) {
      const ch = soldier({ team, wear: w, x: -4.8 + i * 3.2 + dx * 0.85, z: i % 2 ? -2.6 : 1.0, ry: team === 'blue' ? Math.PI - 0.4 : (i % 2 ? 0.5 : Math.PI + 0.5) });
      if (team === 'blue') label(ch.root, n, sub, new THREE.Vector3(0.75, 0, 0));
    }
  });
  post = new Post(renderer); post.on = true; post.setGrade({ bloom: 0.55, thr: 1.0, vig: 0.25, sat: 1.05 });
  WEAR_U.uGlowK.value = 2.6;
} else if (view === 'combos') {
  title('KOMBİN ÖRNEKLERİ', 'Her yuvadan bir parça + palet · takım yuvaları (kol, kol bandı, omuz, başlık şeridi) her kombinde aynı');
  camera = new THREE.PerspectiveCamera(31, A, 0.1, 100); camera.position.set(0, 3.7, 12.8); camera.lookAt(0, 0.55, -0.9);
  ground('#7d7260');
  const C = [
    ['Çöl Akıncısı', { head: 'cap', top: 'rig', back: 'shortcape', legs: 'cargo', feet: 'highboots', pal: 'desert' }, 'assault'],
    ['Orman Gölgesi', { head: 'hood', top: 'rig', back: 'cape', legs: 'cargo', feet: 'highboots', pal: 'wood' }, 'sniper'],
    ['Şehir Operatörü', { head: 'helmet', top: 'carrier', back: 'radio', legs: 'tactical', feet: 'boots', pal: 'urban' }, 'assault'],
    ['Kuzey Avcısı', { head: 'beanie', top: 'jacket', back: 'pack', legs: 'cargo', feet: 'highboots', pal: 'snow' }, 'medic'],
    ['Kimyasal Birlik', { head: 'gasmask', top: 'kevlar', back: 'pack', legs: 'tactical', feet: 'highboots', pal: 'urban' }, 'heavy'],
    ['Altın Elit', { head: 'heavyhelm', top: 'kevlar', back: 'none', legs: 'tactical', feet: 'boots', pal: 'gold' }, 'heavy'],
    ['Sokak', { head: 'cap', top: 'jacket', back: 'none', legs: 'slim', feet: 'sneakers', pal: 'std' }, 'engineer'],
  ];
  C.forEach(([n, w, cls], i) => {
    for (const [team, z] of [['blue', 1.2], ['red', -2.2]]) {
      const ch = soldier({ team, cls, wear: w, x: -4.65 + i * 1.55, z, ry: Math.PI - 0.4 });
      if (team === 'blue') label(ch.root, n, t('wear.pal.' + w.pal));
    }
  });
} else if (view === 'compare') {
  title('MEVCUT ↔ YÖN A ↔ YÖN B', 'Aynı sınıf (Saldırı), aynı silah · solda bugünkü model · ortada A (rafine) · sağda B (kahraman)');
  camera = new THREE.PerspectiveCamera(28, A, 0.1, 100); camera.position.set(0, 1.7, 12.2); camera.lookAt(0, 0.92, 0);
  ground('#7d7260');
  const cols = [['Mevcut', { old: true }], ['Yön A', { body: 'A' }], ['Yön B', { body: 'B' }]];
  cols.forEach(([n, o], ci) => {
    [['blue', Math.PI - 0.45], ['red', 0.35]].forEach(([team, ry], k) => {
      const ch = soldier({ team, x: -3.5 + ci * 3.5 + (k ? 0.62 : -0.62), z: 0, ry, ...o });
      if (!k) { label(ch.root, n, '', new THREE.Vector3(0.62, 0, 0)); window.__stats[n] = stats(ch); }
    });
  });
} else if (view === 'one') {
  const team = q.get('t') || 'blue', cls = q.get('c') || 'assault', wear = JSON.parse(q.get('w') || '{}'), ry = +(q.get('ry') ?? 2.6), n = +(q.get('n') || 1);
  title('', '');
  camera = new THREE.PerspectiveCamera(24, A, 0.05, 100); camera.position.set(0, 1.25, 2.6 + n * 1.3); camera.lookAt(0, 0.95, 0);
  ground('#7d7260');
  for (let i = 0; i < n; i++) soldier({ team: i % 2 ? 'red' : team, cls, wear, x: (i - (n - 1) / 2) * 1.0, ry: ry + (i === 2 ? Math.PI : 0), old: q.get('old') === '1' && i === 0 });
} else if (view === 'crowd') {
  // performans: 24 asker (12v12, sınıflar karışık, botlar oyundaki gibi çeşitli) → renderer.info çağrı / üçgen (gölge geçişi dahil)
  const old = q.get('b') === 'old', cl = Object.keys(CLS_TR);
  title(old ? '24 ASKER · MEVCUT MODEL' : '24 ASKER · YENİ MODEL (A)', '');
  camera = new THREE.PerspectiveCamera(40, A, 0.1, 100); camera.position.set(0, 4, 14); camera.lookAt(0, 0.9, 0);
  ground('#7d7260');
  for (let i = 0; i < 24; i++) {
    const team = i < 12 ? 'blue' : 'red', cls = cl[i % 5];
    const ch = createCharacter({ team, cls, skinIndex: i, weapon: WPN[cls][team], optic: 'reddot', ...(old ? { body: 'old' } : { wear: botWearFor(cls, i) }) });
    ch.root.position.set(((i % 12) - 5.5) * 1.3, 0, i < 12 ? 2 : -2); ch.root.rotation.y = i < 12 ? Math.PI : 0; scene.add(ch.root);
    ch.root.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  }
  setTimeout(() => { renderer.info.autoReset = false; renderer.info.reset(); renderer.render(scene, camera); window.__stats.crowd = { calls: renderer.info.render.calls, tri: renderer.info.render.triangles, programs: renderer.info.programs.length }; renderer.info.autoReset = true; }, 300);
} else if (view === 'far') {
  const d = +(q.get('d') || 30), hw = d * Math.tan(36 * Math.PI / 180) * A;
  title('', '');
  camera = new THREE.PerspectiveCamera(72, A, 0.1, 300); camera.position.set(0, 1.65, 0); camera.lookAt(0, 1.2, -d);
  ground('#a08a64', [300, 0.2, 300]);
  Object.keys(PALETTES).forEach((p, i) => {
    for (const [team, dx] of [['blue', -0.55], ['red', 0.55]]) soldier({ team, wear: { pal: p }, x: (i - 3) * hw * 0.26 + dx, z: -d, ry: Math.PI - 0.3 + (team === 'red' ? 0.6 : 0) });
  });
  camera.updateMatrixWorld(); window.__far = Object.keys(PALETTES).map((p, i) => { const v = new THREE.Vector3((i - 3) * hw * 0.26, 0.9, -d).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
}
renderer.setAnimationLoop(() => {
  if (post && post.begin()) { renderer.clear(); renderer.render(scene, camera); post.end(); } else renderer.render(scene, camera);
  const v = new THREE.Vector3();
  for (const t of tracked) { t.obj.getWorldPosition(v).add(t.off).project(camera); t.el.style.left = ((v.x + 1) / 2) * innerWidth + 'px'; t.el.style.top = ((1 - v.y) / 2) * innerHeight + 'px'; }
});
window.__ready = true;
