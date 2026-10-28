// 12.202 Manga sistemi (Battlefield gibi): takımlar 4 kişilik mangalara ayrılır (s.squad = takım içi manga sırası). Yetkili taraf (çevrimdışı oyun /
// sunucu) atar; çevrimiçinde roster'daki `sq` alanıyla istemcilere gider. Mangadan doğuş: arkadaş canlı, araçta / suda / havada değil, çatışmada değil
// (son 5 sn'de vurulmadı, son 3 sn'de ateş etmedi) ve yakında düşman yok (20 m içinde ya da 55 m içinde onu gören düşman) → arkasında boş, aynı katta,
// arada duvar olmayan nokta. Ortak işlevler: Game (doğuş), BotBrain (lideri izleme), Room (durum `me.sp`), HUD / büyük harita.
import * as THREE from 'three';

export const SQUAD_N = 4;
// mangadan doğuş durumu (ağ: me.sp = [[arkadaş id, kod]…]): 0 uygun · 1 çatışmada · 2 yakında düşman · 3 ölü · 4 araçta · 5 havada / suda
export const SP = { OK: 0, COMBAT: 1, ENEMY: 2, DEAD: 3, VEH: 4, AIR: 5 };
export const SQ_NAMES = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Eko', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu'];
export const squadName = (i) => SQ_NAMES[i] || `${i + 1}`;
const COMBAT_HIT = 5, COMBAT_FIRE = 3, ENEMY_NEAR = 20, ENEMY_SEE = 55;

// Manga / doğuş seçici hangi modlarda: takım modları (Ele Geçirme, Kuzey Vadisi fetih, TDM, Vagon, Cephe, Uzay). Herkes-tek (ölüm maçı / silah
// yarışı / paintball) ve Enfekte'de kapalı (takım yok ya da takımlar maç içinde değişiyor)
export const squadOn = (g) => !g.ffa && !g.mode.infection && !g.mode.fixed && !g.opts?.editor;
export const isHuman = (s) => !!(s && (s.human || s.isPlayer || s.netHuman));

export function squadMembers(g, team, sq) { return g.soldiers.filter((e) => e.team === team && e.squad === sq && !e.vacant); }
export function squadMates(g, s) { return g.soldiers.filter((e) => e !== s && e.team === s.team && e.squad === s.squad && !e.vacant); }
// Lider: mangadaki en küçük kimlikli insan, insan yoksa en küçük kimlikli asker
export function squadLeader(g, team, sq) {
  let best = null;
  for (const e of g.soldiers) {
    if (e.team !== team || e.squad !== sq || e.vacant) continue;
    if (!best || (isHuman(e) && !isHuman(best)) || (isHuman(e) === isHuman(best) && e.id < best.id)) best = e;
  }
  return best;
}

// Varsayılan dağılım: takım içi sırayla 4'erli (eski davranışla aynı)
export function assignDefault(g) {
  for (const team of ['blue', 'red']) { let n = 0; for (const s of g.soldiers) if (s.team === team) s.squad = Math.floor(n++ / SQUAD_N); }
}

// İnsan katılınca (sunucu claimSlot): aynı takımda başka insanın olduğu, yeri olan mangaya geçer (bir botla manga numarası değiş tokuş edilir).
// Böylece aynı takımdaki arkadaşlar birlikte oynar; mangalar hep 4 kişilik kalır.
export function placeHuman(g, s) {
  if (g.ffa || g.mode.infection) return false;
  if (g.soldiers.some((e) => e !== s && e.team === s.team && e.squad === s.squad && e.human)) return false;
  const hum = new Map();
  for (const e of g.soldiers) if (e !== s && e.team === s.team && e.human) hum.set(e.squad, (hum.get(e.squad) || 0) + 1);
  const sqs = [...hum.entries()].filter(([, n]) => n < SQUAD_N).sort((a, b) => b[1] - a[1]);
  for (const [sq] of sqs) {
    const bot = g.soldiers.find((e) => e.team === s.team && e.squad === sq && !e.human && e !== s);
    if (!bot) continue;
    const mine = s.squad; s.squad = sq; bot.squad = mine;
    return true;
  }
  return false;
}

