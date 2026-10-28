// ───── 12.189 Büyük harita (map.big: Kuzey Vadisi) bot çatışma akışı ─────
// Sorun (ölçüm, 10v10 240 sn): 7 bayrak / 1,6 km'de iki takımın mangalları kendine en yakın sahipsiz bayraklara dağılıyor, alınca 40 sn (yeniden
// dağıtım aralığı) boş bayrakta bekliyordu; savunan yok → bayraklar el değiştiriyor ama iki takım hiç karşılaşmıyor (en yakın düşman medyanı
// ~550 m, ilk temas 85–190 sn, 2–14 öldürme). Burada harita varlıklarına dokunmadan BOT DAVRANIŞI:
//  · CEPHE: takımın "önü" = sahip olduğu bayraklar (yoksa üs). Saldırı hedefi = önüne yakın + DÜŞMAN KİTLESİNE (mangal merkezleri) yakın, sahibi
//    olmadığı bayrak (sahipsiz biraz önde) → iki takım aynı bayrağa yönelir; savunma = düşman kitlesine en yakın kendi bayrağı + tehdit altındaki bayrak.
//  · mangal görevi: tehdit altındaki bayrağa en yakın mangal savunur; 4+ mangalda biri cephe bayrağını tutar; kalanlar birincil hedefe (4+ mangalda
//    üçte biri ikincil hedefe) saldırır. Görev değişince mangalın botları hemen yeni hedef seçer (eski 40 sn beklemesi yok); bayrak alınınca 1 sn içinde yeniden dağıtım.
//  · keskin nişancı: hedefi gören (bot görüşü: yaprak da), 60–160 m, yüksek, kendi tarafındaki tepe noktası.
//
// ── 12.203 çatışma dağılımı (kullanıcı: "kapışmalar hep farklı yerlerde olmalı") ──
// Ölçüm (başsız, 300 sn): 32v32 / 64v64 / 128v128'de öldürmelerin %68–86'sı Kavşak (C) çevresinde; görev puanındaki "düşman kitlesine uzaklık"
// iki takımı da hep ortadaki bayrağa çekiyordu. Harita varlıklarına dokunmadan, yalnız takım planı:
//  · NİYET AĞIRLIĞI: her takımın her bayrağa 0,6–1,5 arası ağırlığı var; 60–120 sn'de bir yeniden çekilir (evre), arada her görev dağıtımında kayar.
//    Saldırı puanı ağırlığa bölünür → takımların birincil hedefi maçtan maça ve maç içinde değişir.
//  · ODAK: her evrede takımın bir odak bayrağı (sahibi olmadığı, çatışma ısısı düşük olan daha olası): puanı ÷ 2,5 → iki takım aynı bayrağa kilitlenmez.
//  · YORGUNLUK: son dakikalarda çok ölümün olduğu bayrak (150 m içi, yarı ömür ~100 sn) puanında geriye düşer (ölüm başına +%6, en çok 24 ölüm) → çatışma alanı zamanla kayar.
//  · EKSENLER: mangal sayısına göre 1 / 2 / 3 saldırı ekseni (10+ / 12+ mangal), mangallar ağırlıkla paylaşılır; 32v32'ye kadar (8 mangal) eskisi gibi tek eksen
//    (yoğunluk: iki eksende 32v32 öldürme sayısı ~%15 düşüyordu); orada çatışma yeri zamanla kayar (odak + yorgunluk).
//  · KANAT: aynı hedefe giden 3+ mangalın her üçüncüsü kanat (sol / sağ): yolu 70–130 m yandan dolanan bir ara noktadan geçer (bot.pickGoal → flankVia).
//  · SAVUNMA: tehdit altındaki bayrağa düşman sayısına göre mangal (12+ mangalda 4 düşmana 1; en çok mangalların üçte biri).
import * as THREE from 'three';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
// 12.203 takım planı ayarları (ölçüm: scripts/scalesim.mjs, BIG_<ad>=değer ile denenir)
export const BIG = { wMin: 0.6, wSpan: 0.9, focus: 2.5, fatigue: 0.06, fatigueCap: 24, phaseMin: 60, phaseSpan: 60, ax2: 10, ax3: 12 };

