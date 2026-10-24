// Haritalardaki düşüş yükseklikleri (tarayıcısız): node scripts/fallmaps.mjs [harita …]
// Her haritayı başsız kurar; 0,5 m ızgarada her sütunun "basılabilir" yüzeylerini (arazi + üstünde 1,7 m boşluk olan kutu tepeleri) çıkarır,
// doğuş noktalarından yürüyerek (basamak 0,5 m, zıplayarak ≤ 1,4 m tırmanma, her yükseklikten inme) ulaşılabilen yüzeyleri bulur ve
// ulaşılabilir bir yüzeyden komşu sütuna adım atınca düşülen yüksekliği sayar. Çıktı: aralık dağılımı + en yüksek kenarlar (yer kümesi).
// Ölçü "kenardan yürüyerek inme" yüksekliğidir; zıplayarak inmek buna ~1 m ekler (zıplama tepesi v²/2g = 5,4² / 30 ≈ 0,97 m).
import { Game } from '../src/game/game.js';
import { MAPS } from '../src/maps/index.js';
import { fallDamage } from '../src/sim/fall.js';
import { writeFileSync } from 'node:fs';
const out = {};                                            // JSON=dosya: haritaya göre en yüksek kenarlar { from:[x,y,z] (kenar üstü), to:[x,y,z] (iniş), d }

const CELL = 0.5, HEAD = 1.7, STEP = 0.5, CLIMB = 1.4;
const list = process.argv.slice(2).length ? process.argv.slice(2) : ['colgecidi', 'kasaba', 'vadi', 'us', 'newyork', 'depo', 'liman', 'maden', 'boyakulesi', 'ormankale'];
const BINS = [[0.5, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 8], [8, 10], [10, 12], [12, 15], [15, 99]];

