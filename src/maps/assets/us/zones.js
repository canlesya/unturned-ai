import { UK } from '../common/us-surface.js';
import { PAL } from '../common/us-kit.js';
import { milBlock, roofAC, roofVent } from '../common/us-building.js';
import { hangar } from '../common/us-hangar.js';
import { container, guardTower, controlTower, radarStation, bunker, tunnel, fuelTank, pipeRack, pipeLow, helipad, garageRow } from '../common/us-structures.js';
import { jersey, tWall, hesco, sandbags, mgNest, crate, ammoBox, barrel, barrels, fireBarrel, lampPost, flagPole, camoNet, chainFence, signBoard, beacon } from '../common/us-props.js';
import { humvee, truck, ambulance, apc, tankWreck, tanker, sedanWreck, forklift, helicopter, transportPlane } from '../common/us-vehicles.js';
import { ITEMS } from '../common/us-furniture.js';

// Askeri Üs v3 — bölgeler. Yerleşim (oynanış şablonu) eski haritayla aynı: merkezde 3 katlı Komuta Binası, kuzeyde Hangar, güneyde Radar,
// kuzeybatı / güneydoğu orta halka (atölye hangarı + tünel + yemekhane / depo + sığınaklar + gözetleme kulesi), kuzeydoğu Akaryakıt, güneybatı Kışla,
// köşe avluları (garaj + helipad / konteyner labirenti), ana cadde siperleri. 180° döndürülen bölgeler (v = 1) çağıran tarafından b.with(…, π) ile kurulur.

// ───── KOMUTA BİNASI (x ±10, z ±7; 3 kat + çatı) ─────
export function komuta(K) {
  const P = (axis, c, a0, a1, doors, floors) => ({ axis, c, a0, a1, doors: doors.map((at) => ({ at, w: 1.3 })), floors });
  milBlock(K, {
    x0: -10, x1: 10, z0: -7, z1: 7, floors: 3, wall: '#8d968a', band: '#56604f', base: '#5d6559', winGap: 2.6, roofAccess: true,
    doors: { n: [-3.4], s: [-3.4, 6.8], e: [-3.4, 3.4], w: [3.4] },
    parts: [P('z', -5.0, -6.7, 6.7, [3.4], [0, 1, 2]), P('z', -1.8, -6.7, 6.7, [-3.4, 3.4], [0, 1, 2]), P('x', 0, -1.725, 9.7, [1.1, 6.8], [0, 1]),
      P('z', 4, -6.7, -0.075, [-3.4], [0, 1]), P('z', 4, 0.075, 6.7, [3.4], [0, 1])],
    stairs: [{ x: -8.85, z: -5.9, dir: '+z', w: 1.3, f: 0 }, { x: -7.35, z: -1.4, dir: '-z', w: 1.3, f: 1 }, { x: -8.85, z: -5.9, dir: '+z', w: 1.3, f: 2 }],
    rooms: [
      { f: 0, kind: 'radio', x0: -1.725, x1: 3.925, z0: -6.7, z1: -0.075 }, { f: 0, kind: 'ops', x0: 4.075, x1: 9.7, z0: -6.7, z1: -0.075 },
      { f: 0, kind: 'guard', x0: -1.725, x1: 3.925, z0: 0.075, z1: 6.7 }, { f: 0, kind: 'armory', x0: 4.075, x1: 9.7, z0: 0.075, z1: 6.7 },
      { f: 1, kind: 'office', x0: -1.725, x1: 3.925, z0: -6.7, z1: -0.075 }, { f: 1, kind: 'computers', x0: 4.075, x1: 9.7, z0: -6.7, z1: -0.075 },
      { f: 1, kind: 'lounge', x0: -1.725, x1: 3.925, z0: 0.075, z1: 6.7 }, { f: 1, kind: 'ops', x0: 4.075, x1: 9.7, z0: 0.075, z1: 6.7 },
      { f: 2, kind: 'war', x0: -1.725, x1: 9.7, z0: -6.7, z1: 6.7 },
    ],
    labels: [{ side: 's', t: 'KOMUTA', at: 2.2, w: 3.4, h: 0.62, f: 2, y: 2.55 }, { side: 'n', t: 'KOMUTA', at: 2.2, w: 3.4, h: 0.62, f: 2, y: 2.55 }, { side: 's', t: 'K-1', at: -3.4, w: 0.9, h: 0.36, y: 2.95 }],
    roof: (K2, H) => {
      K2.s(2, H, -2, 0.3, 5.0, 0.3, PAL.steel, UK.STEEL); for (const y of [2.5, 4.2]) K2.d(2, H + y, -2, 2.4, 0.06, 0.06, PAL.steelD, UK.STEEL); beacon(K2, 2, H + 5.0, -2);
      roofAC(K2, 6.5, H, 3.6, 0); roofAC(K2, 6.5, H, -4.4, 0); roofVent(K2, -3.2, H, 4.6); roofVent(K2, 0.2, H, 4.6);
      K2.b.with(-0.5, H, 0, 0, () => sandbags(K2, 0, 0, 2.0, Math.PI / 2, 0.8, 0.5));
      K2.s(8.4, H, -0.5, 1.4, 0.6, 1.4, '#7b8660', UK.STEEL);
    },
  });
  // çevre: alçak T-duvarlar köşelerde, kum torbası, MG, lamba, bayrak
  for (const [x, z] of [[-12.6, 10], [12.6, 10], [-12.6, -10], [12.6, -10]]) tWall(K, x, z, 4, 0, 2.0, PAL.twall);
  sandbags(K, -3.5, 11.2, 3.6, 0); sandbags(K, 8, 11.2, 3.6, 0); sandbags(K, -3.5, -11.2, 3.6, 0); sandbags(K, 8, -11.2, 3.6, 0);
  sandbags(K, 12.2, 4.6, 3.0, Math.PI / 2); sandbags(K, -12.2, -4.0, 3.0, Math.PI / 2);
  mgNest(K, 13.6, -6.6, 0); mgNest(K, -13.6, 6.6, Math.PI);
  for (const [x, z, ry] of [[-9.2, 9.4, 0], [9.0, -9.4, Math.PI], [-14.6, 0.5, 0], [14.6, -0.5, Math.PI]]) lampPost(K, x, z, ry);
  flagPole(K, 12.4, 7.6, '#c8c8c0'); flagPole(K, -12.4, -7.6, '#c8c8c0');
  K.co('Komuta Binası', 0, 0, true); K.co('Komuta Çatısı', 2, 2); K.co('Komuta Meydanı', 0, 10);
}

