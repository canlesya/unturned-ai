import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import { KuzeyTerrain } from './assets/kuzey/terrain.js';
import { KZ_BOUNDS, FLAGS, HQ, PADS, CALLOUTS, VEHICLES, HELIPADS, DAM } from './assets/kuzey/layout.js';
import { KK, makeKuzeyMaterial } from './assets/kuzey/surface.js';
import { ChunkSet } from './assets/kuzey/chunks.js';
import { placeAll } from './assets/kuzey/blockout.js';
import { helipad } from './assets/kuzey/military.js';
import { extraHelipadsFor } from './vehScale.js';
import { scatterVegetation, vegetationColliders, fieldCover, fallenLogs } from './assets/kuzey/vegetation.js';
import { TerrainMesh } from './assets/kuzey/terrainMesh.js';
import { Forest } from './assets/common/kuzeyFlora.js';
import { Water } from './assets/kuzey/water.js';
import { Atmosphere, envAtHour } from './assets/kuzey/atmosphere.js';
import { makeGrass } from './assets/kuzey/grass.js';
import { Fauna } from './assets/kuzey/fauna.js';
import { Life } from './assets/kuzey/life.js';
import { Ambience } from './assets/kuzey/ambience.js';
import { SURF } from './assets/kuzey/terrain.js';
import { TOWERS, milTower, emplacementsFor } from './assets/kuzey/towers.js';      // 12.213 gözetleme kuleleri + sabit silah yuvaları
import { KuzeyNav } from './kuzeyNav.js';

