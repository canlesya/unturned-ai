// Cephe modu + Batı Cephesi denetimi (başsız, hızlı):  node scripts/fronttest.mjs [ws://127.0.0.1:PORT]
// Harita: her aşamada doğuştan etkin noktalara / mevzilere / kapaklara / kanat rotalarına ulaşılabilirlik (nav bölgesi), doğuş noktası çarpışma kutusunda değil,
//   iki takımın doğuşları birbirini görmez (göz → göz), siper içi yürünebilir (fizikle: her siper parçası boyunca yürü, görünmez duvar yok),
//   ateş basamağında durulur (ayakta göz korkuluğun üstünde, çömelik altında), rampadan çıkılır, arka duvardan zıplayarak çıkılmaz, sınır dışı sızıntı 0.
// Kural: kilitli sektör alınmaz, sektör düşer, doğuş kayar, bilet ödülü, bilet / süre / son sektör kazananları. URL verilirse çevrim içi: iki istemci aynı sektörü görür.
import * as THREE from 'three';
import { MapBuilder } from '../src/maps/builder.js';
import { Game } from '../src/game/game.js';
import { TUNE } from '../src/game/balance.js';
import { FLOOR, FSTEP } from '../src/maps/cephe.js';
MapBuilder.noVisual = true;
const ok = [], bad = [];
const chk = (c, m) => (c ? ok : bad).push(m);
const mk = (o = {}) => new Game(null, { headless: true, map: 'cephe', diff: 'normal', match: { perTeam: 8, type: 'front', time: 1200 }, bots: o.bots !== false });
const g = mk({ bots: false });
const nav = g.nav, W = g.world, T = g.map.terrain, F = g.map.front, cm = nav.comps(0.7);
const comp = (x, z) => { const i = nav.nearestFree(x, z, 2); return i < 0 ? -1 : cm[i]; };

// ── 1. ulaşılabilirlik (aşama başına) ──
F.stages.forEach((S, si) => {
  const cb = comp(S.blue[0].x, S.blue[0].z), cr = comp(S.red[0].x, S.red[0].z);
  const sb = S.blue.filter((p) => comp(p.x, p.z) !== cb).length, sr = S.red.filter((p) => comp(p.x, p.z) !== cr).length;
  chk(!sb && !sr, `aşama ${si + 1}: doğuşlar tek bölgede (Mavi ${S.blue.length}, Kırmızı ${S.red.length}, kopuk ${sb}/${sr})`);
  const objs = g.mode.objectives.filter((o) => F.sectors[si].objs.includes(o.id));
  const ro = objs.filter((o) => comp(o.x, o.z) !== cb || comp(o.x, o.z) !== cr).map((o) => o.id);
  chk(!ro.length, `aşama ${si + 1}: noktalar iki doğuştan ulaşılır ${ro.join(',')}`);
  const H = F.hints[si];
  const badH = H.hold.filter((h) => comp(h.x, h.z) !== cr || Math.abs(nav.floorAt(h.x, h.z) - h.y) > 0.35).map((h) => `${h.kind}@${h.x},${h.z}(${nav.floorAt(h.x, h.z).toFixed(2)})`);
  chk(!badH.length, `aşama ${si + 1}: ${H.hold.length} savunma mevzisi ulaşılır + kot doğru ${badH.join(' ')}`);
  const badC = H.cover.filter(([x, z]) => comp(x, z) !== cb).map(([x, z]) => `${x},${z}`);
  const badF = H.flank.flat().filter(([x, z]) => comp(x, z) !== cb).map(([x, z]) => `${x},${z}`);
  chk(!badC.length && !badF.length, `aşama ${si + 1}: saldıran kapak / kanat noktaları ulaşılır ${badC.join(' ')} ${badF.join(' ')}`);
  const inCol = [...S.blue, ...S.red].filter((p) => W.colliders.some((c) => p.x > c.min[0] && p.x < c.max[0] && p.z > c.min[2] && p.z < c.max[2] && c.max[1] > T.heightAt(p.x, p.z) + 0.3 && c.min[1] < T.heightAt(p.x, p.z) + 1.8)).length;
  chk(!inCol, `aşama ${si + 1}: doğuş noktası kutu içinde değil (${inCol})`);
  // doğuşlar birbirini görmez (ayakta göz → ayakta göz)
  let seen = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const p of S.blue) for (const q of S.red) {
    if (Math.hypot(p.x - q.x, p.z - q.z) > 160) continue;
    a.set(p.x, T.heightAt(p.x, p.z) + 1.62, p.z); b.set(q.x, T.heightAt(q.x, q.z) + 1.62, q.z);
    if (W.clear(a, b)) { seen++; if (seen <= 3) console.log(`   görüş: M ${p.x},${p.z} ↔ K ${q.x},${q.z}`); }
  }
  chk(!seen, `aşama ${si + 1}: doğuşlar birbirini görmez (${seen} çift)`);
  const d = (P) => Math.min(...objs.map((o) => Math.hypot(o.x - P.x, o.z - P.z)));
  const db = S.blue.reduce((m, p) => m + d(p), 0) / S.blue.length, dr = S.red.reduce((m, p) => m + d(p), 0) / S.red.length;
  console.log(`  aşama ${si + 1}: doğuştan en yakın noktaya ortalama Mavi ${db.toFixed(0)} m, Kırmızı ${dr.toFixed(0)} m`);
  if (si === 0) chk(db < 60, `aşama 1: Mavi'nin ilk yürüyüşü ≤ 60 m (${db.toFixed(0)} m)`);
});

