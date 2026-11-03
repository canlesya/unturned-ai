// 12.226 Bomba modu bot davranışı (bot.js'e kancalar; yapı / mermi değişmez, yalnız botun kararı):
// · SALDIRAN: takım her raunt bir bölge seçer (bazen önce öbürüne SAHTE yüklenip döner, bazen 1–2 bot başka yoldan YARMA yapar). Önce bölgeye ~22 m kala
//   toplanma noktasında birleşir, çoğunluk gelince / süre geçince / temas olunca bölgeye girer. Taşıyan bot geride kalır, ötekiler önden girer; taşıyan
//   ölürse en yakın saldıran bot yerdeki bombayı alır. Bölgede (görüşte düşman yoksa) kurar; kurduktan sonra herkes bombanın çevresinde açı tutar.
//   Süre ≤ 45 sn: toplanma yok, doğrudan bölgeye.
// · SAVUNAN: raunt başında ikiye bölünür (5 kişide 2 A · 2 B · 1 gezgin), bölgede saldırının geleceği yöne bakan noktalarda çömelip bekler. Bir bölgede
//   temas olunca (düşman görüldü / savunan öldü) gezgin ve öbür bölgeden biri o bölgeye döner. Kurulunca herkes bombaya: kitlisi / en yakını imha eder
//   (düşman görüşteyse önce çatışır; süre yetmeyecekse bekleme yok), ötekiler çevresini korur.
import { TUNE } from './balance.js';
import { rand, clamp, angleDiff, yawFromDir, lerp } from './util.js';
import { BM_REACH } from './bomba.js';

// stageBack: toplanma noktası bölgeye bu kadar kala (yol boyunca m) · gatherK: saldıranların bu oranı toplanınca giriş · gatherT: en geç bu kadar sn sonra giriş ·
// fakeP / splitP: sahte yüklenme / yarma olasılığı · rushT: süre bu kadar kalınca doğrudan · holdR: kurulu bombanın çevresinde tutma uzaklığı · hotR: bölgede temas yarıçapı
export const BM_BOT = { stageBack: 22, gatherK: 0.6, gatherT: 28, fakeP: 0.22, splitP: 0.3, fakeT: 16, rushT: 45, holdR: [6, 13], hotR: 30, near: 3.2, retakeBack: 14, retakeLate: 24, retakeT: 0, backP: 0.65 };

const B_ = (g) => g.bomba;
const live = (s) => s && s.alive && !s.vacant;

// yol uzunluğu boyunca nokta: path (findPath çıktısı) üzerinde sondan back m geride
function alongBack(path, sx, sz, back) {
  if (!path || !path.length) return null;
  const P = [{ x: sx, z: sz }, ...path];
  let acc = 0;
  for (let i = P.length - 1; i > 0; i--) {
    const a = P[i], b = P[i - 1], L = Math.hypot(a.x - b.x, a.z - b.z);
    if (acc + L >= back) { const k = (back - acc) / (L || 1); return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, y: a.y ?? b.y }; }
    acc += L;
  }
  return { x: sx, z: sz };
}

// saldıranın bu tarafa ait bölge bilgisi (doğuştan yol, toplanma noktası, son yaklaşma yönü): taraf başına bir kez
function siteInfo(g, B, i) {
  const key = B.att + (B.swapped ? 1 : 0) + ':' + i, C = (B._bi ||= {});
  if (C[key]) return C[key];
  const s = B.sites[i], sp = g.map.spawns[B.att]?.[0];
  let path = null;
  if (sp) path = g.nav.findPath(sp.x, sp.z, s.x, s.z, 0.7, sp.y ?? 0, s.y);
  const st = alongBack(path, sp?.x ?? s.x, sp?.z ?? s.z, BM_BOT.stageBack) || { x: s.x, z: s.z };
  const ap = alongBack(path, sp?.x ?? s.x, sp?.z ?? s.z, 8) || st;
  const dx = ap.x - s.x, dz = ap.z - s.z, L = Math.hypot(dx, dz) || 1;
  // yarma yolu: bölgeye 12–40 m uzak, toplanma noktasından en uzak dolaşma noktası
  let split = null, bs = 0;
  for (const p of g.map.roamPoints || []) {
    const d = Math.hypot(p[0] - s.x, p[1] - s.z), e = Math.hypot(p[0] - st.x, p[1] - st.z);
    if (d < 12 || d > 40 || (p[2] !== undefined)) continue;
    if (e > bs) { bs = e; split = { x: p[0], z: p[1] }; }
  }
  if (split && bs < 14) split = null;
  return (C[key] = { st, dir: { x: dx / L, z: dz / L }, split, len: path ? path.length : 0 });
}

