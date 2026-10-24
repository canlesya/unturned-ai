// Moderasyon arayüz testi (12.136): tarayıcıdaki oyuncu sohbetten yetkisiz komut dener, moderatör (WS) onu atar / banlar;
// atılma ekranı, yeniden girişte ban hatası (yükleme ekranı + menü, tr / en) ve ekran görüntüleri screenshots/mod-*.png
//   sunucu: BF_DATA=/tmp/wb-ban-data PORT=8846 ADMIN_PORT=8847 BF_ACC_RATE=100 node server/index.js · istemci: npx vite --port 5186
//   BASE=http://127.0.0.1:5186 WS=ws://127.0.0.1:8846 DATA=/tmp/wb-ban-data node scripts/modui.mjs
import { chromium } from 'playwright';
import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BASE = process.env.BASE || 'http://127.0.0.1:5186', WS = process.env.WS || 'ws://127.0.0.1:8846', HTTP = WS.replace(/^ws/, 'http');
const DATA = process.env.DATA || '/tmp/wb-ban-data';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// moderatör: test hesabı + mods.json, WS ile oda kurar (IP 10.0.0.1 taklidi: tarayıcı 127.0.0.1'den gelir)
const MOD = 'UiMod' + crypto.randomInt(100, 999);
const reg = await fetch(HTTP + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: MOD, pass: crypto.randomBytes(9).toString('base64url') }) }).then((r) => r.json());
fs.writeFileSync(path.join(DATA, 'mods.json'), JSON.stringify([MOD]));
try { fs.unlinkSync(path.join(DATA, 'bans.json')); } catch { /* yok */ }            // önceki yarım kalan koşunun banı (tarayıcı 127.0.0.1)
const mod = new WebSocket(WS, { headers: { 'x-real-ip': '10.0.0.1' } }); mod.msgs = [];
mod.on('message', (d) => mod.msgs.push(JSON.parse(d)));
await new Promise((r) => mod.on('open', r));
mod.send(JSON.stringify({ t: 'create', name: 'x', tok: reg.tok, cls: 'assault', loadout: {}, cfg: { map: 'kasaba', type: 'tdm', perTeam: 3, bots: true, listed: false } }));
while (!mod.msgs.some((m) => m.t === 'welcome')) await wait(50);
const CODE = mod.msgs.find((m) => m.t === 'welcome').room;
const say = (m) => mod.send(JSON.stringify({ t: 'chat', m }));
const ping = setInterval(() => mod.send(JSON.stringify({ t: 'ping', c: 0 })), 2000);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' });          // önce Türkçe; menü adımı İngilizceye geçer
const P = await ctx.newPage(); P.errs = []; P.on('pageerror', (e) => P.errs.push(e.message));
const URL = `${BASE}/?online=${CODE}&debug=1&nolock=1&server=${encodeURIComponent(WS)}&name=Kotu`;
await P.goto(URL);
await P.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
await P.waitForTimeout(1500);

// yetkisiz: oyuncu sohbetten /kick yazar → yalnız kendisine "yetkin yok", moderatöre sohbet gitmez
await P.keyboard.press('Enter');
await P.waitForFunction(() => window.__game.chatOpen === true && document.activeElement.id === 'chin', null, { timeout: 15000 });     // swiftshader yavaş: kutu açılmadan yazma
await P.keyboard.type(`/kick ${MOD}`);
await P.waitForFunction((v) => document.querySelector('#chin').value === v, `/kick ${MOD}`, { timeout: 15000 });
await P.keyboard.press('Enter');
await P.waitForFunction(() => [...document.querySelectorAll('#chlog .cm')].some((e) => e.textContent.includes('yetkin yok')), null, { timeout: 15000 }).catch(() => {});
const log = await P.evaluate(() => [...document.querySelectorAll('#chlog .cm')].map((e) => e.textContent));
check(log.some((s) => s.includes('Bu komutu kullanma yetkin yok')) && !log.some((s) => s.includes('/kick')), 'oyuncu: yetkisiz komut reddedildi, sohbete düşmedi: ' + JSON.stringify(log.slice(-3)));
check(!mod.msgs.some((m) => m.t === 'chat' && !m.sys && String(m.m).startsWith('/')), 'moderatöre komut metni gelmedi');
await P.screenshot({ path: 'screenshots/mod-noperm.png' });

