// 12.202 Manga + büyük harita (M) + işaret + çatışma yoğunluğu + ölüm doğuş seçici (çevrimdışı, gerçek tarayıcı).
//   node scripts/squadmap.mjs [istemci url]   → /tmp/wb-squad/*.png
// Kuzey Vadisi fetih, Çöl Geçidi ele geçirme + TDM (masaüstü) ve Kuzey Vadisi Pixel 7 yatay (touch=1). Silah oyunu / Enfekte'de manga + seçici kapalı.
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5284', OUT = '/tmp/wb-squad';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
let fails = 0; const check = (ok, m) => { console.log(`${ok ? 'OK  ' : 'HATA'}  ${m}`); if (!ok) fails++; };

async function open(q, mob = false) {
  const ctx = mob ? await browser.newContext(strip(devices['Pixel 7 landscape'])) : await browser.newContext({ viewport: { width: 1440, height: 810 } });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}/?${q}&debug=1&nolock=1${mob ? '&touch=1' : ''}`);
  await page.waitForFunction(() => window.__game?.running && window.__game.time > 1.5, null, { timeout: 150000 });
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}
const kill = (page) => page.evaluate(() => { const g = window.__game, p = g.playerSoldier; p.protT = 0; g.devGod = false; p.takeDamage(999, g.soldiers.find((s) => s.team !== p.team), 'body', p.pos, 'AK-47'); });
// büyük harita / doğuş seçicideki bir dünya noktasının ekran (CSS px) konumu
const scr = (page, x, z) => page.evaluate(([x, z]) => { const b = window.__game.bigMap, r = b.cv.getBoundingClientRect(); return [r.left + b.X(x) / b.dpr, r.top + b.Y(z) / b.dpr]; }, [x, z]);
// manga arkadaşlarını üsse yakın, düşmansız, sakin bir yere koy (çatışma / düşman kuralı uygun olsun) + botları dondur
const calmMates = (page) => page.evaluate(() => {
  const g = window.__game, me = g.playerSoldier;
  g.brainsOff = g.brains.splice(0);
  const mates = g.soldiers.filter((s) => s !== me && s.team === me.team && s.squad === me.squad && !s.vacant);
  for (const m of mates) if (m.veh) { g.vehicles.exit(m); m.vel.set(0, 0, 0); }      // Kuzey Vadisi: botlar jipe biner (araçtaki arkadaşa doğuş yok)
  const sp = g.map.spawns[me.team][0];
  for (const s of g.soldiers) if (s.team !== me.team && s.alive) { const d = Math.hypot(s.pos.x - sp.x, s.pos.z - sp.z); if (d < 90) { const e = g.map.spawns[s.team][0]; s.pos.set(e.x, g.world.groundAt(e.x, e.z), e.z); } }
  return mates.map((m) => ({ id: m.id, alive: m.alive, x: m.pos.x, z: m.pos.z }));
});

async function desk(tag, q, conq) {
  const { ctx, page, errs } = await open(q);
  const info = await page.evaluate(() => {
    const g = window.__game, me = g.playerSoldier;
    const sq = {};
    for (const s of g.soldiers) if (!s.vacant) { const k = s.team + s.squad; sq[k] = (sq[k] || 0) + 1; }
    return { sq, me: me.squad, team: me.team, panel: document.querySelector('#sqp')?.offsetHeight || 0, rows: document.querySelectorAll('#sqp .r').length, keys: g.binds.codes('map'), ping: g.binds.codes('ping') };
  });
  console.log(tag, JSON.stringify(info));
  check(Object.values(info.sq).every((n) => n <= 4) && Object.values(info.sq).some((n) => n === 4), `${tag}: mangalar en çok 4 kişilik (${JSON.stringify(info.sq)})`);
  check(info.panel > 40 && info.rows === 4, `${tag}: HUD manga listesi (${info.rows} satır)`);
  // botlar biraz dolaşsın → yeşil işaretler / ısı
  await page.waitForTimeout(conq ? 14000 : 9000);
  await page.screenshot({ path: `${OUT}/${tag}-hud.png` });
  const marks = await page.evaluate(() => [...document.querySelectorAll('#sqmk .m')].filter((e) => e.style.display === 'flex').length);
  console.log(`      ekrandaki yeşil manga işareti: ${marks}`);
  // M → büyük harita
  await page.keyboard.press('KeyM'); await page.waitForTimeout(500);
  let st = await page.evaluate(() => { const g = window.__game; return { open: g.bigMap.open, mode: g.bigMap.mode, heat: g.heat.list(g.time).length, flags: g.mode.objectives.length }; });
  check(st.open && st.mode === 'map', `${tag}: M büyük haritayı açtı (ısı kaydı ${st.heat}, bayrak ${st.flags})`);
  if (!st.heat) await page.evaluate(() => { const g = window.__game, o = g.mode.objectives[0] || g.map.spawns.red[0]; for (let i = 0; i < 12; i++) g.heat.add(o.x + Math.random() * 20 - 10, o.z + Math.random() * 20 - 10, 2, g.time); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${tag}-harita.png` });
  // haritaya tıkla → işaret
  const tgt = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier, a = me.yaw; return { x: me.pos.x - Math.sin(a) * 30, z: me.pos.z - Math.cos(a) * 30 }; });
  const [cx, cy] = await scr(page, tgt.x, tgt.z);
  await page.mouse.click(cx, cy); await page.waitForTimeout(400);
  st = await page.evaluate(() => { const g = window.__game, p = g.pings.items.get(g.playerSoldier.id); return p ? { k: p.k, x: p.x, z: p.z, obj: !!p.obj } : null; });
  check(st && st.k === 'loc' && Math.hypot(st.x - tgt.x, st.z - tgt.z) < 2 && st.obj, `${tag}: haritaya tıklama işaret koydu (${st && st.x.toFixed(1)}, ${st && st.z.toFixed(1)}; 3B ışık)`);
  await page.screenshot({ path: `${OUT}/${tag}-harita-isaret.png` });
  await page.keyboard.press('KeyM'); await page.waitForTimeout(400);
  check(!(await page.evaluate(() => window.__game.bigMap.open)), `${tag}: M tekrar → harita kapandı`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${tag}-isaret-3b.png` });
  const onScr = await page.evaluate(() => { const p = window.__game.pings.items.get(window.__game.playerSoldier.id); return p?.el && !p.el.classList.contains('edge'); });
  check(onScr, `${tag}: işaret ekranda (elmas + uzaklık, 3B ışık)`);
  // orta tık → bakılan yere işaret
  await page.waitForTimeout(600);
  await page.evaluate(() => { const p = window.__game.playerSoldier; p.pitch = -0.25; });
  await page.waitForTimeout(100);
  await page.mouse.click(720, 405, { button: 'middle' }); await page.waitForTimeout(400);
  const mid = await page.evaluate(() => { const g = window.__game, p = g.pings.items.get(g.playerSoldier.id); return p ? Math.hypot(p.x - g.playerSoldier.pos.x, p.z - g.playerSoldier.pos.z) : -1; });
  check(mid > 1 && mid < 120, `${tag}: orta tık bakılan yere işaret koydu (${mid.toFixed(1)} m ileride)`);
  await page.screenshot({ path: `${OUT}/${tag}-orta-tik.png` });
  // ölüm → doğuş seçici
  const mates = await calmMates(page);
  await kill(page); await page.waitForTimeout(1200);
  st = await page.evaluate(() => { const g = window.__game; return { mode: g.bigMap.mode, dmap: g.hud.$('respawn').classList.contains('dmap'), tg: g.bigMap.targets().map((t) => `${t.kind}:${t.id}:${t.ok ? 1 : 0}`) }; });
  check(st.mode === 'deploy' && st.dmap, `${tag}: ölünce doğuş seçici harita açıldı`);
  console.log('      hedefler:', st.tg.join(' '));
  check(st.tg.some((t) => t.startsWith('base:')) && st.tg.filter((t) => t.startsWith('mate:')).length >= 1, `${tag}: üs + manga arkadaşı hedefleri var`);
  if (conq) check(st.tg.some((t) => t.startsWith('flag:')), `${tag}: bayrak hedefleri var`);
  await page.screenshot({ path: `${OUT}/${tag}-olum-dogus.png` });
  // manga arkadaşına tıkla → Doğ
  const mate = await page.evaluate(() => { const g = window.__game; const t = g.bigMap.targets().find((t) => t.kind === 'mate' && t.ok); return t ? { id: t.id, x: t.x, z: t.z, mid: t.mate.id } : null; });
  check(!!mate, `${tag}: uygun manga arkadaşı var (${mate?.id})`);
  if (mate) {
    const [mx, my] = await scr(page, mate.x, mate.z);
    await page.mouse.click(mx, my); await page.waitForTimeout(300);
    check(await page.evaluate((id) => window.__game.spawnChoice === id, mate.id), `${tag}: tıklama arkadaşı seçti`);
    await page.screenshot({ path: `${OUT}/${tag}-arkadas-secili.png` });
    // süre bitmeden Doğ'a bas → hazır bekler; süre bitince doğar
    await page.click('#respawn .dgo');
    await page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(300);
    const r = await page.evaluate((mid) => { const g = window.__game, p = g.playerSoldier, m = g.soldiers[mid]; return { alive: p.alive, d: Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z), dy: p.pos.y - m.pos.y, open: g.bigMap.open }; }, mate.mid);
    check(r.alive && r.d < 4.5 && Math.abs(r.dy) < 1, `${tag}: manga arkadaşının yanında doğdu (${r.d.toFixed(2)} m, kot farkı ${r.dy.toFixed(2)})`);
    check(!r.open, `${tag}: doğunca harita kapandı`);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${tag}-mangadan-dogus.png` });
  }
  // arkadaş çatışmada → kapalı
  await kill(page); await page.waitForTimeout(800);
  const cmb = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; const m = g.soldiers.find((s) => s !== me && s.team === me.team && s.squad === me.squad && s.alive); if (!m) return null; m.lastDmgT = g.time; m._sqSt = null; const t = g.bigMap.targets().find((t) => t.mate === m); return t ? { ok: t.ok, st: t.st } : null; });
  check(cmb && !cmb.ok && cmb.st === 1, `${tag}: vurulan arkadaşta doğuş kapalı (durum ${cmb?.st})`);
  const enm = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; const m = g.soldiers.find((s) => s !== me && s.team === me.team && s.squad === me.squad && s.alive && g.time - s.lastDmgT > 5); const e = g.soldiers.find((s) => s.team !== me.team && s.alive); if (!m || !e) return null; e.pos.set(m.pos.x + 8, m.pos.y, m.pos.z); m._sqSt = null; const t = g.bigMap.targets().find((t) => t.mate === m); return t ? { ok: t.ok, st: t.st } : null; });
  check(enm && !enm.ok && enm.st === 2, `${tag}: yakında düşman olan arkadaşta doğuş kapalı (durum ${enm?.st})`);
  await page.screenshot({ path: `${OUT}/${tag}-arkadas-kapali.png` });
  if (conq) {     // sahip olunan bayrağa tıkla → orada doğ (düşmanın görmediği nokta)
    const fl = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; for (const o of g.mode.objectives) if (!o.owner || o.owner === me.team) { o.owner = me.team; o.p = me.team === 'blue' ? 1 : -1; } g.hud._spKey = null; const t = g.bigMap.targets().find((t) => t.kind === 'flag' && t.ok); return t ? { id: t.id, x: t.x, z: t.z } : null; });
    check(!!fl, `${tag}: sahip olunan bayrak seçilebilir (${fl?.id})`);
    if (fl) {
      const [fx, fy] = await scr(page, fl.x, fl.z);
      await page.mouse.click(fx, fy); await page.waitForTimeout(200);
      await page.keyboard.press('Space');
      await page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 20000 }).catch(() => {});
      const r = await page.evaluate((id) => { const g = window.__game, p = g.playerSoldier, o = g.mode.objectives.find((q) => q.id === id); return { alive: p.alive, d: Math.hypot(p.pos.x - o.x, p.pos.z - o.z), r: o.r }; }, fl.id);
      check(r.alive && r.d < r.r + 2, `${tag}: Boşluk ile seçilen bayrakta doğdu (${r.d.toFixed(1)} m, alan ${r.r} m)`);
    }
  }
  // Esc → Kontroller: yeni satırlar
  check(!errs.length, `${tag}: sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}

// Kontroller: ana menü + oyun içi (Esc → Kontroller), Türkçe ve İngilizce
for (const lang of ['tr', 'en']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  await ctx.addInitScript((l) => { localStorage.setItem('warbyte.lang', l); if (!localStorage.getItem('warbyte.acct')) localStorage.setItem('warbyte.acct', JSON.stringify({ kind: 'guest' })); }, lang);      // misafir: giriş ekranı açılmasın
  const page = await ctx.newPage(), errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}/?debug=1`);
  await page.waitForSelector('.mn-nav[data-v=controls]', { timeout: 60000 }); await page.waitForTimeout(800);
  await page.click('.mn-nav[data-v=controls]'); await page.waitForTimeout(600);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.kbrow')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
  const want = lang === 'tr' ? [/Büyük harita.*M/, /İşaret koy.*I/, /Takım seçimi.*K/] : [/Big map.*M/, /Place marker.*I/, /Team select.*K/];
  for (const re of want) check(rows.some((r) => re.test(r)), `menü Kontroller (${lang}): ${re}`);
  await page.screenshot({ path: `${OUT}/kontroller-menu-${lang}.png` });
  await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&nolock=1`);
  await page.waitForFunction(() => window.__game?.running && window.__game.time > 1, null, { timeout: 120000 });
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await page.click('#bCtl').catch(() => {}); await page.waitForTimeout(600);
  const txt = await page.evaluate(() => [...document.querySelectorAll('.kb')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
  for (const re of want) check(txt.some((r) => re.test(r)), `Esc → Kontroller (${lang}): ${re}`);
  await page.screenshot({ path: `${OUT}/kontroller-oyun-${lang}.png` });
  check(!errs.length, `Kontroller (${lang}): sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}

