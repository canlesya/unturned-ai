// ───── 12.219 Büyük harita Takım Çatışması (Kuzey Vadisi TDM: bütün harita + araçlar, Battlefield "TDM + vehicles") ─────
// Kuzey'de TDM bayraksız oynanır (mode.objectives boş; skor = öldürme, skor kuralı aynı). 1,6 km'de botlar eskiden hedefsiz dolaşıyordu (roam:
// rastgele düşmanın yanına ya da haritanın rastgele noktasına) → 16v16 600 sn'de 90 öldürme, araç yok. Burada yalnız BOT PLANI:
//  · ÇATIŞMA BÖLGELERİ: haritanın adlı bölgeleri (bayrak yerleri: Radar Tepesi, Köy, Kavşak, Fabrika, Baraj, Çiftlik, Kereste Kampı) ele geçirilmez;
//    150–240 sn'lik evrelerde İKİ TAKIM İÇİN ORTAK 1–3 etkin bölge seçilir (mangal sayısına göre). Seçim ağırlığı: iki üsse eşit uzaklık (adalet;
//    Kavşak / Radar / Baraj önde, üsse yakın Çiftlik / Kereste Kampı neredeyse hiç; ilk evre yalnız adil bölgelerden) × yorgunluk (150 m içindeki son ölümler: çok kanlı bölge bir
//    süre geriye düşer → çatışma yeri maç içinde kayar). İki takımın mangalları aynı bölgelere gider → karşılaşma garanti.
//  · Mangal görevi (12 sn'de bir): etkin bölgelere paylaştırılır (mangal konumuna en yakın), aynı bölgeye 3+ mangal → kanat (12.203 flankVia kalıbı).
//  · Bölgedeki hedefsiz bot ara sıra 350 m içindeki en yakın düşmana yönelir (av); bölgeye uzak bot yolda araç alır (vehicleBots: tripDest = mangal hedefi).
//  · Doğuş: üs (araçlar orada) · "Ön hat" = takımın mangalarının gittiği etkin bölgenin 180–260 m gerisi (kendi üssü yönünde, ±70 m yanda; düşmandan
//    ≥ 90 m, 160 m içindeki düşman görmüyor; bayraklı modun "ön hat" seçeneğinin TDM karşılığı, insan ölüm ekranında seçer) · çatışmada olmayan, üsten
//    uzaktaki yaya manga arkadaşının yanı (Battlefield manga doğuşu). Bot: maç başında üs; sonra %50 arkadaş (varsa), kalanın %60'ı ön hat, gerisi üs (araç alır).
import * as THREE from 'three';
import { mateSpawnState, mateSpawnPoint, SP } from './squad.js';

export const BTDM = { phase: [150, 240], near: 350, stay: 0.35, ax2: 6, ax3: 12, fair: 6, fatigue: 0.08, fatigueCap: 20, heatR: 150, hunt: 0.45, huntR: 350, mate: 0.5, front: 0.6, frontD: [180, 260], frontSide: 70, frontFoe: 90, frontSee: 160, mateBase: 180 };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const bigTdmOn = (g) => !!(g.map?.big && g.mode?.type === 'tdm');

