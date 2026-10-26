// Düşme hasarı testi (12.143). Önce: vite (BASE, varsayılan :5180) + BF_DEBUG=1 sunucu (SERVER, varsayılan ws://127.0.0.1:8787).
//   node scripts/falldmg.mjs            → 0) mod kuralları (tarayıcısız)  1) çevrimdışı yükseklik → hasar tablosu + ölüm akışı
//                                          2) haritalarda gerçek kenarlardan yürüyerek / zıplayarak inme  3) çevrim içi: sunucu = istemci, çift hasar yok
// Ekran görüntüleri: screenshots/falldmg-*.png
import { chromium } from 'playwright';
import { Game } from '../src/game/game.js';
import { fallDamage, FALL } from '../src/sim/fall.js';

const BASE = process.env.BASE || 'http://127.0.0.1:5180', SERVER = process.env.SERVER || 'ws://127.0.0.1:8787';
const ONLY = (process.env.ONLY || '0123').split('');
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK    ' : 'HATA  ') + m); if (!c) fail++; };

// ── 0) mod kuralları: tarayıcısız Game, bot gövdesiyle bırakma ──
function headlessDrop(map, type, prep, h, dt = 1 / 60) {
  const g = new Game(null, { headless: true, map, bots: true, diff: 'normal', match: { perTeam: type === 'inf' || type === 'pb' ? 4 : 2, type } });
  g.brains.length = 0;
  for (let i = 0; i < 20; i++) g.step(dt);
  const s = g.soldiers.find((e) => e.alive);
  s.protT = 0; s.maxHp = s.hp = 1000;
  const x = s.pos.x, z = s.pos.z, gy = g.world.heightAt(x, z);
  s.pos.set(x, gy + h, z); s.vel.set(0, 0, 0); s.onGround = false; s.fallTop = gy + h;
  prep?.(g, s);
  for (let i = 0; i < 600 && !s.onGround; i++) g.step(dt);
  const r = { dmg: 1000 - s.hp, landH: s.landH };
  g.dispose?.();
  return r;
}
if (ONLY.includes('0')) {
  console.log('── 0) mod kuralları (tarayıcısız)');
  let r = headlessDrop('depo', 'tdm', null, 11); ok(r.dmg === fallDamage(11), `TDM bot 11 m → ${r.dmg} (beklenen ${fallDamage(11)})`);
  r = headlessDrop('depo', 'tdm', null, 11, 1 / 20); ok(r.dmg === fallDamage(11), `20 FPS adımla 11 m → ${r.dmg} (kare süresinden bağımsız)`);
  r = headlessDrop('boyakulesi', 'pb', null, 14); ok(r.dmg === 0, `Paintball 14 m → ${r.dmg} (düşme hasarı yok)`);
  r = headlessDrop('newyork', 'inf', (g, s) => { g.makeZombie(s, false, 'walker'); s.maxHp = s.hp = 1000; s.protT = 0; }, 14); ok(r.dmg === 0, `Enfekte zombi 14 m → ${r.dmg} (zombi almaz)`);
  r = headlessDrop('newyork', 'inf', (g, s) => { if (s.def.zombie) s.setClass('assault'); s.maxHp = s.hp = 1000; }, 11); ok(r.dmg === fallDamage(11), `Enfekte insan 11 m → ${r.dmg}`);
  r = headlessDrop('depo', 'tdm', (g, s) => { s.protT = 2; }, 11); ok(r.dmg === 0, `doğuş koruması (protT) varken 11 m → ${r.dmg}`);
  r = headlessDrop('depo', 'tdm', (g, s) => { s.fly = true; g.step(1 / 60); s.fly = false; }, 14); ok(r.dmg === 0, `uçuş modundan (L) çıkıp 14 m → ${r.dmg}`);
  r = headlessDrop('depo', 'tdm', (g, s) => { s.fallSafe = true; }, 14); ok(r.dmg === 0, `zıplama minderi uçuşu (fallSafe) 14 m → ${r.dmg}`);
  {                                                                               // derin su (Vadi nehri): hasarsız
    const g = new Game(null, { headless: true, map: 'vadi', bots: true, match: { perTeam: 2, type: 'tdm' } });
    g.brains.length = 0; g.step(1 / 60);
    const T = g.terrain, b = g.map.bounds; let w = null;
    for (let x = b.minX; x < b.maxX && !w; x += 1) for (let z = b.minZ; z < b.maxZ && !w; z += 1) if (T.heightAt(x, z) < -0.6) w = [x, z];
    const s = g.soldiers[0]; s.protT = 0; s.maxHp = s.hp = 1000;
    s.pos.set(w[0], 10, w[1]); s.vel.set(0, 0, 0); s.onGround = false; s.fallTop = 10;
    for (let i = 0; i < 600 && !s.onGround; i++) g.step(1 / 60);
    ok(1000 - s.hp === 0, `derin suya (${w.map((v) => v.toFixed(0))}) ${(10 - T.heightAt(w[0], w[1])).toFixed(1)} m → ${1000 - s.hp}`);
  }
  {                                                                               // düz zeminde zıplama: hasarsız, iniş ~1 m
    const g = new Game(null, { headless: true, map: 'depo', bots: true, match: { perTeam: 2, type: 'tdm' } });
    g.brains.length = 0; for (let i = 0; i < 20; i++) g.step(1 / 60);
    const s = g.soldiers[0]; s.protT = 0; const hp = s.hp; let mx = 0;
    s.vel.y = 5.4; s.onGround = false;
    for (let i = 0; i < 120; i++) { g.step(1 / 60); mx = Math.max(mx, s.landH || 0); }
    ok(s.hp === hp && mx > 0.8 && mx < 1.1, `düz zeminde zıplama: iniş ${mx.toFixed(2)} m, can ${hp} → ${s.hp}`);
  }
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
async function openPage(url) {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 }, locale: 'tr-TR' });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + url);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  return page;
}
// sayfada: oyuncuyu y yüksekliğinde bırak (dikey hız 0), inene dek bekle; { dmg, landH, hp, alive }
const DROP = `async (h) => {
  const g = window.__game, s = g.playerSoldier;
  s.protT = 0; s.maxHp = s.hp = 1000;
  const W = g.world, open = (x, z) => !W.query(x - 0.6, z - 0.6, x + 0.6, z + 0.6, []).some((c) => x + 0.6 > c.min[0] && x - 0.6 < c.max[0] && z + 0.6 > c.min[2] && z - 0.6 < c.max[2] && c.max[1] > W.heightAt(x, z) + 0.05);
  if (!open(s.pos.x, s.pos.z)) {                                                     // üstünde kutu / çatı olmayan açık zemin (en yakın)
    let best = null;
    for (let r = 1; r < 40 && !best; r++) for (let a = 0; a < 16 && !best; a++) { const x = s.pos.x + Math.cos(a / 16 * 6.283) * r, z = s.pos.z + Math.sin(a / 16 * 6.283) * r; if (open(x, z)) best = [x, z]; }
    s.pos.x = best[0]; s.pos.z = best[1];
  }
  const gy = g.world.heightAt(s.pos.x, s.pos.z);
  let landH = 0; const fc = g.fallCheck.bind(g);
  g.fallCheck = (e) => { if (e === s && e.landH > 0) landH = e.landH; return fc(e); };
  s.pos.y = gy + h; s.vel.set(0, 0, 0); s.onGround = false; s.fallTop = gy + h;
  for (let i = 0; i < 1500 && !s.onGround; i++) await new Promise((r) => setTimeout(r, 20));          // yavaş (yazılım GPU) karede de inişi bekle
  await new Promise((r) => setTimeout(r, 60));
  g.fallCheck = fc;
  return { dmg: 1000 - s.hp, landH, alive: s.alive };
}`;

