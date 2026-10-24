// Cephe modu (12.161 Cephe Hattı) + Batı Cephesi denetimi (başsız, hızlı):  node scripts/fronttest.mjs [ws://127.0.0.1:PORT]
// Harita: her etkin nokta aşamasında (0..6) iki takımın doğuşu tek bölgede, etkin noktaya ve o takımın mevzilerine ulaşılır, doğuş kutu içinde değil,
//   iki takımın doğuşları birbirini görmez, doğuşlar etkin noktadan (çoğunlukla) görünmez, yürüme yolları dengeli (ara aşamalarda fark ≤ 25 m), üs bölgesi
//   etkin noktaya değmez; siper içi yürünebilir (fizik), ateş basamağı, rampa, arka duvar, sınır sızıntısı. (Duvar itme testi ayrı: scripts/frontwalls.mjs)
// Kural: başta yalnız ORTA etkin ve kimsenin; kilitli nokta alınmaz; alan cepheyi iter (iki yön), doğuşlar kayar, nokta farkı kanaması, karargâhla kazanma (iki taraf),
//   bilet / süre kazananları, donanım. URL verilirse çevrim içi: iki istemci aynı etkin noktayı görür, debug ile kaydırılır.
import * as THREE from 'three';
import { MapBuilder } from '../src/maps/builder.js';
import { Game } from '../src/game/game.js';
import { TUNE } from '../src/game/balance.js';
import { FLOOR, FSTEP } from '../src/maps/cephe.js';
import { frontLoadout } from '../src/game/stats.js';
MapBuilder.noVisual = true;
const ok = [], bad = [];
const chk = (c, m) => (c ? ok : bad).push(m);
const mk = (o = {}) => new Game(null, { headless: true, map: 'cephe', diff: 'normal', match: { perTeam: 8, type: 'front', time: 1200 }, bots: o.bots !== false });
const g = mk({ bots: false });
const nav = g.nav, W = g.world, T = g.map.terrain, F = g.map.front, cm = nav.comps(0.7), O = g.mode.objectives;
const comp = (x, z) => { const i = nav.nearestFree(x, z, 2); return i < 0 ? -1 : cm[i]; };
const plen = (p, o) => { const P = nav.findPath(p.x, p.z, o.x, o.z); if (!P) return NaN; let L = 0, x = p.x, z = p.z; for (const q of P) { L += Math.hypot(q.x - x, q.z - z); x = q.x; z = q.z; } return L; };
const med = (a) => { const s = a.filter((v) => Number.isFinite(v)).sort((x, y) => x - y); return s[s.length >> 1] ?? NaN; };
chk(F.chain.length === 7 && F.stages.length === 7, `zincir 7 nokta, 7 doğuş aşaması (${F.chain.join('—')})`);