// ───── HANGAR (kuzey, x ±15, z −54 … −36) ─────
export function hangarComplex(K) {
  hangar(K, { x0: -15, x1: 15, z0: -54, z1: -36, h: 8, openW: 14, openH: 6.4, doors: { w: [-41.0], e: [-41.0], n: [-9, 9] }, mezz: { d: 3.2 }, label: 'HANGAR 1', num: '1' });
  transportPlane(K, 0.5, -44.2, 0);
  helicopter(K, -9.6, -43.6, Math.PI / 2, '#4a5a3a', 9.4);
  forklift(K, 11.4, -46.5, Math.PI);
  barrels(K, 12.6, -39.4); barrels(K, 13.2, -37.6, [[0, 0], [0.62, 0]], [PAL.red, PAL.olive]);
  crate(K, -13.8, -48.6, 1.1); crate(K, -13.8, -47.3, 1.0); ammoBox(K, -12.4, -48.5, Math.PI / 2);
  for (const x of [-11, -6, 6]) { K.b.with(x, 0, -52.4, 0, () => ITEMS.shelf.f(K)); }
  K.b.with(-2.0, 0, -52.4, 0, () => ITEMS.crates.f(K)); K.b.with(2.0, 0, -52.5, 0, () => ITEMS.generator.f(K));
  // dış: tanker, T-duvarlar, kum torbası, arka konteyner, lambalar
  tanker(K, -24.5, -30.2, 0);
  tWall(K, -10, -31.2, 4, 0, 1.8); tWall(K, 10, -31.2, 4, 0, 1.8); sandbags(K, 0, -29.2, 5, 0);
  tWall(K, -18.4, -51, 5, Math.PI / 2);
  container(K, 0, -57, 0, { col: '#2d5a8a' }); container(K, 0, -57, 0, { col: '#8a6a2d', y: 2.59 });
  for (const [x, z, ry] of [[-17.4, -38.0, 0], [17.4, -38.0, Math.PI], [-5.5, -33.8, 0], [5.5, -33.8, Math.PI], [-17.4, -57, 0], [17.4, -57, Math.PI]]) lampPost(K, x, z, ry);
  signBoard(K, 9.5, -33.6, 0, 2.4, 0.7, 'HANGAR 1 · APRON', '#f2f2ee', '#2d3a2e');
  K.co('Hangar', 0, -45, true); K.co('Hangar Asma Kat', 0, -52); K.co('Hangar Arkası', 0, -57); K.co('Apron', 0, -32);
}

