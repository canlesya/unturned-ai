// Orman Kalesi + Paintball başsız testi: node scripts/ormankaletest.mjs   (tarayıcı / sunucu gerekmez)
// Kurulum, çarpışma kutuları (geçerli, nesneler arası iç içe yok, havada asılı yok), doğuşlar (zeminde, geometrinin içinde değil, aralıklı, birbirine ulaşır),
// toplama noktaları, yürüyüş (kale merdiveni 0 → 3, gözcü merdiveni 3 → 5,64, gözetleme kulesi 0 → 3,6, köprüler, dereden yürüyerek geçiş, devrik kütük),
// sızıntı (çite yürüyen dışarı çıkamaz), yol bulma (her önemli noktaya her doğuştan), tek bot kale / gözcü / kuleye yürür, 8 botlu maç kazananla biter.
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { Game } from '../src/game/game.js';
import { applyInput } from '../src/sim/input.js';
import { PB_LOADOUT } from '../src/game/match.js';
import { LIMITS } from '../src/game/balance.js';
import { H_STAND } from '../src/game/collision.js';
import { creekZ, OK } from '../src/maps/ormankale.js';

let fail = 0;
const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const mk = (per = 8, time = 900) => new Game(null, { headless: true, map: 'ormankale', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type: 'pb', time } });
const solo = (g) => { for (const s of g.soldiers.slice(1)) { s.vacant = true; s.alive = false; } g.brains = g.brains.filter((b) => b.s === g.soldiers[0]); return g.soldiers[0]; };

// ── 1. kurulum ──
const t0 = performance.now();
const g = mk();
const m = g.map, W = g.world, T = g.terrain;
console.log(`      kurulum ${(performance.now() - t0).toFixed(0)} ms · çarpışma ${m.colliders.length} · yaprak küresi ${m.sight.length} · nav katlı ${!!g.nav.K}`);
check(g.mode.type === 'pb' && g.ffa && g.mode.fixed && g.mode.killLimit === LIMITS.pbKills, `mod pb (herkes tek, sabit teçhizat, hedef ${g.mode.killLimit})`);
check(m.colliders.length > 200 && m.colliders.every((c) => c.min.every((v, i) => Number.isFinite(v) && v < c.max[i])), 'çarpışma kutuları geçerli');
const lo = PB_LOADOUT();
check(g.soldiers.every((s) => s.items.map((i) => i.id).join() === lo.join()), `teçhizat: ${lo.join(' + ')}`);

// ── 2. çarpışma denetimi: farklı nesnelerin kutuları iç içe değil; zemindeki kutular havada değil ──
const C = m.colliders;
const ov = (a, b) => Math.max(0, Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0])) * Math.max(0, Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1])) * Math.max(0, Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]));
const group = (oid) => String(oid).split(':').slice(0, 2).join(':');
const bad = [];
for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
  const a = C[i], b = C[j];
  if (group(a.oid) === group(b.oid)) continue;
  if (/^çit:/.test(a.oid) && /^çit:/.test(b.oid)) continue;               // çit köşelerinde ağ düzlemleri 10 cm kesişir (saydam ağ)
  const v = ov(a, b);
  if (v > 2e-4) bad.push(`${a.oid} × ${b.oid} ${(v * 1e3).toFixed(1)} L @ ${a.min.map((q) => q.toFixed(1))}`);
}
check(!bad.length, `farklı nesnelerin çarpışma kutuları iç içe değil ${bad.length ? '\n        ' + bad.slice(0, 12).join('\n        ') : ''}`);
const floatB = [];
for (const c of C) {
  if (c.min[1] < -0.05 || c.min[1] > 0.2) continue;                          // yalnız zemine oturan kutular
  if (/^köprü|^dere:/.test(c.oid)) continue;                                 // köprü / kütük: kıyıdan kıyıya (altı dere)
  const cs = [[c.min[0], c.min[2]], [c.max[0], c.min[2]], [c.min[0], c.max[2]], [c.max[0], c.max[2]], [(c.min[0] + c.max[0]) / 2, (c.min[2] + c.max[2]) / 2]];
  const lowG = Math.min(...cs.map(([x, z]) => T.heightAt(x, z)));
  if (c.min[1] - lowG > 0.12 && c.min[1] < 0.06) floatB.push(`${c.oid} y ${c.min[1].toFixed(2)} zemin ${lowG.toFixed(2)}`);
}
check(!floatB.length, `zemindeki kutuların altı boş değil (dere kenarında havada kalan yok) ${floatB.slice(0, 6).join(' | ')}`);
check(C.every((c) => c.max[0] <= OK.fence + 0.4 && c.min[0] >= -OK.fence - 0.4 && c.max[2] <= OK.fence + 0.4 && c.min[2] >= -OK.fence - 0.4), 'tüm çarpışma kutuları çit hattının içinde (dış süs çarpışmasız)');