// bölgeler: haritanın bayrak yerleri (ele geçirilmez, sahipsiz); objPoint / perch / objCells bayrak gibi kullanır
export function tdmZones(g) {
  return (g._tdmZ ||= (g.map.objectives || []).map((o) => ({ id: o.id, name: o.name, label: o.label || o.id, x: o.x, z: o.z, y: o.y, r: o.r, owner: null, zone: true })));
}
function heat(g) {
  const H = (g._tdmHeat ||= { t: g.time || 0, v: {} }), t = g.time || 0;
  if (t > H.t) { const k = Math.exp(-(t - H.t) / 144); for (const id in H.v) H.v[id] *= k; H.t = t; }      // yarı ömür ~100 sn
  return H.v;
}
// Game.onKill → ölümün 150 m içindeki bölgeye ısı
export function tdmKill(g, victim) {
  const H = heat(g);
  let best = null, bd = BTDM.heatR;
  for (const o of tdmZones(g)) { const d = dist(o, victim.pos); if (d < bd) { bd = d; best = o; } }
  if (best) H[best.id] = (H[best.id] || 0) + 1;
}
// adalet: 1 − |d(Mavi üs) − d(Kırmızı üs)| / toplam (Kavşak ≈ 1, Köy / Fabrika ≈ 0,75, Çiftlik / Kereste ≈ 0,5)
function fair(g, o) {
  const b = g.map.spawns.blue[0], r = g.map.spawns.red[0], db = dist(o, b), dr = dist(o, r);
  return 1 - Math.abs(db - dr) / (db + dr || 1);
}
// ortak evre planı: etkin bölgeler (k adet, yinelenmez); evre bitince yeniden çekilir
function plan(g, nSq) {
  const P = (g._tdmPlan ||= { until: -1, act: [], phase: 0, k: 0 });
  const t = g.time || 0, k = Math.min(3, nSq >= BTDM.ax3 ? 3 : nSq >= BTDM.ax2 ? 2 : 1);
  if (t < P.until && P.k === k && P.act.length) return P;
  const Z = tdmZones(g), H = heat(g), prev = new Set(P.act.map((o) => o.id));
  // yakınlık: yeni bölge eski bölgelere yakın olan (çatışma yeri yavaş kayar; 700 m öteye atlayınca herkes yeniden yola düşüyordu)
  const near = (o) => (P.act.length ? 1 / (1 + Math.min(...P.act.map((q) => dist(q, o))) / BTDM.near) : 1);
  // ilk evre: adil bölgelerden, üslere yakın olan daha olası (Kavşak ~700 m: ilk temas Baraj / Radar'dakinden ~30 sn önce)
  const b0 = g.map.spawns.blue[0], r0 = g.map.spawns.red[0], first = (o) => (P.phase > 0 ? 1 : Math.pow(700 / ((dist(o, b0) + dist(o, r0)) / 2), 4));
  const w = new Map(Z.filter((o) => P.phase > 0 || fair(g, o) > 0.9).map((o) => [o, first(o) * Math.pow(fair(g, o), BTDM.fair) / (1 + BTDM.fatigue * Math.min(BTDM.fatigueCap, H[o.id] || 0)) * near(o) * (prev.has(o.id) ? BTDM.stay : 1)]));
  const act = [];
  for (let i = 0; i < k && w.size; i++) {
    let sum = 0; for (const v of w.values()) sum += v;
    let r = Math.random() * sum, pickO = null;
    for (const [o, v] of w) { r -= v; if (r <= 0) { pickO = o; break; } }
    pickO ||= [...w.keys()][0];
    act.push(pickO); w.delete(pickO);
  }
  P.act = act; P.k = k; P.phase++; P.until = t + BTDM.phase[0] + Math.random() * (BTDM.phase[1] - BTDM.phase[0]);
  (g.bigStats ||= {}).tdmPhase = P.phase;
  return P;
}
export const tdmActive = (g) => g._tdmPlan?.act || [];

function squadPos(g, team, sq) {
  let x = 0, z = 0, n = 0;
  for (const e of g.soldiers) if (e.alive && e.team === team && e.squad === sq) { x += e.pos.x; z += e.pos.z; n++; }
  return n ? { x: x / n, z: z / n } : g.map.spawns[team][0];
}

// Game.assignSquads (büyük harita TDM): mangallar etkin bölgelere; kanat planı g._bigPlan[team].flank (bigBots.flankVia okur)
export function assignSquadsTdm(g) {
  const nOf = (team) => Math.max(1, Math.ceil(g.soldiers.filter((s) => s.team === team).length / 4));
  const P = plan(g, Math.max(nOf('blue'), nOf('red'))), A = P.act;
  if (!A.length) return;
  for (const team of ['blue', 'red']) {
    const nSq = nOf(team), prev = g.squadGoals[team] || [], next = new Array(nSq).fill(null);
    const pos = [...Array(nSq).keys()].map((sq) => squadPos(g, team, sq));
    const share = A.length === 3 ? [0.4, 0.33, 0.27] : A.length === 2 ? [0.55, 0.45] : [1];
    const free = new Set([...Array(nSq).keys()]);
    const take = (o) => {                                                         // o'ya en yakın boştaki mangal (eski görevi buysa öne)
      let best = -1, bd = 1e9;
      for (const sq of free) { const d = dist(pos[sq], o) - (prev[sq] === o ? 120 : 0); if (d < bd) { bd = d; best = sq; } }
      if (best >= 0) { next[best] = o; free.delete(best); }
    };
    for (let ax = 0; ax < A.length; ax++) for (let i = 0, c = Math.max(1, Math.round(nSq * share[ax])); i < c && free.size; i++) take(A[ax]);
    while (free.size) take(A[0]);
    // kanat: aynı bölgeye 3+ mangal → her üçüncüsü sırayla sol / sağ (aynı görevde tarafını korur)
    const BP = ((g._bigPlan ||= {})[team] ||= { w: {}, until: -1, flank: [], phase: 0, focus: null });
    const flank = new Array(nSq).fill(0), by = new Map();
    for (let sq = 0; sq < nSq; sq++) { const l = by.get(next[sq]) || []; l.push(sq); by.set(next[sq], l); }
    for (const l of by.values()) if (l.length >= 3) l.forEach((sq, i) => { if (i % 3 === 2) flank[sq] = BP.flank[sq] && prev[sq] === next[sq] ? BP.flank[sq] : (((i / 3) | 0) % 2 ? 1 : -1); });
    for (let sq = 0; sq < nSq; sq++) {
      if (next[sq] === prev[sq] && flank[sq] === (BP.flank[sq] || 0)) continue;
      for (const b of g.brains) if (b.s.team === team && b.s.squad === sq && b.s.alive) b.goalT = Math.min(b.goalT, 0.3 + Math.random() * 2.5);
    }
    BP.flank = flank;
    g.squadGoals[team] = next;
  }
}

