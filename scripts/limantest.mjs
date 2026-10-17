// Liman başsız testi: kurulum, çarpışma, doğuşlar, bayrak erişimi, sızıntı, sıçrayarak erişilen üstler, görüş mesafesi istatistiği,
// doğuştan doğuşa görüş, 5v5 ele geçirme / takım / ölüm maçı benzetimleri (öldürme, takılma, geçersiz konum).   node scripts/limantest.mjs [saniye=240]
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildLiman } from '../src/maps/liman.js';
import { NavGrid } from '../src/game/nav.js';
import { Game } from '../src/game/game.js';
import { JUMP_SPEED } from '../src/sim/input.js';

const SECS = +(process.argv[2] || 240);
let fail = 0;
const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const info = (msg) => console.log('      ' + msg);

const t0 = performance.now();
const m = buildLiman();
const C = m.colliders, B = m.bounds;
check(C.length > 100, `kurulum ${(performance.now() - t0).toFixed(0)} ms · çarpışma kutusu ${C.length} · sınır x ${B.minX}…${B.maxX} z ${B.minZ}…${B.maxZ} (${(B.maxX - B.minX).toFixed(0)}×${(B.maxZ - B.minZ).toFixed(0)} m)`);
check(C.every((c) => [0, 1, 2].every((a) => Number.isFinite(c.min[a]) && Number.isFinite(c.max[a]) && c.max[a] > c.min[a])), 'tüm kutular sonlu ve pozitif hacimli');

// ── doğuşlar ──
const inside = (x, y, z, pad = 0) => C.find((c) => x > c.min[0] - pad && x < c.max[0] + pad && z > c.min[2] - pad && z < c.max[2] + pad && y > c.min[1] && y < c.max[1]);
const nav = new NavGrid(C, B, null, !!m.layered);
for (const team of ['blue', 'red']) {
  const S = m.spawns[team], bz = m.baseZones[team];
  const bad = S.filter((p) => inside(p.x, 0.9, p.z, 0.33) || p.x < bz.minX || p.x > bz.maxX || p.z < bz.minZ || p.z > bz.maxZ);
  check(S.length >= 16 && !bad.length, `${team} doğuş ${S.length} nokta, geçersiz ${bad.length}${bad.length ? ' ' + JSON.stringify(bad.slice(0, 3)) : ''}`);
}
// ── bayraklar her iki doğuştan yürünerek erişilebilir ──
for (const team of ['blue', 'red']) for (const o of m.objectives) {
  const s = m.spawns[team][0], p = nav.findPath(s.x, s.z, o.x, o.z);
  const len = p ? p.reduce((a, q, i) => a + (i ? Math.hypot(q.x - p[i - 1].x, q.z - p[i - 1].z) : 0), 0) : 0;
  check(!!p, `${team} → ${o.name}: yol ${p ? len.toFixed(1) + ' m' : 'YOK'}`);
}
{ const L = (team, o) => { let t = 0; for (const s of m.spawns[team]) { const p = nav.findPath(s.x, s.z, o.x, o.z); t += p ? p.reduce((a, q, i) => a + (i ? Math.hypot(q.x - p[i - 1].x, q.z - p[i - 1].z) : 0), 0) : 999; } return t / m.spawns[team].length; };
  const d = m.objectives.map((o) => [L('blue', o), L('red', o)]);
  check(d.every(([a, b]) => Math.abs(a - b) < 3), `bayrak mesafesi adaleti (tüm doğuşlardan ortalama yol, mavi/kırmızı): ${d.map(([a, b], i) => m.objectives[i].label + ' ' + a.toFixed(1) + '/' + b.toFixed(1)).join(' · ')} m`); }

