// 12.232 Kare temposu testi (başsız, < 60 sn): menü 30 FPS, oyunda ekran hızı, duraklatma / odaksız 30, gizliyken çizim yok ama çevrim içi sim + ağ
// sürüyor, görünür olunca geri geliyor; yürürken kamera hızı kareden kareye düzgün (çevrimdışı + çevrim içi); ön ısıtma efekt programlarını derlemiş.
//   node --import ./scripts/lib/pw-quiet.mjs scripts/pacetest.mjs        URL=http://127.0.0.1:5199 WS=ws://127.0.0.1:8978
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://127.0.0.1:5199', WS = process.env.WS || 'ws://127.0.0.1:8978';
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'HATA'} ${msg}`); if (!ok) fail++; };
const browser = await chromium.launch({ headless: true });
const errs = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  // sayfa içi yardımcılar: ad'lı pacer'ın t ms'deki çizilen kare hızı; ham rAF hızı; gizli / odak taklidi
  await ctx.addInitScript(() => {
    window.__pt = {
      rate: async (name, ms = 1500) => { const p = () => window.__pace.list().find((x) => x.name === name); const a = p(), t0 = performance.now(); await new Promise((r) => setTimeout(r, ms)); const b = p(); const s = (performance.now() - t0) / 1000; return { fps: (b.drawn - a.drawn) / s, hidden: (b.hidden - a.hidden) / s, target: b.fps }; },
      raf: async (ms = 1000) => { let n = 0; const t0 = performance.now(); await new Promise((r) => { const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return n / ((performance.now() - t0) / 1000); },
      hide: (v) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => v }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (v ? 'hidden' : 'visible') }); document.dispatchEvent(new Event('visibilitychange')); },
      // yürüyüş: kamera yatay konumu her çizilen karede (rAF zaman damgasıyla) → kare başına hız
      walk: async (ms = 1600) => {
        const g = window.__game, rec = [], loop = g.loop, s = g.playerSoldier;
        // en açık yöne dön (duvara takılan yürüyüş ölçümü bozmasın): 16 yön, 0,5 m adımlarla nav ızgarasında boş mesafe
        let best = s.yaw, bd = -1;
        for (let k = 0; k < 16; k++) { const yw = (k * Math.PI) / 8; let d = 0; while (d < 14 && g.nav.isFree(s.pos.x - Math.sin(yw) * (d + 0.5), s.pos.z - Math.cos(yw) * (d + 0.5))) d += 0.5; if (d > bd) { bd = d; best = yw; } }
        s.yaw = best;
        await new Promise((r) => setTimeout(r, 450));                                // hızlanma
        g.loop = function (now, draw) { loop.call(this, now, draw); if (draw !== false) rec.push([now, g.camera.position.x, g.camera.position.z]); };
        await new Promise((r) => setTimeout(r, ms));
        g.loop = loop;
        const v = [];
        for (let i = 1; i < rec.length; i++) { const dt = (rec[i][0] - rec[i - 1][0]) / 1000; if (dt > 0) v.push(Math.hypot(rec[i][1] - rec[i - 1][1], rec[i][2] - rec[i - 1][2]) / dt); }
        const mid = v.slice(Math.floor(v.length * 0.3), Math.floor(v.length * 0.95)).filter((x) => x > 1);       // hızlanma bitmiş, duvara takılmamış kareler
        const m = mid.reduce((a, b) => a + b, 0) / Math.max(1, mid.length), sd = Math.sqrt(mid.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, mid.length));
        return { frames: rec.length, fps: +(rec.length / (ms / 1000)).toFixed(0), n: mid.length, speed: +m.toFixed(2), cv: +(sd / (m || 1)).toFixed(3) };
      },
    };
  });

  // ── 1) ana menü: 3B arka plan 30 FPS (ekran 60 Hz), gizliyken 0 ──
  await page.goto(`${URL}/?nolock=1`);
  await page.waitForFunction(() => window.__pace?.list().some((p) => p.name === 'menu' && p.drawn > 20), null, { timeout: 30000 });
  const raf = await page.evaluate(() => window.__pt.raf());
  const m1 = await page.evaluate(() => window.__pt.rate('menu'));
  check(m1.fps >= 24 && m1.fps <= 33 && raf > 50, `menü sahnesi ${m1.fps.toFixed(1)} FPS (ekran rAF ${raf.toFixed(0)} / sn, hedef ${m1.target})`);
  await page.evaluate(() => window.__pt.hide(true));
  const m2 = await page.evaluate(() => window.__pt.rate('menu', 1000));
  check(m2.fps === 0, `menü gizliyken çizim yok (${m2.fps.toFixed(1)} FPS)`);
  await page.evaluate(() => window.__pt.hide(false));
  const m3 = await page.evaluate(() => window.__pt.rate('menu', 1000));
  check(m3.fps >= 20, `menü görünür olunca yeniden ${m3.fps.toFixed(1)} FPS`);
  await page.evaluate(() => { dispatchEvent(new Event('blur')); });
  const m4 = await page.evaluate(() => window.__pt.rate('menu', 1500));
  check(m4.fps >= 6 && m4.fps <= 12, `menü odaksız pencerede ${m4.fps.toFixed(1)} FPS (hedef 10)`);
  await page.evaluate(() => { dispatchEvent(new Event('focus')); });

  // ── 2) çevrimdışı maç: oynarken ekran hızı, duraklatınca 30, odaksız 30; ön ısıtma; yürüyüş düzgünlüğü ──
  await page.goto(`${URL}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&nolock=1`);
  await page.waitForFunction(() => window.__game?.running && window.__game.playerSoldier?.alive, null, { timeout: 60000 });
  const warm = await page.evaluate(() => { const g = window.__game; return { ms: g.warm?.ms, n: g.renderer.info.programs.length }; });
  check(warm.n > 20, `ön ısıtma ${warm.ms} ms, ${warm.n} program`);
  const g1 = await page.evaluate(() => window.__pt.rate('game'));
  check(g1.fps >= 50 && g1.target === 0, `oyunda ${g1.fps.toFixed(1)} FPS (sınır yok)`);
  // efekt örnekleri sahnede bırakılmamış
  check(await page.evaluate(() => { const e = window.__game.effects; return e.parts.length + e.tracers.length + e.explosions.length + e.flashes.length < 40; }), 'ön ısıtma efekt örnekleri kaldırıldı');
  // yürüyüş: W basılı, düz (çevrimdışı değişken adım)
  await page.evaluate(() => { window.__game.devGod = true; });
  await page.keyboard.down('KeyW');
  const w1 = await page.evaluate(() => window.__pt.walk());
  await page.keyboard.up('KeyW');
  // yük altında (qa paralel koşu: başsız sekme 20–40 FPS) rAF damgaları düzensizleşir → eşik gevşer
  const walkOk = (w) => w.n > 15 && (w.cv < 0.08 || (w.fps < 45 && w.cv < 0.25));
  check(walkOk(w1), `çevrimdışı yürüyüş: ${w1.n} kare (${w1.fps} FPS), hız ${w1.speed} m/sn, kare kare sapma (CV) ${w1.cv}`);
  const t0 = await page.evaluate(() => window.__game.time);
  await page.keyboard.press('Escape');                                             // nolock: duraklatma
  await page.waitForFunction(() => !window.__game.simulate, null, { timeout: 5000 });
  const g2 = await page.evaluate(() => window.__pt.rate('game'));
  const t1 = await page.evaluate(() => window.__game.time);
  check(g2.fps >= 24 && g2.fps <= 33 && t1 - t0 < 0.2, `duraklatma menüsü ${g2.fps.toFixed(1)} FPS, oyun zamanı durdu (+${(t1 - t0).toFixed(2)} sn)`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__game.simulate, null, { timeout: 5000 });
  await page.evaluate(() => { dispatchEvent(new Event('blur')); });
  const g3 = await page.evaluate(() => window.__pt.rate('game'));
  await page.evaluate(() => { dispatchEvent(new Event('focus')); });
  const g4 = await page.evaluate(() => window.__pt.rate('game', 1000));
  check(g3.fps >= 24 && g3.fps <= 33 && g4.fps >= 50, `odaksız pencere ${g3.fps.toFixed(1)} FPS, odak dönünce ${g4.fps.toFixed(1)}`);
  // çözünürlük boşta düşmemiş (otomatik çözünürlük 30 FPS'i yavaş GPU sanmasın)
  check(await page.evaluate(() => window.__game.renderer.getPixelRatio() >= 0.99), 'boşta otomatik çözünürlük düşmedi');
  await page.evaluate(() => removeEventListener('beforeunload', window.__game._bu));

  // ── 3) çevrim içi: gizliyken çizim yok, sim + girdi gönderimi gerçek zamanla sürer; görünür olunca çizim geri ──
  await page.goto(`${URL}/?online=new&name=Tempo&map=colgecidi&type=tdm&per=2&bots=0&dev=1&debug=1&nolock=1&server=${encodeURIComponent(WS)}`);
  await page.waitForFunction(() => window.__game?.running && window.__game.online && window.__game.playerSoldier?.alive, null, { timeout: 60000 });
  const o1 = await page.evaluate(() => window.__pt.rate('game', 1000));
  check(o1.fps >= 50, `çevrim içi oyunda ${o1.fps.toFixed(1)} FPS`);
  await page.keyboard.down('KeyW');
  const w2 = await page.evaluate(() => window.__pt.walk());
  await page.keyboard.up('KeyW');
  check(walkOk(w2), `çevrim içi yürüyüş (sabit 60 Hz adım + ara değerleme): ${w2.n} kare (${w2.fps} FPS), hız ${w2.speed} m/sn, CV ${w2.cv}`);
  const s0 = await page.evaluate(() => ({ q: window.__game.online.seq, t: window.__game.time, snaps: window.__game.online.stats.snaps }));
  await page.evaluate(() => window.__pt.hide(true));
  const o2 = await page.evaluate(() => window.__pt.rate('game', 2000));
  const s1 = await page.evaluate(() => ({ q: window.__game.online.seq, t: window.__game.time, snaps: window.__game.online.stats.snaps }));
  const sec = 2;
  check(o2.fps === 0 && o2.hidden >= 7, `çevrim içi gizli: çizim ${o2.fps.toFixed(1)} FPS, gizli adım ${o2.hidden.toFixed(1)} / sn`);
  check((s1.q - s0.q) / sec > 45 && (s1.t - s0.t) / sec > 0.8, `gizliyken girdi ${((s1.q - s0.q) / sec).toFixed(0)} / sn, oyun zamanı ${((s1.t - s0.t) / sec).toFixed(2)} sn/sn, anlık görüntü +${s1.snaps - s0.snaps}`);
  await page.evaluate(() => window.__pt.hide(false));
  const o3 = await page.evaluate(() => window.__pt.rate('game', 1000));
  check(o3.fps >= 50, `görünür olunca ${o3.fps.toFixed(1)} FPS`);
  await page.evaluate(() => removeEventListener('beforeunload', window.__game._bu));
} catch (e) {
  console.log('HATA istisna:', e.message); fail++;
} finally {
  await browser.close();
}
if (errs.length) { console.log('HATA sayfa hatası:', errs.slice(0, 3).join(' / ')); fail++; }
console.log(fail ? `pacetest: HATA (${fail})` : 'pacetest: OK');
process.exit(fail ? 1 : 0);