// siper üstünde yüzen kutu yok (tabanı siper tabanından yüksek, baş hizasında; kenar taşmaları 0,3 m içte sayılmaz)
{
  const fl = [];
  for (const c of W.colliders) {
    if (c.max[0] - c.min[0] < 0.65 || c.max[2] - c.min[2] < 0.65) continue;
    for (let x = c.min[0] + 0.3; x <= c.max[0] - 0.3; x += 0.5) for (let z = c.min[2] + 0.3; z <= c.max[2] - 0.3; z += 0.5) {
      const h = T.heightAt(x, z);
      if (h < -0.5 && c.min[1] > h + 0.25 && c.min[1] < h + 2.1) { fl.push(`${c.oid}@${x.toFixed(1)},${z.toFixed(1)}`); x = 1e9; break; }
    }
  }
  chk(!fl.length, `siper üstünde yüzen kutu yok (${fl.length}: ${fl.slice(0, 8).join(' ')})`);
}
// ── 2. fizik: siper içi yürüme, ateş basamağı, rampa, arka duvar, sızıntı ──
const s = g.soldiers[0]; s.alive = true; s.fly = false; s.protT = 1e9;
const walk = (x, z, dx, dz, dist, sprint = 1) => {
  s.pos.set(x, T.heightAt(x, z), z); s.vel.set(0, 0, 0); s.onGround = true; W.settle(s);
  const L = Math.hypot(dx, dz), sp = TUNE.walkSpeed * sprint;
  for (let t = 0; t < dist / sp + 1.2; t += 1 / 60) {
    s.vel.x = dx / L * sp; s.vel.z = dz / L * sp; W.move(s, 1 / 60);
    if (Math.hypot(s.pos.x - x, s.pos.z - z) >= dist) break;
  }
  return Math.hypot(s.pos.x - x, s.pos.z - z);
};
let segOk = 0, segBad = [];
for (const q of g.map.trenches) {
  const [x0, z0, x1, z1] = q, horiz = x1 - x0 > z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const L = (horiz ? x1 - x0 : z1 - z0) - 2.6;
  if (L < 3) continue;
  const sx = horiz ? x0 + 1.3 : cx, sz = horiz ? cz : z0 + 1.3;
  if (T.heightAt(sx, sz) > -0.5) continue;
  // ateş basamağı / sığınak eşyası olmayan orta çizgiden yürü
  let best = 0;
  for (const off of (z1 - z0 > 3 && x1 - x0 > 3 ? [0, 0.95, -0.95] : [0])) {                 // 4 m siperde orta + iki yan çizgi (sığınak perdesi / basamak yanından)
    const ox = horiz ? 0 : off, oz = horiz ? off : 0;
    best = Math.max(best, walk(sx + ox, sz + oz, horiz ? 1 : 0, horiz ? 0 : 1, L));
    if (best >= L - 0.3 && s.pos.y < -0.5) break;
  }
  if (best >= L - 0.3) segOk++; else segBad.push(`${sx},${sz}→${best.toFixed(1)}/${L.toFixed(1)}`);
}
chk(!segBad.length, `siper içi yürünebilir: ${segOk} parça (takılan ${segBad.length}: ${segBad.slice(0, 6).join(' ')})`);
// ateş basamağı: Mavi ateş siperi ön bölmesi (x −7, z 86.4)
s.pos.set(-7, FLOOR + FSTEP + 0.01, 86.4); s.vel.set(0, 0, 0); s.onGround = false;
for (let i = 0; i < 90; i++) W.move(s, 1 / 60);
const stepY = s.pos.y;
chk(Math.abs(stepY - (FLOOR + FSTEP)) < 0.03, `ateş basamağında duruluyor (y ${stepY.toFixed(2)})`);
const par = W.colliders.filter((c) => c.oid?.startsWith('korkuluk') && -7 > c.min[0] && -7 < c.max[0] && c.max[2] <= 86.01 && c.min[2] > 84.5).map((c) => c.max[1]);
const parTop = Math.max(...par);
chk(stepY + 1.62 > parTop + 0.2 && stepY + 1.16 < parTop + 0.02, `basamakta ayakta göz korkuluğun ≥ 20 cm üstünde, çömelik saklı (göz ${(stepY + 1.62).toFixed(2)} / ${(stepY + 1.16).toFixed(2)}, korkuluk ${parTop.toFixed(2)})`);
// basamaktan zıplayarak tarlaya çıkılır (korkuluk boşluğu yoksa korkuluğun üstüne)
// rampa: ilk rampadan çıkış
const rp = g.map.front.ramps?.[0];
if (rp) { const dz = rp.dir === 2 ? 1 : -1, got = walk(rp.x, rp.z - dz * 2.2, 0, dz, 4.5); chk(s.pos.y > -0.3, `rampadan tarlaya çıkılır (y ${s.pos.y.toFixed(2)}, ${got.toFixed(1)} m)`); }
// arka duvar: Mavi destek siperi (z 104) içinde arkaya (güney, +z) zıpla-yürü → tarlaya çıkamaz
s.pos.set(-40, FLOOR, 104); s.vel.set(0, 0, 0); s.onGround = true;
for (let i = 0; i < 120; i++) { if (s.onGround) s.vel.y = TUNE.jumpSpeed; s.vel.z = 4; W.move(s, 1 / 60); }
chk(s.pos.y < -1 && s.pos.z < 106.1, `arka duvardan zıplayarak çıkılmaz (y ${s.pos.y.toFixed(2)}, z ${s.pos.z.toFixed(2)})`);
// sınır: kenara koşan dışarı çıkamaz
walk(70, 0, 1, 0, 40); chk(s.pos.x <= g.map.bounds.maxX + 0.01, `sınır dışı sızıntı yok (x ${s.pos.x.toFixed(1)})`);
walk(0, -140, 0, -1, 40); chk(s.pos.z >= g.map.bounds.minZ - 0.01, `kuzey sınırı (z ${s.pos.z.toFixed(1)})`);