// ── sızıntı + kapalı cep: mavi doğuştan erişilen hücreler ──
const seen = nav.reachable(m.spawns.blue[0].x, m.spawns.blue[0].z);
let out = 0, reach = 0, freeN = 0, island = 0; const isl = new Map();
for (let i = 0; i < seen.length; i++) {
  const x = nav.cx(i), z = nav.cz(i);
  if (!nav.blocked[i]) { freeN++; if (!seen[i] && (nav.floor ? nav.floor[i] < 0.1 : true) && x > B.minX && x < B.maxX && z > B.minZ && z < B.maxZ) { island++; const kk = Math.round(x / 2) * 2 + ',' + Math.round(z / 2) * 2; isl.set(kk, (isl.get(kk) || 0) + 1); } }
  if (!seen[i]) continue; reach++;
  if (x < B.minX - 0.3 || x > Math.min(B.maxX, 29.8) || z < B.minZ - 0.3 || z > B.maxZ + 0.3) out++;
}
check(out === 0, `harita dışına (rıhtım korkuluğu / sınır ötesi) erişilen hücre: ${out}`);
const rs = nav.reachable(m.spawns.red[0].x, m.spawns.red[0].z);
let same = true; for (let i = 0; i < seen.length; i++) if (seen[i] !== rs[i]) { same = false; break; }
check(same, `iki doğuş aynı yürünebilir bölgede (erişilen ${(reach * 0.25).toFixed(0)} m²)`);
check(island * 0.25 < 6, `zemin kotunda ulaşılamayan boş cep: ${(island * 0.25).toFixed(1)} m² (sınır içi kapalı aralıklar)${island ? ' ' + [...isl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k2, v]) => k2 + ':' + v).join(' ') : ''}`);

// ── sıçrayarak erişilebilen üst yüzeyler (zıplama ${JUMP_SPEED} m/sn → ~0,97 m + 0,5 m basamak; koşarak ~6 m yatay) ──
{
  const UP = JUMP_SPEED * JUMP_SPEED / 30 + 0.5 - 0.02, HOR = 6.2;
  const tops = C.filter((c) => c.max[0] - c.min[0] >= 0.3 && c.max[2] - c.min[2] >= 0.3 && c.max[1] > 0.3 && c.max[1] < 40).map((c) => ({ c, y: c.max[1], r: false }));
  const clear = (t) => !C.some((o) => o !== t.c && o.min[1] < t.y + 1.75 && o.max[1] > t.y + 0.05 && o.min[0] < t.c.max[0] - 0.15 && o.max[0] > t.c.min[0] + 0.15 && o.min[2] < t.c.max[2] - 0.15 && o.max[2] > t.c.min[2] + 0.15 && (o.max[0] - o.min[0]) * (o.max[2] - o.min[2]) >= (t.c.max[0] - t.c.min[0]) * (t.c.max[2] - t.c.min[2]) * 0.8);
  const gap = (a, b) => Math.hypot(Math.max(0, a.min[0] - b.max[0], b.min[0] - a.max[0]), Math.max(0, a.min[2] - b.max[2], b.min[2] - a.max[2]));
  const inB = (t) => t.c.max[0] > B.minX && t.c.min[0] < B.maxX && t.c.max[2] > B.minZ && t.c.min[2] < B.maxZ;
  for (const t of tops) if (inB(t) && t.y <= UP && clear(t)) t.r = true;
  for (let it = 0, ch = true; ch && it < 40; it++) { ch = false; for (const t of tops) if (!t.r && inB(t) && clear(t)) for (const q of tops) if (q.r && t.y - q.y <= UP && gap(t.c, q.c) <= HOR) { t.r = true; ch = true; break; } }
  const hi = tops.filter((t) => t.r && t.y >= 1.5), by = new Map();
  for (const t of hi) { const k = (t.c.oid || '?').replace(/:\d+$/, ':N') + ' @' + t.y.toFixed(1); by.set(k, (by.get(k) || 0) + 1); }
  info('erişilen yüksek üstler (≥1,5 m): ' + [...by.entries()].map(([k, v]) => k + '×' + v).join(', '));
  const allowed = (t) => t.c.tag === 'plat' || /^(tünel|sandık:|merdiven:|forklift:|konteyner:|vinç:|yük:|kulübe:)/.test(t.c.oid || '') && t.y <= CTOP + 1.0;
  const CTOP = 2.6;
  const bad = hi.filter((t) => !allowed(t) || t.y > CTOP + 1.0);
  check(!bad.length, `istenmeyen yüksek üst yok (B kulesi çatısı, tek kat konteyner, forklift, boji, yük, kulübe): ${bad.length}${bad.length ? ' ' + bad.slice(0, 5).map((t) => t.c.oid + '@' + t.y.toFixed(1)).join(', ') : ''}`);
  const big = hi.filter((t) => t.y > 4.5);
  check(!big.length, `2 katlı konteyner üstlerine (5,2 m) çıkılamıyor: ${big.length}`);
}