// "Kuzey Vadisi" (12.172) — büyük harita (1600 × 1600 m oynanır, 5 km uzak manzara), Ele Geçirme 7 bayrak + Takım Çatışması (12.219: bütün harita, araçlı; bayrak yerleri TDM'de çatışma bölgesi, game/bigTdm.js).
// Arazi (2 m ızgara, yollar / köy sokakları / baraj gölü / alanlar; 12.182 ortadaki nehir yok), bölgelerde varlıklar (içine girilen binalar), orman + çalı çiti + kaya + devrik ağaç + buğday,
// su, gök / bulut / pus, maç boyu değişen gün ışığı, hayvanlar, ortam sesi, gece ışıkları; araç doğuş / heliped / yol ağı / ganimet noktası VERİSİ.
// Görsel katmanlar (arazi ağı, orman, su, atmosfer) yalnız tarayıcıda kurulur (MapBuilder.noVisual: sunucu yalnız arazi + çarpışma + yerleşim).
export const KZ_HOURS = { day: 10.5, sunset: 18.9 };
export const KZ_CYCLE = { day: [9.6, 13.4], sunset: [16.4, 19.8] };          // maç boyunca saat (başlangıç → maç sonu); gece sabit
export const KZ_PLAY = { minX: -765, maxX: 765, minZ: -792, maxZ: 792, t: 10 };   // savaş alanı (dışında 10 sn geri sayım → ölüm); sert sınır KZ_BOUNDS
export function buildKuzey() {
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const visual = !MapBuilder.noVisual;
  const T = new KuzeyTerrain({ visual });
  const surface = { ground: (x, z) => T.heightAt(x, z), kindOf: () => KK.PLAIN, seeded: true, material: makeKuzeyMaterial };
  const cs = new ChunkSet({ size: 200, surface });
  const rng = makeRng(1972);
  const { occ, wires, orchard, rocks } = placeAll(cs, T, rng);
  const veg = scatterVegetation(T, occ, makeRng(7272), makeRng(9191), { outer: visual, orchard, rocks, wires });
  vegetationColliders(veg, cs);
  fallenLogs(veg.logs, cs);
  // 12.206 büyük maçların ek helikopterleri için helipedler (oyuncu sayısından bağımsız hep çizilir: harita bir kez kurulur). Yerleşimden SONRA: blockout'un
  // ayak izi listesine girselerdi orman / piyade doğuşu rastgele akışı kayardı; yerler zaten ağaçsız / yapısız seçildi (vehScale.js)
  for (const hp of extraHelipadsFor('kuzey')) helipad(cs.at(hp.x, hp.z), T, hp);
  // 12.213 gözetleme kuleleri (yerleşimden SONRA, helipedler gibi: yerler zaten ağaçsız / yapısız seçildi → orman / doğuş rastgele akışı değişmez)
  const towers = TOWERS.map((t) => milTower(cs.at(t[1], t[2]), T, t, FLAGS.find((f) => f.id === t[0])));
  const nWheat = fieldCover(T, cs);
  const group = new THREE.Group(); group.name = 'kuzey';
  cs.build(group);
  const colliders = cs.colliders, sight = cs.sight;

  // ── doğuşlar: üs alanında (yapı / araç ayak izi dışı) aralıklı noktalar ──
  // 12.203: 32 → 160 nokta (128v128: aynı anda doğan dalga iç içe geçmesin), aralık 5 → 3,6 m. İlk 32 nokta eskisiyle aynı sırada üretilir (aynı tohum).
  const spawnsFor = (team) => {
    const H = HQ[team], s = team === 'blue' ? 1 : -1, pts = [], R = makeRng(team === 'blue' ? 11 : 22);
    for (let k = 0; k < 6000 && pts.length < 160; k++) {
      const x = H.x + (R() - 0.5) * 150, z = H.z + s * (-12 + (R() - 0.5) * 70);
      if (occ.some((r) => x > r[0] - 1.5 && x < r[1] + 1.5 && z > r[2] - 1.5 && z < r[3] + 1.5)) continue;
      if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < (pts.length < 32 ? 5 : 3.6))) continue;
      pts.push({ x: +x.toFixed(2), z: +z.toFixed(2), ry: H.ry });
    }
    return pts;
  };
  const spawns = { blue: spawnsFor('blue'), red: spawnsFor('red') };
  const pad = (id) => PADS.find((p) => p.id === id);
  const zoneOf = (p) => ({ minX: p.x - p.w / 2, maxX: p.x + p.w / 2, minZ: p.z - p.d / 2, maxZ: p.z + p.d / 2 });
  const flagY = (f) => (f.id === 'E' ? DAM.crest : T.heightAt(f.x, f.z));
  const ctx = cs.ctx, loot = (ctx.loot || []).filter((p) => Math.abs(p.x) < KZ_PLAY.maxX && Math.abs(p.z) < KZ_PLAY.maxZ);

  // mini harita: yollar (8 m'de bir dikdörtgen)
  const roadRects = [];
  for (const r of T.roads) for (let i = 0; i < r.pts.length; i += 4) { const [x, z] = r.pts[i]; roadRects.push({ x0: x - r.w / 2, z0: z - r.w / 2, x1: x + r.w / 2, z1: z + r.w / 2 }); }

  // gün ışığı: atmosfer anahtar karelerinden (gündüz 10:30, gün batımı 18:54); todEnv gün batımında sis yakın / uzak için çarpan bekler
  const D = envAtHour(KZ_HOURS.day), S = envAtHour(KZ_HOURS.sunset);
  const env = {
    ...D, clouds: 0,
    grade: { exposure: 1.0, tint: [1.01, 1.0, 0.98], sat: 1.04, contrast: 1.06, vig: 0.14, bloom: 0.1, thr: 1.6 },
    sunset: { sky: S.sky, fog: [S.fog[0], S.fog[1] / D.fog[1], S.fog[2] / D.fog[2]], sun: S.sun, hemi: S.hemi, cloud: '#ffc2a0', sunPos: S.sunPos },
    night: { fog: ['#101a33', 0.3, 0.45], sunPos: [-60, 90, -40] },
  };
  const map = {
    id: 'kuzey', name: 'Kuzey Vadisi', group, colliders, sight, bounds: KZ_BOUNDS, terrain: T,
    view: { far: 7000, near: 0.1 }, navCell: 2, big: true, playArea: KZ_PLAY, dayCycle: KZ_CYCLE,
    lootSpots: loot, navDoors: ctx.doors || [],
    swimExits: ctx.swimExits || [],                                                                // 12.180 dik kıyılı suyun çıkış noktaları (baraj gölü merdiveni): içine düşen bot buraya yüzer                                                   // ileride battle royale: bina içi masa / raf / sandık / zemin noktaları
    navPost: (nav) => navPost(nav, ctx, T, colliders),
    callouts: CALLOUTS.map(([name, x, z, r]) => ({ name, x, z, r, ...(/Üs$/.test(name) ? { major: true } : {}) })),          // mini haritada yalnız üs adları (bayraklar zaten işaretli)
    mini: null, roads: roadRects, roadColor: '#5b5d61',
    spawns, baseZones: { blue: zoneOf(pad('BHQ')), red: zoneOf(pad('RHQ')) },
    objectives: FLAGS.map((f) => ({ ...f, label: f.id, y: flagY(f), core: !!f.core })),
    vehicles: VEHICLES, helipads: HELIPADS, towers, emplacements: emplacementsFor(towers, T),      // 12.213
    makeNav() { return new KuzeyNav(this.colliders, this.bounds, this.terrain, this.navCell, towers); },      // 12.213 kule merdiveni / tepesi: ikinci kat bağlantısı
    roadGraph: T.roads.map((r) => ({ id: r.id, t: r.t, w: r.w, pts: r.pts.filter((_, i) => i % 3 === 0 || i === r.pts.length - 1) })),
    wires, veg: visual ? veg : null,
    env, visMul: 1,
    stats: { trees: veg.length, treesIn: veg.filter((t) => t.inside).length, colliders: colliders.length, sight: sight.length, wheatCover: nWheat, logs: veg.logs.length, loot: loot.length, doors: (ctx.doors || []).length, chunks: cs.list.length, buildMs: 0, terrainMs: T.tBuild },
  };
  if (visual) map.fx = makeFx(map, T, cs, veg, occ);
  map.stats.buildMs = Math.round((typeof performance !== 'undefined' ? performance : Date).now() - t0);
  return map;
}

