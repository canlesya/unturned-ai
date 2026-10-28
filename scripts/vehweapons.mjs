// 12.188 araç silahları / hasar denetimi — tek koşu:   node scripts/vehweapons.mjs
//   1) başsız (her zaman): tank topu HE sıçraması (yere düşen mermi 3 m'deki iki düşmanı öldürür, 1 m'deki tek düşmanı öldürür, aralarından geçen /
//      başın üstünden sıyıran mermi yakın geçişte patlar, 7,5 m'de hasar yok), duvar / kum torbası arkası korunur, mermi ince duvardan geçmez,
//      araziye gömülen mermi yüzeyde patlar, nişangâh = gerçek düşüş (duran + yürüyen tank), dost ateşi (asker / araç), kendi aracına × selfBlast,
//      zırh çarpanları (mermi / el bombası / RPG / top: tank, jip, helikopter), araç patlaması içindekileri + yakındakileri öldürür (öldürme / asist),
//      kule makinelisi / kapı makinelisi hasarı, bot nişancı ateşi makul.
//   2) çevrim içi (SRV erişilebilirse; yerel debug sunucu): A tank sürücüsü, B gözlemci (Mavi), iki Kırmızı bot; top 3 m önlerine → ikisi de ölür,
//      iki istemcide aynı öldürme akışı + patlama ('tsb') görülür. Görüntüler OUT/.
// Ortam: URL (http://127.0.0.1:5196) · SRV (ws://127.0.0.1:8971) · OUT (/tmp/wb-qa6) · ONLY=headless|online
import { Game } from '../src/game/game.js';
import { VT, gunPose, shellVel, shellAdvance, heFalloff } from '../src/sim/vehicle.js';
import { TUNE } from '../src/game/balance.js';
import fs from 'fs';

const URL0 = process.env.URL || 'http://127.0.0.1:5196', SRV = process.env.SRV || 'ws://127.0.0.1:8991', OUT = process.env.OUT || '/tmp/wb-qa6', ONLY = process.env.ONLY || '';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (x !== '' ? ' · ' + x : '')); if (!c) fails++; };
const f1 = (v) => (+v).toFixed(1), f2 = (v) => (+v).toFixed(2);
const D = VT.tank, C = D.cannon;

