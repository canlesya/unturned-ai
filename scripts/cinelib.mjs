// 12.217 sinema kaydı ortak yardımcıları: gerçek GPU tarayıcı (headless:false, Metal), 1920×1080, ?cine=1 maç, sanal saat (performance.now
// kare kare ilerler → su / ot / efekt zamanı da sabit adımlı), kare yakalama (toDataURL JPEG, HUD zaten yok).
import { chromium } from 'playwright';
import fs from 'fs';

export const W = 1920, H = 1080;
export async function openCine({ url = 'http://127.0.0.1:5204', per = 24, tod = 'sunset', weather = 'clear', seed, extra = '', audio = 0 } = {}) {
  const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', `--window-size=${W},${H + 120}`] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'tr-TR' });
  await ctx.addInitScript(({ sd, aud }) => {
    const real = performance.now.bind(performance);
    let vt = null;
    performance.now = () => (vt == null ? real() : vt);
    window.__vt = { start() { vt = real(); }, add(ms) { if (vt != null) vt += ms; }, get() { return vt; } };
    if (sd != null) {                                                                      // tohumlu Math.random (aynı çekim yeniden üretilebilsin)
      let s = sd >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    try { localStorage.setItem('warbyte.v2', JSON.stringify({ name: 'Kamera', shadows: true, post: true, q: 2 })); } catch (e) { /* yok */ }
    // Ses: audio > 0 ise oyunun ortak AudioContext'i (actx.getCtx) yerine tek bir OfflineAudioContext (audio sn). Kare başına __aud.adv(1/60):
    // suspend / resume ile ses de kareyle aynı adımda işlenir → atış / patlama / motor / ortam sesleri görüntüyle birebir eşzamanlı.
    if (aud > 0) {
      const SR = 48000, OAC = window.OfflineAudioContext;
      let oac = null;
      const mk = () => {
        if (oac) return oac;
        oac = new OAC(2, Math.round(SR * aud), SR);
        const res = oac.resume.bind(oac), sus = oac.suspend.bind(oac);
        oac.resume = () => Promise.resolve();                                 // oyun (kilit / görünürlük) sesi kendisi sürdüremesin
        oac.suspend = () => Promise.resolve();
        let cur = 128, want = 128, first = sus(128 / SR);                    // want: kesirli hedef (kare = 800 örnek; 128'lik dilime yuvarlama birikmesin)
        const A = (window.__aud = { ctx: oac, sr: SR, cur: () => cur / SR,
          async adv(sec) { if (first) { await first; first = null; } want += sec * SR; const tgt = Math.round(want / 128) * 128; if (tgt <= cur) return; const p = sus(tgt / SR); res(); await p; cur = tgt; },
          async finish() { if (first) { await first; first = null; } res(); A.buf = await A.done; return A.buf.length; },
          // [a, b) sn → 16 bit stereo WAV (base64)
          wav(a, b) {
            const B = A.buf, i0 = Math.max(0, Math.round(a * SR)), i1 = Math.min(B.length, Math.round(b * SR)), n = Math.max(0, i1 - i0), L = B.getChannelData(0), R = B.getChannelData(1);
            const buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
            w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
            for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i0 + i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i0 + i])) * 32767, true); }
            let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
            return btoa(s);
          } });
        A.done = oac.startRendering();
        return oac;
      };
      window.AudioContext = function () { return mk(); }; window.webkitAudioContext = window.AudioContext;
    }
  }, { sd: seed ?? null, aud: audio });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const q = `?autostart=${per}v${per}&map=kuzey&type=conquest&dev=0&debug=1&nolock=1&nologin=1&cine=1&tod=${tod}&weather=${weather}&time=0&tickets=9999&pr=2&post=1&diff=hard${extra}`;
  await page.goto(url + '/' + q);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.cine', null, { timeout: 300000 });
  await page.evaluate(() => { const g = window.__game; g.cine.auto = false; g.cine.manual(); window.__vt.start(); g.devGod = false; });
  return { browser, page, errs };
}

// n kare çek: her kare cine.frame(dt) + sanal saat; JPEG'ler dir/f%06d.jpg (start numarasından)
export async function grab(page, dir, start, n, { dt = 1 / 60, q = 0.93, batch = 6, onFrame } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  let k = 0;
  while (k < n) {
    const m = Math.min(batch, n - k);
    const urls = await page.evaluate(async ({ m, dt, q, hook }) => {
      const g = window.__game, out = [];
      for (let i = 0; i < m; i++) {
        window.__vt.add(dt * 1000 * g.cine.timeScale);
        if (hook) (0, eval)(hook)(g);
        g.cine.frame(dt);
        out.push(g.canvas.toDataURL('image/jpeg', q));
        if (window.__aud) await window.__aud.adv(dt);
        (window.__ov ||= []).push({ scope: g.cine.overlay.scope, ts: +g.cine.timeScale.toFixed(3), at: window.__aud ? +window.__aud.cur().toFixed(4) : 0 });
      }
      return out;
    }, { m, dt, q, hook: onFrame || null });
    for (const u of urls) fs.writeFileSync(`${dir}/f${String(start + k++).padStart(6, '0')}.jpg`, Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'));
  }
  return start + n;
}
