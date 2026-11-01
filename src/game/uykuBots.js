// 12.223 Uyku Modu bot davranışı (bot.js'e kancalar; yapı / mermi değişmez, yalnız botun kararı):
// · Takımca ilerleme: hedef = takımın ayaktaki askerlerinin ortası → düşmanların ortası doğrultusunda bir nokta (bot başına yan sapma);
//   böylece takım birlikte yürür, iki takım da yerinde beklemez. Süre azalınca (≤ 40 sn) önde olan takım kendi ortasında savunur, geride olan bastırır.
// · Uyuyan takım arkadaşı: görüşte AYAKTA düşman varsa önce çatışır (tehdidi temizler), sonra arkadaşa yürür, yanında çömelip sağ tık basılı
//   (s.rvWant) tutar; düşman belirirse bırakıp çatışır. Haklar (raunt başı 2 kaldırma / 2 kaldırılma) uyku.js'te. Aynı arkadaşa iki bot gitmez.
// · Uyuyan düşman: görüşteki AYAKTA düşmanlar önceliklidir (sense puanı +200 m); başka tehdit yokken uyuyanı bitirir.
import { LIMITS, TUNE } from './balance.js';
import { rand, clamp, angleDiff, yawFromDir, lerp } from './util.js';
import { UY_REACH } from './uyku.js';

// revR: kaldırmaya gidilecek en uzak arkadaş (m) · downBias: uyuyan düşmanın hedef puanı eki (m) · finWait: uyuyan düşman en az bu kadar uyuduktan sonra
// bitirilir (arkadaşlarına kaldırma fırsatı; çatışma ortasında anında bitirme yok) · foeQuiet: bot son bu kadar sn ayakta düşman görmediyse "güvenli" ·
// lateT: süre bu kadar azalınca önde olan savunur · holdR: arkadaşa bu kadar yaklaşınca yol ızgarası bırakılır, doğrudan yanına gidilir
export const UY_BOT = { revR: 45, downBias: 200, finWait: 2.5, foeQuiet: 2, lateT: 40, holdR: 3.2 };

// her bot güncellemesinin başında (BotBrain.update). true: bu adım burada bitti (normal akış çalışmaz)
export function uyBrain(b, dt) {
  const g = b.game, s = b.s, U = g.uyku;
  s.rvWant = false;
  if (s.downed) {                                                                  // uyuyor: kıpırdamaz, ateş etmez
    s.vel.x = 0; s.vel.z = 0; s.ads = false; s.sprinting = false; s.crouching = false; b.target = null; b.burstLeft = 0;
    return true;
  }
  if (U.prep) {                                                                    // hazırlık: donuk, düşman tarafına bakar
    s.vel.x = 0; s.vel.z = 0; s.ads = false; s.sprinting = false; b.goal = null; b.path = null; b.target = null;
    const e = g.map.spawns[s.team === 'blue' ? 'red' : 'blue']?.[0];
    if (e) s.yaw += clamp(angleDiff(s.yaw, yawFromDir(e.x - s.pos.x, e.z - s.pos.z)), -3 * dt, 3 * dt);
    return true;
  }
  if (!U.live) return false;
  if (b.target?.downed && !uyFinishOk(b, b.target)) { b.target = null; b.burstLeft = 0; }      // az önce uyuttuğu düşmana hemen sıkmaz (bitirme ancak güvenliyse)
  // kaldırma görevi (0,4 sn'de bir yeniden bakılır)
  if ((b.uyRvT = (b.uyRvT ?? rand(0, 0.4)) - dt) <= 0) { b.uyRvT = 0.4; b.uyRv = pickRevive(b); }
  const v = b.uyRv;
  if (!v || !v.downed || !U.revOk(s, v)) { b.uyRv = null; return false; }
  if (b.target && b.target.alive && !b.target.downed) return false;              // önce tehdit: görüşteki ayakta düşmanla çatış
  const dx = v.pos.x - s.pos.x, dz = v.pos.z - s.pos.z, d = Math.hypot(dx, dz);
  if (d > UY_BOT.holdR || Math.abs(v.pos.y - s.pos.y) > 1.5) {                     // yol ızgarasıyla arkadaşa yürü (normal akış: followGoal)
    if (!b.goal || Math.hypot(b.goal.x - v.pos.x, b.goal.z - v.pos.z) > 1.2) { b.setGoal(v.pos.x, v.pos.z, 12, v.pos.y); b.via = null; b.perching = false; b.spot = null; b.atSpot = false; }
    else b.goalT = Math.max(b.goalT, 2);
    return false;
  }
  // yanında: gözünü dört aç (görüş), çömel, arkadaşa dön, sağ tık basılı
  b.senseT -= dt;
  if (b.senseT <= 0) { b.senseT = 0.22; b.sense(); }
  if (b.target && b.target.alive && !b.target.downed) return false;
  const near = d < UY_REACH - 0.6, sp = near ? 0 : TUNE.walkSpeed * s.spd * 0.55, k = Math.min(1, dt * 10);
  s.vel.x = lerp(s.vel.x, near ? 0 : (dx / (d + 1e-6)) * sp, k);
  s.vel.z = lerp(s.vel.z, near ? 0 : (dz / (d + 1e-6)) * sp, k);
  s.sprinting = false; s.ads = false; s.crouching = near;
  s.yaw += clamp(angleDiff(s.yaw, yawFromDir(dx, dz)), -6 * dt, 6 * dt);
  s.pitch += (-0.55 - s.pitch) * Math.min(1, dt * 5);
  s.rvWant = d < UY_REACH - 0.15;
  return true;
}

