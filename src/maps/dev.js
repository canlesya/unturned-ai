import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import * as K from './kit.js';
import * as M from './kitMil.js';
import * as T from './kitTown.js';
import { COL } from './kit.js';
import { createWeapon, WEAPONS } from '../models/weapons.js';

// Geliştirici haritası — "Atölye". Her model/yapı bir sergi şeridinde, etiketli ve çarpışmalı:
//   z −46  araçlar · z −27 / −19 silah ve gadget'lar (kaide üstünde, 2× büyük) · z −3 … +15 binalar
//   z +26  duvar / açıklık / merdiven / siper · z +38 küçük yapılar ve ağaçlar · z +50 askeri yapılar
// Doğuş: batı ve doğu uçlar. Tek başına gezmek için Özel Oyun'da takım başına 1-2 kişi seçin.

export const DEV_BOUNDS = { minX: -92, maxX: 92, minZ: -62, maxZ: 62 };
const PAD = '#8d9298';

function labelSprite(text, size = 1) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(14,18,26,0.78)'; g.fillRect(0, 0, 512, 96);
  g.strokeStyle = '#ffae3a'; g.lineWidth = 4; g.strokeRect(2, 2, 508, 92);
  g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 50, 490);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true }));
  s.scale.set(3.6 * size, 0.675 * size, 1);
  return s;
}

