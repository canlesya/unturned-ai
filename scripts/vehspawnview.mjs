// 12.215 DOĞAN aracın ÇİZİLEN modeli zeminde mi (gerçek GPU, `headless:false`, `--use-angle=metal`): "yer altında doğan araçlar var hâlâ".
// vehspawnsink (başsız, yalnız fizik) ve vehdrive (yalnız sürülen + hareketli araç, batan / sinkT'li araç atlanır) doğuştaki görünümü ölçmüyordu.
// Senaryolar (her araç sırayla; kamera doğuştan sonra 0–1 sn 30 m, 1–2 sn 150 m, 2–3 sn 500 m'den izler):
//   ilk    — ilk doğuş (trySpawn)                        · patla — patlat (enkaz) → yeniden doğuş
//   terk   — 12.212 sessiz yok oluş (terk / batma) → yeniden doğuş · bayrak — bayrak aracı: bayrak ele geçirilince ilk doğuş
// Her karede (doğuştan 3 sn) modelin o karedeki matrisiyle teker / palet / kızak temas noktaları + gövde altı 9 × 3 ızgarası:
//   ağ   = gerçekten çizilen zemin: görünür harita ağlarına (arazi kademesi, plaklar, yollar; sis / su / örnekli ağaç hariç) yukarıdan ışın
//   fizik= arazi + içinde kalınan çarpışma kutusunun tepesi
// en kötü gömülme (teker > 0,12 m, gövde altı > 0,08 m = gömülü). Gömülü doğuşta oyun donar, uzak + yakın görüntü alınır.
//   Çevrimdışı: URL=http://127.0.0.1:5202 PER=10 SCEN=ilk,patla,terk,bayrak OUT=/tmp/wb-vsink/sonra node scripts/vehspawnview.mjs
//   Çevrim içi (sunucu doğurur, BF_DEBUG=1): WS=ws://127.0.0.1:8996 ... (sunucu { vrs } ile patlatır / sessiz yok eder, { obj } ile bayrak verir)
//   ENV: MAP=kuzey · ONLY=araç kimlikleri (virgül) · LIMIT=n (senaryo başına araç) · SHOTS=6. Çıkış kodu: gömülü doğuş varsa 1.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5202', WS = process.env.WS || '', OUT = process.env.OUT || '/tmp/wb-vsink/shots';
const PER = +(process.env.PER || 10), MAP = process.env.MAP || 'kuzey', SHOTS = +(process.env.SHOTS ?? 6), LIMIT = +(process.env.LIMIT || 1e9);
const SCEN = (process.env.SCEN || 'ilk,patla,terk,bayrak').split(','), ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const q = `map=${MAP}&type=conquest&dev=1&debug=1&nolock=1&nologin=1&tod=day&weather=clear`;
await page.goto(WS ? `${URL0}/?online=new&per=${PER}&bots=1&time=3600&team=blue&name=Izleyen&server=${encodeURIComponent(WS)}&${q}` : `${URL0}/?autostart=${PER}v${PER}&${q}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.vehicles', null, { timeout: 300000 });
await page.waitForTimeout(3000);
await page.evaluate(async () => {
  const g = window.__game, VS = await import('/src/sim/vehicle.js'), THREE = await import('/node_modules/three/build/three.module.js'), W = g.world, c = g.camera, me = g.playerSoldier;
  if (g.online) g.online.send({ t: 'dbg', bots: false }); else { g.devGod = true; me.fly = true; g.brainsOff = g.brains.splice(0); }
  g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  const mapG = g.scene.children.find((o) => o.name === g.map.id) || g.scene.children.find((o) => o.isGroup && o.children.length > 100);
  const rc = new THREE.Raycaster(), _v = new THREE.Vector3(), dn = new THREE.Vector3(0, -1, 0);
  const skipName = /pus|water|sky|gök/i;
  const meshes = () => { const L = []; mapG.traverseVisible((o) => { if (!o.isMesh || o.isInstancedMesh || o.userData.water || (o.material?.transparent && o.material.depthWrite === false)) return; for (let p = o; p && p !== mapG; p = p.parent) if (skipName.test(p.name || '')) return; L.push(o); }); return L; };
  const S = (window.__S = { rows: {}, tgt: null, born: new Map(), cap: null, capN: 0 });
  g.on('vehspawn', (v) => S.born.set(v.idx, performance.now()));
  // modelin o karedeki temas noktaları (vehicleView.groundLift ile aynı küme) → { ağ, fizik } en kötü gömülme
  function measure(v, it, ML) {
    const d = v.def, m = it.model; m.updateMatrixWorld(true);
    const M = m.matrixWorld, tr = d.moto ? 0 : d.tr / 2, hf = d.wb / 2;
    const F = d.tracked ? [hf, hf / 2, 0, -hf / 2, -hf] : [hf, -hf], pts = [];
    for (const f of F) for (const r of tr ? [-tr, tr] : [0]) pts.push([r, 0, -f, 0]);
    if (!d.heli) for (let i = 0; i <= 8; i++) for (const r of d.moto ? [0] : [-d.hw, 0, d.hw]) pts.push([r, d.clear, -(-d.hl + i * d.hl / 4), 0.04]);
    const R = { mesh: -9, phys: -9, obj: '', at: null };
    for (const [x, y, z, e] of pts) {
      _v.set(x, y, z).applyMatrix4(M); const px = _v.x, py = _v.y, pz = _v.z;
      let pp = W.heightAt(px, pz) - py;
      for (const cc of W.query(px - 0.05, pz - 0.05, px + 0.05, pz + 0.05, [])) { if (px <= cc.min[0] || px >= cc.max[0] || pz <= cc.min[2] || pz >= cc.max[2]) continue; if (cc.min[1] < py && cc.max[1] > py && cc.max[1] < py + 2.5) pp = Math.max(pp, cc.max[1] - py); }
      rc.set(_v.set(px, py + 2.5, pz), dn); rc.far = 6;
      const hit = rc.intersectObjects(ML, false)[0], mm = hit ? hit.point.y - py : -9;
      if (pp + e > R.phys) R.phys = pp + e;
      if (mm + e > R.mesh) { R.mesh = mm + e; R.obj = hit ? (hit.object.userData.terrain ? 'arazi' : hit.object.name || hit.object.parent?.name || 'ağ') : ''; R.at = [+px.toFixed(1), +py.toFixed(2), +pz.toFixed(1)]; }
    }
    return R;
  }
  const DS = [30, 150, 500];
  const orig = g.render.bind(g);
  g.render = function () {
    const v = S.tgt != null ? g.vehicles.list[S.tgt] : null, t0 = v ? S.born.get(v.idx) : null, age = t0 != null ? (performance.now() - t0) / 1000 : -1;
    const D = age < 0 ? 30 : DS[Math.min(2, Math.floor(age))];
    if (v?.st && !S.cap) {
      const st = v.st, a = 0.7 + v.idx;
      const px = st.x + Math.sin(a) * D, pz = st.z + Math.cos(a) * D, py = Math.max(W.heightAt(px, pz) + 2, st.y + 1.5 + D * 0.15);
      c.position.set(px, py, pz); c.lookAt(st.x, st.y + 0.5, st.z); c.fov = Math.max(4, Math.min(55, 55 * 14 / Math.max(14, D))); c.updateProjectionMatrix();
      if (!g.online) { me.pos.set(px, py - 1.6, pz); me.vel.set(0, 0, 0); }
    }
    orig();
    if (S.cap || !v?.st || !v.alive || age < 0 || age > 3) return;
    const it = g.vehView.items[v.idx]; if (!it?.model?.visible) return;
    const R = measure(v, it, (S.ML && S.MLD === D) ? S.ML : (S.MLD = D, S.ML = meshes()));
    const row = S.rows[S.key]; row.n++;
    const k = String(D), o = (row.D[k] ||= { mesh: -9, phys: -9 });
    o.mesh = Math.max(o.mesh, +R.mesh.toFixed(3)); o.phys = Math.max(o.phys, +R.phys.toFixed(3));
    if (R.mesh > row.worst) { row.worst = +R.mesh.toFixed(3); row.obj = R.obj; row.at = R.at; row.wD = D; row.age = +age.toFixed(2); row.lift = +(it.lift || 0).toFixed(2); row.sinkT = +(it.sinkT || 0).toFixed(2); row.y = +v.st.y.toFixed(2); }
    if (Math.max(R.mesh, R.phys) > 0.12 && S.capN < S.SHOTS && !row.shot) {
      row.shot = true; S.cap = { key: S.key, idx: v.idx, D, sink: +R.mesh.toFixed(2), phys: +R.phys.toFixed(2), age: +age.toFixed(2), sinkT: +(it.sinkT || 0).toFixed(2) };
      if (!g.online) g.simulate = false; else { S._ni = g.vehicles.netInterp; g.vehicles.netInterp = () => {}; }
    }
  };
}, null);
await page.evaluate((n) => { window.__S.SHOTS = n; }, SHOTS);

// senaryoyu başlat (çevrimdışı: doğrudan yönetici; çevrim içi: sunucuya dbg) → aracın doğuşunu bekle
const start = (i, sc) => page.evaluate(([i, sc]) => {
  const g = window.__game, V = g.vehicles, v = V.list[i], S = window.__S, on = !!g.online;
  S.born.delete(i);
  if (sc === 'bayrak') {
    const f = v.spawn.team.slice(5), oi = g.mode.objectives.findIndex((o) => o.id === f), cur = g.mode.objectives[oi].owner, nt = cur === 'blue' ? 'red' : 'blue';
    if (on) { if ((S.flip ||= new Set()).has(oi)) return null; S.flip.add(oi); g.online.send({ t: 'dbg', obj: [oi, null, 0] }); return { oi, nt }; }      // çevrim içi: bayrağın öteki araçları aynı ele geçirmede doğar (ilk aracı izlenir)
    v.alive = false; v.wreck = false; v.st = null; v.spawnN = 0; g.mode.objectives[oi].owner = null; return { oi, nt };
  }
  if (!V.spawnTeam(v) && v.spawn.team) return null;                   // sahipsiz bayrağın aracı yok (tarafsız yol aracı: team null → doğar)
  if (sc === 'ilk') { if (on) return null; v.alive = false; v.wreck = false; v.st = null; V.trySpawn(v, true); return {}; }
  if (on) { g.online.send({ t: 'dbg', vrs: [i, sc === 'terk' ? 1 : 0] }); return {}; }
  if (!v.alive) V.trySpawn(v, true);
  V.destroy(v, null, sc === 'terk'); v.deadT = v.def.wreck; return {};
}, [i, sc]);
const kick = (i, sc, info) => page.evaluate(([i, sc, info]) => {
  const g = window.__game, V = g.vehicles, v = V.list[i], on = !!g.online;
  if (sc === 'bayrak') { if (on) g.online.send({ t: 'dbg', obj: [info.oi, info.nt, info.nt === 'blue' ? 1 : -1] }); else g.mode.objectives[info.oi].owner = info.nt; return; }
  if (sc === 'ilk') return;
  if (on) g.online.send({ t: 'dbg', vrs: [i, sc === 'terk' ? 1 : 0] }); else if (!v.alive && !v.wreck) v.respawnT = 0;
}, [i, sc, info]);

const list = await page.evaluate(() => window.__game.vehicles.list.map((v) => ({ i: v.idx, id: v.id, type: v.type, fixed: !!v.def.fixed, flag: typeof v.spawn.team === 'string' && v.spawn.team.startsWith('flag:') })));
const res = [];
let shotI = 0;
for (const sc of SCEN) {
  if (sc === 'ilk' && WS) continue;                                     // çevrim içi ilk doğuş = katılımdaki anlık görüntü (aşağıda 'katılım')
  let k = 0;
  for (const V of list) {
    if (V.fixed || (ONLY && !ONLY.includes(V.id)) || (sc === 'bayrak' && !V.flag)) continue;
    if (k++ >= LIMIT) break;
    const key = `${sc}:${V.id}`;
    await page.evaluate(([key, V, sc]) => { window.__S.rows[key] = { sc, id: V.id, type: V.type, idx: V.i, n: 0, worst: -9, D: {} }; window.__S.key = key; window.__S.tgt = V.i; }, [key, V, sc]);
    const info = await start(V.i, sc);
    if (info === null) continue;
    let born = false;
    for (let w = 0; w < 40 && !born; w++) {                            // doğuşu bekle (en çok ~12 sn)
      await page.waitForTimeout(w ? 300 : 150);
      born = await page.evaluate((i) => window.__S.born.has(i), V.i);
      if (!born && w % 3 === 0) await kick(V.i, sc, info);
    }
    if (!born) { res.push({ key, miss: true }); continue; }
    for (let t = 0; t < 14; t++) {
      await page.waitForTimeout(250);
      const cap = await page.evaluate(() => window.__S.cap);
      if (!cap) continue;
      const nm = `${String(++shotI).padStart(2, '0')}-${sc}-${V.id}-${V.type}`;
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${OUT}/${nm}-${cap.D}m.png` });
      await page.evaluate((cap) => {                                    // yakından (aynı donmuş kare): yandan 8 m, alçaktan
        const g = window.__game, st = g.vehicles.list[cap.idx].st, c = g.camera, rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
        const px = st.x + rx * 8, pz = st.z + rz * 8; window.__S.hold = [px, Math.max(g.world.heightAt(px, pz) + 1, st.y + 1), pz, st.x, st.y + 0.3, st.z];
        const o = g.render; g._oRender = o; g.render = function () { const h = window.__S.hold; c.position.set(h[0], h[1], h[2]); c.lookAt(h[3], h[4], h[5]); c.fov = 50; c.updateProjectionMatrix(); o(); };
      }, cap);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${nm}-yakin.png` });
      console.log('görüntü', nm, JSON.stringify(cap));
      await page.evaluate(() => { const g = window.__game, S = window.__S; g.render = g._oRender; S.cap = null; S.capN++; if (!g.online) g.simulate = true; else g.vehicles.netInterp = S._ni; });
      break;
    }
    await page.waitForTimeout(400);
    const row = await page.evaluate((key) => window.__S.rows[key], key);
    res.push(row);
  }
}
const rows = res.filter((r) => !r.miss), miss = res.filter((r) => r.miss);
const isBad = (r) => r.n && Math.max(r.worst, ...Object.values(r.D).map((o) => o.phys)) > 0.12;
const bad = rows.filter(isBad);
for (const sc of SCEN) {
  const R = rows.filter((r) => r.sc === sc); if (!R.length) continue;
  const B = R.filter(isBad), w = Math.max(...R.map((r) => r.worst)), wp = Math.max(...R.map((r) => Math.max(...Object.values(r.D).map((o) => o.phys))));
  console.log(`${(sc + '').padEnd(7)} ${String(R.length).padStart(3)} doğuş · gömülü ${B.length} · en kötü çizilen ${w.toFixed(2)} m · fizik ${wp.toFixed(2)} m${B.length ? ' · ' + B.slice(0, 6).map((r) => `${r.id}(${r.type}) ${r.worst.toFixed(2)} m ${r.wD} m'den, ${r.age} sn, sinkT ${r.sinkT}`).join(' · ') : ''}`);
}
if (miss.length) console.log('doğmayan:', miss.map((r) => r.key).join(' '));
console.log(`TOPLAM ${WS ? 'çevrim içi' : 'çevrimdışı'} ${MAP} ${PER}v${PER}: ${rows.length} doğuş · gömülü ${bad.length} · en kötü ${Math.max(0, ...rows.map((r) => r.worst)).toFixed(2)} m`);
fs.writeFileSync(`${OUT}/olcum.json`, JSON.stringify({ online: !!WS, map: MAP, per: PER, rows, miss }, null, 1));
if (errs.length) console.log('sayfa hataları:', errs.slice(0, 5));
await browser.close();
process.exit(bad.length || miss.length ? 1 : 0);
