// Sohbet arayüz testi: iki tarayıcı oyuncu aynı odada. node scripts/chatui.mjs (sunucu + vite 5180 açık olmalı)
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:5180', WS = process.env.WSURL || 'ws://127.0.0.1:8787';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const mk = async (url) => { const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); await p.goto(url); await p.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 }); return p; };
const A = await mk(`${BASE}/?online=new&type=tdm&per=3&map=kasaba&debug=1&nolock=1&server=${WS}&name=Ali&team=blue`);
const code = await A.evaluate(() => new URLSearchParams(location.search).get('online'));
const B = await mk(`${BASE}/?online=${code}&debug=1&nolock=1&server=${WS}&name=Veli&team=red`);
await A.waitForTimeout(1500);
const texts = (p) => p.evaluate(() => [...document.querySelectorAll('#chlog .cm')].map((e) => e.textContent));

// A: Enter ile aç, yaz, Enter ile gönder
await A.keyboard.press('Enter'); await A.waitForTimeout(250);
check(await A.evaluate(() => window.__game.chatOpen === true && document.activeElement.id === 'chin'), 'Enter sohbeti açtı, kutuya odaklandı');
const posBefore = await A.evaluate(() => ({ ...window.__game.playerSoldier.pos }));
await A.keyboard.type('wasd selam <b>x</b>');
await A.waitForTimeout(400);
check(await A.evaluate(() => document.querySelector('#chin').value === 'wasd selam <b>x</b>'), 'yazı kutuya girdi (W/A/S/D oyun tuşu olarak çalışmadı)');
await A.screenshot({ path: 'screenshots/chat-open.png' });
await A.keyboard.press('Enter'); await A.waitForTimeout(250);
await A.waitForTimeout(600);
check(await A.evaluate(() => window.__game.chatOpen === false), 'gönderince kutu kapandı');
await B.waitForFunction(() => [...document.querySelectorAll('#chlog .cm')].some((e) => e.textContent.includes('Ali:')), null, { timeout: 20000 });      // iki swiftshader sayfası CPU paylaşır: mesaj geç işlenebilir
let tb = await texts(B);
check(tb.some((t) => t.includes('Ali:') && t.includes('wasd selam <b>x</b>')), 'B mesajı aldı (HTML metin olarak, etiket çalışmadı): ' + JSON.stringify(tb));
check(await B.evaluate(() => !document.querySelector('#chlog b')), 'mesajda gerçek <b> etiketi yok');
const posAfter = await A.evaluate(() => ({ ...window.__game.playerSoldier.pos }));
check(Math.hypot(posAfter.x - posBefore.x, posAfter.z - posBefore.z) < 0.3, 'yazarken karakter yürümedi');

// B: Shift+Enter takıma (B kırmızı, A mavi → A görmemeli)
await B.keyboard.press('Shift+Enter'); await B.waitForTimeout(250);
check(await B.evaluate(() => document.querySelector('#chch').textContent === 'Takım'), 'Shift+Enter takım kanalını açtı');
await B.keyboard.type('gizli plan'); await B.keyboard.press('Tab');
check(await B.evaluate(() => document.querySelector('#chch').textContent === 'Herkes'), 'Tab kanalı değiştirdi');
await B.keyboard.press('Tab');
await B.keyboard.press('Enter');
await B.waitForTimeout(600);
await B.waitForFunction(() => [...document.querySelectorAll('#chlog .cm')].some((e) => e.textContent.includes('gizli plan')), null, { timeout: 20000 }); await A.waitForTimeout(2500);
check((await texts(B)).some((t) => t.includes('TAKIM') && t.includes('gizli plan')), 'B kendi takım mesajını gördü');
check(!(await texts(A)).some((t) => t.includes('gizli plan')), 'A (rakip takım) takım mesajını görmedi');

// Esc iptal
await A.keyboard.press('Enter'); await A.waitForTimeout(250); await A.keyboard.type('vazgeçtim'); await A.keyboard.press('Escape');
await A.waitForTimeout(300);
check(await A.evaluate(() => !window.__game.chatOpen) && !(await texts(B)).some((t) => t.includes('vazgeçtim')), 'Esc iptal etti, mesaj gitmedi');

await B.screenshot({ path: 'screenshots/chat-log.png' });
check(A.errs.length + B.errs.length === 0, 'sayfa hatası yok ' + JSON.stringify([...A.errs, ...B.errs]));
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK');
await browser.close(); process.exit(fail ? 1 : 0);