// takımın niyet ağırlıkları (evre başında yeniden çekilir, arada kayar) + evrenin ODAK bayrağı (sahibi olmadığı bayraklardan, çatışma ısısı düşük olan
// daha olası; saldırı puanı ÷ BIG.focus) + kanat görevleri. Odak alınınca evre hemen yenilenir.
function plan(g, team) {
  const P = ((g._bigPlan ||= {})[team] ||= { w: {}, until: -1, flank: [], phase: 0, focus: null });
  const t = g.time || 0, objs = g.mode.objectives;
  const fo = P.focus && objs.find((o) => o.id === P.focus);
  if (t >= P.until || (fo && fo.owner === team)) {
    P.until = t + BIG.phaseMin + Math.random() * BIG.phaseSpan; P.phase++;
    for (const o of objs) P.w[o.id] = BIG.wMin + Math.random() * BIG.wSpan;
    const H = heatDecay(g), C = objs.filter((o) => o.owner !== team && o.id !== P.focus);
    let sum = 0; const wts = C.map((o) => (sum += 1 / (1 + (H[o.id] || 0) / 6)));
    const r = Math.random() * sum, k = wts.findIndex((w) => w >= r);
    P.focus = C.length ? C[Math.max(0, k)].id : null;
  } else for (const o of objs) P.w[o.id] = clamp((P.w[o.id] ?? 1) + (Math.random() - 0.5) * 0.16, 0.5, 1.6);
  return P;
}
// bayrak başına çatışma ısısı (150 m içindeki ölüm sayısı, üstel sönüm); Game.onKill → bigKill
export function bigKill(g, victim) {
  const H = heatDecay(g);
  let best = null, bd = 150;
  for (const o of g.mode.objectives) { const d = dist(o, victim.pos); if (d < bd) { bd = d; best = o; } }
  if (best) H[best.id] = (H[best.id] || 0) + 1;
}
function heatDecay(g) {
  const H = (g._bigHeat ||= { t: g.time || 0, v: {} }), t = g.time || 0;
  if (t > H.t) { const k = Math.exp(-(t - H.t) / 144); for (const id in H.v) H.v[id] *= k; H.t = t; }      // yarı ömür ~100 sn
  return H.v;
}

// Takımın cephe görev listesi: [{ o, kind: 'def'|'att', w }] (öncelik sırasıyla)
function tasks(g, team, P) {
  const objs = g.mode.objectives, foe = team === 'blue' ? 'red' : 'blue';
  const home = g.map.spawns[team][0], fhome = g.map.spawns[foe][0];
  const own = objs.filter((o) => o.owner === team), anchors = own.length ? own : [home];
  const threat = (o) => { let n = 0; for (const e of g.soldiers) if (e.alive && e.team === foe && dist(e.pos, o) < o.r + 70) n++; return n; };
  const out = [];
  // tehdit altındaki kendi bayrakları (düşman sayısına göre)
  for (const o of own) { const n = threat(o); if (n) out.push({ o, kind: 'def', w: n, threat: n }); }
  out.sort((a, b) => b.w - a.w);
  // düşman kitlesi: düşman mangallarının merkezleri (canlı üyeler; 12.203: bütün mangallar — eskiden ilk 8'i, 128v128'de 32 mangalın çeyreği)
  const acc = new Map();
  for (const e of g.soldiers) if (e.alive && e.team === foe) { let a = acc.get(e.squad); if (!a) acc.set(e.squad, (a = { x: 0, z: 0, n: 0 })); a.x += e.pos.x; a.z += e.pos.z; a.n++; }
  const mass = [...acc.values()].map((a) => ({ x: a.x / a.n, z: a.z / a.n }));
  if (!mass.length) mass.push(fhome);
  const dMass = (o) => { let m = 1e9; for (const q of mass) m = Math.min(m, dist(q, o)); return m; };
  // cephe bayrağı: düşman kitlesine en yakın kendi bayrağı
  let front = null, fd = 1e9;
  for (const o of own) { const d = dMass(o); if (d < fd) { fd = d; front = o; } }
  // saldırı puanı: önümden uzaklık (sahipsiz × 0,8) + 0,6 × düşman kitlesine uzaklık → düşmanın bulunduğu / yöneldiği, önümdeki bayrak öne (temas);
  // 12.203: ÷ takımın niyet ağırlığı × (1 + yorgunluk) → birincil hedef maç içinde değişir, çok kanlı bayrak bir süre geriye düşer
  const heat = heatDecay(g);
  const att = objs.filter((o) => o.owner !== team).map((o) => ({ o, d: (Math.min(...anchors.map((q) => dist(q, o))) * (o.owner ? 1 : 0.8) + 0.6 * dMass(o)) / (P.w[o.id] ?? 1) / (o.id === P.focus ? BIG.focus : 1) * (1 + BIG.fatigue * Math.min(BIG.fatigueCap, heat[o.id] || 0)) })).sort((a, b) => a.d - b.d);
  return { def: out, front, att: att.map((a) => a.o), mass };
}

