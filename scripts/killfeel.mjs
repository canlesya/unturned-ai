// 12.233 Öldürme hissi testi (başsız, < 60 sn): ölüm animasyonu, kafadan öldürme (kask uçar, işaret, ses), elden düşen silah, ölenin kamerası, çevrim içi düşüş kodu.
//   node --import ./scripts/lib/pw-quiet.mjs scripts/killfeel.mjs [off,net]     (BASE=http://127.0.0.1:5180 WS=ws://127.0.0.1:8787 SHOTS=/tmp/wb-killfeel)
//   off: çevrimdışı Çöl Geçidi, açık düz bir yerde bot; bilinen yönden kafaya / gövdeye / bombayla / arkası duvarken öldürülür. Denetim: biçim + düşüş yönü
//        (baş, itiş yönünde), animasyon sonunda gövdenin en alt noktası zeminde (±6 cm), baş duvarın içinde değil, silah yerde, kask uçtu (havuz), kafadan
//        işaret (iri X) + öldürme / kafa sesi sayacı, yeni gölgelendirici programı yok (12.232 ön ısıtma), doğunca silah ele / kask başa döner; oyuncu ölünce kamera devrilir.
//   net: BF_DEBUG=1 sunucu, iki tarayıcı istemcisi aynı odada. A, önündeki botu kafadan vurur ({dmg}): 'kill' olayında `da` alanı (kafa / geri), iki istemci de aynı düşüşü oynar.
// Görüntüler (SHOTS): 1 geriye düşüş ortası, 2 kask uçuşu, 3 patlamayla savrulma, 4 kafadan öldürme işareti + bildirim, 5 yerde son poz (+ düşen silah)
import fs from 'fs';
import { chromium } from 'playwright';

const parts = (process.argv[2] || 'off,net').split(',');
const BASE = process.env.BASE || process.env.URL || 'http://127.0.0.1:5180', WS = process.env.WS || process.env.WSURL || 'ws://127.0.0.1:8787';
const OUT = process.env.SHOTS || '/tmp/wb-killfeel';
fs.mkdirSync(OUT, { recursive: true });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const T0 = Date.now();
const browser = await chromium.launch();
const errs = [];
const newPage = async () => { const p = await browser.newPage({ viewport: { width: 960, height: 540 } }); p.on('pageerror', (e) => errs.push(e.message)); return p; };

// sayfaya yardımcılar (açık yer bulma, gövde ölçümü)
const HELP = () => {
  const g = window.__game, W = g.world, V = g.playerSoldier.pos.constructor;
  const H = (window.__kf = {});
  H.inside = (p) => W.query(p.x - 0.01, p.z - 0.01, p.x + 0.01, p.z + 0.01, []).some((c) => p.x > c.min[0] && p.x < c.max[0] && p.y > c.min[1] && p.y < c.max[1] && p.z > c.min[2] && p.z < c.max[2]);
  H.open = (seed) => {
    let sd = seed; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let k = 0; k < 4000; k++) {
      const x = (rnd() - 0.5) * 120, z = (rnd() - 0.5) * 120, y = W.heightAt(x, z);
      let ok = Math.abs(W.groundAt(x, z) - y) < 0.05;
      for (let a = 0; a < 12 && ok; a++) { const d = new V(Math.cos(a * 0.524), 0, Math.sin(a * 0.524)); for (const h of [0.4, 1.1]) if (W.raycast(new V(x, y + h, z), d, 10, {})) ok = false; if (Math.abs(W.heightAt(x + d.x * 4, z + d.z * 4) - y) > 0.25) ok = false; }
      if (ok && !W._hits(W.query(x - 1, z - 1, x + 1, z + 1, []), x, y + 0.05, z, 1.8)) return [x, z];
    }
    return null;
  };
  // gövde ölçümü: en alt nokta − zemin, başın itiş yönündeki uzaklığı, baş duvarda mı, silah yerde mi
  H.body = (s, ix, iz) => {
    const D = s._dth, m = s.model, root = m.root;
    root.updateMatrixWorld(true);
    const mn = g.deathFx._minY(root), hp = m.parts.head.getWorldPosition(new V());
    const r = s._wd, w = r && r.w;
    return { st: D?.st, fd: D?.fd, st0: D?.st0, zone: D?.zone, dt: s.deadT, dur: D?.dur, gap: mn - D?.gnd, headUp: hp.y - D?.gnd, headAlong: (hp.x - s.pos.x) * ix + (hp.z - s.pos.z) * iz,
      headIn: H.inside(hp), wInScene: !!w && w.parent === g.scene, wDone: !!r?.done, wGap: w ? w.position.y - r.floor : null, corr: D?.corr };
  };
};