function headless() {
  console.log('── başsız: tank topu (HE) ──');
  const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 8, type: 'conquest' } }), V = g.vehicles, W = g.world;
  const s = g.claimSlot('blue', 'Tankçı', 'assault', {}), h = g.humans.get(s.id);
  let q = 0;
  const inp = (o = {}) => ({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: s.yaw, pt: s.pitch, w: s.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0, ...o });
  const step = (n, o = {}) => { for (let i = 0; i < n; i++) { h.queue.push(inp(typeof o === 'function' ? o(i) : o)); g.step(1 / 60); } };
  const t = V.list.find((x) => x.id === 'B-T1');
  const put = (v, x, z, yaw) => { v.st.x = x; v.st.z = z; v.st.y = W.heightAt(x, z); v.st.yaw = yaw; if (v.def.turret) { v.st.tyaw = yaw; v.st.gp = 0; } v.st.vx = v.st.vy = v.st.vz = 0; v.st.air = false; v.st.sunk = false; v.sleep = false; };
  const reds = g.soldiers.filter((o) => o.team === 'red'), blues = g.soldiers.filter((o) => o.team === 'blue' && o !== s);
  const place = (e, x, z, crouch = false) => { e.vacant = false; e.spawn({ x, z, ry: 0 }, 0); W.settle(e); e.vel.set(0, 0, 0); e.fallTop = e.pos.y; e.fallSafe = true; e.zoneT = 0; e.oobT = 0; e.protT = 0; e.maxHp = 100; e.hp = 100; if (crouch) { e.crouching = true; e.height = 1.25; } return e; };
  if (process.env.DBG) for (const e of g.soldiers) { const td = e.takeDamage.bind(e); e.takeDamage = (a, at, z, fp, w) => { console.log('   dmg', e.name, Math.round(a), w, at?.name); return td(a, at, z, fp, w); }; }
  s.pos.set(t.st.x + 2.4, t.st.y, t.st.z); s.protT = 0; step(1, { ve: 1 }); step(1);
  ok(s.veh === t && s.seat === 0, 'tank sürücüsü');
  // atış yardımcıları: top açısı (dünya) ile mermiyi, sunucunun yoluyla birebir aynı integrale göre hedef YER noktasına / gövde yüksekliğine düşür
  const fly = (pt, yaw, stopX) => { const st = { ...t.st, gp: pt - t.st.pitch * Math.cos(yaw - t.st.yaw), tyaw: yaw }, o = {}, d = {}; gunPose(st, o, d); const sh = { x: o.x, y: o.y, z: o.z, ...shellVel(st, d, {}) }; return sh; };
  const solve = (yaw, f) => { let lo = D.turret.gunMin + t.st.pitch, hi = 0.25; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; } return (lo + hi) / 2; };
  // yatay mesafe R'de merminin yüksekliği − hedef y
  const heightAt = (pt, yaw, R, y) => { const sh = fly(pt, yaw); const fx = -Math.sin(yaw), fz = -Math.cos(yaw); for (let i = 0; i < 4000; i++) { const px = sh.x, pz = sh.z, py = sh.y; shellAdvance(sh, 1 / 600, C.grav); const r = (sh.x - t.st.x) * fx + (sh.z - t.st.z) * fz; if (r >= R) { const r0 = (px - t.st.x) * fx + (pz - t.st.z) * fz, k = (R - r0) / (r - r0); return py + (sh.y - py) * k - y; } } return 99; };
  const landAt = (pt, yaw) => { const sh = fly(pt, yaw); const fx = -Math.sin(yaw), fz = -Math.cos(yaw); for (let i = 0; i < 6000; i++) { shellAdvance(sh, 1 / 600, C.grav); if (sh.y < W.heightAt(sh.x, sh.z)) return (sh.x - t.st.x) * fx + (sh.z - t.st.z) * fz; } return 1e9; };
  let booms = [];
  const ex0 = g.explode.bind(g); g.explode = (p, ...a) => { booms.push({ x: p.x, y: p.y, z: p.z, a }); return ex0(p, ...a); };
  const fire = (yaw, pt) => {
    step(100, { yw: yaw, pt });
    t.rl = 0; booms = [];
    step(1, { yw: yaw, pt, fh: 1, fp: 1 });
    let n = 0; while (V.shells.length && n < 300) { step(1, { yw: yaw, pt }); n++; }
    return booms.find((b) => b.a[3] === C.name) || null;
  };
  // sahne: düz, engelsiz çayır (D bayrağı kuzeyi; z = −390, x 270 → 370 doğuya, kot farkı < 0,1 m; üs dışı: üs hasarı yok)
  const YE = -Math.PI / 2, X0 = 270, Z0 = -390, R = 80;
  put(t, X0, Z0, YE); step(3, { yw: YE, pt: 0 });
  const gy = W.heightAt(X0 + R, Z0);
  const two = (gap = 2.4) => [place(reds[0], X0 + R, Z0 - gap / 2), place(reds[1], X0 + R, Z0 + gap / 2)];
  const st = (e) => (e.alive ? Math.round(e.hp) : 'öldü');
  // 1) yere, iki düşmanın 3 m önüne
  let [a, b] = two();
  if (process.env.DBG) { const orig = V.shellTrace.bind(V); V.shellTrace = (o, d, L, c, by, skip) => { const r = orig(o, d, L, c, by, skip); if (r) console.log('trace hit', r.k, r.t.toFixed(2), 'at', o.x.toFixed(1), o.y.toFixed(2), o.z.toFixed(1)); return r; }; console.log('pt', solve(YE, (m) => landAt(m, YE) - (R - 3)), landAt(-0.013, YE)); }
  let bm = fire(YE, solve(YE, (m) => landAt(m, YE) - (R - 3)));
  ok(bm && !a.alive && !b.alive, 'yere düşen mermi: 3 m önündeki yan yana (2,4 m) iki düşman ölür', bm ? `patlama ${f1(X0 + R - bm.x)} m önde · ${st(a)} / ${st(b)}` : 'patlama yok');
  // 2) tek düşmanın 1 m önüne
  [a] = [place(reds[0], X0 + R, Z0)]; place(reds[1], X0 + R + 40, Z0 + 30);
  bm = fire(YE, solve(YE, (m) => landAt(m, YE) - (R - 1)));
  ok(bm && !a.alive, 'yere düşen mermi: 1 m önündeki düşman ölür', bm ? `patlama ${f1(X0 + R - bm.x)} m önde · ${st(a)}` : 'patlama yok');
  // 3) iki düşmanın ARASINDAN (gövde hizasında) geçen mermi: eskiden arkalarına (20 m+) düşüyordu → yakın geçişte patlar
  [a, b] = two(2.6);
  bm = fire(YE, solve(YE, (m) => heightAt(m, YE, R, gy + 1.0)));
  ok(bm && Math.abs(bm.x - (X0 + R)) < 2 && !a.alive && !b.alive, 'iki düşmanın arasından geçen mermi yakın geçişte patlar, ikisi de ölür', bm ? `patlama x ${f1(bm.x - X0)} m · ${st(a)} / ${st(b)}` : 'patlama yok');
  // 4) başın 0,7 m üstünden sıyıran mermi
  [a] = [place(reds[0], X0 + R, Z0)];
  bm = fire(YE, solve(YE, (m) => heightAt(m, YE, R, gy + a.height + 0.7)));
  ok(bm && Math.abs(bm.x - (X0 + R)) < 2 && !a.alive, 'başın 0,7 m üstünden sıyıran mermi patlar (öldürür)', bm ? `patlama x ${f1(bm.x - X0)} · ${st(a)}` : 'patlama yok');
  // 5) başın 3 m üstünden geçen mermi: patlamaz (arkaya düşer), asker sağ
  [a] = [place(reds[0], X0 + R, Z0)];
  bm = fire(YE, solve(YE, (m) => heightAt(m, YE, R, gy + a.height + 3)));
  ok(bm && bm.x - (X0 + R) > 8 && a.alive && a.hp === 100, 'başın 3 m üstünden geçen mermi orada patlamaz (yakın geçiş 1,3 m)', bm ? `patlama ${f1(bm.x - X0 - R)} m arkada · ${st(a)}` : 'patlama yok');
  // 6) düşüş eğrisi: 5,5 m'de ağır yaralı (ölmez), 8 m'de hasarsız
  [a] = [place(reds[0], X0 + R, Z0)]; b = place(reds[1], X0 + R - 0.5, Z0 + 8.2);
  bm = fire(YE, solve(YE, (m) => landAt(m, YE) - (R - 5.6)));
  const dA = bm ? Math.hypot(a.pos.x - bm.x, a.pos.z - bm.z) : 0;
  ok(bm && a.alive && a.hp < 100 && a.hp > 0 && b.hp === 100, 'düşüş: ~5,6 m\'deki asker yaralanır (ölmez), 8 m\'deki hasarsız', bm ? `${f1(dA)} m → can ${st(a)} · 8 m → ${st(b)}` : 'patlama yok');
  const prof = [0, 2, 3, 4, 5, 6, 7, 7.5].map((d) => `${d} m ${Math.round(C.dmg * heFalloff(d, C.radius, C.inner))}`).join(' · ');
  ok(true, 'HE hasar eğrisi (askere, gövde eksenine uzaklık)', prof);
  // 7) dost ateşi: aynı yerdeki takım arkadaşı hasarsız; dost jip hasarsız, düşman jip hasarlı
  [a] = [place(reds[0], X0 + R, Z0)]; const mate = place(blues[0], X0 + R, Z0 + 1.5);
  const jb = V.list.find((x) => x.id === 'B-J1'), jr = V.list.find((x) => x.id === 'R-J1');
  put(jb, X0 + R - 1, Z0 + 5, 0); put(jr, X0 + R - 1, Z0 - 5, 0); jb.team = 'blue'; jr.team = 'red'; step(2, { yw: YE, pt: 0 });
  const hb0 = jb.hp, hr0 = jr.hp;
  bm = fire(YE, solve(YE, (m) => landAt(m, YE) - (R - 1.5)));
  ok(bm && !a.alive && mate.alive && mate.hp === 100 && jb.hp === hb0 && jr.hp < hr0, 'dost ateşi: takım arkadaşı + dost jip hasarsız · düşman ölür, düşman jip hasarlı', `arkadaş ${st(mate)} · dost jip ${Math.round(hb0)}→${Math.round(jb.hp)} · düşman jip ${Math.round(hr0)}→${jr.alive ? Math.round(jr.hp) : 'patladı'}`);
  put(jb, -300, 600, 0); if (jr.alive) put(jr, -310, 640, 0);
  // 8) duvar arkası: ince hangar duvarına (x 97, kalınlık 0,3 m, 9 m) çarpan mermi duvardan geçmez, arkasındaki asker hasarsız; kum torbası önüne
  put(t, 60, 743, YE); step(3, { yw: YE, pt: 0 });
  a = place(reds[0], 98.6, 743);
  bm = fire(YE, solve(YE, (m) => heightAt(m, YE, 97.0 - 60 + 0.05, W.heightAt(97, 743) + 1.5)));
  ok(bm && bm.x < 97.05 && a.alive && a.hp === 100, 'ince duvara çarpan mermi duvarın önünde patlar, arkasındaki asker hasarsız', bm ? `patlama x ${f2(bm.x)} (duvar 97,0) · ${st(a)}` : 'patlama yok');
  // kum torbası (−165…−162, z 336,5–337,1, 1,4 m): önüne (yüzüne) çarpan mermi, arkasında çömelen askere işlemez · yanındaki açıktaki asker ölür
  const YN = Math.PI;                                                   // +z'ye bakış
  put(t, -163.7, 300, YN); step(3, { yw: YN, pt: 0 });
  a = place(reds[0], -163.7, 337.9, true); b = place(reds[1], -159.5, 336.0);
  const sbY = W.heightAt(-163.7, 336.5) + 0.6;
  bm = fire(YN, solve(YN, (m) => heightAt(m, YN, 336.5 - 300 + 0.02, sbY)));
  ok(bm && bm.z < 337.1 && a.alive && a.hp === 100 && !b.alive, 'kum torbasına (yüzüne / üstüne) çarpan mermi: arkasında çömelen korunur, yandaki açıktaki asker ölür', bm ? `patlama z ${f2(bm.z)} · arkadaki ${st(a)} · açıktaki ${st(b)}` : 'patlama yok');
  // 9) araziye gömülen mermi (başlangıç arazinin altında) yüzeyde patlar (eskiden arazinin altından uçup gidiyordu)
  put(t, X0, Z0, YE); step(3, { yw: YE, pt: 0 });
  a = place(reds[0], 60, Z0 + 0.5);
  booms = []; V.addShell({ id: 999, v: t, by: s, x: 59, y: W.heightAt(59, Z0) - 0.4, z: Z0, vx: 150, vy: -2, vz: 0, t: 0.5, auth: true }); step(2, { yw: YE, pt: 0 });
  bm = booms.find((x) => x.a[3] === C.name);
  ok(bm && Math.abs(bm.y - W.heightAt(bm.x, bm.z)) < 0.2 && !a.alive && !V.shells.length, 'arazi altında kalan mermi yüzeyde patlar', bm ? `y ${f2(bm.y)} / zemin ${f2(W.heightAt(bm.x, bm.z))}` : 'patlama yok');
  // 10) nişangâh (predictShell) = gerçek patlama: duran tank 60 / 120 m, yürüyen tank yan atış
  const pred = (pt, yaw, o = {}) => { step(100, { yw: yaw, pt, ...o }); return V.predictShell(t, s); };
  for (const [pt, lbl] of [[-0.02, 'yakın'], [0.0, 'orta'], [0.006, 'uzak']]) {
    put(t, X0, Z0, YE); step(2, { yw: YE, pt });
    const p = pred(pt, YE); bm = fire(YE, pt);
    const err = p && bm ? Math.hypot(p.p.x - bm.x, p.p.z - bm.z) : 99;
    ok(err < 0.5, `nişangâh = mermi düşüşü (duran, ${lbl})`, p ? `${f1(p.dist)} m · fark ${f2(err)} m` : 'yok');
  }
  put(t, 0, 330, 0); step(2, { yw: -Math.PI / 2, pt: 0.004 });
  step(150, { f: 1, yw: -Math.PI / 2, pt: 0.004 });
  { const p = V.predictShell(t, s); t.rl = 0; booms = []; step(1, { f: 1, yw: -Math.PI / 2, pt: 0.004, fh: 1, fp: 1 }); let n = 0; while (V.shells.length && n < 300) { step(1, { f: 1, yw: -Math.PI / 2, pt: 0.004 }); n++; } bm = booms.find((x) => x.a[3] === C.name);
    const err = p && bm ? Math.hypot(p.p.x - bm.x, p.p.z - bm.z) : 99;
    ok(err < 1.0, 'nişangâh = mermi düşüşü (yürüyen tank, yana atış: aracın hızı mermiye eklenir)', p ? `hız ${f1(V.speed(t))} m/sn · ${f1(p.dist)} m · fark ${f2(err)} m` : 'yok'); }
  step(60, { j: 1 });
  // 11) dibindeki duvara atış: kendi tankına × selfBlast, kendisi (gövde içinde) hasarsız
  put(t, 80, 743, YE); step(3, { yw: YE, pt: 0 });
  t.hp = D.hp; const sh0 = s.hp;
  put(t, 97 - 3.3 - 4.3 - 0.35 - 0.6, 743, YE); step(3, { yw: YE, pt: 0.02 });
  bm = fire(YE, 0.02);
  ok(bm && t.alive && t.hp < D.hp && t.hp > D.hp * 0.5 && s.hp === sh0, 'dibindeki duvara top: kendi tankına azaltılmış hasar (× selfBlast ' + TUNE.selfBlast + '), sürücü korunur', bm ? `tank ${D.hp} → ${Math.round(t.hp)} · patlama x ${f2(bm.x)}` : 'patlama yok');
  t.hp = D.hp;
  // 12) zırh / hasar tablosu (her araca aynı vuruşlar)
  const rows = [];
  const P = (x, y, z) => new (s.pos.constructor)(x, y, z);
  for (const id of ['R-J1', 'R-T1', 'R-H1']) {
    const v = V.list.find((x) => x.id === id); if (!v.alive) V.trySpawn(v); put(v, 200, 400, 0); v.team = 'red'; v.hp = v.def.hp; g.step(1 / 60);
    const atk = blues[1]; place(atk, 230, 400);
    const hp = () => v.hp, r = { id: v.def.name, hp: v.def.hp };
    let h0 = hp(); V.damage(v, 30, atk, 'bullet'); r.bullet = +(h0 - hp()).toFixed(1);
    h0 = hp(); g.explode(P(v.st.x + v.def.hw + 0.5, v.st.y + 0.4, v.st.z), 7.5, 130, atk, 'El Bombası'); r.nade = Math.round(h0 - hp());
    v.hp = v.def.hp; h0 = hp(); g.explode(P(v.st.x, v.st.y + 1.2, v.st.z - v.def.hl - 0.15), 6.5, 160, atk, 'RPG-7', undefined, 'at'); r.rpg = Math.round(h0 - hp());
    v.hp = v.def.hp; v.team = 'blue'; h0 = hp(); V.damage(v, 30, atk, 'bullet'); r.bulletFriendly = +(h0 - hp()).toFixed(1); g.explode(P(v.st.x, v.st.y + 1.2, v.st.z - v.def.hl - 0.15), 6.5, 160, atk, 'RPG-7', undefined, 'at'); r.mateAll = Math.round(h0 - hp()); v.team = 'red';
    v.hp = v.def.hp; h0 = hp(); g.explode(P(v.st.x, v.st.y + 1.2, v.st.z - v.def.hl - 0.15), C.radius, C.dmg, atk, C.name, undefined, 'at', { he: true, inner: C.inner, vehInner: C.vehInner }); r.shell = v.alive ? Math.round(h0 - hp()) : 'patladı';
    rows.push(r); put(v, v.spawn.x, v.spawn.z, v.spawn.yaw); v.hp = v.def.hp;
  }
  const J = rows[0], T = rows[1], H = rows[2];
  ok(T.bullet === 0 && J.bullet > 3 && J.bullet < 4 && H.bullet > 4 && H.bullet < 5, 'mermi: tank 0 · jip × 0,12 · helikopter × 0,15', rows.map((r) => `${r.id} ${r.bullet}`).join(' · '));
  ok(T.rpg >= 190 && T.rpg <= 205 && J.rpg > 240 && H.rpg > 240, 'RPG: tank ≈ 200 (5 RPG) · jip / helikopter ≈ 256 (2 RPG)', rows.map((r) => `${r.id} ${r.rpg}`).join(' · '));
  ok(T.shell === 375 && J.shell === 'patladı' && H.shell === 480, 'tank topu doğrudan: tank 375 (3 atış) · jip tek atış · helikopter 480 (2 atış)', rows.map((r) => `${r.id} ${r.shell}`).join(' · '));
  ok(T.nade > 0 && T.nade < 50, 'el bombası: tank az (× 0,3)', rows.map((r) => `${r.id} ${r.nade}`).join(' · '));
  ok(rows.every((r) => r.bulletFriendly === 0 && r.mateAll === 0), 'dost ateşi: takım arkadaşının mermisi / RPG\'si dost araca işlemez', rows.map((r) => `${r.id} ${r.bulletFriendly}/${r.mateAll}`).join(' · '));
  fs.writeFileSync(`${OUT}/hasar-tablosu.json`, JSON.stringify(rows, null, 1));
  // 13) araç patlaması: düşman jipi (sürücü + yolcu) tank topuyla patlar → içindekiler ölür (öldürme tankçıya, ad 'Tank topu'), 4 m'deki düşman yaralanır;
  //     başka biri (RPG ile %25+) hasar verdiyse içindekilerin ölümünde asist alır
  put(t, X0, Z0, YE); step(3, { yw: YE, pt: 0 });
  const j = V.list.find((x) => x.id === 'R-J2'); if (!j.alive) V.trySpawn(j); put(j, X0 + R, Z0, 0); j.team = 'red'; j.hp = j.def.hp; g.step(1 / 60);
  const d1 = place(reds[2], X0 + R + 2, Z0), d2 = place(reds[3], X0 + R - 2, Z0); V.enter(d1, j, 0); V.enter(d2, j, 1);
  const near = place(reds[4], X0 + R + 1, Z0 + 5.2), helper = place(blues[3], X0 + R - 30, Z0 + 20);
  V.damage(j, 160, helper, 'at', 'RPG-7');                               // 160 × 1,6 = 256 → %64
  const k0 = s.kills, as0 = helper.assists || 0, feed = [];
  const ok0 = g.onKill.bind(g); g.onKill = (k, vct, w, hs) => { feed.push([k?.name, vct.name, w]); return ok0(k, vct, w, hs); };
  bm = fire(YE, solve(YE, (m) => heightAt(m, YE, R - VT.jip.hl - 0.3, W.heightAt(X0 + R, Z0) + 0.9)));
  ok(!j.alive && !d1.alive && !d2.alive && s.kills - k0 >= 2 && feed.filter((x) => x[0] === s.name && x[2] === C.name).length >= 2, 'tank topu düşman jipini patlatır: sürücü + yolcu ölür, öldürme tankçıya ("Tank topu")', JSON.stringify(feed.slice(0, 4)));
  ok(near.hp < 100, 'patlayan jipin / topun yanındaki (5 m) düşman yaralanır ya da ölür', st(near));
  ok((helper.assists || 0) - as0 >= 2, 'jipe önce RPG\'yle hasar veren arkadaş, içindekilerin ölümünde asist alır', `asist +${(helper.assists || 0) - as0}`);
  ok(!d1.revivable && !d2.revivable, 'patlayan araçta ölenler canlandırılamaz');
  g.onKill = ok0;
  // 14) kule makinelisi / kapı makinelisi hasar değerleri
  ok(D.mg.dmg === 24 && VT['heli-n'].mg.dmg === 22, 'makineli hasarları: tank 24 (600 atış/dk) · kapı 22 (700 atış/dk)', `tank ${D.mg.dmg} · kapı ${VT['heli-n'].mg.dmg}`);
  return g;
}