// ── 1) çevrimdışı: yükseklik → hasar tablosu (oyuncu, gerçek kare döngüsü) + ölüm akışı ──
if (ONLY.includes('1')) {
  console.log('── 1) çevrimdışı yükseklik → hasar (Depo, TDM, botlar donuk)');
  const page = await openPage('/?autostart=2v2&map=depo&type=tdm&time=900&debug=1&nolock=1&pr=0.6&shadows=0');
  await page.evaluate(() => { window.__game.brains.length = 0; });
  const rows = [];
  for (const h of [1, 3, 5, 6, 6.5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18]) {
    const r = await page.evaluate(`(${DROP})(${h})`);
    rows.push({ h, beklenen: fallDamage(h), olcum: r.dmg, inis: +r.landH.toFixed(2) });
    if (h === 10) await page.screenshot({ path: 'screenshots/falldmg-1-inis10m.png' });
    await page.waitForTimeout(150);
  }
  console.table(rows);
  ok(rows.every((r) => r.olcum === r.beklenen), 'ölçülen hasar = tablo (her yükseklikte)');
  ok(rows.filter((r) => r.h <= FALL.safe).every((r) => r.olcum === 0), `≤ ${FALL.safe} m hasarsız`);
  // ölüm: 100 can, 14,5 m → "Düşerek öldü", puan kimseye
  const res = await page.evaluate(async () => {
    const g = window.__game, s = g.playerSoldier, k0 = g.soldiers.map((e) => e.kills).reduce((a, b) => a + b, 0), d0 = s.deaths;
    s.protT = 0; s.maxHp = 100; s.hp = 100;
    const gy = g.world.heightAt(s.pos.x, s.pos.z);
    s.pos.y = gy + 14.5; s.vel.set(0, 0, 0); s.onGround = false; s.fallTop = gy + 14.5;
    for (let i = 0; i < 1500 && s.alive; i++) await new Promise((r) => setTimeout(r, 20));
    await new Promise((r) => setTimeout(r, 300));
    const kf = [...document.querySelectorAll('#killfeed .kf')].map((e) => e.textContent).pop() || '';
    return { alive: s.alive, kills: g.soldiers.map((e) => e.kills).reduce((a, b) => a + b, 0) - k0, deaths: s.deaths - d0, kf, icon: !!document.querySelector('#killfeed .kf .fli'), card: document.querySelector('#rksub')?.textContent || '' };
  });
  ok(!res.alive && res.deaths === 1 && res.kills === 0, `14,5 m (100 can) → öldü, ölüm +${res.deaths}, öldürme +${res.kills}`);
  ok(/Düşerek öldü|Fell to death/i.test(res.kf) && res.icon, `öldürme akışı: "${res.kf}" (ikon ${res.icon})`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'screenshots/falldmg-2-olum.png' });
  await page.close();
}

