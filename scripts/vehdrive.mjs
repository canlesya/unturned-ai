// 12.209 HAREKETLİ araç zemin denetimi (gerçek GPU, Kuzey Vadisi, Ele Geçirme, botlar sürüyor): "bazı motorlar ve jipler yerin altından gidiyor".
// Kamera sürücülü + hareketli bir jip / motoru izler (uzaklık sırayla 15 / 60 / 140 / 240 / 420 / 700 m), her karede ÇİZİLEN modelin (model
// matrisi: konum + eğim + yatış + görsel süspansiyon + lodLift) teker temas noktaları ve gövde altı ızgarası ölçülür:
//   · çizilen zemin (TerrainMesh.renderedHeightAt: yığının o karedeki kademesi; üstüne basılan kutu tepesi fizikten) − teker temas noktası
//     (> 0,12 m = gömülü), çizilen zemin − gövde altı (u = clear; > 0,08 m = gövde arazinin içinde);
//   · aynı ölçü fizik zeminiyle (groundAt) — ayrım: görsel mi, fizik mi.
// Uzaklık kovası başına örnek / gömülme oranı / en kötü (m). En kötü örneklerde oyun donar (çevrimdışı: sim durur; çevrim içi: ara değerleme durur),
// o anki kameradan + yakından görüntü alınır.
//   Çevrimdışı: URL=http://127.0.0.1:5214 OUT=/tmp/wb-vdrive/once SECS=150 node scripts/vehdrive.mjs
//   Çevrim içi (sunucu botları sürer, araçlar bu istemcide uzak): WS=ws://127.0.0.1:9014 ... node scripts/vehdrive.mjs
//   ENV: SHOTS=4 (en kötü görüntü sayısı) · PER=32 · JSON çıktısı OUT/olcum.json. Çıkış kodu: gömülme oranı > %0,5 ya da en kötü > 0,25 m → 1.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5214', WS = process.env.WS || '', OUT = process.env.OUT || '/tmp/wb-vdrive/shots';
const SECS = +(process.env.SECS || 150), SHOTS = +(process.env.SHOTS ?? 4), PER = +(process.env.PER || 32);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const q = 'map=kuzey&type=conquest&dev=1&debug=1&nolock=1&nologin=1&tod=day&weather=clear';
await page.goto(WS ? `${URL0}/?online=new&per=${PER}&bots=1&time=3600&team=blue&name=Izleyen&server=${encodeURIComponent(WS)}&${q}` : `${URL0}/?autostart=${PER}v${PER}&${q}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 300000 });
await page.waitForTimeout(3000);
await page.evaluate(async () => {
  const g = window.__game, VS = await import('/src/sim/vehicle.js'), me = g.playerSoldier, c = g.camera;
  if (!g.online) { g.devGod = true; me.fly = true; }
  g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  const tm = g.map.fx.tm, W = g.world, _v = new (c.position.constructor)();
  const S = (window.__S = { buckets: {}, worst: [], cap: null, capN: 0, tgt: null, D: 60, frames: 0 });
  const BK = [40, 150, 300, 600, 1e9], bk = (d) => BK.findIndex((b) => d < b);
  // çizilen zemin: arazi ağı (o anki kademe) + fiziğin üstüne çıkılan kutu tepesi (köprü / bordür: ayrı ağ, fizikle aynı)
  const rGround = (x, z, ref, up) => { const h = W.heightAt(x, z), gp = VS.groundAt(W, x, z, ref, up); return gp > h + 0.01 ? gp : tm.renderedHeightAt(x, z); };
  const orig = g.render.bind(g);
  g.render = function () {
    const t = S.tgt != null ? g.vehicles.list[S.tgt] : null;
    if (t?.st) {                                                          // kamera aracı izler (yandan-arkadan, D m)
      const st = t.st, D = S.D, fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
      const px = st.x - fx * D * 0.75 + rx * D * 0.66, pz = st.z - fz * D * 0.75 + rz * D * 0.66;
      const py = Math.max(W.heightAt(px, pz) + 2, st.y + 1.5 + D * 0.12);
      c.position.set(px, py, pz); c.lookAt(st.x, st.y + 0.7, st.z); c.fov = Math.max(4, Math.min(55, 55 * 14 / Math.max(14, D))); c.updateProjectionMatrix();
      if (!g.online) { me.pos.set(px, py - 1.6, pz); me.vel.set(0, 0, 0); }
    }
    orig();
    if (S.cap) return;
    S.frames++;
    for (const it of g.vehView.items) {
      const v = it.v, st = v.st, m = it.model, d = v.def;
      if (!v.alive || !st || !m?.visible || d.heli || d.tracked || !v.seats.some(Boolean)) continue;
      const sp = Math.hypot(st.vx, st.vz); if (sp < 2) continue;
      m.updateMatrixWorld(true);
      const far = c.position.distanceTo(_v.set(st.x, st.y, st.z)), up = d.stepUp ?? 0.55;
      let wr = -9, wp = -9, hr = -9, hp = -9;
      const tr = d.moto ? 0 : d.tr / 2;
      for (const f of [d.wb / 2, -d.wb / 2]) for (const r of [-tr, tr]) {
        _v.set(r, 0, -f).applyMatrix4(m.matrixWorld);
        wr = Math.max(wr, rGround(_v.x, _v.z, _v.y + 0.05, up) - _v.y); wp = Math.max(wp, VS.groundAt(W, _v.x, _v.z, _v.y + 0.05, up) - _v.y);
      }
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 2; j++) {
        _v.set(-d.hw + j * d.hw, d.clear, -(-d.hl + (i / 8) * 2 * d.hl)).applyMatrix4(m.matrixWorld);
        hr = Math.max(hr, tm.renderedHeightAt(_v.x, _v.z) - _v.y); hp = Math.max(hp, W.heightAt(_v.x, _v.z) - _v.y);
      }
      const key = `${v.type}:${bk(far)}`, b = (S.buckets[key] ||= { n: 0, bad: 0, badP: 0, max: 0, maxP: 0 });
      const sink = Math.max(wr, hr + 0.04), sinkP = Math.max(wp, hp + 0.04);           // gövde eşiği 0,08 = teker eşiği 0,12 − 0,04
      b.n++; if (sink > 0.12) b.bad++; if (sinkP > 0.12) b.badP++;
      b.max = Math.max(b.max, sink); b.maxP = Math.max(b.maxP, sinkP);
      if (sink > 0.15 && S.capN < S.SHOTS && !S.cap && (!S.lastCap || performance.now() - S.lastCap > 4000)) {
        const lod = tm.chunks[Math.floor((st.z - tm.T.minZ) / 200) * tm.nc + Math.floor((st.x - tm.T.minX) / 200)]?.lod;
        S.cap = { idx: v.idx, type: v.type, x: +st.x.toFixed(1), y: +st.y.toFixed(2), z: +st.z.toFixed(1), far: +far.toFixed(0), sink: +sink.toFixed(2), wheel: +wr.toFixed(2), hull: +hr.toFixed(2), phys: +sinkP.toFixed(2), lod, air: st.air, sp: +sp.toFixed(1), lift: +(m.position.y - st.y).toFixed(2), cam: c.position.toArray(), fov: c.fov };
        if (!g.online) g.simulate = false; else { S._ni = g.vehicles.netInterp; g.vehicles.netInterp = () => {}; }
      }
    }
  };
}, null);
await page.evaluate((n) => { window.__S.SHOTS = n; }, SHOTS);
const DS = [15, 60, 140, 240, 420, 700];
const pick = () => page.evaluate((prev) => {
  const g = window.__game, L = g.vehicles.list.filter((v) => v.alive && v.st && !v.def.heli && !v.def.tracked && v.seats.some(Boolean) && Math.hypot(v.st.vx, v.st.vz) > 3);
  if (!L.length) return null;
  const o = L.filter((v) => v.idx !== prev); const v = (o.length ? o : L)[Math.floor(Math.random() * (o.length ? o : L).length)];
  return v.idx;
}, null);
const t0 = Date.now(); let k = 0, shotI = 0;
while (Date.now() - t0 < SECS * 1000) {
  const D = DS[k++ % DS.length], idx = await pick();
  await page.evaluate(([i, D]) => { window.__S.tgt = i; window.__S.D = D; }, [idx, D]);
  const tEnd = Date.now() + 5000;
  while (Date.now() < tEnd) {
    await page.waitForTimeout(250);
    const cap = await page.evaluate(() => window.__S.cap);
    if (cap) {
      const nm = `${String(++shotI).padStart(2, '0')}-${cap.type}-${cap.far}m`;
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${OUT}/${nm}.png` });
      // yakından (aynı donmuş kare): aracın yanından 9 m, alçaktan
      await page.evaluate((cap) => {
        const g = window.__game, v = g.vehicles.list[cap.idx], st = v.st, rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw), fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw);
        window.__S.tgt = null; const c = g.camera, px = st.x + rx * 7 - fx * 4, pz = st.z + rz * 7 - fz * 4;
        g._camHold = [px, Math.max(g.world.heightAt(px, pz) + 1.2, st.y + 1.1), pz, st.x, st.y + 0.4, st.z];
        const o = g.render; g.render = function () { const h = g._camHold; if (h) { c.position.set(h[0], h[1], h[2]); c.lookAt(h[3], h[4], h[5]); c.fov = 50; c.updateProjectionMatrix(); } o(); }; g._oRender = o;
      }, cap);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${nm}-yakin.png` });
      console.log('görüntü', nm, JSON.stringify(cap));
      await page.evaluate(() => { const g = window.__game, S = window.__S; g.render = g._oRender; g._camHold = null; S.cap = null; S.capN++; S.lastCap = performance.now(); if (!g.online) g.simulate = true; else g.vehicles.netInterp = S._ni; });
      break;
    }
  }
}
const S = await page.evaluate(() => ({ buckets: window.__S.buckets, frames: window.__S.frames, fps: window.__game.perf?.fps }));
const BN = ['<40', '40-150', '150-300', '300-600', '>600'];
let n = 0, bad = 0, max = 0;
const rows = Object.entries(S.buckets).sort().map(([k, b]) => { const [t, i] = k.split(':'); n += b.n; bad += b.bad; max = Math.max(max, b.max); return `${t.padEnd(4)} ${BN[+i].padEnd(8)} ${String(b.n).padStart(6)} örnek · gömülü %${(100 * b.bad / b.n).toFixed(2)} (fizik %${(100 * b.badP / b.n).toFixed(2)}) · en kötü ${b.max.toFixed(2)} m (fizik ${b.maxP.toFixed(2)})`; });
console.log(`── ${WS ? 'çevrim içi (uzak araçlar)' : 'çevrimdışı'} · ${S.frames} kare ──\n` + rows.join('\n'));
console.log(`TOPLAM ${n} örnek · gömülü %${(100 * bad / Math.max(1, n)).toFixed(2)} · en kötü ${max.toFixed(2)} m`);
fs.writeFileSync(`${OUT}/olcum.json`, JSON.stringify({ online: !!WS, n, bad, max, buckets: S.buckets }, null, 1));
if (errs.length) console.log('sayfa hataları:', errs.slice(0, 5));
await browser.close();
process.exit(bad / Math.max(1, n) > 0.005 || max > 0.25 ? 1 : 0);