// ───────── 1b) başsız: nişan yakınsaması + pilot / jip silahları + ısınma (12.188) ─────────
function headlessGuns() {
  console.log('── başsız: nişan yakınsaması, helikopter pilotu, jip makinelisi, ısınma ──');
  const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 8, type: 'conquest' } }), V = g.vehicles, W = g.world;
  const s = g.claimSlot('blue', 'Pilot', 'assault', {}), h = g.humans.get(s.id);
  let q = 0;
  const inp = (o = {}) => ({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: s.yaw, pt: s.pitch, w: s.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0, ...o });
  const step = (n, o = {}) => { for (let i = 0; i < n; i++) { h.queue.push(inp(typeof o === 'function' ? o(i) : o)); g.step(1 / 60); } };
  const reds = g.soldiers.filter((o) => o.team === 'red');
  const place = (e, x, z) => { e.vacant = false; e.spawn({ x, z, ry: 0 }, 0); W.settle(e); e.vel.set(0, 0, 0); e.fallTop = e.pos.y; e.zoneT = 0; e.protT = 0; e.maxHp = 100; e.hp = 100; return e; };
  const put = (v, x, z, yaw) => { if (!v.alive) V.trySpawn(v, true); v.st.x = x; v.st.z = z; v.st.y = W.heightAt(x, z); v.st.yaw = yaw; if (v.def.turret) { v.st.tyaw = yaw; v.st.gp = 0; } v.st.vx = v.st.vy = v.st.vz = 0; v.st.air = false; v.sleep = false; };
  const YE = -Math.PI / 2, X0 = 270, Z0 = -390;
  let booms = []; const ex0 = g.explode.bind(g); g.explode = (p, ...a) => { booms.push({ x: p.x, y: p.y, z: p.z, name: a[3] }); return ex0(p, ...a); };
  // 1) tank nişan yakınsaması: kamera ışınının (artı) çarptığı nokta → gy / gp girdisi → mermi artının noktasına düşer (BF3 / 4: "mermi artının ortasına")
  const t = V.list.find((x) => x.id === 'B-T1'); put(t, X0, Z0, YE); s.pos.set(t.st.x + 2.4, t.st.y, t.st.z); s.protT = 0; V.enter(s, t, 0);
  const res = [];
  for (const [R, camUp] of [[45, 4.1], [90, 4.1], [140, 4.1]]) {
    const cam = { x: X0 - 10.5, y: t.st.y + camUp, z: Z0 }, P = { x: X0 + R, y: W.heightAt(X0 + R, Z0) + 0.05, z: Z0 + 0.3 };
    const L = Math.hypot(P.x - cam.x, P.y - cam.y, P.z - cam.z), cd = { x: (P.x - cam.x) / L, y: (P.y - cam.y) / L, z: (P.z - cam.z) / L };
    const A = V.gunAimFor(t, cam, cd, s, {});
    step(200, { yw: YE, pt: 0, gy: A.y, gp: A.p });
    t.rl = 0; booms = []; step(1, { yw: YE, pt: 0, gy: A.y, gp: A.p, fh: 1, fp: 1 }); let n = 0; while (V.shells.length && n < 300) { step(1, { gy: A.y, gp: A.p }); n++; }
    const b = booms.find((x) => x.name === C.name);
    res.push(b ? Math.hypot(b.x - A.P.x, b.z - A.P.z) : 99);
  }
  ok(res.every((e) => e < 1.2), 'tank: mermi ARTININ gösterdiği noktaya düşer (kamera ışını → balistik top açısı), 45 / 90 / 140 m', res.map(f2).join(' / ') + ' m fark');
  V.exit(s); put(t, X0 - 60, Z0 + 40, YE);
  // 2) helikopter pilotu: korna yok; sol tık burun topu (sabit, burnun yönü) piyadeyi öldürür; sağ tık roket (HE) — tek pilot ateş edebilir
  const hl = V.list.find((x) => x.id === 'B-H1'); put(hl, X0, Z0, YE); s.pos.set(hl.st.x + 3, hl.st.y, hl.st.z); s.protT = 0; V.enter(s, hl, 0);
  const e1 = place(reds[0], X0 + 45, Z0);
  const N = VT['heli-n'].nose, aimP = (e) => { const o = {}; const c = e.center(); const dx = c.x - (X0 + N.f), dy = c.y - (hl.st.y + N.u); return Math.atan2(dy, Math.abs(dx)) - N.dp; };
  hl.st.pitch = aimP(e1);                                                // burnu hedefe eğ (pilot burnu fareyle çevirir; eğimi elle ver)
  let k = 0, horn = false; for (; k < 240 && e1.alive; k++) { h.queue.push(inp({ yw: YE, fh: 1 })); g.step(1 / 60); hl.st.pitch = aimP(e1); horn ||= hl.horn; }
  ok(!horn && !e1.alive, 'helikopter pilotu: sol tık = burun topu (korna yok), 45 m\'deki askeri öldürür', `${f2(k / 60)} sn · ısı ${f2(s.vheat || 0)}`);
  hl.st.pitch = 0;
  const j = V.list.find((x) => x.id === 'R-J1'); put(j, X0 + 40, Z0, 0); j.team = 'red'; j.hp = j.def.hp; g.step(1 / 60);
  const e2 = place(reds[1], X0 + 41, Z0 + 3);
  const rk0 = hl.rk; hl.st.pitch = Math.atan2(j.st.y + 0.7 - (hl.st.y + 0.6), 40 - 1.75) - VT['heli-n'].rockets.dp;
  booms = []; let n = 0;
  for (; n < 200; n++) { h.queue.push(inp({ yw: YE, rk: 1 })); g.step(1 / 60); hl.st.pitch = Math.atan2(j.st.y + 0.7 - (hl.st.y + 0.6), 40 - 1.75) - VT['heli-n'].rockets.dp; if (!j.alive) break; }
  const rb = booms.filter((b) => b.name === 'Roket');
  ok(rk0 === 14 && hl.rk < 14 && rb.length >= 1 && !j.alive && !e2.alive, 'helikopter roketleri (12.201: Q / orta tık, girdi rk): jipi patlatır, yanındaki asker ölür (HE sıçrama)', `${14 - hl.rk} roket · ${rb.length} patlama · ${f2(n / 60)} sn`);
  for (let i = 0; i < 400 && hl.rk > 0; i++) { h.queue.push(inp({ yw: YE, rk: 1 })); g.step(1 / 60); }
  const rr0 = hl.rkR; step(Math.ceil(VT['heli-n'].rockets.reload * 60) + 5, { yw: YE });
  ok(hl.rk === 0 || hl.rk === 14, 'roket kapsülü boşalınca ' + VT['heli-n'].rockets.reload + ' sn dolum', `dolum başında ${f1(rr0)} sn · sonra ${hl.rk}`);
  // tanka roket: orta / zayıf (130 × 1,25 = ~160)
  const tr = V.list.find((x) => x.id === 'R-T1'); put(tr, X0 + 60, Z0 + 30, 0); tr.team = 'red'; tr.hp = VT.tank.hp;
  const P3 = (x, y, z) => new (s.pos.constructor)(x, y, z), R3 = VT['heli-n'].rockets;
  g.explode(P3(tr.st.x, tr.st.y + 1.2, tr.st.z - VT.tank.hl - 0.15), R3.radius, R3.dmg, s, R3.name, undefined, 'at', { he: true, inner: R3.inner, vehInner: R3.vehInner });
  ok(VT.tank.hp - tr.hp > 120 && VT.tank.hp - tr.hp < 200, 'roket → tank: orta hasar (≈ 6–7 roket)', `${Math.round(VT.tank.hp - tr.hp)}`);
  // burun topu (20 mm, hmg) → jip ağır, tank 0
  const j2 = V.list.find((x) => x.id === 'R-J2'); put(j2, X0 + 80, Z0 + 40, 0); j2.team = 'red'; j2.hp = j2.def.hp;
  const h0 = j2.hp, t0 = tr.hp; V.damage(j2, N.dmg, s, 'hmg'); V.damage(tr, N.dmg, s, 'hmg');
  ok(h0 - j2.hp === N.dmg * VT.jip.hmgMul && tr.hp === t0, 'burun topu: jipe × ' + VT.jip.hmgMul + ' (≈ 40 mermi), tanka 0', `jip ${f1(h0 - j2.hp)} · tank ${f1(t0 - tr.hp)}`);
  V.exit(s);
  // 3) ısınma: kesintisiz ateşte aşırı ısınır, kilitlenir, soğuyunca açılır
  const g2 = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 4, type: 'conquest' } }), V2 = g2.vehicles;
  const sg = g2.claimSlot('blue', 'Nişancı', 'assault', {}), hg = g2.humans.get(sg.id), jb = V2.list.find((x) => x.id === 'B-J1');
  sg.pos.set(jb.st.x + 2, jb.st.y, jb.st.z); sg.protT = 0; V2.enter(sg, jb, 1);
  let q2 = 0, shots = 0, hotAt = -1, coolAt = -1;
  const sh0 = g2.netEvents.length;
  for (let i = 0; i < 60 * 12; i++) { const fire = i < 60 * 7; hg.queue.push({ q: ++q2, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: jb.st.yaw + 0.3, pt: 0.05, w: sg.cur, c: 0, p: 0, u: 0, fh: fire ? 1 : 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null }); g2.step(1 / 60); if (hotAt < 0 && sg.vhot) hotAt = i / 60; if (hotAt >= 0 && coolAt < 0 && !sg.vhot) coolAt = i / 60; }
  shots = g2.netEvents.slice(sh0).filter((x) => x.e === 'sh' && x.by === sg.id).length;
  ok(sg.seat === 1 && hotAt > 3 && hotAt < 6 && coolAt - hotAt > 1 && coolAt - hotAt < 3 && shots > 30, 'jip makinelisi (koltuk 2): kesintisiz ateşte ~4–5 sn\'de aşırı ısınır, ~1,5 sn kilitli (soğuyunca açılır)', `ısındı ${f1(hotAt)} sn · açıldı ${f1(coolAt)} sn · ${shots} atış`);
  // 4) jip makinelisi düşmanı öldürür (360°: arkaya da) + yükseliş sınırı
  const e3 = g2.soldiers.find((o) => o.team === 'red'); e3.vacant = false; e3.spawn({ x: jb.st.x + Math.sin(jb.st.yaw) * 30, z: jb.st.z + Math.cos(jb.st.yaw) * 30, ry: 0 }, 0); g2.world.settle(e3); e3.protT = 0; e3.hp = 100; e3.zoneT = 0;
  sg.vheat = 0; sg.vhot = false; let kk = 0;
  for (; kk < 300 && e3.alive; kk++) { const ey = sg.eye(), c = e3.center(), dx = c.x - ey.x, dz = c.z - ey.z; hg.queue.push({ q: ++q2, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: Math.atan2(-dx, -dz), pt: Math.atan2(c.y - ey.y, Math.hypot(dx, dz)), w: sg.cur, c: 0, p: 0, u: 0, fh: 1, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null }); g2.step(1 / 60); e3.zoneT = 0; }
  ok(!e3.alive, 'jip makinelisi 360°: arkadaki (30 m) düşmanı öldürür', `${f2(kk / 60)} sn`);
  // sürücüsüz jip (sürücü makineliye geçti) el freniyle durur
  const sd = g2.claimSlot('blue', 'Tek', 'assault', {}), hd = g2.humans.get(sd.id), jj = V2.list.find((x) => x.id === 'B-J2');
  sd.pos.set(jj.st.x + 2, jj.st.y, jj.st.z); sd.protT = 0; V2.enter(sd, jj, 0); jj.st.x = 0; jj.st.z = 330; jj.st.y = g2.world.heightAt(0, 330); jj.st.yaw = 0;
  let q3 = 0; for (let i = 0; i < 180; i++) { hd.queue.push({ q: ++q3, f: 1, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 0, w: sd.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0 }); g2.step(1 / 60); }
  const v0 = V2.speed(jj); hd.queue.push({ q: ++q3, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 0, w: sd.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 2, vl: 0 }); g2.step(1 / 60);
  let tStop = 0; while (V2.speed(jj) > 0.3 && tStop < 8) { hd.queue.push({ q: ++q3, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 0, w: sd.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0 }); g2.step(1 / 60); tStop += 1 / 60; }
  ok(sd.seat === 1 && v0 > 12 && tStop < 4, 'tek kişi: 2 tuşuyla makineliye geçer, sürücüsüz jip el freniyle durur', `${f1(v0 * 3.6)} km/s → ${f1(tStop)} sn'de durdu`);
}

