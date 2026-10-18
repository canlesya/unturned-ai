// Vagon modu + Maden Ocağı başsız denetimi:  node scripts/pltest.mjs [maç sayısı çarpanı=1]
// Harita: çarpışma kutuları, sınır, doğuşlar (her aşama: zeminde / geometri dışında / düşman doğuşundan görünmüyor), ray boyunca vagon geçişi (statik kutuya çarpmaz),
// her aşamada iki doğuştan vagon yoluna yürünebilirlik, sızıntı (sınır dışı / yüksek erişilebilir hücre), fizik sınırı.
// Kurallar: itme / çekişme / geri kayma / kontrol noktası (süre + doğuş kayması) / uzatma / bitiş birim testleri.
// Bot maçları: 5v5 (×4), 8v8, 3v3, gece-yağmur 5v5, Zor 6v6 — her biri kazananla bitmeli, ilerleme olmalı; takılan / geçersiz konumlu bot sayımı.
import * as THREE from 'three';
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildMaden, MADEN_BOUNDS as B } from '../src/maps/maden.js';
import { NavGrid } from '../src/game/nav.js';
import { World } from '../src/game/collision.js';
import { Game } from '../src/game/game.js';
import { TUNE, LIMITS } from '../src/game/balance.js';
import { makeTrack } from '../src/game/track.js';

const MUL = +(process.argv[2] || 1);
let fail = 0;
const ok = (c, msg) => { console.log((c ? 'OK    ' : 'HATA  ') + msg); if (!c) fail++; };
const m = buildMaden();
const world = new World(m.colliders, m.bounds), nav = new NavGrid(m.colliders, m.bounds, null, true);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const hitAt = (x, y, z, h = 1.78) => world._hits(world.query(x - 1, z - 1, x + 1, z + 1, []), x, y, z, h);

// ── çarpışma kutuları ──
const badBox = m.colliders.filter((c) => !(c.max[0] > c.min[0] && c.max[1] > c.min[1] && c.max[2] > c.min[2]));
ok(badBox.length === 0, `çarpışma kutusu ${m.colliders.length} (bozuk ${badBox.length})`);

