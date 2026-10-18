// Dokunmatik nişan yardımı ölçümü (Pixel 7 yatay, touch=1, botlar donuk): yana koşan hedef (5,6 m/sn)
//  A) M4, Geliştirici Atölyesi, 20 m, nişanda, başta 4° kaçık → son 1,5 sn ortalama açı hatası (°) + hedef üstünde kalma oranı
//  B) Paintball tüfeği, Boya Kulesi, 22 m, nişanda + tetik basılı 3 sn → isabet / atılan top
//   node scripts/aimassist.mjs [url=http://127.0.0.1:5180]      (sonuç satırı: A_err, A_on, B_hit)
import { chromium, devices } from 'playwright';
const BASE = process.argv[2] || 'http://127.0.0.1:5180';
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const browser = await chromium.launch({ headless: process.env.GPU !== '1', args: process.env.GPU === '1' ? ['--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fails = 0; const check = (ok, m) => { console.log(`${ok ? 'OK  ' : 'HATA'}  ${m}`); if (!ok) fails++; };
const out = {};

async function setup(url) {
  const page = await browser.newPage(strip(devices['Pixel 7 landscape']));
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__game?.playerSoldier && window.__game.player.touch, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  return { page, errs };
}
// ortak sahne: botlar donuk, oyuncu ölümsüz; tek düşman oyuncunun önünde d m'de, yana gidip gelir (genlik 4 m); diğer düşmanlar uzağa
const SCENE = (d, off) => {
  const g = window.__game, me = g.playerSoldier, p = g.player, T = p.touch;
  g.brainsOff = g.brains.slice(); g.brains.length = 0;
  me.protT = 1e9; p.locked = true; T.cfg.aim = true; T.cfg.aimStr = 1;
  const foes = g.soldiers.filter((s) => s !== me && s.team !== me.team && s.alive);
  const f = foes[0]; for (const o of foes.slice(1)) o.pos.set(o.pos.x + 400, o.pos.y - 200, o.pos.z + 400);
  for (const o of g.soldiers) if (o !== me && o.team === me.team) o.pos.set(o.pos.x + 400, o.pos.y - 200, o.pos.z + 400);
  // açık şerit ara (ızgara): oyuncu (x, z), hedef z − d hattında −4…+4 m gidip gelir; hepsi gözden görünür, düz, yürünebilir → oyuncu oraya ışınlanır, kuzeye (−Z) bakar
  let fx = 0, fz = 1, cx = 0, cz = 0, ok = false;
  const b = g.map.bounds, tmp = me.pos.clone(), eye = me.pos.clone();
  for (let x = b.minX + 8; x < b.maxX - 8 && !ok; x += 3) for (let z = b.maxZ - 8; z > b.minZ + d + 8 && !ok; z -= 3) {
    const y = g.world.heightAt(x, z); if (!g.nav.isFree(x, z)) continue;
    eye.set(x, y + 1.6, z); ok = true;
    for (const u of [-4, -2, 0, 2, 4]) {
      const tx = x + u, tz = z - d, ty = g.world.heightAt(tx, tz);
      if (Math.abs(ty - y) > 0.2 || !g.nav.isFree(tx, tz) || !g.botSees(eye, tmp.set(tx, ty + 1.1, tz))) { ok = false; break; }
    }
    if (ok) { me.pos.set(x, y, z); me.vel.set(0, 0, 0); cx = x; cz = z - d; fx = 0; fz = 1; }
  }
  window.__sceneOk = ok;
  f.maxHp = f.hp = 99999; f.protT = 0;
  const t0 = performance.now(), V = window.__V ?? 5.6, A = 4;
  window.__mv = () => {                                                                // yana gidip gelme (üçgen dalga), hızı vel'e yazılır
    const t = (performance.now() - t0) / 1000, ph = (t * V) % (4 * A), u = ph < 2 * A ? ph - A : 3 * A - ph, dir = ph < 2 * A ? 1 : -1;
    f.pos.set(cx + fz * u, me.pos.y, cz - fx * u); f.vel.set(fz * V * dir, 0, -fx * V * dir); f.alive = true;
  };
  window.__mv();
  const e = me.eye(), c = f.center(e.clone());
  me.yaw = Math.atan2(-(c.x - e.x), -(c.z - e.z)) + off; me.pitch = Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z));
  window.__f = f;
};
const ERR = () => { const g = window.__game, me = g.playerSoldier, f = window.__f, e = me.eye(), c = f.center(e.clone());
  let dy = Math.atan2(-(c.x - e.x), -(c.z - e.z)) - me.yaw; dy -= Math.round(dy / (2 * Math.PI)) * 2 * Math.PI;
  const dp = Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z)) - me.pitch, d = Math.hypot(c.x - e.x, c.z - e.z);
  return { a: Math.hypot(dy, dp), on: Math.abs(dy) * d < 0.35 && Math.abs(dp) * d < 0.6 }; };