// /kick → atılma ekranı
say('/kick Kotu küfür ediyor');
await P.waitForFunction(() => getComputedStyle(document.getElementById('endscreen')).display !== 'none', null, { timeout: 15000 }).catch(() => {});
await P.waitForTimeout(400);
const kick = await P.evaluate(() => ({ t: document.getElementById('etitle').textContent, i: document.getElementById('einfo').textContent, again: getComputedStyle(document.getElementById('bAgain')).display }));
check(kick.t === 'ODADAN ATILDIN' && kick.i.includes('2 dk sonra') && kick.i.includes('Sebep: küfür ediyor') && kick.again === 'none', 'atılma ekranı: ' + JSON.stringify(kick));
await P.screenshot({ path: 'screenshots/mod-kicked.png' });

// yeniden giriş (2 dk engel) → yükleme ekranında neden
await P.goto(URL);
await P.waitForFunction(() => /atıldın/i.test(document.getElementById('loading')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
let lt = await P.evaluate(() => document.getElementById('loading')?.textContent || '');
check(/Yakın zamanda odadan atıldın · 2 dk sonra/.test(lt) && !lt.includes('Bağlanılamadı'), 'yeniden girişte atma engeli: ' + lt.trim());
await P.screenshot({ path: 'screenshots/mod-kickjoin.png' });

// /unban → girer, /ban 1d → BANLANDIN ekranı
say('/unban Kotu'); await wait(400);
await P.goto(URL);
await P.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
await P.waitForTimeout(1200);
say('/ban Kotu 1d hile kullanıyor');
await P.waitForFunction(() => getComputedStyle(document.getElementById('endscreen')).display !== 'none', null, { timeout: 15000 }).catch(() => {});
await P.waitForTimeout(400);
const ban = await P.evaluate(() => ({ t: document.getElementById('etitle').textContent, i: document.getElementById('einfo').textContent }));
check(ban.t === 'BANLANDIN' && /kalan süre: (1 gün|23 sa 59 dk)/.test(ban.i) && ban.i.includes('Sebep: hile kullanıyor'), 'ban ekranı: ' + JSON.stringify(ban));
await P.screenshot({ path: 'screenshots/mod-banned.png' });

// banlıyken giriş: yükleme ekranı (tr) ve menüden kodla katılma (en)
await P.goto(URL);
await P.waitForFunction(() => /banland/i.test(document.getElementById('loading')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
lt = await P.evaluate(() => document.getElementById('loading')?.textContent || '');
check(/Bu sunucudan banlandın · kalan süre/.test(lt) && lt.includes('hile kullanıyor'), 'banlıyken girişte yükleme ekranı: ' + lt.trim());
await P.screenshot({ path: 'screenshots/mod-banjoin.png' });

await P.evaluate(({ ws, code }) => { localStorage.setItem('warbyte.lang', 'en'); localStorage.setItem('warbyte.acct', JSON.stringify({ kind: 'guest' })); const p = JSON.parse(localStorage.getItem('warbyte.v2') || '{}'); Object.assign(p, { server: ws, room: code, name: 'Kotu' }); localStorage.setItem('warbyte.v2', JSON.stringify(p)); }, { ws: WS, code: CODE });
await P.goto(`${BASE}/?nolock=1`);
await P.waitForSelector('[data-a="go"][data-v="online"]', { timeout: 30000 });
await P.click('[data-a="go"][data-v="online"]');
await P.waitForSelector('[data-a="oljoin"]', { timeout: 10000 });
await P.click('[data-a="oljoin"]');
await P.waitForFunction(() => /banned/i.test(document.querySelector('.olmsg.err')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
const mm = await P.evaluate(() => document.querySelector('.olmsg.err')?.textContent || '');
check(/You are banned from this server · time left: (1 d|23 h 59 min)\. Reason: hile kullanıyor/.test(mm), 'menüden katılma (en): ' + mm);
await P.screenshot({ path: 'screenshots/mod-banmenu-en.png' });

say('/unban Kotu'); await wait(300);
check(P.errs.length === 0, 'sayfa hatası yok ' + JSON.stringify(P.errs));
clearInterval(ping); mod.close(); await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
