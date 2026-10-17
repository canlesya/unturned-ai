// Boya Kulesi + Paintball modu başsız testi: node scripts/pbmap.mjs   (tarayıcı / sunucu gerekmez)
// Kurulum, doğuşlar (zeminde, geometrinin içinde değil), köprü / iskele / balkon yolu yürünür, merdiven ve minder zeminden kaleye çıkarır,
// kuyuya düşen ≤ 3 sn'de elenir (son vurana "düşürdü") ve doğar, botlar orta kata ve kule tepesine çıkar, 8 botlu maç kazananla biter.
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { Game } from '../src/game/game.js';
import { applyInput } from '../src/sim/input.js';
import { PB_LOADOUT } from '../src/game/match.js';
import { LIMITS } from '../src/game/balance.js';
import { H_STAND } from '../src/game/collision.js';

let fail = 0;
const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const rot = (k, x, z) => { for (let i = 0; i < k; i++) [x, z] = [-z, x]; return [x, z]; };
const mk = (per = 8, time = 900) => new Game(null, { headless: true, map: 'boyakulesi', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type: 'pb', time } });
const solo = (g) => { for (const s of g.soldiers.slice(1)) { s.vacant = true; s.alive = false; } g.brains = g.brains.filter((b) => b.s === g.soldiers[0]); return g.soldiers[0]; };

// ── 1. kurulum ──
const t0 = performance.now();
const g = mk();
const m = g.map;
console.log(`      kurulum ${(performance.now() - t0).toFixed(0)} ms · çarpışma ${m.colliders.length} · nav katlı ${!!g.nav.K}`);
check(g.mode.type === 'pb' && g.ffa && g.mode.fixed && g.mode.killLimit === LIMITS.pbKills, `mod pb (herkes tek, sabit teçhizat, hedef ${g.mode.killLimit})`);
check(m.colliders.length > 400 && m.colliders.every((c) => c.min.every((v, i) => v < c.max[i])), 'çarpışma kutuları geçerli');
const lo = PB_LOADOUT();
check(g.soldiers.every((s) => s.items.map((i) => i.id).join() === lo.join()), `teçhizat: ${lo.join(' + ')} (gadget yok)`);
check(m.colliders.filter((c) => c.tag === 'pad' && c.pad).length >= 4, 'iki zıplama minderi (pad etiketli, fırlatma vektörlü)');

// ── 2. doğuşlar ──
const W = g.world;
const solidUnder = (x, y, z) => (y < 0.05 && W.heightAt(x, z) === 0) || m.colliders.some((c) => Math.abs(c.max[1] - y) < 0.06 && x + 0.32 > c.min[0] && x - 0.32 < c.max[0] && z + 0.32 > c.min[2] && z - 0.32 < c.max[2]);
let badSp = [];
for (const p of m.ffaSpawns) {
  const list = W.query(p.x - 1, p.z - 1, p.x + 1, p.z + 1, []);
  const inside = W._hits(list, p.x, (p.y || 0) + 0.01, p.z, H_STAND);
  if (inside || !solidUnder(p.x, p.y || 0, p.z) || !g.nav.safeAt(p.x, p.y || 0, p.z)) badSp.push([p.x, p.y, p.z, inside && inside.oid]);
}
check(m.ffaSpawns.length >= 8 && !badSp.length, `${m.ffaSpawns.length} doğuş: hepsi zeminde / güvertede, geometrinin içinde değil ${badSp.length ? JSON.stringify(badSp) : ''}`);
check(m.ffaSpawns.filter((p) => p.y > 8).length >= 4 && m.ffaSpawns.filter((p) => !p.y).length >= 4, 'doğuşlar zemine ve kale güvertelerine dağılmış');
g.respawn(g.soldiers[3], false);
check(g.soldiers.every((s) => s.alive && s.pos.y >= -0.01), 'maç başı herkes doğdu, kuyuda kimse yok');