// ── 3. doğuşlar ──
const floorAt = (x, y, z) => (Math.abs(T.heightAt(x, z) - y) < 0.08) || C.some((c) => Math.abs(c.max[1] - y) < 0.06 && x + 0.32 > c.min[0] && x - 0.32 < c.max[0] && z + 0.32 > c.min[2] && z - 0.32 < c.max[2]);
const inside = (x, y, z) => W._hits(W.query(x - 1, z - 1, x + 1, z + 1, []), x, y + 0.01, z, H_STAND);
const badSp = [];
for (const p of m.ffaSpawns) if (inside(p.x, p.y, p.z) || !floorAt(p.x, p.y, p.z) || !g.nav.safeAt(p.x, p.y, p.z) || p.y < -0.05) badSp.push([p.x, p.y.toFixed(2), p.z]);
check(m.ffaSpawns.length >= 16 && !badSp.length, `${m.ffaSpawns.length} doğuş: zeminde, kuru (derede değil), geometrinin içinde değil ${badSp.length ? JSON.stringify(badSp) : ''}`);
let dmin = 1e9; for (const a of m.ffaSpawns) for (const b of m.ffaSpawns) if (a !== b) dmin = Math.min(dmin, Math.hypot(a.x - b.x, a.z - b.z));
check(dmin >= 6, `doğuşlar aralıklı (en yakın iki doğuş ${dmin.toFixed(1)} m)`);
const q4 = [0, 0, 0, 0]; for (const p of m.ffaSpawns) q4[(p.x > 0 ? 1 : 0) + (p.z > 0 ? 2 : 0)]++;
check(q4.every((n) => n >= 4), `dört çeyreğe dağılmış (${q4.join(' / ')})`);
const reach = g.nav.reachable(m.ffaSpawns[0].x, m.ffaSpawns[0].z, 0);
const cellOf = (x, z) => Math.floor((z - g.nav.minZ) / 0.5) * g.nav.w + Math.floor((x - g.nav.minX) / 0.5);
check(m.ffaSpawns.every((p) => reach[cellOf(p.x, p.z)]), 'her doğuş birbirine yürüyerek ulaşır (yol ızgarası)');
let freeC = 0, reachC = 0; for (let i = 0; i < reach.length; i++) { if (!g.nav.blocked[i]) { freeC++; if (reach[i]) reachC++; } }
check(reachC / freeC > 0.97, `açık alanın %${(reachC / freeC * 100).toFixed(1)}'i ulaşılabilir (kapalı cep yok)`);
const badPk = m.pickupSpots.filter((p) => inside(p.x, p.y, p.z) || !floorAt(p.x, p.y, p.z) || !g.nav.safeAt(p.x, p.y, p.z));
check(m.pickupSpots.length >= 8 && !badPk.length && m.pickupSpots.every((p) => p.kind === 'ammo' || p.kind === 'health'), `${m.pickupSpots.length} toplama noktası (cephane ${m.pickupSpots.filter((p) => p.kind === 'ammo').length} / can ${m.pickupSpots.filter((p) => p.kind === 'health').length}): zeminde, boşta ${badPk.length ? JSON.stringify(badPk) : ''}`);
const badR = m.roamPoints.filter(([x, z, y]) => !g.nav.safeAt(x, y, z) || inside(x, y, z));
check(!badR.length, `${m.roamPoints.length} dolaşma noktası yürünür ${badR.length ? JSON.stringify(badR) : ''}`);

// ── 4. yol bulma: her doğuştan önemli noktalara ──
const KEYS = [['gözcü tepesi', 0.4, 0.2, OK.turret], ['kale güvertesi', -3.8, -3.8, OK.deck], ['kale içi', -2.0, -2.0, 0], ['kulübe içi', -19.0, -19.4, 0], ['gözetleme kulesi', 18.8, 21.3, 3.6], ['orta köprü', 3.0, creekZ(3), 0.15], ['dere tabanı', -10.0, creekZ(-10), -0.9]];
for (const [nm, x, z, y] of KEYS) {
  let ok = 0;
  for (const p of m.ffaSpawns) { const path = g.nav.findPath(p.x, p.z, x, z, 0.7, p.y, y); if (path && Math.abs(path[path.length - 1].y - y) < 0.3 && Math.hypot(path[path.length - 1].x - x, path[path.length - 1].z - z) < 1) ok++; }
  check(ok === m.ffaSpawns.length, `yol: ${nm} (y ${y}) ${ok}/${m.ffaSpawns.length} doğuştan`);
}