for (const id of list) {
  const def = MAPS[id];
  if (!def) { console.log(id, ': yok'); continue; }
  const type = def.only?.[0] || 'tdm';
  const g = new Game(null, { headless: true, map: id, tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 2, type } });
  const W = g.world, T = g.terrain, b = g.map.bounds;
  const nx = Math.ceil((b.maxX - b.minX) / CELL), nz = Math.ceil((b.maxZ - b.minZ) / CELL);
  const tmp = [];
  // sütun yüzeyleri (artan sırada)
  const surf = new Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const x = b.minX + (ix + 0.5) * CELL, z = b.minZ + (iz + 0.5) * CELL;
    const cs = W.query(x - 0.05, z - 0.05, x + 0.05, z + 0.05, tmp).filter((c) => x > c.min[0] && x < c.max[0] && z > c.min[2] && z < c.max[2]);
    const gh = T ? T.heightAt(x, z) : 0;
    const deep = T && gh < (T.deepWater ?? -0.22);
    const cand = deep ? [] : [gh];
    for (const c of cs) if (c.max[1] > gh + 0.05 && !c.pad) cand.push(c.max[1]);
    const ok = [];
    for (const t of cand) {
      if (cs.some((c) => c.min[1] < t + HEAD && c.max[1] > t + 0.02)) continue;        // üstünde boşluk yok (kutunun içi / alçak tavan)
      ok.push(t);
    }
    ok.sort((a, c) => a - c);
    surf[iz * nx + ix] = ok;
  }
  // geçiş: A (ha) → komşu sütun. Ulaşılan yüzey: ha + STEP'e kadar en yüksek yüzey (yürüyerek / düşerek); yoksa ha + CLIMB'e kadar (zıplayarak)
  const key = (i, k) => i * 16 + k;
  const seen = new Set(), q = [];
  const drops = [];
  const pt = (i) => [b.minX + ((i % nx) + 0.5) * CELL, b.minZ + (Math.floor(i / nx) + 0.5) * CELL];
  const blockedAt = (i, lo, hi) => { const [x, z] = pt(i); return W.query(x - 0.05, z - 0.05, x + 0.05, z + 0.05, tmp).some((c) => x > c.min[0] && x < c.max[0] && z > c.min[2] && z < c.max[2] && c.min[1] < hi && c.max[1] > lo + 0.02); };
  const par = new Map(); let from = -1;
  const push = (i, k) => { const kk = key(i, k); if (!seen.has(kk)) { seen.add(kk); par.set(kk, from); q.push([i, k]); } };
  const sp = Object.values(g.map.spawns).flat();
  for (const p of sp) {
    const ix = Math.floor((p.x - b.minX) / CELL), iz = Math.floor((p.z - b.minZ) / CELL), i = iz * nx + ix;
    if (surf[i]?.length && surf[i][0] <= (T ? T.heightAt(p.x, p.z) : 0) + 0.6) push(i, 0);          // doğuş noktası bina kutusunun içindeyse (oyun yakındaki boş hücreye kaydırır) çatısından başlatma
  }
  while (q.length) {
    const [i, k] = q.pop(); from = key(i, k);
    const ha = surf[i][k], ix = i % nx, iz = Math.floor(i / nx);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const jx = ix + dx, jz = iz + dz;
      if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
      const j = jz * nx + jx, S = surf[j];
      if (!S.length) continue;
      let kk = -1;
      for (let m = S.length - 1; m >= 0; m--) if (S[m] <= ha + STEP) { kk = m; break; }
      if (kk >= 0 && blockedAt(j, Math.max(ha, S[kk]), Math.max(ha, S[kk]) + HEAD)) kk = -1;          // komşuya geçerken önü duvar
      if (kk >= 0) {
        const d = ha - S[kk];
        if (d > STEP) drops.push({ d, i: j, src: key(i, k) });
        push(j, kk);
        continue;
      }
      for (let m = 0; m < S.length; m++) if (S[m] > ha + STEP && S[m] <= ha + CLIMB && !blockedAt(j, S[m], S[m] + HEAD) && !blockedAt(i, ha, S[m] + HEAD)) { push(j, m); break; }
    }
  }
  // dağılım + en yüksek kenar kümeleri (3 m)
  const hist = BINS.map(([lo, hi]) => drops.filter((e) => e.d >= lo && e.d < hi).length);
  const top = [];
  for (const e of drops.sort((a, c) => c.d - a.d)) {
    const [x, z] = pt(e.i);
    if (top.some((t) => Math.hypot(t.x - x, t.z - z) < 6)) continue;
    const si = Math.floor(e.src / 16), [sx, sz] = pt(si);
    top.push({ x, z, d: e.d, from: [sx, surf[si][e.src % 16], sz], to: [x, surf[si][e.src % 16] - e.d, z] });
    if (top.length >= +(process.env.TOP || 8)) break;
  }
  const reachTop = Math.max(...[...seen].map((kk) => surf[Math.floor(kk / 16)][kk % 16] - (T ? T.heightAt(...pt(Math.floor(kk / 16))) : 0)));
  console.log(`\n${id} (${def.name}) · ulaşılan yüzey ${seen.size} · en yüksek ulaşılan yüzey (araziden) ${reachTop.toFixed(1)} m · kenar (≥0,5 m) ${drops.length}`);
  console.log('  ' + BINS.map(([lo, hi], n) => `${lo}–${hi === 99 ? '…' : hi}:${hist[n]}`).join('  '));
  const near = (x, z) => { let best = null, bd = 1e9; for (const c of g.map.callouts || []) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } } return best && bd < 25 ? ' ' + best.name : ''; };
  console.log('  en yüksek (yürüyerek / zıplayarak inme hasarı): ' + top.map((t) => `${t.d.toFixed(1)} m (${t.x.toFixed(0)},${t.z.toFixed(0)}${near(t.x, t.z)}) → ${fallDamage(t.d)}/${fallDamage(t.d + 0.97)}`).join(' · '));
  if (process.env.TRACE && drops.length) {                                     // en yüksek kenara giden yol (doğrulama)
    const chain = []; for (let kk = drops[0].src; kk >= 0 && chain.length < 4000; kk = par.get(kk)) chain.push(kk);
    let last = null;
    for (const kk of chain.reverse()) { const h = surf[Math.floor(kk / 16)][kk % 16]; if (last === null || Math.abs(h - last) > 0.3) { const [x, z] = pt(Math.floor(kk / 16)); console.log(`    ${x.toFixed(1)},${z.toFixed(1)} y=${h.toFixed(2)}`); last = h; } }
  }
  out[id] = top.map((t) => ({ from: t.from.map((v) => +v.toFixed(2)), to: t.to.map((v) => +v.toFixed(2)), d: +t.d.toFixed(2) }));
  g.dispose?.();
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(out, null, 1));
