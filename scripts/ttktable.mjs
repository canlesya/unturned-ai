// 12.198 Silah denge tablosu (başsız): her piyade silahı için öldürme süresi (TTK) — 5 / 15 / 30 / 60 / 100 m.
//   A) Kuramsal: gövde / kafa / bacak atış sayısı × atış aralığı (WSTATS dmg, range, minMul, rpm, pellets; TUNE.headMul / legMul; paintball head / legs).
//      Pompalı: tüm saçmalar isabet ederse (üst sınır).
//   B) Gerçek ışın (Monte Carlo): Soldier._shoot → spreadNow (saçılım + açılma + ilk atış indirimi) → game.hitSoldier (gerçek vuruş kutusu),
//      insan atıcı, göğse nişan, duran hedef, tepme yok (oyuncu telafi eder). Nişanlı (adsT 1) ve belden (adsT 0). Ortalama TTK (sn); 3 sn'de / şarjörde
//      öldüremezse "—" (öldürme oranı %).
//   node scripts/ttktable.mjs [N=300] [hp=100]      MD=dosya.md → markdown tablo yazar · JSON=dosya.json → ham sonuç
import { Game } from '../src/game/game.js';
import { WSTATS, CLASS_DEFS } from '../src/game/stats.js';
import { TUNE } from '../src/game/balance.js';
import * as THREE from 'three';
const N = +(process.argv[2] || 300), HP = +(process.argv[3] || 100);
const DISTS = [5, 15, 30, 60, 100];
let seed = 7; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const g = new Game(null, { headless: true, map: 'kasaba', diff: 'easy', match: { perTeam: 1, type: 'tdm', tickets: 500 } });
const A = g.claimSlot('blue', 'Ali'), B = g.claimSlot('red', 'Veli'); g.brains.length = 0;
const s = g.soldiers.find((o) => o.id === A.id), t = g.soldiers.find((o) => o.id === B.id);
let dirs = []; g.shootRay = (sh, o, d) => dirs.push([o.clone(), d.clone()]);
g.paint.fire = (sh, o, d) => dirs.push([o.clone(), d.clone()]);       // paintball: top yolu yerine düz ışın (kısa mesafe yaklaşık)