// ── doğuşlar (her aşama) ──
const P = m.payload, tr = makeTrack(P.track, P.radius);
P.stages.forEach((S, si) => {
  for (const t of ['blue', 'red']) {
    const bad = S[t].filter((p) => hitAt(p.x, 0.01, p.z) || !nav.isFree(p.x, p.z) || nav.floorAt(p.x, p.z) !== 0);
    const Z = S.zones[t], out = S[t].filter((p) => p.x < Z.minX || p.x > Z.maxX || p.z < Z.minZ || p.z > Z.maxZ);
    ok(S[t].length >= 20 && bad.length === 0 && out.length === 0, `aşama ${si + 1} ${t} doğuş ${S[t].length} nokta (sorunlu ${bad.length}, üs bölgesi dışında ${out.length})`);
  }
  let seen = 0;
  for (const a of S.blue) for (const r of S.red) if (world.clear(V(a.x, 1.6, a.z), V(r.x, 1.6, r.z))) seen++;
  ok(seen === 0, `aşama ${si + 1}: mavi ↔ kırmızı doğuş noktaları birbirini görmüyor (görünen çift ${seen})`);
  // vagon yolu: rayın iki ucu + kontrol noktası her iki doğuştan yürünebilir
  const len = (p, s) => { let L = 0, a = s; for (const q of p || []) { L += Math.hypot(q.x - a.x, q.z - a.z); a = q; } return Math.round(L); };
  const dA = si ? tr.corners[P.checkpoints[si - 1]] : P.start, dB = si < P.checkpoints.length ? tr.corners[P.checkpoints[si]] : tr.len - 0.5;
  for (const d of [dA, (dA + dB) / 2, dB]) {
    const q = tr.at(d), g = nav.nearestFree(q.x - q.dz * 1.6, q.z + q.dx * 1.6, 3);
    const pb = nav.findPath(S.blue[0].x, S.blue[0].z, nav.cx(g), nav.cz(g)), pr = nav.findPath(S.red[0].x, S.red[0].z, nav.cx(g), nav.cz(g));
    ok(g >= 0 && pb && pr, `aşama ${si + 1}: ray d=${d.toFixed(0)} (${q.x.toFixed(0)}, ${q.z.toFixed(0)}) iki doğuştan yürünebilir: mavi ${len(pb, S.blue[0])} m, kırmızı ${len(pr, S.red[0])} m`);
  }
});
// ── vagon geçişi: 1,5 × 1,45 m kutu ray boyunca hiçbir statik kutuya girmez; ray avlu / bina içinden geçerken tavan ≥ 1,6 m ──
{
  let hits = 0, where = '';
  const q = {};
  for (let d = P.start; d <= tr.len; d += 0.25) {
    tr.at(d, q);
    const c = world.query(q.x - 1, q.z - 1, q.x + 1, q.z + 1, []).find((k) => q.x + 0.76 > k.min[0] && q.x - 0.76 < k.max[0] && q.z + 0.76 > k.min[2] && q.z - 0.76 < k.max[2] && k.min[1] < 1.6 && k.max[1] > 0.02);
    if (c) { hits++; if (!where) where = `d=${d.toFixed(1)} (${q.x.toFixed(1)}, ${q.z.toFixed(1)}) ${c.oid}`; }
  }
  ok(hits === 0, `vagon ray boyunca serbest (${tr.len.toFixed(1)} m, kontrol ${P.checkpoints.map((i) => tr.corners[i].toFixed(1)).join(' / ')}) ${where}`);
}
// ── sızıntı / ada ──
const reachB = nav.reachable(P.stages[0].blue[0].x, P.stages[0].blue[0].z);
{
  let outside = 0, high = 0, island = 0;
  for (let i = 0; i < reachB.length; i++) {
    if (!reachB[i]) continue;
    const x = nav.cx(i), z = nav.cz(i), f = nav.floor[i];
    if (x < B.minX || x > B.maxX || z < B.minZ || z > B.maxZ) outside++;
    if (f > 1.45) high++;                                                // yalnız yükleme rampası (1,4 m) yürünür; çatı / kaya / duvar üstü olmamalı
  }
  for (const S of P.stages) for (const t of ['blue', 'red']) for (const p of S[t]) if (!reachB[nav.idx(p.x, p.z)]) island++;
  ok(outside === 0 && high === 0, `sızıntı yok: sınır dışı ${outside}, 1,45 m üstü erişilebilir hücre ${high}`);
  ok(island === 0, `tüm aşamaların doğuş noktaları aynı yürünebilir bölgede (ada / kapalı oda ${island})`);
}
{ const s = { pos: V(0, 0, 0), vel: V(0, 0, 0), height: 1.78, onGround: true };
  let maxOut = 0;
  for (const [x0, z0, vx, vz] of [[-44, 30, -9, 9], [-44, 30, 0, 9], [40, 10, 9, 0], [0, -30, 0, -9], [30, -30, 6, -9], [-40, -30, -9, -6]]) { s.pos.set(x0, 0, z0); for (let k = 0; k < 300; k++) { s.vel.x = vx; s.vel.z = vz; world.move(s, 1 / 30); maxOut = Math.max(maxOut, Math.abs(s.pos.x) - 48, Math.abs(s.pos.z) - 36); } }
  ok(maxOut <= 0, `fizik: kayalığa koşan oyuncu sınır içinde (taşma ${Math.max(0, maxOut).toFixed(2)} m)`); }

