// Tırmanma / çatıya çıkma taraması (12.171): durulabilir yüzeyler (zemin + çarpışma kutusu tepeleri, 0,25 m ızgara) arasında yürüyerek / zıplayarak
// (yukarı ≤ 1,4 m, aşağı serbest) T doğuşundan ulaşılabilenler; bina / çevre kutusu tepesine (çatıya) ya da sınır dışına çıkış listelenir.
//   node scripts/cgclimb.mjs [depo kökü]
import path from 'node:path';
const ROOT = path.resolve(process.argv[2] || '.');
const { MapBuilder } = await import(path.join(ROOT, 'src/maps/builder.js'));
MapBuilder.noVisual = true;
const { buildColGecidi } = await import(path.join(ROOT, 'src/maps/colgecidi.js'));
const m = buildColGecidi(), T = m.terrain, C = m.colliders, B = m.bounds;
const S = 0.25, nx = Math.ceil((B.maxX - B.minX) / S), nz = Math.ceil((B.maxZ - B.minZ) / S);
const cols = new Map();
C.forEach((c, i) => { if (c.max[0] - c.min[0] > 200) return; for (let x = Math.floor((c.min[0] - B.minX) / S); x <= Math.floor((c.max[0] - B.minX) / S); x++) for (let z = Math.floor((c.min[2] - B.minZ) / S); z <= Math.floor((c.max[2] - B.minZ) / S); z++) { const k = z * nx + x; let a = cols.get(k); if (!a) cols.set(k, (a = [])); a.push(c); } });
// hücre yüzeyleri: [y, kaynak]
const surf = new Array(nx * nz);
for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
  const wx = B.minX + (x + 0.5) * S, wz = B.minZ + (z + 0.5) * S, k = z * nx + x, cs = (cols.get(k) || []).filter((c) => wx > c.min[0] && wx < c.max[0] && wz > c.min[2] && wz < c.max[2]);
  const ys = [[T.heightAt(wx, wz), 'zemin']];
  for (const c of cs) ys.push([c.max[1], c.oid]);
  const ok = ys.filter(([y]) => !cs.some((c) => c.min[1] < y + 1.25 && c.max[1] > y + 0.02));     // üstünde 1,25 m (çömelme) boşluk, içinde değil
  surf[k] = ok;
}
const start = m.spawns.blue[0], sk = Math.floor((start.z - B.minZ) / S) * nx + Math.floor((start.x - B.minX) / S);
const seen = new Map(), q = [];
const key = (k, i) => k * 8 + i;
const s0 = surf[sk].findIndex(([y]) => Math.abs(y - start.y) < 0.3); if (s0 >= 0) { seen.set(key(sk, s0), 1); q.push([sk, s0]); }
for (let h = 0; h < q.length; h++) {
  const [k, i] = q[h], y = surf[k][i][0], x = k % nx, z = (k / nx) | 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue; const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= nx || Z >= nz) continue;
    const kk = Z * nx + X;
    surf[kk].forEach(([y2], j) => { if (y2 - y > 1.4) return; if (y2 > y + 0.02 && (cols.get(kk) || []).some((c) => c.min[1] > y + 0.3 && c.min[1] < y + 1.8 && B.minX + (X + 0.5) * S > c.min[0] && B.minX + (X + 0.5) * S < c.max[0])) return; const kq = key(kk, j); if (seen.has(kq)) return; seen.set(kq, 1); q.push([kk, j]); });
  }
}
const roofs = new Map(); let n = 0;
for (const [kq] of seen) { const k = Math.floor(kq / 8), i = kq % 8, [y, src] = surf[k][i]; n++; if (/^(bina|çevre|titanic|B-penceresi)/.test(String(src))) { const r = roofs.get(src) || { n: 0, y, x: B.minX + ((k % nx) + 0.5) * S, z: B.minZ + (((k / nx) | 0) + 0.5) * S }; r.n++; roofs.set(src, r); } }
console.log('ulaşılan yüzey hücresi', n, '· çatı / duvar tepesi', roofs.size);
for (const [src, r] of [...roofs].sort((a, b) => b[1].n - a[1].n).slice(0, 20)) console.log(`  ${src}: ${r.n} hücre, y ${r.y.toFixed(2)} örn. (${r.x.toFixed(1)}, ${r.z.toFixed(1)})`);