// ───── RADAR (güney, x ±5, z 39 … 49) ─────
export function radarComplex(K) {
  radarStation(K, 0, 44, 0);
  milBlock(K, { x0: 10.5, x1: 19.5, z0: 41.5, z1: 48.5, floors: 1, wall: '#7f8a7c', winGap: 2.6, doors: { n: [15], w: [45], s: [13] }, rooms: [{ f: 0, kind: 'generator', x0: 10.8, x1: 19.2, z0: 41.8, z1: 48.2 }], labels: [{ side: 'n', t: 'JENERATÖR', at: 17.4, w: 2.0, h: 0.42 }],
    roof: (K2, H) => { roofAC(K2, 13, H, 45, 0); roofVent(K2, 17.5, H, 46.5); K2.s(17.5, H, 43.2, 0.4, 1.6, 0.4, '#5a5f63', UK.STEEL); } });
  pipeRack(K, 5.6, 10.1, 40.2, { y: 2.7 });
  hesco(K, -8, 36, 4, 0); hesco(K, 8, 36, 4, 0); sandbags(K, 0, 35.6, 4, 0);
  tWall(K, -11, 44, 5, Math.PI / 2); tWall(K, 17.6, 36.6, 4, Math.PI / 2, 3.7);
  container(K, -10, 54, 0, { col: '#556b2f' }); container(K, 10, 55, 0, { col: '#2d5a8a' });
  crate(K, 6.8, 52, 1.1); crate(K, 8.1, 52.1, 1.0); barrels(K, 5.2, 53.3, [[0, 0], [0.62, 0]], [PAL.olive, PAL.red]);
  fireBarrel(K, 4.6, 50.2);
  for (const [x, z, ry] of [[-5.4, 36.4, 0], [5.4, 36.4, Math.PI], [-9.4, 51.2, 0], [12.6, 50.6, Math.PI]]) lampPost(K, x, z, ry);
  chainFence(K, 9.4, 50.0, 21.0, 50.0, { h: 2.2, razor: false, gaps: [[13.0, 15.6]] });
  signBoard(K, -6.6, 38.2, 0, 2.2, 0.6, 'RADAR · YASAK BÖLGE', '#20242a', '#e2b52c');
  K.co('Radar', 0, 44, true); K.co('Radar Çatısı', -1.6, 44); K.co('Jeneratör', 15, 45);
}