if (parts.includes('off')) {
  const page = await newPage();
  await page.goto(`${BASE}/?autostart=3v3&map=colgecidi&type=tdm&dev=1&debug=1&nolock=1`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 60000 });
  await page.evaluate(HELP);
  const spot = await page.evaluate(() => {
    const g = window.__game, me = g.playerSoldier;
    g.brainsOff = g.brains.splice(0); g.devGod = true; me.fly = false;
    for (const e of g.soldiers) if (e !== me && e.team === me.team) { e.alive = false; e.model.root.visible = false; e.respawnT = 1e9; }
    for (const e of g.soldiers) if (e.team !== me.team) e.respawnT = 1e9;
    window.__prog0 = g.renderer.info.programs.length;
    return window.__kf.open(4242);
  });
  check(!!spot, `açık düz yer bulundu ${JSON.stringify(spot)}`);
  // bot: S'de, yaw 0 (−z'ye bakar). Atıcı (oyuncu) vuruş yönünü belirler; kamera sonra yana alınabilir
  const kill = (o) => page.evaluate(([S, o]) => {
    const g = window.__game, me = g.playerSoldier, W = g.world;
    const pick = () => g.soldiers.filter((e) => e.team !== me.team).sort((a, b) => (b.model.hatMeshes?.length || 0) - (a.model.hatMeshes?.length || 0))[0];
    const B = (window.__B ||= pick());
    const bx = o.bx ?? S[0], bz = o.bz ?? S[1];
    if (!B.alive || B.downed) B.spawn({ x: bx, z: bz, ry: o.yaw ?? 0 }, 0);
    B.pos.set(bx, W.groundAt(bx, bz), bz); B.vel.set(o.vx || 0, 0, 0); B.yaw = o.yaw ?? 0; B.bodyYaw = B.yaw; B.pitch = 0; B.protT = 0; B.onGround = true;
    B.prone = false; B.proneT = 0; B.crouching = false; B.crouchT = 0; delete B.update;
    const fx = bx + o.from[0], fz = bz + o.from[1];
    const cx = bx + (o.cam ? o.cam[0] : o.from[0]), cz = bz + (o.cam ? o.cam[1] : o.from[1]);
    me.pos.set(cx, W.groundAt(cx, cz), cz); me.vel.set(0, 0, 0); me.yaw = Math.atan2(-(bx - cx), -(bz - cz)); me.pitch = o.pitch ?? -0.12;
    return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {       // modeli bir kare canlı pozda çiz (başlangıç pozu)
      const hp0 = g.sfx.evN ? { ...g.sfx.evN } : null, pops = g.deathFx.stats.pops, drops = g.deathFx.stats.drops;
      B.takeDamage(9999, me, o.zone || 'body', { x: fx, y: B.pos.y + 1.2, z: fz }, o.w || 'M4A1');
      const len = Math.hypot(o.from[0], o.from[1]);
      res({ id: B.id, alive: B.alive, hp0, ix: -o.from[0] / len, iz: -o.from[1] / len, pops, drops, code: B.dCode });
    })));
  }, [spot, o]);
  const waitT = (t) => page.waitForFunction((t) => window.__B.deadT >= t, t, { timeout: 15000 });
  const freeze = () => page.evaluate(() => { const B = window.__B, f = window.__game.deathFx; B.update = function () {}; f._upd = f.update; f.update = () => {}; return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
  const thaw = () => page.evaluate(() => { const B = window.__B, f = window.__game.deathFx; delete B.update; if (f._upd) { f.update = f._upd; delete f._upd; } });
  const body = (k) => page.evaluate((k) => window.__kf.body(window.__B, k.ix, k.iz), k);
  const rest = async (k) => { await page.waitForFunction(() => { const B = window.__B; return B._dth && B.deadT > B._dth.dur + 0.6; }, null, { timeout: 15000 }); return body(k); };
  const STN = ['düz', 'dizüstü', 'kafa', 'patlama', 'bıçak', 'yüzüstü', 'duvar dibi'], FDN = ['geri', 'ileri', 'sol', 'sağ'];
  const desc = (b) => `${STN[b.st]}/${FDN[b.fd]} · kök +${b.corr?.toFixed(3)} · en alt nokta − zemin ${(b.gap * 100).toFixed(1)} cm · baş itiş yönünde ${b.headAlong.toFixed(2)} m, yerden ${b.headUp.toFixed(2)} m`;
  const ground = (b, msg) => { check(Math.abs(b.gap) < 0.06 && b.headUp < 0.55 && !b.headIn, `${msg}: yerde yatıyor (${desc(b)}, baş duvarda: ${b.headIn})`); };

  // 1) kafadan, önden (oyuncu önünde 8 m): işaret + bildirim + ses, kask uçar, geriye devrilir
  let k = await kill({ zone: 'head', from: [0, -8], w: 'M4A1' });
  await waitT(0.1);
  const fx1 = await page.evaluate(() => { const g = window.__game; return { hm: g.killfx.lastHm, ev: { ...g.sfx.evN }, nt: g.killfx.nt.textContent, pops: g.deathFx.stats.pops, last: g.deathFx.stats.last, hats: g.deathFx.hats.filter((h) => h.owner === window.__B).length, hidden: (window.__B.model.hatMeshes || []).every((m) => m.geometry.drawRange.count === m.userData.hatStart), cross: g.hud.$('cross').classList.contains('kfl'), feedHs: !!g.hud.$('killfeed').lastElementChild?.querySelector('svg') }; });
  await page.screenshot({ path: `${OUT}/4-kafadan-isaret.png` });
  check(!k.alive && (k.code >> 11 & 3) === 1 && (k.code >> 8 & 7) === 2 && (k.code >> 6 & 3) === 0, `kafadan önden: kod kafa / geri (da=${k.code})`);
  check(fx1.hm?.hs && fx1.hm.s > 1.8, `kafadan öldürme işareti: iri kırmızı X (ölçek ${fx1.hm?.s})`);
  check(fx1.ev.killHs === (k.hp0.killHs || 0) + 1 && fx1.ev.kill === (k.hp0.kill || 0), `ses: kafadan öldürme onayı çaldı (killHs ${k.hp0.killHs}→${fx1.ev.killHs}, düz öldürme ${fx1.ev.kill})`);
  check(/KAFADAN/i.test(fx1.nt), `ortada bildirim: "${fx1.nt.slice(0, 40)}"`);
  check(fx1.cross, 'artı öldürmede kırmızı yandı');
  check(fx1.pops === k.pops + 1 && fx1.hats === 1 && fx1.hidden, `kask kafadan ayrıldı (havuz parçası ${fx1.hats}, kafa ağında gizli ${fx1.hidden})`);
  let b = await rest(k);
  ground(b, 'kafadan önden');
  check(b.headAlong > 0.8, `kafadan önden: baş itiş yönünde (atıcıdan uzağa) ${b.headAlong.toFixed(2)} m`);
  check(b.wInScene && b.wDone && Math.abs(b.wGap) < 0.02, `silah elden düşüp yere oturdu (zemin farkı ${b.wGap?.toFixed(3)})`);
  const hat1 = await page.evaluate(() => { const h = window.__game.deathFx.hats.find((x) => x.owner === window.__B); return h ? { done: h.done, y: h.g.position.y, floor: h.floor, d: Math.hypot(h.g.position.x - window.__B.pos.x, h.g.position.z - window.__B.pos.z) } : null; });
  check(hat1 && hat1.done && Math.abs(hat1.y - hat1.floor) < 0.02 && hat1.d > 0.6, `kask yere düştü (${hat1 ? hat1.d.toFixed(2) : '-'} m ötede)`);

  // 2) kafadan, kamera yanda: kask uçuşu görüntüsü
  k = await kill({ zone: 'head', from: [0, -8], cam: [-4.2, -0.8], w: 'M4A1' });
  await waitT(0.26); await freeze();
  await page.screenshot({ path: `${OUT}/2-kask-ucusu.png` });
  await thaw();
  b = await rest(k); ground(b, 'kafadan (2)');

  // 3) gövdeden, önden, koşarken: düz geriye devrilme (orta an görüntüsü + son poz)
  k = await kill({ zone: 'body', from: [0, -8], cam: [-4.2, -0.6], vx: 3, w: 'M4A1' });
  await waitT(0.42); await freeze();
  await page.screenshot({ path: `${OUT}/1-geriye-dusus.png` });
  const mid = await body(k);
  await thaw();
  check(mid.st === 0 && mid.fd === 0 && mid.headUp > 0.7, `gövdeden önden: düz geriye devriliyor, ortada baş ${mid.headUp.toFixed(2)} m yukarıda`);
  b = await rest(k); ground(b, 'gövdeden önden');
  check(b.headAlong > 0.8, `gövdeden önden: baş itiş yönünde ${b.headAlong.toFixed(2)} m`);
  await page.screenshot({ path: `${OUT}/5-son-poz.png` });

  // 4) gövdeden, arkadan: öne (ya da dizüstü öne) düşer
  k = await kill({ zone: 'body', from: [0, 8], cam: [5.5, 1.5], vx: 3, w: 'M4A1' });
  b = await rest(k); ground(b, 'gövdeden arkadan');
  check(b.fd === 1 && b.headAlong > 0.7, `gövdeden arkadan: ${STN[b.st]} öne, baş itiş yönünde ${b.headAlong.toFixed(2)} m`);

  // 5) bomba (önünde 1,5 m): savrulur + yuvarlanır
  k = await kill({ zone: 'body', from: [0, -1.5], cam: [-4.8, 0.8], w: 'El Bombası' });
  await waitT(0.3); await freeze();
  const fl = await body(k);
  await page.screenshot({ path: `${OUT}/3-patlama-savrulma.png` });
  await thaw();
  b = await rest(k);
  const tr = await page.evaluate(() => { const B = window.__B, r = B.model.root; return Math.hypot(r.position.x - B.pos.x, r.position.z - B.pos.z); });
  check(b.st === 3 && fl.headUp > 0.5, `bomba: savrulma biçimi, havada (orta an baş ${fl.headUp.toFixed(2)} m)`);
  ground(b, 'bomba'); check(tr > 1.0 && b.headAlong > 1.5, `bomba: itiş yönünde ${tr.toFixed(2)} m savruldu, baş ${b.headAlong.toFixed(2)} m`);

  // 6) arkası duvar: geriye düşmez (dizüstü / yana / duvar dibi), baş duvarda değil
  const wall = await page.evaluate(() => {
    const g = window.__game, W = g.world;
    for (const c of W.colliders) {
      if (c.max[1] - c.min[1] < 2.5 || c.max[0] - c.min[0] < 3) continue;
      const x = (c.min[0] + c.max[0]) / 2, z = c.max[2] + 0.45, y = W.heightAt(x, z);
      if (Math.abs(y - c.min[1]) > 0.3 || Math.abs(W.groundAt(x, z) - y) > 0.05) continue;
      if (W._hits(W.query(x - 1, z - 1, x + 1, z + 1, []), x, y + 0.05, z, 1.8)) continue;
      const V = g.playerSoldier.pos.constructor; let ok = true;
      for (const h of [0.5, 1.2]) if (W.raycast(new V(x, y + h, z), new V(0, 0, 1), 9, {})) ok = false;      // önü (+z) açık: atıcı orada
      if (ok) return [x, z];
    }
    return null;
  });
  if (wall) {
    k = await kill({ zone: 'body', bx: wall[0], bz: wall[1], yaw: Math.PI, from: [0, 8], vx: 3, w: 'M4A1' });   // −z'de duvar, bot +z'ye (atıcıya) bakar → itiş geri (duvara)
    b = await rest(k);
    check(!(b.st === 0 && b.fd === 0) && !b.headIn, `arkası duvar: ${STN[b.st]}/${FDN[b.fd]} (geriye devrilmedi), baş duvarda değil`);
    check(Math.abs(b.gap) < 0.08, `arkası duvar: en alt nokta zeminde (${(b.gap * 100).toFixed(1)} cm)`);
  } else check(false, 'duvar dibi yer bulunamadı');

  // 7) doğunca: silah ele, kask başa; yeni gölgelendirici programı yok
  const rs = await page.evaluate(() => {
    const g = window.__game, B = window.__B;
    B.spawn({ x: B.pos.x, z: B.pos.z, ry: 0 }, 0);
    return { inHand: B.model.weapon?.parent === B.model.parts.mount, hat: (B.model.hatMeshes || []).every((m) => m.geometry.drawRange.count === Infinity), pool: g.deathFx.hats.filter((h) => h.owner === B).length, sims: g.deathFx.sims.length, prog: g.renderer.info.programs.length - window.__prog0 };
  });
  check(rs.inHand && rs.hat && rs.pool === 0, `doğunca silah elde (${rs.inHand}), kask başta (${rs.hat}), havuz boş`);
  check(rs.prog === 0, `yeni gölgelendirici programı: ${rs.prog} (ölüm efektleri mevcut malzemeleri kullanır)`);

  // 8) oyuncu ölür (önden): kamera gövdeyle geriye devrilir (gökyüzüne bakar, göz yere iner)
  const pc = await page.evaluate(([S]) => new Promise((res) => {
    const g = window.__game, me = g.playerSoldier, W = g.world, B = window.__B;
    B.pos.set(S[0], W.groundAt(S[0], S[1] - 8), S[1] - 8);
    me.pos.set(S[0], W.groundAt(S[0], S[1]), S[1]); me.yaw = 0; me.pitch = 0; me.vel.set(0, 0, 0);
    requestAnimationFrame(() => {
      const y0 = g.camera.position.y; g.devGod = false; me.protT = 0;
      me.vel.set(3, 0, 0); me.takeDamage(9999, B, 'body', B.pos, 'M4A1');      // koşarken: düz biçim (dizüstü çöküş durana özgü rastgele)
      const t0 = performance.now(), pts = [];
      const tick = () => { pts.push([me.deadT, g.camera.position.y - y0, g.camera.rotation.x]); if (me.deadT < 1.0 && performance.now() - t0 < 8000) requestAnimationFrame(tick); else res({ st: me._dth?.st, fd: me._dth?.fd, pts: pts.filter((p, i) => i % 6 === 0 || i === pts.length - 1) }); };
      requestAnimationFrame(tick);
    });
  }), [spot]);
  const last = pc.pts[pc.pts.length - 1], early = pc.pts.find((p) => p[0] > 0.12) || last;
  check(pc.fd === 0 && last[1] < -0.9 && last[2] > 0.5 && early[1] > -0.6, `oyuncu ölümü: kamera yumuşakça devrilir (0,12 sn: ${early[1].toFixed(2)} m · 1 sn: ${last[1].toFixed(2)} m aşağı, bakış ${last[2].toFixed(2)} rad yukarı)`);
  await page.evaluate(() => { const g = window.__game; g.devGod = true; });
  await page.close();
}

if (parts.includes('net')) {
  const q = `map=colgecidi&type=tdm&per=3&server=${encodeURIComponent(WS)}&debug=1&nolock=1`;
  const A = await newPage();
  await A.goto(`${BASE}/?online=new&name=Ali&${q}`);
  await A.waitForFunction('window.__game && window.__game.running && window.__game.online && window.__game.playerSoldier.alive', null, { timeout: 45000 });
  const room = new URL(A.url()).searchParams.get('online');
  const Bp = await newPage();
  await Bp.goto(`${BASE}/?online=${room}&name=Veli&server=${encodeURIComponent(WS)}&debug=1&nolock=1`);
  await Bp.waitForFunction('window.__game && window.__game.running && window.__game.online', null, { timeout: 45000 });
  const rec = () => { const g = window.__game; window.__kills = []; const o = g.onNetEvents.bind(g); g.onNetEvents = (l) => { for (const e of l) if (e.e === 'kill') window.__kills.push(e); return o(l); }; };
  await A.evaluate(rec); await Bp.evaluate(rec);
  await A.evaluate(HELP);
  const S = await A.evaluate(() => window.__kf.open(777));
  const vid = await A.evaluate((S) => {
    const g = window.__game, me = g.playerSoldier;
    g.online.send({ t: 'dbg', bots: false, god: 1 });
    g.online.send({ t: 'dbg', tp: [S[0], S[1]] });
    const v = g.soldiers.find((e) => e.team !== me.team && e.alive && !e.netHuman && !e.vacant);
    g.online.send({ t: 'dbg', tps: [v.id, S[0], S[1] + 6, 0, 100] });      // bot A'nın 6 m önünde (+z), A'ya (−z) bakar
    return v.id;
  }, S);
  await A.waitForFunction(([id, z]) => { const v = window.__game.soldiers[id]; return Math.abs(v.pos.z - z) < 0.3 && Math.abs(window.__game.playerSoldier.pos.z - (z - 6)) < 0.5; }, [vid, S[1] + 6], { timeout: 10000 });
  await A.waitForTimeout(250);
  await A.evaluate((id) => window.__game.online.send({ t: 'dbg', dmg: [id, 9999, 1] }), vid);
  const res = await Promise.all([A, Bp].map((p) => p.waitForFunction((id) => { const v = window.__game.soldiers[id]; return !v.alive && v._dth && v.deadT > v._dth.dur + 0.4; }, vid, { timeout: 15000 }).then(() => p.evaluate((id) => {
    const g = window.__game, v = g.soldiers[id], hp = v.model.parts.head.getWorldPosition(new v.pos.constructor());
    const ev = window.__kills.find((e) => e.v === id);
    return { da: ev?.da ?? null, hs: ev?.hs, code: v._dth.code, st: v._dth.st, fd: v._dth.fd, along: hp.z - v.pos.z, up: hp.y - v._dth.gnd, pops: g.deathFx.stats.pops, me: g.playerSoldier.id };
  }, vid))));
  const [ra, rb] = res, da = ra.da;
  check(Number.isInteger(da) && (da >> 11 & 3) === 1 && (da >> 8 & 7) === 2 && (da >> 6 & 3) === 0, `çevrim içi: 'kill' olayında da=${da} (kafa / kafadan biçimi / geri), hs=${ra.hs}`);
  check(rb.da === da && ra.code === da && rb.code === da, `iki istemci aynı kodu oynuyor (A ${ra.code}, B ${rb.code})`);
  check(ra.fd === rb.fd && ra.st === rb.st && ra.along > 0.8 && rb.along > 0.8, `iki istemcide aynı düşüş: ${ra.st}/${ra.fd} ↔ ${rb.st}/${rb.fd}, baş atıcıdan uzakta (${ra.along.toFixed(2)} / ${rb.along.toFixed(2)} m), yerde (${ra.up.toFixed(2)} / ${rb.up.toFixed(2)} m)`);
  check(ra.pops >= 1 && rb.pops >= 1, `iki istemcide de kask uçtu (${ra.pops} / ${rb.pops})`);
  await A.screenshot({ path: `${OUT}/6-cevrimici-kafadan.png` });
  await A.close(); await Bp.close();
}

await browser.close();
const bad = errs.filter((e) => !/WebSocket|ResizeObserver/.test(e));
check(!bad.length, `sayfa hatası yok${bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''}`);
console.log(`${fail ? 'HATA' : 'TAMAM'} killfeel · ${((Date.now() - T0) / 1000).toFixed(1)} sn · görüntüler ${OUT}`);
process.exit(fail ? 1 : 0);