// BotBrain.pickGoal (büyük harita TDM): bölgeye varmış, hedefsiz bot ara sıra en yakın düşmana (≤ 350 m) yönelir; true = hedef verildi
export function tdmHuntGoal(b, zone) {
  const g = b.game, s = b.s;
  if (!zone || dist(s.pos, zone) > zone.r + 60 || Math.random() > BTDM.hunt) return false;
  let best = null, bd = BTDM.huntR;
  for (const e of g.soldiers) { if (!e.alive || e.vacant || e.team === s.team) continue; const d = dist(e.pos, s.pos); if (d < bd) { bd = d; best = e; } }
  if (!best) return false;
  const x = best.pos.x + (Math.random() - 0.5) * 24, z = best.pos.z + (Math.random() - 0.5) * 24;
  b.setGoal(x, z, Math.max(14, bd / 4.2 + 8)); b.perching = false; b.via = null;
  (g.bigStats ||= {}).tdmHunt = (g.bigStats.tdmHunt || 0) + 1;
  return true;
}

// "Ön hat" doğuşu (bot / insan): mangal bölgesinin (yoksa ilk etkin bölgenin) gerisinde yürünür, suya / yapıya girmeyen, düşmandan uzak nokta (yoksa null → üs)
const _e = new THREE.Vector3(), _f = new THREE.Vector3();
export function tdmFrontSpawn(g, team, s) {
  const A = tdmActive(g); if (!A.length) return null;
  const sq = s ? g.squadGoal(s) : null, o = sq && A.includes(sq) ? sq : A[Math.floor(Math.random() * A.length)];
  const home = g.map.spawns[team][0], L = dist(home, o) || 1, ux = (home.x - o.x) / L, uz = (home.z - o.z) / L;
  const W = g.world, T = g.map.terrain, foes = g.soldiers.filter((e) => e.alive && !e.vacant && e.team !== team);
  for (let k = 0; k < 30; k++) {
    const d = Math.min(L - 40, BTDM.frontD[0] + Math.random() * (BTDM.frontD[1] - BTDM.frontD[0])), side = (Math.random() - 0.5) * 2 * BTDM.frontSide;
    const x = o.x + ux * d - uz * side, z = o.z + uz * d + ux * side;
    if (!g._free(x, z, s)) continue;
    const y = W.groundAt(x, z);
    if (T?.waterY) { const wy = T.waterY(x, z); if (wy > -1e9 && wy > y - 0.1) continue; }
    let bad = false;
    for (const e of foes) {
      const de = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (de < BTDM.frontFoe) { bad = true; break; }
      if (de < BTDM.frontSee) { _e.set(x, y + 1.4, z); if (g.botSees(e.eye(_f), _e)) { bad = true; break; } }
    }
    if (bad) continue;
    (g.bigStats ||= {}).tdmFront = (g.bigStats.tdmFront || 0) + 1;
    return { x, z, ry: Math.atan2(-(o.x - x), -(o.z - z)) + (Math.random() - 0.5) * 0.8, forward: true };
  }
  return null;
}

// Game.pickSpawn (bot, büyük harita TDM): manga arkadaşının yanı ya da ön hat (yoksa null → üs)
export function tdmBotSpawn(g, s) {
  if ((g.time || 0) < 5) return null;                                            // maç başı: herkes üste (araçlar orada)
  if (Math.random() > BTDM.mate) return Math.random() < BTDM.front ? tdmFrontSpawn(g, s.team, s) : null;
  const home = g.map.spawns[s.team][0], C = [];
  for (const m of g.soldiers) {
    if (m === s || !m.alive || m.vacant || m.team !== s.team || m.squad !== s.squad || m.veh) continue;
    if (dist(m.pos, home) < BTDM.mateBase || mateSpawnState(g, m) !== SP.OK) continue;
    C.push(m);
  }
  if (!C.length) return Math.random() < BTDM.front ? tdmFrontSpawn(g, s.team, s) : null;
  const m = C[Math.floor(Math.random() * C.length)];
  (g.bigStats ||= {}).tdmMateSpawn = (g.bigStats.tdmMateSpawn || 0) + 1;
  return mateSpawnPoint(g, s, m);
}
