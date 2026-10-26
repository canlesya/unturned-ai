import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import { KuzeyTerrain } from './assets/kuzey/terrain.js';
import { KZ_BOUNDS, FLAGS, HQ, PADS, CALLOUTS, VEHICLES, HELIPADS, TDM_AREA, BRIDGES, DAM } from './assets/kuzey/layout.js';
import { KK, makeKuzeyMaterial } from './assets/kuzey/surface.js';
import { ChunkSet } from './assets/kuzey/chunks.js';
import { placeAll } from './assets/kuzey/blockout.js';
import { scatterVegetation, vegetationColliders } from './assets/kuzey/vegetation.js';
import { TerrainMesh } from './assets/kuzey/terrainMesh.js';
import { Forest } from './assets/common/kuzeyFlora.js';
import { Water } from './assets/kuzey/water.js';
import { Atmosphere, envAtHour } from './assets/kuzey/atmosphere.js';

// "Kuzey Vadisi" (12.172) — büyük harita (1600 × 1600 m oynanır, 5 km uzak manzara), Ele Geçirme 7 bayrak + Takım Çatışması (köy alt alanı).
// AŞAMA 1 iskeleti: arazi (2 m ızgara, yollar / nehir / alanlar), bölgelerde gerçek varlıklar (seyrek), orman, su, gök / bulut / pus, araç doğuş verisi.
// Görsel katmanlar (arazi ağı, orman, su, atmosfer) yalnız tarayıcıda kurulur (MapBuilder.noVisual: sunucu yalnız arazi + çarpışma + yerleşim).
export const KZ_HOURS = { day: 10.5, sunset: 18.9 };
export function buildKuzey() {
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const visual = !MapBuilder.noVisual;
  const T = new KuzeyTerrain({ visual });
  const surface = { ground: (x, z) => T.heightAt(x, z), kindOf: () => KK.PLAIN, seeded: true, material: makeKuzeyMaterial };
  const cs = new ChunkSet({ size: 200, surface });
  const rng = makeRng(1972);
  const { occ, wires } = placeAll(cs, T, rng);
  const veg = scatterVegetation(T, occ, makeRng(7272), makeRng(9191), { outer: visual });
  vegetationColliders(veg, cs);
  const group = new THREE.Group(); group.name = 'kuzey';
  cs.build(group);
  const colliders = cs.colliders, sight = cs.sight;

  // ── doğuşlar: üs alanında (yapı / araç ayak izi dışı) aralıklı noktalar ──
  const spawnsFor = (team) => {
    const H = HQ[team], s = team === 'blue' ? 1 : -1, pts = [], R = makeRng(team === 'blue' ? 11 : 22);
    for (let k = 0; k < 400 && pts.length < 32; k++) {
      const x = H.x + (R() - 0.5) * 150, z = H.z + s * (-12 + (R() - 0.5) * 70);
      if (occ.some((r) => x > r[0] - 1.5 && x < r[1] + 1.5 && z > r[2] - 1.5 && z < r[3] + 1.5)) continue;
      if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < 5)) continue;
      pts.push({ x: +x.toFixed(2), z: +z.toFixed(2), ry: H.ry });
    }
    return pts;
  };
  const spawns = { blue: spawnsFor('blue'), red: spawnsFor('red') };
  const pad = (id) => PADS.find((p) => p.id === id);
  const zoneOf = (p) => ({ minX: p.x - p.w / 2, maxX: p.x + p.w / 2, minZ: p.z - p.d / 2, maxZ: p.z + p.d / 2 });
  const flagY = (f) => (f.id === 'C' ? BRIDGES[0].deck : f.id === 'E' ? DAM.crest : T.heightAt(f.x, f.z));

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
    view: { far: 7000, near: 0.1 }, navCell: 2,
    callouts: CALLOUTS.map(([name, x, z]) => ({ name, x, z, ...(/Üs$/.test(name) ? { major: true } : {}) })),          // mini haritada yalnız üs adları (bayraklar zaten işaretli)
    mini: null, roads: roadRects, roadColor: '#5b5d61',
    spawns, baseZones: { blue: zoneOf(pad('BHQ')), red: zoneOf(pad('RHQ')) },
    objectives: FLAGS.map((f) => ({ ...f, label: f.id, y: flagY(f), core: !!f.core })),
    vehicles: VEHICLES, helipads: HELIPADS, roadGraph: T.roads.map((r) => ({ id: r.id, t: r.t, w: r.w, pts: r.pts.filter((_, i) => i % 3 === 0 || i === r.pts.length - 1) })),
    tdm: TDM_AREA, wires, veg: visual ? veg : null,
    env, visMul: 1,
    stats: { trees: veg.length, treesIn: veg.filter((t) => t.inside).length, colliders: colliders.length, chunks: cs.list.length, buildMs: 0, terrainMs: T.tBuild },
  };
  if (visual) map.fx = makeFx(map, T, cs, veg);
  map.stats.buildMs = Math.round((typeof performance !== 'undefined' ? performance : Date).now() - t0);
  return map;
}