export function buildDev() {
  const b = new MapBuilder();
  b.autoPlace = false;
  const rng = makeRng(7);
  const labels = [];
  const label = (x, y, z, text, size = 1) => labels.push({ x, y, z, text, size });
  const pad = (x, z, w, d) => b.box(x, 0, z, w, 0.05, d, PAD, { collide: false });

  b.box(0, -1.0, 0, 900, 1.0, 900, COL.grass, { collide: false });
  b.box(0, 0, 0, 184, 0.03, 124, '#9aa86a', { collide: false });
  for (let x = -90; x <= 90; x += 10) b.box(x, 0.035, 0, 0.1, 0.01, 124, '#8c9a5c', { collide: false });
  for (let z = -60; z <= 60; z += 10) b.box(0, 0.035, z, 184, 0.01, 0.1, '#8c9a5c', { collide: false });

  // ───── araçlar ─────
  pad(0, -46, 176, 14);
  const cars = [
    ['Otomobil', (x) => K.car(b, { x, z: -46, ry: Math.PI / 2, color: '#b33a2a' })],
    ['Otomobil (hurda)', (x) => K.car(b, { x, z: -46, ry: Math.PI / 2, wreck: true })],
    ['Cip', (x) => M.jeep(b, { x, z: -46, ry: Math.PI / 2 })],
    ['Ambulans', (x) => M.ambulance(b, { x, z: -46, ry: Math.PI / 2 })],
    ['Otobüs', (x) => K.bus(b, { x, z: -46, ry: Math.PI / 2 })],
    ['Kamyon', (x) => K.truck(b, { x, z: -46, ry: Math.PI / 2 })],
    ['Tanker', (x) => M.tanker(b, { x, z: -46, ry: Math.PI / 2 })],
    ['Zırhlı Araç', (x) => M.apc(b, { x, z: -46, ry: Math.PI / 2 })],
    ['Zırhlı (hurda)', (x) => M.apc(b, { x, z: -46, ry: Math.PI / 2, wreck: true })],
    ['Tank', (x) => M.tank(b, { x, z: -46, ry: Math.PI / 2, wreck: false })],
    ['Tank (hurda)', (x) => M.tank(b, { x, z: -46, ry: Math.PI / 2 })],
  ];
  cars.forEach(([name, fn], i) => { const x = -80 + i * 16; fn(x); label(x, 4.6, -46, name); });
  b.flushVehicles();

  // ───── silah ve gadget kaideleri ─────
  const ids = Object.keys(WEAPONS);
  const perRow = Math.ceil(ids.length / 2);
  const gap = 170 / perRow;
  pad(0, -23, 176, 16);
  ids.forEach((id, i) => {
    const row = i < perRow ? 0 : 1, col = i % perRow;
    const x = -85 + col * gap + gap / 2, z = row ? -19 : -27;
    b.box(x, 0, z, 1.4, 1.0, 0.8, '#4a4d52');
    b.box(x, 1.0, z, 1.5, 0.08, 0.9, '#2c2f34', { collide: false });
    labels.push({ x, y: 2.75, z, weapon: id });
  });

  // ───── binalar ─────
  pad(0, 5, 176, 30);
  K.house(b, rng, { x: -80, z: 4, w: 10, d: 9, floors: 1, door: 's', wall: '#d9c79a', roof: '#a8432f' }); label(-80, 6.5, 10, 'Ev (1 kat)');
  K.house(b, rng, { x: -64, z: 4, w: 9, d: 9, floors: 3, door: 's', wall: '#c9d6c0', roof: '#5b6470' }); label(-64, 11.5, 10, 'Ev (3 kat)');
  K.house(b, rng, { x: -48, z: 4, w: 13, d: 10, floors: 2, door: 's', theme: 'office', flat: true, roofAccess: true, wall: '#b9cbd9', roof: '#4a5360' }); label(-48, 8.5, 10, 'Ofis (çatı çıkışlı)');
  K.house(b, rng, { x: -31, z: 4, w: 11, d: 9, floors: 1, door: 's', theme: 'garage', flat: true, wall: '#b8b2a4', roof: '#5a5d62' }); label(-31, 6, 10, 'Garaj');
  K.house(b, rng, { x: -16, z: 4, w: 12, d: 10, floors: 2, door: 's', theme: 'shop', flat: true, roofAccess: true, wall: '#c9a27a', roof: '#6a4a3a' }); label(-16, 8.5, 10, 'Dükkân');
  K.barn(b, rng, { x: 4, z: 6, w: 12, d: 16 }); label(4, 9, 15, 'Ambar');
  K.warehouse(b, rng, { x: 28, z: 5, w: 22, d: 14 }); label(28, 10, 13, 'Depo');
  K.church(b, rng, { x: 52, z: 6, w: 9, d: 14 }); label(52, 12, 14, 'Kilise');
  K.gasStation(b, rng, { x: 72, z: 6, store: 'n' }); label(72, 7, 14, 'Benzinlik');
  K.silo(b, 86, -2, 2.2, 11); label(86, 12.5, -2, 'Silo');

  // ───── duvar / açıklık / merdiven / siper ─────
  pad(0, 27, 176, 16);
  // duvar açıklıkları: kapı, pencere, geniş kapı
  b.wall('x', -88, -76, 24, 0, 3, 0.3, '#c9bfa7', [{ at: -85, w: 1.2, b: 0, top: 2.2 }, { at: -81, w: 1.4, b: 0.9, top: 2.1, glass: true }, { at: -78, w: 1.0, b: 0, top: 2.2 }]);
  label(-82, 4, 24, 'Duvar: kapı + pencere');
  // merdivenler: farklı basamak yüksekliği
  b.stairs(-70, 28, 0, '+x', 2.4, 10, 0.2, 0.32, '#8a8c90'); b.box(-66.0 + 0.6, 0, 28, 2.4, 2.0, 2.4, '#8a8c90'); label(-66, 3.4, 28, 'Merdiven (10 basamak)');
  b.stairs(-58, 28, 0, '+x', 2.4, 6, 0.4, 0.3, '#7a7c80'); b.box(-55.6 + 0.6, 0, 28, 2.4, 2.4, 2.4, '#7a7c80'); label(-56, 3.7, 28, 'Dik merdiven (0,4 m)');
  b.stairs(-46, 28, 0, '+z', 2.4, 10, 0.3, 0.3, '#8a8c90'); b.box(-46, 0, 28 + 3.3, 2.4, 3.0, 2.4, '#8a8c90'); label(-46, 4.7, 31, 'Merdiven (+z)');
  // alçak/yüksek duvarlar ve siperler
  T.wallStone(b, rng, -38, 24, -26, 24); label(-32, 3.8, 24, 'Taş duvar');
  T.hedge(b, -22, 24, -14, 24); label(-18, 2.8, 24, 'Çit-çalı');
  K.fence(b, -10, 24, -2, 24); label(-6, 2.4, 24, 'Tahta çit');
  K.sandbags(b, 4, 24, 4, 0); label(4, 2.2, 24, 'Kum torbası');
  K.barrier(b, 14, 24, 0); label(14, 2.2, 24, 'Beton bariyer');
  M.hesco(b, 24, 24, 4, 0); label(24, 3, 24, 'Hesco');
  M.blastWall(b, 36, 24, 6, 0); label(36, 4.8, 24, 'Patlama duvarı');
  M.mgNest(b, 48, 24, 0); label(48, 3.2, 24, 'Makineli yuvası');
  K.container(b, { x: 60, z: 24, ry: 0 }); K.container(b, { x: 60, z: 24, y: 2.6, ry: Math.PI / 2, color: '#4a7a4f' }); label(60, 7, 24, 'Konteyner (üst üste)');
  M.trench(b, 72, 24, 86, 24); label(79, 3, 28, 'Siper hendeği');

  // ───── küçük yapılar, props, ağaçlar ─────
  pad(0, 39, 176, 12);
  const props = [
    ['Kiosk', (x) => T.kiosk(b, rng, { x, z: 39 })],
    ['Tezgâh', (x) => T.stall(b, rng, { x, z: 39 })],
    ['Otobüs durağı', (x) => T.busStop(b, { x, z: 39 })],
    ['Reklam panosu', (x) => T.billboard(b, { x, z: 39 })],
    ['Çardak', (x) => T.gazebo(b, { x, z: 39 })],
    ['Çeşme', (x) => T.fountain(b, { x, z: 39 })],
    ['Su kulesi', (x) => T.waterTower(b, { x, z: 39 })],
    ['Gözetleme kulesi', (x) => K.watchtower(b, { x, z: 39 })],
    ['Çam', (x) => K.pine(b, rng, x, 39, 1.2)],
    ['Meşe', (x) => K.oak(b, rng, x, 39, 1.2)],
    ['Çalı + kaya', (x) => { K.bush(b, rng, x - 1, 39, 1.2); K.rock(b, rng, x + 1.4, 39, 1.2); }],
    ['Kasa + varil', (x) => { K.crate(b, x - 1.2, 39, 1.1); K.crate(b, x - 1.2, 39, 1.1, 1.1); K.barrel(b, x + 0.6, 38.5); K.barrel(b, x + 1.4, 39.4, '#2c5aa0'); }],
    ['Çöp/çöp kutusu', (x) => { K.dumpster(b, x - 1, 39); T.trashCan(b, x + 1.6, 39); T.planter(b, x + 3, 39); }],
    ['Bank + lamba', (x) => { K.bench(b, x - 1, 39); K.lamp(b, x + 1.5, 39); }],
  ];
  props.forEach(([name, fn], i) => { const x = -84 + i * 13; fn(x); label(x, name === 'Su kulesi' || name === 'Gözetleme kulesi' ? 12 : name === 'Çam' || name === 'Meşe' ? 8 : 4, 39, name); });

  // ───── askeri yapılar ─────
  pad(0, 52, 176, 14);
  M.hangar(b, rng, { x: -66, z: 51, w: 30, d: 18, openW: 14 }); label(-66, 10, 51, 'Hangar');
  M.radarTower(b, rng, { x: -36, z: 52, w: 9, d: 9 }); label(-36, 14, 52, 'Radar kulesi');
  M.controlTower(b, rng, { x: -16, z: 52, w: 7, d: 7 }); label(-16, 12, 52, 'Kontrol kulesi');
  M.bunker(b, { x: 2, z: 52 }); label(2, 5, 52, 'Bunker');
  M.helipad(b, { x: 22, z: 52, r: 6 }); M.helicopter(b, { x: 22, z: 52 }); label(22, 7, 52, 'Helikopter');
  M.plane(b, { x: 48, z: 52 }); label(48, 8, 52, 'Uçak');
  M.fuelTank(b, { x: 72, z: 52 }); label(72, 8, 52, 'Yakıt tankı');
  M.fireBarrel(b, 84, 50); M.lampPost(b, 84, 54); label(84, 8, 52, 'Lamba direği');

  // ───── doğuş / hedef ─────
  const spawns = { blue: [], red: [] };
  for (let i = 0; i < 20; i++) {
    const z = -16 + (i % 10) * 3.2, x = 88 + (i >> 1 & 1) * 2.5;
    spawns.blue.push({ x: -x, z, ry: -Math.PI / 2 });
    spawns.red.push({ x, z, ry: Math.PI / 2 });
  }
  const objectives = [{ id: 'merkez', name: 'Merkez', core: true, x: 0, z: -3, r: 8 }];

  const group = b.build();
  if (typeof document !== 'undefined') {                       // tarayıcıda: etiketler + silah modelleri (sunucu başsız çalışır, görsel yok)
    for (const l of labels) {
      if (l.weapon) {
        const w = createWeapon(l.weapon, 'iron');
        w.scale.setScalar(2.2); w.rotation.y = -Math.PI / 2; w.position.set(l.x, 1.35, l.z);
        group.add(w);
        const sp = labelSprite(w.userData.name || l.weapon, 0.5); sp.position.set(l.x, 2.55, l.z); group.add(sp);
      } else { const sp = labelSprite(l.text, l.size); sp.position.set(l.x, l.y, l.z); group.add(sp); }
    }
  }
  return {
    id: 'dev',
    name: 'Geliştirici Atölyesi',
    group,
    colliders: b.colliders,
    sight: b.sight,
    bounds: DEV_BOUNDS,
    baseZones: { blue: { minX: -92, maxX: -80, minZ: -20, maxZ: 20 }, red: { minX: 80, maxX: 92, minZ: -20, maxZ: 20 } },
    spawns,
    objectives,
    roads: [],
  };
}
