// 12.164 Delip geçme testi (ağsız, doğrudan Game — sunucunun koştuğu kodun aynısı).  node scripts/penetrate.mjs
//   Düz, engelsiz test dünyası (World([])): arka arkaya dizilmiş 2–4 düşman, 20 / 60 / 120 m; her silah → hedef başına hasar tablosu.
//   Ayrıca: kafa / gövde / bacak her hedefte ayrı · takım arkadaşı ışını kesmez (hasar yok, hak harcamaz) · en çok hedef sayısı ·
//   duvar arkası (kalın ve ince levha; TUNE.penWalls KAPALI → vurulmaz, AÇIK → yalnız ince levhadan, delen silahla) · ahşap kapı eskisi gibi ·
//   olaylar: hm.pn (2./3. hedef), kill.pn / kill.pc (tek mermide 2 öldürme), sh.b (başkalarının ekranında delinen askerlerin kanı) · bot atışı aynı kural.
// Çevrim içi karşılaştırma (sunucu isabeti = istemci tahmini): scripts/penetratenet.mjs
import { Game } from '../src/game/game.js';
import { World } from '../src/game/collision.js';
import { WSTATS, PEN } from '../src/game/stats.js';
import { TUNE } from '../src/game/balance.js';
import * as THREE from 'three';

let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const V = THREE.Vector3;
const g = new Game(null, { headless: true, map: 'kasaba', diff: 'easy', match: { perTeam: 5, type: 'tdm', tickets: 500 } });
const A = g.claimSlot('blue', 'Atici');
g.brains.length = 0;
const reds = g.soldiers.filter((s) => s.team === 'red'), blues = g.soldiers.filter((s) => s.team === 'blue' && s !== A);
const bounds = g.map.bounds;
const flat = (cols = []) => { g.world = new World(cols, bounds, null); };
// herkesi uzağa park et (ışına girmesin), dirileri hazırla
const park = () => { let i = 0; for (const s of g.soldiers) { if (s === A) continue; s.pos.set(-500 - i * 5, 0, -500); s.alive = true; s.hp = s.maxHp = 100000; s.protT = 0; s.height = 1.78; s.proneT = 0; s.leanOff.set(0, 0, 0); s.vacant = false; i++; } };
const put = (s, x, z = 0, y = 0) => { s.pos.set(x, y, z); s.yaw = Math.PI / 2; s.alive = true; s.protT = 0; };
A.alive = true; A.pos.set(0, 0, 0); A.rewindTick = null;
// ateş: A'nın gözünden (x ekseni boyunca) hedef noktaya, sapmasız tek ışın
function fire(id, from, to) {
  const st = WSTATS[id], d = to.clone().sub(from).normalize();
  g.netEvents.length = 0;
  const hp0 = g.soldiers.map((s) => s.hp);
  g.shootRay(A, from.clone(), d, st, from.clone());
  const dmg = g.soldiers.map((s, i) => +(hp0[i] - s.hp).toFixed(1));
  return { dmg, ev: g.netEvents.slice() };
}
const EYE = (y = 0) => new V(0, y + 1.6, 0);

// ── 1) hasar tablosu: 4 düşman arka arkaya (1,5 m aralık), gövde hizası ──
flat();
const IDS = [...Object.keys(PEN), 'ak47', 'scarh', 'm4a1', 'lmg', 'pkm', 'mp5', 'pistol', 'deagle', 'revolver', 'laser', 'elmg', 'ww_semi', 'ww_mg'];
console.log('\nsilah        mesafe   1. hedef  2. hedef  3. hedef  4. hedef   (gövde; çarpan = hedef / ilk hedef)');
const table = {};
for (const id of IDS) {
  for (const D of [20, 60, 120]) {
    park();
    const T = reds.slice(0, 4);
    T.forEach((s, k) => put(s, D + k * 1.5));
    const r = fire(id, EYE(), new V(D, 1.1, 0));
    const ds = T.map((s) => r.dmg[s.id]);
    table[id + '@' + D] = ds;
    console.log(`${id.padEnd(12)} ${String(D).padStart(4)} m  ${ds.map((x) => String(x).padStart(8)).join('  ')}   ${ds[0] ? ds.map((x) => (x / ds[0]).toFixed(2)).join(' / ') : ''}`);
  }
}
for (const id of Object.keys(PEN)) {
  const p = PEN[id], ds = table[id + '@20'];
  const n = ds.filter((x) => x > 0).length;
  check(n === p.length, `${id}: 20 m'de ${n} hedef vuruldu (en çok ${p.length})`);
  check(ds.every((x, k) => k >= p.length || Math.abs(x - ds[0] * p[k]) < 0.6), `${id}: hedef başına çarpan ${p.join(' / ')}`);
}
for (const id of ['ak47', 'scarh', 'lmg', 'mp5', 'pistol', 'deagle', 'laser', 'ww_semi']) check(table[id + '@20'].filter((x) => x > 0).length === 1, `${id}: delmez (yalnız ilk hedef)`);
check(table['sniper@120'][1] > 0 && table['barrett@120'][2] > 0, '120 m\'de de delip geçer (mesafe düşüşü hedef başına)');

