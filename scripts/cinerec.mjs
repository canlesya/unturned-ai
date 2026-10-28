// 12.217 Kuzey Vadisi tanıtım videosu — çekim kaydı (gerçek GPU, 1920×1080, kare kare 60 fps + oyun sesi).
// Maç gerçek botlarla oynanır; yönetmen betiği yalnız sahne garantisi için maçı yönlendirir (helikopter saldırı turu, iki helikopteri aynı bayrağa,
// keskin nişancıyı kule platformuna). Her çekim OUT/<oturum>/<NN-ad>/f*.jpg + meta.json + ses.wav.
//   (vite :5204 açıkken) SESSION=gold node scripts/cinerec.mjs     · SESSION=night · ONLY=heli,tank (yalnız bu çekimler)
import { openCine, grab } from './cinelib.mjs';
import fs from 'fs';

const SESSION = process.env.SESSION || 'gold', ROOT = process.env.OUT || '/tmp/wb-cine/shots', OUT = `${ROOT}/${SESSION}`;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const CFG = {
  gold: { per: 128, tod: 'sunset', hour: 17.6, warm: 38, seed: 1217, audio: 600 },
  night: { per: 64, tod: 'night', warm: 70, seed: 4242, audio: 240 },
}[SESSION];
// çekimler: ad, kare (60 fps), bekleme (oyun sn), yönlendirme (bir kez), ring: hedef araç patlayana dek kaydet
const SHOTS = {
  gold: [
    { n: 'bayrak', f: 390, wait: 90 },
    { n: 'acilis', f: 420 },
    { n: 'genis', f: 420 },
    { n: 'heli', f: 360, wait: 60 },
    { n: 'tank', f: 330, wait: 60 },
    { n: 'jip', f: 270, wait: 60 },
    { n: 'motor', f: 300, wait: 60 },
    { n: 'saldiri', f: 450, wait: 150, steer: 'strike' },
    { n: 'duello', f: 420, wait: 120, steer: 'pair' },
    { n: 'kule', f: 330, wait: 90, steer: 'hmg' },
    { n: 'keskin', f: 300, wait: 60, steer: 'sniper', gap: 0 },
    { n: 'durbun', f: 270, wait: 40 },
    { n: 'manga', f: 360, wait: 60 },
    { n: 'patlama', f: 1500, wait: 90, ring: true, tries: 6 },
    { n: 'kapanis', f: 480 },
  ],
  night: [
    { n: 'gece-tank', f: 360, wait: 60 },
    { n: 'gece-genis', f: 360, wait: 60 },
  ],
}[SESSION];

