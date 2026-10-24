import * as THREE from 'three';
import { clamp, rand, angleDiff, yawFromDir } from './util.js';

// ───── Bot taktik katmanı (12.152): roller, mevziler, zorluğa göre insani nişan ─────
// bot.js yalnız kanca çağırır (tacRole / tacPickGoal / tacHold / tacAim / tacMayFire / tacCombatMove / tacHear / tacMateDown). Vagon (payload) ve
// Enfekte modlarında rol / mevzi YOK (onların kendi hedef mantığı: payloadBots.js, huddle); insani nişan Enfekte dışında her modda geçerli.
//
// Roller: rifle (tüfekçi, eski davranış) · rusher (taarruzcu: koşarak yaklaşır, yan dolanır, yakına girer) · sniper (keskin nişancı: mevzi tutar) ·
//         ambush (pusucu: düşman rotasına bakan köşe arkasında çömelir, yakına gelince açar) · support (sıhhiye / ağır destek: sınıf davranışı).
// Mevziler haritadan OTOMATİK çıkar (TacMap, harita başına bir kez, modül önbelleği): düşman takımın doğuştan hedeflere (bayrak / rakip doğuş / dolaşma
// noktaları) yürüyeceği A* yolları = "trafik"; nişancı mevzisi = trafiğin 28–115 m'sini gören, yakın trafiğe görünmeyen, kenarı uçurum olmayan, kendi
// yarısındaki nokta; pusu = trafik noktasının 4–14 m yanında, duvar dibinde, o noktayı gören ama düşmanın 12–16 m geriden GÖREMEDİĞİ (köşe arkası) nokta.

// Zorluk davranışları (DIFFICULTY sayıları — tepki / hata / dönüş — admin'den ayarlanır; bunlar davranış katmanı):
//  aimTau: ilk nişan hatasının sönme süresi (sn) · flick: hedef değişince ilk hata = err × flick (rad) · jit: kalıcı el titremesi (rad)
//  lag: hareketli hedefi gecikmeli izleme (sn; yana kaçan hedefi ıskalar) · spread: eski sapmanın kalan payı
//  snSettle: nişancının dürbünde sabitlenme süresi (sn) · snReloc: ateşten sonra yer değiştirme olasılığı · snRole: nişancı sınıfının nişancı rolü alma olasılığı
//  ambush / rusher: takımda pusucu / taarruzcu oranı · ambHold: pusucunun düşmanı yaklaştırma sabrı (sn) · hear: duyma menzili çarpanı
//  investigate: sese gitme olasılığı · mate: ölen arkadaşın yerine bakma olasılığı · retreatHp: bu canın altında geri çekilir · nadeCd: el bombası bekleme çarpanı
//  coord: aynı hedefe ateş eden arkadaşla açı farkı açma olasılığı · scan: mevzide sağa sola bakma (rad)
export const TACTICS = {
  easy: { aimTau: 1.0, flick: 2.4, jit: 0.022, lag: 0.17, spread: 1.3, snSettle: [1.5, 2.3], snReloc: 0, snRole: 0.5, ambush: 0.08, rusher: 0.3, ambHold: 1.5, hear: 0.55, investigate: 0.12, mate: 0, retreatHp: 0, nadeCd: 1.7, coord: 0, scan: 0.25 },
  normal: { aimTau: 0.55, flick: 2.2, jit: 0.009, lag: 0.11, spread: 0.75, snSettle: [1.0, 1.6], snReloc: 0.3, snRole: 1, ambush: 0.15, rusher: 0.25, ambHold: 3, hear: 0.85, investigate: 0.3, mate: 0.45, retreatHp: 25, nadeCd: 1.0, coord: 0.35, scan: 0.45 },
  hard: { aimTau: 0.36, flick: 2.0, jit: 0.0045, lag: 0.075, spread: 0.3, snSettle: [0.8, 1.25], snReloc: 0.55, snRole: 1, ambush: 0.2, rusher: 0.25, ambHold: 4, hear: 1.0, investigate: 0.55, mate: 0.85, retreatHp: 38, nadeCd: 0.8, coord: 0.7, scan: 0.6 },
};
export const tacOf = (b) => TACTICS[b.dk] || TACTICS.normal;