await desk('kuzey','autostart=8v8&map=kuzey&type=conquest', true);
await desk('cg', 'autostart=6v6&map=colgecidi&type=conquest', true);
await desk('cg-tdm', 'autostart=6v6&map=colgecidi&type=tdm', false);

// kapalı modlar: silah oyunu, Enfekte
for (const [tag, q] of [['gg', 'autostart=6v6&map=colgecidi&type=gg'], ['inf', 'autostart=6v6&map=colgecidi&type=inf']]) {
  const { ctx, page, errs } = await open(q);
  await kill(page); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { const g = window.__game; return { hud: !!g.squadHud, mode: g.bigMap?.mode, dmap: g.hud.$('respawn').classList.contains('dmap') }; });
  check(!r.hud && r.mode !== 'deploy' && !r.dmap, `${tag}: manga HUD'u / doğuş seçici kapalı (${JSON.stringify(r)})`);
  check(!errs.length, `${tag}: sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}

// mobil: Pixel 7 yatay, dokunmatik harita düğmesi
{
  const { ctx, page, errs } = await open('autostart=8v8&map=kuzey&type=conquest', true);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/mob-hud.png` });
  const bt = await page.evaluate(() => { const b = document.querySelector('[data-b=map]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; });
  check(bt && bt[2] > 10, `mobil: harita düğmesi var (${bt && bt[2].toFixed(0)} px)`);
  if (bt) { await page.touchscreen.tap(bt[0], bt[1]); await page.waitForTimeout(600); }
  check(await page.evaluate(() => window.__game.bigMap.open), 'mobil: harita düğmesi büyük haritayı açtı');
  const tgt = await page.evaluate(() => { const g = window.__game, o = g.mode.objectives[1] || g.mode.objectives[0]; return { x: o.x + 25, z: o.z }; });
  const [tx, ty] = await scr(page, tgt.x, tgt.z);
  await page.touchscreen.tap(tx, ty); await page.waitForTimeout(400);
  check(await page.evaluate(() => !!window.__game.pings.items.get(window.__game.playerSoldier.id)), 'mobil: haritaya dokunmak işaret koydu');
  await page.screenshot({ path: `${OUT}/mob-harita.png` });
  const x = await page.evaluate(() => { const r = document.querySelector('#bmap .x').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.touchscreen.tap(x[0], x[1]); await page.waitForTimeout(400);
  check(!(await page.evaluate(() => window.__game.bigMap.open)), 'mobil: ✕ haritayı kapattı');
  await calmMates(page);
  await kill(page); await page.waitForTimeout(1500);
  check(await page.evaluate(() => window.__game.bigMap.mode === 'deploy'), 'mobil: ölünce doğuş seçici');
  await page.screenshot({ path: `${OUT}/mob-olum-dogus.png` });
  const mate = await page.evaluate(() => { const t = window.__game.bigMap.targets().find((t) => t.kind === 'mate' && t.ok); return t ? { id: t.id, x: t.x, z: t.z, mid: t.mate.id } : null; });
  if (mate) {
    const [mx, my] = await scr(page, mate.x, mate.z);
    await page.touchscreen.tap(mx, my); await page.waitForTimeout(300);
    const go = await page.evaluate(() => { const r = document.querySelector('#respawn .dgo').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; });
    check(go[2] > 40, `mobil: Doğ düğmesi görünür (${go[2].toFixed(0)} px)`);
    await page.touchscreen.tap(go[0], go[1]);
    await page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 20000 }).catch(() => {});
    const r = await page.evaluate((mid) => { const g = window.__game, p = g.playerSoldier, m = g.soldiers[mid]; return { alive: p.alive, d: Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z), ch: g.spawnChoice }; }, mate.mid);
    check(r.alive && r.d < 4.5, `mobil: dokunarak manga arkadaşının yanında doğdu (${r.d.toFixed(2)} m, ${r.ch})`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/mob-mangadan-dogus.png` });
  } else check(false, 'mobil: uygun manga arkadaşı yok');
  check(!errs.length, `mobil: sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(fails ? `sonuç: HATA (${fails})` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