fs.mkdirSync(OUT, { recursive: true });
const { browser, page, errs } = await openCine({ per: CFG.per, tod: CFG.tod, seed: CFG.seed, audio: CFG.audio });
await page.evaluate(({ hour }) => {
  const g = window.__game;
  if (hour) g.map.fx.setHour(hour, g);
  g.sfx.setVolume(0.9);
  const S = (window.CS = { used: new Set(), booms: [] });
  g.on('vehboom', (e) => S.booms.push({ v: e.v, t: g.time }));
  const VL = () => g.vehicles.list;
  const drv = (v) => v.alive && v.st && v.seats[0] && !v.def.fixed && !v.seats[0].isPlayer;
  const sp = (v) => Math.hypot(v.st.vx, v.st.vz);
  const agl = (s) => s.pos.y - g.world.heightAt(s.pos.x, s.pos.z);
  const fresh = (x) => !S.used.has(x);
  const near = (x, z, r, f = () => true) => g.soldiers.filter((s) => s.alive && Math.hypot(s.pos.x - x, s.pos.z - z) < r && f(s)).length;
  const hot = () => { const L = g.heat.list(g.time).sort((a, b) => b[2] - a[2]); return L; };
  const best = (arr, sc) => { let b = null, bs = -1e9; for (const x of arr) { const s = sc(x); if (s > bs) { bs = s; b = x; } } return bs > -1e8 ? b : null; };
  S.agl = agl;
  // ── yönlendirme (maçı sahne için hazırla; davranış botların kendi kodu) ──
  S.steer = {
    strike() {                                                                         // her takımın havadaki bir helikopteri: saldırı turu şimdi
      for (const team of ['blue', 'red']) {
        const b = g.brains.find((q) => q.vd?.kind === 'heli' && q.s.team === team && q.s.veh?.st?.air && (q.vd.state === 'cruise' || q.vd.state === 'orbit'));
        if (b) { b.vd.strikeAt = g.time; b.vd.mode = 'patrol'; }
      }
      return 'ok';
    },
    pair() {                                                                           // mavi helikopterin devriye bayrağına kırmızı saldırı turu
      const H = g.brains.filter((q) => q.vd?.kind === 'heli' && q.s.veh?.alive && q.s.veh.st.air && q.vd.state !== 'rtb' && q.vd.state !== 'land');
      for (const [A, B] of [['blue', 'red'], ['red', 'blue']]) {
        const d = H.find((q) => q.s.team === A), a = H.find((q) => q.s.team === B);
        if (!d || !a) continue;
        const fh = g.map.spawns[B][0];
        const own = g.mode.objectives.filter((o) => o.owner === A).sort((p, q) => Math.hypot(p.x - fh.x, p.z - fh.z) - Math.hypot(q.x - fh.x, q.z - fh.z));
        if (!own.length) continue;
        const F = own[0];
        d.vd.mode = 'patrol'; d.vd.pIdx = 0; d.vd.pNext = false; d.vd.strikeAt = g.time + 999;
        a.vd.mode = 'strike'; a.vd.strikeO = F; a.vd.dives = 0; a.vd.strikeT0 = g.time; a.vd.strikeAt = g.time;
        return F.name;
      }
      return null;
    },
    sniper() {                                                                         // sıcak bölgeye en yakın kulenin platformuna bir keskin nişancı
      const L = hot(); const T = g.map.towers || []; if (!T.length) return null;
      const h = L[0] || [0, 0];
      const tw = best(T, (t) => -Math.hypot(t.x - h[0], t.z - h[1]));
      const p = tw.perch[0];
      const sn = best(g.soldiers.filter((s) => s.alive && !s.veh && s.brain && !s.isPlayer && s.cls === 'sniper'), (s) => -Math.hypot(s.pos.x - tw.x, s.pos.z - tw.z));
      if (!sn) return null;
      sn.pos.set(p.x, p.y, p.z); sn.vel.set(0, 0, 0);
      sn.brain.setGoal(p.x, p.z, 120, p.y); sn.brain.perching = true; sn.brain.via = null;
      S.sniper = sn; S.tower = tw; S.perch = p;
      return { id: sn.id, d: Math.round(Math.hypot(tw.x - h[0], tw.z - h[1])) };
    },
    hmg() { return 'yok'; },
  };
  // keskin nişancı çekimi boyunca kule platformunda kalsın (nişan / atış botun kendi kararı)
  S.hold = () => { const s = S.sniper, p = S.perch; if (!s || !p || !s.alive || s.veh) return; const b = s.brain; if (Math.hypot(s.pos.x - p.x, s.pos.z - p.z) > 0.7 || !b.perching) { b.setGoal(p.x, p.z, 60, p.y); b.perching = true; b.via = null; } };
  // ── bulucular: sahne hazırsa cine.cut seçenekleri ──
  S.find = {
    acilis() { const o = g.mode.objectives.find((q) => q.name === 'Kavşak') || g.mode.objectives[0]; return { p: { x: o.x, z: o.z }, type: 'wide', r: 230, h: 95, w: 0.022, dr: -16, dh: -5, fov: 50, ly: 0 }; },
    genis() {
      const L = hot().filter((c) => near(c[0], c[1], 70) >= 9);
      const c = L[0]; if (!c) return null;
      return { p: { x: c[0], z: c[1] }, type: 'wide', r: 85, h: 38, w: 0.045, fov: 50, dr: -2 };
    },
    heli() { const v = best(VL().filter((v) => drv(v) && v.def.heli && v.st.air && sp(v) > 14 && fresh(v)), (v) => sp(v) + (v.seats[1] ? 5 : 0)); return v && { v, type: 'chase', d: 15, h: 3.2, lead: 30, lag: 7, tk: 16, x: 2.5, fov: 50, turn: 2 }; },
    tank() { const v = best(VL().filter((v) => drv(v) && v.type === 'tank' && sp(v) > 3.5 && fresh(v)), (v) => sp(v) + near(v.st.x, v.st.z, 40) * 0.2); return v && { v, type: 'low', ahead: 2.6, off: 7.5, h: 0.45, fov: 42 }; },
    jip() { const v = best(VL().filter((v) => drv(v) && v.type === 'jip' && sp(v) > 8 && fresh(v)), (v) => v.seats.filter(Boolean).length * 3 + sp(v) * 0.3); return v && { v, type: 'side', d: 8.5, h: 1.3, f: 2, slide: -0.9, lead: 3, fov: 46, lag: 6 }; },
    motor() { const v = best(VL().filter((v) => drv(v) && v.def.moto && sp(v) > 10 && fresh(v)), (v) => sp(v) + (v.seats[1] ? 6 : 0)); return v && { v, type: 'chase', d: 6.5, h: 1.6, lead: 10, x: 0.8, lag: 5, fov: 56, turn: 3 }; },
    saldiri() {
      const b = best(g.brains.filter((q) => q.vd?.kind === 'heli' && q.vd.mode === 'strike' && q.vd.atk && q.s.veh?.alive && q.s.veh.st.air), (q) => (q.vd.atk.v ? 10 : 0) + (q.vd.atk.n || 0));
      return b && { v: b.s.veh, type: 'heliTop', d: 16, h: 9, x: 6, lead: 30, down: 26, fov: 60, lag: 3, turn: 1.4 };
    },
    duello() {
      const H = VL().filter((v) => drv(v) && v.def.heli && v.st.air);
      let bp = null, bd = 115;
      for (const a of H) for (const b of H) { if (a.team !== 'blue' || b.team !== 'red') continue; const d = Math.hypot(a.st.x - b.st.x, a.st.z - b.st.z); if (d < bd) { bd = d; bp = [a, b]; } }
      return bp && { v: bp[0], v2: bp[1], type: 'pair', ots: true, d: 24, x: 8, h: 5, fov: 52, lag: 4, tk: 10 };
    },
    kule() {
      const E = VL().filter((v) => v.alive && v.def.fixed && v.type === 'hmg' && v.spawn.tower && v.seats[0] && !v.seats[0].isPlayer);
      const v = best(E, (v) => (v.seats[0].brain?.target ? 10 : 0) + near(v.st.x, v.st.z, 120, (s) => s.team !== v.seats[0].team) * 0.3);
      if (!v) return null;
      return { v, type: 'orbit', r: 9, h: 0.6, w: 0.12, ly: 0.3, fov: 46, snapT: true };
    },
    keskin() { const s = S.sniper; if (!s || !s.alive || s.veh || agl(s) < 4) return null; return { s, type: 'sniper', d: 2.3, x: 0.85, h: 0.35, fov: 40, side: 1, snapT: true }; },
    durbun() { const s = S.sniper; S.dw = (S.dw || 0) + 1; if (!s || !s.alive || s.veh || (!s.brain?.target && S.dw < 8)) return null; return { s, type: 'scope', fov: 6.5, snapT: true }; },
    manga() {
      let best0 = null, bs = 0;
      for (const s of g.soldiers) {
        if (!s.alive || s.veh || s.isPlayer || Math.hypot(s.vel.x, s.vel.z) < 1.2 || !fresh(s)) continue;
        const n = g.soldiers.filter((q) => q.alive && !q.veh && q.team === s.team && q.squad === s.squad && Math.hypot(q.pos.x - s.pos.x, q.pos.z - s.pos.z) < 16).length;
        if (n > bs) { bs = n; best0 = s; }
      }
      if (bs >= 3) {                                                                   // grubun en arkasındakini izle (diğerleri önde kadrajda)
        const G = g.soldiers.filter((q) => q.alive && !q.veh && q.team === best0.team && q.squad === best0.squad && Math.hypot(q.pos.x - best0.pos.x, q.pos.z - best0.pos.z) < 16);
        let vx = 0, vz = 0; for (const q of G) { vx += q.vel.x; vz += q.vel.z; }
        best0 = best(G, (q) => -(q.pos.x * vx + q.pos.z * vz));
      }
      return bs >= 3 ? { s: best0, type: 'squad', d: 5.5, h: 1.5, x: 1.2, lead: 14, fov: 58, lag: 4, turn: 2 } : null;
    },
    bayrak() {
      const o = best(g.mode.objectives.filter((o) => g.capRate(o) !== 0 && Math.abs(o.p) < 0.9 && o.nb + o.nr >= 3), (o) => o.nb + o.nr);
      if (!o) return null;
      return { p: { x: o.x, z: o.z, y: (o.y ?? g.world.heightAt(o.x, o.z)) + 3 }, type: 'orbit', r: 15, h: 2.5, w: 0.13, fov: 54, flag: o.name };
    },
    patlama() {
      const v = best(VL().filter((v) => drv(v) && !v.def.fixed && fresh(v) && (v.type === 'tank' || (v.def.heli && v.st.air)) && g.time - v.lastHitT < 8), (v) => (v.def.heli ? 8 : 0) + (v.seats[0].brain?.vd?.mode === 'strike' ? 6 : 0) + near(v.st.x, v.st.z, 90, (s) => s.team !== v.team) * 0.15);
      if (!v) return null;
      v.hp = Math.min(v.hp, v.def.hp * (v.def.heli ? 0.16 : 0.12));             // yönlendirme: çatışmadaki aracı hasarlı başlat (bir sonraki gerçek isabet düşürür)
      return v.def.heli ? { v, type: 'chase', d: 24, h: 6, lead: 25, lag: 3, x: 4, fov: 52, keepDead: true, hold: true } : { v, type: 'orbit', r: 17, h: 4, w: 0.1, fov: 48, keepDead: true, hold: true };
    },
    kapanis() { const L = hot(); const c = L[0] || [0, 0]; return { p: { x: c[0], z: c[1] }, type: 'wide', r: 70, h: 30, w: -0.03, dr: 22, dh: 14, fov: 50 }; },
    'gece-tank'() { const v = best(VL().filter((v) => drv(v) && v.type === 'tank' && fresh(v)), (v) => sp(v) + near(v.st.x, v.st.z, 80, (s) => s.team !== v.team)); return v && { v, type: sp(v) > 3 ? 'side' : 'orbit', d: 11, h: 1.5, r: 15, w: 0.1, fov: 46, lag: 5 }; },
    'gece-genis'() { const L = hot().filter((c) => near(c[0], c[1], 60) >= 10); const c = L[0]; return c && { p: { x: c[0], z: c[1] }, type: 'wide', r: 60, h: 25, w: 0.05, fov: 48 }; },
  };
}, { hour: CFG.hour || 0 });