// ── kural birim testleri (bot yok) ──
{
  const g = new Game(null, { headless: true, map: 'maden', tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 3, type: 'payload' } });
  const pl = g.payload, A = g.claimSlot('blue', 'Ali'), A2 = g.claimSlot('blue', 'Ayşe'), D = g.claimSlot('red', 'Veli');
  g.brains.length = 0;
  const put = (s, d, lat = 1.6) => { const q = pl.track.at(d); s.alive = true; s.hp = s.maxHp; s.pos.set(q.x - q.dz * lat, 0, q.z + q.dx * lat); s.vel.set(0, 0, 0); };
  const away = (s) => { s.pos.set(-44, 0, 34); s.vel.set(0, 0, 0); };
  const ride = new Map();                                              // vagonla yürüyen (iten) oyuncular: her adımda vagonun yanına
  const run = (sec) => { for (let i = 0; i < sec * 60 && !g.ended; i++) { for (const [s, lat] of ride) put(s, pl.d, lat); g.step(1 / 60); } };
  const putR = (s, lat = 1.6) => { ride.set(s, lat); put(s, pl.d, lat); };
  const awayAll = () => { ride.clear(); away(A); away(A2); away(D); };
  const t0 = g.timeLeft;
  ok(g.timeLeft === LIMITS.plTime && pl.d === P.start, `başlangıç: süre ${g.timeLeft} sn, vagon d=${pl.d}`);
  away(A); away(A2); away(D); run(2);
  ok(Math.abs(pl.d - P.start) < 1e-6 && pl.state === 'idle', `kimse yokken vagon durur (${pl.state})`);
  putR(A, 1.6); const d0 = pl.d; run(4);
  const v1 = (pl.d - d0) / 4;
  ok(Math.abs(v1 - TUNE.plSpeed) < 0.12 && pl.state === 'push', `1 kişi iter: ${v1.toFixed(2)} m/sn (taban ${TUNE.plSpeed})`);
  putR(A2, -1.6); const d1 = pl.d; run(4);
  const v2 = (pl.d - d1) / 4;
  ok(Math.abs(v2 - TUNE.plSpeed * (1 + TUNE.plCrowd)) < 0.15, `2 kişi daha hızlı: ${v2.toFixed(2)} m/sn`);
  put(D, pl.d + 0.3, 0.2); run(1 / 60 * 2);
  const inBox = (s) => s.pos.x + 0.3 > pl.col.min[0] && s.pos.x - 0.3 < pl.col.max[0] && s.pos.z + 0.3 > pl.col.min[2] && s.pos.z - 0.3 < pl.col.max[2];
  ok(!inBox(D), `vagonun kutusuna düşen oyuncu dışarı itilir (${D.pos.x.toFixed(2)}, ${D.pos.z.toFixed(2)})`);
  const d2 = pl.d; run(3);
  ok(Math.abs(pl.d - d2) < 0.05 && pl.state === 'contest', `savunan yanındayken çekişme: vagon durur (${pl.state}, Δ ${(pl.d - d2).toFixed(2)} m)`);
  { const o = V(pl.p.x - 4, 1.0, pl.p.z), hit = g.world.raycast(o, V(1, 0, 0), 8, {}); ok(hit && hit.collider === pl.col, 'vagon mermiyi keser (ışın vagon kutusuna çarpar)'); }
  awayAll(); const d3 = pl.d; run(TUNE.plBackDelay - 1);
  ok(Math.abs(pl.d - d3) < 0.01, `saldıran ayrılınca ${TUNE.plBackDelay} sn bekler`);
  run(4);
  ok(pl.d < d3 - 0.5 && pl.state === 'back' && pl.d >= P.start, `sonra geri kayar (${(d3 - pl.d).toFixed(2)} m, başlangıcın gerisine düşmez)`);
  // kontrol noktası: süre ödülü + doğuş kayması
  const cp1 = pl.cps[0];
  pl.d = cp1 - 1.5; putR(A, 1.6); const tl = g.timeLeft; run(3);
  ok(pl.reached === 1 && g.timeLeft > tl + TUNE.plBonus - 4 && g.map.spawns.blue === pl.def.stages[1].blue && g.map.baseZones.red === pl.def.stages[1].zones.red, `A geçilince: +${TUNE.plBonus} sn (${Math.round(tl)} → ${Math.round(g.timeLeft)}), doğuş aşama 2`);
  awayAll(); run(TUNE.plBackDelay + 8);
  ok(pl.d >= cp1 - 1e-6, `geri kayma geçilen kontrol noktasında durur (d ${pl.d.toFixed(2)} ≥ ${cp1.toFixed(2)})`);
  ok(!g.ended && t0 > 0, 'maç sürüyor');
  // uzatma: süre biterken saldıran vagonda
  putR(A, 1.6); g.timeLeft = 1; run(3);
  ok(!g.ended && pl.over, `süre bitti ama saldıran vagonda → UZATMA (bitmedi, d ${pl.d.toFixed(1)})`);
  awayAll(); run(TUNE.plOverGrace + 1);
  ok(g.ended && g.winner === 'red', `vagondan ayrılınca savunan kazanır: ${g.winner} · ${g.endReason}`);
  // bitiş
  const g2 = new Game(null, { headless: true, map: 'maden', tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 2, type: 'payload' } });
  const B2 = g2.claimSlot('blue', 'Ali'); g2.brains.length = 0;
  const p2 = g2.payload; p2.d = p2.end - 2; const q = p2.track.at(p2.d); B2.pos.set(q.x - q.dz * 1.6, 0, q.z + q.dx * 1.6); B2.alive = true;
  for (let i = 0; i < 60 * 6 && !g2.ended; i++) g2.step(1 / 60);
  ok(g2.ended && g2.winner === 'blue' && p2.reached === 2, `vagon maden ağzına ulaşınca Mavi kazanır: ${g2.endReason}`);
  const g3 = new Game(null, { headless: true, map: 'maden', tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 2, type: 'payload', time: 0 } });
  ok(g3.timeLeft === Infinity, 'süre ∞ seçilirse süresiz (alıştırma)');
}