// ───── KUZEYBATI orta halka (v = 0) / GÜNEYDOĞU (v = 1, 180° döndürülmüş) ─────
export function midRing(K, v) {
  hangar(K, { x0: -52, x1: -28, z0: -59.97, z1: -46, h: 7, openW: 12, openH: 5.6, rise: 2.0, doors: { w: [-50.5], e: [-49.5] }, mezz: { d: 3.0 }, col: v ? '#8a8f86' : '#808a84', label: v ? 'DEPO 2' : 'ATÖLYE 1', num: v ? 'D2' : 'A1' });
  if (!v) { apc(K, -43.5, -51.5, 0); humvee(K, -34.5, -52, Math.PI / 2); barrels(K, -32.0, -49.6); }
  else { for (const x of [-48.6, -47.3]) crate(K, x, -55.4, 1.15); container(K, -37, -52.5, Math.PI / 2, { col: '#8a6a2d' }); crate(K, -32.5, -49.0, 1.1); crate(K, -31.2, -49.1, 1.0); }
  // tünel (x −52 … −20, z −36)
  tunnel(K, -52, -20, -36, { sideDoors: [{ at: -44, side: 's', w: 2.0 }, { at: -32, side: 'n', w: 2.0 }], baffles: [{ at: -48, side: 'n' }, { at: -28, side: 's' }], roofStair: { at: -48.6, side: 'n', dir: '+x' } });
  // yemekhane (v = 1: silah deposu), 14 × 9
  milBlock(K, { x0: -43, x1: -29, z0: -18.5, z1: -9.5, floors: 1, wall: v ? '#8a8f82' : '#949a8a', winGap: 2.8,
    doors: { n: [-36], s: [-39, -33], w: [-14], e: [-12.5] },
    parts: v ? [] : [{ axis: 'x', c: -15, a0: -42.7, a1: -29.3, doors: [{ at: -33, w: 1.3 }, { at: -40.5, w: 1.3 }] }],
    rooms: v ? [{ f: 0, kind: 'store', x0: -42.7, x1: -29.3, z0: -18.2, z1: -9.8 }] : [{ f: 0, kind: 'kitchen', x0: -42.7, x1: -29.3, z0: -18.2, z1: -15.075 }, { f: 0, kind: 'mess', x0: -42.7, x1: -29.3, z0: -14.925, z1: -9.8 }],
    labels: [{ side: 's', t: v ? 'SİLAH DEPOSU' : 'YEMEKHANE', at: -36, w: 2.8, h: 0.5 }],
    roof: (K2, H) => { roofAC(K2, -40, H, -12, 0); roofVent(K2, -32, H, -16.5); } });
  bunker(K, -29, -26, 0); bunker(K, -49, -24.5, Math.PI);
  sandbags(K, -35.5, -27.5, 4, 0); sandbags(K, -43, -29.2, 4, 0);
  tWall(K, -14, -29, 4, Math.PI / 2); tWall(K, -54.6, -30, 4, Math.PI / 2);
  hesco(K, -42.5, -21, 4, 0); hesco(K, -24, -16.5, 3, 0);
  crate(K, -31.2, -21.8, 1.1); crate(K, -32.5, -21.9, 1.0); barrel(K, -30.0, -21.2);
  guardTower(K, -19, -23, 0, { s: 6, door: 's', label: v ? 'GK-3' : 'GK-1' });
  tankWreck(K, -23, -46.5, Math.PI);
  for (const [x, z, ry] of [[-54.6, -36, 0], [-36, -41.8, 0], [-36, -30.2, Math.PI], [-46, -20.2, 0], [-26.4, -20.2, Math.PI]]) lampPost(K, x, z, ry);
  for (const [x, z] of [[-32.5, -43.0], [-47.5, -43.0]]) fireBarrel(K, x, z);
  camoNet(K, -50.2, -42, 6.4, 3.2, 3.0); ammoBox(K, -50.2, -42, 0); ammoBox(K, -50.2, -41.2, 0, 0);
  const T = v ? 'Güneydoğu' : 'Kuzeybatı';
  K.co(v ? 'Depo Hangarı' : 'Atölye Hangarı', -40, -53, true); K.co(T + ' Tünel', -36, -36, true); K.co(v ? 'Silah Deposu' : 'Yemekhane', -36, -14); K.co(T + ' Sığınak', -29, -26); K.co(T + ' Kule', -19, -23);
}