// ── 2) haritalarda gerçek kenarlar: kenar üstüne koy, kenara doğru yürü (W) / koşup zıpla (Shift+W+Space) ──
// Kenarlar scripts/fallmaps.mjs ile ölçüldü (ulaşılabilen en yüksek inişler)
const EDGES = {
  colgecidi: [['Suicide (T Spawn → Mid)', [-2.75, 7.4, 52.25], [-2.75, 51.25]], ['Short Stairs / Boost', [22.75, 5.55, -43.25], [24.25, -43.25]], ['Titanic duvarı', [-45.75, 7.96, 36.75], [-45.75, 35.75]], ['Pit', [57.75, 4.6, 9.25], [57.75, 9.25]]],
  kasaba: [['Su kulesi', [-26.25, 8, -42.25], [-26.25, -41.75]], ['Kilise', [-39.25, 7.9, 11.25], [-39.75, 11.25]]],
  us: [['Komuta Binası çatısı', [-8.25, 10.85, 6.85], [-8.25, 7.6]], ['Radar çatısı', [-3.5, 7.65, 48.85], [-3.5, 49.6]]],      // 12.170 v3: kontrol kulesi çatısı artık kapalı
};
if (ONLY.includes('2')) {
  console.log('── 2) haritalarda kenardan inme (yürüyerek / koşup zıplayarak)');
  for (const [map, list] of Object.entries(EDGES)) {
    const page = await openPage(`/?autostart=2v2&map=${map}&type=tdm&time=900&debug=1&nolock=1&pr=0.6&shadows=0`);
    await page.evaluate(() => { window.__game.brains.length = 0; });
    let shot = 0;
    for (const [name, from, to] of list) for (const jump of [false, true]) {
      const r = await page.evaluate(async ({ from, to, jump }) => {
        const g = window.__game, s = g.playerSoldier, W = g.world;
        // kenar üstü yüksekliği: verilen y (0 ise sütundaki en yüksek basılabilir kutu); yön: verilen iniş noktası ya da en yakın düşüş yönü
        let y = from[1];
        const tops = W.query(from[0] - 0.1, from[2] - 0.1, from[0] + 0.1, from[2] + 0.1, []).filter((c) => from[0] > c.min[0] && from[0] < c.max[0] && from[2] > c.min[2] && from[2] < c.max[2]).map((c) => c.max[1]);
        if (!y) y = Math.max(...tops);
        let dir = to ? Math.atan2(-(to[0] - from[0]), -(to[1] - from[2])) : null;
        if (dir === null) {                                                         // en yakın kenar: 4 yönde ilk boşluk
          let best = 1e9;
          for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
            for (let d = 0.5; d < 12; d += 0.25) {
              const x = from[0] - Math.sin(a) * d, z = from[2] - Math.cos(a) * d;
              const hi = W.query(x - 0.05, z - 0.05, x + 0.05, z + 0.05, []).some((c) => x > c.min[0] && x < c.max[0] && z > c.min[2] && z < c.max[2] && c.max[1] >= y - 0.05);
              if (!hi) { if (d < best) { best = d; dir = a; } break; }
            }
          }
        }
        s.protT = 0; s.maxHp = s.hp = 1000;
        s.pos.set(from[0], y + 0.02, from[2]); s.vel.set(0, 0, 0); s.onGround = true; s.fallTop = y; s.yaw = dir; s.pitch = -0.3;
        if (jump) { s.vel.set(-Math.sin(dir) * 8.4, 5.4, -Math.cos(dir) * 8.4); s.onGround = false; }      // kenarda koşu hızında (5,6 × 1,5) zıplama
        window.__lh = 0; const fc = window.__fc0 ||= g.fallCheck.bind(g);
        g.fallCheck = (e) => { if (e === s && e.landH > window.__lh) window.__lh = e.landH; return fc(e); };
        return { y, dir };
      }, { from, to, jump });
      await page.keyboard.down('KeyW'); if (jump) await page.keyboard.down('ShiftLeft');
      await page.waitForFunction((y) => window.__game.playerSoldier.pos.y < y - 0.6, r.y, { timeout: 30000 }).catch(() => {});      // kenardan çıktı
      await page.keyboard.up('KeyW'); if (jump) await page.keyboard.up('ShiftLeft');
      await page.waitForFunction('window.__game.playerSoldier.onGround', null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(300);
      const o = await page.evaluate(() => { const g = window.__game, s = g.playerSoldier; g.fallCheck = window.__fc0; return { dmg: 1000 - s.hp, y: s.pos.y, lh: window.__lh }; });
      // kenar − son konum = inilen kat farkı; ölçülen düşüş (zirve − iniş, zıplama dahil) ve hasar tabloyla aynı olmalı
      const drop = r.y - o.y;
      const good = o.dmg === fallDamage(o.lh) && o.lh >= drop - 0.05 && o.lh <= drop + (jump ? 1.05 : 0.05) && drop > 0.5;
      ok(good, `${map} · ${name} · ${jump ? 'koşup zıplayarak' : 'yürüyerek'}: kat farkı ${drop.toFixed(2)} m, düşüş ${o.lh.toFixed(2)} m → −${o.dmg} can (tablo ${fallDamage(o.lh)})`);
      if (!shot++ && map === 'us') await page.screenshot({ path: 'screenshots/falldmg-3-us-cati.png' });
      await page.waitForTimeout(200);
    }
    await page.close();
  }
}