// ── bot maçları ──
const cases = [];
for (let r = 0; r < 4 * MUL; r++) cases.push([5, 'normal', 'day', 'clear']);
cases.push([8, 'normal', 'day', 'clear'], [3, 'normal', 'day', 'clear'], [5, 'normal', 'night', 'rain'], [6, 'hard', 'sunset', 'fog'], [4, 'easy', 'day', 'clear']);
const wins = { blue: 0, red: 0 };
for (const [per, diff, tod, weather] of cases) {
  const g = new Game(null, { headless: true, map: 'maden', tod, weather, diff, match: { perTeam: per, type: 'payload' } });
  const pl = g.payload, last = new Map(), still = new Map();
  let err = null, invalid = 0, inGeo = 0, maxStill = 0, cpT = [];
  g.on('end', () => {});
  const t0 = performance.now();
  try {
    for (let i = 0; i < 30 * 1500 && !g.ended; i++) {
      const r0 = pl.reached;
      g.step(1 / 30);
      if (pl.reached > r0) cpT.push(Math.round(g.time));
      if (i % 30 === 0) for (const s of g.soldiers) {
        if (!s.alive) { still.delete(s); continue; }
        if (!Number.isFinite(s.pos.x + s.pos.y + s.pos.z) || s.pos.y < -1 || Math.abs(s.pos.x) > 48.5 || Math.abs(s.pos.z) > 36.5) invalid++;
        if (hitAt(s.pos.x, s.pos.y + 0.05, s.pos.z, 1.2)) inGeo++;
        const p = last.get(s);
        if (p && Math.hypot(p.x - s.pos.x, p.z - s.pos.z) < 0.15 && !s.brain?.target && !s.brain?.perching) { still.set(s, (still.get(s) || 0) + 1); maxStill = Math.max(maxStill, still.get(s)); } else still.set(s, 0);
        last.set(s, s.pos.clone());
      }
    }
  } catch (e) { err = e; }
  const kills = g.soldiers.reduce((a, s) => a + s.kills, 0);
  if (g.ended) wins[g.winner]++;
  ok(!err && g.ended && (g.winner === 'blue' || g.winner === 'red') && pl.d > P.start + 5 && invalid === 0 && kills > 5,
    `${per}v${per} ${diff} ${tod}/${weather}: ${err ? 'ÇÖKTÜ ' + err.stack.split('\n').slice(0, 3).join(' | ') : g.ended ? g.winner + ' · ' + g.endReason : 'bitmedi'} · ${Math.round(g.time)} sn · ilerleme %${Math.round(pl.progress * 100)} · kontrol ${pl.reached} (${cpT.join(', ')} sn) · öldürme ${kills} · geçersiz ${invalid} · kutu içi ${inGeo} · en uzun hedefsiz bekleme ${maxStill} sn · ${((performance.now() - t0) / (g.time * 30)).toFixed(2)} ms/adım`);
}
console.log(`bilgi  bot maçları: Mavi (saldıran) ${wins.blue} · Kırmızı (savunan) ${wins.red}`);
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
