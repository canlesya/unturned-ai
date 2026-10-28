// 12.213 bayrak çevresi kum torbası mevzilerini (kuzeyRural.sandbagNest, 4,2 × 2,8, ön duvar −z yerel) çarpışmadan çıkarır: merkez + ry (ön yüzün yönü)
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
const { buildKuzey } = await import('../src/maps/kuzey.js');
const { FLAGS } = await import('../src/maps/assets/kuzey/layout.js');
const map = buildKuzey(), T = map.terrain;
const by = new Map();
for (const c of map.colliders) if (String(c.oid).startsWith('mevzi:')) { if (!by.has(c.oid)) by.set(c.oid, []); by.get(c.oid).push(c); }
const out = [];
for (const [id, L] of by) {
  const x0 = Math.min(...L.map((c) => c.min[0])), x1 = Math.max(...L.map((c) => c.max[0])), z0 = Math.min(...L.map((c) => c.min[2])), z1 = Math.max(...L.map((c) => c.max[2]));
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = x1 - x0 > z1 - z0;
  // ön duvar: uzun kenarlardan hangisinde (0,4 m içinde) en çok parça merkezi var
  const near = (fn) => L.filter(fn).length;
  let ry;
  if (alongX) { const nN = near((c) => Math.abs((c.min[2] + c.max[2]) / 2 - z0) < 0.45), nS = near((c) => Math.abs((c.min[2] + c.max[2]) / 2 - z1) < 0.45); ry = nN > nS ? 0 : Math.PI; }
  else { const nW = near((c) => Math.abs((c.min[0] + c.max[0]) / 2 - x0) < 0.45), nE = near((c) => Math.abs((c.min[0] + c.max[0]) / 2 - x1) < 0.45); ry = nW > nE ? Math.PI / 2 : -Math.PI / 2; }
  // sandbagNest yerel merkezi = ayak izinin ortası (w × d dikdörtgen)
  const f = FLAGS.map((q) => [q.id, Math.hypot(q.x - cx, q.z - cz)]).sort((a, b) => a[1] - b[1])[0];
  const top = Math.max(...L.map((c) => c.max[1]));
  out.push({ id, x: +cx.toFixed(2), z: +cz.toFixed(2), ry: +ry.toFixed(4), flag: f[0], fd: +f[1].toFixed(1), y: +T.heightAt(cx, cz).toFixed(2), top: +(top - T.heightAt(cx, cz)).toFixed(2), n: L.length });
}
out.sort((a, b) => a.flag.localeCompare(b.flag) || a.fd - b.fd);
for (const o of out) if (o.fd < 70) console.log(JSON.stringify(o));