const skip = (s) => page.evaluate((s) => window.__game.cine.skip(s), s);
console.log(`[${SESSION}] ${CFG.per}v${CFG.per} ${CFG.tod} — ısınma ${CFG.warm} sn`);
await skip(CFG.warm);

const meta = [];
let fi = 0;
for (const S of SHOTS) {
  fi++;
  if (ONLY && !ONLY.includes(S.n)) continue;
  const dir = `${OUT}/${String(fi).padStart(2, '0')}-${S.n}`;
  fs.rmSync(dir, { recursive: true, force: true });
  if (S.steer) console.log(' yönlendirme', S.steer, JSON.stringify(await page.evaluate((k) => window.CS.steer[k](), S.steer)));
  let info = null, waited = 0;
  for (let tries = 0; tries < (S.tries || 1); tries++) {
    for (;;) {
      info = await page.evaluate((n) => {
        const g = window.__game, C = window.CS, o = C.find[n]();
        if (!o) return null;
        const sh = g.cine.cut({ dur: 1e9, ...o });
        if (!sh) return null;
        if (o.v) C.used.add(o.v); if (o.s) C.used.add(o.s);
        C.cur = o; C.boom0 = C.booms.length;
        return { type: o.type, v: o.v ? `${o.v.type}#${o.v.idx} ${o.v.team} hp${Math.round(o.v.hp)}` : null, s: o.s ? `${o.s.cls}#${o.s.id}` : null, flag: o.flag || null, t: Math.round(g.time) };
      }, S.n);
      if (info || waited >= (S.wait || 0)) break;
      await skip(2); waited += 2;
    }
    if (!info) break;
    // ses: aradaki (ileri sarma) seslerin birikmesi sessizce işlenir, sonra açılır
    await page.evaluate(async () => { const A = window.__aud, g = window.__game; if (!A) return; const m = g.sfx.master.gain, t = A.ctx.currentTime; m.cancelScheduledValues(t); m.setValueAtTime(0, t); await A.adv(3); const t2 = A.ctx.currentTime; m.setValueAtTime(0, t2); m.linearRampToValueAtTime(g.sfx.volume, t2 + 0.06); window.__ov = []; });
    const a0 = await page.evaluate(() => window.__aud?.cur() || 0);
    console.log(` ${S.n}: ${JSON.stringify(info)} (bekleme ${waited} sn)`);
    let n = 0, boomAt = -1;
    const hook = S.n === 'keskin' || S.n === 'durbun' ? '(g) => window.CS.hold()' : null;
    if (!S.ring) n = await grab(page, dir, 0, S.f, { onFrame: hook });
    else {
      while (n < S.f) {
        n = await grab(page, dir, n, 30);
        const st = await page.evaluate(() => { const C = window.CS, v = C.cur.v; return { boom: C.booms.slice(C.boom0).some((b) => b.v === v), alive: !!v?.alive, hp: Math.round(v?.hp || 0) }; });
        if (st.boom && boomAt < 0) { boomAt = n; console.log(`  PATLADI kare ${n}`); }
        if (boomAt >= 0 && n - boomAt >= 230) break;
        if (boomAt < 0 && (!st.alive || n >= 900)) break;                                  // başka nedenle gitti / 15 sn'de patlamadı → sonraki aday
      }
    }
    const ov = await page.evaluate(() => window.__ov);
    const a1 = await page.evaluate(() => window.__aud?.cur() || 0);
    const m = { n: S.n, dir, frames: n, boomAt, info, a0, a1, ov };
    fs.writeFileSync(`${dir}/meta.json`, JSON.stringify(m));
    if (!S.ring || boomAt >= 0) { meta.push(m); break; }
    console.log(`  patlamadı (${n} kare), yeni aday`);
    fs.rmSync(dir, { recursive: true, force: true });
    await skip(3);
  }
  if (!info) console.log(` ${S.n}: BULUNAMADI`);
  await skip(S.gap ?? 4);
}
// ses: oturum sonu → her çekimin ses dilimi
const hasAud = await page.evaluate(async () => (window.__aud ? await window.__aud.finish() : 0));
if (hasAud) for (const m of meta) {
  const b64 = await page.evaluate(({ a, b }) => window.__aud.wav(a, b), { a: m.a0, b: m.a1 });
  fs.writeFileSync(`${m.dir}/ses.wav`, Buffer.from(b64, 'base64'));
}
const prev = (() => { try { return JSON.parse(fs.readFileSync(`${OUT}/oturum.json`, 'utf8')).shots || []; } catch (e) { return []; } })();
const all = [...prev.filter((p) => !meta.some((m) => m.n === p.n)), ...meta.map(({ ov, ...r }) => r)].sort((a, b) => a.dir.localeCompare(b.dir));
fs.writeFileSync(`${OUT}/oturum.json`, JSON.stringify({ session: SESSION, cfg: CFG, shots: all }, null, 1));
console.log('çekimler', meta.map((m) => `${m.n}:${m.frames}`).join(' '));
if (errs.length) console.log('sayfa hataları:', [...new Set(errs)].slice(0, 6));
await browser.close();
