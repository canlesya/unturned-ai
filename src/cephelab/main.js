import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createWeapon } from '../models/weapons.js';
import { createCharacter } from '../models/character.js';
import { WSTATS } from '../game/stats.js';
import { makeCepheMaterial, FK } from '../maps/cepheSurface.js';
import '../i18n/front.js';
import { weaponName } from '../i18n/data.js';

// Cephe laboratuvarı (yalnız taslak / sayfa görseli, oyun kodu değişmez): ?view=weapons | chars | tex
//   weapons: 1940'lar silahları yandan (ızgara) · chars: iki ordu önden / ¾ / yandan / arkadan + sınıflar · tex: Batı Cephesi yüzey örnekleri
const Q = new URLSearchParams(location.search), VIEW = Q.get('view') || 'weapons';
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
scene.background = new THREE.Color('#25282a');
scene.add(new THREE.HemisphereLight('#cfd6dc', '#4a4234', 1.1));
const sun = new THREE.DirectionalLight('#fff1dc', 2.2); sun.position.set(4, 7, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.1, far: 40 }); scene.add(sun);
const labels = document.getElementById('labels'), tracked = [];
const label = (obj, title, sub, off = new THREE.Vector3()) => { const el = document.createElement('div'); el.className = 'lbl'; el.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`; labels.appendChild(el); tracked.push({ el, obj, off }); };
const setTitle = (t, s) => { document.getElementById('title').innerHTML = `${t}<small>${s}</small>`; };
let camera;

if (VIEW === 'weapons') {
  setTitle('Cephe · 1940\'lar silahları', 'S3 düşük poligon dil · ahşap kundak + mavi çelik · demir gez-arpacık / eski tip dürbün · Mavi BAR tarzı, Kırmızı MG42 tarzı ağır destek');
  const ids = (Q.get('ids') || 'ww_bolt,ww_semi,ww_smgb,ww_smgr,ww_lmg,ww_mg,ww_sniper,ww_pistol,ww_nade,_').split(',');
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  const cols = 2, rows = Math.ceil(ids.length / cols), cw = 1.5, rh = 0.44;
  const W = cols * cw, H = rows * rh + 0.18, asp = innerWidth / innerHeight;
  const half = Math.max(W / 2, H / 2 * asp) * 1.0;
  Object.assign(camera, { left: -half, right: half, top: half / asp, bottom: -half / asp }); camera.updateProjectionMatrix();
  camera.position.set(10, 0, 0); camera.lookAt(0, 0, 0);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: '#2b2e2f', roughness: 1 })); back.rotation.y = Math.PI / 2; back.position.x = -1.2; scene.add(back);
  sun.position.set(6, 5, 3);
  ids.forEach((id, i) => {
    if (id === '_') return;
    const c = i % cols, r = Math.floor(i / cols);
    const g = createWeapon(id, 'iron', false);
    const st = WSTATS[id], pist = id === 'ww_pistol' || id === 'ww_nade';
    const s = id === 'ww_pistol' ? 1.6 : id === 'ww_nade' ? 1.25 : 1.0;
    g.scale.setScalar(s);
    if (id === 'ww_nade') g.rotation.x = -Math.PI / 2;                                    // saplı bomba yatık (baş öne)
    if (g.userData.mag && g.userData.magHidden) g.userData.mag.visible = false;          // şerit klips yalnız doldururken görünür
    const bb = new THREE.Box3().setFromObject(g), ctr = bb.getCenter(new THREE.Vector3());
    const z0 = (c - (cols - 1) / 2) * -cw, y0 = (rows - 1) / 2 * rh - r * rh - 0.02;
    g.position.set(-ctr.x, y0 - ctr.y, z0 - ctr.z);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    scene.add(g);
    const sub = st.kind === 'gun' ? `${st.dmg} hasar · ${st.rpm} atış/dk · ${st.mag} mermi${st.scope ? ' · 4× dürbün' : ''}${st.reloadStyle === 'clip' ? ' · klips' : ''}` : `${st.dmg} hasar · ${st.radius} m · ${st.fuse} sn fitil`;
    const anchor = new THREE.Object3D(); anchor.position.set(0, y0 - (bb.max.y - bb.min.y) / 2 - 0.012, z0); scene.add(anchor);
    label(anchor, weaponName(id), sub + (pist ? ` · ×${String(s).replace('.', ',')} ölçek` : ''));
  });
} else if (VIEW === 'chars') {
  const set = Q.get('set') || 'views';
  setTitle('Cephe · iki ordu', 'Mavi: yeşil-haki + yuvarlak miğfer · Kırmızı: gri + kenarlı miğfer · nişan / sembol / bayrak yok, takım = kol bandı');
  camera = new THREE.PerspectiveCamera(24, innerWidth / innerHeight, 0.1, 80);
  camera.position.set(0, 1.9, set === 'one' ? 5.2 : set === 'cls' ? 18.5 : 16.5); camera.lookAt(0, 1.05, 0);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ color: '#4b4436', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const rows = set === 'one' ? [['blue', 'assault', Math.PI / 2], ['red', 'assault', Math.PI / 2]] : set === 'views'
    ? [['blue', 'assault', Math.PI], ['blue', 'assault', -Math.PI * 0.75], ['blue', 'assault', -Math.PI / 2], ['blue', 'assault', 0], ['red', 'assault', Math.PI], ['red', 'assault', -Math.PI * 0.75], ['red', 'assault', -Math.PI / 2], ['red', 'assault', 0]]
    : [['blue', 'medic', 2.7], ['blue', 'sniper', 2.7], ['blue', 'heavy', 2.7], ['blue', 'engineer', 2.7], ['red', 'medic', 3.6], ['red', 'sniper', 3.6], ['red', 'heavy', 3.6], ['red', 'engineer', 3.6]];
  const VN = { [Math.PI]: 'önden', [-Math.PI * 0.75]: '¾ önden', [-Math.PI / 2]: 'yandan', 0: 'arkadan', 2.7: '', 3.6: '' };
  const CN = { assault: 'Tüfekçi', medic: 'Sıhhiye', sniper: 'Keskin nişancı', heavy: 'Ağır destek', engineer: 'İstihkam' };
  const WPN = { assault: { blue: 'ww_semi', red: 'ww_bolt' }, medic: { blue: 'ww_smgb', red: 'ww_smgr' }, sniper: { blue: 'ww_sniper', red: 'ww_sniper' }, heavy: { blue: 'ww_lmg', red: 'ww_mg' }, engineer: { blue: 'ww_smgb', red: 'ww_smgr' } };
  rows.forEach(([team, cls, ry], i) => {
    const ch = createCharacter({ team, cls, skinIndex: i + 1, weapon: WPN[cls][team], optic: 'iron', outfit: 'ww2' });
    const x = (i - (rows.length - 1) / 2) * (set === 'one' ? 1.6 : set === 'cls' ? 1.62 : 1.42);
    ch.root.position.set(x, ch.root.position.y, 0); ch.root.rotation.y = ry;
    ch.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(ch.root);
    const a = new THREE.Object3D(); a.position.set(x, -0.05, 0); scene.add(a);
    label(a, `${team === 'blue' ? 'Mavi' : 'Kırmızı'} · ${CN[cls]}`, VN[ry] || weaponName(WPN[cls][team]));
  });
  sun.position.set(3, 8, 8);
} else {
  setTitle('Batı Cephesi · yüzey örnekleri', 'Dünya koordinatlı prosedürel gölgelendirici (doku dosyası / UV yok, çizim çağrısı artmaz)');
  camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 80);
  camera.position.set(0, 7.0, 13.2); camera.lookAt(0, 0.5, 0);
  scene.background = new THREE.Color('#2a2c2c');
  const mat = makeCepheMaterial();
  const K = [['Ham toprak (siper duvarı)', FK.EARTH, '#574736', 'wall'], ['Kum torbası', FK.SANDBAG, '#857c66', 'wall'], ['Kalas kaplama', FK.PLANK, '#5e4c39', 'wall'], ['Moloz taş duvar', FK.STONE, '#787166', 'wall'], ['Köy sıvası (dökük)', FK.PLASTER, '#a0978a', 'wall'],
    ['Çamur (siper tabanı)', FK.MUD, '#463a2f', 'top'], ['Ördek tahtası', FK.DUCKX, '#4a3c2c', 'top'], ['Tarla (soluk çimen + çamur)', FK.FIELD, '#6a6650', 'top'], ['Beton (kalıp izli)', FK.CONC, '#86837b', 'low'], ['Kiremit', FK.TILE, '#7d4f3c', 'roof']];
  const cols = 5;
  K.forEach(([name, kind, col, shape], i) => {
    const c = i % cols, r = Math.floor(i / cols), x = (c - (cols - 1) / 2) * 2.3, z = r === 0 ? -1.6 : 2.0;
    let g;
    if (shape === 'top') g = new THREE.BoxGeometry(2.0, 0.1, 2.0).translate(0, 0.05, 0);
    else if (shape === 'roof') { g = new THREE.BoxGeometry(2.0, 0.08, 1.9); g.rotateX(0.5); g.translate(0, 0.5, 0); }
    else if (shape === 'low') g = new THREE.BoxGeometry(2.0, 0.6, 2.0).translate(0, 0.3, 0);
    else g = new THREE.BoxGeometry(2.0, 2.0, 0.4).translate(0, 1.0, 0);
    g = g.toNonIndexed(); g.deleteAttribute('uv');
    const n = g.attributes.position.count, cc = new THREE.Color(col), ca = new Float32Array(n * 3), ka = new Uint8Array(n);
    for (let j = 0; j < n; j++) { ca[j * 3] = cc.r; ca[j * 3 + 1] = cc.g; ca[j * 3 + 2] = cc.b; ka[j] = kind | ((i + 3) << 4); }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); g.setAttribute('aKind', new THREE.BufferAttribute(ka, 1));
    const m = new THREE.Mesh(g, mat); m.position.set(x, shape === 'wall' && kind === FK.EARTH ? 0 : 0, z); m.receiveShadow = m.castShadow = true; scene.add(m);
    const a = new THREE.Object3D(); a.position.set(x, shape === 'wall' ? 2.25 : 0.0, shape === 'wall' ? z : z + 1.25); scene.add(a);
    label(a, name, '', new THREE.Vector3(0, shape === 'wall' ? 0.25 : 0, 0));
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshStandardMaterial({ color: '#202222' })).rotateX(-Math.PI / 2));
  sun.position.set(-3, 6, 7);
}

const v = new THREE.Vector3();
function frame() {
  renderer.render(scene, camera);
  for (const t of tracked) {
    t.obj.getWorldPosition(v).add(t.off).project(camera);
    t.el.style.left = ((v.x + 1) / 2 * innerWidth).toFixed(0) + 'px'; t.el.style.top = ((1 - v.y) / 2 * innerHeight).toFixed(0) + 'px';
  }
  requestAnimationFrame(frame);
}
frame();
window.__ready = true;