// görsel katmanlar (tarayıcı): arazi ağı, orman, su, atmosfer, teller; her karede LOD + zaman (Game.render → map.fx.update(t, camera, game))
// nav son işlemi: savaş alanı dışı (3 m pay) kapalı (botlar sınıra gitmez) · kapı hücreleri açık (2 m ızgarada 1,2 m'lik kapı duvar şişirmesiyle kapanıyordu)
function navPost(nav, ctx, T, colliders) {
  const A = KZ_PLAY, c = nav.cell;
  for (let j = 0; j < nav.h; j++) for (let i = 0; i < nav.w; i++) {
    const x = nav.minX + (i + 0.5) * c, z = nav.minZ + (j + 0.5) * c;
    if (x < A.minX + 3 || x > A.maxX - 3 || z < A.minZ + 3 || z > A.maxZ - 3) nav.blocked[j * nav.w + i] = 1;
  }
  if (colliders) { navThin(nav, T, colliders); navFloors(nav, ctx, colliders); }
  let n = 0;
  for (const d of ctx.doors || []) for (const [x, z] of d.pts) { const k = nav.idx(x, z); if (k >= 0 && k < nav.blocked.length && nav.blocked[k]) { nav.blocked[k] = 0; n++; } }
  nav.opened = n;
  navDoorThread(nav, ctx.doors || []);
  // 12.184 baraj: gövdenin bütün kademeleri 'deck' (tabliye) → 2 m ızgara mansap yüzünün 2 m'lik basamaklarını da "yürünür" sayıyordu; bot kanyon
  // tabanından Baraj bayrağına (tepe, 24 m) dümdüz yüze yürüyüp takılıyordu. Tepe kotunda olmayan kademe hücreleri kapalı → tepeye iki yamaçtan çıkılır.
  if (!T || !colliders) return;
  const dk = colliders.filter((q) => q.tag === 'deck' && q.min[0] > DAM.x - 60 && q.max[0] < DAM.x + 20);
  let nd = 0;
  for (let j = 0; j < nav.h; j++) for (let i = 0; i < nav.w; i++) {
    const x = nav.minX + (i + 0.5) * c, z = nav.minZ + (j + 0.5) * c;
    if (x < DAM.x - 40 || x > DAM.x + 10 || Math.abs(z - DAM.z) > DAM.len / 2 + 10) continue;
    const g = T.heightAt(x, z); let top = g;
    for (const q of dk) if (x > q.min[0] && x < q.max[0] && z > q.min[2] && z < q.max[2] && q.max[1] > top) top = q.max[1];
    if (top - g > 0.6 && top < DAM.crest - 0.6) { const k = j * nav.w + i; if (!nav.blocked[k]) { nav.blocked[k] = 1; nd++; } }
  }
  nav.damFace = nd;
  // 12.184 dik yamaç: nav hücre merkezindeki eğime bakar (> 0,95 kapalı), fizik ise adım başına eksen eğimine (> 1,2 çıkılamaz). Kanyon / kayalık
  // yamaçlarda merkez yatık, hücrenin bir köşesi dik kalabiliyor → bot yola çıkıp yamacın dibinde gidip geliyordu. Hücrenin 5 noktasında eksen eğimi > 1,2 → kapalı.
  let ns = 0;
  for (let j = 0; j < nav.h; j++) for (let i = 0; i < nav.w; i++) {
    const k = j * nav.w + i; if (nav.blocked[k]) continue;
    const x = nav.minX + (i + 0.5) * c, z = nav.minZ + (j + 0.5) * c;
    if (T.slopeAt(x, z, 0.6) < 0.5 || dk.some((q) => x > q.min[0] && x < q.max[0] && z > q.min[2] && z < q.max[2] && q.max[1] > T.heightAt(x, z) - 0.3)) continue;   // tabliye (baraj) üstü: arazi eğimi değil
    for (const [ox, oz] of SUB) {
      const px = x + ox, pz = z + oz;
      if (Math.abs(T.heightAt(px + 0.25, pz) - T.heightAt(px - 0.25, pz)) > 0.6 || Math.abs(T.heightAt(px, pz + 0.25) - T.heightAt(px, pz - 0.25)) > 0.6) { nav.blocked[k] = 1; ns++; break; }
    }
  }
  nav.steep = ns;
}
const SUB = [[0, 0], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]];

