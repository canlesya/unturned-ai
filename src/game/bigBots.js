// ───── 12.189 Büyük harita (map.big: Kuzey Vadisi) bot çatışma akışı ─────
// Sorun (ölçüm, 10v10 240 sn): 7 bayrak / 1,6 km'de iki takımın mangalları kendine en yakın sahipsiz bayraklara dağılıyor, alınca 40 sn (yeniden
// dağıtım aralığı) boş bayrakta bekliyordu; savunan yok → bayraklar el değiştiriyor ama iki takım hiç karşılaşmıyor (en yakın düşman medyanı
// ~550 m, ilk temas 85–190 sn, 2–14 öldürme). Burada harita varlıklarına dokunmadan BOT DAVRANIŞI:
//  · CEPHE: takımın "önü" = sahip olduğu bayraklar (yoksa üs). Saldırı hedefi = önüne yakın + DÜŞMAN KİTLESİNE (mangal merkezleri) yakın, sahibi
//    olmadığı bayrak (sahipsiz biraz önde) → iki takım aynı bayrağa yönelir; savunma = düşman kitlesine en yakın kendi bayrağı + tehdit altındaki bayrak.
//  · mangal görevi: tehdit altındaki bayrağa en yakın mangal savunur; 4+ mangalda biri cephe bayrağını tutar; kalanlar birincil hedefe (4+ mangalda
//    üçte biri ikincil hedefe) saldırır. Görev değişince mangalın botları hemen yeni hedef seçer (eski 40 sn beklemesi yok); bayrak alınınca 1 sn içinde yeniden dağıtım.
//  · keskin nişancı: hedefi gören (bot görüşü: yaprak da), 60–160 m, yüksek, kendi tarafındaki tepe noktası.
import * as THREE from 'three';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Takımın cephe görev listesi: [{ o, kind: 'def'|'att', w }] (öncelik sırasıyla)
function tasks(g, team) {
  const objs = g.mode.objectives, foe = team === 'blue' ? 'red' : 'blue';
  const home = g.map.spawns[team][0], fhome = g.map.spawns[foe][0];
  const own = objs.filter((o) => o.owner === team), anchors = own.length ? own : [home];
  const fAnch = objs.filter((o) => o.owner === foe); if (!fAnch.length) fAnch.push(fhome);
  const threat = (o) => { let n = 0; for (const e of g.soldiers) if (e.alive && e.team === foe && dist(e.pos, o) < o.r + 70) n++; return n; };
  const out = [];
  // tehdit altındaki kendi bayrakları (düşman sayısına göre)
  for (const o of own) { const n = threat(o); if (n) out.push({ o, kind: 'def', w: n, threat: n }); }
  out.sort((a, b) => b.w - a.w);
  // düşman kitlesi: düşman mangallarının merkezleri (canlı üyeler; üsteki mangal üs merkezinde sayılır)
  const mass = [];
  for (let sq = 0; sq < 8; sq++) { let x = 0, z = 0, n = 0; for (const e of g.soldiers) if (e.alive && e.team === foe && e.squad === sq) { x += e.pos.x; z += e.pos.z; n++; } if (n) mass.push({ x: x / n, z: z / n }); }
  if (!mass.length) mass.push(fhome);
  const dMass = (o) => Math.min(...mass.map((q) => dist(q, o)));
  // cephe bayrağı: düşman kitlesine en yakın kendi bayrağı
  let front = null, fd = 1e9;
  for (const o of own) { const d = dMass(o); if (d < fd) { fd = d; front = o; } }
  // saldırı puanı: önümden uzaklık (sahipsiz × 0,8) + 0,6 × düşman kitlesine uzaklık → düşmanın bulunduğu / yöneldiği, önümdeki bayrak öne (temas);
  // düşmanın uzağındaki yan kanat bayrağı arkaya (eskiden iki takım boş bayrakları karşılıklı alıp birbirinin yanından geçiyordu)
  const att = objs.filter((o) => o.owner !== team).map((o) => ({ o, d: Math.min(...anchors.map((q) => dist(q, o))) * (o.owner ? 1 : 0.8) + 0.6 * dMass(o) })).sort((a, b) => a.d - b.d);
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
    const T = tasks(g, team), prev = g.squadGoals[team], next = new Array(nSq).fill(null);
    const pos = [...Array(nSq).keys()].map((sq) => squadPos(g, team, sq));
    const free = new Set([...Array(nSq).keys()]);
    const take = (o, keepBias = 60) => {                                         // o'ya en yakın boştaki mangal (eski görevi buysa öne)
      let best = -1, bd = 1e9;
      for (const sq of free) { const d = dist(pos[sq], o) - (prev[sq] === o ? keepBias : 0); if (d < bd) { bd = d; best = sq; } }
      if (best >= 0) { next[best] = o; free.delete(best); }
      return best;
    };
    // 1) tehdit: en çok tehdit altındaki bayrağa bir mangal (4+ düşman ve 4+ mangal → iki)
    for (const t of T.def.slice(0, nSq >= 3 ? 2 : 1)) { if (!free.size) break; take(t.o, 120); if (t.threat >= 4 && nSq >= 4 && free.size > 1) take(t.o, 120); }
    // 2) cephe savunması: 4+ mangalda, cephe bayrağı henüz tutulmuyorsa (3 mangalda yalnız tehdit olunca: boş bayrakta bekleyen mangal savaşmıyordu)
    if (T.front && nSq >= 4 && free.size > 1 && !next.includes(T.front)) take(T.front, 80);
    // 3) saldırı: birincil %60, ikincil kalan (hedef yoksa cephe / üs)
    const A = T.att;
    if (!A.length) { for (const sq of [...free]) { next[sq] = T.front || objs[0]; free.delete(sq); } }
    else {
      const nP = free.size <= 2 ? free.size : Math.round(free.size * 0.67);       // az mangalda hepsi birincil hedefe (yoğunluk: dağılırsa kimse karşılaşmıyor)
      for (let k = 0; k < nP && free.size; k++) take(A[0]);
      while (free.size) take(A[1] || A[0]);
    }
    for (let sq = 0; sq < nSq; sq++) {
      if (next[sq] === prev[sq]) continue;
      // görev değişti: mangalın botları hemen yeni hedef seçsin (yolda araçtaysa sürücü rotayı kendi değiştirir)
      for (const b of g.brains) if (b.s.team === team && b.s.squad === sq && b.s.alive) b.goalT = Math.min(b.goalT, 0.3 + Math.random() * 2.5);
    }
    g.squadGoals[team] = next;
  }
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