// ── 5. yürüyüş testleri (applyInput + World.move, 60 Hz, oyuncuyla aynı fizik) ──
function walk(gg, s, from, yaw, secs, { until, jump = false } = {}) {
  s.alive = true; s.protT = 99; s.pos.set(from[0], from[1], from[2]); s.vel.set(0, 0, 0); s.yaw = yaw; s.onGround = true; s.launchT = 0;
  let low = 1e9, high = -1e9, t = 0;
  for (; t < secs; t += 1 / 60) {
    gg.world.move(s, 1 / 60);
    applyInput(s, { f: 1, r: 0, lean: 0, sprint: false, jump }, 1 / 60);
    if (t > 0.1) { low = Math.min(low, s.pos.y); high = Math.max(high, s.pos.y); }
    if (until && until(s)) break;
  }
  return { x: s.pos.x, y: s.pos.y, z: s.pos.z, low, high, t };
}
const tg = mk(2, 0), w = solo(tg); tg.brains.length = 0;
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
{ let r = walk(tg, w, [-1.6, 0, -6.25], yawTo(1, 0), 5, { until: (s) => s.pos.x > 4.6 });
  check(Math.abs(r.y - OK.deck) < 0.05, `kale kuzey merdiveni 0 → 3 m (${r.t.toFixed(1)} sn, y ${r.y.toFixed(2)})`);
  r = walk(tg, w, [4.6, OK.deck, -6.25], yawTo(0, 1), 2, { until: (s) => s.pos.z > -4.2 });
  check(Math.abs(r.y - OK.deck) < 0.05 && r.z > -4.3, `merdiven sahanlığından sur ağzından güverteye (z ${r.z.toFixed(1)})`);
  r = walk(tg, w, [1.6, 0, 6.25], yawTo(-1, 0), 5, { until: (s) => s.pos.x < -4.6 });
  check(Math.abs(r.y - OK.deck) < 0.05, `kale güney merdiveni 0 → 3 m (${r.t.toFixed(1)} sn)`);
  r = walk(tg, w, [2.55, OK.deck, 4.2], yawTo(0, -1), 4, { until: (s) => s.pos.z < -0.9 });
  check(Math.abs(r.y - (OK.turret)) < 0.05, `gözcü merdiveni 3 → 5,64 m (${r.t.toFixed(1)} sn, y ${r.y.toFixed(2)})`);
  r = walk(tg, w, [2.55, OK.turret, -0.8], yawTo(-1, 0), 3, { until: (s) => s.pos.x < 0 });
  check(Math.abs(r.y - OK.turret) < 0.05 && r.x < 0.1, 'sahanlıktan gözcü tepesine girilir');
  r = walk(tg, w, [-3.0, 0, -8.5], yawTo(0, 1), 3, { until: (s) => s.pos.z > -3.0 });
  check(r.z > -3.1 && r.high < 0.1, `kuzey kapısından kale içine (z ${r.z.toFixed(1)})`);
  r = walk(tg, w, [16.2, 0, 27.4], yawTo(0, -1), 5, { until: (s) => s.pos.z < 21.2 });
  check(Math.abs(r.y - 3.6) < 0.05, `gözetleme kulesi merdiveni 0 → 3,6 m (${r.t.toFixed(1)} sn)`);
  r = walk(tg, w, [16.2, 3.6, 21.0], yawTo(1, 0), 2, { until: (s) => s.pos.x > 18.6 });
  check(Math.abs(r.y - 3.6) < 0.05 && r.x > 18.5, 'sahanlıktan kule platformuna');
  for (const [nm, x] of [['batı', -17], ['orta', 3], ['doğu', 13]]) {
    const z0 = creekZ(x) - 4.6, z1 = creekZ(x) + 4.6;
    r = walk(tg, w, [x, 0, z0], yawTo(0, 1), 4, { until: (s) => s.pos.z > z1 });
    check(r.z > z1 - 0.1 && r.low > 0.1 - 0.2, `${nm} köprüsü: uçtan uca, kuru (en düşük y ${r.low.toFixed(2)})`);
  }
  r = walk(tg, w, [-10, 0, creekZ(-10) - 5], yawTo(0, 1), 5, { until: (s) => s.pos.z > creekZ(-10) + 5 });
  check(r.z > creekZ(-10) + 4.9 && r.low < -0.8, `dereden yürüyerek geçilir (taban ${r.low.toFixed(2)}, ${r.t.toFixed(1)} sn)`);
  r = walk(tg, w, [-6.0, 0, creekZ(-6) - 5], yawTo(0, 1), 2, {});
  check(r.z < creekZ(-6) - 3.5 && r.high < 0.05, `devrik kütük siper: yürüyen kıyıda durur (z ${(r.z - creekZ(-6)).toFixed(1)})`);
  r = walk(tg, w, [-6.0, 0, creekZ(-6) - 5], yawTo(0, 1), 1.2, { jump: true });
  check(r.high > 0.6, `devrik kütüğe zıplayarak çıkılır (en yüksek ${r.high.toFixed(2)})`);
}

