// Dokunmatik ayar panelini GERÇEK dokunuşla (tap) dener: panel düğmeleri tıklama üretiyor mu?  node scripts/touchedit.mjs [url]
// (Fareyle tıklama bu hatayı yakalamaz: dokunmada preventDefault, click olayını engeller.)
import { chromium, devices } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5180';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['Pixel 7 landscape'] });
await ctx.grantPermissions(['accelerometer', 'gyroscope']);          // gerçek telefonda tarayıcı sorar; test tarayıcısı izinsiz reddeder
const page = await ctx.newPage();
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const tapEl = async (sel) => { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('yok: ' + sel); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(250); };
await page.goto(base + '/?autostart=3v3&map=colgecidi&type=tdm&debug=1&touch=1');
await page.waitForFunction(() => window.__game && document.getElementById('bResume'), null, { timeout: 60000 });
await page.evaluate(() => localStorage.removeItem('warbyte.touch'));
await tapEl('#bResume');
check(await page.evaluate(() => window.__game.simulate), 'BAŞLA dokunuşla oyunu başlattı');
await tapEl('#tc [data-b=pause]');
check(!(await page.evaluate(() => window.__game.simulate)), 'duraklat butonu');
await tapEl('#bTouch');
check(await page.evaluate(() => document.getElementById('tc').classList.contains('edit')), 'Dokunmatik ayarlar açıldı');
// butonu parmakla sürükle (gerçek dokunma olayları: CDP)
const cdp = await ctx.newCDPSession(page);
async function drag(id, dx, dy) {
  const tb = await page.locator(`#tc [data-b=${id}]`).boundingBox(), sx = tb.x + tb.width / 2, sy = tb.y + tb.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
  for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + dx * i / 8, y: sy + dy * i / 8, id: 1 }] }); await page.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  const tb2 = await page.locator(`#tc [data-b=${id}]`).boundingBox();
  check(Math.abs(tb2.x - tb.x - dx) < 6 && Math.abs(tb2.y - tb.y - dy) < 6, `${id} butonu parmakla sürüklendi (${Math.round(tb2.x - tb.x)}, ${Math.round(tb2.y - tb.y)})`);
}
await drag('jump', -40, -50);                    // panelin dışındaki buton
await tapEl('[data-min]');                       // paneli küçült → üstteki butonlar açılır
await drag('third', -60, 80);
await tapEl('[data-min]');
await tapEl('[data-tab=sens]');
check(await page.evaluate(() => !!document.querySelector('[data-r=sens]')), 'Hassasiyet sekmesine dokunuldu');
await tapEl('[data-set=gyro][data-v=ads]');
check(await page.evaluate(() => window.__game.player.touch.cfg.gyro === 'ads'), 'Jiroskop "Nişandayken" seçildi');
await tapEl('[data-tab=layout]');
await tapEl('[data-set=joy][data-v=float]');
check(await page.evaluate(() => window.__game.player.touch.cfg.joy === 'float'), 'Joystick "Hareketli" seçildi');
const sl = await page.locator('[data-r=opacity]').boundingBox();
await page.touchscreen.tap(sl.x + sl.width * 0.2, sl.y + sl.height / 2); await page.waitForTimeout(200);
const op = await page.evaluate(() => window.__game.player.touch.cfg.opacity);
check(op < 0.6, `saydamlık kaydırıcısına dokunuldu (${op})`);
await tapEl('[data-act=save]');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('warbyte.touch') || 'null'));
check(saved && saved.joy === 'float' && saved.gyro === 'ads', 'Kaydet: ayarlar kaydedildi');
check(!(await page.evaluate(() => document.getElementById('tc').classList.contains('edit'))), 'panel kapandı');
// jiroskop yönü (kullanıcı geri bildirimi, yatay tutuş): aşağı eğme → aşağı bakış; sağa çevirme → sağa bakış
await tapEl('#bResume');
const gy = await page.evaluate(async () => {
  const g = window.__game, s = g.player.s, TC = g.player.touch; TC.cfg.gyro = 'on'; g.brainsOff = g.brains.splice(0);
  const send = async (rr) => { for (let i = 0; i < 10; i++) { dispatchEvent(new DeviceMotionEvent('devicemotion', { rotationRate: { alpha: 0, beta: 0, gamma: 0, ...rr }, interval: 16 })); await new Promise((r) => setTimeout(r, 16)); } };
  const ang = (screen.orientation && screen.orientation.angle) ?? 90, sg = ang === 270 ? -1 : 1;
  let y0 = s.yaw, p0 = s.pitch; await send({ beta: 60 * sg });              // eski kodda sola dönüş üreten hareket = aşağı eğme
  const down = { dyaw: s.yaw - y0, dpitch: s.pitch - p0 };
  y0 = s.yaw; p0 = s.pitch; await send({ gamma: 60 * sg });                 // eski kodda yukarı bakış üreten hareket = sağa çevirme
  const right = { dyaw: s.yaw - y0, dpitch: s.pitch - p0 };
  return { down, right };
});
check(gy.down.dpitch < -0.01 && Math.abs(gy.down.dyaw) < 1e-6, `jiroskop: aşağı eğme → aşağı bakış (pitch ${gy.down.dpitch.toFixed(3)}, yaw ${gy.down.dyaw.toFixed(3)})`);
check(gy.right.dyaw < -0.01 && Math.abs(gy.right.dpitch) < 1e-6, `jiroskop: sağa çevirme → sağa bakış (yaw ${gy.right.dyaw.toFixed(3)}, pitch ${gy.right.dpitch.toFixed(3)})`);
await page.screenshot({ path: 'screenshots/touchedit.png' });
await browser.close();
console.log(fail ? `sonuç: ${fail} HATA` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