const SNIPER_W = new Set(['sniper', 'svd', 'barrett', 'ww_sniper']);
const CLOSE_W = new Set(['shotgun', 'aa12', 'dbl', 'mp5', 'vector', 'p90', 'ak74u', 'mac10', 'ww_smgb', 'ww_smgr']);
SNIPER_W.add('railgun'); CLOSE_W.add('plasma').add('scatter');      // 12.157 Uzay modu enerji silahları
const tA = new THREE.Vector3(), tB = new THREE.Vector3();

// ───── Harita taktik verisi (harita + mod + doğuş başına bir kez; modül önbelleği: sunucuda aynı haritadaki odalar paylaşır) ─────
// Hesap (~100–300 ms) tek seferde yapılmaz: üreteç her oyun adımında en çok BUDGET ms ilerler (sunucu tik'i takılmaz); bitene kadar tacMap null döner
// ve nişancı / pusucu geçici olarak tüfekçi gibi hedef seçer.
const CACHE = new Map(), JOBS = new Map(), BUDGET = 4;
export const tacEligible = (g) => !!(g.nav && !g.nav.nearestNode && !g.mode.infection && !g.payload && !g.front && !g.mode.gungame && !g.mode.paintball && g.map.spawns?.blue?.[0] && g.map.spawns?.red?.[0]);
export function tacMap(g) {
  if (g._tac) return g._tac;
  if (g._tac === null) return null;
  if (!tacEligible(g)) return (g._tac = null);                            // katlı (ML) yol ızgarası / rol dışı modlar
  const sb = g.map.spawns.blue[0], sr = g.map.spawns.red[0];
  const key = g._tacKey ||= `${g.map.name}|${g.mode.type}|${sb.x.toFixed(1)},${sb.z.toFixed(1)}|${sr.x.toFixed(1)},${sr.z.toFixed(1)}|${g.mode.objectives.map((o) => o.id).join(',')}`;
  const done = CACHE.get(key);
  if (done) return (g._tac = done);
  if (g._tacStep === g.time) return undefined;                           // bu adımın payı harcandı
  g._tacStep = g.time;
  let job = JOBS.get(key);
  if (!job) JOBS.set(key, (job = { it: buildTacMap(g), ms: 0, steps: 0 }));
  const t0 = performance.now();
  for (;;) {
    const r = job.it.next();
    if (r.done) { r.value.ms = job.ms + performance.now() - t0; r.value.steps = job.steps + 1; CACHE.set(key, r.value); JOBS.delete(key); return (g._tac = r.value); }
    if (performance.now() - t0 > BUDGET) break;
  }
  job.ms += performance.now() - t0; job.steps++;
  return undefined;
}

const floorY = (g, x, z) => (g.nav.floor ? g.nav.floorAt(x, z) : g.world.heightAt(x, z));