// mangal merkezi (canlı üyeler; yoksa üs)
function squadPos(g, team, sq) {
  let x = 0, z = 0, n = 0;
  for (const e of g.soldiers) if (e.alive && e.team === team && e.squad === sq) { x += e.pos.x; z += e.pos.z; n++; }
  return n ? { x: x / n, z: z / n } : g.map.spawns[team][0];
}

export function assignSquadsBig(g) {
  const objs = g.mode.objectives;
  if (!objs.length) return;
  for (const team of ['blue', 'red']) {
    const n = g.soldiers.filter((s) => s.team === team).length, nSq = Math.max(1, Math.ceil(n / 4));
    const P = plan(g, team);
    const T = tasks(g, team, P), prev = g.squadGoals[team], next = new Array(nSq).fill(null);
    const pos = [...Array(nSq).keys()].map((sq) => squadPos(g, team, sq));
    const free = new Set([...Array(nSq).keys()]);
    const take = (o, keepBias = 60) => {                                         // o'ya en yakın boştaki mangal (eski görevi buysa öne)
      let best = -1, bd = 1e9;
      for (const sq of free) { const d = dist(pos[sq], o) - (prev[sq] === o ? keepBias : 0); if (d < bd) { bd = d; best = sq; } }
      if (best >= 0) { next[best] = o; free.delete(best); }
      return best;
    };
    // 1) tehdit: en çok tehdit altındaki bayraklara (4+ düşman ve 4+ mangal → iki; 12.203: 12+ mangalda 4 düşmana 1 mangal, en çok mangalların üçte biri)
    const many = nSq >= 12;
    let defLeft = many ? Math.ceil(nSq / 3) : 99;
    for (const t of T.def.slice(0, nSq >= 3 ? (many ? 4 : 2) : 1)) {
      if (!free.size) break;
      const k = many ? clamp(Math.ceil(t.threat / 4), 1, defLeft) : t.threat >= 4 && nSq >= 4 && free.size > 1 ? 2 : 1;
      for (let i = 0; i < k && free.size && defLeft > 0; i++) { take(t.o, 120); defLeft--; }
    }
    // 2) cephe savunması: 4+ mangalda, cephe bayrağı henüz tutulmuyorsa (3 mangalda yalnız tehdit olunca: boş bayrakta bekleyen mangal savaşmıyordu)
    if (T.front && nSq >= 4 && free.size > 1 && !next.includes(T.front)) take(T.front, 80);
    // 3) saldırı: eksen sayısı mangal sayısına göre; mangallar eksenlere ağırlıkla (birincil > ikincil > üçüncül)
    const A = T.att, flank = new Array(nSq).fill(0);
    if (!A.length) { for (const sq of [...free]) { next[sq] = T.front || objs[0]; free.delete(sq); } }
    else {
      const axes = Math.min(A.length, nSq >= BIG.ax3 ? 3 : nSq >= BIG.ax2 ? 2 : 1);
      const N = free.size;
      if (axes === 1) {
        const nP = N <= 2 ? N : Math.round(N * 0.67);                               // az mangalda hepsi birincil hedefe (yoğunluk: dağılırsa kimse karşılaşmıyor)
        for (let k = 0; k < nP && free.size; k++) take(A[0]);
        while (free.size) take(A[1] || A[0]);
      } else {
        const share = axes === 3 ? [0.45, 0.33, 0.22] : [0.6, 0.4];
        for (let ax = 0; ax < axes; ax++) for (let k = 0, c = Math.max(1, Math.round(N * share[ax])); k < c && free.size; k++) take(A[ax]);
        while (free.size) take(A[0]);
      }
      // kanat: aynı hedefe 3+ mangal → her üçüncüsü sırayla sol / sağ kanattan dolanır (aynı görevde tarafını korur)
      const byObj = new Map();
      for (let sq = 0; sq < nSq; sq++) if (next[sq] && next[sq].owner !== team) { const l = byObj.get(next[sq]) || []; l.push(sq); byObj.set(next[sq], l); }
      for (const l of byObj.values()) if (l.length >= 3) l.forEach((sq, i) => { if (i % 3 === 2) flank[sq] = P.flank[sq] && prev[sq] === next[sq] ? P.flank[sq] : ((i / 3) | 0) % 2 ? 1 : -1; });
    }
    for (let sq = 0; sq < nSq; sq++) {
      if (next[sq] === prev[sq] && flank[sq] === (P.flank[sq] || 0)) continue;
      // görev değişti: mangalın botları hemen yeni hedef seçsin (yolda araçtaysa sürücü rotayı kendi değiştirir)
      for (const b of g.brains) if (b.s.team === team && b.s.squad === sq && b.s.alive) b.goalT = Math.min(b.goalT, 0.3 + Math.random() * 2.5);
    }
    P.flank = flank;
    g.squadGoals[team] = next;
    assignGuards(g, team, T.mass);                                              // 12.208 nöbet
  }
}

