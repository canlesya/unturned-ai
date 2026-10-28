// 12.221 ses eşzamanı denetimi: kayıt sırasında bilinen karelerde (60, 150, 240) kameranın dibinde patlama sesi çalınır; ses.wav'da sesin
// başladığı an ölçülür → kare zamanıyla farkı (ms). Ayrıca ses dosyası süresi = kare / 60 mı.   node scripts/cinesync.mjs
import { openCine, grab } from './cinelib.mjs';
import fs from 'fs';
const OUT = '/tmp/wb-cine2/sync';
const { browser, page } = await openCine({ per: 8, tod: 'day', seed: 3, audio: 40 });
await page.evaluate(() => { const g = window.__game; g.sfx.setVolume(0.9); for (const s of g.soldiers) if (s.brain) s.brain.update = () => {}; g.brains.length = 0; g.cine.cut({ p: { x: 0, z: 0 }, type: 'still', r: 40, h: 20, dur: 99 }); });
await page.evaluate(async () => { const A = window.__aud; await A.adv(1); window.__ov = []; });
const a0 = await page.evaluate(() => window.__aud.cur());
const hook = `(g) => { const n = (window.__ov || []).length; if (n === 60 || n === 150 || n === 240) g.sfx.explosion(g.camera.position.clone(), true); }`;
await grab(page, OUT, 0, 300, { onFrame: hook });
const a1 = await page.evaluate(() => window.__aud.cur());
await page.evaluate(async () => window.__aud.finish());
const b64 = await page.evaluate(({ a, b }) => window.__aud.wav(a, b), { a: a0, b: a1 });
fs.writeFileSync(`${OUT}/ses.wav`, Buffer.from(b64, 'base64'));
console.log('ses süresi', (a1 - a0).toFixed(4), 'sn · kare süresi', (300 / 60).toFixed(4), 'sn');
await browser.close();