function* buildTacMap(g) {
  const nav = g.nav, world = g.world, S = g.map.spawns, objs = g.mode.objectives;
  const roam = (g.map.roamPoints || []).slice(0, 8).map((p) => ({ x: p[0], z: p[1] }));
  // trafik: E takımının yürüyeceği yollar (4 m'de bir nokta; her noktanın 14 m gerisi = düşmanın geldiği yer)
  const traffic = {};
  const walk = (from, to, out) => {
    const p = nav.findPath(from.x, from.z, to.x, to.z, 0.7);       // tek A* (~5–15 ms): üreteç her yoldan sonra durur
    if (!p || p.length < 2) return;
    const pts = [{ x: from.x, z: from.z }, ...p.map((v) => ({ x: v.x, z: v.z }))], line = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.round(L / 4));
      for (let k = 0; k < n; k++) line.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
    }
    line.forEach((q, i) => { const bi = Math.max(0, i - 3); q.bx = line[bi].x; q.bz = line[bi].z; q.y = floorY(g, q.x, q.z); out.push(q); });
  };
  for (const E of ['blue', 'red']) {
    const T = E === 'blue' ? 'red' : 'blue', out = [];
    const from = [S[E][0], S[E][Math.floor(S[E].length / 2)]].filter(Boolean);
    const goals = objs.length ? objs.map((o) => ({ x: o.x, z: o.z })) : [S[T][0], ...roam.slice(0, 4)];
    for (const f of from) for (const t of goals) { walk(f, t, out); yield; }
    for (let i = 0; i < objs.length; i++) for (let j = 0; j < objs.length; j++) if (i !== j) { walk(objs[i], objs[j], out); yield; }
    // 3 m'de bir tek nokta (sık yollar üst üste binmesin) — ağırlık: kaç yol geçiyor
    const grid = new Map(), ded = [];
    for (const q of out) { const k = Math.round(q.x / 3) + ',' + Math.round(q.z / 3); const h = grid.get(k); if (h) h.w++; else { q.w = 1; grid.set(k, q); ded.push(q); } }
    traffic[E] = ded;
  }
  const res = { perch: {}, ambush: {}, traffic };
  for (const T of ['blue', 'red']) {
    const E = T === 'blue' ? 'red' : 'blue';
    res.perch[T] = yield* buildPerches(g, traffic[E], S[T][0], S[E][0]);
    res.ambush[T] = yield* buildAmbush(g, traffic[E], S[T][0], S[E][0]);
  }
  res.perch.ffa = [...res.perch.blue, ...res.perch.red];
  res.ambush.ffa = [...res.ambush.blue, ...res.ambush.red];
  return res;
}

// 8 yönde 'r' m: [engelli yön sayısı, kenar (zemin kotu farkı > 0.45) var mı]
function ring(g, x, z, r) {
  const nav = g.nav, f0 = floorY(g, x, z);
  let walls = 0, ledge = false;
  for (let a = 0; a < 8; a++) {
    const px = x + Math.cos(a * 0.785) * r, pz = z + Math.sin(a * 0.785) * r;
    if (!nav.isFree(px, pz)) walls++;
    else if (Math.abs(floorY(g, px, pz) - f0) > 0.45) ledge = true;
  }
  return [walls, ledge];
}

function* buildPerches(g, tr, own, foe) {
  const nav = g.nav, b = g.map.bounds, world = g.world, cands = [];
  const seen = nav.reachable(own.x, own.z);
  for (let x = b.minX + 3; x < b.maxX - 3; x += 6) for (let z = b.minZ + 3; z < b.maxZ - 3; z += 6) {
    const jx = x + rand(-1.8, 1.8), jz = z + rand(-1.8, 1.8), i = nav.idx(jx, jz);
    if (!nav.isFree(jx, jz) || !seen[i]) continue;
    const dO = Math.hypot(jx - own.x, jz - own.z), dF = Math.hypot(jx - foe.x, jz - foe.z), side = dO / (dO + dF + 1e-6);
    if (side > 0.55) continue;                                               // kendi yarısı (rakip doğuşa yakın mevzi yok)
    const [walls, ledge] = ring(g, jx, jz, 1.0);
    if (ledge || walls > 5) continue;                                        // uçurum / kat kenarı dibinde ya da dar kuytuda durmaz
    cands.push({ x: jx, z: jz, y: floorY(g, jx, jz), walls, side });
  }
  // 1. tur: trafikten seyrek örnek (5te 1), 2. tur: en iyi 36 aday tüm trafikle
  const eye = tA, tp = tB;
  const score = (c, pts) => {
    let vis = 0, near = 0, hx = 0, hz = 0, hy = 0, n = 0;
    eye.set(c.x, c.y + 1.6, c.z);
    for (const q of pts) {
      const d = Math.hypot(q.x - c.x, q.z - c.z);
      if (d < 10 || d > 115) continue;
      tp.set(q.x, q.y + 1.2, q.z);
      if (!world.clear(eye, tp)) continue;
      if (d < 26) { near += q.w; continue; }
      vis += q.w; hx += (q.x - c.x) / d * q.w; hz += (q.z - c.z) / d * q.w; hy += c.y - q.y; n++;
    }
    return { vis, near, yaw: yawFromDir(hx, hz), high: n ? hy / n : 0, n };
  };
  const sparse = tr.filter((_, i) => i % 5 === 0);
  let k = 0;
  for (const c of cands) { const r = score(c, sparse); c.s0 = r.vis * 3 - r.near * 4 + Math.max(0, r.high) * 1.5; if (++k % 12 === 0) yield; }
  cands.sort((a, b2) => b2.s0 - a.s0);
  const top = cands.slice(0, 36), out = [];
  for (const c of top) {
    yield;
    const r = score(c, tr);
    if (r.n < 4) continue;
    c.sc = r.vis - r.near * 1.6 + Math.max(0, r.high) * 1.2 + Math.min(c.walls, 3) * 0.8 - Math.abs(c.side - 0.33) * 6;
    c.yaw = r.yaw; c.vis = r.vis;
    // çömelince de görüyor mu (6 en uzak görünür noktadan çoğunu)
    let ok = 0, tot = 0; eye.set(c.x, c.y + 1.16, c.z);
    for (const q of tr) { const d = Math.hypot(q.x - c.x, q.z - c.z); if (d < 30 || d > 115 || tot >= 6) continue; tp.set(q.x, q.y + 1.2, q.z); tot++; if (world.clear(eye, tp)) ok++; }
    c.crouch = tot > 0 && ok >= tot * 0.6;
    out.push(c);
  }
  out.sort((a, b2) => b2.sc - a.sc);
  const pick = [];
  for (const c of out) { if (pick.length >= 10) break; if (pick.every((p) => Math.hypot(p.x - c.x, p.z - c.z) > 10)) pick.push({ x: c.x, z: c.z, y: c.y, yaw: c.yaw, crouch: c.crouch, sc: c.sc, kind: 'perch' }); }
  return pick;
}

