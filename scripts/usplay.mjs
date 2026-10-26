// Askeri Üs v3 tarayıcıda oynanış denetimi (12.170): oyuncu W ile gerçekten yürür (klavye), merdiven / rampa / duvar / kapı.
//   node scripts/usplay.mjs [url=http://127.0.0.1:5243] [çıktı=/tmp/wb-us/sonra]   → her adımda beklenen kot / engel + birinci şahıs kareleri
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5243', OUT = process.argv[3] || '/tmp/wb-us/sonra';
fs.mkdirSync(OUT, { recursive: true });
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
// ad, başlangıç [x, y, z], yön [dx, dz], süre sn, denetim (son konum → true/false), açıklama
const CASES = [
  ['komuta-A', [-8.85, 0.15, -6.25], [0, 1], 3.0, (p) => p.y > 3.3, 'Komuta zemin → 1. kat'],
  ['komuta-B', [-7.35, 3.4, -1.0], [0, -1], 3.0, (p) => p.y > 6.55, 'Komuta 1. → 2. kat'],
  ['komuta-C', [-8.85, 6.65, -6.25], [0, 1], 3.0, (p) => p.y > 9.8, 'Komuta 2. kat → çatı'],
  ['radar-A', [2.15, 0.66, 39.75], [0, 1], 3.0, (p) => p.y > 3.3, 'Radar zemin → 1. kat'],
  ['radar-B', [3.75, 3.4, 47.9], [0, -1], 3.0, (p) => p.y > 6.55, 'Radar 1. kat → çatı'],
  ['hangar-asma', [13.55, 0, -46.4], [0, -1], 3.0, (p) => p.y > 3.15, 'Hangar asma kat merdiveni'],
  ['tunel-cati', [-53.4, 0, -38.95], [1, 0], 3.0, (p) => p.ymax > 3.4, 'Tünel çatı merdiveni (yandan çatıya geçilir; düz devam edince merdiven ucundan iner)'],
  ['konteyner-yuva', [-51.2, 0, 46.5], [-1, 0], 3.0, (p) => p.y > 2.5, 'Konteyner nişancı yuvası merdiveni'],
  ['kamp-kapi', [-60, 0, 0], [1, 0], 3.0, (p) => p.x < -52.9 && p.x > -56, 'Kamp ana kapısından çıkış → T-duvara çarpar (tabanına çıkar, gövdesinden geçilmez)'],
  ['cadir', [-72.5, 0, -13], [-1, 0], 3.0, (p) => p.x > -79.0 && p.x < -75, 'Çadıra kapıdan girer, arka duvarda durur'],
  ['hangar-duvar', [0, 0, -40], [1, 0], 3.0, (p) => p.x < 14.8, 'Hangar yan duvarı (içeriden)'],
  ['cevre-duvar', [-40, 0, 58], [0, 1], 2.0, (p) => p.z < 59.8, 'Çevre duvarı'],
  ['kisla-kapi', [-24.0, 0, 12], [-1, 0], 3.0, (p) => p.x < -27.5, 'Kışla A doğu kapısından içeri'],
];
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`${base}/?autostart=3v3&map=us&type=tdm&debug=1&nolock=1&tod=day`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); for (const s of g.soldiers) if (!s.isPlayer) { s.pos.set(70, 0, 50); } });
let fail = 0;
for (const [name, p0, d, secs, check, desc] of CASES) {
  await page.evaluate(({ p0, yaw }) => { const g = window.__game, s = g.playerSoldier; s.alive = true; s.protT = 99; s.hp = s.maxHp; s.pos.set(...p0); s.vel.set(0, 0, 0); s.onGround = true; s.fallTop = p0[1]; s.yaw = yaw; s.pitch = -0.05; for (const e of g.soldiers) if (!e.isPlayer) e.pos.set(70, 0, 50); }, { p0, yaw: yawTo(d[0], d[1]) });
  await page.waitForTimeout(150);
  await page.evaluate(() => { const g = window.__game; window.__trk = []; window.__trkI = setInterval(() => { const q = g.playerSoldier.pos; window.__trk.push([+q.x.toFixed(2), +q.y.toFixed(2), +q.z.toFixed(2)]); }, 200); });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(secs * 1000); await page.keyboard.up('KeyW');
  await page.waitForTimeout(250);
  const p = await page.evaluate(() => { clearInterval(window.__trkI); const s = window.__game.playerSoldier, T = window.__trk; return { x: +s.pos.x.toFixed(2), y: +s.pos.y.toFixed(2), z: +s.pos.z.toFixed(2), ymax: Math.max(...T.map((q) => q[1])), trk: T }; });
  const ok = check(p); if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'HATA'}  ${desc}: ${JSON.stringify(p0)} → ${JSON.stringify({ x: p.x, y: p.y, z: p.z })} · en yüksek ${p.ymax}`); if (!ok || process.env.TRK) console.log('   iz', JSON.stringify(p.trk));
  if (['komuta-C', 'radar-B', 'hangar-asma', 'kamp-kapi', 'konteyner-yuva', 'kisla-kapi'].includes(name)) await page.screenshot({ path: `${OUT}/fp-${name}.png` });
}
const fps = await page.evaluate(async () => { const t0 = performance.now(); let n = 0; await new Promise((r) => { const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return +(n / 2).toFixed(1); });
console.log(`kare hızı ${fps} fps · sayfa hatası ${errs.length} ${errs.slice(0, 3).join(' | ')}`);
console.log(fail || errs.length ? 'sonuç: HATA' : 'sonuç: OK');
await browser.close();
process.exit(fail || errs.length ? 1 : 0);