const GROUPS = {
  'Tüfek': ['ak47', 'm4a1', 'scarh', 'aug', 'g36', 'ak74u'],
  'SMG': ['mp5', 'vector', 'p90', 'mac10'],
  'Makineli': ['lmg', 'pkm'],
  'Keskin / DMR': ['sniper', 'svd', 'barrett'],
  'Pompalı': ['shotgun', 'aa12', 'dbl'],
  'Tabanca': ['pistol', 'm1911', 'deagle', 'revolver'],
  'Uzay': ['laser', 'plasma', 'epistol', 'railgun', 'scatter', 'elmg'],
  'Cephe (WW2)': ['ww_bolt', 'ww_sniper', 'ww_semi', 'ww_smgb', 'ww_smgr', 'ww_lmg', 'ww_mg', 'ww_pistol'],
  'Paintball': ['pbrifle', 'pbpistol'],
};
const fall = (st, d) => (st.ball ? 1 : d <= st.range[0] ? 1 : st.minMul + (1 - st.minMul) * Math.max(0, 1 - (d - st.range[0]) / (st.range[1] - st.range[0])));
const zoneMul = (st, z) => (z === 'head' ? (st.ball ? st.head ?? 1.5 : TUNE.headMul) : z === 'legs' ? (st.ball ? st.legs ?? 1 : TUNE.legMul) : 1);
function theory(st, d, zone, hp = HP) {
  const per = st.dmg * fall(st, d) * zoneMul(st, zone) * (st.pellets || 1);
  const n = Math.ceil(hp / per - 1e-9);
  if (n > st.mag) return { n, t: null };
  return { n, t: (n - 1) * 60 / st.rpm };
}
function mc(id, d, adsT, n = N, hp = HP) {
  const st = WSTATS[id]; s.items[0] = { id, mag: 999, reserve: 0 }; s.cur = 0; s.human = true;
  s.pos.set(0, 0, 0); t.pos.set(0, 0, -d); t.yaw = 0; t.alive = true; t.proneT = 0; t.crouching = false;
  const e = s.eye(new THREE.Vector3()), c = t.center(new THREE.Vector3());
  const gap = 60 / st.rpm;
  let tt = 0, kills = 0, hitsum = 0, shotsum = 0;
  for (let i = 0; i < n; i++) {
    s.vel.set(0, 0, 0); s.onGround = true; s.crouching = false; s.sinceShot = 5; s.bloom = 0; s.firedSprinting = false; s.recoilP = 0; s.adsT = adsT; s.botExtraSpread = 0; s.inSeq = undefined;
    s.yaw = Math.atan2(-(c.x - e.x), -(c.z - e.z)); s.pitch = Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z));
    let dmg = 0, time = 0, k = 0, dead = false;
    for (k = 0; k < st.mag && time <= 3; k++) {
      s.recoilP = 0; dirs = []; s._shoot(st); shotsum++;
      for (const [o, dd] of dirs) {
        const h = g.hitSoldier(t, o, dd, 1000);
        if (h) { hitsum++; dmg += st.dmg * fall(st, h.t) * zoneMul(st, h.zone); }
      }
      if (dmg >= hp - 1e-6) { dead = true; break; }
      time += gap; s.sinceShot = gap; s.bloom = Math.max(0, s.bloom - gap * 0.05);
      s.yaw = Math.atan2(-(c.x - e.x), -(c.z - e.z)); s.pitch = Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z));
    }
    if (dead) { kills++; tt += time; }
  }
  return { ttk: kills ? tt / kills : null, kill: kills / n, acc: hitsum / Math.max(1, shotsum * (st.pellets || 1)) };
}
const fmt = (x) => (x == null ? '—' : (x * 1000).toFixed(0));
const out = {}, md = [];
const adsOf = (id) => { const st = WSTATS[id]; return st.adsTime || (st.scope ? 1 / 6 : 1 / 9); };
md.push(`TTK (ms, ${HP} can). Kuramsal: gövde / kafa atış sayısı × aralık. MC: gerçek ışın + saçılım (göğse nişan, duran hedef, tepme yok), nişanlı / belden. — = öldüremez (şarjör / 3 sn); MC'de % öldürme oranı < 90 ise parantezde.`);
md.push('');
md.push('| silah | dmg×saçma | rpm | şarjör | menzil (m) | uzakta× | hareket× | nişan sn | ' + DISTS.map((d) => `${d} m gövde/kafa (atış)`).join(' | ') + ' | ' + DISTS.map((d) => `MC nişan ${d}`).join(' | ') + ' | ' + [5, 15, 30].map((d) => `MC bel ${d}`).join(' | ') + ' |');
md.push('|' + '---|'.repeat(8 + DISTS.length * 2 + 3));
for (const [grp, ids] of Object.entries(GROUPS)) {
  md.push(`| **${grp}** |` + ' |'.repeat(7 + DISTS.length * 2 + 3));
  for (const id of ids) {
    const st = WSTATS[id]; if (!st) continue;
    const r = { th: {}, mcA: {}, mcH: {} };
    const cells = DISTS.map((d) => { const b = theory(st, d, 'body'), h = theory(st, d, 'head'); r.th[d] = { b, h }; return `${fmt(b.t)}/${fmt(h.t)} (${b.n}/${h.n})`; });
    const mcc = (d, ads) => { const m = mc(id, d, ads); (ads ? r.mcA : r.mcH)[d] = m; return fmt(m.ttk) + (m.kill < 0.9 ? ` (%${Math.round(m.kill * 100)})` : ''); };
    const ca = DISTS.map((d) => mcc(d, 1)), ch = [5, 15, 30].map((d) => mcc(d, 0));
    out[id] = r;
    md.push(`| ${st.name} \`${id}\` | ${st.dmg}${st.pellets ? '×' + st.pellets : ''} | ${st.rpm} | ${st.mag} | ${st.ball ? '—' : st.range.join('–')} | ${st.ball ? 1 : st.minMul} | ${st.move} | ${adsOf(id).toFixed(2)} | ${cells.join(' | ')} | ${ca.join(' | ')} | ${ch.join(' | ')} |`);
  }
}
// yakın dövüş: vuruş başına bekleme = savurma süresi × 0,8 (zincir), saplama ×stabMul; arkadan tek vuruş
md.push('');
md.push('| yakın dövüş | hasar | erişim m | savurma sn | 100 can vuruş / TTK ms | 125 can (Ağır) vuruş / ms |');
md.push('|---|---|---|---|---|---|');
for (const id of ['knife', 'machete', 'tomahawk']) {
  const st = WSTATS[id];
  const ttkM = (hp) => { let d = 0, t2 = 0, k = 0; while (d < hp && k < 10) { const kind = st.swings[k % 3]; d += st.dmg * (kind === 'stab' ? st.stabMul : 1); if (d >= hp) break; t2 += (kind === 'stab' ? st.stabT : st.swingT) * 0.8; k++; } return [k + 1, t2]; };
  const a = ttkM(100), b = ttkM(125);
  out[id] = { a, b };
  md.push(`| ${st.name} | ${st.dmg} | ${st.reach} | ${st.swingT} | ${a[0]} / ${fmt(a[1])} | ${b[0]} / ${fmt(b[1])} |`);
}
// patlayıcılar (piyadeye; game.explode: hasar × (1 − (d / yarıçap)²))
md.push('');
md.push('| patlayıcı | hasar | yarıçap m | adet | 100 canı öldüren yarıçap (hasar × (1 − (d/r)²)) |');
md.push('|---|---|---|---|---|');
for (const id of ['rpg', 'm79', 'grenade', 'claymore']) { const st = WSTATS[id]; out[id] = { dmg: st.dmg, r: st.radius }; md.push(`| ${st.name} | ${st.dmg} | ${st.radius} | ${st.count} | ${(st.radius * Math.sqrt(Math.max(0, 1 - 100 / st.dmg))).toFixed(1)} m |`); }
md.push('');
md.push('Sınıflar: ' + Object.entries(CLASS_DEFS).map(([k, c]) => `${c.label} can ${c.hp} hız ×${c.speed}`).join(' · '));
const text = md.join('\n');
console.log(text);
if (process.env.MD) (await import('fs')).writeFileSync(process.env.MD, text + '\n');
if (process.env.JSON) (await import('fs')).writeFileSync(process.env.JSON, JSON.stringify(out));
process.exit(0);