function* buildAmbush(g, tr, own, foe) {
  const nav = g.nav, world = g.world, out = [];
  const near = (x, z, r) => { for (const q of tr) if (Math.abs(q.x - x) < r && Math.abs(q.z - z) < r && Math.hypot(q.x - x, q.z - z) < r) return true; return false; };
  for (let i = 0; i < tr.length; i += 2) {
    const P = tr[i];
    if (Math.hypot(P.bx - P.x, P.bz - P.z) < 8) continue;                    // yolun başı (geri nokta yok)
    const dO = Math.hypot(P.x - own.x, P.z - own.z), dF = Math.hypot(P.x - foe.x, P.z - foe.z);
    if (dF < 22 || dO < 15) continue;                                        // doğuş dibinde pusu yok
    let best = null, bs = -1e9;
    for (const r of [4, 6.5, 9, 12]) for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + r, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
      if (!nav.isFree(x, z)) continue;
      const [walls, ledge] = ring(g, x, z, 0.9);
      if (walls < 1 || walls > 5 || ledge) continue;                         // duvar / siper dibi ama kuyu değil
      if (near(x, z, 2.5)) continue;                                         // tam yolun üstünde değil
      const y = floorY(g, x, z);
      tA.set(x, y + 1.16, z); tB.set(P.x, P.y + 1.1, P.z);
      if (!world.clear(tA, tB)) continue;                                    // geçiş noktasını görmeli
      tA.set(P.bx, floorY(g, P.bx, P.bz) + 1.6, P.bz); tB.set(x, y + 1.0, z);
      const hidden = !world.clear(tA, tB);                                   // düşman gelirken görmez (köşe arkası)
      if (!hidden) continue;
      const sc = Math.min(walls, 3) * 0.5 + (P.w || 1) * 0.4 - Math.abs(r - 7) * 0.12 + Math.random() * 0.6;
      if (sc > bs) { bs = sc; best = { x, z, y, yaw: yawFromDir(P.x - x, P.z - z), wx: P.x, wz: P.z, sc, side: dO / (dO + dF), kind: 'ambush' }; }
    }
    if (best) out.push(best);
    if (i % 16 === 0) yield;
  }
  out.sort((a, b2) => b2.sc - a.sc);
  const pick = [];
  for (const c of out) { if (pick.length >= 24) break; if (pick.every((p) => Math.hypot(p.x - c.x, p.z - c.z) > 7)) pick.push(c); }
  return pick;
}