// bu rauntun takım planı (iki tarafın da): saldıran bölgesi / sahte / yarma; savunan dağılımı
function plan(g, B) {
  const P = B._plan;
  if (P && P.round === B.round && P.att === B.att && P.k === B._rk) return P;
  const n = B.sites.length, site = Math.floor(Math.random() * n);
  const fake = n > 1 && Math.random() < BM_BOT.fakeP ? (site + 1 + Math.floor(Math.random() * (n - 1))) % n : -1;
  const A = g.soldiers.filter((s) => !s.vacant && s.team === B.att), D = g.soldiers.filter((s) => !s.vacant && s.team === B.def);
  const split = new Set();
  if (Math.random() < BM_BOT.splitP && A.length >= 3) { const L = A.filter((s) => s.brain); for (let k = 0; k < Math.min(2, L.length - 1); k++) split.add(L.splice(Math.floor(Math.random() * L.length), 1)[0]?.id); }
  // savunan: karışık sıra; 3+ kişide 1 gezgin, kalanı iki bölgeye (fazlası rastgele bölgeye)
  const dl = [...D].sort(() => Math.random() - 0.5), role = new Map();
  let fl = dl.length >= 3 ? 1 : 0;
  const big = Math.random() < 0.5 ? 0 : 1;
  dl.forEach((s, i) => { if (fl && i === 0) { role.set(s.id, -1); return; } const j = i - (fl ? 1 : 0); role.set(s.id, n < 2 ? 0 : (j % 2 === 0 ? big : 1 - big)); });
  return (B._plan = { round: B.round, att: B.att, k: B._rk, site, fake, fakeOn: fake >= 0, split, role, go: false, goT: g.time + (B.prep ? Math.max(0, B.t) : 0), hot: -1, hotT: -99, rot: new Set(), picker: -1, spot: null });
}

