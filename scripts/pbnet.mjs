// Paintball çevrimiçi testi: iki gerçek istemci aynı odada (BF_DEBUG=1 sunucu). A, B'ye paintball tüfeğiyle sıkar.
// Ölçülür: A'nın tahmin ettiği isabet ↔ sunucunun onayı ('pbh' + hitmarker), B'nin A'nın toplarını görmesi ('pb'), iki ekrandaki duvar lekesi
// konumlarının aynılığı (sunucu kuantize başlangıçla simüle eder), B'nin canı. Görüntü: /tmp/wb-pb-shots/net-*.png
//   node scripts/pbnet.mjs [http://127.0.0.1:5192] [ws://127.0.0.1:8792]
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = process.argv[2] || 'http://127.0.0.1:5192', WS = process.argv[3] || 'ws://127.0.0.1:8792', OUT = '/tmp/wb-pb-shots';
fs.mkdirSync(OUT, { recursive: true });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
// GPU=1: gerçek GPU (headless değil; swiftshader'da iki sayfa çok yavaş kalıp tahmin/sunucu adımları kayabiliyor)
const GPU = !!process.env.GPU;
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
async function open(q) {
  const page = await browser.newPage({ viewport: GPU ? { width: 960, height: 540 } : { width: 480, height: 270 } });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?${new URLSearchParams({ debug: '1', nolock: '1', server: WS, cls: 'assault', ...q })}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier', null, { timeout: 90000 });
  await page.evaluate(() => {                                                       // olay sayaçları
    const g = window.__game, S = (window.__S = { pb: {}, pbh: [], hm: 0, splats: [] });
    const on = g.paint.onNet.bind(g.paint);
    g.paint.onNet = (ev) => { if (ev.e === 'pb') S.pb[ev.by] = (S.pb[ev.by] || 0) + 1; else S.pbh.push(ev); return on(ev); };
    const sp = g.paint._splat.bind(g.paint);
    g.paint._splat = (x, y, z, ...r) => { S.splats.push([x, y, z]); return sp(x, y, z, ...r); };
    g.on('hitmark', () => S.hm++);
  });
  return page;
}
const A = await open({ online: 'new', type: 'dm', per: '6', map: 'kasaba', diff: 'easy', bots: '1', name: 'Ali' });
const code = await A.evaluate(() => window.__game.opts.online.room);
const B = await open({ online: code, name: 'Veli' });
console.log('oda', code);
await A.evaluate(() => { const n = window.__game.online; n.send({ t: 'dbg', bots: false }); n.send({ t: 'dbg', pb: 1 }); });
// yerel oyuncunun eşyaları istemciye doğuşta gelir (yükleme = doğuş anı; mod da böyle verecek): ikisi de ölüp yeniden doğsun
for (const p of [A, B]) await p.evaluate(() => { const n = window.__game.online; n.send({ t: 'dbg', kill: 1 }); n.send({ t: 'dbg', kill: 1 }); });     // ilki doğma korumasını kaldırır
await A.waitForFunction(() => { const s = window.__game.playerSoldier; return s.alive && s.item.id === 'pbrifle'; }, null, { timeout: 20000 }).catch(() => {});
await B.waitForFunction(() => { const s = window.__game.playerSoldier; return s.alive && s.item.id === 'pbrifle'; }, null, { timeout: 20000 }).catch(() => {});
await A.waitForTimeout(500);
const fps = await Promise.all([A, B].map((p) => p.evaluate(() => Math.round(window.__game._perf?.fps || 0))));
console.log('FPS', fps);
const ids = await Promise.all([A, B].map((p) => p.evaluate(() => ({ id: window.__game.playerSoldier.id, item: window.__game.playerSoldier.item.id }))));
console.log('A', ids[0], 'B', ids[1]);
check(ids[0].item === 'pbrifle' && ids[1].item === 'pbrifle', 'iki istemcide de paintball tüfeği (sunucu yüklemesi istemciye geldi)');
// ikisini açık bir yere ışınla: A (x,z), B 12 m ötede
const spot = await A.evaluate(() => {
  const g = window.__game, V = g.camera.position.constructor;
  for (let k = 0; k < 4000; k++) {
    const x = -50 + Math.random() * 100, z = -50 + Math.random() * 100, bx = x + 12;
    if (!g.nav.isFree(x, z) || !g.nav.isFree(bx, z)) continue;
    const a = new V(x, g.world.heightAt(x, z) + 1.6, z), b = new V(bx, g.world.heightAt(bx, z) + 1.1, z);
    if (g.world.clear(a, b) && g.world.clear(a.clone().setY(a.y + 0.6), b.clone().setY(b.y + 0.9))) {
      // B'nin arkasında 4-20 m'de duvar olsun (kaçan toplar leke bıraksın)
      const w = g.world.raycast(b, new V(1, 0, 0), 25, {});
      if (w && w.t > 3) return [x, z, bx];
    }
  }
  return null;
});
check(!!spot, 'açık atış yeri bulundu');
await A.evaluate((s) => window.__game.online.send({ t: 'dbg', tp: [s[0], s[1]], hp: 99999 }), spot);
await B.evaluate((s) => window.__game.online.send({ t: 'dbg', tp: [s[2], s[1]], hp: 99999 }), spot);
await A.waitForTimeout(1200);
for (const p of [A, B]) await p.evaluate(() => { const S = window.__S; S.pb = {}; S.pbh = []; S.hm = 0; S.splats = []; window.__game.paint.stats.hits = 0; window.__game.paint.stats.fired = 0; setInterval(() => window.__game.online.send({ t: 'dbg', hp: 99999 }), 300); });
// A, B'ye 2 sn gövdeye + 1,5 sn yana sıkar (düşüş telafili; 50'lik hazne bitmesin: cephane sunucuda, istemcide hile yok)
await A.evaluate((bid) => {
  const g = window.__game, me = g.playerSoldier, p = g.player, o = g.camera.position.clone(), st = { speed: 78, grav: 4 };
  window.__aim = setInterval(() => {
    const b = g.soldiers[bid]; if (!me.alive || !b.alive) { p.fireHeld = false; return; }
    const now = performance.now(), L = (window.__L ||= { x: b.pos.x, z: b.pos.z, t: now, vx: 0, vz: 0 }), dtt = (now - L.t) / 1000;
    if (dtt > 0.05) { L.vx = (b.pos.x - L.x) / dtt; L.vz = (b.pos.z - L.z) / dtt; L.x = b.pos.x; L.z = b.pos.z; L.t = now; }     // ekranda gördüğüm hız → topun uçuş süresi kadar önünü al
    me.eye(o); const h0 = Math.hypot(b.pos.x - o.x, b.pos.z - o.z), tf = h0 / st.speed;
    const side = window.__miss ? 1.6 : 0, dx = b.pos.x + L.vx * tf - o.x, dz = b.pos.z + L.vz * tf + side - o.z, dy = b.pos.y + 1.05 - o.y, h = Math.hypot(dx, dz), t = h / st.speed;
    me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(dy, h) + Math.atan2(0.5 * st.grav * t * t, h) - me.recoilP;
    me.ads = true; p.fireHeld = true;
  }, 8);
}, ids[1].id);
if (process.env.MOVE !== '0') { await B.evaluate(() => { window.__game.playerSoldier.yaw = 0; window.__game.playerSoldier.pitch = 0; }); await B.keyboard.down('KeyW'); }                         // B koşuyor (A'ya dik: B, A'nın +x'inde, ileri = yaw yönü); lag comp gerçekten gerekir
const bp0 = await A.evaluate((bid) => { const p = window.__game.soldiers[bid].pos; return [p.x, p.z]; }, ids[1].id);
await A.waitForTimeout(1200);
await A.screenshot({ path: `${OUT}/net-1-A-atiyor.png` });
await B.screenshot({ path: `${OUT}/net-2-B-vuruluyor.png` });
await A.waitForTimeout(800);
const bp1 = await A.evaluate((bid) => { const p = window.__game.soldiers[bid].pos; return [p.x, p.z]; }, ids[1].id);
console.log(`      B isabet aşamasında ${Math.hypot(bp1[0] - bp0[0], bp1[1] - bp0[1]).toFixed(1)} m koştu (A'nın ekranında)`);
await B.keyboard.up('KeyW').catch(() => {});
await A.evaluate(() => { window.__miss = true; });                                 // 1,5 sn yana sık: toplar B'nin arkasındaki duvara
await A.waitForTimeout(1500);
await A.evaluate(() => { clearInterval(window.__aim); window.__game.player.fireHeld = false; });
await A.waitForTimeout(1500);
const ra = await A.evaluate((bid) => { const g = window.__game, S = window.__S; return { fired: g.paint.stats.fired, pred: g.paint.stats.hits, conf: S.pbh.filter((e) => e.by === g.playerSoldier.id).length, hm: S.hm, marksOnB: g.soldiers[bid]._pbMarks?.length || 0, splats: S.splats }; }, ids[1].id);
const rb = await B.evaluate((aid) => { const S = window.__S; return { remoteBalls: S.pb[aid] || 0, hitsOnMe: S.pbh.filter((e) => e.v === window.__game.playerSoldier.id).length, splats: S.splats }; }, ids[0].id);
console.log(`      A: ${ra.fired} top, tahmini isabet ${ra.pred}, sunucu 'pbh' ${ra.conf}, hitmarker ${ra.hm}, B üstünde ${ra.marksOnB} leke, ${ra.splats.length} duvar lekesi`);
console.log(`      B: A'nın ${rb.remoteBalls} topunu gördü, kendine ${rb.hitsOnMe} isabet olayı, ${rb.splats.length} duvar lekesi`);
check(ra.fired >= 30, 'A tam otomatik ateş etti (tahmini toplar)');
check(rb.remoteBalls >= ra.fired - 3 && rb.remoteBalls <= ra.fired + 3, 'B, A\'nın toplarını sunucu olayıyla gördü (sayı tutuyor)');
check(ra.conf >= 10 && ra.hm >= 10, 'sunucu isabetleri onayladı (pbh + hitmarker)');
check(Math.abs(ra.pred - ra.conf) <= Math.max(3, ra.conf * 0.2), `tahmin ↔ sunucu isabeti tutarlı (${ra.pred} / ${ra.conf})`);
check(ra.marksOnB > 0, 'A ekranında B\'nin üstünde boya lekesi var');
// duvar lekeleri: B ekranındaki (sunucu olayından simüle) lekelerin her biri A ekranındaki (tahmin) bir lekeyle ~aynı yerde
let match = 0;
for (const s of rb.splats) if (ra.splats.some((t) => Math.hypot(t[0] - s[0], t[1] - s[1], t[2] - s[2]) < 0.25)) match++;
console.log(`      duvar lekesi eşleşmesi: B'deki ${rb.splats.length} lekenin ${match} tanesi A'dakiyle aynı yerde (<25 cm)`);
check(rb.splats.length >= 5 && match >= rb.splats.length * 0.7, 'iki istemci kaçan topların lekesini aynı yerde görüyor (tohumlu saçılım + kuantize başlangıç)');
console.log('hata:', errs.length, errs.slice(0, 4));
check(errs.length === 0, 'sayfa hatası yok');
await browser.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
