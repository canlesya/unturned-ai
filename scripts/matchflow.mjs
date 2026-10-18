// Maç sonu akışı (tarayıcı): çevrimdışı maç biter → sonuç ekranı + 3 seçenek + geri sayım → seçilen haritada yeni maç (menüye dönmez);
// çevrimiçi resmi oda: oylama kartları (masaüstü + Pixel 7 touch=1) → oy → sunucu yeni maçı kurar → sayfa yenilenmeden yeni harita.
// Önce: vite (BASE) + BF_DEBUG=1 BF_RESTART_MS=8000 sunucu (WS).  BASE=http://127.0.0.1:5297 WS=ws://127.0.0.1:8826 node scripts/matchflow.mjs  · görüntüler: /tmp/wb-m-shots/
import { chromium, devices } from 'playwright';
import WebSocket from 'ws';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:5180', WS = process.env.WS || 'ws://127.0.0.1:8787', OUT = process.env.OUT || '/tmp/wb-m-shots';
fs.mkdirSync(OUT, { recursive: true });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = { desktop: { viewport: { width: 1280, height: 720 }, locale: 'tr-TR' }, pixel7: { ...strip(devices['Pixel 7 landscape']), locale: 'tr-TR' } };
const ONLY = process.env.ONLY || '';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await f(); if (v) return v; await wait(100); } return null; };
const state = (page) => page.evaluate(() => { const g = window.__game, es = document.getElementById('endscreen'); return { g: !!g, map: g?.mapDef?.id, tod: g?.opts?.tod, weather: g?.opts?.weather, ended: g?.ended, running: g?.running, end: es ? getComputedStyle(es).display : null, menu: document.getElementById('menu')?.style.display, cards: document.querySelectorAll('#mnext .mn-c').length, cd: document.getElementById('mnT')?.textContent, mark: window.__mark || 0 }; }).catch(() => ({ nav: true }));

