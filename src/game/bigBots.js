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
  return { def: out, front, att: att.map((a) => a.o) };
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

// Bot doğuşu (büyük harita): mangal hedefine en yakın, ileri doğuşa uygun kendi bayrağı (yoksa null → genel kural). Üsten doğan bot araç alır.
export function spawnFlagBig(g, s, own) {
  const sq = g.squadGoal(s);
  if (!sq || !own.length) return null;
  let best = null, bd = 1e9;
  for (const o of own) { const d = dist(o, sq); if (d < bd) { bd = d; best = o; } }
  const home = g.map.spawns[s.team][0];
  return bd < dist(home, sq) - 60 ? best : null;                                  // üs hedefe neredeyse eşit yakınsa üs (araçlar orada)
}
