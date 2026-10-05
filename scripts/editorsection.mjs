// Harita Editörü ayrı bölüm (ana menü → Harita Editörü). Düzenlemeler yalnız bellekte: editörden çıkıp girince durur, F5'te gider;
// eski sürümün localStorage kayıtları silinir; maçta (geliştirici modu dahil) harita hep orijinal, I tuşu editör açmaz.  node scripts/editorsection.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'HATA ') + m); if (!c) fail++; };
const KEY = 'warbyte.harita-duzenleme.colgecidi', PALM = 'palmiye:6';
const ready = async (ed) => { await p.waitForFunction(ed ? 'window.__game && window.__game.running && window.__game.mapEditor' : 'window.__game && window.__game.running', null, { timeout: 120000 }); await p.waitForTimeout(800); };
const palmY = () => p.evaluate((id) => { let y = 1e9; window.__game.map.group.traverse((o) => { if (o.isMesh && o.userData.ranges) for (const r of o.userData.ranges) if (r.oid === id) { const P = o.geometry.attributes.position; for (let i = r.start; i < r.start + r.count; i++) y = Math.min(y, P.getY(i)); } }); return y; }, PALM);
const menuEditor = async () => { await p.waitForSelector('#mnNav button[data-v=editor]', { state: 'visible' }); await p.click('#mnNav button[data-v=editor]'); await p.waitForTimeout(400); return p.evaluate(() => document.querySelector('#mnStage').innerText); };
// 0) eski sürümden kalan tarayıcı kaydı (palmiye 3 m havada) → yeni sürüm açılınca silinmeli
await p.goto('http://127.0.0.1:5180/?debug=1'); await p.evaluate((k) => localStorage.setItem(k, JSON.stringify([{ id: 'palmiye:6', at: [-44.8, 8.9, 18], d: [0, 3, 0] }])), KEY);
await p.goto('http://127.0.0.1:5180/?debug=1'); await p.waitForTimeout(500);
ok(await p.evaluate((k) => !localStorage.getItem(k), KEY), 'eski tarayıcı kaydı silindi');
let txt = await menuEditor();
ok((txt.match(/orijinal/g) || []).length >= 4 && !/\d+ düzenleme/.test(txt) && /(AÇ|aç) ›/.test(txt), 'menüde Harita Editörü bölümü: 4 harita orijinal, Editörü aç');
await p.screenshot({ path: 'screenshots/editor-menu.png' });
await p.click('#mnStage button[data-a=edopen]'); await ready(true);
const y0 = await palmY();
const ed = await p.evaluate(() => { const g = window.__game; return { ground: g.map.terrain.heightAt(-44.8, 18), live: g.soldiers.filter((s) => !s.vacant).length, vis: getComputedStyle(document.querySelector('#med')).display !== 'none', bots: g.brains.length, sold: g.soldiers.length, fly: g.playerSoldier.fly, n: g.mapEditor.list().length }; });
ok(ed.vis && ed.n === 0, 'editör açıldı: panel hazır, düzenleme 0');
ok(ed.bots === 0 && ed.live === 1 && ed.fly, `editörde bot yok, uçuş açık (aktif asker ${ed.live})`);
ok(Math.abs(y0 - ed.ground) < 0.3 || y0 < ed.ground, `${PALM} zeminde (taban ${y0.toFixed(2)}, zemin ${ed.ground.toFixed(2)})`);
await p.screenshot({ path: 'screenshots/editor-section.png' });
// 1) palmiyeyi kaldır → editörden çık → menüde "1 düzenleme" → tekrar aç: duruyor
await p.evaluate((id) => window.__game.mapEditor.move(id, [0, 3, 0]), PALM);
await p.evaluate(() => window.__game.exit()); txt = await menuEditor();
ok(/1 düzenleme/.test(txt), 'editörden çıkınca menüde "1 düzenleme"');
ok(await p.evaluate((k) => !localStorage.getItem(k), KEY), 'tarayıcıya hiçbir şey kaydedilmedi');
await p.click('#mnStage button[data-a=edopen]'); await ready(true);
ok(Math.abs((await palmY()) - (y0 + 3)) < 0.2, 'aynı sayfada tekrar açınca düzenleme duruyor');
// 2) maç: harita orijinal, editör yok, I açmıyor
await p.evaluate(() => window.__game.exit()); await p.waitForSelector('#mnNav', { state: 'visible' });
await p.click('#mnNav button[data-v=home]'); await p.waitForTimeout(300); await p.click('#mnStage button[data-a=quick]'); await ready(false);
ok(await p.evaluate(() => !window.__game.mapEditor && !document.querySelector('#med')), 'maçta harita editörü yok');
await p.keyboard.press('KeyI'); await p.waitForTimeout(250);
ok(!(await p.$('#med')), 'maçta I tuşu editör açmıyor');
const mapId = await p.evaluate(() => window.__game.mapDef.id);
if (mapId === 'colgecidi') ok(Math.abs((await palmY()) - y0) < 0.2, 'maçta palmiye orijinal yerinde'); else console.log('(not: hızlı oyun haritası ' + mapId + ', palmiye kontrolü atlandı)');
// 3) F5 → tüm düzenlemeler gider
await p.reload(); txt = await menuEditor();
ok(!/1 düzenleme/.test(txt), 'sayfa yenilenince düzenlemeler gitti');
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK', 'sayfa hatası', errs.length, errs.slice(0, 3));
await b.close();
