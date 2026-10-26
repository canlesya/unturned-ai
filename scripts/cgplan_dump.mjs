// 12.171 plan dönüştürücüsünün (tools/cg_plan.py) girdisi: ESKİ (radar tabanlı, edc5a75) Çöl Geçidi'ni kullanıcı düzenlemeleri uygulanmış hâliyle kurup
// nesnelerini JSON'a döker. Eski sürüm ayrı bir çalışma ağacında açılır (edc5a75), sonra:
//   node scripts/cgplan_dump.mjs <eski kök> /tmp/cg_old.json  →  python3 tools/cg_plan.py /tmp/cg_old.json src/maps/assets/colgecidi/plan.js [önizleme.png]
import fs from 'fs';
const R = process.argv[2];
const { MapBuilder } = await import(R + '/src/maps/builder.js');
MapBuilder.noVisual = true;
const { buildColGecidi, CALLOUTS } = await import(R + '/src/maps/colgecidi.js');
const D = (await import(R + '/src/maps/colgecidiData.js')).default;
const EDITS = (await import(R + '/src/maps/colgecidiEdits.js')).default;
const m = buildColGecidi();
const byOid = {};
for (const c of m.colliders) (byOid[c.oid] ||= []).push({ min: c.min.map((v) => +v.toFixed(3)), max: c.max.map((v) => +v.toFixed(3)), tag: c.tag || null });
// kasalar: veri + düzenleme (d, s)
const boxes = D.boxes.map((q, i) => {
  const e = EDITS.find((x) => x.id === 'kasa:' + i);
  const cs = byOid['kasa:' + i] || [];
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const c of cs) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], c.min[a]); mx[a] = Math.max(mx[a], c.max[a]); }
  return { i, cx: q[0], cz: q[1], w: q[2], d: q[3], ry: q[4], h: q[5], yoff: q[6] || 0, edit: e || null, bmin: mn, bmax: mx, n: cs.length };
});
// zemin kotu örneklemesi: eski arazi (tri) 0,25 m ızgarada (yeni ızgara x −66…66, z −71…71)
const T = m.terrain, gx0 = -66, gz0 = -71, gc = 0.25, gnx = 528, gnz = 568, G = new Array(gnx * gnz);
for (let j = 0; j < gnz; j++) for (let i = 0; i < gnx; i++) G[j * gnx + i] = +T.heightAt(gx0 + (i + 0.5) * gc, gz0 + (j + 0.5) * gc).toFixed(3);
fs.writeFileSync(process.argv[3], JSON.stringify({ byOid, boxes, polys: D.polys, cliffv: D.cliffv, zones: D.zones, bridge: D.bridge, CALLOUTS, spawns: m.spawns, objectives: m.objectives, x0: D.x0, z0: D.z0, nx: D.nx, nz: D.nz, cell: D.cell, G: { x0: gx0, z0: gz0, c: gc, nx: gnx, nz: gnz, v: G } }));
console.log('nesne', Object.keys(byOid).length, 'kasa', boxes.length);
