// 12.202 Çevrim içi manga: sunucunun manga ataması (roster.sq), işaret (ping) takıma gider / düşmana gitmez, mangadan doğuş (sunucu me.sp uygunluğu).
// Üç istemci: Ali + Veli (Mavi, aynı manga), Can (Kırmızı). Botlu Çöl Geçidi ele geçirme odası.
//   node scripts/squadnet.mjs [istemci url] [ws url]   (sunucu BF_DEBUG=1)   → /tmp/wb-squad/net-*.png
// 12.205: + Kuzey Vadisi'nde araçtaki manga arkadaşının boş koltuğuna doğuş → /tmp/wb-vspawn/net-*.png · ONLY=base,veh ile yalnız seçilen bölüm
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const [base = 'http://127.0.0.1:5284', ws = process.env.WS || 'ws://127.0.0.1:9066'] = process.argv.slice(2), OUT = '/tmp/wb-squad';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null, part = (k) => !ONLY || ONLY.has(k);
let fails = 0; const check = (ok, m) => { console.log(`${ok ? 'OK  ' : 'HATA'}  ${m}`); if (!ok) fails++; };
const S = `&server=${encodeURIComponent(ws)}&debug=1&nolock=1`;
async function client(q) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}/?${q}${S}`);
  await page.waitForFunction(() => window.__game?.running && window.__game.playerSoldier && window.__game.time > 1, null, { timeout: 120000 });
  await page.waitForTimeout(800);
  return { page, errs };
}
if (part('base')) {
  const A = await client('online=new&map=colgecidi&type=conquest&per=4&team=blue&name=Ali');
  const code = await A.page.evaluate(() => new URLSearchParams(location.search).get('online'));
  console.log('oda', code);
  const B = await client(`online=${code}&team=blue&name=Veli`);
  const C = await client(`online=${code}&team=red&name=Can`);
  await A.page.waitForTimeout(1500);

  // 1) manga ataması: sunucu Ali ile Veli'yi aynı mangaya koyar (mangalar 4 kişilik kalır)
  const sq = async (p) => p.evaluate(() => { const g = window.__game, me = g.playerSoldier; const t = {}; for (const s of g.soldiers) if (!s.vacant) { const k = s.team + s.squad; t[k] = (t[k] || 0) + 1; } return { id: me.id, team: me.team, sq: me.squad, list: [...document.querySelectorAll('#sqp .r .nm')].map((e) => e.textContent), cnt: t }; });
  const [a, b, c] = [await sq(A.page), await sq(B.page), await sq(C.page)];
  console.log(JSON.stringify({ a, b, c }));
  check(a.team === 'blue' && b.team === 'blue' && c.team === 'red', 'takımlar: Ali / Veli Mavi, Can Kırmızı');
  check(a.sq === b.sq, `Ali ile Veli aynı mangada (${a.sq} / ${b.sq})`);
  check(a.list.includes('Veli') && b.list.includes('Ali'), `HUD manga listesinde birbirlerini görüyorlar (Ali: ${a.list.join(', ')})`);
  check(Object.values(a.cnt).every((n) => n <= 4), `mangalar en çok 4 (${JSON.stringify(a.cnt)})`);
  const bSq = await B.page.evaluate((id) => window.__game.soldiers[id].squad, a.id);
  check(bSq === a.sq, 'Veli\'nin istemcisinde de Ali aynı mangada (roster.sq)');

  // 2) işaret: Ali haritaya işaret koyar → Veli görür (yeşil = manga), Can görmez
  await A.page.keyboard.press('KeyM'); await A.page.waitForTimeout(400);
  const pt = await A.page.evaluate(() => { const g = window.__game, me = g.playerSoldier; return { x: me.pos.x + 12, z: me.pos.z - 25 }; });
  const [px, py] = await A.page.evaluate(([x, z]) => { const b = window.__game.bigMap, r = b.cv.getBoundingClientRect(); return [r.left + b.X(x) / b.dpr, r.top + b.Y(z) / b.dpr]; }, [pt.x, pt.z]);
  await A.page.mouse.click(px, py);
  await A.page.waitForTimeout(1200);
  await A.page.screenshot({ path: `${OUT}/net-ali-harita.png` });
  await A.page.keyboard.press('KeyM');
  const seen = await B.page.evaluate((id) => { const p = window.__game.pings.items.get(id); return p ? { x: p.x, z: p.z, col: window.__game.pings.colorOf(p), obj: !!p.obj } : null; }, a.id);
  check(seen && Math.hypot(seen.x - pt.x, seen.z - pt.z) < 1.5 && seen.obj, `Veli Ali'nin işaretini aldı (${seen && seen.x.toFixed(1)}, ${seen && seen.z.toFixed(1)}, 3B)`);
  check(seen?.col === '#62f06a', `Veli'de işaret manga rengi (yeşil: ${seen?.col})`);
  const cSeen = await C.page.evaluate((id) => !!window.__game.pings.items.get(id), a.id);
  check(!cSeen, 'Can (düşman) işareti almadı');
  await B.page.evaluate((p) => { const g = window.__game, me = g.playerSoldier; me.yaw = Math.atan2(-(p.x - me.pos.x), -(p.z - me.pos.z)); me.pitch = -0.05; }, pt);
  await B.page.waitForTimeout(600);
  await B.page.screenshot({ path: `${OUT}/net-veli-isaret.png` });

  // 3) mangadan doğuş: botlar susar, Ali ölür → doğuş seçicide Veli uygun (sunucunun me.sp'si) → tıkla + Doğ → Veli'nin yanında
  await A.page.evaluate(() => window.__game.online.send({ t: 'dbg', bots: false }));
  await A.page.waitForTimeout(600);
  await A.page.evaluate(() => window.__game.online.send({ t: 'dbg', kill: 1 }));
  await A.page.waitForFunction(() => window.__game.bigMap.mode === 'deploy', null, { timeout: 8000 }).catch(() => {});
  await A.page.waitForTimeout(1200);
  let st = await A.page.evaluate((bid) => { const g = window.__game; const t = g.bigMap.targets().find((t) => t.id === 'sq:' + bid); return { mode: g.bigMap.mode, sp: g._sqNet ? [...g._sqNet] : null, t: t ? { ok: t.ok, st: t.st, x: t.x, z: t.z } : null }; }, b.id);
  console.log('      doğuş durumu:', JSON.stringify(st));
  check(st.mode === 'deploy', 'Ali öldü → doğuş seçici harita');
  check(st.sp && st.sp.some(([id]) => id === b.id), 'sunucu ölüyken manga arkadaşı uygunluğunu gönderiyor (me.sp)');
  // Can, Veli'yi vurur → Veli çatışmada → kapalı
  await C.page.evaluate((bid) => window.__game.online.send({ t: 'dbg', dmg: [bid, 5] }), b.id);
  await A.page.waitForTimeout(700);
  const cmb = await A.page.evaluate((bid) => { const t = window.__game.bigMap.targets().find((t) => t.id === 'sq:' + bid); return t ? { ok: t.ok, st: t.st } : null; }, b.id);
  check(cmb && !cmb.ok && cmb.st === 1, `Veli vurulunca mangadan doğuş kapalı (durum ${cmb?.st}: çatışmada)`);
  await A.page.screenshot({ path: `${OUT}/net-ali-arkadas-catismada.png` });
  // 5 sn sonra açılır
  await A.page.waitForFunction((bid) => { const t = window.__game.bigMap.targets().find((t) => t.id === 'sq:' + bid); return t && t.ok; }, b.id, { timeout: 12000 }).catch(() => {});
  st = await A.page.evaluate((bid) => { const t = window.__game.bigMap.targets().find((t) => t.id === 'sq:' + bid); return t ? { ok: t.ok, x: t.x, z: t.z } : null; }, b.id);
  check(st?.ok, 'çatışmadan 5 sn sonra Veli yine uygun');
  // deploy auto-spawn would happen after DEPLOY_AUTO; we click now
  if (st?.ok) {
    const [mx, my] = await A.page.evaluate(([x, z]) => { const b = window.__game.bigMap, r = b.cv.getBoundingClientRect(); return [r.left + b.X(x) / b.dpr, r.top + b.Y(z) / b.dpr]; }, [st.x, st.z]);
    await A.page.mouse.click(mx, my); await A.page.waitForTimeout(300);
    check(await A.page.evaluate((bid) => window.__game.spawnChoice === 'sq:' + bid, b.id), 'Ali Veli\'yi seçti');
    await A.page.screenshot({ path: `${OUT}/net-ali-dogus-secimi.png` });
    await A.page.click('#respawn .dgo');
    await A.page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 15000 }).catch(() => {});
    await A.page.waitForTimeout(900);
    const r = await A.page.evaluate((bid) => { const g = window.__game, p = g.playerSoldier, m = g.soldiers[bid]; return { alive: p.alive, d: Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z), dy: p.pos.y - m.pos.y }; }, b.id);
    const rb = await B.page.evaluate((aid) => { const g = window.__game, p = g.playerSoldier, m = g.soldiers[aid]; return { alive: m.alive, d: Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z) }; }, a.id);
    check(r.alive && r.d < 4.5 && Math.abs(r.dy) < 1, `Ali Veli'nin yanında doğdu (Ali'de ${r.d.toFixed(2)} m, Veli'de ${rb.d.toFixed(2)} m)`);
    await A.page.screenshot({ path: `${OUT}/net-ali-mangadan-dogus.png` });
    await B.page.screenshot({ path: `${OUT}/net-veli-ali-yaninda.png` });
  }
  // 4) seçmeden Doğ'a basılmazsa: süre + 10 sn sonra kendiliğinden (AFK koruması)
  await B.page.evaluate(() => window.__game.online.send({ t: 'dbg', kill: 1 }));
  await B.page.waitForFunction(() => !window.__game.playerSoldier.alive, null, { timeout: 5000 }).catch(() => {});
  const t0 = Date.now();
  await B.page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 30000 }).catch(() => {});
  const dt = (Date.now() - t0) / 1000;
  check(dt > 8 && dt < 25, `Doğ'a basmayan Veli bekledi, sonra kendiliğinden doğdu (${dt.toFixed(1)} sn)`);
  for (const [n, x] of [['Ali', A], ['Veli', B], ['Can', C]]) check(!x.errs.length, `${n}: sayfa hatası yok ${x.errs.slice(0, 2).join(' | ')}`);
}