// ───── KUZEYDOĞU: Akaryakıt ─────
export function fuelDepot(K) {
  // akaryakıt istasyonu: sundurma 14 × 9 (4,6 m, dört kolon), iki pompa adası, fiyat direği
  const cx = 34, cz = -12;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.s(cx + sx * 6.3, 0, cz + sz * 3.8, 0.5, 4.6, 0.5, '#d8d8d2', UK.STEEL);
  K.sr(cx - 7, cx + 7, 4.6, 5.1, cz - 4.5, cz + 4.5, '#e6e6e0', UK.STEEL);
  K.sr(cx - 7.05, cx + 7.05, 4.75, 5.0, cz - 4.55, cz - 4.5, PAL.red, UK.PAINT); K.sr(cx - 7.05, cx + 7.05, 4.75, 5.0, cz + 4.5, cz + 4.55, PAL.red, UK.PAINT);
  for (let x = cx - 5; x <= cx + 5; x += 3.3) K.lit(x, 4.55, cz, 1.0, 0.05, 0.3, '#f4f8ff');
  K.lamp(cx - 3, 3.6, cz, 9, 1.0, '#f4f8ff'); K.lamp(cx + 3, 3.6, cz, 9, 1.0, '#f4f8ff');
  for (const dz of [-2.0, 2.0]) {
    K.sr(cx - 2.6, cx + 2.6, 0, 0.16, cz + dz - 0.6, cz + dz + 0.6, '#a9aba3', UK.CURB);
    for (const dx of [-1.3, 1.3]) { K.s(cx + dx, 0.16, cz + dz, 0.7, 1.55, 0.45, '#d9d9d2', UK.STEEL); K.d(cx + dx, 1.05, cz + dz + 0.24, 0.42, 0.3, 0.03, '#1d2329', UK.GLASS); K.d(cx + dx, 1.71, cz + dz, 0.7, 0.16, 0.45, PAL.red, UK.PAINT); }
  }
  K.s(cx - 8.4, 0, cz - 4.6, 0.3, 6.0, 0.3, PAL.steel, UK.STEEL); K.s(cx - 8.4, 6.0, cz - 4.6, 0.3, 1.6, 1.6, '#e6e6e0', UK.STEEL); K.sign('YAKIT', 1.4, 0.5, cx - 8.23, 7.0, cz - 4.6, Math.PI / 2, '#ffffff', PAL.red);
  // pompa dairesi / büro (8 × 6)
  milBlock(K, { x0: 43, x1: 51, z0: -15, z1: -9, floors: 1, wall: '#a4a89c', winGap: 2.4, doors: { w: [-12], s: [49] }, rooms: [{ f: 0, kind: 'office', x0: 43.3, x1: 50.7, z0: -14.7, z1: -9.3 }], labels: [{ side: 'w', t: 'POMPA DAİRESİ', at: -13.9, w: 2.2, h: 0.4 }],
    roof: (K2, H) => { roofAC(K2, 48.5, H, -12.5, Math.PI / 2); } });
  // tank çiftliği (havuz seti içinde) + borular
  for (const tx of [26.6, 33, 39.4]) fuelTank(K, tx, -27, 2.8, 5.0);
  for (const [x0, x1, z0, z1] of [[23.0, 43.4, -31.25, -31.0], [23.0, 43.4, -23.0, -22.75]]) { K.sr(x0, 30.2, 0, 0.6, z0, z1, PAL.concL, UK.CONC); K.sr(32.4, x1, 0, 0.6, z0, z1, PAL.concL, UK.CONC); }
  for (const x of [23.0, 43.15]) K.sr(x, x + 0.25, 0, 0.6, -31.0, -23.0, PAL.concL, UK.CONC);
  pipeRack(K, 24.5, 40.5, -21.4, { y: 2.7, cols: ['#d9a91f', '#c0392b'] });
  pipeLow(K, 24, 42, -17.6, { col: '#c0392b', gaps: [[29, 31.5], [36.5, 39]] });
  tanker(K, 47.9, -22.6, Math.PI); tanker(K, 47.9, -19.0, Math.PI, '#b9b4a8', '#7a3a2f');
  // jeneratör binası
  milBlock(K, { x0: 13.5, x1: 22.5, z0: -25, z1: -18, floors: 1, wall: '#7f8a7c', winGap: 2.6, doors: { e: [-21.5], w: [-21.5], s: [16.5] }, rooms: [{ f: 0, kind: 'generator', x0: 13.8, x1: 22.2, z0: -24.7, z1: -18.3 }], labels: [{ side: 's', t: 'G-2', at: 19.6, w: 0.9, h: 0.36 }], roof: (K2, H) => { roofVent(K2, 15.5, H, -23); roofAC(K2, 20, H, -21.5, 0); } });
  // helipad + helikopter, kontrol kulesi, kamuflajlı kamyon
  helipad(K, 33, -47, 13); K.b.with(0, 0.12, 0, 0, () => helicopter(K, 33.4, -47, Math.PI / 2, '#3f4a5e'));
  controlTower(K, 22, -50, 0);
  camoNet(K, 45.5, -51, 9.6, 5.0, 3.6); truck(K, 45.5, -51, 0, PAL.olive);
  tWall(K, 27, -39.4, 4, 0); tWall(K, 17.6, -34.4, 4, Math.PI / 2);
  container(K, 55, -55, 0, { col: '#2d5a8a' }); container(K, 40, -57.4, 0, { col: '#8a3a2d' });
  tankWreck(K, 22.4, -42.0, Math.PI);
  // siper hattı (helipad ile tank çiftliği arası) + MG yuvaları
  for (const [a, b] of [[22.6, 28.4], [30.6, 36.4], [38.6, 41.8]]) sandbags(K, (a + b) / 2, -33.4, b - a, 0);
  mgNest(K, 26.2, -36.6, Math.PI / 2); mgNest(K, 35.2, -37.0, Math.PI / 2);
  guardTower(K, 45, -38, 0, { s: 6, door: 'w', label: 'GK-2' });
  for (const [x, z, ry] of [[28, -5.2, 0], [44.6, -5.6, Math.PI], [30, -38.0, 0], [41.2, -44.2, Math.PI], [25.9, -44.2, 0], [21.8, -15.4, 0]]) lampPost(K, x, z, ry);
  signBoard(K, 24.6, -7.0, Math.PI / 2, 2.4, 0.6, '⚠ YANICI MADDE', '#20242a', '#e2b52c');
  K.co('Akaryakıt', 34, -18, true); K.co('Benzinlik', 34, -12); K.co('Tank Çiftliği', 33, -27); K.co('Helipad', 33, -47, true); K.co('Kontrol Kulesi', 22, -50); K.co('Pompa Dairesi', 47, -12);
}