// 12.184 kapıdan geçiş: 2 m ızgaranın ara noktası hücre merkezi, kapı 1,2 m (gövde 0,32 m yarıçap → pervaz payı ±0,28 m); merkez kapı ekseninden
// 0,4–0,9 m kayınca bot pervaza yürüyüp eşikte takılıyordu. Yol bir kapı hücresinden geçiyorsa kapı ekseninde dış + iç nokta (yakından geçilir: tight) eklenir.
function navDoorThread(nav, doors) {
  const of = new Map();
  doors.forEach((d, di) => { for (const [x, z] of d.pts) of.set(nav.idx(x, z), di); });
  nav.threadDoors = (path, x0, z0) => {
    let px = x0, pz = z0, last = -1;
    for (let i = 0; i < path.length; i++) {
      const q = path[i]; if (q.door !== undefined) { px = q.x; pz = q.z; continue; }
      const L = Math.hypot(q.x - px, q.z - pz), n = Math.ceil(L / 0.5);
      let hit = -1;
      for (let k = 0; k <= n && hit < 0; k++) { const t = n ? k / n : 0, di = of.get(nav.idx(px + (q.x - px) * t, pz + (q.z - pz) * t)); if (di !== undefined && di !== last) hit = di; }
      if (hit >= 0) {
        const P = doors[hit].pts, a = P[0], b = P[4];
        const [n0, n1] = Math.hypot(a[0] - px, a[1] - pz) < Math.hypot(b[0] - px, b[1] - pz) ? [a, b] : [b, a];
        const w0 = q.clone().set(n0[0], q.y, n0[1]), w1 = q.clone().set(n1[0], q.y, n1[1]); w0.door = w1.door = hit; w0.tight = w1.tight = true;
        path.splice(i, 0, w0, w1); i += 2; last = hit;
      }
      px = q.x; pz = q.z;
    }
    return path;
  };
}