// ── 6. sızıntı: dört yönde çite / köşelere yürüyen dışarı çıkamaz ──
{ let out = 0;
  for (let a = 0; a < 16; a++) {
    const yaw = a / 16 * Math.PI * 2, r = walk(tg, w, [0.0 + Math.sin(a) * 9, 0, 0.0 + Math.cos(a) * 9], yaw, 9, {});
    if (Math.abs(r.x) > OK.fence || Math.abs(r.z) > OK.fence || r.y < -1.2) out++;
  }
  for (const [x, z] of [[-27, creekZ(-27)], [27, creekZ(27)]]) { const r = walk(tg, w, [x * 0.9, -0.9, z], yawTo(Math.sign(x), 0), 3, {}); if (Math.abs(r.x) > OK.fence) out++; }
  check(!out, `çitten / dere ağzından dışarı çıkılamaz (${out} sızıntı)`); }

// ── 7. bot katlar arasında: hedef verilen tek bot kale güvertesine, gözcü tepesine ve gözetleme kulesine yürür (yol + merdiven) ──
{ const bg = mk(3, 0), s = solo(bg), br = bg.brains[0];
  br.roam = () => {};
  for (const [nm, x, z, y] of [['kale güvertesi', -3.8, -3.8, 3.0], ['gözcü tepesi', 0.4, 0.2, 5.64], ['gözetleme kulesi', 18.8, 21.3, 3.6], ['kulübe içi', -19.0, -19.4, 0]]) {
    br.setGoal(x, z, 90, y);
    let t = -1;
    for (let i = 0; i < 30 * 70 && t < 0; i++) { bg.step(1 / 30); if (br.goalT < 30) br.goalT = 60; if (Math.abs(s.pos.y - y) < 0.2 && Math.hypot(s.pos.x - x, s.pos.z - z) < 1.6) t = i / 30; }
    check(t >= 0 && s.deaths === 0, `bot ${nm} hedefine vardı (${t.toFixed(0)} sn; şu an ${s.pos.x.toFixed(1)}, ${s.pos.y.toFixed(2)}, ${s.pos.z.toFixed(1)})`);
  }
}

// ── 8. 8 botlu maç: biter, kazanan var; katlar kullanılır; herkes alanda ──
{ const mg = mk(8, 900);
  let n = 0, hi = 0, wet = 0, outB = 0, kal = 0;
  const t1 = performance.now();
  for (let i = 0; i < 30 * 900 && !mg.ended; i++) {
    mg.step(1 / 30);
    if (i % 15 === 0) for (const s of mg.soldiers) if (s.alive) { n++; if (s.pos.y > 2.5) hi++; if (Math.abs(s.pos.x) < 7.2 && Math.abs(s.pos.z) < 7.2) kal++; if (s.pos.y < -0.4) wet++; if (Math.abs(s.pos.x) > OK.fence || Math.abs(s.pos.z) > OK.fence || s.pos.y < -1.5) outB++; }
  }
  const S = mg.soldiers, kills = S.reduce((a, s) => a + s.kills, 0), deaths = S.reduce((a, s) => a + s.deaths, 0);
  const best = [...S].sort((a, b) => b.kills - a.kills)[0];
  console.log(`      maç: ${(mg.time / 60).toFixed(1)} dk · adım ${((performance.now() - t1) / (mg.time * 30)).toFixed(2)} ms · öldürme ${kills} · ölüm ${deaths} · yüksek kat %${(hi / n * 100).toFixed(0)} · kale çevresi %${(kal / n * 100).toFixed(0)} · derede %${(wet / n * 100).toFixed(1)}`);
  check(mg.ended && best.kills >= LIMITS.pbKills && mg.winner === best.team, `maç bitti: ${mg.endReason}`);
  check(hi > n * 0.01 && kal > n * 0.08, `botlar kaleyi ve yüksek katları kullanıyor (yüksek %${(hi / n * 100).toFixed(1)}, kale %${(kal / n * 100).toFixed(0)})`);
  check(!outB && S.every((s) => Number.isFinite(s.pos.x + s.pos.y + s.pos.z)), 'herkes alanın içinde, konumlar geçerli');
}
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