// ───── GÜNEYBATI: Kışla ─────
export function barracks(K) {
  const dorm = (z, lbl) => milBlock(K, { x0: -46, x1: -26, z0: z - 4, z1: z + 4, floors: 1, wall: '#7d8778', winGap: 2.5,
    doors: { n: [-41.5, -30.5], s: [-41.5, -30.5], w: [z], e: [z] },
    parts: [{ axis: 'z', c: -36, a0: z - 3.7, a1: z + 3.7, doors: [{ at: z, w: 1.3 }] }],
    rooms: [{ f: 0, kind: 'barracks', x0: -45.7, x1: -36.075, z0: z - 3.7, z1: z + 3.7 }, { f: 0, kind: 'barracks', x0: -35.925, x1: -26.3, z0: z - 3.7, z1: z + 3.7 }],
    labels: [{ side: 'e', t: lbl, at: z - 2.0, w: 1.6, h: 0.44 }, { side: 'w', t: lbl, at: z + 2.0, w: 1.6, h: 0.44 }],
    roof: (K2, H) => { roofVent(K2, -41, H, z); roofVent(K2, -31, H, z); roofAC(K2, -36, H, z + 2, 0); } });
  dorm(12, 'KIŞLA A'); dorm(25, 'KIŞLA B');
  // revir (9 × 7, beyaz)
  milBlock(K, { x0: -23.5, x1: -14.5, z0: 18.5, z1: 25.5, floors: 1, wall: '#d2d6d0', base: '#9a9f9a', band: '#b8392c', winGap: 2.6, doors: { s: [-20.5], n: [-17.5], e: [22] }, rooms: [{ f: 0, kind: 'medical', x0: -23.2, x1: -14.8, z0: 18.8, z1: 25.2 }],
    labels: [{ side: 'w', t: 'REVİR', at: 22, w: 2.0, h: 0.5, fg: '#ffffff', bg: '#b8392c' }, { side: 'n', t: '+ REVİR', at: -20.6, w: 1.8, h: 0.44, fg: '#ffffff', bg: '#b8392c' }] });
  ambulance(K, -19, 28.6, 0);
  // silah deposu (18 × 11)
  milBlock(K, { x0: -49, x1: -31, z0: 41.5, z1: 52.5, floors: 1, wall: '#868c80', winGap: 3.0, doors: { n: [-45, -35], s: [-40], e: [47], w: [47] }, rooms: [{ f: 0, kind: 'armory', x0: -48.7, x1: -31.3, z0: 41.8, z1: 52.2 }],
    labels: [{ side: 'n', t: 'CEPHANELİK', at: -40, w: 2.8, h: 0.55 }], roof: (K2, H) => { roofAC(K2, -44, H, 47, 0); roofAC(K2, -36, H, 47, 0); roofVent(K2, -40, H, 44); } });
  sandbags(K, -23.2, 9.0, 3.4, Math.PI / 2); sandbags(K, -48.0, 18.5, 3.2, Math.PI / 2); hesco(K, -36, 18.5, 5, 0);
  barrels(K, -48.9, 11.2, [[0, 0], [0, 0.62]], [PAL.olive, PAL.olive]); crate(K, -23.2, 16.8, 1.1); crate(K, -23.2, 15.5, 1.0);
  bunker(K, -24.5, 36, 0); bunker(K, -50, 36, Math.PI);
  sandbags(K, -31, 32.2, 4, 0); tWall(K, -54.6, 31.5, 4, Math.PI / 2); tWall(K, -18.2, 33, 4, Math.PI / 2);
  guardTower(K, -21, 49, 0, { s: 6, door: 'n', label: 'GK-4' });
  apc(K, -31, 56.4, Math.PI, '#5b6648', true); tankWreck(K, -51.5, 55.6, 0);
  mgNest(K, -52.4, 44, Math.PI); mgNest(K, -27.2, 40.6, 0);
  for (const [x, z, ry] of [[-46.4, 3.6, 0], [-25.6, 3.6, Math.PI], [-46.8, 30.2, 0], [-25.0, 30.2, Math.PI], [-33, 39.8, 0], [-47, 39.8, 0], [-27, 54.2, Math.PI]]) lampPost(K, x, z, ry);
  fireBarrel(K, -22.6, 13.8);
  K.co('Kışla', -34, 18, true); K.co('Kışla A', -36, 12); K.co('Kışla B', -36, 25); K.co('Revir', -19, 22); K.co('Cephanelik', -40, 47, true); K.co('Güneybatı Kule', -21, 49); K.co('Güneybatı Sığınak', -24.5, 36);
}