// ───── Rol ataması (her doğuşta; takım oranı zorluğa ve moda göre) ─────
export function tacRole(b) {
  const g = b.game, s = b.s, T = tacOf(b), M = tacEligible(g);
  const p0 = s.items?.[0]?.id, ffa = g.ffa;
  if (s.def.zombie || g.mode.infection || g.payload || g.front) return 'rifle';      // Cephe: roller frontBots.js
  if (s.cls === 'medic' || (s.cls === 'heavy' && s.items[2]?.id === 'ammobox')) return 'support';
  const mates = g.brains.filter((o) => o !== b && o.s.alive && (ffa || o.s.team === s.team));
  const n = mates.length + 1, count = (r) => mates.filter((o) => o.role === r).length;
  if (M && SNIPER_W.has(p0) && Math.random() < T.snRole * (ffa ? 0.5 : 1)) return 'sniper';
  if (M && !SNIPER_W.has(p0) && count('ambush') < Math.max(1, Math.round(n * T.ambush * (ffa ? 0.5 : 1))) && Math.random() < T.ambush * (CLOSE_W.has(p0) ? 2.6 : 1.4)) return 'ambush';
  if (!SNIPER_W.has(p0) && count('rusher') < Math.ceil(n * T.rusher) && Math.random() < T.rusher * (CLOSE_W.has(p0) ? 2.2 : 0.9)) return 'rusher';
  return 'rifle';
}

// ───── Hedef (mevzi) seçimi: nişancı / pusucu. true = hedef kuruldu ─────
export function tacPickGoal(b) {
  const g = b.game, s = b.s, M = tacMap(g);
  b.spot = null; b.atSpot = false;
  if (b.role !== 'sniper' && b.role !== 'ambush') return false;
  if (!M) { if (M === undefined) b.retacT = g.time + 2; return false; }  // harita verisi hazırlanıyor: 2 sn sonra yeniden dene (bot.js goalT kısaltır)
  const key = g.ffa ? 'ffa' : s.team, list = b.role === 'sniper' ? M.perch[key] : M.ambush[key];
  if (!list || !list.length) return false;
  const objs = g.mode.objectives, sq = !g.ffa && objs.length ? g.squadGoal(s) : null;
  let best = null, bs = -1e9;
  for (const p of list) {
    if (p === b.lastSpot && list.length > 1) continue;
    let occ = 0;
    for (const o of g.brains) if (o !== b && o.spot === p && o.s.alive) occ++;
    if (occ) continue;
    const d = Math.hypot(p.x - s.pos.x, p.z - s.pos.z);
    let sc = p.sc * 0.15 - d / (b.role === 'sniper' ? 40 : 22) + Math.random() * 1.5;      // yakın mevzi öne (yolda ölmesin)
    if (b.role === 'ambush' && p.side > 0.62) sc -= 3;                        // rakip yarısının derininde pusu yok
    if (objs.length && b.role === 'ambush') {                                // bayrak savunması: kendi / mangal bayrağına yakın pusular öne
      let od = 1e9; for (const o of objs) if (o.owner === s.team || o === sq) od = Math.min(od, Math.hypot(o.x - p.x, o.z - p.z));
      sc += od < 40 ? 2.5 - od / 20 : -1;
    }
    if (objs.length && b.role === 'sniper' && sq) sc += Math.max(0, 1.5 - Math.hypot(sq.x - p.x, sq.z - p.z) / 60);
    if (sc > bs) { bs = sc; best = p; }
  }
  if (!best) return false;
  b.spot = best; b.lastSpot = best; b.spotT = 0; b.quietT = 0; b.spotShots = 0;
  b.setGoal(best.x, best.z, 90, best.y);
  b.perching = true;
  return true;
}