// raunt içinde (0,5 sn'de bir, ilk bot): toplanma → giriş, sahteden dönüş, bölgede temas (savunan döner), yerdeki bombayı alacak bot
function teamTick(g, B, P) {
  if (g.time - (P._t ?? -9) < 0.5) return;
  P._t = g.time;
  const el = g.time - (B._r0 ?? 0) - 5;
  const site = P.fakeOn ? P.fake : P.site, I = siteInfo(g, B, site);
  if (P.fakeOn && (el > BM_BOT.fakeT || B.t < BM_BOT.rushT + 15)) { P.fakeOn = false; P.go = false; P.goT = g.time; for (const br of g.brains) if (br.s.team === B.att) br.goalT = Math.min(br.goalT, 0.3); }
  if (!P.go) {
    const A = g.soldiers.filter((s) => live(s) && s.team === B.att);
    const at = A.filter((s) => Math.hypot(s.pos.x - I.st.x, s.pos.z - I.st.z) < 12).length;
    if (B.t < BM_BOT.rushT || (A.length && at / A.length >= BM_BOT.gatherK) || g.time - P.goT > BM_BOT.gatherT || P.contact) {
      if (!P.fakeOn) { P.go = true; for (const br of g.brains) if (br.s.team === B.att) br.goalT = Math.min(br.goalT, 0.3); }
      else if (at / Math.max(1, A.length) >= BM_BOT.gatherK) { P.fakeOn = false; P.goT = g.time; }
    }
  }
  // yerdeki bomba: en yakın saldıran bot alır
  const b = B.bomb;
  if (b.st === 'dropped') {
    let best = null, bd = 1e9;
    for (const s of g.soldiers) { if (!live(s) || s.team !== B.att || !s.brain) continue; const d = Math.hypot(s.pos.x - b.x, s.pos.z - b.z); if (d < bd) { bd = d; best = s; } }
    if (best && best.id !== P.picker) { P.picker = best.id; best.brain.goalT = 0; }
  } else P.picker = -1;
  // geri alma (kurulunca): savunanlar bombaya ~14 m kala (kendi doğuşlarından gelen yolda) toplanır; ikisi gelince / süre daralınca / 12 sn geçince birlikte girer
  if (b.st === 'planted') {
    if (!P.rt) {
      const sp = g.map.spawns[B.def]?.[0];
      const path = sp ? g.nav.findPath(sp.x, sp.z, b.x, b.z, 0.7, sp.y ?? 0, b.y) : null;
      P.rt = { go: false, t0: g.time, st: alongBack(path, sp?.x ?? b.x, sp?.z ?? b.z, BM_BOT.retakeBack) || { x: b.x, z: b.z } };
    }
    if (!P.rt.go) {
      const D = g.soldiers.filter((s) => live(s) && s.team === B.def), need = Math.min(2, D.length);
      const at = D.filter((s) => Math.hypot(s.pos.x - P.rt.st.x, s.pos.z - P.rt.st.z) < 9 || Math.hypot(s.pos.x - b.x, s.pos.z - b.z) < 12).length;
      if (at >= need || B.t < BM_BOT.retakeLate || g.time - P.rt.t0 > BM_BOT.retakeT) { P.rt.go = true; for (const br of g.brains) if (br.s.team === B.def) br.goalT = Math.min(br.goalT, 0.3); }
    }
  }
  // ölümler (raunt başına bir kez): saldıran öldü = temas (toplanmadan gir) · savunan bölge yakınında öldü = o bölgede temas
  for (const s of g.soldiers) {
    if (s.alive || s.vacant || s._bmDeadR === B._rk) continue;
    s._bmDeadR = B._rk;
    if (s.team === B.att) P.contact = true;
    else if (b.st !== 'planted') for (const st of B.sites) if (Math.hypot(s.pos.x - st.x, s.pos.z - st.z) < BM_BOT.hotR) hot(g, B, P, st.i);
  }
  // bölgede temas: savunan bot düşman gördü → gezgin + öbür bölgeden biri döner
  if (b.st !== 'planted') for (const s of g.soldiers) {
    if (!live(s) || s.team !== B.def || !s.brain?.target?.alive) continue;
    const e = s.brain.target;
    for (const st of B.sites) if (Math.hypot(e.pos.x - st.x, e.pos.z - st.z) < BM_BOT.hotR) hot(g, B, P, st.i);
  }
}
function hot(g, B, P, i) {
  if (P.hot === i && g.time - P.hotT < 20) return;
  P.hot = i; P.hotT = g.time; P.rot = new Set();
  const D = g.soldiers.filter((s) => live(s) && s.team === B.def && s.brain);
  for (const s of D) if (P.role.get(s.id) === -1) P.rot.add(s.id);
  const others = D.filter((s) => P.role.get(s.id) !== -1 && P.role.get(s.id) !== i).sort((a, b) => Math.hypot(a.pos.x - B.sites[i].x, a.pos.z - B.sites[i].z) - Math.hypot(b.pos.x - B.sites[i].x, b.pos.z - B.sites[i].z));
  const keep = Math.max(1, others.length - Math.ceil(others.length / 2));
  for (let k = 0; k < others.length - keep; k++) P.rot.add(others[k].id);
  for (const s of D) if (P.rot.has(s.id)) s.brain.goalT = Math.min(s.brain.goalT, 0.3);
}
// bölge / bombanın çevresinde, yaklaşma yönüne bakan rastgele tutma noktası
function holdSpot(g, B, x, z, dir, r0, r1) {
  for (let k = 0; k < 8; k++) {
    const a = Math.atan2(dir.z, dir.x) + rand(-1.3, 1.3), r = rand(r0, r1);
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (g.nav.isFree(px, pz)) return { x: px, z: pz };
  }
  return { x: x + rand(-2, 2), z: z + rand(-2, 2) };
}

