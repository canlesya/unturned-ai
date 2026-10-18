// Admin paneli Sunucular sayfası: oylama süresi + boş oda harita değişimi alanları (12.101). Yerel test sunucusu (BF_DATA'daki ilk şifre) ile.
// ADMIN=http://127.0.0.1:8827 BF_DATA=/tmp/wb-m-data node scripts/adminvote.mjs   (önce: vite build -c vite.admin.config.js)
import { chromium } from 'playwright';
import fs from 'fs';
const ADMIN = process.env.ADMIN || 'http://127.0.0.1:8827', OUT = process.env.OUT || '/tmp/wb-m-shots';
const pw = fs.readFileSync((process.env.BF_DATA || 'data') + '/admin-password.txt', 'utf8').trim();
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto(ADMIN);
await p.fill('#pw', pw); await p.keyboard.press('Enter');
await p.waitForSelector('.nav, nav, [data-v]', { timeout: 10000 }).catch(() => {});
await p.waitForTimeout(800);
await p.evaluate(() => { const b = [...document.querySelectorAll('button,a')].find((x) => /Sunucular/.test(x.textContent)); b?.click(); });
await p.waitForSelector('.srv', { timeout: 10000 });
const chips = await p.evaluate(() => [...document.querySelectorAll('.srv')].map((c) => c.querySelector('.chips').textContent));
check(chips.length >= 6 && chips.every((c) => /Oylama 15 sn/.test(c) && /Boşta 10 dk/.test(c)), `kartlarda oylama / boşta etiketi (${chips.length} sunucu)`);
await p.screenshot({ path: `${OUT}/admin-servers.png` });
await p.click('[data-ed="OFC8"]');
await p.waitForSelector('#sVoteS');
await p.evaluate(() => { const s = document.querySelector('#sVoteS'); s.value = 25; s.dispatchEvent(new Event('input')); const i = document.querySelector('#sIdle'); i.value = 0; i.dispatchEvent(new Event('input')); });
await p.screenshot({ path: `${OUT}/admin-edit.png` });
await p.click('#sSave');
await p.waitForTimeout(800);
const r = await p.evaluate(async () => (await fetch('/api/official')).json());
const o = r.list.find((x) => x.code === 'OFC8');
check(o.voteSec === 25 && o.idleMin === 0, `kaydedildi: OFC8 voteSec ${o.voteSec}, idleMin ${o.idleMin}`);
// geri al
await p.evaluate(async (o) => fetch('/api/official/save', { method: 'POST', headers: { 'content-type': 'application/json', 'x-wb': '1' }, body: JSON.stringify({ server: { ...o, voteSec: 15, idleMin: 10, live: undefined } }) }), o);
await b.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