// ── 1. aşama başına (etkin nokta = zincirin a. noktası) ──
const a3 = new THREE.Vector3(), b3 = new THREE.Vector3();
F.stages.forEach((S, si) => {
  const o = O.find((q) => q.id === F.chain[si]);
  const cb = comp(S.blue[0].x, S.blue[0].z), cr = comp(S.red[0].x, S.red[0].z);
  const sb = S.blue.filter((p) => comp(p.x, p.z) !== cb).length, sr = S.red.filter((p) => comp(p.x, p.z) !== cr).length;
  chk(S.blue.length >= 12 && S.red.length >= 12 && !sb && !sr, `aşama ${si} (${o.id}): doğuşlar tek bölgede (Mavi ${S.blue.length}, Kırmızı ${S.red.length}, kopuk ${sb}/${sr})`);
  chk(comp(o.x, o.z) === cb && comp(o.x, o.z) === cr, `aşama ${si}: etkin nokta ${o.id} iki doğuştan ulaşılır`);
  // mevziler: o takım için süzülen havuz (frontBots ile aynı kural) ulaşılır + kot doğru
  for (const [team, c0, es] of [['blue', cb, -1], ['red', cr, 1]]) {
    const H = F.holds.filter((h) => Math.hypot(h.x - o.x, h.z - o.z) <= 34 && (h.z - o.z) * es <= 8 && (!h.face || h.face === es));
    const badH = H.filter((h) => comp(h.x, h.z) !== c0 || Math.abs(nav.floorAt(h.x, h.z) - h.y) > 0.35).map((h) => `${h.kind}@${h.x},${h.z}(${nav.floorAt(h.x, h.z).toFixed(2)})`);
    chk(!badH.length, `aşama ${si}: ${team} ${H.length} mevzi ulaşılır + kot doğru ${badH.slice(0, 5).join(' ')}`);
  }
  const inCol = [...S.blue, ...S.red].filter((p) => W.colliders.some((c) => p.x > c.min[0] && p.x < c.max[0] && p.z > c.min[2] && p.z < c.max[2] && c.max[1] > T.heightAt(p.x, p.z) + 0.3 && c.min[1] < T.heightAt(p.x, p.z) + 1.8)).length;
  chk(!inCol, `aşama ${si}: doğuş noktası kutu içinde değil (${inCol})`);
  let seen = 0;
  for (const p of S.blue) for (const q of S.red) {
    if (Math.hypot(p.x - q.x, p.z - q.z) > 160) continue;
    a3.set(p.x, T.heightAt(p.x, p.z) + 1.62, p.z); b3.set(q.x, T.heightAt(q.x, q.z) + 1.62, q.z);
    if (W.clear(a3, b3)) { seen++; if (seen <= 3) console.log(`   görüş: M ${p.x},${p.z} ↔ K ${q.x},${q.z}`); }
  }
  chk(!seen, `aşama ${si}: iki takımın doğuşları birbirini görmez (${seen} çift)`);
  // etkin noktadan (merkez ± 6 m, göz) görünen doğuş ≤ %20 (110 m içinde)
  const eyes = [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]].map(([dx, dz]) => new THREE.Vector3(o.x + dx, T.heightAt(o.x + dx, o.z + dz) + 1.62, o.z + dz));
  const vis = (pts) => pts.filter((p) => { b3.set(p.x, T.heightAt(p.x, p.z) + 1.62, p.z); return eyes.some((e) => e.distanceTo(b3) <= 110 && W.clear(e, b3)); }).length;
  const vb = vis(S.blue), vr = vis(S.red);
  chk(vb <= S.blue.length * 0.2 && vr <= S.red.length * 0.2, `aşama ${si}: etkin noktadan görünen doğuş Mavi ${vb}/${S.blue.length}, Kırmızı ${vr}/${S.red.length}`);
  const zb = S.zones.blue, zr = S.zones.red, inZ = (z) => z && o.x + o.r > z.minX && o.x - o.r < z.maxX && o.z + o.r > z.minZ && o.z - o.r < z.maxZ;
  chk(!inZ(zb) && !inZ(zr), `aşama ${si}: üs bölgeleri etkin noktaya değmez`);
  const pick8 = (pts) => pts.filter((_, k) => k % Math.max(1, Math.floor(pts.length / 8)) === 0);
  const lb = med(pick8(S.blue).map((p) => plen(p, o))), lr = med(pick8(S.red).map((p) => plen(p, o)));
  console.log(`  aşama ${si} (${o.id}): yürüme yolu Mavi ${lb.toFixed(0)} m · Kırmızı ${lr.toFixed(0)} m`);
  if (si > 0 && si < 6) chk(Math.abs(lb - lr) <= 25 && lb > 25 && lr > 25 && lb < 110 && lr < 110, `aşama ${si}: yürüme yolları dengeli (${lb.toFixed(0)} / ${lr.toFixed(0)} m)`);
  else chk((si === 0 ? lb < lr : lr < lb), `aşama ${si}: karargâhı savunanın yolu kısa (${lb.toFixed(0)} / ${lr.toFixed(0)} m)`);
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
  const G = mk({ bots: false }), FR = G.front, blue = G.soldiers.filter((x) => x.team === 'blue'), red = G.soldiers.filter((x) => x.team === 'red');
  for (const x of G.soldiers) { x.alive = false; x.respawnT = 1e9; }
  const put = (x, o) => { x.alive = true; x.pos.set(o.x, G.world.heightAt(o.x, o.z), o.z); x.vel.set(0, 0, 0); };
  const P = (id) => G.mode.objectives.find((o) => o.id === id);
  const C = P('C'), D = P('D'), B = P('B');
  chk(FR.a === 3 && FR.active === C && C.owner === null && C.p === 0, 'başta yalnız ORTA (C Köy Meydanı) etkin ve kimsenin');
  chk(FR.chain.slice(0, 3).every((o) => o.owner === 'blue') && FR.chain.slice(4).every((o) => o.owner === 'red'), 'kendi yarısındaki noktalar kendi sahipliğinde (kilitli)');
  chk(G.map.spawns.blue === F.stages[3].blue && G.map.spawns.red === F.stages[3].red, 'başlangıç doğuşları aşama 3');
  blue.slice(0, 4).forEach((x) => put(x, D)); for (let i = 0; i < 600; i++) { G.step(1 / 60); blue.slice(0, 4).forEach((x) => put(x, D)); }
  chk(D.owner === 'red' && D.p === -1 && FR.a === 3, 'kilitli nokta (D) alınmadı');
  const run = (team, o, n = 4, lim = 90) => { const L = (team === 'blue' ? blue : red).slice(0, n); let t = 0; const a0 = FR.a; for (; t < lim * 60 && FR.a === a0 && !FR.done; t++) { G.step(1 / 60); L.forEach((x) => put(x, o)); } L.forEach((x) => { x.alive = false; }); return t / 60; };
  let t = run('blue', C);
  chk(FR.a === 4 && C.owner === 'blue' && FR.active === D, `Mavi C'yi aldı → cephe ilerledi, etkin D (${t.toFixed(1)} sn, 4 kişi)`);
  chk(G.map.spawns.blue === F.stages[4].blue && G.map.spawns.red === F.stages[4].red, 'iki takımın doğuşu aşama 4\'e kaydı');
  chk(D.owner === null && Math.abs(D.p) < 1e-9, 'yeni etkin nokta (D) çubuğu ortada');
  const nb = FR.owned('blue'), nr = FR.owned('red'), r0 = G.tickets.red, b0 = G.tickets.blue;
  for (let i = 0; i < Math.ceil(TUNE.bleed * 60) + 30; i++) G.step(1 / 60);
  chk(nb === 4 && nr === 2 && G.tickets.red < r0 && G.tickets.blue === b0, `nokta farkı kanaması: Mavi ${nb} – Kırmızı ${nr} → Kırmızı bileti ${r0} → ${G.tickets.red}`);
  t = run('red', D);
  chk(FR.a === 3 && D.owner === 'red' && FR.active === C, `Kırmızı D'yi aldı → cephe geri, etkin C (${t.toFixed(1)} sn)`);
  t = run('red', C);
  chk(FR.a === 2 && C.owner === 'red' && FR.active === B && G.map.spawns.red === F.stages[2].red, `Kırmızı C'yi aldı → etkin B, doğuşlar aşama 2 (${t.toFixed(1)} sn)`);
  chk(FR.shifts === 3, `cephe değişimi sayılır (${FR.shifts})`);
  // karargâh: Mavi uca kadar ilerler, Kırmızı karargâhı alır → Mavi kazanır
  const G3 = mk({ bots: false }); for (const x of G3.soldiers) { x.alive = false; x.respawnT = 1e9; }
  while (G3.front.a < 6) { G3.front.active.p = 1; G3.front.shift(1, true); }
  chk(G3.front.active.id === 'KK' && G3.map.spawns.red === F.stages[6].red, 'son aşama: Kırmızı karargâhı etkin, Kırmızı karargâhta doğar');
  G3.front.active.p = 1; G3.step(1 / 60);
  chk(G3.ended && G3.winner === 'blue' && G3.front.done === 'blue', 'Kırmızı karargâhı alındı → Mavi kazanır');
  const G5 = mk({ bots: false }); for (const x of G5.soldiers) { x.alive = false; x.respawnT = 1e9; }
  while (G5.front.a > 0) { G5.front.active.p = -1; G5.front.shift(-1, true); }
  G5.front.active.p = -1; G5.step(1 / 60);
  chk(G5.ended && G5.winner === 'red', 'Mavi karargâhı alındı → Kırmızı kazanır');
  const G2 = mk({ bots: false }); G2.tickets.red = 0; G2.step(1 / 60); chk(G2.ended && G2.winner === 'blue', 'Kırmızı bileti bitti → Mavi');
  const G6 = mk({ bots: false }); G6.tickets.blue = 0; G6.step(1 / 60); chk(G6.ended && G6.winner === 'red', 'Mavi bileti bitti → Kırmızı');
  const G7 = mk({ bots: false }); G7.front.active.p = 1; G7.front.shift(1, true); G7.timeLeft = 0.01; G7.step(1 / 60); G7.step(1 / 60);
  chk(G7.ended && G7.winner === 'blue', `süre bitti → çok noktalı kazanır (Mavi ${G7.front.owned('blue')} – ${G7.front.owned('red')})`);
  chk(G.tickets.blue === G.tickets.red || Math.abs(G.mode.tickets - G.front.t0) < 1, `iki tarafa simetrik bilet (${G.front.t0})`);
  const G4 = mk({ bots: false }); chk(G4.soldiers.every((x) => x.items[0].id.startsWith('ww_') && x.items[1].id === 'ww_pistol'), 'donanım yalnız 1940\'lar');
  chk(G4.soldiers.filter((x) => x.team === 'red' && x.cls === 'heavy').every((x) => x.items[0].id === 'ww_mg') && G4.soldiers.filter((x) => x.team === 'blue' && x.cls === 'heavy').every((x) => x.items[0].id === 'ww_lmg'), 'ağır destek: Mavi BAR tarzı, Kırmızı MG42 tarzı');
  const AS = G4.soldiers.filter((x) => x.cls === 'assault');
  chk(AS.every((x) => ['ww_semi', 'ww_bolt'].includes(x.items[0].id)) && ['blue', 'red'].every((tm) => frontLoadout('assault', tm, {})[0].id === 'ww_semi'), 'taarruz: iki takımın varsayılanı yarı otomatik tüfek (simetrik mod), botlar yarı otomatik / sürgülü');
}