// kaldırılacak arkadaş: hakları yeten, kanaması yetişilecek kadar olan, başka (daha yakın) botun üstlenmediği en yakın uyuyan
function pickRevive(b) {
  const g = b.game, s = b.s, U = g.uyku;
  if ((s.rvN | 0) >= LIMITS.uyRevMax) return null;
  let best = null, bd = UY_BOT.revR;
  for (const v of g.soldiers) {
    if (!v.downed || v.team !== s.team || !U.revOk(s, v)) continue;
    const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
    if (d >= bd || d / (TUNE.walkSpeed * 0.9) + LIMITS.uyRevive > (v.bleedT || 0) + 1) continue;
    if (v.rvBy && v.rvBy !== s && v.rvBy.rvWant) continue;                        // biri zaten kaldırıyor
    let taken = false;
    for (const o of g.brains) if (o !== b && o.uyRv === v && o.s.alive && !o.s.downed && Math.hypot(v.pos.x - o.s.pos.x, v.pos.z - o.s.pos.z) < d) { taken = true; break; }
    if (taken) continue;
    bd = d; best = v;
  }
  return best;
}

// sense puanı eki: uyuyan düşman ayaktakilerden sonra gelir (başka tehdit yokken bitirilir)
export function uyTargetBias(b, e) { return e.downed ? UY_BOT.downBias : 0; }
// uyuyan düşmanı bitirmek "güvenli" mi: en az finWait sn uyumuş ve bot son foeQuiet sn'de ayakta düşman görmemiş
export function uyFinishOk(b, e) { const T = b.game.time; return T - (e.uyDownT ?? T) >= UY_BOT.finWait && T - (b.uyFoeT ?? -99) >= UY_BOT.foeQuiet; }

// takımın bu rauntki rotası: haritanın dolaşma noktalarından / hedef noktalarından iki doğuşun arasında kalan rastgele biri (her raunt farklı hat: hep ortadan
// kafa kafaya çarpışma olmasın). Takım ortası noktaya 12 m yaklaşınca ya da ilk temasta (biri uyudu) düşmana yönelinir
function routeOf(g, U, team) {
  const R = (U.routes ||= {});
  if (R.round !== U.round) { R.round = U.round; R.blue = R.red = undefined; }
  if (R[team] !== undefined) return R[team];
  const a = g.map.spawns[team]?.[0], b = g.map.spawns[team === 'blue' ? 'red' : 'blue']?.[0];
  const pts = [...(g.map.roamPoints || []).map((p) => ({ x: p[0], z: p[1] })), ...(g.map.objectives || []).map((o) => ({ x: o.x, z: o.z }))];
  let best = null, bs = -1e9;
  if (a && b) {
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    for (const p of pts) {
      const t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2;
      if (t < 0.15 || t > 0.7) continue;                                           // kendi yarısında / ortada (düşman doğuşunun dibinde değil)
      const sc = Math.random() * 10 - Math.abs(t - 0.4) * 8;
      if (sc > bs) { bs = sc; best = p; }
    }
  }
  R[team] = best ? { x: best.x, z: best.z, done: false } : null;
  return R[team];
}

// BotBrain.pickGoal: takımca ilerleme / süre azken önde olan savunur
export function uyPickGoal(b) {
  const g = b.game, s = b.s, U = g.uyku;
  b.perching = false; b.via = null;
  let cx = 0, cz = 0, n = 0, ex = 0, ez = 0, m = 0;
  for (const e of g.soldiers) {
    if (!e.alive || e.vacant) continue;
    if (e.team === s.team) { if (!e.downed) { cx += e.pos.x; cz += e.pos.z; n++; } }
    else if (!e.downed || m === 0) { ex += e.pos.x; ez += e.pos.z; m++; }
  }
  if (!m) { b.roam(); return; }
  cx = n ? cx / n : s.pos.x; cz = n ? cz / n : s.pos.z; ex /= m; ez /= m;
  const late = U.live && U.t < UY_BOT.lateT, lead = U.leader();
  const rt = routeOf(g, U, s.team);
  if (rt && !rt.done && (Math.hypot(cx - rt.x, cz - rt.z) < 12 || U.contact || late)) rt.done = true;
  if (rt && !rt.done) {                                                            // rota noktasına takımca (yan sapmalı)
    const side = ((s.id % 3) - 1) * rand(2, 5);
    b.setGoal(rt.x + side * 0.7 + rand(-2, 2), rt.z - side * 0.7 + rand(-2, 2), rand(7, 12));
    return;
  }
  if (late && lead === s.team) {                                                   // önde ve süre az: takımın yanında savun
    b.setGoal(cx + rand(-5, 5), cz + rand(-5, 5), rand(5, 9));
    return;
  }
  const dx = ex - cx, dz = ez - cz, L = Math.hypot(dx, dz) || 1;
  const f = late ? rand(0.85, 1) : rand(0.35, 0.7), side = ((s.id % 3) - 1) * rand(3, 7);
  // takımdan çok öndeysen (düşmana doğru ≥ 14 m) bekle: hedef takım ortasının biraz önü
  const ahead = ((s.pos.x - cx) * dx + (s.pos.z - cz) * dz) / L;
  const ff = ahead > 14 && !late ? 0.2 : f;
  b.setGoal(cx + dx * ff + (-dz / L) * side, cz + dz * ff + (dx / L) * side, rand(7, 12));
}