// Mevziye varınca: çömel, izleme yönüne bak (yavaş tarama), sessizlik süresi dolunca (pusu) ya da birkaç atıştan sonra (nişancı) yer değiştir
export function tacHold(b, dt) {
  const s = b.s, sp = b.spot, T = tacOf(b), g = b.game;
  if (!sp) { s.crouching = true; return; }
  if (!b.atSpot) { b.atSpot = true; b.quietT = 0; b.quietMax = b.role === 'ambush' ? rand(28, 48) : rand(45, 80); }
  s.crouching = sp.kind === 'ambush' || sp.crouch;
  b.spotT += dt; b.quietT += dt;
  if (g.time - b.alertT > 2.5) {
    const want = sp.yaw + Math.sin(b.spotT * 0.35 + s.id) * T.scan;
    s.yaw += clamp(angleDiff(s.yaw, want), -1.6 * dt, 1.6 * dt);
  }
  if (b.quietT > b.quietMax || (b.role === 'sniper' && b.spotShots >= 2 && Math.random() < T.snReloc)) { b.spotShots = 0; b.goalT = 0; b.atSpot = false; }   // kimse gelmedi / yeri belli oldu: başka mevziye
  else if (b.role === 'sniper' && b.spotShots >= 2) b.spotShots = 0;
}

// ───── İnsani nişan: hedef değişince yönlü ilk hata (sönümlenir) + el titremesi (yavaş dolaşan) + hareketli hedefi gecikmeli izleme ─────
// out: [yaw düzeltmesi, pitch düzeltmesi, gecikmeli hedef x, z] — bot.js bunu açıya ekler
export function tacAim(b, tg, dt, out) {
  const T = tacOf(b), s = b.s;
  if (b.aimTg !== tg) {
    b.aimTg = tg; b.lagX = tg.pos.x; b.lagZ = tg.pos.z;
    const e = b.d.err * T.flick * rand(0.6, 1.2), a = Math.random() * Math.PI * 2;
    b.aoY = Math.cos(a) * e; b.aoP = Math.sin(a) * e * 0.6; b.jY = 0; b.jP = 0; b.jT = 0; b.settleT = 0;
  }
  const k = 1 - Math.exp(-dt / T.lag);
  b.lagX += (tg.pos.x - b.lagX) * k; b.lagZ += (tg.pos.z - b.lagZ) * k;
  const dec = Math.exp(-dt / T.aimTau);
  b.aoY *= dec; b.aoP *= dec;
  if ((b.jT -= dt) <= 0) { b.jT = rand(0.25, 0.6); b.jTY = rand(-1, 1) * T.jit; b.jTP = rand(-1, 1) * T.jit * 0.7; }
  b.jY += (b.jTY - b.jY) * Math.min(1, dt * 4); b.jP += (b.jTP - b.jP) * Math.min(1, dt * 4);
  const moving = Math.hypot(s.vel.x, s.vel.z) > 1.5 ? 1.6 : 1;                // yürürken nişan daha oynak
  out[0] = b.aoY + b.jY * moving; out[1] = b.aoP + b.jP * moving; out[2] = b.lagX; out[3] = b.lagZ;
  return out;
}

// Ateş kararı: nişancı dürbünde sabitlenmeden basmaz; pusucu düşmanı yaklaştırır (bakmıyorsa, vurulmadıysa)
export function tacMayFire(b, tg, dist, aimed, dt) {
  const s = b.s, T = tacOf(b), st = s.stat;
  b.settleT = aimed ? (b.settleT || 0) + dt : Math.max(0, (b.settleT || 0) - dt * 2);
  if (b.role === 'sniper' && st.scope && dist > 22) {
    if (b.settleNeed == null) b.settleNeed = rand(T.snSettle[0], T.snSettle[1]);
    if (b.settleT < b.settleNeed * (st.bolt ? 1 : 0.6)) return false;
    return true;
  }
  if (b.role === 'ambush' && b.atSpot) {
    const open = CLOSE_W.has(s.items[0].id) ? 13 : 22;
    if (dist > open && b.game.time - (s.lastDmgT ?? -99) > 1.5) {
      const fx = -Math.sin(tg.yaw), fz = -Math.cos(tg.yaw), facing = (fx * (s.pos.x - tg.pos.x) + fz * (s.pos.z - tg.pos.z)) / (dist + 1e-6);
      b.ambWait = (b.ambWait || 0) + dt;
      if (facing < 0.75 && b.ambWait < T.ambHold) return false;                  // bize bakmıyor: biraz daha yaklaşsın
    }
  }
  return true;
}

