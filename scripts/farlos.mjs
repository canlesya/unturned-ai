// Uzun görüş hatlarında GÖRÜNEN geometri ↔ ÇARPIŞMA (mermi) uyuşmazlığı (12.146): rastgele yürünebilir noktadan göz yüksekliğinde rastgele yönde 160 m ışın;
// çizilen ağlara (THREE.Raycaster) ve çarpışma dünyasına (world.raycast) ilk çarpma mesafesi karşılaştırılır. "görünmez engel" = mermi görünen yüzeyden ≥ 0,7 m önce durur.
//   node scripts/farlos.mjs [harita=colgecidi] [url=http://127.0.0.1:5180]   env: N=600
import { chromium } from 'playwright';
const MAP = process.argv[2] || 'colgecidi', BASE = process.argv[3] || 'http://127.0.0.1:5180', N = +(process.env.N || 600);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
await page.goto(`${BASE}/?autostart=4v4&map=${MAP}&type=tdm&dev=1&debug=1&nolock=1`);
await page.waitForFunction(() => window.__game?.playerSoldier && window.__game.running, null, { timeout: 120000 });
const r = await page.evaluate(async (N) => {
  const g = window.__game; g.render = () => {}; g.brains.forEach((b) => (b.update = () => {}));
  const T = await import('/node_modules/.vite/deps/three.js');
  const rc = new T.Raycaster(), V = T.Vector3, b = g.map.bounds;
  // görünen, mermiyi durdurması beklenen geometri: harita grubundaki opak ağlar (yaprak / çalı / saydam / ışık süsleri hariç)
  for (const s of g.soldiers) { s.pos.set(s.pos.x + 900, s.pos.y - 300, s.pos.z + 900); s.syncModel?.(0.016); }
  g.scene.updateMatrixWorld(true);
  const meshes = [];
  g.scene.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    let p = o, hidden = false; while (p) { if (!p.visible) hidden = true; p = p.parent; }
    if (hidden) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.fog === false || m.side === T.BackSide || (m.transparent && m.opacity < 0.9) || m.blending === T.AdditiveBlending || m.alphaTest > 0) return;      // gök, bulut, saydam, yaprak (alphaTest)
    meshes.push(o);
  });
  const pts = [];
  for (let i = 0; i < 6000 && pts.length < 3000; i++) { const x = b.minX + Math.random() * (b.maxX - b.minX), z = b.minZ + Math.random() * (b.maxZ - b.minZ); if (g.nav.isFree(x, z)) pts.push([x, g.world.heightAt(x, z), z]); }
  // her ışın: rastgele noktadan, rastgele yönde, hafif aşağı / yukarı (−3°…+1,5°), 160 m — ilk çarpma mesafeleri karşılaştırılır
  const out = { n: 0, same: 0, invis: [], thru: [] };
  const o = new V(), d = new V();
  for (let k = 0; k < N; k++) {
    const A = pts[(Math.random() * pts.length) | 0], yaw = Math.random() * Math.PI * 2, pit = (-3 + Math.random() * 4.5) * Math.PI / 180;
    o.set(A[0], A[1] + 1.6, A[2]); d.set(Math.sin(yaw) * Math.cos(pit), Math.sin(pit), Math.cos(yaw) * Math.cos(pit));
    const wh = g.world.raycast(o, d, 160, {}), tw = wh ? wh.t : 160;
    rc.set(o, d); rc.far = 160;
    const vh = rc.intersectObjects(meshes, false)[0], tv = vh ? vh.distance : 160;
    out.n++;
    if (Math.abs(tw - tv) < 0.7) { out.same++; continue; }
    const P = (t) => [o.x + d.x * t, o.y + d.y * t, o.z + d.z * t].map((v) => +v.toFixed(1));
    if (tw < tv) out.invis.push({ at: P(tw), tw: +tw.toFixed(1), tv: +tv.toFixed(1), c: wh.collider ? { tag: wh.collider.tag, id: wh.collider.id, min: wh.collider.min?.map((v) => +v.toFixed(1)), max: wh.collider.max?.map((v) => +v.toFixed(1)) } : 'zemin' });
    else out.thru.push({ at: P(tv), tw: +tw.toFixed(1), tv: +tv.toFixed(1), name: vh.object.name || vh.object.parent?.name || vh.object.type });
  }
  return { ...out, meshes: meshes.length };
}, N);
console.log(`${MAP}: ${r.n} ışın (160 m) · aynı yerde duruyor ${r.same} · GÖRÜNMEZ ENGEL (mermi görüntüden önce duruyor) ${r.invis.length} · görüntü var, mermi geçiyor ${r.thru.length} · ağ ${r.meshes}`);
const grp = (list, key) => { const m = new Map(); for (const x of list) { const k = key(x); m.set(k, (m.get(k) || []).concat([x])); } return [...m.entries()].sort((a, b) => b[1].length - a[1].length); };
for (const [k, l] of grp(r.invis, (x) => JSON.stringify(x.c)).slice(0, 12)) console.log('  görünmez', l.length, 'x', k, 'ör.', JSON.stringify(l[0].at), 'tw/tv', l[0].tw, l[0].tv);
for (const [k, l] of grp(r.thru, (x) => x.name).slice(0, 8)) console.log('  çarpışmasız görüntü', l.length, 'x', k, 'ör.', JSON.stringify(l[0].at), 'tw/tv', l[0].tw, l[0].tv);
await browser.close();