// her bot güncellemesinin başında (BotBrain.update). true: bu adım burada bitti
export function bmBrain(b, dt) {
  const g = b.game, s = b.s, B = B_(g);
  s.bmUse = false;
  if (B.prep) {
    s.vel.x = 0; s.vel.z = 0; s.ads = false; s.sprinting = false; b.goal = null; b.path = null; b.target = null;
    const e = B.sites[0] ? (s.team === B.att ? B.sites[(B._plan?.site ?? 0)] : null) : null;
    const tgt = e || g.map.spawns[s.team === 'blue' ? 'red' : 'blue']?.[0];
    if (tgt) s.yaw += clamp(angleDiff(s.yaw, yawFromDir(tgt.x - s.pos.x, tgt.z - s.pos.z)), -3 * dt, 3 * dt);
    return true;
  }
  if (!B.live) return false;
  const P = plan(g, B);
  teamTick(g, B, P);
  // açı tutma: duran bot (mevzide / toplanmada) hedef yoksa bekleme yönüne bakar (görüş konisi oraya); mevzideyken yeni gördüğü düşmana önceden nişanlı (tepki ×0,7)
  const still = Math.hypot(s.vel.x, s.vel.z) < 0.6;
  if (b.target && b.target !== b._bmT && b.perching && still) b.reactT *= 0.7;
  b._bmT = b.target;
  if (!b.target && b.bmLook && still) { s.yaw += clamp(angleDiff(s.yaw, yawFromDir(b.bmLook.x - s.pos.x, b.bmLook.z - s.pos.z)), -4 * dt, 4 * dt); }
  const bm = B.bomb;
  // yakın hedef (yerdeki bomba / imha): son metreleri yol ızgarasız doğrudan yürü, varınca kur / imha et
  let tx = null, tz = null, act = null;
  if (bm.st === 'dropped' && P.picker === s.id) { tx = bm.x; tz = bm.z; }
  else if (bm.st === 'carried' && bm.carrier === s && B.siteAt(s.pos) >= 0 && (P.go || B.t < BM_BOT.rushT || !P.fakeOn)) {
    const sp = P.spot, inSpot = !sp || Math.hypot(sp.x - s.pos.x, sp.z - s.pos.z) < 2.5 || (b.bmInSite = (b.bmInSite || 0) + dt) > 2.5;
    if (inSpot) act = 'plant';
  } else b.bmInSite = 0;
  if (bm.st === 'planted' && s.team === B.def && P.defuser === s.id) { tx = bm.x; tz = bm.z; }
  if (act !== 'plant' && tx === null) return false;
  const tg = b.target && b.target.alive ? b.target : null;
  const left = B.t, need = act === 'plant' ? 3 : B.defuseTime(s);
  const urgent = act !== 'plant' && bm.st === 'planted' && left < need + 1.5;
  if (tg && !urgent && !(bm.who === s && bm.prog > need * 0.6)) return false;        // önce tehdit (az kaldıysa / süre yetmiyorsa bırakmaz)
  if (tx !== null) {
    const dx = tx - s.pos.x, dz = tz - s.pos.z, d = Math.hypot(dx, dz);
    if (d > BM_BOT.near || Math.abs((bm.y ?? s.pos.y) - s.pos.y) > 1.5) return false;      // yol ızgarasıyla yaklaş (pickGoal hedefi)
    const reach = bm.st === 'planted' ? 0.75 : 0.6;                                 // 12.229 imha: bombanın dibine (diz çöküp elleri bombaya yetişsin; menzil BM_REACH 1,7)
    if (d > reach) {
      const sp = TUNE.walkSpeed * s.spd * 0.6, k = Math.min(1, dt * 10);
      s.vel.x = lerp(s.vel.x, (dx / (d + 1e-6)) * sp, k); s.vel.z = lerp(s.vel.z, (dz / (d + 1e-6)) * sp, k);
      s.sprinting = false; s.ads = false; s.crouching = false;
      s.yaw += clamp(angleDiff(s.yaw, yawFromDir(dx, dz)), -6 * dt, 6 * dt);
      return true;
    }
    if (bm.st !== 'planted') return false;
    act = 'defuse';
  }
  // kur / imha: dur, çömel, tuşu basılı tut; çevreyi kolla (görüş)
  s.vel.x = 0; s.vel.z = 0; s.sprinting = false; s.ads = false; s.crouching = true;
  b.senseT -= dt;
  if (b.senseT <= 0) { b.senseT = 0.22; b.sense(); }
  s.pitch += (-0.6 - s.pitch) * Math.min(1, dt * 5);
  s.bmUse = true;
  return true;
}