// ── 3) çevrim içi: sunucu ile istemci aynı hasar, çift düşme yok, ölüm akışı ──
if (ONLY.includes('3')) {
  console.log('── 3) çevrim içi (yerel BF_DEBUG sunucusu)');
  const page = await openPage(`/?online=new&type=tdm&map=depo&per=2&bots=0&time=900&debug=1&nolock=1&pr=0.6&shadows=0&server=${encodeURIComponent(SERVER)}&name=Dusme`);
  await page.waitForTimeout(3000);                                                 // doğuş koruması biter
  await page.evaluate(() => {
    const g = window.__game, s = g.playerSoldier;
    window.__fl = { pred: [], ev: [], minHp: 1e9 };
    const fp = g.fallPredict.bind(g); g.fallPredict = (me) => { const q0 = g.online.fallPred; fp(me); if (g.online.fallPred && g.online.fallPred !== q0) window.__fl.pred.push(g.online.fallPred.dmg); };
    const fr = g.fallReplay.bind(g); g.fallReplay = (me, q) => { const q0 = g.online.fallPred; fr(me, q); const p = g.online.fallPred; if (p && (!q0 || q0.q !== p.q)) window.__fl.pred.push(p.dmg); };     // uzlaştırmada yeniden oynatılan iniş
    const on = g.onNetEvents.bind(g); g.onNetEvents = (l) => { for (const e of l) if (e.e === 'fall') window.__fl.ev.push(e); return on(l); };
    const tick = () => { window.__fl.minHp = Math.min(window.__fl.minHp, s.hp); requestAnimationFrame(tick); }; tick();
  });
  for (const h of [5, 8, 11, 13]) {
    const r = await page.evaluate(async (h) => {
      const g = window.__game, s = g.playerSoldier, n = g.online, F = window.__fl;
      n.send({ t: 'dbg', hp: 100 });
      await new Promise((r) => setTimeout(r, 500));
      const x = s.pos.x, z = s.pos.z, gy = g.world.heightAt(x, z);
      F.pred.length = 0; F.ev.length = 0; F.minHp = 1e9;
      n.send({ t: 'dbg', tpy: [x, gy + h, z] });
      for (let i = 0; i < 40 && s.pos.y - gy < h * 0.5; i++) await new Promise((r) => setTimeout(r, 50));     // sunucu ışınladı
      for (let i = 0; i < 600 && !s.onGround; i++) await new Promise((r) => setTimeout(r, 20));
      await new Promise((r) => setTimeout(r, 1500));                                   // sunucu onayı (ack) + olay
      return { hp: s.hp, pred: F.pred.slice(), ev: F.ev.map((e) => e.d), evH: F.ev.map((e) => e.h), minHp: F.minHp, alive: s.alive, y: s.pos.y - gy };
    }, h);
    const exp = fallDamage(h);
    ok(r.hp === 100 - exp && (exp ? r.ev.length === 1 && r.ev[0] === exp : r.ev.length === 0), `${h} m: sunucu canı ${r.hp} (beklenen ${100 - exp}), sunucu olayı ${JSON.stringify(r.ev)} @ ${JSON.stringify(r.evH)} m`);
    // tahmin: tek iniş, sunucuyla aynı (ışınlama sonrası zirve sunucu durumundan kestirildiği için ±2 can tolerans); gösterilen can hiç sunucunun son canının 2 altına inmez
    ok((exp ? r.pred.length === 1 && Math.abs(r.pred[0] - exp) <= 2 : r.pred.length === 0) && r.minHp >= 100 - exp - 2, `${h} m: istemci tahmini ${JSON.stringify(r.pred)}, gösterilen en düşük can ${r.minHp} (çift düşme yok)`);
  }
  await page.screenshot({ path: 'screenshots/falldmg-4-online.png' });
  const d = await page.evaluate(async () => {
    const g = window.__game, s = g.playerSoldier, n = g.online, d0 = s.deaths;
    n.send({ t: 'dbg', hp: 100 }); await new Promise((r) => setTimeout(r, 500));
    const x = s.pos.x, z = s.pos.z, gy = g.world.heightAt(x, z);
    n.send({ t: 'dbg', tpy: [x, gy + 15, z] });
    for (let i = 0; i < 400 && s.alive; i++) await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 500));
    return { alive: s.alive, deaths: s.deaths - d0, kf: [...document.querySelectorAll('#killfeed .kf')].map((e) => e.textContent).pop() || '' };
  });
  ok(!d.alive && /Düşerek öldü|Fell to death/i.test(d.kf), `15 m çevrim içi: öldü (${d.alive ? 'canlı' : 'ölü'}), akış "${d.kf}"`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'screenshots/falldmg-5-online-olum.png' });
  await page.close();
}

console.log('sayfa hatası:', errs.length, errs.slice(0, 3));
await browser.close();
console.log(fail || errs.length ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail || errs.length ? 1 : 0);