// 12.184 ince duvar: NavGrid bir kutuyu şişirilmiş aralığında hücre MERKEZİ varsa kapatır; 0,3 m duvar (+ 2 × 0,35) iki merkez arasına düşünce hiç
// kapanmıyordu → nav duvarın içinden yol çiziyor, bot duvara yürüyüp takılıyordu (köy / mezra evleri, ahır, avlu duvarı, çit, gözetleme kulesi ayağı /
// merdiveni, ağaç gövdesi, direk). Gövde bandındaki kutunun hücresiz kalan ekseninde ortasındaki hücre kapatılır.
function navThin(nav, T, colliders) {
  const c = nav.cell, INF = 0.35; let n = 0;
  const rng = (lo, hi, min) => [Math.ceil((lo - min) / c - 0.5), Math.floor((hi - min) / c - 0.5)];
  for (const q of colliders) {
    if (q.tag === 'deck' || q.tag === 'veh') continue;
    const sx = q.max[0] - q.min[0], sz = q.max[2] - q.min[2];
    if (sx > 60 || sz > 60) continue;
    let [a0, a1] = rng(q.min[0] - INF, q.max[0] + INF, nav.minX), [b0, b1] = rng(q.min[2] - INF, q.max[2] + INF, nav.minZ);
    const ex = a0 > a1, ez = b0 > b1;
    if (!ex && !ez) continue;
    const gy = T.heightAt((q.min[0] + q.max[0]) / 2, (q.min[2] + q.max[2]) / 2);
    if (q.min[1] - gy > 1.6 || q.max[1] - gy < 0.45) continue;
    if (ex) a0 = a1 = Math.floor(((q.min[0] + q.max[0]) / 2 - nav.minX) / c);
    if (ez) b0 = b1 = Math.floor(((q.min[2] + q.max[2]) / 2 - nav.minZ) / c);
    for (let j = Math.max(0, b0); j <= Math.min(nav.h - 1, b1); j++) for (let i = Math.max(0, a0); i <= Math.min(nav.w - 1, a1); i++) { const k = j * nav.w + i; if (!nav.blocked[k]) { nav.blocked[k] = 1; n++; } }
  }
  nav.thin = n;
}

