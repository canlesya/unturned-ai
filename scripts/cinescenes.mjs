// 12.221 savaş videoları için sahne yönlendirme + çekim bulucuları (scripts/cinerec.mjs SESSION=gece | tank | yogun). Sayfada çalışır (window.CS).
// Davranış botların kendi kodu (helikopter saldırı dalışı + roket, tank topu, RPG / C4, kule makinelisi); burada yalnız sahne kurulur:
//  · saldırı: bir helikopter (kapı nişancıları dolu) düşman bayrağına saldırı turunda tutulur (tur bitince yeniden), çekim boyunca canı %75 üstünde
//  · konvoy: düşman jip / tankları (mürettebatıyla) saldırı bayrağının çevresine taşınır ("düşmanları yolda topla")
//  · tank düellosu: iki takımın birer tankı açık arazide 110–150 m arayla karşı karşıya konur, mevzide (hold) tutulur
//  · RPG: tanksavarlı bir düşman piyade düşman tankının 35–55 m yanına konur; C4: mühendis tankın 6 m yanına
export function installScenes() {
  const g = window.__game, S = window.CS, VL = () => g.vehicles.list;
  const alive = (v) => v && v.alive && v.st;
  const drv = (v) => alive(v) && v.seats[0] && !v.def.fixed && !v.seats[0].isPlayer;
  const sp = (v) => Math.hypot(v.st.vx, v.st.vz);
  const H = (x, z) => g.world.heightAt(x, z);
  const best = (arr, sc) => { let b = null, bs = -1e9; for (const x of arr) { const s = sc(x); if (s > bs) { bs = s; b = x; } } return bs > -1e8 ? b : null; };
  const nearN = (x, z, r, f = () => true) => g.soldiers.filter((s) => s.alive && Math.hypot(s.pos.x - x, s.pos.z - z) < r && f(s)).length;
  const brainOf = (v) => v.seats[0]?.brain;
  const free = (x, z, r = 4, skip = null) => !g.world.query(x - r, z - r, x + r, z + r, []).some((c) => !c.nocar && c.max[1] > H(x, z) + 0.6) && VL().every((o) => o === skip || !alive(o) || Math.hypot(o.st.x - x, o.st.z - z) > r + 3);
  const flat = (x, z, r = 5) => { const h = H(x, z); return [[r, 0], [-r, 0], [0, r], [0, -r]].every(([a, b]) => Math.abs(H(x + a, z + b) - h) < 1.2); };
  S.H = H;
  // kahraman helikopter çekim boyunca düşmesin: canı %45'in altına inmez (yalnız kayıtta; sınırsız cephane / ölümsüz pilot yok)
  { const V = g.vehicles, dmg = V.damage.bind(V); V.damage = (v, a, ...r) => { if (v === S.hv && !S.letDie && v.alive) a = Math.min(a, Math.max(0, v.hp - v.def.hp * 0.45)); return dmg(v, a, ...r); }; }
  // aracı (x, z)'ye taşı, yaw yönüne; sürücüsü yeniden plan yapsın
  S.place = (v, x, z, yaw) => {
    const st = v.st; st.x = x; st.z = z; st.y = H(x, z) + 0.6; st.vx = st.vy = st.vz = 0; st.yaw = yaw; if (v.def.turret) st.tyaw = yaw; st.air = false;
    for (const s of v.seats) if (s) { g.vehicles.place?.(s); }
    const b = brainOf(v); if (b?.vd) { b.vd.state = 'plan'; b.vd.route = null; }
  };
  // yarıçap içinde boş, düz nokta (açı taraması)
  S.spot = (cx, cz, r0, r1, ok = () => true, skip = null, fr = 4) => {
    for (let k = 0; k < 120; k++) {
      const a = Math.random() * Math.PI * 2, r = r0 + Math.random() * (r1 - r0), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (free(x, z, fr, skip) && flat(x, z, Math.min(5, fr + 1)) && ok(x, z)) return { x, z, a };
    }
    return null;
  };

  // ── saldırı helikopteri ──
  S.heliB = (q) => q.vd?.kind === 'heli' && alive(q.s.veh) && q.s.veh.seats[0] === q.s;
  S.strike = (team = 'blue') => {
    const HB = g.brains.filter((q) => S.heliB(q) && q.s.team === team && q.s.veh.st.air && q.vd.state !== 'rtb' && q.vd.state !== 'land' && q.vd.state !== 'emerg');
    const b = best(HB, (q) => q.s.veh.seats.filter(Boolean).length * 2 + (q.s.veh.seats[1] ? 3 : 0) + (q.s.veh.seats[2] ? 3 : 0) + q.s.veh.hp / q.s.veh.def.hp * 4 - (q.vd.tOff != null && q.vd.t - q.vd.tOff > 200 ? 8 : 0));      // uçuşun sonundaki (üsse dönecek) değil
    if (!b) return null;
    const v = b.s.veh, en = team === 'blue' ? 'red' : 'blue';
    // hedef bayrak: düşmanın olan / tartışmalı, düşman askeri en kalabalık (helikoptere yakınlık ikinci ölçüt)
    const O0 = g.mode.objectives.filter((o) => o.owner !== team), OP = O0.filter((o) => ['Köy', 'Kavşak', 'Çiftlik', 'Fabrika', 'Baraj'].includes(o.name)), O = OP.length ? OP : O0;
    const PREF = { 'Köy': 6, 'Kavşak': 6, 'Çiftlik': 5, 'Fabrika': 4, 'Baraj': 3 };      // açık bayraklar (orman / tepe değil): yerden ve havadan görünür
    const F = best(O, (o) => { const n = nearN(o.x, o.z, 110, (s) => s.team === en && !s.veh); return (S.flagPref ? (o.name === S.flagPref ? 50 : 0) : 0) + (PREF[o.name] || -4) + Math.min(n, 14) * 0.8 - (n < 4 ? 12 : 0) + (o.owner === en ? 4 : 0) - Math.hypot(o.x - v.st.x, o.z - v.st.z) / 200; });
    if (!F) return null;
    const vd = b.vd; vd.mode = 'strike'; vd.strikeO = F; vd.dives = 0; vd.strikeT0 = g.time; vd.strikeAt = g.time; if (vd.state === 'orbit') vd.state = 'cruise';
    v.hp = Math.max(v.hp, v.def.hp * 0.9);
    S.hv = v; S.hb = b; S.F = F; S.team = team; S.keepFly = true;
    return { v: v.idx, flag: F.name, crew: v.seats.map((s) => (s ? s.cls[0] : '-')).join(''), d: Math.round(Math.hypot(F.x - v.st.x, F.z - v.st.z)), en: nearN(F.x, F.z, 90, (s) => s.team === en) };
  };
  // her kare: kahraman helikopter saldırıda kalsın (tur bitince aynı bayrağa yeniden), canı düşmesin (geri çekilmesin)
  S.keepStrike = () => {
    const v = S.hv, b = S.hb; if (!alive(v) || !b || v.seats[0] !== b.s) { if ((S.reT = (S.reT || 0) - 1) <= 0) { S.reT = 60; S.strike(S.team || 'blue'); } return; }      // kahraman gitti: yenisini seç
    const vd = b.vd;
    if (S.F && S.F.owner === S.team) { const O = g.mode.objectives.filter((o) => o.owner !== S.team); S.F = best(O, (o) => -Math.hypot(o.x - v.st.x, o.z - v.st.z) - (['Köy', 'Kavşak', 'Çiftlik', 'Fabrika', 'Baraj'].includes(o.name) ? 0 : 600)) || S.F; }
    if (vd.mode !== 'strike' && (vd.state === 'cruise' || vd.state === 'orbit')) { vd.mode = 'strike'; vd.strikeO = S.F; vd.dives = 0; vd.strikeT0 = g.time; vd.strikeAt = g.time; if (vd.state === 'orbit') vd.state = 'cruise'; }
    if ((vd.state === 'rtb' || vd.state === 'land') && S.keepFly && v.st.air) { vd.state = 'cruise'; vd.tOff = vd.t; }
    if (v.hp < v.def.hp * 0.75 && !S.letDie) v.hp = v.def.hp * 0.75;
    if (vd.mode === 'strike' && (vd.dives || 0) >= 2) vd.dives = 0;
  };
  // konvoy: düşman araçlarını (mürettebatlı) saldırı bayrağının çevresine (yol / açık alan) taşı
  S.convoy = (n = 4, hpK = 0.6) => {
    const F = S.F; if (!F) return null;
    const en = S.team === 'blue' ? 'red' : 'blue', out = [];
    const C = VL().filter((v) => drv(v) && !v.def.heli && v.team === en && v.seats[0].team === en && (v.type === 'tank' || v.type === 'jip'))
      .sort((a, b) => (a.type === 'tank' ? -1 : 0) - (b.type === 'tank' ? -1 : 0) || b.seats.filter(Boolean).length - a.seats.filter(Boolean).length);
    let nt = 0;
    for (const v of C) {
      if (out.length >= n) break;
      if (v.type === 'tank' && nt >= 2) continue;
      const p = S.spot(F.x, F.z, 12, 55); if (!p) continue;
      S.place(v, p.x, p.z, Math.random() * Math.PI * 2);
      v.hp = Math.min(v.hp, v.def.hp * hpK);
      if (v.type === 'tank') nt++;
      out.push(`${v.type}#${v.idx}`);
    }
    return out;
  };
  // açık görüşlü yer kamerası noktası: bayrağın üstündeki havaya (helikopter) ve bayrak zeminine az örtü
  S.openSpot = (cx, cz, r0, r1, h = 1.7, up = 32) => {
    let bp = null, bs = 1e9;
    for (let k = 0; k < 60; k++) {
      const a = Math.random() * Math.PI * 2, r = r0 + Math.random() * (r1 - r0), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!free(x, z, 2)) continue;
      if (!g.world.clear({ x, y: H(x, z) + h, z }, { x, y: H(x, z) + 40, z })) continue;                    // çatı altı (ev içi) değil
      const P = { x, y: H(x, z) + h, z }, A = { x: cx, y: H(cx, cz) + up, z: cz }, B = { x: cx, y: H(cx, cz) + 1.5, z: cz };
      const sc = g.cine.occl(A, P) * 2 + g.cine.occl(B, P) + (flat(x, z, 3) ? 0 : 3);
      if (sc < bs) { bs = sc; bp = { x, z, sc }; }
    }
    return bp;
  };
  // seçili helikopterin saldırısı şu an sürüyor mu (dalış + nişan)
  S.attacking = () => { const b = S.hb; return !!(b && b.vd && alive(S.hv) && S.hv.seats[0] === b.s && b.vd.mode === 'strike' && b.vd.atk); };
  S.heliTarget = () => { const A = S.hb?.vd?.atk; return A ? (A.v && alive(A.v) ? A.v : null) : null; };

  // ── tank düellosu ──
  S.duel = () => {
    const T = (team) => VL().filter((v) => drv(v) && v.type === 'tank' && v.seats[0].team === team);
    const A = best(T('blue'), (v) => v.hp + (v.seats[1] ? 300 : 0)), B = best(T('red'), (v) => v.hp + (v.seats[1] ? 300 : 0));
    if (!A || !B) return null;
    // açık düz arazi: bayraklar arası (Kavşak çevresi) 120–150 m'lik görüşü açık çizgi
    const O = g.mode.objectives;
    for (let k = 0; k < 200; k++) {
      const o = O[Math.floor(Math.random() * O.length)], p = S.spot(o.x, o.z, 60, 220); if (!p) continue;
      const a = Math.random() * Math.PI * 2, D = 72 + Math.random() * 26, q = { x: p.x + Math.cos(a) * D, z: p.z + Math.sin(a) * D };
      if (!free(q.x, q.z) || !flat(q.x, q.z)) continue;
      const e1 = { x: p.x, y: H(p.x, p.z) + 2.7, z: p.z }, e2 = { x: q.x, y: H(q.x, q.z) + 2.7, z: q.z };
      if (!g.world.clear(e1, e2) || !g.botSees(e1, e2)) continue;
      const yA = Math.atan2(-(q.x - p.x), -(q.z - p.z)), yB = Math.atan2(-(p.x - q.x), -(p.z - q.z));
      S.place(A, p.x, p.z, yA); S.place(B, q.x, q.z, yB);
      A.hp = A.def.hp; B.hp = B.def.hp * 0.62;
      S.dA = A; S.dB = B; S.dT = g.time;
      return { A: A.idx, B: B.idx, D: Math.round(D), at: [Math.round(p.x), Math.round(p.z)], near: o.name };
    }
    return null;
  };
  // düello sürerken tanklar yerinde (mevzi) kalsın
  S.holdDuel = () => {
    for (const v of [S.dA, S.dB]) { if (!alive(v)) continue; const b = brainOf(v); if (b?.vd) { b.vd.state = 'hold'; b.vd.holdT = b.vd.t; b.vd.holdFor = 999; } }
  };

  // ── sabit tanksavar (12.213 yuvası): yuvaya bir bot, önüne (yayın içinde, görüşü açık 90–140 m) düşman tankı (mevzide, hasarlı) ──
  S.atgmSetup = () => {
    const E = VL().filter((v) => alive(v) && v.type === 'atgm' && !S.used.has(v));
    for (const e of E.sort(() => Math.random() - 0.5)) {
      const by = e.st.base ?? e.st.yaw, fx = -Math.sin(by), fz = -Math.cos(by), eye = { x: e.st.x, y: e.st.y + 1.4, z: e.st.z };
      let q = null;
      for (let k = 0; k < 60 && !q; k++) {
        const a = by + (Math.random() - 0.5) * 1.1, D = 90 + Math.random() * 50, x = e.st.x - Math.sin(a) * D, z = e.st.z - Math.cos(a) * D;
        if (!free(x, z) || !flat(x, z)) continue;
        const P = { x, y: H(x, z) + 1.2, z };
        if (g.world.clear(eye, P) && g.botSees(eye, P)) q = { x, z };
      }
      if (!q) continue;
      let gun = e.seats[0];
      const team = gun ? gun.team : (S.team || 'blue'), en = team === 'blue' ? 'red' : 'blue';
      if (!gun) {
        const c = best(g.soldiers.filter((s) => s.alive && !s.veh && !s.isPlayer && s.brain && s.team === team && s.cls !== 'sniper' && s.cls !== 'medic'), (s) => -Math.hypot(s.pos.x - e.st.x, s.pos.z - e.st.z));
        if (!c) continue;
        g.vehicles.enter(c, e, 0); gun = c; c.brain.empT = 0; c.brain.target = null;
      }
      const t = best(VL().filter((v) => drv(v) && v.type === 'tank' && v.seats[0].team === en && !S.used.has(v)), (v) => -Math.hypot(v.st.x - q.x, v.st.z - q.z));
      if (!t) continue;
      S.place(t, q.x, q.z, Math.atan2(-(e.st.x - q.x), -(e.st.z - q.z)) + (Math.random() - 0.5) * 1.5);
      t.hp = Math.min(t.hp, t.def.hp * 0.7);
      const b = brainOf(t); if (b?.vd) { b.vd.state = 'hold'; b.vd.holdT = b.vd.t; b.vd.holdFor = 999; }
      gun.devGod = true;
      S.atS = gun; S.atV = t; S.atE = e; S.used.add(e); S.used.add(t);
      return { e: e.idx, tank: t.idx, d: Math.round(Math.hypot(q.x - e.st.x, q.z - e.st.z)), gun: `${gun.cls}#${gun.id} ${gun.team}` };
    }
    return null;
  };
  S.holdAt = () => { const v = S.atV; if (alive(v)) { const b = brainOf(v); if (b?.vd) { b.vd.state = 'hold'; b.vd.holdT = b.vd.t; b.vd.holdFor = 999; } } const e = S.atE; if (e && S.atS?.alive && !S.atS.veh && alive(e) && !e.seats[0]) g.vehicles.enter(S.atS, e, 0); if (S.atS?.brain) S.atS.brain.empT = 0; };
  // ── RPG / C4 ──
  S.rpgSetup = (c4 = false) => {
    const mates = (v) => nearN(v.st.x, v.st.z, 60, (q) => q.team === v.seats[0].team && !q.veh);
    const tanks = VL().filter((v) => drv(v) && v.type === 'tank' && !S.used.has(v) && (!c4 || v.seats[1])).sort((a, b) => mates(a) - mates(b));      // yalnız (piyadesi az) tank: tanksavarcı hemen vurulmasın
    if (S.atS) S.atS.devGod = false;
    for (const v of tanks) {
      const en = v.seats[0].team === 'blue' ? 'red' : 'blue';
      const away = (x, z) => nearN(x, z, 45, (q) => q.team === v.seats[0].team && !q.veh) <= 1;
      if (c4 && !v.seats[1]) continue;                                               // C4: botun hedefi tanktaki görünen nişancı
      const cand = g.soldiers.filter((s) => s.alive && !s.veh && !s.isPlayer && s.brain && s.team === en && (c4 ? s.cls === 'engineer' || s.items[2]?.id === 'c4' : (s.items[2]?.id === 'rpg' || s.items[2]?.id === 'law')));
      const s = best(cand, (q) => -Math.hypot(q.pos.x - v.st.x, q.pos.z - v.st.z)); if (!s) continue;
      // tanksavar: aradaki zemin / engel atış hattının altında (çömelik göz 0,9 m'den de açık), arazi tümseği yok
      const line = (x, z) => { for (let i = 1; i < 12; i++) { const t = i / 12, px = x + (v.st.x - x) * t, pz = z + (v.st.z - z) * t, ly = H(x, z) + 0.9 + (v.st.y + 1 - H(x, z) - 0.9) * t; if (H(px, pz) > ly - 0.5) return false; } return true; };
      const p = S.spot(v.st.x, v.st.z, c4 ? 3.9 : 26, c4 ? 4.6 : 40, (x, z) => g.world.clear({ x, y: H(x, z) + 1.5, z }, { x: v.st.x, y: v.st.y + 1.2, z: v.st.z }) && (c4 || (away(x, z) && line(x, z) && g.world.clear({ x, y: H(x, z) + 0.9, z }, { x: v.st.x, y: v.st.y + 1, z: v.st.z }) && g.botSees({ x, y: H(x, z) + 1.5, z }, { x: v.st.x, y: v.st.y + 1.2, z: v.st.z }))), v, c4 ? 0.6 : 3);
      if (!p) continue;
      s.pos.set(p.x, H(p.x, p.z), p.z); s.vel.set(0, 0, 0); s.yaw = Math.atan2(-(v.st.x - p.x), -(v.st.z - p.z));
      if (!c4) { const it = s.items[2]; it.mag = Math.max(1, it.mag); it.reserve = Math.max(2, it.reserve); }
      else s.items[2] = { id: 'c4', mag: 2, reserve: 0 };                              // mühendisin yuvasına C4 (2 adet: arkadan / üstten tankı patlatır)
      s.brain.setGoal(p.x, p.z, 30); s.brain.via = null;
      v.hp = Math.min(v.hp, v.def.hp * (c4 ? 0.9 : 0.55));
      const b = brainOf(v); if (b?.vd) { b.vd.state = 'hold'; b.vd.holdT = b.vd.t; b.vd.holdFor = 999; }
      s.brain.gadgetT = c4 ? 0.3 : s.brain.gadgetT; s.devGod = true;                  // yalnız kayıtta: tanksavarcı çekim bitmeden vurulmasın
      S.atS = s; S.atV = v; S.used.add(v);
      return { s: `${s.cls}#${s.id}`, v: `tank#${v.idx}`, d: Math.round(Math.hypot(p.x - v.st.x, p.z - v.st.z)), it: s.items.map((i) => i?.id).join(',') };
    }
    return null;
  };
}