// ── 4. çevrim içi (isteğe bağlı) ──
const url = process.argv[2];
if (url) {
  const { default: WebSocket } = await import('ws');
  const open = (msg) => new Promise((res, rej) => { const ws = new WebSocket(url); const st = { ws, snaps: 0, fr: null, tk: null, o: null }; ws.on('open', () => ws.send(JSON.stringify(msg))); ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'welcome') { st.welcome = m; res(st); } if (m.t === 'snap') { st.snaps++; st.fr = m.fr; st.tk = m.tk; st.o = m.o; } }); ws.on('error', rej); setTimeout(() => rej(new Error('zaman aşımı')), 20000); });
  const a = await open({ t: 'create', name: 'A', cfg: { type: 'front', map: 'cephe', perTeam: 12, bots: true } });
  const room = a.welcome.room;
  const b = await open({ t: 'join', room, name: 'B' });
  await new Promise((r) => setTimeout(r, 1500));
  chk(a.welcome.cfg?.type === 'front' && a.welcome.cfg?.map === 'cephe', `çevrim içi oda: ${a.welcome.cfg?.type} / ${a.welcome.cfg?.map}`);
  chk(a.fr && a.fr[0] === 3 && b.fr && b.fr[0] === 3, `iki istemci etkin nokta ORTA (${JSON.stringify(a.fr)} ${JSON.stringify(b.fr)})`);
  chk(a.tk && a.tk[0] === a.tk[1] && a.tk[0] >= 500, `iki tarafa simetrik bilet (${JSON.stringify(a.tk)})`);
  a.ws.send(JSON.stringify({ t: 'dbg', frs: 5 }));
  await new Promise((r) => setTimeout(r, 1200));
  chk(a.fr[0] === 5 && b.fr[0] === 5 && a.fr[1] >= 2, `debug ile etkin nokta 5'e (E): iki istemci aynı (${a.fr} ${b.fr})`);
  chk(a.o && a.o[3][0] === 1 && a.o[4][0] === 1 && a.o[6][0] === 2 && a.o[1][0] === 1, `nokta sahipleri snapshot'ta (C, D Mavi; KK Kırmızı) ${JSON.stringify(a.o)}`);
  a.ws.send(JSON.stringify({ t: 'dbg', frs: 1 }));
  await new Promise((r) => setTimeout(r, 1200));
  chk(a.fr[0] === 1 && b.fr[0] === 1, `geri kaydırma (Kırmızı ilerler): etkin nokta 1 (A) (${a.fr} ${b.fr})`);
  a.ws.close(); b.ws.close();
}
for (const m of ok) console.log('OK  ', m);
for (const m of bad) console.log('HATA', m);
console.log(bad.length ? `sonuç: ${bad.length} HATA` : `sonuç: OK (${ok.length})`);
process.exit(bad.length ? 1 : 0);
