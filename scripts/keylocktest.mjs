// Ctrl+W koruması: kilit alınınca klavye kilidi + tam ekran istenir, oyun sürerken beforeunload onayı vardır
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript(() => {
  window.__k = { lock: null, unlock: 0, fs: 0 };
  Object.defineProperty(navigator, 'keyboard', { value: { lock: (k) => { window.__k.lock = k; return Promise.resolve(); }, unlock: () => { window.__k.unlock++; } } });
  Element.prototype.requestFullscreen = function () { window.__k.fs++; return Promise.resolve(); };
});
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?autostart=3v3&debug=1&type=conquest`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
await page.evaluate(() => { const g = window.__game; Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => g.canvas }); document.dispatchEvent(new Event('pointerlockchange')); });
const r = await page.evaluate(() => ({ ...window.__k, keys: window.__k.lock?.length, hasW: window.__k.lock?.includes('KeyW'), hasCtrl: window.__k.lock?.includes('ControlLeft'), hasEsc: window.__k.lock?.includes('Escape') }));
const prevented = await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
console.log(JSON.stringify(r), 'beforeunload engellendi mi:', prevented, 'hata', errs.length, errs);
await browser.close();