// ── çevrimdışı ──
if (!ONLY || ONLY === 'offline') for (const [dev, ctxOpt] of Object.entries(DEVS)) {
  const ctx = await browser.newContext(ctxOpt), page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?autostart=2v2&type=tdm&map=depo&tod=day&debug=1&nolock=1&time=8&touch=${dev === 'pixel7' ? 1 : 0}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
  await page.evaluate(() => { window.__mark = 7; window.__game.timeLeft = 0.3; });       // yazılım GPU'da süre yavaş akar: süre bitimini öne al
  const s1 = await until(async () => { const s = await state(page); return s.end === 'flex' && s.cards ? s : null; }, 30000);
  check(!!s1 && s1.cards === 3, `${dev} çevrimdışı: maç bitti, sonuç ekranında ${s1?.cards} kart, geri sayım ${s1?.cd}`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${dev}-offline-end.png` });
  const pick = await page.evaluate(() => { const b = document.querySelectorAll('#mnext .mn-c')[1]; return b.querySelector('b').textContent; });
  if (dev === 'pixel7') await page.tap('#mnext .mn-c[data-i="1"]'); else await page.click('#mnext .mn-c[data-i="1"]');
  const sel = await page.evaluate(() => document.querySelector('#mnext .mn-c.on')?.dataset.i);
  check(sel === '1', `${dev} kart seçildi: ${pick}`);
  await page.screenshot({ path: `${OUT}/${dev}-offline-picked.png` });
  const s2 = await until(async () => { const s = await state(page); return s.g && !s.ended && s.end !== 'flex' && s.map && s.running !== undefined && s.cards === 0 ? s : null; }, 40000);
  const exp = await page.evaluate(() => window.__game?.mapDef?.name);
  check(!!s2 && s2.menu === 'none' && s2.mark === 7 && exp === pick, `${dev} geri sayım bitti → yeni maç seçilen haritada (${exp} / ${s2?.tod} / ${s2?.weather}), menü kapalı, sayfa yenilenmedi`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${dev}-offline-next.png` });
  check(!errs.length, `${dev} çevrimdışı sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}

// ── çevrimiçi resmi oda ──
const rooms = await (await fetch(WS.replace(/^ws/, 'http') + '/rooms')).json();
const R = rooms.find((r) => r.official && r.type === 'dm' && !r.humans) || rooms.find((r) => r.official && !r.humans);
if (!ONLY || ONLY === 'online') for (const [dev, ctxOpt] of Object.entries(DEVS)) {
  const ctx = await browser.newContext(ctxOpt), page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  let navs = 0; page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs++; });
  await page.goto(`${BASE}/?online=${R.code}&name=Ali&server=${encodeURIComponent(WS)}&debug=1&nolock=1&touch=${dev === 'pixel7' ? 1 : 0}`);
  await page.waitForFunction('window.__game && window.__game.online', null, { timeout: 90000 });
  await page.evaluate(() => { window.__mark = 9; });
  const navs0 = navs;
  // yardımcı ikinci insan: maçı bitirir (BF_DEBUG), oy verir
  const b = new WebSocket(WS); b.msgs = []; b.on('message', (d) => b.msgs.push(JSON.parse(d)));
  await new Promise((r) => b.on('open', r));
  b.send(JSON.stringify({ t: 'join', room: R.code, name: 'Veli' }));
  await until(() => b.msgs.find((m) => m.t === 'welcome'), 6000);
  await page.waitForTimeout(1500);
  b.send(JSON.stringify({ t: 'dbg', kl: [[0, 0]] }));
  const me = await page.evaluate(() => window.__game.playerSoldier.id);
  b.send(JSON.stringify({ t: 'dbg', kl: [[me, 999]] }));                                         // ölüm maçı: öldürme sınırına ulaş → maç biter
  const end = await until(() => b.msgs.find((m) => m.t === 'end'), 8000);
  check(!!end?.vote, `${dev} ${R.code} maç bitti, oylama: ${end?.vote?.opts.map((o) => `${o.map}/${o.tod}/${o.weather}`).join(' | ')}`);
  const s1 = await until(async () => { const s = await state(page); return s.end === 'flex' && s.cards === 3 ? s : null; }, 8000);
  check(!!s1, `${dev} oylama kartları görünüyor (${s1?.cards}), geri sayım ${s1?.cd}`);
  await page.screenshot({ path: `${OUT}/${dev}-online-vote.png` });
  if (dev === 'pixel7') await page.tap('#mnext .mn-c[data-i="2"]'); else await page.click('#mnext .mn-c[data-i="2"]');
  const v1 = await until(() => b.msgs.filter((m) => m.t === 'votes').pop(), 3000);
  check(v1 && v1.c[2] === 1, `${dev} tarayıcının oyu sunucuya ulaştı: ${JSON.stringify(v1?.c)}`);
  const shown = await until(async () => (await page.evaluate(() => document.querySelector('#mnext .mn-c[data-i="2"] .mn-v')?.textContent)) === '1', 3000);
  check(!!shown, `${dev} canlı oy sayısı kartta`);
  await page.screenshot({ path: `${OUT}/${dev}-online-voted.png` });
  b.send(JSON.stringify({ t: 'vote', i: 2 }));
  const win = end.vote.opts[2];
  const s2 = await until(async () => { const s = await state(page); return s.g && !s.ended && s.map === win.map && s.tod === win.tod && s.weather === win.weather && s.cards === 0 ? s : null; }, 30000);
  check(!!s2 && s2.mark === 9 && s2.menu === "none", `(mark ${s2?.mark}, menu ${s2?.menu}, gezinme ${navs - navs0} — replaceState de sayılır) ` + `${dev} yeni maç sayfa yenilenmeden kazanan haritada: ${s2?.map}/${s2?.tod}/${s2?.weather} (beklenen ${win.map}/${win.tod}/${win.weather})`);
  const snapOk = await until(() => page.evaluate(() => window.__game?.online?.stats?.snaps > 5), 8000);
  check(!!snapOk, `${dev} yeni maçta snapshot akıyor`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${dev}-online-next.png` });
  check(!errs.length, `${dev} çevrimiçi sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  b.close();
  await ctx.close();
}
await browser.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