const _e = new THREE.Vector3(), _t = new THREE.Vector3();
// Arkadaşın yanında doğulabilir mi (yetkili taraf; 0,4 sn önbellek). Çevrimiçi istemci bunu sunucunun me.sp'sinden okur (game.mateState)
export function mateSpawnState(g, m) {
  if (!m || !m.alive || m.vacant) return SP.DEAD;
  const c = m._sqSt;
  if (c && g.time - c.t < 0.4 && c.t <= g.time) return c.v;
  let v = SP.OK;
  if (m.veh) v = SP.VEH;
  else if (m.swim || m.under || (!m.onGround && Math.abs(m.vel.y) > 2.5)) v = SP.AIR;
  else if (g.time - (m.lastDmgT ?? -99) < COMBAT_HIT || g.time - (m.spottedT ?? -99) < COMBAT_FIRE) v = SP.COMBAT;
  else {
    _t.set(m.pos.x, m.pos.y + 1.3, m.pos.z);
    for (const e of g.soldiers) {
      if (!e.alive || e.vacant || e.team === m.team) continue;
      const d = Math.hypot(e.pos.x - m.pos.x, e.pos.z - m.pos.z);
      if (d < ENEMY_NEAR || (d < ENEMY_SEE && g.botSees(e.eye(_e), _t))) { v = SP.ENEMY; break; }
    }
  }
  m._sqSt = { t: g.time, v };
  return v;
}

const DOWN = new THREE.Vector3(0, -1, 0), _o = new THREE.Vector3(), _h = {}, _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = [];
// Arkadaşın arkasında doğuş noktası: 1,6–3,4 m halkada arkadan başlayarak; zemin arkadaşın katında (±0,7 m), gövde kutulara girmiyor, aradan duvar
// geçmiyor, başka askerin üstü değil. Bulunamazsa arkadaşın durduğu yer (çok dar koridor / merdiven).
export function mateSpawnPoint(g, s, m) {
  const W = g.world, yaw = m.yaw;
  const offs = [0, 0.55, -0.55, 1.1, -1.1, 1.7, -1.7, Math.PI];
  _a.set(m.pos.x, m.pos.y + 1.2, m.pos.z);
  for (const r of [1.8, 2.6, 3.4]) for (const da of offs) {
    const a = yaw + da, x = m.pos.x + Math.sin(a) * r, z = m.pos.z + Math.cos(a) * r;      // bakış −(sin, cos) → arkası +(sin, cos)
    const B = g.map.bounds; if (x < B.minX + 1 || x > B.maxX - 1 || z < B.minZ + 1 || z > B.maxZ - 1) continue;
    _o.set(x, m.pos.y + 1.2, z);
    const hit = W.raycast(_o, DOWN, 2.8, _h);
    const y = hit ? hit.point.y : W.heightAt(x, z);
    if (Math.abs(y - m.pos.y) > 0.7) continue;
    if (W._hits(W.query(x - 1, z - 1, x + 1, z + 1, _q), x, y + 0.05, z, 1.7)) continue;
    _b.set(x, y + 1.2, z);
    if (!W.clear(_a, _b)) continue;
    if (g.soldiers.some((e) => e !== s && e.alive && Math.hypot(e.pos.x - x, e.pos.z - z) < 0.9)) continue;
    return { x, z, y, ry: yaw, squad: true };
  }
  return { x: m.pos.x, z: m.pos.z, y: m.pos.y, ry: yaw, squad: true };
}

// Manga botu liderini biraz izler (BotBrain.pickGoal; Cephe / Vagon / Enfekte rol planlarından ve araçtan sonra, mevzi / bayrak seçiminden önce).
// Lider insansa (oyuncu): 14 m'den uzaksa %50 olasılıkla onun 4–9 m yakınına (arkası / yanları) yürür; bayrak görevi seçiminin yerini yalnız o hedef
// süresince alır (8–14 sn), sonra her zamanki görev mantığı. Lider botsa yalnız bayraksız modda (TDM: haritada dolaşma) ve 25 m'den uzakken %25.
export function squadFollow(b) {
  const g = b.game, s = b.s;
  if (!squadOn(g) || s.veh || b.perching) return false;
  const ld = squadLeader(g, s.team, s.squad);
  if (!ld || ld === s || !ld.alive || ld.veh) return false;
  const hum = isHuman(ld), d = Math.hypot(ld.pos.x - s.pos.x, ld.pos.z - s.pos.z);
  if (hum ? d < 14 || d > 160 || Math.random() > 0.5 : g.mode.objectives.length || d < 25 || Math.random() > 0.25) return false;
  const B = g.map.bounds, a = ld.yaw + (Math.random() - 0.5) * 2.6, r = 4 + Math.random() * 5;      // arkası ±75°
  let x = Math.max(B.minX + 2, Math.min(B.maxX - 2, ld.pos.x + Math.sin(a) * r)), z = Math.max(B.minZ + 2, Math.min(B.maxZ - 2, ld.pos.z + Math.cos(a) * r));
  const vi = g.nav?.nearestFree ? g.nav.nearestFree(x, z, 8) : -1;
  if (vi >= 0) { x = g.nav.cx(vi); z = g.nav.cz(vi); }
  b.setGoal(x, z, 8 + Math.random() * 6, ld.pos.y);
  b.followT = g.time;
  return true;
}