// ───── KÖŞE AVLULARI: garaj + helipad (kuzeybatı v = 0 / güneydoğu v = 1) ─────
export function yardGarage(K, v) {
  garageRow(K, -70, -60, 3, 5.6, 8, 4.2, '#7e8783');
  humvee(K, -67.2, -56.6, -Math.PI / 2, PAL.olive); apc(K, -61.6, -56.2, -Math.PI / 2); ambulance(K, -56.0, -56.4, -Math.PI / 2);
  helipad(K, -66.5, -38.5, 12); K.b.with(0, 0.12, 0, 0, () => helicopter(K, -66.5, -38.5, Math.PI / 2, v ? '#6a3f35' : '#3f4a5e'));
  camoNet(K, -77, -44, 4.6, 10.2, 3.6); truck(K, -77, -44, Math.PI / 2, v ? '#7a4a3a' : '#4d5c3a');
  container(K, -77.4, -33.5, Math.PI / 2, { col: '#556b2f' });
  tWall(K, -57.6, -45, 5, Math.PI / 2);
  crate(K, -57.2, -50.8, 1.1); barrels(K, -73.8, -50.4, [[0, 0], [0.62, 0]], [PAL.red, PAL.olive]);
  mgNest(K, -58.6, -32.4, 0); fireBarrel(K, -70.2, -49.6);
  for (const [x, z, ry] of [[-72.4, -30.8, 0], [-59.4, -28.8, Math.PI], [-58.4, -49.6, Math.PI], [-72.4, -48.4, 0]]) lampPost(K, x, z, ry);
  K.co(v ? 'Güneydoğu Garaj' : 'Kuzeybatı Garaj', -61.6, -55, true); K.co(v ? 'Güneydoğu Helipad' : 'Kuzeybatı Helipad', -66.5, -38.5);
}
// ───── KÖŞE AVLULARI: konteyner labirenti (güneybatı v = 0 / kuzeydoğu v = 1) ─────
export function yardMaze(K, v) {
  const C = ['#2d5a8a', '#8a6a2d', '#556b2f', '#8a3a2d', '#6b6f78', '#3b6a9a'];
  let ci = v ? 3 : 0;
  const c = (x, z, ry = 0, y = 0, len = 6.06) => container(K, x, z, ry, { y, len, col: C[ci++ % C.length], door: ry === 0 });
  c(-75.4, 32.5); c(-66.4, 32.5); c(-58.4, 32.5);
  c(-72, 39.5); c(-62.4, 39.5);
  c(-75.8, 46.5); c(-67.4, 46.5); container(K, -58.4, 46.5, 0, { col: C[ci++ % C.length], door: false });
  c(-72, 39.5, 0, 2.59); c(-66.4, 32.5, 0, 2.59); c(-67.4, 46.5, 0, 2.59);
  c(-78.0, 37.0, Math.PI / 2, 0, 4.4); c(-56.8, 37.0, Math.PI / 2, 0, 3.0);
  crate(K, -64.4, 36.0, 1.1); crate(K, -65.7, 36.1, 1.0); crate(K, -74.0, 43.2, 1.1); barrels(K, -61.0, 42.8, [[0, 0], [0.62, 0]], [PAL.red, PAL.olive]);
  crate(K, -69.6, 50.4, 1.1); crate(K, -70.9, 50.5, 1.0);
  // konteyner üstü nişancı yuvası (merdiven doğu ucunda)
  K.stair(-51.47, 46.5, 0, '-x', 1.4, 13, 2.59 / 13, 0.3, '#8b8f88', UK.CONC);
  K.b.with(-58.4, 2.59, 46.5, 0, () => { sandbags(K, 0.2, -0.86, 3.4, 0, 0.8, 0.5); sandbags(K, -2.4, 0.1, 1.8, Math.PI / 2, 0.8, 0.5); crate(K, 1.9, 0.5, 0.8); });
  for (const [x, z, ry] of [[-70, 36, 0], [-63.2, 43, Math.PI], [-73.8, 29.8, 0], [-60.2, 51.2, Math.PI]]) lampPost(K, x, z, ry);
  fireBarrel(K, -78.2, 42.4); fireBarrel(K, -57.2, 41.6);
  pipeRack(K, -78.6, -56.6, 51.2, { y: 2.8, cols: ['#d9a91f', '#6a6f74'] });
  K.co(v ? 'Kuzeydoğu Konteynerler' : 'Güneybatı Konteynerler', -66, 40, true); K.co(v ? 'Kuzeydoğu Nişancı Yuvası' : 'Güneybatı Nişancı Yuvası', -58.4, 46.5);
}

// ───── ANA CADDE siperleri (batı yarısı; doğu yarısı döndürülmüş) ─────
export function avenue(K) {
  jersey(K, -47, -2.4, 1, Math.PI / 2); jersey(K, -44, 2.6, 1, Math.PI / 2);
  sedanWreck(K, -38.5, -3.2, 0);
  sandbags(K, -33, 3.4, 4, 0);
  jersey(K, -28, -2.6, 1, Math.PI / 2); crate(K, -27.9, 1.4, 1.1); crate(K, -27.9, 2.75, 1.0);
  jersey(K, -22, 2.4, 1, Math.PI / 2); sandbags(K, -21, -3.6, 3.6, 0);
  sedanWreck(K, -17.2, 3.3, Math.PI, '#4a5560');
  fireBarrel(K, -41, 0.2); fireBarrel(K, -24.6, -0.4);
}
export { ammoBox };
