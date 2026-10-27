// 12.191 Ele geçirme göstergesi denetimi (tarayıcı): her bayrağa oyuncu girer → gösterge durumu (ELE GEÇİRİLİYOR / NÖTRLEŞTİRİLİYOR / ÇEKİŞMELİ) + ilerleme
// gerçekten ilerliyor mu (HUD "alıyor" deyip ilerleme 0 kalmasın: Baraj hatası 12.184) + bayrak dönünce ELE GEÇİRİLDİ! + bildirim; çevrimiçinde sunucu ilerlemesiyle
// eşleşme, kare başına sıçrama yok, geç katılan doğru durumu görür ve bildirim almaz.
//   node scripts/captest.mjs [url=http://127.0.0.1:5199] [ws=ws://127.0.0.1:8977]   MAPS=kuzey,colgecidi · ONLINE=0 ile yalnız çevrimdışı
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://127.0.0.1:5199', WS = process.argv[3] || 'ws://127.0.0.1:8977';
const MAPS = (process.env.MAPS || 'kuzey,colgecidi').split(','), ONLINE = process.env.ONLINE !== '0';
const browser = await chromium.launch(process.env.SOFT ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });      // SOFT=1: yazılım GPU
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg, x = '') => { console.log((ok ? 'OK    ' : 'HATA  ') + msg + (x ? ' · ' + x : '')); if (!ok) fail++; };

// sayfaya yardımcılar: bayrağın içinde hedef kotunda boş nokta, oyuncuyu koy, bayrağı kur, gösterge durumu
const HELP = () => {
  const g = window.__game;
  window.__T = {
    spot(o, r0 = 2, r1 = o.r * 0.6) {
      for (let k = 0; k < 600; k++) {
        const a = (k * 2.399) % 6.283, r = r0 + ((k * 0.618) % 1) * (r1 - r0), x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r;
        if (g.nav && !g.nav.isFree(x, z)) continue;
        const y = g.world.groundAt(x, z); if (Math.abs(y - g.objY(o)) > 3) continue;
        if (g.world._hits(g.world.query(x - 1, z - 1, x + 1, z + 1, []), x, y + 0.2, z, 1.6)) continue;
        return { x, y, z };
      }
      return null;
    },
    st() { const w = document.getElementById('capw'); return { on: !!w?.classList.contains('on'), st: w?.dataset.st || '', txt: w ? w.innerText.replace(/\s+/g, ' ').trim() : '' }; },
    toasts() { return [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent); },
  };
};