// ── 2) bölge her hedefte ayrı: yüksekten aşağı eğik ışın → 1. kafa, 2. gövde, 3. bacak ──
park();
A.pos.set(0, 3, 0);
const [h1, h2, h3] = reds;
put(h1, 20); put(h2, 23.3); put(h3, 28);
{
  g.netEvents.length = 0;
  const r = fire('sniper', EYE(3), new V(20, 1.6, 0));
  const exp = (k, zm) => 105 * PEN.sniper[k] * zm;
  console.log(`      eğik ışın: ${[h1, h2, h3].map((s) => r.dmg[s.id]).join(' / ')} (beklenen kafa ${exp(0, TUNE.headMul).toFixed(1)}, gövde ${exp(1, 1).toFixed(1)}, bacak ${exp(2, TUNE.legMul).toFixed(1)})`);
  check(Math.abs(r.dmg[h1.id] - exp(0, TUNE.headMul)) < 0.6 && Math.abs(r.dmg[h2.id] - exp(1, 1)) < 0.6 && Math.abs(r.dmg[h3.id] - exp(2, TUNE.legMul)) < 0.6, 'kafa / gövde / bacak her hedefte ayrı (çarpan × bölge)');
}
A.pos.set(0, 0, 0);

// ── 3) takım arkadaşı: ışını kesmez, hasar almaz, hak harcamaz ──
park();
const F = blues[0];
put(F, 10); put(reds[0], 20); put(reds[1], 21.5); put(reds[2], 23);
for (const id of ['sniper', 'svd', 'ak47']) {
  const r = fire(id, EYE(), new V(20, 1.1, 0));
  const ds = reds.slice(0, 3).map((s) => r.dmg[s.id]);
  check(r.dmg[F.id] === 0 && ds[0] > 0 && ds.filter((x) => x > 0).length === (PEN[id]?.length || 1), `${id}: önündeki takım arkadaşı hasar almadı, düşmanlar ${ds.join(' / ')}`);
}

// ── 4) duvar arkası: kalın duvar (0,5 m) ve ince levha (0,08 m); seçenek kapalı / açık ──
const wallThick = { min: [10, 0, -3], max: [10.5, 4, 3], tag: 'wall', oid: 'test:kalın' };
const wallThin = { min: [10, 0, -3], max: [10.08, 4, 3], oid: 'test:ince' };
const door = { min: [10, 0, -3], max: [10.1, 4, 3], tag: 'wood', oid: 'test:kapı' };
const behind = (cols, id, on) => { flat(cols); TUNE.penWalls = on ? 1 : 0; park(); put(reds[0], 20); put(reds[1], 21.5); const r = fire(id, EYE(), new V(20, 1.1, 0)); TUNE.penWalls = 0; return [r.dmg[reds[0].id], r.dmg[reds[1].id], r]; };
check(TUNE.penWalls === 0, 'varsayılan: ince duvar seçeneği KAPALI');
for (const id of ['sniper', 'barrett', 'ak47']) {
  const [a1] = behind([wallThick], id, false), [b1] = behind([wallThin], id, false), [c1] = behind([wallThick], id, true);
  check(a1 === 0 && b1 === 0 && c1 === 0, `${id}: kalın / ince duvar arkasındaki hedef vurulmaz (seçenek kapalı), kalın duvar açıkken de`);
}
{
  const [s1, s2, r] = behind([wallThin], 'sniper', true), [k1] = behind([wallThin], 'ak47', true);
  check(Math.abs(s1 - 105 * TUNE.penWallMul) < 0.6 && Math.abs(s2 - 105 * TUNE.penWallMul * PEN.sniper[1]) < 0.6 && k1 === 0, `seçenek AÇIK: M24 ince levhadan geçer (${s1} / ${s2}), AK-47 geçmez`);
  check(Array.isArray(r.ev.find((e) => e.e === 'sh')?.tw), 'ince levha geçişi sh.tw ile yayınlanır');
  const [d1] = behind([door], 'ak47', false), [d2, d3] = behind([door], 'sniper', false);
  check(Math.abs(d1 - table['ak47@20'][0] * TUNE.woodMul) < 0.6 && Math.abs(d2 - 105 * TUNE.woodMul) < 0.6 && Math.abs(d3 - 105 * TUNE.woodMul * PEN.sniper[1]) < 0.6, `ahşap kapı eskisi gibi (AK ${d1}; M24 ${d2} / ${d3})`);
}
flat();

