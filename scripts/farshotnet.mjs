// Uzak mesafe atış ölçümü — ÇEVRİM İÇİ (12.146). A = gerçek tarayıcı istemcisi (atıcı), B = ham ws istemcisi (hedef, insan).
// A, B'nin GÖRDÜĞÜ (interpolasyonlu) göğsüne her karede kusursuz nişan alır ve aralıklı tek atış yapar (ilk atış isabeti).
// Sayılan: atış, istemcinin gördüğü isabet (kan), sunucunun onayladığı isabet (hm olayı), B'nin sunucudaki can kaybı.
//   node scripts/farshotnet.mjs   env: WS=ws://127.0.0.1:8790 (gecikmeli vekil) BASE=http://127.0.0.1:5180 MAP=colgecidi W=m4a1 D=25,50,75,100 N=20 MOVE=0|1 ADS=1
// Sunucu BF_DEBUG=1 ile açık olmalı (dbg tp / hp / item). Vekil: node scripts/netproxy.mjs 8790 8787 25 50
import { chromium } from 'playwright';
import WebSocket from 'ws';
const WS = process.env.WS || 'ws://127.0.0.1:8790', BASE = process.env.BASE || 'http://127.0.0.1:5180', MAP = process.env.MAP || 'colgecidi';
const WEAPONS = (process.env.W || 'm4a1').split(','), DISTS = (process.env.D || '25,50,75,100').split(',').map(Number), N = +(process.env.N || 20);
const MOVE = process.env.MOVE === '1', ADS = process.env.ADS !== '0', SPRAY = process.env.SPRAY === '1';
const SWAY = process.env.SWAY === '1', AIMY = +(process.env.AIMY || 0.55);     // 12.156: SWAY=1 dürbün sallanması nişana eklenir (her kare düzeltilmez), AIMY: nişan yüksekliği (boyun oranı; 0,92 ≈ kafa)     // SPRAY=1: 3 mermilik seri (bloom), tek tık yerine
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const q = new URLSearchParams({ online: 'new', type: 'tdm', per: '2', map: MAP, diff: 'normal', bots: '0', time: '3600', debug: '1', nolock: '1', server: WS, name: 'Atici', cls: 'assault' });
await page.goto(`${BASE}/?${q}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.online', null, { timeout: 90000 });
if (process.env.RENDER !== '1') await page.evaluate(() => { window.__game.render = () => {}; });      // ölçümde çizim yok (makine yükü altında kare hızı düşmesin; atış mantığı çizimden bağımsız)
const room = await page.evaluate(() => window.__game.opts.online?.room || new URLSearchParams(location.search).get('online'));
// B: ham istemci
const b = new WebSocket(WS); b.last = null; b.id = null; b.q = 0;
b.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'welcome') b.id = m.id; if (m.t === 'snap') b.last = m.me.now; });
await new Promise((r) => b.on('open', r));
b.send(JSON.stringify({ t: 'join', room, name: 'Hedef' }));
await wait(1500);
const bIn = { r: 0, yw: 0 };
const bTimer = setInterval(() => b.send(JSON.stringify({ t: 'in', q: ++b.q, f: 0, r: bIn.r, l: 0, s: 0, j: 0, a: 0, yw: bIn.yw, pt: 0, w: 0 })), 1000 / 60);
const sendB = (o) => b.send(JSON.stringify({ t: 'dbg', ...o }));
await wait(1500);
const info = await page.evaluate((bid) => { const g = window.__game, me = g.playerSoldier, B = g.soldiers[bid]; return { me: me.id, myTeam: me.team, bTeam: B?.team, bid }; }, b.id);
console.log('oda', room, JSON.stringify(info));
if (info.myTeam === info.bTeam) { console.log('HATA: aynı takım'); process.exit(1); }

// her mesafe için ayrı şerit: A'nın gözünden B'nin ayak / göğüs / başı (± 2,5 m yana kayınca da) görünür, ikisi de yürünebilir zeminde
const lanes = await page.evaluate((DISTS) => {
  const g = window.__game, V = g.playerSoldier.pos.constructor, b = g.map.bounds, eye = new V(), tp = new V(), out = {};
  const dirs = Array.from({ length: 16 }, (_, a) => [Math.sin(a * Math.PI / 8), Math.cos(a * Math.PI / 8)]);
  for (const D of DISTS) {
    let found = null;
    for (let x = b.minX + 3; x < b.maxX - 3 && !found; x += 3) for (let z = b.minZ + 3; z < b.maxZ - 3 && !found; z += 3) {
      if (!g.nav.isFree(x, z)) continue;
      const y = g.world.heightAt(x, z); eye.set(x, y + 1.6, z);
      for (const [dx, dz] of dirs) {
        let ok = true;
        for (const u of [-2.5, 0, 2.5]) {
          const tx = x + dx * D + dz * u, tz = z + dz * D - dx * u, ty = g.world.heightAt(tx, tz);
          if (!g.nav.isFree(tx, tz) || Math.abs(ty - y) > 6) { ok = false; break; }
          for (const hy of [0.3, 1.1, 1.65]) if (!g.world.clear(eye, tp.set(tx, ty + hy, tz))) { ok = false; break; }
          if (!ok) break;
        }
        if (ok) { found = { D, a: [x, z], b: [x + dx * D, z + dz * D], dx, dz }; break; }
      }
    }
    out[D] = found;
  }
  return out;
}, DISTS);

await page.evaluate(({ bid, ADS, SPRAY, SWAY, AIMY }) => {
  const g = window.__game, me = g.playerSoldier, p = g.player, V = me.pos.constructor;
  const S = (window.__s = { shots: 0, pred: 0, conf: 0, aimOn: false });
  const bl = g.effects.blood.bind(g.effects); g.effects.blood = (...a) => { if (S.mine) S.pred++; return bl(...a); };
  const sr = g.shootRay.bind(g); g.shootRay = (sh, ...a) => { S.mine = sh === me; if (S.mine) { S.shots++; if (!S.spray) p.fireHeld = false; } try { return sr(sh, ...a); } finally { S.mine = false; } };
  const ne = g.onNetEvents.bind(g); g.onNetEvents = (l) => { for (const ev of l) if (ev.e === 'hm' && ev.by === me.id) S.conf++; return ne(l); };
  // nişan: interpolasyondan hemen sonra (her kare), B'nin görünen göğsüne
  const ip = g.online.interpolate.bind(g.online);
  g.online.interpolate = (t) => {
    ip(t);
    const B = g.soldiers[bid];
    if (!S.aimOn || !B || !me.alive) return;
    const e = me.eye(new V()), c = new V(B.pos.x, B.pos.y + B.height * AIMY, B.pos.z);
    me.yaw = Math.atan2(-(c.x - e.x), -(c.z - e.z)); me.pitch = Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z)) - me.recoilP;
    if (SWAY && p.breath) { me.yaw += p.breath.ox; me.pitch += p.breath.oy; S.swMax = Math.max(S.swMax || 0, Math.hypot(p.breath.ox, p.breath.oy)); }      // sallanma ofseti nişanda kalır (Player.update bu karenin farkını ekler)
    me.ads = ADS;
  };
  window.__tap = () => { p.fireHeld = true; p.fireBuf = 0.15; g.online.edge('fp'); setTimeout(() => (p.fireHeld = false), 400); };      // otomatik modda tık = basılı; ilk mermide bırakılır (tek atış)
  S.spray = SPRAY;
}, { bid: b.id, ADS, SPRAY, SWAY, AIMY });

const rows = [];
for (const w of WEAPONS) for (const D of DISTS) {
  const L = lanes[D];
  if (!L) { console.log(`${w} ${D} m: şerit yok`); continue; }
  await page.evaluate(([x, z]) => { const g = window.__game; g.online.send({ t: 'dbg', tp: [x, z] }); g.online.send({ t: 'dbg', hp: 99999 }); }, L.a);
  sendB({ tp: L.b }); sendB({ hp: 99999 });
  bIn.yw = Math.atan2(L.dx, L.dz);                                   // B, A'ya bakar
  await wait(1200);
  const r0 = await page.evaluate(() => ({ ...window.__s }));
  const hp0 = b.last?.hp ?? 0; let lost = 0, lastHp = hp0, mism = 0;
  await page.evaluate(() => (window.__s.aimOn = true));
  for (let i = 0; i < N; i++) {
    if (MOVE) bIn.r = i % 2 ? -1 : 1;                                 // yana yürür (5,6 m/sn), her atışta yön değiştirir (şerit içinde 0…+2,5 m gidip gelir)
    // silah: sunucuda dbg item (şarjör 3), istemcide aynısı
    await page.evaluate((w) => { const g = window.__game, me = g.playerSoldier; g.online.send({ t: 'dbg', item: [0, w] }); me.items[0] = { id: w, mag: 3, reserve: 0 }; me.cur = 0; me.reloadT = 0; me.switchT = 0; }, w);
    await wait(MOVE ? 200 : 450);
    const k0 = await page.evaluate(() => { window.__tap(); return { ...window.__s }; });
    await wait(MOVE ? 250 : SPRAY ? 900 : 350);
    const k1 = await page.evaluate(() => ({ ...window.__s }));
    mism += Math.abs((k1.pred - k0.pred) - (k1.conf - k0.conf));      // bu tıkta istemcinin gördüğü isabet sayısı ≠ sunucunun onayladığı
    const hp = b.last?.hp ?? lastHp; if (hp < lastHp) lost += lastHp - hp; lastHp = hp;
    if (hp < 50000) { sendB({ hp: 99999 }); lastHp = 99999; }
  }
  bIn.r = 0;
  await page.evaluate(() => (window.__s.aimOn = false));
  await wait(900);
  const hp = b.last?.hp ?? lastHp; if (hp < lastHp) lost += lastHp - hp;
  const r1 = await page.evaluate(() => ({ ...window.__s }));
  const dist = await page.evaluate((bid) => { const g = window.__game, me = g.playerSoldier, B = g.soldiers[bid]; return B && me ? Math.hypot(B.pos.x - me.pos.x, B.pos.z - me.pos.z) : -1; }, b.id);
  const row = { w, D, gercekD: +dist.toFixed(1), atis: r1.shots - r0.shots, istemciKan: r1.pred - r0.pred, sunucuOnay: r1.conf - r0.conf, hasar: lost, uyusmazlik: mism, sallanmaMaxMrad: r1.swMax ? +(r1.swMax * 1000).toFixed(2) : 0 };
  rows.push(row); console.log(JSON.stringify(row));
}
console.log(`\n== ${MAP} · ${WS} · ${ADS ? 'nişanda' : 'belden'} · ${MOVE ? 'hedef yana yürüyor' : 'hedef duruyor'}${SPRAY ? ' · 3\'lü seri' : ''} ==`);
console.log('silah   mesafe  atış  istemci-kan  sunucu-onay  onay/atış  hasar/atış  tık-başı-uyuşmazlık');
for (const r of rows) console.log(`${r.w.padEnd(8)}${String(r.D).padEnd(8)}${String(r.atis).padEnd(6)}${String(r.istemciKan).padEnd(13)}${String(r.sunucuOnay).padEnd(13)}${(r.atis ? Math.round(r.sunucuOnay / r.atis * 100) + '%' : '-').padEnd(11)}${(r.atis ? (r.hasar / r.atis).toFixed(1) : '-').padEnd(12)}${r.uyusmazlik}`);
console.log('sayfa hatası:', errs.length, errs[0] || '');
clearInterval(bTimer); b.close(); await browser.close();