// ── görüş mesafesi istatistiği (göz 1,6 m; erişilen hücrelerden 2 m ızgara × 16 yön) ──
const ray = (ox, oy, oz, dx, dy, dz, maxT) => {
  let best = maxT;
  for (const c of C) {
    let t0 = 0, t1 = best; const o = [ox, oy, oz], d = [dx, dy, dz]; let ok = true;
    for (let a = 0; a < 3 && ok; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < c.min[a] || o[a] > c.max[a]) ok = false; continue; }
      let ta = (c.min[a] - o[a]) / d[a], tb = (c.max[a] - o[a]) / d[a]; if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) ok = false;
    }
    if (ok && t0 < best) best = t0;
  }
  return best;
};
{
  const ds = [], pairs = [];
  const pts = [];
  for (let i = 0; i < seen.length; i++) { if (!seen[i]) continue; const x = nav.cx(i), z = nav.cz(i); if (Math.abs((x + 100) % 2 - 0.25) > 0.01 || Math.abs((z + 100) % 2 - 0.25) > 0.01) continue; if (Math.abs(z) > 24) continue; pts.push([x, (nav.floor ? nav.floor[i] : 0) + 1.6, z]); }
  for (const [x, y, z] of pts) for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    const tb = Math.min(dx > 0 ? (B.maxX - x) / dx : dx < 0 ? (B.minX - x) / dx : 1e9, dz > 0 ? (B.maxZ - z) / dz : dz < 0 ? (B.minZ - z) / dz : 1e9);
    const d = ray(x, y, z, dx, 0, dz, Math.min(tb, 120)); ds.push(d); if (d > 48) pairs.push([d, x, z, k]);
  }
  ds.sort((a, b) => a - b);
  const q = (p) => ds[Math.floor(p * (ds.length - 1))];
  const pct = (v) => (100 * ds.filter((d) => d > v).length / ds.length).toFixed(1);
  info(`görüş: ${pts.length} nokta × 16 yön · ortanca ${q(0.5).toFixed(1)} m · %75 ${q(0.75).toFixed(1)} · %90 ${q(0.9).toFixed(1)} · %99 ${q(0.99).toFixed(1)} · en uzun ${q(1).toFixed(1)} m · >35 m %${pct(35)} · >50 m %${pct(50)}`);
  pairs.sort((a, b2) => b2[0] - a[0]); info('en uzun hatlar: ' + pairs.slice(0, 8).map(([d, x, z, kk]) => `${d.toFixed(0)}m (${x},${z})→${(kk * 22.5).toFixed(0)}°`).join(' '));
  check(q(0.5) >= 6 && q(0.9) <= 38 && q(1) <= 62, 'görüş dağılımı kompakt (ortanca ≥ 6, %90 ≤ 38, en uzun ≤ 62 m)');
  // doğuştan doğuşa görüş (göz hizası): mavi avludaki hiçbir nokta kırmızı avludan görülmemeli
  let vis = 0, tot = 0;
  for (const a of m.spawns.blue) for (const b of m.spawns.red) { tot++; const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz); if (ray(a.x, 1.6, a.z, dx / L, 0, dz / L, L) >= L - 0.01) { vis++; info('görüş çifti ' + JSON.stringify([a.x, a.z, b.x, b.z])); } }
  check(vis === 0, `doğuştan doğuşa görüş: ${vis}/${tot} çift`);
  // kapı ağzından karşı avluya (göz hizası)
  let gv = 0; for (const gx of [-21.4, -4.9, 4.9, 21.4]) for (const b of m.spawns.red) { const a = { x: gx, z: 23.0 }, dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz); if (ray(a.x, 1.6, a.z, dx / L, 0, dz / L, L) >= L - 0.01) gv++; }
  check(gv === 0, `mavi kapı ağzından kırmızı avluya görüş: ${gv}`);
}