// BotBrain.pickGoal
export function bmPickGoal(b) {
  const g = b.game, s = b.s, B = B_(g), P = plan(g, B), bm = B.bomb;
  b.perching = false; b.via = null; b.spot = null; b.bmLook = null;
  if (s.team === B.att) {
    if (bm.st === 'planted') {                                                     // kurulu bombayı koru: çevresinde açı tut
      const I = siteInfo(g, B, bm.site), h = holdSpot(g, B, bm.x, bm.z, I.dir, BM_BOT.holdR[0], BM_BOT.holdR[1]);
      b.setGoal(h.x, h.z, rand(10, 18), bm.y); b.perching = true;
      const ds = g.map.spawns[B.def]?.[0];
      b.bmLook = Math.random() < 0.6 ? { x: bm.x, z: bm.z } : ds ? { x: ds.x, z: ds.z } : null;      // kurulu bombaya (imhacıya) ya da savunanın geleceği yöne
      return;
    }
    if (bm.st === 'dropped' && P.picker === s.id) { b.setGoal(bm.x, bm.z, 8, bm.y); return; }
    const car = bm.st === 'carried' ? bm.carrier : bm.st === 'dropped' ? null : null;
    const humanCar = car && !car.brain && car !== s;
    let si = P.fakeOn ? P.fake : P.site;
    if (humanCar) { let bd = 1e9; for (const st of B.sites) { const d = Math.hypot(st.x - car.pos.x, st.z - car.pos.z); if (d < bd) { bd = d; si = st.i; } } }
    const st = B.sites[si], I = siteInfo(g, B, si);
    const go = P.go || humanCar || B.t < BM_BOT.rushT;
    if (!go) {                                                                     // toplanma noktası (taşıyan biraz geride)
      const back = car === s ? 4 : 0, side = ((s.id % 3) - 1) * rand(1.5, 3.5);
      b.setGoal(I.st.x - I.dir.x * -back + -I.dir.z * side, I.st.z - I.dir.z * -back + I.dir.x * side, rand(6, 10));
      if (P.split.has(s.id) && I.split) b.via = { x: I.split.x, y: 0, z: I.split.z };
      return;
    }
    if (car === s) {                                                               // taşıyan: bölgede kurma noktası
      if (!P.spot || P.spotSite !== si) { const h = holdSpot(g, B, st.x, st.z, I.dir, 0, (st.r || 4) * 0.5); P.spot = h; P.spotSite = si; }
      b.setGoal(P.spot.x, P.spot.z, 14, st.y);
      return;
    }
    // eşlik: taşıyan geride kaldıysa onun önünde bekle, değilse bölgeye önden gir (tutma noktaları)
    if (car && car.alive && Math.hypot(car.pos.x - st.x, car.pos.z - st.z) > 30 && Math.hypot(s.pos.x - st.x, s.pos.z - st.z) < Math.hypot(car.pos.x - st.x, car.pos.z - st.z) - 12) {
      const dx = st.x - car.pos.x, dz = st.z - car.pos.z, L = Math.hypot(dx, dz) || 1;
      b.setGoal(car.pos.x + dx / L * 7 + rand(-3, 3), car.pos.z + dz / L * 7 + rand(-3, 3), rand(4, 7));
      return;
    }
    const h = holdSpot(g, B, st.x, st.z, { x: -I.dir.x, z: -I.dir.z }, 2, (st.r || 5) + 3);
    b.setGoal(h.x, h.z, rand(8, 14), st.y);
    if (P.split.has(s.id) && I.split && Math.hypot(s.pos.x - st.x, s.pos.z - st.z) > 30) b.via = { x: I.split.x, y: 0, z: I.split.z };
    return;
  }
  // ── savunan ──
  if (bm.st === 'planted') {
    // imha eden: kitlisi önce, sonra en yakın (canlı bot)
    const D = g.soldiers.filter((e) => live(e) && e.team === B.def);
    const hum = D.find((e) => !e.brain && Math.hypot(e.pos.x - bm.x, e.pos.z - bm.z) < 4);
    let df = null, bd = 1e9;
    if (!hum) for (const e of D) { if (!e.brain) continue; const d = Math.hypot(e.pos.x - bm.x, e.pos.z - bm.z) * (e.bmKit ? 0.6 : 1); if (d < bd) { bd = d; df = e; } }
    if (P.defuser === undefined || !D.some((e) => e.id === P.defuser)) P.defuser = df ? df.id : -1;
    if (P.rt && !P.rt.go && Math.hypot(s.pos.x - bm.x, s.pos.z - bm.z) > 12) {      // geri alma toplanması (teamTick): bombanın yolunda bekle
      const side = ((s.id % 3) - 1) * rand(1.5, 3);
      b.setGoal(P.rt.st.x + side + rand(-1.5, 1.5), P.rt.st.z - side + rand(-1.5, 1.5), rand(3, 5));
      return;
    }
    if (P.defuser === s.id) { b.setGoal(bm.x, bm.z, 10, bm.y); return; }
    const I = siteInfo(g, B, bm.site), h = holdSpot(g, B, bm.x, bm.z, I.dir, 4, 10);
    b.setGoal(h.x, h.z, rand(6, 10), bm.y);
    return;
  }
  let r = P.role.get(s.id);
  if (r === undefined) r = s.id % Math.max(1, B.sites.length);
  if (P.hot >= 0 && P.rot.has(s.id)) r = P.hot;
  if (r === -1) {                                                                  // gezgin: iki bölgenin arası, kendi doğuşuna doğru çekik (orta çizgide tek başına ölmesin; iki bölgeye de dönebilir)
    const A = B.sites[0], C = B.sites[1] || A, sp = g.map.spawns[B.def]?.[0] || A;
    const mx = (A.x + C.x) / 2 + (sp.x - (A.x + C.x) / 2) * 0.4, mz = (A.z + C.z) / 2 + (sp.z - (A.z + C.z) / 2) * 0.4;
    const near = (g.map.roamPoints || []).map((p) => ({ x: p[0], z: p[1], y: p[2], d: Math.hypot(p[0] - mx, p[1] - mz) })).filter((p) => p.y === undefined).sort((a, c) => a.d - c.d)[Math.floor(rand(0, 2))];
    const p = near || { x: mx, z: mz };
    b.setGoal(p.x + rand(-3, 3), p.z + rand(-3, 3), rand(10, 16)); b.perching = true;
    return;
  }
  const st = B.sites[r], I = siteInfo(g, B, r);
  // tutma noktası: çoğunlukla bölgenin ARKA yarısında (saldıran bölgeye girerken açıkta kalır), bazen giriş ağzına yakın pusu
  const back = Math.random() < BM_BOT.backP, R0 = st.r || 5;
  const h = back ? holdSpot(g, B, st.x, st.z, { x: -I.dir.x, z: -I.dir.z }, R0 * 0.3, R0 + 4) : holdSpot(g, B, st.x, st.z, I.dir, 2, R0 + 2);
  b.setGoal(h.x, h.z, rand(14, 24), st.y); b.perching = true;
  b.bmLook = { x: st.x + I.dir.x * (R0 + 10) + rand(-4, 4), z: st.z + I.dir.z * (R0 + 10) + rand(-4, 4) };      // saldırının geleceği giriş ağzı
}