// ── 3. kurallar ──
{
  const G = mk({ bots: false }), blue = G.soldiers.filter((x) => x.team === 'blue');
  for (const x of G.soldiers) { x.alive = false; x.respawnT = 1e9; }
  const put = (x, o) => { x.alive = true; x.pos.set(o.x, G.world.heightAt(o.x, o.z), o.z); x.vel.set(0, 0, 0); };
  const C = G.mode.objectives.find((o) => o.id === 'C'), A = G.mode.objectives.find((o) => o.id === 'A'), B = G.mode.objectives.find((o) => o.id === 'B');
  blue.forEach((x) => put(x, C)); for (let i = 0; i < 600; i++) { G.step(1 / 60); blue.forEach((x) => put(x, C)); }
  chk(C.owner === 'red' && C.p === -1, 'kilitli sektör (C) alınmadı');
  const t0 = G.tickets.blue, r0 = G.map.spawns.red;
  let t = 0; for (; t < 3600 && G.front.sector === 0; t++) { G.step(1 / 60); blue.forEach((x, j) => put(x, j % 2 ? A : B)); }
  chk(G.front.sector === 1, `sektör 1 düştü (${(t / 60).toFixed(1)} sn, 4+4 kişi)`);
  chk(G.map.spawns.red !== r0 && G.map.spawns.red === F.stages[1].red && G.map.spawns.blue === F.stages[1].blue, 'doğuşlar 2. aşamaya kaydı');
  chk(G.tickets.blue === t0 + Math.round(G.front.t0 * TUNE.frBonus), `bilet ödülü +${Math.round(G.front.t0 * TUNE.frBonus)}`);
  A.owner = 'red'; A.p = -1; G.step(1 / 60);
  chk(A.owner === 'red', 'geçilen sektör kilitli (geri alma etkisiz değil: döngüde güncellenmez)');
  G.tickets.blue = 0; G.step(1 / 60); chk(G.ended && G.winner === 'red', 'bilet bitti → Kırmızı');
  const G2 = mk({ bots: false }); G2.timeLeft = 0.01; G2.step(1 / 60); G2.step(1 / 60); chk(G2.ended && G2.winner === 'red', 'süre bitti → Kırmızı');
  const G3 = mk({ bots: false }); while (G3.front.sector < 3) G3.front.advance(true); for (const o of G3.front.active()) { o.owner = 'blue'; o.p = 1; } G3.step(1 / 60); chk(G3.ended && G3.winner === 'blue', 'son sektör → Mavi');
  const G4 = mk({ bots: false }); chk(G4.soldiers.every((x) => x.items[0].id.startsWith('ww_') && x.items[1].id === 'ww_pistol'), 'donanım yalnız 1940\'lar');
  chk(G4.soldiers.filter((x) => x.team === 'red' && x.cls === 'heavy').every((x) => x.items[0].id === 'ww_mg') && G4.soldiers.filter((x) => x.team === 'blue' && x.cls === 'heavy').every((x) => x.items[0].id === 'ww_lmg'), 'ağır destek: Mavi BAR tarzı, Kırmızı MG42 tarzı');
}