// ── benzetimler ──
for (const [type, per, extra] of [['conquest', 5, {}], ['tdm', 5, {}], ['dm', 8, {}], ['conquest', 4, { tod: 'night', weather: 'rain' }], ['tdm', 16, {}]]) {
  const g = new Game(null, { headless: true, map: 'liman', tod: extra.tod || 'day', weather: extra.weather || 'clear', diff: 'normal', match: { perTeam: per, type, time: SECS } });
  let flags = 0, invalid = 0, inBox = 0, errs = 0, steps = 0;
  g.on('flag', () => flags++);
  const hist = new Map(); let stuck = new Set();
  const s0 = performance.now();
  try {
    for (; steps < SECS * 30 && !g.ended; steps++) {
      g.step(1 / 30);
      if (steps % 15) continue;
      for (const s of g.soldiers) {
        if (!s.alive) { hist.delete(s); continue; }
        const p = s.pos;
        if (!Number.isFinite(p.x + p.y + p.z) || p.y < -0.5 || p.x < B.minX - 0.05 || p.x > B.maxX + 0.05 || p.z < B.minZ - 0.05 || p.z > B.maxZ + 0.05) invalid++;
        { const ib = inside(p.x, p.y + 0.9, p.z, -0.12); if (ib) { inBox++; if (inBox < 4) info('kutu içinde: ' + s.name + ' ' + [p.x, p.y, p.z].map((v) => v.toFixed(2)) + ' → ' + ib.oid + ' ' + JSON.stringify([ib.min, ib.max].map((v) => v.map((w) => +w.toFixed(2))))); } }
        if (s.brain || g.brains.some((b) => b.s === s || b.soldier === s)) {
          const h = hist.get(s) || []; h.push([p.x, p.z, steps]); if (h.length > 40) h.shift(); hist.set(s, h);
          if (h.length >= 40) { let mx = 0; for (const q of h) mx = Math.max(mx, Math.hypot(q[0] - h[0][0], q[1] - h[0][1])); if (mx < 1.2) stuck.add(s.name + '@' + p.x.toFixed(0) + ',' + p.z.toFixed(0)); }
        }
      }
    }
  } catch (e) { errs++; console.log('HATA', e.stack.split('\n').slice(0, 4).join(' | ')); }
  const kills = g.soldiers.reduce((a, s) => a + (s.kills || 0), 0);
  const ms = (performance.now() - s0) / Math.max(1, steps);
  const ok = !errs && kills > 0 && !invalid && !inBox && (type !== 'conquest' || flags > 0);
  check(ok, `${type} ${per}v${per}${extra.tod ? ' ' + extra.tod + '/' + extra.weather : ''}: ${(steps / 30).toFixed(0)} sn · adım ${ms.toFixed(2)} ms · öldürme ${kills} · bayrak değişimi ${flags} · geçersiz ${invalid} · kutu içinde ${inBox} · ${g.ended ? 'bitti: ' + g.winner : 'süre doldu'}`);
  info(`20 sn kıpırdamayan bot örneği: ${stuck.size}${stuck.size ? ' ' + [...stuck].slice(0, 6).join(' ') : ''}`);
  if (type !== 'dm' && stuck.size > per) { console.log('HATA  çok sayıda takılan bot'); fail++; }
}
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
