// 12.216 sabit yuva + ikmal kutusu ETKİLEŞİM testi (Kuzey Vadisi, gerçek GPU, gerçek klavye / dokunma):
//   URL=http://127.0.0.1:5203 WS=ws://127.0.0.1:8998 OUT=/tmp/wb-rpg/sonra node scripts/interacttest.mjs      (ONLY=off | on | mob)
// Kullanıcı: "mapin bazı noktalarında RPG var ama kullanılamıyor" → üs / bayrak ikmal kutusunun üstündeki RPG. Yürüyerek yaklaş, ipucu, E (dokunmatikte
// araç düğmesi), sınıf (saldırı / mühendis / sıhhiye), bayrak sahibi (tarafsız / kendi / düşman), yuvayı bot kullanırken, yuva patlayıp kurulunca;
// çevrim içinde iki istemci (A mavi, B kırmızı; yerel debug sunucu BF_DEBUG=1).
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5203', WS = process.env.WS || 'ws://127.0.0.1:8998', OUT = process.env.OUT || '/tmp/wb-rpg/sonra', ONLY = process.env.ONLY || '';
fs.mkdirSync(OUT, { recursive: true });
const fails = [], ok = (c, m, d = '') => { if (!c) fails.push(m); console.log((c ? 'OK  ' : 'HATA') + ' ' + m + (d ? ' · ' + d : '')); };
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const errs = [];
async function open(q, mob = false) {
  const ctx = await browser.newContext(mob ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: 'tr-TR' } : { viewport: { width: 1280, height: 720 }, locale: 'tr-TR' });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${URL0}/?${q}&debug=1&nolock=1&nologin=1&tod=day&weather=clear`);
  await p.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier?.alive', null, { timeout: 240000 });
  return p;
}
const prompt = (p) => p.evaluate(() => { const e = document.getElementById('vhPrompt'); return e && e.style.display !== 'none' ? e.textContent.replace(/\s+/g, ' ').trim() : ''; });
const items = (p) => p.evaluate(() => window.__game.playerSoldier.items.map((i) => `${i.id}:${i.mag}+${i.reserve}`).join(' '));
const seat = (p) => p.evaluate(() => window.__game.playerSoldier.veh?.id || null);
// yürü: W basılı, her 60 ms hedefe dön (gerçek girdi); stop m'ye kadar
async function walkTo(p, T, stop = 1.2, ms = 4000) {
  await p.keyboard.down('KeyW');
  const t0 = Date.now(); let d = 99;
  while (Date.now() - t0 < ms) {
    d = await p.evaluate(([T, stop]) => { const me = window.__game.playerSoldier, dx = T.x - me.pos.x, dz = T.z - me.pos.z, d = Math.hypot(dx, dz); me.yaw = Math.atan2(-dx, -dz); me.pitch = -0.45; return d; }, [T, stop]);
    if (d <= stop) break;
    await p.waitForTimeout(60);
  }
  await p.keyboard.up('KeyW'); await p.waitForTimeout(250);
  return d;
}
const look = (p, T, pitch = -0.5) => p.evaluate(([T, pitch]) => { const me = window.__game.playerSoldier; me.yaw = Math.atan2(-(T.x - me.pos.x), -(T.z - me.pos.z)); me.pitch = pitch; }, [T, pitch]);
const tpOff = (p, x, z, y) => p.evaluate(([x, z, y]) => { const g = window.__game, me = g.playerSoldier; if (me.veh) g.vehicles.exit(me); me.fly = false; me.pos.set(x, y ?? g.world.heightAt(x, z) + 0.2, z); me.vel.set(0, 0, 0); }, [x, z, y]);

// ───────────── ÇEVRİM DIŞI (masaüstü): sınıflar + yuvalar + bayrak sahibi + M haritası ─────────────
if (!ONLY || ONLY === 'off') {
  for (const cls of ['assault', 'engineer', 'medic']) {
    const p = await open(`autostart=4v4&map=kuzey&type=conquest&dev=1&cls=${cls}`);
    await p.evaluate(() => { const g = window.__game; g.devGod = true; g.brainsOff = g.brains.splice(0); g.playerSoldier.fly = false; for (const o of g.mode.objectives) o.owner = null; });
    const C = await p.evaluate(() => { const c = window.__game.supply.find((q) => q.of?.name === 'Kavşak'); return { x: c.x, y: c.y, z: c.z }; });
    await tpOff(p, C.x + 6, C.z + 1); await p.waitForTimeout(400);
    const d = await walkTo(p, C, 1.4); await look(p, C, -0.55); await p.waitForTimeout(500);
    const pr = await prompt(p), it0 = await items(p);
    if (cls === 'assault') await p.screenshot({ path: `${OUT}/1-ikmal-yaklasinca-saldiri.png` });
    if (cls === 'engineer') {
      ok(/İKMAL/.test(pr) && /dolu/.test(pr), `[${cls}] dolu RPG ile kutu ipucu "cephane dolu"`, pr);
      await p.evaluate(() => { const it = window.__game.playerSoldier.items.find((i) => i.id === 'rpg'); it.reserve = 0; });      // iki roket atılmış gibi
      await p.waitForTimeout(300);
      const pr2 = await prompt(p);
      ok(/E İKMAL — mermi \/ roket al/.test(pr2), `[${cls}] eksik roket: ipucu "E İKMAL — mermi / roket al"`, pr2);
      await p.keyboard.press('KeyE'); await p.waitForTimeout(400);
      const it1 = await items(p), rk = await p.evaluate(() => { const it = window.__game.playerSoldier.items.find((i) => i.id === 'rpg'); return it.mag + it.reserve; });
      ok(rk >= 2, `[${cls}] E ile anında ikmal (roket +1, otomatik tik de sürer)`, it1);
    } else {
      ok(/E İKMAL — RPG al/.test(pr), `[${cls}] kutuya ${d.toFixed(1)} m: ipucu "E İKMAL — RPG al"`, pr);
      await p.keyboard.press('KeyE'); await p.waitForTimeout(500);
      const it1 = await items(p), sl = await p.evaluate(() => window.__game.playerSoldier.items.findIndex((i) => i.id === 'rpg'));
      ok(sl === 2 && /rpg:1\+2/.test(it1), `[${cls}] E: RPG alındı (ekipman yuvası, 1 + 2 roket)`, `${it0} → ${it1}`);
      if (cls === 'assault') await p.screenshot({ path: `${OUT}/2-ikmal-rpg-alindi.png` });
      // RPG gerçekten kullanılabilir: 4 ile çek, ateş et
      await p.keyboard.press('Digit4'); await p.waitForTimeout(900);
      await p.evaluate(() => { const g = window.__game, me = g.playerSoldier; g._supT = 1e9; g.devGod = false; me.yaw += Math.PI; me.pitch = 0.05; if (g.player) { g.player.yaw = me.yaw; g.player.pitch = me.pitch; } });      // otomatik ikmal tiki dursun (kutunun yanında atılan roketi hemen geri verir)
      await p.waitForTimeout(300);
      const cur = await p.evaluate(() => window.__game.playerSoldier.item.id);
      await p.mouse.move(640, 300); await p.mouse.down(); await p.waitForTimeout(120); await p.mouse.up(); await p.waitForTimeout(700);
      const af = await p.evaluate(() => { const it = window.__game.playerSoldier.items[2]; return it.mag + it.reserve; });
      ok(cur === 'rpg' && af === 2, `[${cls}] 4 ile RPG elde, sol tık roket attı (3 → 2)`, `${cur} ${af}`);
      if (cls === 'assault') await p.screenshot({ path: `${OUT}/3-rpg-elde-atis.png` });
      await p.evaluate(() => { window.__game._supT = 0; window.__game.devGod = true; });
    }
    if (cls === 'assault') {
      // bayrak sahibi: düşman / kendi
      const own = [];
      for (const o of ['red', 'blue', null]) {
        await p.evaluate((o) => { const g = window.__game, f = g.mode.objectives.find((q) => q.name === 'Kavşak'); f.owner = o; f.p = o === 'red' ? -1 : o === 'blue' ? 1 : 0; g._supT = 1e9; g.playerSoldier.items[2].reserve = 0; }, o);      // otomatik tik durur: yalnız E
        await p.waitForTimeout(300); const t = await prompt(p);
        await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
        const r = await p.evaluate(() => window.__game.playerSoldier.items[2].reserve);
        own.push([o, t, r]);
        if (o === 'red') await p.screenshot({ path: `${OUT}/4-ikmal-dusman-bayragi.png` });
      }
      await p.evaluate(() => { window.__game._supT = 0; });
      ok(/düşmanın/.test(own[0][1]) && own[0][2] === 0, 'bayrak düşmanda: "İKMAL — düşmanın", E bir şey vermez', JSON.stringify(own[0]));
      ok(/E İKMAL/.test(own[1][1]) && own[1][2] >= 1, 'bayrak bizde: E ile ikmal', JSON.stringify(own[1]));
      ok(/E İKMAL/.test(own[2][1]) && own[2][2] >= 1, 'bayrak tarafsız: herkes kullanır', JSON.stringify(own[2]));
      // yuvalar: 9 mevzi (yürüyerek, 4 yönden) + 6 kule (platformdan)
      const E = await p.evaluate(() => window.__game.vehicles.list.filter((v) => v.def.fixed).map((v) => ({ id: v.id, idx: v.idx, x: v.st.x, y: v.st.y, z: v.st.z, b: v.st.base ?? v.st.yaw, tower: v.spawn.tower })));
      const T = await p.evaluate(() => window.__game.map.towers.map((t) => ({ id: t.id, x: t.x, z: t.z, top: t.top, pts: t.pts })));
      let used = 0, hint = 0, tries = 0, front = 0, frontOk = 0; const miss = [];
      for (const e of E) {
        const starts = e.tower ? [(() => { const t = T.find((q) => q.id === e.tower); return { x: t.x, z: t.z, y: t.top + 0.05 }; })(), (() => { const t = T.find((q) => q.id === e.tower); return t.pts[4]; })()]
          : [0, 1, 3, 2].map((k) => ({ k, x: e.x + Math.sin(e.b + k * Math.PI / 2) * 4, z: e.z + Math.cos(e.b + k * Math.PI / 2) * 4 }));      // arkadan, iki yandan (siperin üstünden), önden (ön duvar)
        for (const S of starts) {
          if (S.k === 2) front++; else tries++;
          await tpOff(p, S.x, S.z, S.y); await p.waitForTimeout(250);
          await p.keyboard.down('KeyW'); let got = '';
          for (let i = 0; i < 50 && !got; i++) { await p.waitForTimeout(70); got = await p.evaluate((e) => { const g = window.__game, me = g.playerSoldier; me.yaw = Math.atan2(-(e.x - me.pos.x), -(e.z - me.pos.z)); const n = g.vehicles.near(me); return n?.v.id === e.id ? document.getElementById('vhPrompt').textContent : ''; }, e); }
          await p.keyboard.up('KeyW');
          if (/başına geç/.test(got) && S.k !== 2) hint++;
          if (got) { await p.keyboard.press('KeyE'); await p.waitForTimeout(250); if (await seat(p) === e.id) { if (S.k === 2) frontOk++; else used++; } }
          else miss.push(await p.evaluate(([e, S]) => { const me = window.__game.playerSoldier; return `${e.id}@${S.x.toFixed(0)},${S.z.toFixed(0)}: d ${Math.hypot(me.pos.x - e.x, me.pos.z - e.z).toFixed(2)} dy ${(me.pos.y - e.y).toFixed(2)}`; }, [e, S]));
          if (e.id === 'Y-C-atgm-12' && S === starts[0]) { await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/5-tanksavar-basinda.png` }); }
          if (e.id === 'Y-C-K' && S === starts[0]) { await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/5b-kule-hmg-basinda.png` }); }
          await p.evaluate(() => { const g = window.__game, me = g.playerSoldier; if (me.veh) g.vehicles.exit(me); });
        }
      }
      ok(used === tries && hint === tries, `15 yuva × yön: yürüyerek ipucu "E <YUVA> — başına geç" ${hint}/${tries}, binme ${used}/${tries} (arkadan + iki yandan; önden ön duvarın üstünden ${frontOk}/${front})`, miss.join(' | '));
      // tanksavar ipucu ekran görüntüsü
      const at = E.find((e) => e.id === 'Y-C-atgm-12');
      await tpOff(p, at.x + Math.sin(at.b) * 1.9, at.z + Math.cos(at.b) * 1.9); await look(p, at, -0.45); await p.waitForTimeout(600);
      ok(/E TANKSAVAR — başına geç/.test(await prompt(p)), 'tanksavar ipucu', await prompt(p));
      await p.screenshot({ path: `${OUT}/6-tanksavar-ipucu.png` });
      // düşman bot başında → "dolu (düşman)"; takım arkadaşı bot → "başına geç · <bot> iner" + E
      await p.evaluate(() => { const g = window.__game, v = g.vehicles.list.find((q) => q.id === 'Y-C-atgm-12'), r = g.soldiers.find((s) => s.team === 'red' && s.alive && s.brain && !s.veh); g.vehicles.enter(r, v, 0); });
      await p.waitForTimeout(400); const pf = await prompt(p);
      ok(/TANKSAVAR — dolu \(düşman\)/.test(pf), 'düşman bot yuvada: "TANKSAVAR — dolu (düşman)"', pf);
      await p.screenshot({ path: `${OUT}/7-tanksavar-dusman-dolu.png` });
      await p.evaluate(() => { const g = window.__game, v = g.vehicles.list.find((q) => q.id === 'Y-C-atgm-12'); g.vehicles.exit(v.seats[0]); const b = g.soldiers.find((s) => s.team === 'blue' && s.alive && s.brain && !s.veh); g.vehicles.enter(b, v, 0); });
      await p.waitForTimeout(400); const pm = await prompt(p);
      await p.keyboard.press('KeyE'); await p.waitForTimeout(400);
      ok(/başına geç · .+ iner/i.test(pm) && await seat(p) === 'Y-C-atgm-12', 'takım arkadaşı bot yuvada: "başına geç · <bot> iner" (12.218) + E ile oyuncu geçer', pm);
      await p.evaluate(() => { const g = window.__game, me = g.playerSoldier; if (me.veh) g.vehicles.exit(me); });
      // yok edildi → "yeniden kuruluyor N sn" → kurulunca E
      await p.evaluate(() => { const g = window.__game, v = g.vehicles.list.find((q) => q.id === 'Y-C-atgm-12'); if (v.seats[0]) g.vehicles.exit(v.seats[0]); g.vehicles.destroy(v, null); });
      await tpOff(p, at.x + Math.sin(at.b) * 1.9, at.z + Math.cos(at.b) * 1.9); await look(p, at, -0.45);
      await p.waitForTimeout(1200); const pd = await prompt(p);
      ok(/TANKSAVAR — yeniden kuruluyor · \d+ sn/.test(pd), 'yok edilmiş yuva: "TANKSAVAR — yeniden kuruluyor · N sn"', pd);
      await p.screenshot({ path: `${OUT}/8-tanksavar-yeniden-kuruluyor.png` });
      await p.evaluate(() => window.__game.bigMap.toggle(true)); await p.waitForTimeout(700);
      await p.screenshot({ path: `${OUT}/9-m-haritasi.png` });
      const supN = await p.evaluate(() => window.__game.bigMap.supN);
      await p.evaluate(() => window.__game.bigMap.toggle(false));
      ok(supN === await p.evaluate(() => window.__game.supply.length), `M haritası: ${supN} ikmal kutusu simgesi + yıkık yuva (soluk / çarpı)`);
      await p.evaluate(() => { const v = window.__game.vehicles.list.find((q) => q.id === 'Y-C-atgm-12'); v.deadT = 99; v.wreck = false; v.respawnT = 0.05; });
      await p.waitForTimeout(800);
      const pr2 = await prompt(p); await p.keyboard.press('KeyE'); await p.waitForTimeout(400);
      ok(/E TANKSAVAR — başına geç/.test(pr2) && await seat(p) === 'Y-C-atgm-12', 'yeniden kurulan yuvaya E ile geçilir', pr2);
      await p.evaluate(() => { const g = window.__game, me = g.playerSoldier; if (me.veh) g.vehicles.exit(me); });
    }
    await p.context().close();
  }
}

// ───────────── ÇEVRİM DIŞI MOBİL (touch=1): araç düğmesi kutuda / yuvada görünür, dokununca RPG / başına geçer ─────────────
if (!ONLY || ONLY === 'mob') {
  const p = await open('autostart=4v4&map=kuzey&type=conquest&dev=1&cls=assault&touch=1', true);
  await p.evaluate(() => { const g = window.__game; g.devGod = true; g.brainsOff = g.brains.splice(0); g.playerSoldier.fly = false; for (const o of g.mode.objectives) o.owner = null; });
  const C = await p.evaluate(() => { const c = window.__game.supply.find((q) => q.of?.name === 'Kavşak'); return { x: c.x, y: c.y, z: c.z }; });
  await tpOff(p, C.x + 1.6, C.z); await look(p, C, -0.5); await p.waitForTimeout(700);
  const vb = await p.evaluate(() => { const b = document.querySelector('#tc .b[data-b="veh"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { hid: b.classList.contains('hid'), x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  ok(vb && !vb.hid, 'mobil: ikmal kutusunda araç / etkileşim düğmesi görünür', JSON.stringify(vb));
  const pr = await prompt(p);
  ok(/⟲ İKMAL — RPG al/.test(pr), 'mobil ipucu "⟲ İKMAL — RPG al"', pr);
  await p.screenshot({ path: `${OUT}/10-mobil-ikmal.png` });
  if (vb) { await p.touchscreen.tap(vb.x, vb.y); await p.waitForTimeout(600); }
  ok(/rpg:1\+2/.test(await items(p)), 'mobil: düğmeye dokununca RPG alındı', await items(p));
  const at = await p.evaluate(() => { const v = window.__game.vehicles.list.find((q) => q.id === 'Y-C-atgm-12'); return { x: v.st.x, z: v.st.z, b: v.st.base }; });
  await tpOff(p, at.x + Math.sin(at.b) * 1.9, at.z + Math.cos(at.b) * 1.9); await look(p, at, -0.4); await p.waitForTimeout(600);
  if (vb) { await p.touchscreen.tap(vb.x, vb.y); await p.waitForTimeout(600); }
  ok(await seat(p) === 'Y-C-atgm-12', 'mobil: düğmeyle tanksavarın başına geçti');
  await p.screenshot({ path: `${OUT}/11-mobil-tanksavar.png` });
  await p.context().close();
}

// ───────────── ÇEVRİM İÇİ: iki istemci (A mavi saldırı, B kırmızı mobil saldırı) ─────────────
if (!ONLY || ONLY === 'on') {
  const A = await open(`online=new&name=Ali&server=${encodeURIComponent(WS)}&map=kuzey&type=conquest&per=4&team=blue&cls=assault`);
  await A.evaluate(() => window.__game.online.send({ t: 'dbg', bots: false }));
  const room = new URL(A.url()).searchParams.get('online');
  const B = await open(`online=${room}&name=Bora&server=${encodeURIComponent(WS)}&team=red&cls=assault&touch=1`, true);
  await A.waitForTimeout(1500);
  const at = await A.evaluate(() => { const v = window.__game.vehicles.list.find((q) => q.id === 'Y-C-atgm-12'); return { x: v.st.x, z: v.st.z, b: v.st.base, idx: v.idx }; });
  // A: yürüyerek tanksavara, E (sunucu koltuğa alır)
  await A.evaluate((h) => window.__game.online.send({ t: 'dbg', tp: [h.x + Math.sin(h.b) * 5, h.z + Math.cos(h.b) * 5] }), at);
  await A.waitForTimeout(1200);
  await walkTo(A, at, 1.0, 3000); await look(A, at, -0.4); await A.waitForTimeout(400);
  const pa = await prompt(A);
  await A.keyboard.press('KeyE'); await A.waitForTimeout(900);
  ok(/E TANKSAVAR — başına geç/.test(pa) && await seat(A) === 'Y-C-atgm-12', 'çevrim içi A: yürüyerek ipucu + E ile tanksavar (sunucu koltuğu)', pa);
  await A.screenshot({ path: `${OUT}/12-cevrimici-tanksavar-basinda.png` });
  // B (düşman, mobil) aynı yuvaya: "dolu (düşman)"
  await B.evaluate((h) => window.__game.online.send({ t: 'dbg', tp: [h.x - Math.sin(h.b) * 1.2 + Math.cos(h.b) * 1.6, h.z - Math.cos(h.b) * 1.2 - Math.sin(h.b) * 1.6] }), at);
  await B.waitForTimeout(1500); await look(B, at, -0.3); await B.waitForTimeout(300);
  const pb = await prompt(B);
  ok(/TANKSAVAR — dolu \(düşman\)/.test(pb), 'çevrim içi B (düşman): "TANKSAVAR — dolu (düşman)"', pb);
  await B.screenshot({ path: `${OUT}/13-cevrimici-B-dolu.png` });
  await A.keyboard.press('KeyE'); await A.waitForTimeout(800);
  // yuvayı patlat (sunucu) → A'da "yeniden kuruluyor"
  await A.evaluate((i) => window.__game.online.send({ t: 'dbg', vdmg: [i, 9999, 'at'] }), at.idx);
  await A.waitForTimeout(1500); await look(A, at, -0.4);
  await A.evaluate((h) => window.__game.online.send({ t: 'dbg', tp: [h.x + Math.sin(h.b) * 1.9, h.z + Math.cos(h.b) * 1.9] }), at);
  await A.waitForTimeout(1200); const pd = await prompt(A);
  ok(/TANKSAVAR — yeniden kuruluyor · \d+ sn/.test(pd), 'çevrim içi: patlayan yuva "yeniden kuruluyor · N sn"', pd);
  // ikmal: A (mavi, masaüstü) Kavşak kutusundan RPG; B (kırmızı, mobil) aynı tarafsız kutudan dokunarak
  const C = await A.evaluate(() => { const c = window.__game.supply.find((q) => q.of?.name === 'Kavşak'); return { x: c.x, y: c.y, z: c.z }; });
  await A.evaluate((c) => window.__game.online.send({ t: 'dbg', tp: [c.x + 5, c.z] }), C);
  await A.waitForTimeout(1200);
  await walkTo(A, C, 1.4, 3000); await look(A, C, -0.55); await A.waitForTimeout(500);
  const pc = await prompt(A);
  await A.screenshot({ path: `${OUT}/14-cevrimici-ikmal-ipucu.png` });
  await A.keyboard.press('KeyE'); await A.waitForTimeout(1500);
  const ia = await items(A);
  ok(/E İKMAL — RPG al/.test(pc) && /rpg:1\+2/.test(ia), 'çevrim içi A: ipucu + E → sunucu RPG verdi (istemci eşyası eşitlendi)', `${pc} · ${ia}`);
  await A.evaluate((c) => window.__game.online.send({ t: 'dbg', tp: [c.x + 9, c.z] }), C);      // kutudan uzak (yanında sunucu atılan roketi 1,5 sn'de geri verir)
  await A.waitForTimeout(1000);
  await A.keyboard.press('Digit4'); await A.waitForTimeout(900);
  await A.evaluate((c) => { const me = window.__game.playerSoldier; me.yaw = Math.atan2(-(c.x - me.pos.x), -(c.z - me.pos.z)) + Math.PI; me.pitch = 0.05; }, C);
  await A.waitForTimeout(300);
  await A.mouse.move(640, 300); await A.mouse.down(); await A.waitForTimeout(120); await A.mouse.up(); await A.waitForTimeout(1200);
  const fa = await A.evaluate(() => { const me = window.__game.playerSoldier, it = me.items[2]; return [me.item.id, it.mag + it.reserve]; });
  ok(fa[0] === 'rpg' && fa[1] === 2, 'çevrim içi A: RPG elde, roket atıldı (sunucu cephanesi 3 → 2)', JSON.stringify(fa));
  await A.screenshot({ path: `${OUT}/15-cevrimici-rpg-atis.png` });
  await B.evaluate((c) => window.__game.online.send({ t: 'dbg', tp: [c.x - 1.5, c.z + 0.6] }), C);
  await B.waitForTimeout(1500); await look(B, C, -0.5); await B.waitForTimeout(400);
  const vb = await B.evaluate(() => { const b = document.querySelector('#tc .b[data-b="veh"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { hid: b.classList.contains('hid'), x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const pbm = await prompt(B);
  if (vb) { await B.touchscreen.tap(vb.x, vb.y); await B.waitForTimeout(1500); }
  const ib = await items(B);
  ok(vb && !vb.hid && /RPG al/.test(pbm) && /rpg:1\+2/.test(ib), 'çevrim içi B (mobil, kırmızı): tarafsız kutuda düğme + dokununca RPG', `${pbm} · ${ib}`);
  await B.screenshot({ path: `${OUT}/16-cevrimici-mobil-rpg.png` });
  await A.context().close(); await B.context().close();
}
if (errs.length) console.log('sayfa hataları:', errs.slice(0, 6));
ok(!errs.length, 'sayfa hatası yok');
await browser.close();
console.log(fails.length ? `SONUÇ: ${fails.length} HATA` : 'SONUÇ: OK');
process.exit(fails.length ? 1 : 0);