// ── 5) olaylar: tek mermide iki öldürme (kafa hizası) → hm.pn, kill.pn / pc, sh.b ──
park();
put(reds[0], 30); put(reds[1], 31.5); reds[0].hp = reds[1].hp = reds[0].maxHp = reds[1].maxHp = 100;
{
  const r = fire('sniper', EYE(), new V(30, 1.6, 0));
  const hm = r.ev.filter((e) => e.e === 'hm' && e.by === A.id), kl = r.ev.filter((e) => e.e === 'kill' && e.k === A.id), sh = r.ev.find((e) => e.e === 'sh');
  console.log('      olaylar:', JSON.stringify(r.ev));
  check(!reds[0].alive && !reds[1].alive, 'M24 kafa hizasında arka arkaya iki düşmanı tek mermiyle öldürdü');
  check(hm.length === 2 && !hm[0].pn && hm[1].pn === 1, 'hm: 1. isabet pn yok, 2. isabet pn = 1');
  check(kl.length === 2 && !kl[0].pn && kl[1].pn === 1 && kl[1].pc === 2, 'kill: 2. öldürme pn = 1, pc = 2 (ÇİFTE)');
  check(sh && sh.k === 'a' && Array.isArray(sh.b) && sh.b.length === 6, 'sh: M24 3 hakkından 2\'sini kullandı → mermi sürer (k=a), iki askerin kanı b alanında');
  check(g._pen == null, 'delip geçme durumu atıştan sonra temizlendi');
}
park();
put(reds[0], 30); reds[0].hp = 100;
{
  const r = fire('sniper', EYE(), new V(30, 1.1, 0)), sh = r.ev.find((e) => e.e === 'sh');
  console.log('      ', JSON.stringify(sh));
  check((sh.k === 'a' || sh.k === 'w') && sh.b?.length === 3, 'tek hedef: mermi içinden geçip sürer (k=w zemine), kan b alanında');
  park(); put(reds[0], 30);
  const r2 = fire('ak47', EYE(), new V(30, 1.1, 0)), sh2 = r2.ev.find((e) => e.e === 'sh');
  console.log('      ', JSON.stringify(sh2));
  check(sh2.k === 'f' && !sh2.b, 'delmeyen silahta olay biçimi değişmedi (k=f, b yok)');
}

// ── 5b) admin bir hedefin çarpanını 0 yaparsa mermi orada durur ──
park(); put(reds[0], 20); put(reds[1], 21.5); put(reds[2], 23);
{
  const keep = WSTATS.sniper.pen[2]; WSTATS.sniper.pen[2] = 0;
  const r = fire('sniper', EYE(), new V(20, 1.1, 0)), sh = r.ev.find((e) => e.e === 'sh');
  WSTATS.sniper.pen[2] = keep;
  check(r.dmg[reds[2].id] === 0 && r.dmg[reds[1].id] > 0 && sh.k === 'f', 'pen.2 = 0 (admin): 3. hedefe geçmez, mermi 2. askerde durur');
}

// ── 6) bot atışı aynı kuralla (gerçek tryFire → _shoot → shootRay, Math.random sapma) ──
park();
const bot = blues[1];
bot.pos.set(0, 0, 0); bot.yaw = -Math.PI / 2; bot.pitch = 0; bot.alive = true;
bot.items[0] = { id: 'sniper', mag: 99, reserve: 0 }; bot.cur = 0; bot.botExtraSpread = 0;
put(reds[0], 20); put(reds[1], 21.5); put(reds[2], 23);
let both = 0;
for (let i = 0; i < 10; i++) {
  for (const s of reds.slice(0, 3)) s.hp = 100000;
  bot.cd = 0; bot.reloadT = 0; bot.switchT = 0; bot.useT = 0; bot.adsT = 1; bot.ads = true; bot.sinceShot = 5;
  const e = bot.eye(); const tg = new V(20, 1.1, 0); bot.yaw = Math.atan2(-(tg.x - e.x), -(tg.z - e.z)); bot.pitch = Math.atan2(tg.y - e.y, Math.hypot(tg.x - e.x, tg.z - e.z));
  bot.tryFire();
  const ds = reds.slice(0, 3).map((s) => 100000 - s.hp);
  if (ds.filter((x) => x > 0).length >= 2) both++;
}
check(both >= 8, `bot M24 ile ${both}/10 atışta arka arkaya en az iki düşmanı deldi`);

console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
