// 12.195 Çevrim içi 3. şahıs yükleme eşitlemesi: A oyuncusu şarjör değiştirir, B'nin ekranındaki A modeli aynı koreografiyi oynar mı
// (uzak savaşçının reloadT'si akar, şarjör elde / el şarjör yuvasında, bitince yerinde). BF_DEBUG=1 sunucu gerekir.
//   node scripts/reloadnet.mjs [BASE] [WSURL] [silahlar virgülle]      OUT=/tmp/wb-qa12/net
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.argv[2] || 'http://127.0.0.1:5202', WSURL = process.argv[3] || 'ws://127.0.0.1:8983', OUT = process.env.OUT || '/tmp/wb-qa12/net';
const IDS = (process.argv[4] || 'p90,ak47,pistol,shotgun').split(',');
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const errs = [];
const open = async (q) => { const p = await b.newPage({ viewport: { width: 960, height: 540 } }); p.on('pageerror', (e) => errs.push(e.message)); await p.goto(`${BASE}/?${new URLSearchParams(q)}`); await p.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier?.alive', null, { timeout: 90000 }); return p; };
const A = await open({ online: 'new', type: 'tdm', per: '2', map: 'colgecidi', debug: '1', nolock: '1', server: WSURL, name: 'Dolduran', cls: 'assault' });
const code = new URL(A.url()).searchParams.get('online');
const B = await open({ online: code, debug: '1', nolock: '1', server: WSURL, name: 'Bakan', cls: 'assault' });
for (const p of [A, B]) await p.evaluate(() => { const n = window.__game.online; n.send({ t: 'dbg', bots: false }); setInterval(() => n.send({ t: 'dbg', hp: 99999 }), 400); for (const e of document.body.children) if (e !== window.__game.canvas && !e.contains(window.__game.canvas)) e.style.visibility = 'hidden'; });
const aid = await A.evaluate(() => window.__game.playerSoldier.id);
let fail = 0;
for (const id of IDS) {
  await A.evaluate(() => window.__game.online.send({ t: 'dbg', tp: [-36.5, 47.5] }));
  await B.evaluate(() => window.__game.online.send({ t: 'dbg', tp: [-38.2, 45.2] }));
  await A.evaluate((id) => window.__game.online.send({ t: 'dbg', item: [0, id, 3, 90] }), id);
  await A.waitForTimeout(900);
  await A.keyboard.press('Digit1'); await A.waitForTimeout(800);
  await A.evaluate(() => { const s = window.__game.playerSoldier; s.yaw = 2.4; });
  // B: A'ya bak (yandan), örnekle
  const samp = B.evaluate((aid) => new Promise((res) => {
    const g = window.__game, me = g.playerSoldier, o = g.soldiers[aid], out = [];
    const t0 = performance.now();
    const f = () => {
      const dx = o.pos.x - me.pos.x, dz = o.pos.z - me.pos.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = -0.15;
      const u = o.model.weapon?.userData, mg = u?.mag;
      out.push({ t: Math.round(performance.now() - t0), rT: +o.reloadT.toFixed(3), tot: +o.reloadTotal.toFixed(3), id: o.item?.id, magOff: mg ? +mg.position.length().toFixed(3) : null, magVis: mg ? mg.visible : null });
      if (performance.now() - t0 < 4200) requestAnimationFrame(f); else res(out);
    };
    f();
  }), aid);
  await B.waitForTimeout(300);
  await A.keyboard.press('KeyR');
  const shots = [];
  for (let i = 0; i < 8; i++) { await B.waitForTimeout(220); const pth = `${OUT}/${id}-${i}.png`; await B.screenshot({ path: pth }); shots.push(pth); }
  const S = await samp;
  const rl = S.filter((x) => x.rT > 0), started = rl.length > 0, flows = rl.length > 3 && rl[rl.length - 1].rT < rl[0].rT - 0.3, ended = started && S[S.length - 1].rT === 0;
  const inHand = S.some((x) => x.magOff > 0.03 || x.magVis === false), back = S[S.length - 1].magOff === 0 || S[S.length - 1].magOff === null;
  const ok = started && flows && ended && (inHand || id === 'shotgun') && back;
  if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'HATA'} ${id}: B'de A reload başladı ${started}, süre aktı ${flows} (${rl[0]?.rT} → ${rl[rl.length - 1]?.rT}), bitti ${ended}, şarjör elde / düştü ${inHand}, sonunda yerinde ${back} · B gördü: ${[...new Set(S.map((x) => x.id))].join("/")}`);
  await A.waitForTimeout(800);
}
console.log('sayfa hatası:', errs.length, errs.slice(0, 3));
await b.close();
process.exit(fail || errs.length ? 1 : 0);
