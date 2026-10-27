// 12.196 Enfekte iki gerçek istemci (çevrimiçi): A oda kurar (insan), B katılır ve zombi (Yürüyen) olur; A'nın ekranında B'nin canı yeni
// değerle (ZTYPES.walker.hp) görünür mü, B pençeyle A'yı kaç vuruşta düşürür (sunucu), iki ekranın görüntüsü.
// önce: BF_DEBUG=1 node server/index.js (PORT) ; vite.  BASE=http://127.0.0.1:5180 WS=ws://127.0.0.1:8787 OUT=screenshots node scripts/infnet2.mjs
import { chromium } from 'playwright';
import { ZTYPES } from '../src/game/stats.js';
const BASE = process.env.BASE || 'http://127.0.0.1:5180', WS = process.env.WS || 'ws://127.0.0.1:8787', OUT = process.env.OUT || 'screenshots';
const browser = await chromium.launch(process.env.GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK    ' : 'HATA  ') + m); if (!c) fail++; };
const errs = [];
const mk = async () => { const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', (e) => errs.push(e.message)); return p; };
const A = await mk();
await A.goto(`${BASE}/?online=new&type=inf&per=8&time=600&debug=1&nolock=1&server=${encodeURIComponent(WS)}&name=Insan`);
await A.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
const code = new URL(A.url()).searchParams.get('online');
ok(code && code !== 'new', 'oda: ' + code);
const B = await mk();
await B.goto(`${BASE}/?online=${code}&debug=1&nolock=1&server=${encodeURIComponent(WS)}&name=Zombi`);
await B.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
await A.waitForTimeout(2000);
// botları sustur, B zombi olsun (hazırlık biter), A'nın önüne ışınlan
await A.evaluate(() => window.__game.online.send({ t: 'dbg', bots: false }));
await B.evaluate(() => window.__game.online.send({ t: 'dbg', zb: 'walker' }));
await B.waitForTimeout(1500);
const info = (p) => p.evaluate(() => { const g = window.__game, me = g.playerSoldier; return { id: me.id, team: me.team, zombie: !!me.def.zombie, hp: me.hp, mh: me.maxHp, x: me.pos.x, z: me.pos.z, yaw: me.yaw }; });
const a = await info(A), b = await info(B);
ok(b.zombie && b.mh === ZTYPES.walker.hp, `B zombi oldu, kendi ekranında can ${b.hp}/${b.mh} (beklenen ${ZTYPES.walker.hp})`);
const bOnA = await A.evaluate((id) => { const s = window.__game.soldiers[id]; return { zombie: !!s.def.zombie, mh: s.maxHp, team: s.team }; }, b.id);
ok(bOnA.zombie && bOnA.mh === ZTYPES.walker.hp, `A'nın ekranında B zombi, can üst sınırı ${bOnA.mh}`);
// B'yi A'nın 1,6 m önüne koy, A'ya baksın; savur
await A.evaluate(() => window.__game.online.send({ t: 'dbg', hp: 100 }));
const yawTo = Math.atan2(-(a.x - (a.x + 1.6)), -(a.z - a.z));
await B.evaluate(([x, z, yaw]) => { const n = window.__game.online; n.send({ t: 'dbg', tp: [x, z] }); const me = window.__game.playerSoldier; me.yaw = yaw; if (window.__game.player) window.__game.player.yaw = yaw; }, [a.x + 1.6, a.z, yawTo]);
await B.waitForTimeout(700);
await A.screenshot({ path: `${OUT}/infnet2-insan.png` });
let swings = 0;
for (; swings < 6; swings++) {
  const aa = await info(A); if (!aa.zombie && aa.hp <= 0) break;
  const st = await A.evaluate(() => window.__game.playerSoldier.alive);
  if (!st) break;
  await B.evaluate(([x, z]) => { const g = window.__game, me = g.playerSoldier; const yaw = Math.atan2(-(x - me.pos.x), -(z - me.pos.z)); me.yaw = yaw; if (g.player) { g.player.yaw = yaw; g.player.pitch = -0.1; } }, [aa.x, aa.z]);
  await B.mouse.down(); await B.waitForTimeout(120); await B.mouse.up(); await B.waitForTimeout(450);
  if (swings === 0) await B.screenshot({ path: `${OUT}/infnet2-zombi.png` });
}
const aEnd = await A.evaluate(() => ({ alive: window.__game.playerSoldier.alive, hp: window.__game.playerSoldier.hp }));
ok(!aEnd.alive, `B (Yürüyen, pençe ${ZTYPES.walker.dmg}) A'yı ${swings} savuruşta düşürdü (A can ${Math.round(aEnd.hp)})`);
await A.waitForTimeout(6500);
const a2 = await info(A);
ok(a2.zombie, 'A ölünce zombi olarak doğdu: ' + JSON.stringify({ team: a2.team, mh: a2.mh }));
await A.screenshot({ path: `${OUT}/infnet2-insan-enfekte.png` });
ok(errs.length === 0, 'sayfa hatası yok ' + errs.slice(0, 3).join(' | '));
await browser.close();
process.exit(fail ? 1 : 0);
