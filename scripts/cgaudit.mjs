// Çöl Geçidi denetimi (tarayıcısız): spawn / hedef erişimi, kopuk cepler, yol uzunlukları.  node scripts/cgaudit.mjs
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildColGecidi } from '../src/maps/colgecidi.js';
import { NavGrid } from '../src/game/nav.js';
const m = buildColGecidi();
const nav = new NavGrid(m.colliders, m.bounds, m.terrain, !!m.layered);
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const s0 = m.spawns.blue[0];
const seen = nav.reachable(s0.x, s0.z);
const at = (x, z) => { const i = nav.nearestFree(x, z, 6); return i >= 0 && seen[i]; };
check(m.spawns.blue.length >= 24 && m.spawns.red.length >= 24, `doğuş sayısı mavi ${m.spawns.blue.length} · kırmızı ${m.spawns.red.length}`);
check(m.spawns.blue.every((s) => at(s.x, s.z)) && m.spawns.red.every((s) => at(s.x, s.z)), 'her doğuş noktası mavi doğuştan yürünerek erişilebilir');
for (const o of m.objectives) check(at(o.x, o.z), `hedef ${o.id} (${o.x.toFixed(0)},${o.z.toFixed(0)}) erişilebilir`);
let free = 0, reach = 0;
for (let i = 0; i < nav.w * nav.h; i++) if (!nav.blocked[i]) { free++; if (seen[i]) reach++; }
// kopuk cepler: erişilemeyen serbest hücrelerin bağlantılı bileşenleri
const comp = new Int32Array(nav.w * nav.h), pockets = []; let cid = 0;
for (let i = 0; i < nav.w * nav.h; i++) {
  if (nav.blocked[i] || seen[i] || comp[i]) continue;
  cid++; let n = 0, sx = 0, sz = 0; const st = [i]; comp[i] = cid;
  while (st.length) { const k = st.pop(); n++; sx += nav.cx(k); sz += nav.cz(k); for (const d of [1, -1, nav.w, -nav.w]) { const j = k + d; if (j < 0 || j >= comp.length || nav.blocked[j] || seen[j] || comp[j]) continue; comp[j] = cid; st.push(j); } }
  pockets.push({ n, x: +(sx / n).toFixed(1), z: +(sz / n).toFixed(1) });
}
const big = pockets.filter((p) => p.n >= 8).sort((a, b) => b.n - a.n);
console.log(`serbest hücre ${free}, erişilebilir ${reach}, kopuk cep ${pockets.length} (≥8 hücre: ${big.length})`, big.slice(0, 8).map((p) => `${p.n}@(${p.x},${p.z})`).join(' '));
// yol uzunlukları: her doğuştan hedeflere
for (const side of ['blue', 'red']) {
  const sp = m.spawns[side][0];
  const row = m.objectives.map((o) => { const p = nav.findPath(sp.x, sp.z, o.x, o.z, 1.2); let L = 0; if (p) for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); return `${o.id}:${p ? L.toFixed(0) + 'm' : 'YOK'}`; });
  console.log(side, 'yol uzunluğu', row.join(' '));
}
if (process.env.VIZ) {
  const { chromium } = await import('playwright');
  const W = nav.w, H = nav.h, cv = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { const c = nav.blocked[i] ? [60, 50, 40] : seen[i] ? [80, 190, 110] : [210, 70, 70]; cv.set([...c, 255], i * 4); }
  const mk = (x, z, c) => { const i = nav.idx(x, z); if (i >= 0 && i < W * H) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) cv.set([...c, 255], (i + dz * W + dx) * 4); };
  for (const s of m.spawns.blue) mk(s.x, s.z, [60, 120, 255]);
  for (const s of m.spawns.red) mk(s.x, s.z, [255, 90, 60]);
  for (const o of m.objectives) mk(o.x, o.z, [255, 255, 0]);
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: W * 3, height: H * 3 } });
  await pg.setContent(`<body style="margin:0"><canvas id=c width=${W} height=${H} style="width:${W * 3}px;height:${H * 3}px;image-rendering:pixelated"></canvas></body>`);
  await pg.evaluate(([d, W, H]) => { const c = document.getElementById('c'); c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d), W, H), 0, 0); }, [Array.from(cv), W, H]);
  await pg.screenshot({ path: 'screenshots/cg-nav.png' }); await b.close();
}
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK');
process.exit(fail ? 1 : 0);