// ── 4. çevrim içi (isteğe bağlı) ──
const url = process.argv[2];
if (url) {
  const { default: WebSocket } = await import('ws');
  const open = (msg) => new Promise((res, rej) => { const ws = new WebSocket(url); const st = { ws, snaps: 0, fr: null, tk: null }; ws.on('open', () => ws.send(JSON.stringify(msg))); ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'welcome') { st.welcome = m; res(st); } if (m.t === 'snap') { st.snaps++; st.fr = m.fr; st.tk = m.tk; } }); ws.on('error', rej); setTimeout(() => rej(new Error('zaman aşımı')), 20000); });
  const a = await open({ t: 'create', name: 'A', cfg: { type: 'front', map: 'cephe', perTeam: 8, bots: true } });
  const room = a.welcome.room;
  const b = await open({ t: 'join', room, name: 'B' });
  await new Promise((r) => setTimeout(r, 1500));
  chk(a.welcome.cfg?.type === 'front' && a.welcome.cfg?.map === 'cephe', `çevrim içi oda: ${a.welcome.cfg?.type} / ${a.welcome.cfg?.map}`);
  chk(a.fr && a.fr[0] === 0 && b.fr && b.fr[0] === 0, `iki istemci sektör 1 (${JSON.stringify(a.fr)} ${JSON.stringify(b.fr)})`);
  a.ws.send(JSON.stringify({ t: 'dbg', frs: 2 }));
  await new Promise((r) => setTimeout(r, 1200));
  chk(a.fr[0] === 2 && b.fr[0] === 2 && a.tk[1] === 2, `debug ile 2 sektör ileri: iki istemci aynı (${a.fr} ${b.fr}, kalan ${a.tk[1]})`);
  a.ws.close(); b.ws.close();
}
for (const m of ok) console.log('OK  ', m);
for (const m of bad) console.log('HATA', m);
console.log(bad.length ? `sonuç: ${bad.length} HATA` : `sonuç: OK (${ok.length})`);
process.exit(bad.length ? 1 : 0);