async function offline(map) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?autostart=8v8&map=${map}&type=conquest&debug=1&nolock=1&time=1800&tickets=900`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 300000 });
  await page.evaluate(HELP);
  await page.evaluate(() => { const g = window.__game; g.devGod = true; for (const b of g.brains) b.update = () => {}; for (const s of g.soldiers) if (s !== g.playerSoldier) { s.alive = false; s.respawnT = 1e9; } });
  const n = await page.evaluate(() => window.__game.mode.objectives.length);
  for (let i = 0; i < n; i++) {
    const r = await page.evaluate(async (i) => {
      const g = window.__game, o = g.mode.objectives[i], me = g.playerSoldier, S = me.team === 'blue' ? 1 : -1, T = window.__T, P = T.spot(o);
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!P) return { id: o.id, err: 'nokta yok' };
      for (const q of g.mode.objectives) { q.owner = null; q.p = 0; q.pd = 0; }
      const put = () => { me.pos.set(P.x, P.y + 0.05, P.z); me.vel.set(0, 0, 0); g.world.settle(me); };
      put(); await sleep(150);
      const out = { id: o.id, label: o.label || o.id, y: +me.pos.y.toFixed(1), oy: +g.objY(o).toFixed(1) };
      out.in = g.inObjective(me.pos, o);
      // 1 nötr → ele geçiriliyor, ilerleme artar
      o.p = 0; o.pd = 0; const t0 = g.time; await sleep(1200); out.cap = { ...T.st(), p: +(o.p * S).toFixed(3), nb: o.nb, nr: o.nr, want: +(g.capRate(o) * S * (g.time - t0)).toFixed(3) };      // oyun saatiyle (yavaş karede oyun zamanı duvar saatinden yavaş)
      // 2 düşmanın → nötrleştiriliyor
      o.owner = me.team === 'blue' ? 'red' : 'blue'; o.p = -S; o.pd = -S; await sleep(900); out.neu = { ...T.st(), p: +(o.p * S).toFixed(3) };
      // 3 çekişmeli: bir düşmanı yanına koy (ölü botu dirilt)
      const e = g.soldiers.find((s) => s.team !== me.team); e.alive = true; e.hp = 100; e.pos.copy(me.pos); e.pos.x += 0.6; g.world.settle(e);
      o.owner = null; o.p = 0.3 * S; o.pd = o.p; await sleep(900); out.ctd = { ...T.st(), p: +(o.p * S).toFixed(3) };
      e.alive = false; e.respawnT = 1e9;
      // 4 geçiş: %95 → ele geçirildi + bildirim
      o.owner = null; o.p = 0.95 * S; o.pd = o.p; await sleep(1300);
      out.flip = { ...T.st(), own: o.owner, toast: T.toasts().join(' | ') };
      // 5 çık → bölgeden çıktın
      o.owner = null; o.p = 0.4 * S; o.pd = o.p; await sleep(300); g.hud.cap.flash = null;
      me.pos.set(o.x + o.r + 12, 0, o.z); me.pos.y = g.world.groundAt(me.pos.x, me.pos.z); g.world.settle(me); await sleep(250);
      out.left = T.st();
      return out;
    }, i);
    const L = `${map} ${r.label}`;
    if (r.err) { check(false, L, r.err); continue; }
    check(r.in, `${L}: oyuncu alanda (y ${r.y}, hedef ${r.oy})`);
    check(r.cap.on && r.cap.st === 'capturing' && r.cap.p > 0.02 && Math.abs(r.cap.p - r.cap.want) < 0.02, `${L}: ELE GEÇİRİLİYOR + ilerleme = hız × süre`, `${r.cap.st} p=${r.cap.p} (beklenen ${r.cap.want}) sayı ${r.cap.nb}/${r.cap.nr} · ${r.cap.txt}`);
    check(r.neu.st === 'neutralizing' && r.neu.p > -0.99, `${L}: NÖTRLEŞTİRİLİYOR + düşman rengi boşalıyor`, `${r.neu.st} p=${r.neu.p}`);
    check(r.ctd.st === 'contested' && Math.abs(r.ctd.p - 0.3) < 0.001, `${L}: ÇEKİŞMELİ + ilerleme durdu`, `${r.ctd.st} p=${r.ctd.p}`);
    check(r.flip.st === 'captured' && r.flip.own && /ele geçirildi/.test(r.flip.toast), `${L}: ELE GEÇİRİLDİ! + bildirim`, `${r.flip.st} sahip ${r.flip.own} · ${r.flip.toast}`);
    check(r.left.st === 'left', `${L}: BÖLGEDEN ÇIKTIN`, r.left.txt);
  }
  check(!errs.length, `${map}: sayfa hatası yok`, errs.slice(0, 2).join(' | '));
  await page.close();
}

async function online(map) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?online=new&type=conquest&per=8&map=${map}&bots=0&debug=1&nolock=1&server=${WS}&name=Ali&team=blue&time=1800`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 300000 });
  await page.evaluate(HELP);
  await wait(800);
  const code = await page.evaluate(() => window.__game.opts.online?.welcome?.room || window.__game.opts.online?.room || window.__game.online?.room);
  const n = await page.evaluate(() => window.__game.mode.objectives.length);
  const flags = map === 'kuzey' ? [0, 4, Math.max(0, n - 1)] : [...Array(n).keys()];       // Kuzey: A, E (Baraj), G
  for (const i of flags) {
    const r = await page.evaluate(async (i) => {
      const g = window.__game, o = g.mode.objectives[i], me = g.playerSoldier, T = window.__T, P = T.spot(o), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!P) return { err: 'nokta yok', label: o.label || o.id };
      g.online.send({ t: 'dbg', obj: [i, null, 0] });
      g.online.send({ t: 'dbg', tpy: [P.x, P.y + 0.3, P.z] });
      await sleep(700);
      const out = { label: o.label || o.id, in: g.inObjective(me.pos, o), y: +me.pos.y.toFixed(1), oy: +g.objY(o).toFixed(1) };
      // 2 sn boyunca her kare: gösterilen ilerleme (pd) ile sunucunun (p) farkı, kare başına sıçrama
      const S = me.team === 'blue' ? 1 : -1; let maxJump = 0, maxLag = 0, last = o.pd, dec = 0, frames = 0; const p0 = o.p * S;
      await new Promise((res) => { const t0 = performance.now(); const f = () => { const d = (o.pd - last) * S; maxJump = Math.max(maxJump, Math.abs(d)); if (d < -1e-4) dec++; last = o.pd; maxLag = Math.max(maxLag, Math.abs(o.pd - o.p)); frames++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      Object.assign(out, { st: T.st(), p0: +p0.toFixed(3), p1: +(o.p * S).toFixed(3), nb: o.nb, nr: o.nr, maxJump: +maxJump.toFixed(4), maxLag: +maxLag.toFixed(3), dec, frames });
      // geçiş: sunucuda %93
      g.online.send({ t: 'dbg', obj: [i, null, 0.93 * S] });
      await sleep(1500);
      out.flip = { ...T.st(), own: o.owner, toast: T.toasts().join(' | ') };
      return out;
    }, i);
    const L = `çevrimiçi ${map} ${r.label}`;
    if (r.err) { check(false, L, r.err); continue; }
    check(r.in, `${L}: oyuncu alanda (y ${r.y}, hedef ${r.oy})`);
    check(r.st.st === 'capturing' && r.p1 > r.p0 + 0.1 && r.nb + r.nr >= 1, `${L}: ELE GEÇİRİLİYOR, sunucu ilerliyor + sunucu sayısı`, `${r.p0} → ${r.p1} sayı ${r.nb}/${r.nr}`);
    check(r.maxJump < 0.02 && r.dec === 0 && r.maxLag < 0.06, `${L}: gösterilen ilerleme akıcı (kare başına en çok ${r.maxJump}, geri ${r.dec}, sunucudan sapma ${r.maxLag}, ${r.frames} kare)`);
    check(r.flip.st === 'captured' && r.flip.own === 'blue' && /ele geçirildi/.test(r.flip.toast), `${L}: ELE GEÇİRİLDİ! + bildirim`, `${r.flip.st} · ${r.flip.toast}`);
  }
  // geç katılan: aynı odaya ikinci oyuncu; bayrak durumu birinciyle aynı, katılırken bildirim yok
  if (code) {
    await page.evaluate(() => { const g = window.__game; g.online.send({ t: 'dbg', obj: [1, 'red', -0.42] }); });
    const p2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await p2.goto(`${BASE}/?online=${code}&debug=1&nolock=1&server=${WS}&name=Veli&team=red`);
    await p2.waitForFunction('window.__game && window.__game.running', null, { timeout: 300000 });
    await p2.evaluate(HELP); await wait(1200);
    const a = await page.evaluate(() => window.__game.mode.objectives.map((o) => [o.owner, +o.p.toFixed(2)]));
    const b = await p2.evaluate(() => ({ o: window.__game.mode.objectives.map((o) => [o.owner, +o.p.toFixed(2), +(o.pd ?? 0).toFixed(2)]), t: window.__T.toasts() }));
    const same = a.every((x, i) => x[0] === b.o[i][0] && Math.abs(x[1] - b.o[i][1]) < 0.05 && Math.abs(b.o[i][1] - b.o[i][2]) < 0.05);
    check(same, `çevrimiçi ${map}: geç katılan bayrakları doğru görür`, JSON.stringify(b.o));
    check(!b.t.some((s) => /ele geçirildi|kaybedildi|nötrleştir/.test(s)), `çevrimiçi ${map}: geç katılana bayrak bildirimi yağmuyor`, b.t.join(' | '));
    await p2.close();
  } else check(false, `çevrimiçi ${map}: oda kodu bulunamadı`);
  check(!errs.length, `çevrimiçi ${map}: sayfa hatası yok`, errs.slice(0, 2).join(' | '));
  await page.close();
}

if (process.env.OFFLINE !== '0') for (const m of MAPS) await offline(m);
if (ONLINE) for (const m of MAPS) await online(m);
console.log(fail ? `sonuç: ${fail} HATA` : 'sonuç: OK');
await browser.close();
process.exit(fail ? 1 : 0);