// 12.184 bina içi nav: 2 m ızgara engeli arazi kotuna göre ölçer → eğimdeki binanın taş kaidesi (döşeme, arazinin 0,45 m'den çok üstünde) bütün ayak izini
// kapatıyordu; botlar yeni döşenmiş evlere (ve eğimdeki eski evlere / ahırlara) giremiyordu (kapı hücresi açık, içi kapalı). Kapının içindeki döşeme kutusu
// (üstü kapı kotunda) bulunur; ayak izindeki hücreler döşeme kotuna göre yeniden hesaplanır: duvar / eşya / merdiven (gövde bandında) kapalı, gerisi açık.
// İnce duvar iki hücre merkezinin arasına düşse de en yakın hücre kapanır (duvar nav'da delik bırakmaz).
function navFloors(nav, ctx, colliders) {
  const c = nav.cell, INF = 0.35, done = new Set();
  const cells = (lo, hi, min, n) => { let a = Math.ceil((lo - min) / c - 0.5), b = Math.floor((hi - min) / c - 0.5); if (a > b) a = b = Math.floor(((lo + hi) / 2 - min) / c); return [Math.max(0, a), Math.min(n - 1, b)]; };
  let opened = 0;
  for (const d of ctx.doors || []) {
    const [ix, iz] = d.pts[0];
    const F = colliders.find((q) => Math.abs(q.max[1] - d.y) < 0.06 && ix > q.min[0] && ix < q.max[0] && iz > q.min[2] && iz < q.max[2] && (q.max[0] - q.min[0]) * (q.max[2] - q.min[2]) > 6);
    if (!F || done.has(F)) continue;
    done.add(F);
    const top = F.max[1];
    const [x0, x1] = cells(F.min[0] + INF, F.max[0] - INF, nav.minX, nav.w), [z0, z1] = cells(F.min[2] + INF, F.max[2] - INF, nav.minZ, nav.h);
    const near = colliders.filter((q) => q !== F && q.max[0] > F.min[0] - 1 && q.min[0] < F.max[0] + 1 && q.max[2] > F.min[2] - 1 && q.min[2] < F.max[2] + 1 && q.min[1] - top < 1.6 && q.max[1] - top > 0.45);
    const X0 = x0 - 1, X1 = x1 + 1, Z0 = z0 - 1, Z1 = z1 + 1, NW = X1 - X0 + 1;         // 1 hücre pay: dış duvarın hücresi döşeme aralığının dışına düşebilir (yalnız kapatır)
    const blk = new Uint8Array(NW * (Z1 - Z0 + 1));
    for (const q of near) {
      const [a0, a1] = cells(q.min[0] - INF, q.max[0] + INF, nav.minX, nav.w), [b0, b1] = cells(q.min[2] - INF, q.max[2] + INF, nav.minZ, nav.h);
      for (let j = Math.max(Z0, b0); j <= Math.min(Z1, b1); j++) for (let i = Math.max(X0, a0); i <= Math.min(X1, a1); i++) blk[(j - Z0) * NW + (i - X0)] = 1;
    }
    for (let j = Z0; j <= Z1; j++) for (let i = X0; i <= X1; i++) {
      if (i < 0 || j < 0 || i >= nav.w || j >= nav.h) continue;
      const k = j * nav.w + i, b = blk[(j - Z0) * NW + (i - X0)], inF = i >= x0 && i <= x1 && j >= z0 && j <= z1;
      if (!inF) { if (b) nav.blocked[k] = 1; continue; }
      if (!b && nav.blocked[k]) opened++;
      nav.blocked[k] = b;
    }
  }
  nav.floors = done.size; nav.floorOpened = opened;
}