// görsel katmanlar (tarayıcı): arazi ağı, orman, su, atmosfer, teller; her karede LOD + zaman (Game.render → map.fx.update(t, camera, game))
function makeFx(map, T, cs, veg) {
  const quality = typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'low' : 'high';
  const tm = new TerrainMesh(T, { quality }), forest = new Forest(veg, { quality }), water = new Water(T, map.env), atm = new Atmosphere(T, { hour: KZ_HOURS.day });
  map.group.add(tm.group, forest.group, water.group, atm.group);
  // teller: tek LineSegments (sarkık eğri, 8 parça)
  const P = [];
  for (const [a, b, sag] of map.wires) {
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = 8;
    for (let i = 0; i < n; i++) for (const t of [i / n, (i + 1) / n]) P.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 4 * sag * L * t * (1 - t) * 0.5, a[2] + (b[2] - a[2]) * t);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#2a2c2e' })); lines.userData.wire = true; map.group.add(lines);
  const farD = quality === 'low' ? [260, 900] : [420, 1700];
  return {
    tm, forest, water, atm, quality,
    // Game kurucusu (hava uygulandıktan, ön ısıtmadan önce): doğrusal sis → üstel² sis (FogExp2). Yarı yoğunluk = havanın verdiği uzak sınırın %85'i;
    // yakın-orta mesafe net (oynanış), uzak vadi pusa gömülür; dağ ağı aynı yoğunluktan "hava perspektifi" alır (sis duvarı / bant oluşmaz).
    attach(game) {
      const f = game.scene.fog;
      if (f && !f.isFogExp2) { const F = f.far; game.scene.fog = new THREE.FogExp2(f.color.clone(), 0.8326 / (0.85 * F)); this.fogF = F; this.fogRatio = F / (map.env.fog[2] || F); }
      this.weather = game.weather?.kind || 'clear';
      if (game.tod === 'night') atm.setNight(water); else atm.setHour(KZ_HOURS[game.tod] ?? KZ_HOURS.day, null, water);
    },
    update(t, cam) {
      const p = cam?.position || _c0;
      tm.update(p); cs.update(p, farD); forest.update(p, t); water.update(t, atm.sunDir); atm.update(t, p);
    },
    // önizleme / ileride maç içi gün döngüsü: gök, güneş, ışık, sis (hava açıksa renk + yoğunluk; değilse yalnız yoğunluk oranı korunur)
    setHour(h, game) {
      const s = atm.setHour(h, game, water, true), f = game?.scene.fog;
      if (f?.isFogExp2) { if (this.weather === 'clear') f.color.copy(s.fog[0]); f.density = 0.8326 / (0.85 * s.fog[2] * (this.fogRatio || 1)); }
      return s;
    },
  };
}
const _c0 = new THREE.Vector3(0, 50, 0);
