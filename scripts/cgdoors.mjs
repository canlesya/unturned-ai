// Çöl Geçidi açılı kapı kanatları testi (12.181; çevrimdışı oyun, tarayıcıda — sunucu aynı shootRay / World kodunu koşar).  node scripts/cgdoors.mjs
//   env: BASE=http://127.0.0.1:5180  SHOTS=klasör (bakış görüntüleri; silah / HUD gizli)  TESTS=0 (yalnız görüntü: eski sürümde de çalışır)
//   1 ateş   — her kanadın ortasından (3 m önünden) 2 m arkasındaki düşmana, her ışın silahıyla tek sapmasız mermi: hasar = kapısız aynı atış × TUNE.woodMul;
//              ışın gerçekten kanada çarpıyor (tag 'wood'), kanatta kıymık / iz, hedefte kan. Bot görüşü kanattan geçmez (kapısız geçer).
//   2 yürüme — kanadın iki yüzüne (dik ve koridor ekseni boyunca) yürü: oyuncu görünen levhanın ≤ 8 cm önünde durur (görünmez duvar yok), içinden geçmez.
//   3 geçiş  — kapının bir yanından öbürüne kanatlar arasından yürünür; bot yolu (nav) kapıdan geçer.
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = process.env.BASE || 'http://127.0.0.1:5180', SHOTS = process.env.SHOTS || '', TESTS = process.env.TESTS !== '0';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${BASE}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&nolock=1&tod=day`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await page.waitForTimeout(1200);
await page.evaluate(() => { const g = window.__game; g.brains.length = 0; let i = 0; for (const s of g.soldiers) if (!s.isPlayer) { s.pos.set(-500 - i++ * 4, 0, -500); s.vel.set(0, 0, 0); } });

if (TESTS) {
  const R = await page.evaluate(() => ({ leaves: window.__game.map.stats?.leaves || [] }));
  check(R.leaves.length === 6, `açılı kanat sayısı ${R.leaves.length} (Mid Doors, Long Doors (iç), Long Doors × 2)`);
  // silah tablosu modülden
  const W = await page.evaluate(async () => {
    const m = await import('/src/game/stats.js');
    window.__WS = m.WSTATS;
    return Object.entries(m.WSTATS).filter(([, s]) => s.dmg && !s.ball && !s.rocket && !s.impact && !s.melee && !s.throw && !s.mine && !s.heal && s.range).map(([k]) => k);
  });
  const res = await page.evaluate((W) => {
    const g = window.__game, V = g.camera.position.constructor, WS = window.__WS;
    const A = g.playerSoldier, T = g.soldiers.find((s) => s.team !== A.team);
    const rec = { decal: [], blood: [], spark: [] };
    for (const k of Object.keys(rec)) { const f = g.effects[k].bind(g.effects); g.effects[k] = (p, ...a) => { rec[k].push(p.clone ? p.clone() : p); return f(p, ...a); }; }
    const leaves = g.map.stats.leaves, out = { fire: [], sight: [], skipped: [] };
    const woodCols = (door) => g.world.colliders.filter((c) => c.oid === 'kapı:' + door && c.tag === 'wood');
    const hide = (cols) => { const keep = cols.map((c) => [c.min.slice(), c.max.slice()]); for (const c of cols) { c.min[1] = -900; c.max[1] = -899; } return () => cols.forEach((c, i) => { c.min[0] = keep[i][0][0]; c.min[1] = keep[i][0][1]; c.min[2] = keep[i][0][2]; c.max[0] = keep[i][1][0]; c.max[1] = keep[i][1][1]; c.max[2] = keep[i][1][2]; }); };
    for (const L of leaves) {
      const n = [-L.dir[1], L.dir[0]];
      for (const fr of [0.35, 0.65]) {
        const px = L.hinge[0] + L.dir[0] * L.len * fr, pz = L.hinge[1] + L.dir[1] * L.len * fr;
        for (const sd of [1, -1]) {
          const ax = px + n[0] * sd * 3, az = pz + n[1] * sd * 3, tx = px - n[0] * sd * 2, tz = pz - n[1] * sd * 2;
          const gy = g.world.heightAt(px, pz);
          A.pos.set(ax, g.world.heightAt(ax, az), az); A.vel.set(0, 0, 0); A.alive = true; A.protT = 0; A.rewindTick = null;
          T.pos.set(tx, g.world.heightAt(tx, tz), tz); T.vel.set(0, 0, 0); T.alive = true; T.protT = 0; T.hp = T.maxHp = 100000; T.height = 1.78; T.proneT = 0; T.vacant = false; T.leanOff?.set(0, 0, 0);
          const eye = new V(ax, gy + 1.6, az), aim = new V(tx, T.pos.y + 1.2, tz), dir = aim.clone().sub(eye).normalize();
          // ışın kanada çarpıyor mu (yolu üstünde başka katı yok mu)
          const h0 = g.world.raycast(eye, dir, 6, {});
          if (!h0 || !h0.collider || h0.collider.tag !== 'wood' || h0.collider.oid !== 'kapı:' + L.door) { out.skipped.push(`${L.door} ${fr} ${sd}: ${h0?.collider?.oid || (h0 ? 'zemin' : 'yok')}`); continue; }
          // bot görüşü
          const tEye = new V(tx, T.pos.y + 1.6, tz);
          const seeDoor = g.botSees(tEye, eye);
          const restore = hide(woodCols(L.door)); g.world.reindex?.(); const seeOpen = g.botSees(tEye, eye); restore(); g.world.reindex?.();
          if (!seeOpen) { out.skipped.push(`${L.door} ${fr} ${sd}: kapısız da kapalı`); continue; }       // hedef çizgisinde başka engel (bina köşesi): ölçülmez
          out.sight.push({ door: L.door, seeDoor, seeOpen });
          for (const id of W) {
            const st = WS[id];
            const shot = () => { const hp = T.hp; rec.decal.length = rec.blood.length = rec.spark.length = 0; g.shootRay(A, eye.clone(), dir.clone(), st, eye.clone()); return { d: hp - T.hp, decal: rec.decal.map((p) => p.distanceTo(h0.point)), blood: rec.blood.length }; };
            T.hp = 100000; const a = shot();
            const r2 = hide(woodCols(L.door)); g.world.reindex?.(); T.hp = 100000; const b = shot(); r2(); g.world.reindex?.();
            out.fire.push({ door: L.door, deg: L.deg, id, dDoor: a.d, dOpen: b.d, fx: Math.min(99, ...a.decal) < 0.05, blood: a.blood > 0 });
          }
        }
      }
    }
    return out;
  }, W);
  const TUNE = await page.evaluate(async () => (await import('/src/game/balance.js')).TUNE);
  const byW = new Map();
  for (const f of res.fire) { const k = f.id; const e = byW.get(k) || { n: 0, ok: 0, fx: 0, blood: 0, ratio: [] }; e.n++; const r = f.dOpen > 0 ? f.dDoor / f.dOpen : NaN; e.ratio.push(r); if (Math.abs(r - TUNE.woodMul) < 0.005) e.ok++; if (f.fx) e.fx++; if (f.blood) e.blood++; byW.set(k, e); }
  console.log(`ateş: ${res.fire.length} atış (${byW.size} silah × ${res.fire.length / Math.max(1, byW.size)} konum), atlanan konum ${res.skipped.length}`, res.skipped.slice(0, 4));
  for (const [k, e] of byW) check(e.ok === e.n && e.fx === e.n && e.blood === e.n, `${k.padEnd(10)} kapıdan geçer: hasar oranı ${[...new Set(e.ratio.map((r) => r.toFixed(3)))].join('/')} (woodMul ${TUNE.woodMul}) ${e.ok}/${e.n}, kanatta iz ${e.fx}/${e.n}, hedefte kan ${e.blood}/${e.n}`);
  check(res.sight.length > 0 && res.sight.every((s) => !s.seeDoor), `bot görüşü kanattan geçmez: ${res.sight.filter((s) => !s.seeDoor).length}/${res.sight.length}`);
  check(res.sight.every((s) => s.seeOpen), `aynı çizgi kapısız açık (engel kanat): ${res.sight.filter((s) => s.seeOpen).length}/${res.sight.length}`);

  // ── yürüme: kanada çarp ──
  const walk = await page.evaluate(() => {
    const g = window.__game, V = g.camera.position.constructor, R = 0.32, out = [];
    const sdRect = (L, x, z) => { const pu = x - L.hinge[0], pv = z - L.hinge[1], t = pu * L.dir[0] + pv * L.dir[1], nn = -pu * L.dir[1] + pv * L.dir[0]; const dx = Math.max(-t, t - L.len), dy = Math.abs(nn) - L.half; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0); };
    const sqDist = (L, x, z) => { let mn = 1e9; for (let i = 0; i <= 8; i++) for (const [a, b] of [[i / 8, 0], [i / 8, 1], [0, i / 8], [1, i / 8]]) mn = Math.min(mn, sdRect(L, x - R + 2 * R * a, z - R + 2 * R * b)); return mn; };
    const side = (L, x, z) => Math.sign(-(x - L.hinge[0]) * L.dir[1] + (z - L.hinge[1]) * L.dir[0]);
    for (const L of g.map.stats.leaves) {
      const n = [-L.dir[1], L.dir[0]];
      for (const fr of [0.3, 0.55, 0.8]) {
        const px = L.hinge[0] + L.dir[0] * L.len * fr, pz = L.hinge[1] + L.dir[1] * L.len * fr;
        for (const sd of [1, -1]) {
          const dirs = [[-n[0] * sd, -n[1] * sd], Math.abs(n[0]) > Math.abs(n[1]) ? [-Math.sign(n[0] * sd), 0] : [0, -Math.sign(n[1] * sd)]];
          for (const [dx, dz] of dirs) {
            const sx = px - dx * 1.4, sz = pz - dz * 1.4;
            const s = { pos: new V(sx, g.world.heightAt(sx, sz), sz), vel: new V(), height: 1.78, onGround: true };
            if (g.world._hits(g.world.query(sx - 1, sz - 1, sx + 1, sz + 1, []), sx, s.pos.y, sz, 1.78) || sqDist(L, sx, sz) < 0.05) continue;
            const s0 = side(L, sx, sz);
            for (let k = 0; k < 120; k++) { s.vel.x = dx * 5.6; s.vel.z = dz * 5.6; g.world.move(s, 1 / 60); }
            const d = sqDist(L, s.pos.x, s.pos.z), moved = Math.hypot(s.pos.x - sx, s.pos.z - sz);
            // durduğu yerde başka bir katıya mı dayandı (kanat değil) — o zaman ölçme
            const near = g.world.query(s.pos.x - 0.5, s.pos.z - 0.5, s.pos.x + 0.5, s.pos.z + 0.5, []).filter((c) => s.pos.x + R + 0.02 > c.min[0] && s.pos.x - R - 0.02 < c.max[0] && s.pos.z + R + 0.02 > c.min[2] && s.pos.z - R - 0.02 < c.max[2] && c.max[1] > s.pos.y + 0.3 && c.min[1] < s.pos.y + 1.7);
            const onLeaf = near.some((c) => c.oid === 'kapı:' + L.door && c.tag === 'wood');
            out.push({ door: L.door, deg: L.deg, fr, sd, dir: [+dx.toFixed(2), +dz.toFixed(2)], gap: +d.toFixed(3), crossed: side(L, s.pos.x, s.pos.z) !== s0, moved: +moved.toFixed(2), onLeaf, other: near.filter((c) => c.tag !== 'wood').map((c) => c.oid) });
          }
        }
      }
    }
    return out;
  });
  const wl = walk.filter((w) => w.onLeaf && !w.other.length);
  check(wl.length >= 24, `yürüme denemesi (kanada dayanan) ${wl.length} / ${walk.length}`);
  const maxGap = Math.max(...wl.map((w) => w.gap)), minGap = Math.min(...wl.map((w) => w.gap));
  check(maxGap <= 0.08, `görünmez duvar yok: oyuncu kutusu ile görünen levha arası en çok ${maxGap.toFixed(3)} m (≤ 0,08)`);
  check(walk.every((w) => !w.crossed), `kanattan sızma yok: ${walk.filter((w) => w.crossed).length} geçiş`);
  console.log(`      levhaya en çok gömülme ${(-minGap).toFixed(3)} m (görsel köşe payı ≤ 0,07)`);
  check(minGap >= -0.075, `levha içine gömülme ≤ 0,075 m (${(-minGap).toFixed(3)})`);

  // ── geçiş: kapının bir yanından öbürüne, kanatlar arasından ──
  const pass = await page.evaluate(() => {
    const g = window.__game, V = g.camera.position.constructor, out = [];
    const doors = [...new Set(g.map.stats.leaves.map((l) => l.door))];
    for (const door of doors) {
      const [L1, L2] = g.map.stats.leaves.filter((l) => l.door === door);
      const tip = (L) => [L.hinge[0] + L.dir[0] * L.len, L.hinge[1] + L.dir[1] * L.len];
      const t1 = tip(L1), t2 = tip(L2), gx = (t1[0] + t2[0]) / 2, gz = (t1[1] + t2[1]) / 2;
      const hx = (L1.hinge[0] + L2.hinge[0]) / 2, hz = (L1.hinge[1] + L2.hinge[1]) / 2;     // kapı ortası (duvar düzlemi)
      const vx = gx - hx, vz = gz - hz, vl = Math.hypot(vx, vz), ux = vx / vl, uz = vz / vl;      // açılma yönü
      const pts = [[hx - ux * 4, hz - uz * 4], [hx, hz], [gx, gz], [gx + ux * 4, gz + uz * 4]];
      for (const rev of [false, true]) {
        const P = rev ? [...pts].reverse() : pts;
        const s = { pos: new V(P[0][0], g.world.heightAt(P[0][0], P[0][1]), P[0][1]), vel: new V(), height: 1.78, onGround: true };
        let wi = 1, t = 0;
        for (; t < 600 && wi < P.length; t++) {
          const dx = P[wi][0] - s.pos.x, dz = P[wi][1] - s.pos.z, d = Math.hypot(dx, dz);
          if (d < 0.25) { wi++; continue; }
          s.vel.x = (dx / d) * 5.6; s.vel.z = (dz / d) * 5.6; g.world.move(s, 1 / 60);
        }
        const path = g.nav.findPath(P[0][0], P[0][1], P[3][0], P[3][1]);
        let len = 0; if (path) { const q = [{ x: P[0][0], z: P[0][1] }, ...path, { x: P[3][0], z: P[3][1] }]; for (let i = 1; i < q.length; i++) len += Math.hypot(q[i].x - q[i - 1].x, q[i].z - q[i - 1].z); }
        out.push({ door, rev, reached: wi >= P.length, sec: +(t / 60).toFixed(2), gap: +Math.hypot(t1[0] - t2[0], t1[1] - t2[1]).toFixed(2), nav: !!path, navLen: +len.toFixed(1), straight: +Math.hypot(P[3][0] - P[0][0], P[3][1] - P[0][1]).toFixed(1) });
      }
    }
    return out;
  });
  for (const p of pass) {
    check(p.reached, `${p.door}${p.rev ? ' (ters)' : ''}: kanatlar arasından yürünür (${p.sec} sn; uçlar arası ${p.gap} m)`);
    check(p.nav && p.navLen < p.straight * 1.6 + 2, `${p.door}${p.rev ? ' (ters)' : ''}: bot yolu kapıdan geçer (${p.navLen} m, düz ${p.straight} m)`);
  }
}

// ── görüntüler ──
if (SHOTS) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const VIEWS = JSON.parse(process.env.VIEWS || JSON.stringify([
    ['d1-mid-kapi-mid', -7.75, 2.0, -15.5, 0, -0.08], ['d2-mid-kapi-ct', -7.4, 1.9, -28.5, 3.14, -0.05], ['d3-mid-kapi-yuksek', -6.0, 6.5, -13.5, 0.12, -0.5],
    ['d4-long-kapi-dis', 27.5, 3.7, 29.5, 0, -0.06], ['d5-long-oda', 27.3, 3.6, 14.5, 0, -0.05], ['d6-long-ic-long', 27.3, 3.6, -0.5, 3.14, -0.05], ['d7-long-oda-geri', 27.3, 3.6, 12, 3.14, -0.05],
    ['w1-duvar-ustu', -10.3, 9.2, 21.0, 0, -0.15], ['w2-mid-goz', -6.5, 3.6, 27, 0.25, 0.02], ['w3-mid-kus', 4, 16, 34, 0.45, -0.42], ['w4-tunel-agzi', -5, 1.6, -14.5, 1.57, 0.12], ['w5-mid-ct-tarafi', -7, 1.7, -4, 3.14, 0.12],
  ]));
  await page.evaluate(() => { const g = window.__game; g.hud.root.style.display = 'none'; g.player.vm.render = () => {}; g.playerSoldier.fly = true; });
  for (const [nm, x, y, z, yaw, pitch] of VIEWS) {
    await page.evaluate(([x, y, z, yaw, pitch]) => { const s = window.__game.playerSoldier; s.fly = true; s.pos.set(x, y - 1.6, z); s.vel.set(0, 0, 0); s.yaw = yaw; s.pitch = pitch; }, [x, y, z, yaw, pitch]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOTS}/${nm}.png` });
  }
  console.log('görüntüler', SHOTS, VIEWS.length);
}
check(errs.length === 0, `sayfa hatası ${errs.length} ${errs.slice(0, 2).join(' | ')}`);
console.log(fail ? `${fail} HATA` : 'HEPSİ OK');
await browser.close();
process.exit(fail ? 1 : 0);