// 12.203 kanat mangalı: hedefe giden yolun %45'inde, 70–130 m yanda (kanat tarafında) yürünür ara nokta (yoksa null → düz yol)
export function flankVia(g, s, gx, gz) {
  const side = g._bigPlan?.[s.team]?.flank?.[s.squad];
  if (!side) return null;
  const dx = gx - s.pos.x, dz = gz - s.pos.z, L = Math.hypot(dx, dz);
  if (L < 140) return null;
  const off = Math.min(130, 70 + L * 0.08), mx = s.pos.x + dx * 0.45, mz = s.pos.z + dz * 0.45;
  const vi = g.nav.nearestFree(mx + (-dz / L) * off * side, mz + (dx / L) * off * side, 24);
  return vi >= 0 ? new THREE.Vector3(g.nav.cx(vi), 0, g.nav.cz(vi)) : null;
}

// Keskin nişancı tepe noktası (büyük harita): hedefin 60–160 m çevresinde, kendi tarafında, hedef merkezini (bot görüşüyle: yaprak da keser)
// ayakta gören, yüksek nokta. Takım + bayrak başına önbellek.
export function perchBig(g, o, team) {
  const key = 'big' + o.id + team;
  if (g.perchCache.has(key)) return g.perchCache.get(key);
  const home = g.map.spawns[team][0], W = g.world;
  const oc = new THREE.Vector3(o.x, W.heightAt(o.x, o.z) + 1.2, o.z), pe = new THREE.Vector3();
  const toHome = Math.atan2(home.z - o.z, home.x - o.x);
  let best = null, bs = -1e9;
  for (let k = 0; k < 140; k++) {
    const a = toHome + (Math.random() - 0.5) * 2.4, d = 60 + Math.random() * 100;
    const x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d;
    if (!g.nav.isFree(x, z)) continue;
    const y = W.heightAt(x, z);
    pe.set(x, y + 1.55, z);
    if (!g.botSees(pe, oc)) continue;
    const sc = (y - oc.y) * 0.8 + d * 0.02 + Math.random() * 3;
    if (sc > bs) { bs = sc; best = { x, z }; }
  }
  g.perchCache.set(key, best);
  return best;
}