// ── çekim bulucuları (cinerec.mjs: CS.find[ad]() → cine.cut seçenekleri ya da null = henüz hazır değil) ──
export function installFinders() {
  const g = window.__game, S = window.CS, VL = () => g.vehicles.list, F0 = S.find;
  const alive = (v) => v && v.alive && v.st;
  const best = (arr, sc) => { let b = null, bs = -1e9; for (const x of arr) { const s = sc(x); if (s > bs) { bs = s; b = x; } } return bs > -1e8 ? b : null; };
  const sp = (v) => Math.hypot(v.st.vx, v.st.vz);
  const drv = (v) => alive(v) && v.seats[0] && !v.def.fixed && !v.seats[0].isPlayer;
  const hv = () => { if (!(alive(S.hv) && S.hb && S.hv.seats[0] === S.hb.s)) S.strike(S.team || 'blue'); return alive(S.hv) && S.hb && S.hv.seats[0] === S.hb.s && S.hv.st.air ? S.hv : null; };
  // kapı: bayrağa bakan taraftaki nişancı (yörüngede iç kapı)
  // kapı nişancısı dışarı (yayın içine) nişanlıyken ve hedefi varken: hangi koltuk (yoksa 0)
  const doorAim = (v) => {
    const st = v.st, wrapA = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    let bs = 0, bsc = 99;
    for (const seat of [1, 2]) { const gs = v.seats[seat]; if (!gs?.alive) continue; const rest = (seat === 1 ? 1 : -1) * Math.PI / 2, d = Math.abs(wrapA(wrapA(gs.yaw - st.yaw) - rest)); const sc = d - (gs.brain?.target ? 0.5 : 0) - (gs.pitch < -0.25 ? 0.3 : 0); if (d < 0.75 && sc < bsc) { bsc = sc; bs = seat; } }
    return bs;
  };
  const doorSeat = (v) => {
    const F = S.F, st = v.st; if (!F) return 1;
    const lx = -Math.cos(st.yaw), lz = Math.sin(st.yaw), d = (F.x - st.x) * lx + (F.z - st.z) * lz;      // sol (yaw + 90°)
    const s1 = d > 0 ? 1 : 2; return v.seats[s1] ? s1 : v.seats[3 - s1] ? 3 - s1 : s1;
  };
  const atkOn = () => S.attacking();
  const nearN0 = (x, z, r) => g.soldiers.filter((s) => s.alive && Math.hypot(s.pos.x - x, s.pos.z - z) < r).length;
  Object.assign(S.find, {
    // ── gece saldırısı ──
    'g-acilis'() { const v = hv(); return v && { v, type: 'chase', d: 26, h: 9, lead: 60, lag: 4, tk: 10, x: 7, fov: 54, turn: 1.2, ly: -6 }; },
    'g-yaklasma'() { const v = hv(); return v && { v, type: 'side', d: 20, h: 1.5, f: 4, slide: -1.5, lag: 5, fov: 46 }; },
    'g-burun1'() { const v = hv(); return v && atkOn() && { v, type: 'nose', fov: 52 }; },
    'g-burun2'() { const v = hv(); return v && atkOn() && { v, type: 'nose', fov: 46 }; },
    'g-burun3'() { const v = hv(); return v && atkOn() && { v, type: 'nose', fov: 56 }; },
    'g-tepe'() { const v = hv(); return v && atkOn() && { v, type: 'heliTop', d: 16, h: 9, x: 6, lead: 30, down: 26, fov: 60, lag: 3, turn: 1.4 }; },
    'g-kapi1'() { const v = hv(), k = v && doorAim(v); return k ? { v, type: 'door', seat: k, fov: 60 } : null; },
    'g-kapi2'() { const v = hv(), k = v && doorAim(v); return k ? { v, type: 'door', seat: k, fov: 52, d: 1.05, x: -0.35, h: 0.25 } : null; },
    genis2() { const L = g.heat.list(g.time).sort((a, b) => b[2] - a[2]).filter((c) => nearN0(c[0], c[1], 60) >= 12); const c = L[1] || L[0]; return c && { p: { x: c[0], z: c[1] }, type: 'wide', r: 55, h: 22, w: -0.06, fov: 50 }; },
    'g-kapi3'() { const v = hv(), k = v && doorAim(v); return k ? { v, type: 'door', seat: k, fov: 56, d: 1.1, x: 0.5, h: 0.35 } : null; },
    'g-kapi4'() { const v = hv(), k = v && doorAim(v); return k ? { v, type: 'door', seat: k, fov: 50, d: 1.2, x: -0.45, h: 0.3 } : null; },
    'g-dalis'() { const v = hv(); return v && atkOn() && { v, type: 'chase', d: 17, h: 4.5, lead: 45, lag: 6, tk: 14, x: 3, fov: 54, turn: 1.6, ly: -10 }; },
    'g-yer1'() {
      const v = hv(), F = S.F; if (!v || !F) return null;
      const p = S.openSpot(F.x, F.z, 25, 70); if (!p) return null;
      return { v, type: 'watch', at: { x: p.x, z: p.z, h: 1.6 }, mix: 0.4, fit: 26, fov: 58, fmin: 26, lagL: 4 };
    },
    'g-yer2'() { const v = hv(); return v && { v, type: 'flyby', dy: -30, off: 30, ahead: 3.2, fov: 50, ly: 0 }; },
    // patlama: helikopterin nişanındaki araç; yerden, 22–40 m'den (ring: araç patlayana dek)
    'g-patlama'() {
      const t = S.heliTarget(); if (!t || S.used.has(t)) return null;
      const p = S.openSpot(t.st.x, t.st.z, 22, 40, 1.4, 2); if (!p) return null;
      return { v: t, type: 'watch', at: { x: p.x, z: p.z, h: 1.4 }, fit: 16, fov: 46, fmin: 18, lagL: 5, keepDead: true, hold: true };
    },
    'g-patlama2'() {
      const t = S.heliTarget(); if (!t || S.used.has(t)) return null;
      return { v: t, type: 'orbit', r: 20, h: 6, w: 0.12, fov: 50, keepDead: true, hold: true };
    },
    'g-enkaz'() { const F = S.F; if (!F) return null; return { p: { x: F.x, z: F.z }, type: 'wide', r: 75, h: 28, w: 0.05, fov: 52 }; },
    'g-kapanis'() { const v = hv(); return v && { v, type: 'chase', d: 30, h: 12, lead: 50, lag: 2, tk: 8, x: -8, fov: 52, turn: 1, ly: -8, zoom: 0.15 }; },
    // ── tank savaşı ──
    't-acilis'() { const A = S.dA, B = S.dB; if (!alive(A) || !alive(B)) return null; const x = (A.st.x + B.st.x) / 2, z = (A.st.z + B.st.z) / 2; return { p: { x, z }, type: 'wide', r: 95, h: 30, w: 0.035, dr: -8, fov: 46 }; },
    't-duel'() { const A = S.dA, B = S.dB; if (!alive(A) || !alive(B)) return null; return { v: A, v2: B, type: 'pair', ots: true, d: 13, x: 4, h: 2.6, fov: 44, lag: 4, tk: 10 }; },
    't-duelB'() { const A = S.dA, B = S.dB; if (!alive(A) || !alive(B)) return null; return { v: B, v2: A, type: 'pair', ots: true, d: 13, x: -4, h: 2.6, fov: 44, lag: 4, tk: 10 }; },
    't-kule'() { const A = S.dA; return alive(A) && { v: A, type: 'turret', d: 7.5, h: 2.1, x: 1.2, side: 1, fov: 46, dp: -0.05 }; },
    't-kuleB'() { const B = S.dB, A = S.dA; if (!alive(B) || !alive(A)) return null; A.hp = Math.min(A.hp, A.def.hp * 0.62); B.hp = B.def.hp; return { v: B, ringV: A, type: 'turret', d: 7.5, h: 2.1, x: -1.2, side: 1, fov: 46, dp: -0.05 }; },
    't-isabet'() {
      const B = S.dB, A = S.dA; if (!alive(B) || !alive(A)) return null;
      const p = S.spot(B.st.x, B.st.z, 22, 34, (x, z) => g.world.clear({ x, y: S.H(x, z) + 1.2, z }, { x: B.st.x, y: B.st.y + 1.5, z: B.st.z }) && ((x - B.st.x) * (A.st.x - B.st.x) + (z - B.st.z) * (A.st.z - B.st.z)) < 0, B, 2);
      if (!p) return null;
      return { v: B, ringV: B, type: 'watch', at: { x: p.x, z: p.z, h: 1.1 }, fit: 11, fov: 40, fmin: 20, lagL: 6, keepDead: true, hold: true };
    },
    't-enkaz2'() { return S.find['t-enkaz'](); },
    't-enkaz'() { const B = S.dB; return B && B.st && { v: B, type: 'orbit', r: 14, h: 2.2, w: 0.14, fov: 46, keepDead: true, hold: true }; },
    't-gecis1'() { const v = best(VL().filter((v) => drv(v) && v.type === 'tank' && sp(v) > 3 && !S.used.has(v)), (v) => sp(v)); return v && { v, type: 'low', ahead: 2.6, off: 7, h: 0.4, fov: 40 }; },
    't-gecis2'() { const v = best(VL().filter((v) => drv(v) && v.type === 'tank' && sp(v) > 3 && !S.used.has(v)), (v) => sp(v)); return v && { v, type: 'low', ahead: 2.2, off: 5.5, h: 0.35, fov: 46 }; },
    't-yan'() { const v = best(VL().filter((v) => drv(v) && v.type === 'tank' && sp(v) > 3 && !S.used.has(v)), (v) => sp(v) + (v.seats[1] ? 3 : 0)); return v && { v, type: 'side', d: 11, h: 1.0, lag: 5, fov: 44, slide: -0.8 }; },
    't-atgm'() { const s = S.atS, v = S.atV; if (!s?.alive || !alive(v) || !s.veh) return null; return { s, ringV: v, type: 'sniper', d: 2.4, x: 0.9, h: 0.3, fov: 44, side: 1, snapT: true, keepDead: true, hold: true }; },
    't-atgm2'() { const v = S.atV; if (!alive(v)) return null; const e = S.atE; return { v, ringV: v, type: 'orbit', r: 16, h: 3, w: 0.08, fov: 46, keepDead: true, hold: true }; },
    // doğal RPG: tanksavarı dolu, hedefi tanktaki düşman olan piyade (12–85 m) — o anki tank hasarlı başlatılır (bir sonraki gerçek isabet patlatır)
    't-rpgdogal'() {
      const R = g.soldiers.filter((s) => s.alive && !s.veh && s.brain && (s.items[2]?.id === 'rpg' || s.items[2]?.id === 'law') && s.items[2].mag > 0 && s.brain.target?.veh?.type === 'tank' && s.brain.target.veh.alive);
      const s = best(R, (q) => { const v = q.brain.target.veh, d = Math.hypot(v.st.x - q.pos.x, v.st.z - q.pos.z); return d > 18 && d < 75 ? -Math.abs(d - 40) : -1e9; });
      if (!s) return null;
      const v = s.brain.target.veh; v.hp = Math.min(v.hp, v.def.hp * 0.3); s.devGod = true; S.atS = s; S.atV = v;
      return { s, ringV: v, type: 'sniper', d: 2.6, x: 0.9, h: 0.25, fov: 46, side: 1, snapT: true, keepDead: true, hold: true };
    },
    't-rpg'() { const s = S.atS, v = S.atV; if (!s?.alive || !alive(v)) return null; return { s, ringV: v, type: 'sniper', d: 2.6, x: 0.9, h: 0.25, fov: 46, side: 1, snapT: true, keepDead: true, hold: true }; },
    't-c4'() { const s = S.atS, v = S.atV; if (!s?.alive || !alive(v)) return null; return { v, ringV: v, type: 'orbit', r: 11, h: 2.4, w: 0.1, fov: 52, keepDead: true, hold: true }; },
    't-kapanis'() { const B = S.dB, A = S.dA, P = alive(A) ? A.st : B?.st; if (!P) return null; return { p: { x: P.x, z: P.z }, type: 'wide', r: 45, h: 14, w: -0.04, dr: 30, dh: 18, fov: 50 }; },
  });
}