// bot kapı / kule nişancısı: yerdeki insan sürücülü tankta bot nişancı, 35 m'deki düşmana 6 sn içinde isabet (makul: ilk saniyede öldürmez)
function botGunner() {
  console.log('── başsız: bot nişancı ──');
  const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', bots: true, match: { perTeam: 4, type: 'conquest' } }), V = g.vehicles, W = g.world;
  const hb = g.claimSlot('blue', 'Sürücü', 'assault', {}), hq = g.humans.get(hb.id), t = V.list.find((x) => x.id === 'B-T1');
  hb.pos.set(t.st.x + 2.4, t.st.y, t.st.z); hb.protT = 0; V.enter(hb, t, 0);
  t.st.x = 0; t.st.z = 330; t.st.y = W.heightAt(0, 330); t.st.yaw = 0; t.st.tyaw = 0;
  const m = g.soldiers.find((e) => e.team === 'blue' && e.brain); V.enter(m, t, 1);
  for (const e of g.soldiers) if (e.team === 'red' && e.alive) { e.pos.set(600, W.heightAt(600, -600), -600); }
  const foe = g.soldiers.find((e) => e.team === 'red' && e.brain); foe.vacant = false; foe.spawn({ x: 25, z: 305, ry: 0 }, 0); W.settle(foe); foe.protT = 0; foe.hp = foe.maxHp;
  foe.brain.frozen = true; const fb = foe.brain; g.brains = g.brains.filter((b) => b !== fb);
  let k = 0, firstHit = -1, hp0 = foe.hp, shots = 0;
  const sh0 = g.netEvents.length;
  for (; k < 600 && foe.alive; k++) { hq.queue.push({ q: k + 1, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 0, w: hb.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null }); foe.pos.set(25, W.heightAt(25, 305), 305); g.step(1 / 60); if (firstHit < 0 && foe.hp < hp0) firstHit = k; }
  shots = g.netEvents.slice(sh0).filter((x) => x.e === 'sh' && x.by === m.id).length;
  ok(m.veh === t && m.seat === 1 && firstHit >= 0 && firstHit / 60 > 0.25, 'bot kule nişancısı 35 m\'deki düşmana ateş eder ve isabet ettirir (ilk isabet anında değil)', `ilk isabet ${firstHit >= 0 ? f2(firstHit / 60) : '—'} sn · ${shots} atış · ${foe.alive ? 'canlı ' + Math.round(foe.hp) : 'öldü ' + f1(k / 60) + ' sn'}`);
}