// ───────────── 12.205 araçtaki manga arkadaşının boş koltuğuna doğuş (Kuzey Vadisi fetih, iki istemci) ─────────────
// Ali jipi sürer, Veli (aynı manga) ölür → doğuş haritasında Ali'nin jipi (sunucunun me.sp'si: durum 6 + boş koltuk) → tıkla + Doğ → jipin
// makineli koltuğunda; Ali'nin istemcisinde (sunucu anlık görüntüsü) de Veli koltuk 1'de. Nişan / yakınlaştırma sıfır, jip sürülünce Veli onunla gider.
if (part('veh')) {
  const VOUT = '/tmp/wb-vspawn';
  mkdirSync(VOUT, { recursive: true });
  const A = await client('online=new&map=kuzey&type=conquest&per=6&team=blue&name=Ali');
  const code = await A.page.evaluate(() => new URLSearchParams(location.search).get('online'));
  console.log('oda (Kuzey)', code);
  const B = await client(`online=${code}&team=blue&name=Veli`);
  await A.page.waitForTimeout(1500);
  await A.page.evaluate(() => window.__game.online.send({ t: 'dbg', bots: false }));      // botlar jipe binip koltukları doldurmasın
  const ids = await Promise.all([A, B].map((x) => x.page.evaluate(() => ({ id: window.__game.playerSoldier.id, sq: window.__game.playerSoldier.squad }))));
  check(ids[0].sq === ids[1].sq, `veh: Ali ile Veli aynı mangada (${ids[0].sq} / ${ids[1].sq})`);
  const key = (p, type, code) => p.evaluate(([type, code]) => document.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true })), [type, code]);
  const press = async (p, code) => { await key(p, 'keydown', code); await p.waitForTimeout(80); await key(p, 'keyup', code); };
  const jeep = await A.page.evaluate(() => { const g = window.__game, me = g.playerSoldier; const L = g.vehicles.list.filter((v) => v.type === 'jip' && v.alive && v.st && v.spawn.team === 'blue' && !v.seats.some(Boolean)); L.sort((a, b) => Math.hypot(a.st.x - me.pos.x, a.st.z - me.pos.z) - Math.hypot(b.st.x - me.pos.x, b.st.z - me.pos.z)); const v = L[0]; return v ? { i: v.idx, id: v.id, x: v.st.x, z: v.st.z, yaw: v.st.yaw } : null; });
  check(!!jeep, `veh: jip bulundu ${JSON.stringify(jeep)}`);
  const side = (v, d) => [v.x + Math.cos(v.yaw) * d, v.z - Math.sin(v.yaw) * d];
  await A.page.evaluate((xz) => window.__game.online.send({ t: 'dbg', tp: xz }), side(jeep, -2.6));
  await A.page.waitForTimeout(1200);
  await press(A.page, 'KeyE');
  await A.page.waitForTimeout(1200);
  const inA = await A.page.evaluate(() => { const s = window.__game.playerSoldier; return { veh: s.veh?.idx ?? null, seat: s.seat }; });
  check(inA.veh === jeep.i && inA.seat === 0, `veh: Ali jipi sürüyor (${JSON.stringify(inA)})`);
  // Veli: nişan açıkken ölür
  await B.page.evaluate(() => { const p = window.__game.playerSoldier; p.ads = true; p.adsT = 1; });
  await B.page.evaluate(() => window.__game.online.send({ t: 'dbg', kill: 1 }));
  await B.page.waitForFunction(() => window.__game.bigMap.mode === 'deploy', null, { timeout: 8000 }).catch(() => {});
  await B.page.waitForTimeout(1500);
  const tgt = await B.page.evaluate((aid) => { const g = window.__game, t = g.bigMap.targets().find((t) => t.id === 'sq:' + aid); return { sp: g._sqNet ? [...g._sqNet] : null, spf: g._sqNetF ? [...g._sqNetF] : null, t: t ? { ok: t.ok, st: t.st, free: t.free, veh: t.veh?.idx ?? null, x: t.x, z: t.z } : null }; }, ids[0].id);
  console.log('      Veli doğuş:', JSON.stringify(tgt));
  check(tgt.t && tgt.t.ok && tgt.t.st === 6 && tgt.t.veh === jeep.i && tgt.t.free === 3, `veh: Veli'nin doğuş haritasında Ali'nin jipi uygun (sunucu durumu ${tgt.t?.st}, ${tgt.t?.free} boş koltuk)`);
  await B.page.evaluate(([x, z]) => { const b = window.__game.bigMap, v = b.vw; v.z = 3; v.cx = x; v.cz = z; b._vt = 0; }, [tgt.t.x, tgt.t.z]);
  await B.page.waitForTimeout(400);
  const [mx, my] = await B.page.evaluate(([x, z]) => { const b = window.__game.bigMap, r = b.cv.getBoundingClientRect(); return [r.left + b.X(x) / b.dpr, r.top + b.Y(z) / b.dpr]; }, [tgt.t.x, tgt.t.z]);
  await B.page.mouse.click(mx, my); await B.page.waitForTimeout(400);
  await B.page.screenshot({ path: `${VOUT}/net-01-veli-dogus-haritasi-jip.png` });
  check(await B.page.evaluate((aid) => window.__game.spawnChoice === 'sq:' + aid, ids[0].id), 'veh: Veli Ali\'nin jipini seçti');
  await B.page.click('#respawn .dgo');
  await B.page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 20000 }).catch(() => {});
  await B.page.waitForTimeout(150);
  const rb0 = await B.page.evaluate(() => { const g = window.__game, p = g.playerSoldier; return { veh: p.veh?.idx ?? null, seat: p.seat }; });
  await B.page.waitForTimeout(900);
  const rb = await B.page.evaluate(() => { const g = window.__game, p = g.playerSoldier, P = g.player, v = p.veh; return { alive: p.alive, veh: v?.idx ?? null, seat: p.seat, ads: p.ads, adsT: p.adsT, vehK: +(P._vehK || 0).toFixed(2), zoom: +(P.baseFov() / g.camera.fov).toFixed(2), d: v ? +Math.hypot(p.pos.x - v.st.x, p.pos.z - v.st.z).toFixed(2) : null, cam: v ? +Math.hypot(g.camera.position.x - v.st.x, g.camera.position.z - v.st.z).toFixed(2) : null, hud: document.querySelector('#vhPanel .nm')?.textContent || '' }; });
  const ra = await A.page.evaluate((bid) => { const g = window.__game, s = g.soldiers[bid]; return { veh: s.veh?.idx ?? null, seat: s.seat, alive: s.alive }; }, ids[1].id);
  console.log('      Veli:', JSON.stringify(rb), 'Ali\'de Veli:', JSON.stringify(ra));
  check(rb0.veh === jeep.i && rb0.seat === 1, `veh: Veli doğduğu ilk karede koltukta (${JSON.stringify(rb0)})`);
  check(rb.alive && rb.veh === jeep.i && rb.seat === 1 && rb.d < 2.5, `veh: Veli Ali'nin jipinin makineli koltuğunda (koltuk ${rb.seat}, araca ${rb.d} m)`);
  check(ra.alive && ra.veh === jeep.i && ra.seat === 1, `veh: sunucuda (Ali'nin anlık görüntüsü) Veli koltuk 1'de (${JSON.stringify(ra)})`);
  check(!rb.ads && rb.adsT === 0 && rb.vehK === 0 && Math.abs(rb.zoom - 1) < 0.03 && rb.cam < 3 && /J[İI]P|JEEP/i.test(rb.hud), `veh: Veli'de nişan / yakınlaştırma sıfır, kamera koltukta, araç HUD'u (${rb.hud}, ×${rb.zoom}, kamera ${rb.cam} m)`);
  await B.page.screenshot({ path: `${VOUT}/net-02-veli-jip-makineli-1sahis.png` });
  // Ali sürer → Veli koltukta onunla gider
  const p0 = await B.page.evaluate(() => { const v = window.__game.playerSoldier.veh; return v ? [v.st.x, v.st.z] : null; });
  await key(A.page, 'keydown', 'KeyW'); await A.page.waitForTimeout(2200); await key(A.page, 'keyup', 'KeyW');
  await A.page.waitForTimeout(800);
  const mv = await B.page.evaluate((p0) => { const g = window.__game, p = g.playerSoldier, v = p.veh; return v ? { moved: +Math.hypot(v.st.x - p0[0], v.st.z - p0[1]).toFixed(1), d: +Math.hypot(p.pos.x - v.st.x, p.pos.z - v.st.z).toFixed(2), seat: p.seat } : null; }, p0);
  check(mv && mv.moved > 5 && mv.d < 2.5 && mv.seat === 1, `veh: Ali sürünce Veli koltukta jiple gitti (${mv?.moved} m, koltuğa ${mv?.d} m)`);
  await B.page.screenshot({ path: `${VOUT}/net-03-veli-jip-surulurken.png` });
  await A.page.screenshot({ path: `${VOUT}/net-04-ali-surucu.png` });
  for (const [n, x] of [['Ali', A], ['Veli', B]]) check(!x.errs.length, `veh ${n}: sayfa hatası yok ${x.errs.slice(0, 2).join(' | ')}`);
}

await browser.close();
console.log(fails ? `sonuç: HATA (${fails})` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