export function tacFired(b) {
  if (b.role === 'sniper') { b.spotShots = (b.spotShots || 0) + 1; b.settleT = 0; b.settleNeed = null; }
  if (b.atSpot) b.quietT = 0;
}

// Çatışma hareketi (rol): [ileri, yan çarpanı, hız çarpanı, çömel] ya da null (eski davranış)
export function tacCombatMove(b, dist, tg) {
  const s = b.s, T = tacOf(b), g = b.game;
  if (b.role === 'sniper') {
    if (dist < 15) return [-0.75, 0.6, 0.85, false];                         // yakına düşman: geri çekil (tabancayla)
    if (b.atSpot || dist > 30) return [0, 0, 0, b.spot ? b.spot.crouch : true];
  }
  if (b.role === 'ambush' && b.atSpot && dist > 4) return [0, 0.15, 0.35, dist > 9];
  if (T.retreatHp && s.hp < T.retreatHp && b.role !== 'rusher' && dist > 7) return [-0.65, 0.6, 0.8, false];      // can azaldı: geri çekilerek ateş
  if (b.role === 'rusher') return [dist > 7 ? 0.85 : 0.1, 0.75, 0.78, false];
  return null;
}

// Koordinasyon: aynı hedefe ateş eden arkadaşla aynı açıdan bakıyorsa yan kayma yönünü açıyı açacak şekilde seç
export function tacStrafeDir(b, tg, cur) {
  const T = tacOf(b), s = b.s;
  if (!T.coord || Math.random() > T.coord) return cur;
  const my = Math.atan2(s.pos.x - tg.pos.x, s.pos.z - tg.pos.z);
  for (const o of b.game.brains) {
    if (o === b || o.target !== tg || !o.s.alive || o.s.team !== s.team) continue;
    const da = angleDiff(Math.atan2(o.s.pos.x - tg.pos.x, o.s.pos.z - tg.pos.z), my);
    if (Math.abs(da) < 0.6) return da > 0 ? 1 : -1;                          // arkadaşın tersine kay (yan açı)
  }
  return cur;
}

// Ses: zorluğa göre duyma menzili; mevzideki (nişancı / pusucu) yerinden kalkmaz, yalnız bakar
export function tacHear(b, pos, radius) {
  const T = tacOf(b), s = b.s;
  const d = Math.hypot(pos.x - s.pos.x, pos.z - s.pos.z);
  if (radius && d > radius * T.hear) return -1;                               // duymadı
  if (b.spot) return 0;                                                       // mevzideki / mevziye giden: yerinden kalkmaz, yalnız bakar
  return T.investigate;
}

// Ölen takım arkadaşı: yakınındaki botlar o yöne döner / araştırır (katilin yerini değil, arkadaşın düştüğü yeri ve vurulduğu kaba yönü bilir)
export function tacMateDown(b, victim, killer) {
  const s = b.s, g = b.game, T = tacOf(b);
  if (!s.alive || victim === s || victim.team !== s.team || g.ffa || !T.mate || b.target) return;
  const d = Math.hypot(victim.pos.x - s.pos.x, victim.pos.z - s.pos.z);
  if (d > 40 || Math.random() > T.mate) return;
  let x = victim.pos.x, z = victim.pos.z;
  if (killer && killer !== victim) { const kx = killer.pos.x - x, kz = killer.pos.z - z, L = Math.hypot(kx, kz) || 1, j = rand(-0.3, 0.3), c = Math.cos(j), sn = Math.sin(j); x += ((kx * c - kz * sn) / L) * Math.min(L, 10); z += ((kx * sn + kz * c) / L) * Math.min(L, 10); }
  b.alertT = g.time; b.alertPos = (b.alertPos || new THREE.Vector3()).set(x, victim.pos.y, z);
  if (!b.spot && !g.payload && !g.front && b.role !== 'support' && Math.random() < 0.5) b.setGoal(victim.pos.x + rand(-3, 3), victim.pos.z + rand(-3, 3), 8, victim.pos.y);
}