// ── 12.208 NÖBET (kullanıcı: "aldığı yeri savunmuyor kimse, aldığı yerde nöbet tutulmalı") ──
// Ölçüm (başsız 16v16 300 sn): ele geçirilmiş bayrağın r + 30 m içinde ortalama 1,4–1,75 kendi askeri, bayrakların %46'sı bomboş (mangallar alıp geçiyordu).
//  · Her ele geçirilmiş bayrağa nöbetçi: per(n) = round(1 + n / 16), 1–6 (10v10 2, 32v32 3, 64v64 5, 128v128 6); takımın en çok %25'i nöbette
//    (saldırı temposu / 12.203 dağılımı korunsun). Sıra: tehdit altındaki → düşman kitlesine en yakın (cephe) → geride kalan (geride: en çok 1).
//  · Nöbetçi bayrağın çevresinde SİPER noktasına (kutu / duvar / kaya yanı, düşman yönüne bakan, düşman yaklaşmasını gören) çömelir; keskin nişancı
//    nöbetçi perchBig'e. Çatışmada mevziden kopmaz (yerinde çömel-kalk; 10 m'den yakındaki düşmana normal), sese / kaybolan düşmana bayraktan
//    r + 40 m'den öteye koşmaz. Ölünce o bayrakta doğar. Bayrak düşerse nöbet biter (mangal görevi geri alma).
//  · TEPKİ: bayrağın r + 70 m'sinde düşman varsa yakındaki (220 m) yaya botlar (nöbetçi değil, araçta değil) 35 sn savunmaya koşar: düşman başına 1,
//    en çok 2 × per(n). 1,5 sn'de bir denetlenir.
export const GUARD = { per: (n) => clamp(Math.round(1 + n / 16), 1, 6), budget: 0.25, rearD: 450, pick: 320, respondR: 220, respondT: 35, tick: 1.5, leash: 40, holdR: 10, swap: [40, 70] };
const isHumanS = (e) => !!(e && (e.isPlayer || e.human || e.netHuman) && !e.vacant);
function leaderHuman(g, b) {
  // mangalda insan lider varsa (12.202 manga) bot onu izler: nöbete alınmaz
  for (const e of g.soldiers) if (e.team === b.s.team && e.squad === b.s.squad && isHumanS(e)) return true;
  return false;
}
const freeBot = (b) => !b.s.veh && !b.vd && !b.vRes && !b.vRide && !b.s.def.zombie;
const dist2 = (a, x, z) => Math.hypot(a.x - x, a.z - z);

// bayrağın çevresinde nöbet siperleri (takım + bayrak başına önbellek): r × 0,35 … r + 16 m halkada yürünür nokta; puan = yanındaki siper kutusu
// (0,8–3,2 m yüksek, 2,4 m içinde) + düşman yönüne bakan yarı + düşman yaklaşmasını (bayraktan 70 m düşman yönü) görüyor + yükseklik. ≥ 6 m aralıklı en çok 8.
export function guardPosts(g, o, team) {
  const key = 'guard' + o.id + team;
  if (g.perchCache.has(key)) return g.perchCache.get(key);
  const W = g.world, foe = team === 'blue' ? 'red' : 'blue', fh = g.map.spawns[foe][0];
  const ea = Math.atan2(fh.z - o.z, fh.x - o.x), ex = Math.cos(ea), ez = Math.sin(ea);
  const app = new THREE.Vector3(o.x + ex * 70, 0, o.z + ez * 70); app.y = W.heightAt(app.x, app.z) + 1.2;
  const eye = new THREE.Vector3(), Q = [], cand = [];
  for (let k = 0; k < 90; k++) {
    const a = Math.random() * Math.PI * 2, d = o.r * 0.35 + Math.random() * (o.r * 0.65 + 16);
    let x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d;
    const vi = g.nav.nearestFree(x, z, 3); if (vi < 0) continue;
    x = g.nav.cx(vi); z = g.nav.cz(vi);
    const y = W.heightAt(x, z);
    let cover = 0;
    for (const c of W.query(x - 2.4, z - 2.4, x + 2.4, z + 2.4, Q)) { const h = c.max[1] - y; if (h > 0.8 && h < 3.2 && c.min[1] < y + 0.6) cover++; }
    eye.set(x, y + 1.5, z);
    const sees = g.botSees(eye, app) ? 1 : 0;
    const face = ((x - o.x) * ex + (z - o.z) * ez) / (Math.hypot(x - o.x, z - o.z) || 1);
    cand.push({ x, z, sc: Math.min(cover, 3) * 1.4 + face * 1.2 + sees * 2 + (y - W.heightAt(o.x, o.z)) * 0.15 + Math.random() * 0.6, look: Math.atan2(-ex, -ez) });
  }
  cand.sort((a, b) => b.sc - a.sc);
  const out = [];
  for (const c of cand) { if (out.every((p) => Math.hypot(p.x - c.x, p.z - c.z) >= 6)) out.push(c); if (out.length >= 8) break; }
  g.perchCache.set(key, out);
  return out;
}