// A) M4
{
  const { page, errs } = await setup(`${BASE}/?autostart=4v4&map=dev&type=tdm&debug=1&nolock=1&touch=1`);
  const r = await page.evaluate(async ([SC, ER]) => {
    const SCENE = eval(SC), ERR = eval(ER); SCENE(20, 0.07); if (!window.__sceneOk) return null;
    const me = window.__game.playerSoldier; me.ads = true;
    const errs = [], ons = [], t0 = performance.now();
    await new Promise((res) => { const tick = () => { window.__mv(); const t = performance.now() - t0; if (t > 500) { const e = ERR(); errs.push(e.a); ons.push(e.on); } if (t < 2000) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    me.ads = false;
    return { err: errs.reduce((a, b) => a + b, 0) / errs.length * 57.3, on: ons.filter(Boolean).length / ons.length, n: errs.length };
  }, [SCENE.toString(), ERR.toString()]);
  check(!!r, 'A açık sahne bulundu'); if (!r) process.exit(1);
  out.A_err = r.err.toFixed(2); out.A_on = Math.round(r.on * 100);
  console.log(`A) M4 20 m yana koşan hedef: ortalama hata ${r.err.toFixed(2)}° · hedef üstünde %${Math.round(r.on * 100)} (${r.n} kare)`);
  check(!errs.length, `A sayfa hatası yok ${errs[0] || ''}`);
  await page.close();
}
// B) paintball
{
  const { page, errs } = await setup(`${BASE}/?autostart=5v5&map=boyakulesi&type=pb&debug=1&nolock=1&touch=1`);
  const r = await page.evaluate(async ([SC]) => {
    const SCENE = eval(SC); SCENE(22, 0.05); if (!window.__sceneOk) return null;
    const g = window.__game, me = g.playerSoldier, p = g.player, f = window.__f;
    me.ads = true; await new Promise((res) => setTimeout(res, 400));
    const hp0 = f.hp, it = me.item; it.reserve = 999; p.fireHeld = true; let shots = 0, lastMag = it.mag;
    await new Promise((res) => { const t0 = performance.now(); const tick = () => { window.__mv(); const m = me.item.mag; if (m < lastMag) shots += lastMag - m; if (m <= 2) me.item.mag = 50; lastMag = me.item.mag; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    p.fireHeld = false; me.ads = false;
    await new Promise((res) => setTimeout(res, 800));
    const dmg = hp0 - f.hp;
    return { hits: Math.round(dmg / 18), shots, dmg };
  }, [SCENE.toString()]);
  check(!!r, 'B açık sahne bulundu'); if (!r) process.exit(1);
  out.B_hit = `${r.hits}/${r.shots}`;
  console.log(`B) Paintball 22 m yana koşan hedef: isabet ${r.hits} / ${r.shots} top (hasar ${r.dmg})`);
  check(r.shots > 5, 'B ateş edildi');
  check(!errs.length, `B sayfa hatası yok ${errs[0] || ''}`);
  await page.close();
}
await browser.close();
console.log('ölçüm:', JSON.stringify(out));
console.log(fails ? `sonuç: HATA (${fails})` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