// ───────── 2) çevrim içi ─────────
async function online(chromium) {
  console.log('── çevrim içi: tank topu sıçraması (A sürücü, B gözlemci) ──');
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });      // başsız (iki pencere: arkadakinin girdisi işlenmiyor)
  const mk = async () => { const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); return p; };
  const A = await mk(), B = await mk();
  await A.goto(`${URL0}/?online=new&name=Ali&server=${encodeURIComponent(SRV)}&map=kuzey&type=conquest&per=4&team=blue&debug=1&nolock=1&nologin=1`);
  await A.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
  const code = await A.evaluate(() => window.__game._badgeCode);
  await B.goto(`${URL0}/?online=${code}&name=Veli&team=blue&server=${encodeURIComponent(SRV)}&debug=1&nolock=1&nologin=1`);
  await B.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
  await A.evaluate(() => window.__game.online.send({ t: 'dbg', bots: false }));
  await A.waitForTimeout(1200);
  const jp = await A.evaluate(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'B-T1'); return [v.st.x, v.st.z]; });
  await A.evaluate((p) => window.__game.online.send({ t: 'dbg', tp: [p[0] + 2.6, p[1]] }), jp);
  await A.waitForTimeout(1200);
  await A.keyboard.press('KeyE'); await A.waitForTimeout(900);
  await A.evaluate(() => window.__game.online.send({ t: 'dbg', vtp: [270, -390, -Math.PI / 2] }));
  await B.evaluate(() => window.__game.online.send({ t: 'dbg', tp: [338, -372] }));
  await A.waitForTimeout(1500);
  for (const P of [A, B]) await P.evaluate(() => { const g = window.__game; g._feed = []; g._tsb = 0; g.online.ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.t === 'ev') for (const x of m.l) { if (x.e === 'kill') g._feed.push([x.k, x.v, x.w]); if (x.e === 'tsb') { g._tsb++; g._tsbP = x.p; } } }); });
  const ids = await A.evaluate(() => { const g = window.__game, r = g.soldiers.filter((s) => s.team === 'red' && s.alive); g.online.send({ t: 'dbg', tps: [r[0].id, 350, -391.2, 0, 100] }); g.online.send({ t: 'dbg', tps: [r[1].id, 350, -388.8, 0, 100] }); return [r[0].id, r[1].id]; });
  await A.waitForTimeout(900);
  await B.evaluate(() => { const g = window.__game, me = g.playerSoldier; me.yaw = Math.atan2(-(350 - me.pos.x), -(-390 - me.pos.z)); me.pitch = -0.1; });
  // A: nişangâhı (predictShell) düşmanların 3 m önüne getir (pencere önde: arkadaki pencerede kare döngüsü durur)
  await A.bringToFront();
  const aim = await A.evaluate(async () => {
    const g = window.__game, me = g.playerSoldier, v = me.veh, V = g.vehicles;
    const YE = -Math.PI / 2, TP = { x: v.st.x + 77, y: g.world.heightAt(v.st.x + 77, v.st.z) + 0.05, z: v.st.z };
    // 12.188: oyuncu gibi ARTIYI (kamera ışını) hedef noktaya koy — top balistik olarak oraya hedeflenir (gy / gp)
    const aimCam = () => { const c = g.camera.position, dx = TP.x - c.x, dy = TP.y - c.y, dz = TP.z - c.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(dy, Math.hypot(dx, dz)); };
    const iv = setInterval(aimCam, 8); aimCam();
    const tw0 = performance.now(), tr = [];
    while (performance.now() - tw0 < 12000) { await new Promise((r) => setTimeout(r, 250)); tr.push(+v.st.tyaw.toFixed(2)); const pp = V.predictShell(v, me); if (pp && Math.abs(pp.p.x - TP.x) < 1 && Math.abs(pp.p.z - TP.z) < 0.6) break; }
    window.__tr = [tr.slice(0, 12), Math.round(performance.now() - tw0)];
    await new Promise((r) => setTimeout(r, 400)); clearInterval(iv);
    const p = V.predictShell(v, me); return { tr: window.__tr, pitch: me.pitch, yaw: me.yaw, st: [v.st.x, v.st.z, v.st.yaw, v.st.tyaw, v.st.gp].map((x) => +x.toFixed(2)), pred: p && [p.p.x, p.p.y, p.p.z].map((x) => +x.toFixed(2)), rl: v.rl };
  });
  await A.screenshot({ path: `${OUT}/sonra/20-cevrimici-A-nisan.png` });
  await A.evaluate(() => { window.__game.player.fireHeld = true; }); await A.waitForTimeout(100); await A.evaluate(() => { window.__game.player.fireHeld = false; });
  await Promise.all([A.waitForTimeout(560).then(() => A.screenshot({ path: `${OUT}/sonra/21-cevrimici-A-patlama.png` })), B.waitForTimeout(600).then(() => B.screenshot({ path: `${OUT}/sonra/22-cevrimici-B-patlama.png` }))]);
  await A.waitForTimeout(1800);
  const res = await Promise.all([A, B].map((P) => P.evaluate((ids) => { const g = window.__game; return { tsb: g._tsb, tp: g._tsbP, pos: ids.map((i) => [g.soldiers[i].pos.x, g.soldiers[i].pos.z].map((x) => +x.toFixed(1))), feed: g._feed.filter((x) => ids.includes(x[1])), hp: ids.map((i) => (g.soldiers[i].alive ? Math.round(g.soldiers[i].hp) : 'X')) }; }, ids)));
  ok(res[0].tsb >= 1 && res[1].tsb >= 1, 'çevrim içi: patlama (tsb) iki istemcide de', JSON.stringify(res));
  ok(res[0].feed.length === 2 && JSON.stringify(res[0].feed) === JSON.stringify(res[1].feed) && res[0].feed.every((x) => x[2] === C.name), 'çevrim içi: 3 m önüne düşen top iki düşmanı da öldürür, iki istemcide aynı öldürme akışı ("Tank topu")', JSON.stringify(res[0].feed) + ' · nişan ' + JSON.stringify(aim));
  // 12.188 helikopter pilotu tek başına: burun topu + roketler sunucuda; B izler ('sh' by A, 'ts' w 1, öldürme akışı aynı)
  await A.keyboard.press('KeyE'); await A.waitForTimeout(800);
  const hp = await A.evaluate(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'B-H1'); return [v.st.x, v.st.z]; });
  await A.evaluate((p) => window.__game.online.send({ t: 'dbg', tp: [p[0] + 3.2, p[1]] }), hp); await A.waitForTimeout(1200);
  await A.keyboard.press('KeyE'); await A.waitForTimeout(900);
  const hseat = await A.evaluate(() => { const me = window.__game.playerSoldier; return [me.veh?.id, me.seat]; });
  await A.evaluate(() => window.__game.online.send({ t: 'dbg', vtp: [290, -392, -Math.PI / 2] })); await A.waitForTimeout(1200);
  for (const P of [A, B]) await P.evaluate(() => { const g = window.__game; g._sh = 0; g._rk = 0; g._feed2 = []; g.online.ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.t === 'ev') for (const x of m.l) { if (x.e === 'sh' && x.vm) g._sh++; if (x.e === 'ts' && x.w === 1) g._rk++; if (x.e === 'kill') g._feed2.push([x.k, x.v, x.w]); } }); });
  const ids2 = await A.evaluate(() => { const g = window.__game, r = g.soldiers.filter((s) => s.team === 'red' && s.alive); g.online.send({ t: 'dbg', tps: [r[0].id, 304.5, -393, 0, 100] }); g.online.send({ t: 'dbg', tps: [r[1].id, 305, -391, 0, 100] }); return [r[0].id, r[1].id]; });
  await A.waitForTimeout(900);
  await B.evaluate(() => { const g = window.__game, me = g.playerSoldier; me.yaw = Math.atan2(-(305 - me.pos.x), -(-392 - me.pos.z)); me.pitch = -0.12; });
  await A.evaluate(() => { const g = window.__game, me = g.playerSoldier; me.yaw = -Math.PI / 2; me.pitch = -0.1; g.player.fireHeld = true; });
  await A.waitForTimeout(700); await A.evaluate(() => { const g = window.__game; g.player.fireHeld = false; g.player.mmb = true; });      // 12.201 roket: orta tık (sağ tık = yakınlaştırma)
  await A.waitForTimeout(500); await Promise.all([A.screenshot({ path: `${OUT}/sonra/23-cevrimici-A-pilot-roket.png` }), B.screenshot({ path: `${OUT}/sonra/24-cevrimici-B-pilot-roket.png` })]);
  await A.waitForTimeout(900); await A.evaluate(() => { window.__game.player.mmb = false; });
  await A.waitForTimeout(800);
  const res2 = await Promise.all([A, B].map((P) => P.evaluate((ids) => { const g = window.__game; return { sh: g._sh, rk: g._rk, feed: g._feed2.filter((x) => ids.includes(x[1])) }; }, ids2)));
  ok(hseat[0] === 'B-H1' && hseat[1] === 0 && res2[1].sh > 3 && res2[1].rk >= 1, 'çevrim içi helikopter pilotu (tek kişi): burun topu izleri + roketler diğer istemcide görünür', JSON.stringify({ seat: hseat, B: { sh: res2[1].sh, rk: res2[1].rk } }));
  ok(res2[0].feed.length >= 1 && JSON.stringify(res2[0].feed) === JSON.stringify(res2[1].feed), 'çevrim içi: pilot silahlarıyla öldürme iki istemcide aynı', JSON.stringify(res2.map((r) => r.feed)));
  ok(!A.errs.length && !B.errs.length, 'çevrim içi: sayfa hatası yok', [...A.errs, ...B.errs].slice(0, 2).join(' | '));
  await browser.close();
}

if (!ONLY || ONLY === 'headless') { headless(); headlessGuns(); botGunner(); }
if (ONLY === 'guns') headlessGuns();
let chromium = null; try { ({ chromium } = await import('playwright')); } catch { console.log('(playwright yok: tarayıcı denetimleri atlandı)'); }
const up = async (u) => { try { const r = await fetch(u); return r.ok || r.status === 426; } catch { return false; } };
fs.mkdirSync(`${OUT}/sonra`, { recursive: true });
if (chromium && (!ONLY || ONLY === 'online') && (await up(SRV.replace(/^ws/, 'http') + '/health')) && (await up(URL0))) await online(chromium);
console.log(fails ? `sonuç: ${fails} HATA` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