// takımın nöbetçilerini dağıt (assignSquadsBig içinden, görev dağıtımıyla: 12 sn + bayrak değişince 1 sn)
function assignGuards(g, team, mass) {
  const objs = g.mode.objectives, n = g.soldiers.filter((s) => s.team === team && !s.vacant).length;
  const per = GUARD.per(n);
  let budget = Math.max(1, Math.floor(n * GUARD.budget));
  const mine = g.brains.filter((b) => b.s.team === team);
  // bayrağı düşen / sahibi değişen nöbetçi bırakılır
  for (const b of mine) if (b.guard && b.guard.owner !== team) { b.guard = null; b.guardPost = null; b.goalT = Math.min(b.goalT, 0.5); }
  const dMass = (o) => { let m = 1e9; for (const q of mass) m = Math.min(m, dist(q, o)); return m; };
  const foe = team === 'blue' ? 'red' : 'blue';
  const threat = (o) => { let k = 0; for (const e of g.soldiers) if (e.alive && e.team === foe && dist(e.pos, o) < o.r + 70) k++; return k; };
  const own = objs.filter((o) => o.owner === team).map((o) => ({ o, d: dMass(o), th: threat(o) })).sort((a, b) => (b.th > 0) - (a.th > 0) || a.d - b.d);
  const want = new Map();
  for (const f of own) { const w = Math.min(budget, f.d > GUARD.rearD && !f.th ? 1 : per); want.set(f.o, w); budget -= w; }
  // fazlalık: istenen sayıdan çok nöbetçisi olan bayrak (bütçe daraldı) → en uzaktakini bırak
  for (const f of own) {
    const L = mine.filter((b) => b.guard === f.o).sort((a, b) => (b.s.alive ? 0 : 1e6) + dist(b.s.pos, f.o) - ((a.s.alive ? 0 : 1e6) + dist(a.s.pos, f.o)));
    while (L.length > want.get(f.o)) { const b = L.shift(); b.guard = null; b.guardPost = null; b.goalT = Math.min(b.goalT, 0.5); }
  }
  for (const f of own) {
    let have = mine.filter((b) => b.guard === f.o).length;
    if (have >= want.get(f.o)) continue;
    const C = [];
    for (const b of mine) {
      if (b.guard || !freeBot(b) || leaderHuman(g, b)) continue;
      const d = b.s.alive ? dist(b.s.pos, f.o) : 260;                              // ölü bot: doğunca bayrakta doğar (orta öncelik)
      if (b.s.alive && d > GUARD.pick) continue;
      C.push([d - (g.squadGoal(b.s) === f.o ? 80 : 0) - (b.s.cls === 'heavy' || b.s.cls === 'sniper' ? 25 : 0) + (b.s.cls === 'medic' ? 40 : 0), b]);
    }
    C.sort((a, b) => a[0] - b[0]);
    for (const [, b] of C) { if (have >= want.get(f.o)) break; b.guard = f.o; b.guardPost = null; b.guardT = g.time; b.goalT = Math.min(b.goalT, 0.3 + Math.random()); have++; }
  }
}

// 1,5 sn'de bir (Game.step, büyük harita): saldırı altındaki bayrağa yakındaki botlar koşar
export function bigGuardTick(g) {
  if ((g.time || 0) < (g._grdT ?? 0)) return;
  g._grdT = (g.time || 0) + GUARD.tick;
  const objs = g.mode.objectives; if (!objs.length) return;
  for (const team of ['blue', 'red']) {
    const foe = team === 'blue' ? 'red' : 'blue', n = g.soldiers.filter((s) => s.team === team && !s.vacant).length, per = GUARD.per(n);
    for (const o of objs) {
      if (o.owner !== team) continue;
      let k = 0; for (const e of g.soldiers) if (e.alive && e.team === foe && dist(e.pos, o) < o.r + 70) k++;
      if (!k) continue;
      const wantR = Math.min(k, 2 * per);
      let have = 0; const C = [];
      for (const b of g.brains) {
        if (b.s.team !== team || !b.s.alive || b.guard) continue;
        if (b.respond && b.respond.o === o && g.time < b.respond.until) { have++; continue; }
        if (!freeBot(b) || leaderHuman(g, b)) continue;
        const d = dist(b.s.pos, o); if (d > GUARD.respondR || d < o.r * 0.6) continue;
        C.push([d, b]);
      }
      C.sort((a, b) => a[0] - b[0]);
      for (const [, b] of C) { if (have >= wantR) break; b.respond = { o, until: g.time + GUARD.respondT }; b.goalT = Math.min(b.goalT, 0.2 + Math.random() * 0.8); have++; (g.bigStats ||= { respond: 0 }).respond++; }
    }
  }
}

