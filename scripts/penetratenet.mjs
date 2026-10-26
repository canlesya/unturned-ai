// 12.164 Delip geçme — ÇEVRİM İÇİ: sunucu isabeti = istemci tahmini. A = gerçek tarayıcı istemcisi (atıcı, mavi),
// B, C = ham ws istemcileri (kırmızı, insan), + kırmızı bot (beyinler susturulur). Üçü A'nın bakış hattında arka arkaya (2 m aralık) dizilir;
// A, B'nin GÖRDÜĞÜ (interpolasyonlu) göğsüne nişan alır, tek atış yapar. Sayılan: istemcinin kendi ışınında gösterdiği kan sayısı
// (shootRay tahmini) ↔ sunucunun onayladığı isabet (hm olayları, pn = kaçıncı hedef), B / C'nin sunucudaki can kaybı.
// Son bölüm: B ve C 100 canla, kafa hizası → tek mermide çifte öldürme; o anın ekran görüntüleri (OUT, varsayılan /tmp/wb-pen).
//   Sunucu: PORT=8891 ADMIN_PORT=8892 BF_DATA=/tmp/wb-pen-data BF_DEBUG=1 node server/index.js  (dist/ = npx vite build)
//   node scripts/penetratenet.mjs   env: WS=ws://127.0.0.1:8891 BASE=http://127.0.0.1:8891 MAP=colgecidi W=sniper,barrett,svd,ak47 D=20,60,100 N=6
import { chromium } from 'playwright';
import WebSocket from 'ws';
import fs from 'node:fs';
const WS = process.env.WS || 'ws://127.0.0.1:8891', BASE = process.env.BASE || 'http://127.0.0.1:8891', MAP = process.env.MAP || 'colgecidi';
const WEAPONS = (process.env.W || 'sniper,barrett,svd,ak47').split(','), DISTS = (process.env.D || '20,60,100').split(',').map(Number), N = +(process.env.N || 6);
const OUT = process.env.OUT || '/tmp/wb-pen'; fs.mkdirSync(OUT, { recursive: true });
const EXP = { sniper: 3, barrett: 3, railgun: 3, ww_sniper: 3, svd: 2, ww_bolt: 2 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 }, locale: process.env.LANG_UI || 'tr-TR' });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const q = new URLSearchParams({ online: 'new', type: 'tdm', per: '3', map: MAP, diff: 'normal', bots: '1', time: '3600', debug: '1', nolock: '1', server: WS, name: 'Atici', cls: 'sniper', team: 'blue', tickets: '999' });
await page.goto(`${BASE}/?${q}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.online', null, { timeout: 90000 });
await page.evaluate(() => { const g = window.__game; g.online.send({ t: 'dbg', bots: false }); });
const room = await page.evaluate(() => window.__game.opts.online?.room || new URLSearchParams(location.search).get('online'));
// B, C: ham istemciler (kırmızı), A'ya bakar, durur
const raw = (name) => new Promise((res) => {
  const w = new WebSocket(WS); w.last = null; w.id = null; w.q = 0; w.yw = 0; w.sh = [];
  w.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'welcome') w.id = m.id; if (m.t === 'snap') w.last = m.me.now; if (m.t === 'ev') for (const e of m.l) if (e.e === 'sh') w.sh.push(e); });
  w.on('open', () => { w.send(JSON.stringify({ t: 'join', room, name, team: 'red' })); w.tm = setInterval(() => w.send(JSON.stringify({ t: 'in', q: ++w.q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: w.yw, pt: 0, w: 0 })), 1000 / 60); res(w); });
});
const B = await raw('Hedef1'), C = await raw('Hedef2');
await wait(2500);
const info = await page.evaluate(([bid, cid]) => {
  const g = window.__game, me = g.playerSoldier;
  const bot = g.soldiers.find((s) => s.team === 'red' && s.id !== bid && s.id !== cid && !s.vacant);
  return { me: me.id, myTeam: me.team, b: [bid, g.soldiers[bid]?.team], c: [cid, g.soldiers[cid]?.team], bot: bot?.id };
}, [B.id, C.id]);
console.log('oda', room, JSON.stringify(info));
check(info.myTeam === 'blue' && info.b[1] === 'red' && info.c[1] === 'red' && info.bot != null, 'takımlar: A mavi, B / C / bot kırmızı');

// şerit: A'nın gözünden D, D+2, D+4 m'deki üç hedefin ayak / göğüs / başı görünür, yürünebilir, hedeflerin zemini düz (±0,25 m)
const lanes = await page.evaluate((DISTS) => {
  const g = window.__game, V = g.playerSoldier.pos.constructor, b = g.map.bounds, eye = new V(), tp = new V(), out = {};
  const dirs = Array.from({ length: 16 }, (_, a) => [Math.sin(a * Math.PI / 8), Math.cos(a * Math.PI / 8)]);
  for (const D of DISTS) {
    let found = null;
    for (let x = b.minX + 3; x < b.maxX - 3 && !found; x += 2) for (let z = b.minZ + 3; z < b.maxZ - 3 && !found; z += 2) {
      if (!g.nav.isFree(x, z)) continue;
      const y = g.world.heightAt(x, z); eye.set(x, y + 1.6, z);
      for (const [dx, dz] of dirs) {
        let ok = true; const y0 = g.world.heightAt(x + dx * D, z + dz * D);
        if (Math.abs(y0 - y) > 6) continue;
        for (const k of [-1, 0, 2, 4, 6]) {
          const tx = x + dx * (D + k), tz = z + dz * (D + k), ty = g.world.heightAt(tx, tz);
          if (!g.nav.isFree(tx, tz) || Math.abs(ty - y0) > 0.25) { ok = false; break; }      // hedeflerin zemini birbirine göre düz (atıcı 6 m'ye kadar yüksek / alçak olabilir)
          for (const hy of [0.3, 1.1, 1.65]) for (const u of [-0.45, 0, 0.45]) {          // ışının ±45 cm yanı da boş (palmiye gövdesini sıyıran ışın istemci / sunucu konumundaki mm farkıyla ayrışmasın)
            const e2 = eye.clone(); e2.x += dz * u; e2.z -= dx * u;
            if (!g.world.clear(e2, tp.set(tx + dz * u, ty + hy, tz - dx * u))) { ok = false; break; }
          }
          if (!ok) break;
        }
        if (ok) { found = { D, a: [x, z], dx, dz }; break; }
      }
    }
    out[D] = found;
  }
  return out;
}, DISTS);

await page.evaluate(({ bid }) => {
  const g = window.__game, me = g.playerSoldier, p = g.player, V = me.pos.constructor;
  const S = (window.__s = { shots: 0, pred: 0, conf: 0, pn: [], aimOn: false, aimY: 0.55, kills: [] });
  const bl = g.effects.blood.bind(g.effects); g.effects.blood = (...a) => { if (S.mine) S.pred++; return bl(...a); };
  const sr = g.shootRay.bind(g); g.shootRay = (sh, ...a) => { S.mine = sh === me; if (S.mine) { S.shots++; p.fireHeld = false; if (S.dbg) { const [o, d] = a, Bs = g.soldiers[bid]; S.dl = { o: [o.x, o.y, o.z].map((v) => +v.toFixed(2)), d: [d.x, d.y, d.z].map((v) => +v.toFixed(4)), b: [Bs.pos.x, Bs.pos.y, Bs.pos.z].map((v) => +v.toFixed(2)), h: g.hitSoldier(Bs, o, d, 300), w: (() => { const r = g.world.raycast(o, d, 300, {}, 'wood'); return r ? [+r.t.toFixed(2), r.collider?.oid || 'zemin'] : null; })(), alive: Bs.alive, prot: Bs.protT, adsT: me.adsT, ads: me.ads, cam: !!a[4] }; } } try { return sr(sh, ...a); } finally { S.mine = false; } };
  const ne = g.onNetEvents.bind(g); g.onNetEvents = (l) => { for (const ev of l) { if (ev.e === 'hm' && ev.by === me.id) { S.conf++; S.pn.push(ev.pn || 0); } if (ev.e === 'kill' && ev.k === me.id) S.kills.push(ev); } return ne(l); };
  if (p.breath) p.breath.step = () => [0, 0];                                  // dürbün sallanması kapalı (ölçülen şey delme kuralı; 120 m'de ±4,5 mrad sallanma B'yi ıskalatır)
  const ip = g.online.interpolate.bind(g.online);
  g.online.interpolate = (t) => {
    ip(t);
    const Bs = g.soldiers[bid];
    if (!S.aimOn || !Bs || !me.alive) return;
    const e = me.eye(new V()), c = new V(Bs.pos.x, Bs.pos.y + Bs.height * S.aimY, Bs.pos.z);
    me.yaw = Math.atan2(-(c.x - e.x), -(c.z - e.z)); me.pitch = Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z)) - me.recoilP;
    me.ads = true;
  };
  const kk = g.killfx.kill.bind(g.killfx); g.killfx.kill = (...a) => { const r = kk(...a); (S.kf ||= []).push(g.killfx.nt.textContent); return r; };
  S.dbg = true;
  window.__ready = () => me.alive && me.cd <= 0 && me.switchT <= 0 && me.reloadT <= 0 && me.adsT >= 0.999;
  window.__tap = () => { p.fireHeld = true; p.fireBuf = 0.15; g.online.edge('fp'); setTimeout(() => (p.fireHeld = false), 400); };
}, { bid: B.id });

const place = async (L, hp) => {
  const [x, z] = L.a, pos = (k) => [x + L.dx * (L.D + k), z + L.dz * (L.D + k)], yw = Math.atan2(L.dx, L.dz);
  await page.evaluate(({ a, b, c, d, ids, yw, hp }) => {
    const g = window.__game; g.online.send({ t: 'dbg', tp: a }); g.online.send({ t: 'dbg', hp: 99999 });
    g.online.send({ t: 'dbg', tps: [ids[0], ...b, yw, hp] }); g.online.send({ t: 'dbg', tps: [ids[1], ...c, yw, hp] }); g.online.send({ t: 'dbg', tps: [ids[2], ...d, yw, hp] });
  }, { a: L.a, b: pos(0), c: pos(2), d: pos(4), ids: [B.id, C.id, info.bot], yw, hp });
  B.yw = C.yw = yw;
};

// ısınma: odaya girişten sonraki ilk tık (silah değişimi / ilk dürbün) ölçüme sayılmaz — 12.164 ölçümünde ilk tık her silahta istemci ≠ sunucu çıktı (delmeyle ilgisiz)
{
  const L0 = lanes[DISTS[0]];
  if (L0) {
    await place(L0, 99999); await page.evaluate(() => (window.__s.aimOn = true)); await wait(1200);
    await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; g.online.send({ t: 'dbg', item: [0, 'sniper'] }); me.items[0] = { id: 'sniper', mag: 3, reserve: 0 }; me.cur = 0; });
    await page.waitForFunction(() => window.__ready(), null, { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => window.__tap()); await wait(1500);
    await page.evaluate(() => (window.__s.aimOn = false));
  }
}
const rows = [];
for (const w of WEAPONS) for (const D of DISTS) {
  const L = lanes[D];
  if (!L) { console.log(`${w} ${D} m: şerit yok`); continue; }
  await place(L, 99999); await wait(1300);
  if (process.env.DBG) console.log('      yer:', JSON.stringify(await page.evaluate((ids) => { const g = window.__game, me = g.playerSoldier; return [me.pos, ...ids.map((i) => g.soldiers[i].pos)].map((p) => [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)]).concat([[me.alive, me.item.id, me.cd]]); }, [B.id, C.id, info.bot])));
  await page.evaluate(() => (window.__s.aimOn = true));
  await wait(800);                                                       // sunucudaki dürbün de otursun (ilk atış: istemcinin girdisi sunucuya geç ulaşabilir)
  let mism = 0, lostB = 0, lostC = 0, pred = 0, conf = 0; const pns = [];
  for (let i = 0; i < N; i++) {
    await page.evaluate((w) => { const g = window.__game, me = g.playerSoldier; g.online.send({ t: 'dbg', item: [0, w] }); me.items[0] = { id: w, mag: 3, reserve: 0 }; me.cur = 0; me.reloadT = 0; me.switchT = 0; }, w);
    await wait(300);
    await page.waitForFunction(() => window.__ready(), null, { timeout: 8000 }).catch(() => console.log('      hazır değil'));      // sürgü (M24 1,25 sn) bitsin + dürbün tam otursun (istemcinin kendi saatiyle)
    await wait(150);
    const hb = B.last?.hp, hc = C.last?.hp;
    const k0 = await page.evaluate(() => { window.__tap(); return { ...window.__s, pn: window.__s.pn.length }; });
    // istemcinin atışı + sunucunun onayı gelene dek bekle (yazılım GPU'sunda kare hızı düşük: istemci adımı gerçek zamanın gerisinde kalabilir)
    await page.waitForFunction((k0) => { const S = window.__s; return S.shots > k0.shots && S.conf - k0.conf >= S.pred - k0.pred; }, k0, { timeout: 4000, polling: 50 }).catch(() => {});
    await wait(500);
    const k1 = await page.evaluate(() => ({ ...window.__s, pnl: window.__s.pn.slice() }));
    const dp = k1.pred - k0.pred, dc = k1.conf - k0.conf;
    if (process.env.DBG) console.log('      tık', k1.shots - k0.shots, dp, dc, JSON.stringify(k1.dl), JSON.stringify(B.sh.at(-1)));
    pred += dp; conf += dc; mism += dp !== dc ? 1 : 0; pns.push(k1.pnl.slice(k0.pn).join(''));
    lostB += Math.max(0, (hb ?? 0) - (B.last?.hp ?? 0)); lostC += Math.max(0, (hc ?? 0) - (C.last?.hp ?? 0));
    await page.evaluate(() => { window.__game.online.send({ t: 'dbg', hp: 99999 }); });
  }
  await page.evaluate(() => (window.__s.aimOn = false));
  const row = { w, D, atis: N, istemciKan: pred, sunucuOnay: conf, tikUyusmaz: mism, hasarB: +(lostB / N).toFixed(1), hasarC: +(lostC / N).toFixed(1), pn: pns.join(',') };
  rows.push(row); console.log(JSON.stringify(row));
}
console.log(`\n== ${MAP} · ${WS} · nişanda, hedefler duruyor; B (D m) → C (D+2) → bot (D+4) ==`);
console.log('silah     mesafe  atış  istemci-kan  sunucu-onay  uyuşmaz-tık  B hasar/atış  C hasar/atış  hm.pn');
for (const r of rows) console.log(`${r.w.padEnd(10)}${String(r.D).padEnd(8)}${String(r.atis).padEnd(6)}${String(r.istemciKan).padEnd(13)}${String(r.sunucuOnay).padEnd(13)}${String(r.tikUyusmaz).padEnd(13)}${String(r.hasarB).padEnd(14)}${String(r.hasarC).padEnd(14)}${r.pn}`);
for (const r of rows) {
  const n = EXP[r.w] || 1;
  check(r.tikUyusmaz === 0 && r.istemciKan === r.sunucuOnay, `${r.w} ${r.D} m: istemci tahmini = sunucu isabeti (${r.istemciKan} / ${r.sunucuOnay})`);
  check(r.sunucuOnay >= (N - 1) * n && r.sunucuOnay <= N * n, `${r.w} ${r.D} m: atış başına ${n} hedef (sunucu ${r.sunucuOnay} / ${N} atış)`);
  if (n > 1) check(r.hasarC > 0 && r.hasarC < r.hasarB, `${r.w} ${r.D} m: arkadaki C daha az hasar aldı (${r.hasarB} → ${r.hasarC})`);
  else check(r.hasarC === 0, `${r.w} ${r.D} m: delmeyen silah arkadakini vurmadı`);
}
// B'nin ekranı: A'nın atış olayında delinen askerlerin kanı (sh.b)
check(B.sh.some((e) => e.by === info.me && Array.isArray(e.b) && e.b.length >= 3), 'başkalarının ekranı: sh olayında delinen askerlerin kanı (b) geliyor');

// çifte öldürme anı: B, C 100 canla (bot 99999), kafa hizası, M24 — çizim açık, ekran görüntüleri
const L = lanes[DISTS[0]];
if (L) {
  await page.setViewportSize({ width: 1280, height: 720 });                      // ölçüm küçük pencerede (yazılım GPU'sunda kare hızı), görüntü 720p
  await page.evaluate(() => { const g = window.__game; window.__s.kills = []; window.__s.aimY = 0.92; });
  await place(L, 100); await page.evaluate(() => (window.__s.aimOn = true));
  await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; g.online.send({ t: 'dbg', item: [0, 'sniper'] }); me.items[0] = { id: 'sniper', mag: 3, reserve: 0 }; me.cur = 0; me.reloadT = 0; me.switchT = 0; });
  await wait(800);
  await page.waitForFunction(() => window.__ready(), null, { timeout: 8000 }).catch(() => {});
  await page.screenshot({ path: `${OUT}/net-0-oncesi.png` });
  await page.evaluate(() => window.__tap());
  let t0 = 0;
  for (const [n, ms] of [[1, 180], [2, 450], [3, 1000]]) { await wait(ms - t0); t0 = ms; await page.screenshot({ path: `${OUT}/net-${n}-cifte-${ms}ms.png` }); }
  const ks = await page.evaluate(() => ({ kills: window.__s.kills, nt: (window.__s.kf || []).join(' | '), pnt: document.querySelector('#kfx .pnt')?.textContent || '', feed: [...document.querySelectorAll('#killfeed .kf')].map((d) => d.innerHTML.includes('pni')) }));
  console.log('      çifte:', JSON.stringify(ks));
  check(ks.kills.length >= 2 && ks.kills.some((k) => k.pc === 2 && k.pn === 1), 'tek mermide çifte öldürme: kill.pc = 2 (sunucu)');
  check(/ÇİFTE|COLLATERAL/.test(ks.nt), 'ekranda "ÇİFTE · TEK MERMİ" çağrısı');
  check(ks.feed.some(Boolean), 'öldürme akışında delip geçme simgesi');
}
console.log('sayfa hatası:', errs.length, errs[0] || '');
check(errs.length === 0, 'sayfa hatası yok');
for (const w of [B, C]) { clearInterval(w.tm); w.close(); }
await browser.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