// ── 3. yürüyüş testleri (applyInput + World.move, 60 Hz, oyuncuyla aynı fizik) ──
function walk(g, s, from, yaw, secs, { minY = -1e9, until } = {}) {
  s.alive = true; s.protT = 99; s.pos.set(from[0], from[1], from[2]); s.vel.set(0, 0, 0); s.yaw = yaw; s.onGround = true; s.launchT = 0;
  let low = 1e9, t = 0;
  for (; t < secs; t += 1 / 60) {
    g.world.move(s, 1 / 60);
    applyInput(s, { f: 1, r: 0, lean: 0, sprint: false, jump: false }, 1 / 60);
    if (t > 0.1) low = Math.min(low, s.pos.y);
    if (until && until(s)) break;
  }
  return { x: s.pos.x, y: s.pos.y, z: s.pos.z, low, t, okY: low >= minY };
}
const tg = mk(2, 0), w = solo(tg);
tg.brains.length = 0;
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
for (let k = 0; k < 4; k++) {                                         // köprüler: kale kanadı → kule kapısı (11 m, korkuluksuz)
  const [ax, az] = rot(k, -14.6, -2.9), [bx, bz] = rot(k, -4.4, -2.9);
  const r = walk(tg, w, [ax, 9, az], yawTo(bx - ax, bz - az), 4, { until: (s) => Math.hypot(s.pos.x - bx, s.pos.z - bz) < 0.4 });
  check(r.okY && Math.hypot(r.x - bx, r.z - bz) < 0.5 && r.low > 8.9, `köprü ${['turuncu', 'mor', 'turkuaz', 'mavi'][k]}: uçtan uca yürünür (${r.t.toFixed(1)} sn, en düşük y ${r.low.toFixed(2)})`);
}
for (const [nm, a, b] of [['kuzey iskelesi', [-14.6, -22.9], [14.6, -22.9]], ['doğu iskelesi', [22.9, -14.6], [22.9, 14.6]]]) {
  const r = walk(tg, w, [a[0], 9, a[1]], yawTo(b[0] - a[0], b[1] - a[1]), 8, { until: (s) => Math.hypot(s.pos.x - b[0], s.pos.z - b[1]) < 0.4 });
  check(Math.hypot(r.x - b[0], r.z - b[1]) < 0.5 && r.low > 8.9, `${nm}: uçtan uca yürünür (${r.t.toFixed(1)} sn)`);
}
{ const r = walk(tg, w, [5.0, 9, -14.6], yawTo(0, 1), 5, { until: (s) => s.pos.z > -5.0 });
  check(r.y > 13.4 && r.z > -5.2 && r.low > 8.9, `balkon yolu: mor kanattan balkona (y ${r.y.toFixed(2)}, ${r.t.toFixed(1)} sn)`); }
for (let k = 0; k < 4; k++) {                                         // zemin merdiveni → kale güvertesi
  const [ax, az] = rot(k, -24.3, 1.0), [dx, dz] = rot(k, 0, -1);
  const r = walk(tg, w, [ax, 0, az], yawTo(dx, dz), 5, { until: (s) => s.pos.y > 8.95 && Math.abs(s.pos.y - 9) < 0.05 && (k ? true : s.pos.z < -15.2) });
  check(Math.abs(r.y - 9) < 0.05, `zemin merdiveni ${['turuncu', 'mor', 'turkuaz', 'mavi'][k]}: 0 → 9 m (${r.t.toFixed(1)} sn)`);
}
{ // kule: giriş katı → iç merdiven → balkon (doğu kapısı) ; üst kat → iç merdiven → tepe
  let r = walk(tg, w, [-3.3, 9, 0], yawTo(1, 0), 4, { until: (s) => s.pos.x > 3.9 });
  check(Math.abs(r.y - 13.5) < 0.05 && r.x > 3.8, `kule iç merdiveni 9 → 13,5 m, doğu kapısından balkona (x ${r.x.toFixed(1)})`);
  r = walk(tg, w, [-2.85, 13.5, 2.4], yawTo(1, 0), 4, { until: (s) => s.pos.x > 2.85 });
  check(Math.abs(r.y - 18) < 0.05, `kule üst merdiveni 13,5 → 18 m tepe (${r.t.toFixed(1)} sn)`);
}
{ // minder: turuncu minderin üstüne yürü → fırla → kanada in
  const s = w; s.alive = true; s.pos.set(-9.6, 0, -8.5); s.vel.set(0, 0, 0); s.yaw = yawTo(-1, 0); s.onGround = true; s.launchT = 0;
  let top = 0, launched = false;
  for (let t = 0; t < 4; t += 1 / 60) { tg.world.move(s, 1 / 60); applyInput(s, { f: s.launchT > 0 || launched ? 0 : 1, r: 0, lean: 0, sprint: false, jump: false }, 1 / 60); if (s.launchT > 0) launched = true; top = Math.max(top, s.pos.y); }
  check(launched && Math.abs(s.pos.y - 9) < 0.05 && s.pos.x < -15 && s.pos.x > -18.6, `minder: zeminden fırlatır (tepe ${top.toFixed(1)} m), turuncu kanada iner (${s.pos.x.toFixed(1)}, ${s.pos.y.toFixed(2)})`);
  s.pos.set(9.6, 0, 8.5); s.vel.set(0, 0, 0); s.yaw = yawTo(1, 0); s.onGround = true; s.launchT = 0; launched = false;
  for (let t = 0; t < 4; t += 1 / 60) { tg.world.move(s, 1 / 60); applyInput(s, { f: s.launchT > 0 || launched ? 0 : 1, r: 0, lean: 0, sprint: false, jump: false }, 1 / 60); if (s.launchT > 0) launched = true; }
  check(launched && Math.abs(s.pos.y - 9) < 0.05 && s.pos.x > 15 && s.pos.x < 18.6, `minder: turkuaz kanada iner (${s.pos.x.toFixed(1)}, ${s.pos.y.toFixed(2)})`);
}