// BotBrain.pickGoal (büyük harita): nöbet / savunmaya koşma hedefi; true = hedef verildi
export function bigGuardGoal(b) {
  const g = b.game, s = b.s;
  if (b.respond) {
    const R = b.respond;
    if (g.time > R.until || (R.o.owner && R.o.owner !== s.team && g.time > R.until - GUARD.respondT * 0.5)) b.respond = null;   // süre doldu (alınan bayrağı yarı süre geri almaya çalışır)
    else { const a = Math.random() * Math.PI * 2, r = R.o.r * Math.random() * 0.7; b.setGoal(R.o.x + Math.cos(a) * r, R.o.z + Math.sin(a) * r, 12); b.perching = false; b.via = null; return true; }
  }
  const o = b.guard;
  if (!o) return false;
  if (o.owner !== s.team) { b.guard = null; b.guardPost = null; return false; }
  if (s.cls === 'sniper') { const pp = perchBig(g, o, s.team); if (pp && dist2(pp, o.x, o.z) < 170) { b.setGoal(pp.x, pp.z, rand(30, 50)); b.perching = true; b.guardPost = pp; b.via = null; return true; } }
  const P = guardPosts(g, o, s.team);
  if (!P.length) { const a = Math.random() * Math.PI * 2; b.setGoal(o.x + Math.cos(a) * o.r * 0.6, o.z + Math.sin(a) * o.r * 0.6, 20); b.perching = true; b.via = null; return true; }
  // mevzi: boş (başka nöbetçi tutmuyor), arada (40–70 sn) yer değiştirir
  if (!b.guardPost || !P.includes(b.guardPost) || g.time > (b.guardSwapT || 0)) {
    const used = new Set(); for (const q of g.brains) if (q !== b && q.guard === o && q.guardPost) used.add(q.guardPost);
    const free = P.filter((p) => !used.has(p) && p !== b.guardPost);
    b.guardPost = free.length ? free[Math.floor(Math.random() * Math.min(3, free.length))] : P[Math.floor(Math.random() * P.length)];
    b.guardSwapT = g.time + rand(GUARD.swap[0], GUARD.swap[1]);
  }
  const p = b.guardPost, d = dist2(s.pos, p.x, p.z);
  b.setGoal(p.x, p.z, Math.max(rand(20, 30), d / 4.2 + 12));
  b.perching = true; b.via = null;
  return true;
}

// çatışma hareketi (BotBrain.update): nöbetçi mevzisindeyse yerinden kopmaz → [mx, mz, hız, çömel] ya da null (normal çatışma)
export function guardCombatMove(b, dt, dist) {
  const s = b.s, p = b.guardPost, o = b.guard;
  if (!p || !o || dist < 10) return null;
  const d = dist2(s.pos, p.x, p.z);
  if (d > 30) return null;                                              // mevziden uzak (yolda): normal çatışma
  if (d > 1.6) { const k = 1 / d; return [(p.x - s.pos.x) * k, (p.z - s.pos.z) * k, 0.8, false]; }
  b.grdPeek = (b.grdPeek ?? rand(0, 2)) - dt;
  if (b.grdPeek <= 0) { b.grdUp = !b.grdUp; b.grdPeek = b.grdUp ? rand(2.2, 3.8) : rand(0.7, 1.4); }
  return [0, 0, 0, !b.grdUp && !(b.burstLeft > 0)];
}
// nöbetçi bu noktaya (ses / son görülen) koşar mı
export function guardLeash(b, x, z) { const o = b.guard; return !o || dist2(o, x, z) < o.r + GUARD.leash; }

// Bot doğuşu (büyük harita): mangal hedefine en yakın, ileri doğuşa uygun kendi bayrağı (yoksa null → genel kural). Üsten doğan bot araç alır.
export function spawnFlagBig(g, s, own) {
  if (s.brain?.guard && own.includes(s.brain.guard)) return s.brain.guard;      // 12.208 nöbetçi kendi bayrağında doğar
  if (s.brain?.respond && own.includes(s.brain.respond.o) && g.time < s.brain.respond.until) return s.brain.respond.o;
  const sq = g.squadGoal(s);
  if (!sq || !own.length) return null;
  let best = null, bd = 1e9;
  for (const o of own) { const d = dist(o, sq); if (d < bd) { bd = d; best = o; } }
  const home = g.map.spawns[s.team][0];
  return bd < dist(home, sq) - 60 ? best : null;                                  // üs hedefe neredeyse eşit yakınsa üs (araçlar orada)
}
