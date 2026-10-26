import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import { KuzeyTerrain } from './assets/kuzey/terrain.js';
import { KZ_BOUNDS, FLAGS, HQ, PADS, CALLOUTS, VEHICLES, HELIPADS, TDM_AREA, BRIDGES, DAM } from './assets/kuzey/layout.js';
import { KK, makeKuzeyMaterial } from './assets/kuzey/surface.js';
import { ChunkSet } from './assets/kuzey/chunks.js';
import { placeAll } from './assets/kuzey/blockout.js';
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

// "Kuzey Vadisi" (12.172) — büyük harita (1600 × 1600 m oynanır, 5 km uzak manzara), Ele Geçirme 7 bayrak + Takım Çatışması (köy alt alanı).
// Arazi (2 m ızgara, yollar / köy sokakları / nehir / alanlar), bölgelerde varlıklar (içine girilen binalar), orman + çalı çiti + kaya + devrik ağaç + buğday,
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
  const { occ, wires } = placeAll(cs, T, rng);
  const veg = scatterVegetation(T, occ, makeRng(7272), makeRng(9191), { outer: visual });
  vegetationColliders(veg, cs);
  fallenLogs(veg.logs, cs);
  const nWheat = fieldCover(T, cs);
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
    navPost: (nav) => navPost(nav, ctx),
    callouts: CALLOUTS.map(([name, x, z]) => ({ name, x, z, ...(/Üs$/.test(name) ? { major: true } : {}) })),          // mini haritada yalnız üs adları (bayraklar zaten işaretli)
    mini: null, roads: roadRects, roadColor: '#5b5d61',
    spawns, baseZones: { blue: zoneOf(pad('BHQ')), red: zoneOf(pad('RHQ')) },
    objectives: FLAGS.map((f) => ({ ...f, label: f.id, y: flagY(f), core: !!f.core })),
    vehicles: VEHICLES, helipads: HELIPADS, roadGraph: T.roads.map((r) => ({ id: r.id, t: r.t, w: r.w, pts: r.pts.filter((_, i) => i % 3 === 0 || i === r.pts.length - 1) })),
    tdm: TDM_AREA, wires, veg: visual ? veg : null,
    env, visMul: 1,
    stats: { trees: veg.length, treesIn: veg.filter((t) => t.inside).length, colliders: colliders.length, sight: sight.length, wheatCover: nWheat, logs: veg.logs.length, loot: loot.length, doors: (ctx.doors || []).length, chunks: cs.list.length, buildMs: 0, terrainMs: T.tBuild },
  };
  if (visual) map.fx = makeFx(map, T, cs, veg, occ);
  map.stats.buildMs = Math.round((typeof performance !== 'undefined' ? performance : Date).now() - t0);
  return map;
}

// görsel katmanlar (tarayıcı): arazi ağı, orman, su, atmosfer, teller; her karede LOD + zaman (Game.render → map.fx.update(t, camera, game))
// nav son işlemi: savaş alanı dışı (3 m pay) kapalı (botlar sınıra gitmez) · kapı hücreleri açık (2 m ızgarada 1,2 m'lik kapı duvar şişirmesiyle kapanıyordu)
function navPost(nav, ctx) {
  const A = KZ_PLAY, c = nav.cell;
  for (let j = 0; j < nav.h; j++) for (let i = 0; i < nav.w; i++) {
    const x = nav.minX + (i + 0.5) * c, z = nav.minZ + (j + 0.5) * c;
    if (x < A.minX + 3 || x > A.maxX - 3 || z < A.minZ + 3 || z > A.maxZ - 3) nav.blocked[j * nav.w + i] = 1;
  }
  let n = 0;
  for (const d of ctx.doors || []) for (const [x, z] of d.pts) { const k = nav.idx(x, z); if (k >= 0 && k < nav.blocked.length && nav.blocked[k]) { nav.blocked[k] = 0; n++; } }
  nav.opened = n;
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
      if (game.tod === 'night') { atm.setNight(water); life.setLight(1); } else if (cyc) this.setHour(hour, game); else { atm.setHour(hour, null, water); life.setLight(lightOf(hour)); }
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