function makeFx(map, T, cs, veg, occ) {
  const quality = typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'low' : 'high';
  const tm = new TerrainMesh(T, { quality }), forest = new Forest(veg, { quality }), water = new Water(T, map.env), atm = new Atmosphere(T, { hour: KZ_HOURS.day });
  const grass = makeGrass(T, occ, { quality }), fauna = new Fauna(T, map), life = new Life(T, cs.ctx, { quality });
  map.group.add(tm.group, forest.group, water.group, atm.group, grass.mesh, fauna.group, life.group);
  // teller: tek LineSegments (sarkık eğri, 8 parça)
  const P = [];
  for (const [a, b, sag] of map.wires) {
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = 8;
    for (let i = 0; i < n; i++) for (const t of [i / n, (i + 1) / n]) P.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 4 * sag * L * t * (1 - t) * 0.5, a[2] + (b[2] - a[2]) * t);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#2a2c2e' })); lines.userData.wire = true; map.group.add(lines);
  const farD = quality === 'low' ? [260, 900] : [420, 1700];
  let amb = null, game0 = null, cyc = null, hourT = 0, hour = KZ_HOURS.day, lastT = 0;
  const lightOf = (h) => Math.max(1 - Math.max(0, Math.min(1, (h - 5.6) / 1.2)), Math.max(0, Math.min(1, (h - 18.9) / 1.0)));
  return {
    tm, forest, water, atm, quality, grass, fauna, life,
    // Game kurucusu (hava uygulandıktan, ön ısıtmadan önce): doğrusal sis → üstel² sis (FogExp2). Yarı yoğunluk = havanın verdiği uzak sınırın %85'i;
    // yakın-orta mesafe net (oynanış), uzak vadi pusa gömülür; dağ ağı aynı yoğunluktan "hava perspektifi" alır (sis duvarı / bant oluşmaz).
    attach(game) {
      const f = game.scene.fog;
      if (f && !f.isFogExp2) { const F = f.far; game.scene.fog = new THREE.FogExp2(f.color.clone(), 0.8326 / (0.85 * F)); this.fogF = F; this.fogRatio = F / (map.env.fog[2] || F); }
      this.weather = game.weather?.kind || 'clear';
      game0 = game;
      cyc = game.tod !== 'night' && Number.isFinite(game.mode?.time) && game.mode.time > 0 ? KZ_CYCLE[game.tod] || null : null;
      hour = cyc ? cyc[0] : KZ_HOURS[game.tod] ?? KZ_HOURS.day;
      if (game.tod === 'night') { atm.setNight(water); life.setLight(1); } else if (cyc) this.setHour(hour, game); else { atm.setHour(hour, this.weather !== 'clear' ? game : null, water, true); life.setLight(lightOf(hour)); }   // 12.184 sabit saatte de yağmur / sis gök + güneşe uygulanır
      if (game.tod === 'night') life.setSmokeColor(new THREE.Color('#3a4258'), 0.55);
      if (this.weather === 'rain') grass.mesh.userData.U.uWind.value = 1.8;
      // hayvanlar silah sesinden ürker (sfx.shot / explosion kancası; çevrim içinde uzak oyuncuların atışları da buradan geçer)
      if (game.sfx?.shot && !game.sfx._kzHook) {
        const so = game.sfx.shot.bind(game.sfx), eo = game.sfx.explosion?.bind(game.sfx);
        game.sfx.shot = (kind, pos) => { fauna.onShot(pos, kind === 'throw' ? 0 : 1); return so(kind, pos); };
        if (eo) game.sfx.explosion = (pos) => { fauna.onShot(pos, 1.6); return eo(pos); };
        game.sfx._kzHook = true;
      }
      amb = new Ambience(game.sfx);
    },
    update(t, cam, game) {
      const p = cam?.position || _c0, dt = Math.min(0.1, lastT ? t - lastT : 0.016); lastT = t;
      tm.update(p); cs.update(p, farD); forest.update(p, t); water.update(t, atm.sunDir); atm.update(t, p);
      grass.update(p, t); life.update(t);
      fauna.update(p, t, game?.soldiers);
      if (cyc && game && (hourT -= dt) <= 0) {                                                 // maç boyu gün ışığı: 2 sn'de bir (kalan süreden; çevrim içinde de eşzamanlı)
        hourT = 2;
        const k = Math.max(0, Math.min(1, 1 - (game.timeLeft ?? game.mode.time) / game.mode.time)), h = cyc[0] + (cyc[1] - cyc[0]) * k;
        if (Math.abs(h - hour) > 0.004) { hour = h; this.setHour(h, game); }
      }
      if (amb) {
        for (const [kind, x, z] of fauna.events) amb.play(kind, x, z);
        amb.update(dt, p, { night: game?.tod === 'night' || hour > 20, rain: this.weather === 'rain', treeNear: T.surfAt(p.x, p.z) === SURF.FOREST ? 1 : 0 });
      }
      fauna.events.length = 0;
    },
    get hour() { return hour; },
    // önizleme / ileride maç içi gün döngüsü: gök, güneş, ışık, sis (hava açıksa renk + yoğunluk; değilse yalnız yoğunluk oranı korunur)
    setHour(h, game) {
      const s = atm.setHour(h, game, water, true), f = game?.scene.fog;
      if (f?.isFogExp2) { if (this.weather === 'clear') f.color.copy(s.fog[0]); f.density = 0.8326 / (0.85 * s.fog[2] * (this.fogRatio || 1)); }
      life.setLight(lightOf(h)); hour = h;
      if (game?.env) { const gl = Math.max(0, Math.min(1.4, (h - 18.6) * 1.2)); game.map.group.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m.userData?.glow) m.emissiveIntensity = gl; }); }
      return s;
    },
  };
}
const _c0 = new THREE.Vector3(0, 50, 0);