// ── 4. kuyu: düşen elenir, doğar; son 5 sn'de vuran "düşürdü" alır ──
{
  const pg = mk(2, 0); pg.brains.length = 0;
  const [a, b] = pg.soldiers;
  const d0 = a.deaths;
  a.protT = 0; a.pos.set(0, 0, -11.6); a.vel.set(0, 0, 0); a.yaw = yawTo(0, 1); a.onGround = true;
  b.pos.set(20, 0, 20);
  let tDie = -1;
  for (let t = 0; t < 6; t += 1 / 30) {
    if (a.alive && tDie < 0) applyInput(a, { f: 1, r: 0, lean: 0, sprint: false, jump: false }, 1 / 30);
    else a.vel.x = a.vel.z = 0;
    pg.step(1 / 30);
    if (!a.alive && tDie < 0) tDie = t;
  }
  check(tDie > 0 && tDie < 3 && a.deaths === d0 + 1 && b.kills === 0, `kuyuya yürüyen ${tDie.toFixed(2)} sn'de elendi (ölüm +1, kimseye öldürme yok)`);
  for (let t = 0; t < 5 && !a.alive; t += 1 / 30) pg.step(1 / 30);
  check(a.alive && a.pos.y >= -0.01 && pg.map.ffaSpawns.some((p) => Math.hypot(p.x - a.pos.x, p.z - a.pos.z) < 1 && Math.abs((p.y || 0) - a.pos.y) < 0.1), `~3 sn sonra doğuş noktasında yeniden doğdu (${a.pos.x.toFixed(1)}, ${a.pos.y.toFixed(1)}, ${a.pos.z.toFixed(1)})`);
  a.protT = 0; a.pos.set(-9.5, 9, -2.9); a.vel.set(0, 0, 0); a.lastHit = b; a.lastDmgT = pg.time;     // köprüde vurulup kuyuya
  a.pos.x = -9.5; a.pos.z = -2.0 + 0.5;
  for (let t = 0; t < 4 && a.alive; t += 1 / 30) pg.step(1 / 30);
  check(!a.alive && b.kills === 1, 'köprüden kuyuya düşürülen: öldürme son vurana yazıldı');
}

// ── 5. botlar katlar arasında: tek bot orta kata ve tepeye çıkar ──
{
  const bg = mk(3, 0), s = solo(bg);
  let mid = -1, top = -1;
  for (let i = 0; i < 30 * 360 && top < 0; i++) { bg.step(1 / 30); if (s.alive && s.pos.y > 8.5 && mid < 0) mid = i / 30; if (s.alive && s.pos.y > 17.8) top = i / 30; }
  check(mid >= 0 && mid < 60, `bot orta kata çıktı (${mid.toFixed(0)} sn)`);
  check(top >= 0, `bot kule tepesine çıktı (${top.toFixed(0)} sn, sınır 6 dk)`);
  check(s.deaths === 0, 'tek bot hiç kuyuya düşmedi');
}

// ── 6. 8 botlu maç: biter, kazanan var; botlar katları kullanır; kuyuya sürekli düşmezler ──
{
  const mg = mk(8, 900);
  let voids = 0, mid = 0, bal = 0, top = 0, n = 0;
  const ok0 = mg.onKill.bind(mg); mg.onKill = (k, v, wn, h) => { if (/Kuyu/.test(wn)) voids++; return ok0(k, v, wn, h); };
  const t1 = performance.now();
  for (let i = 0; i < 30 * 900 && !mg.ended; i++) {
    mg.step(1 / 30);
    if (i % 15 === 0) for (const s of mg.soldiers) if (s.alive) { n++; if (s.pos.y > 17.5) top++; else if (s.pos.y > 13) bal++; else if (s.pos.y > 8.5) mid++; }
  }
  const S = mg.soldiers, kills = S.reduce((a, s) => a + s.kills, 0), deaths = S.reduce((a, s) => a + s.deaths, 0);
  const best = [...S].sort((a, b) => b.kills - a.kills)[0];
  console.log(`      maç: ${(mg.time / 60).toFixed(1)} dk · adım ${((performance.now() - t1) / (mg.time * 30)).toFixed(2)} ms · öldürme ${kills} · ölüm ${deaths} · kuyu ${voids} · kat payı orta ${(mid / n * 100).toFixed(0)}% balkon ${(bal / n * 100).toFixed(0)}% tepe ${(top / n * 100).toFixed(1)}%`);
  check(mg.ended && best.kills >= LIMITS.pbKills && mg.winner === best.team, `maç bitti: ${mg.endReason}`);
  check(mid > n * 0.15, 'botlar orta katta savaşıyor (balkon / tepe payı yukarıda; tek botla tepe ayrıca sınandı)');
  check(voids <= deaths * 0.15, `kuyuya düşme makul (${voids}/${deaths})`);
  check(S.every((s) => Number.isFinite(s.pos.x + s.pos.y + s.pos.z)), 'konumlar geçerli');
}
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
