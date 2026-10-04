// Silah Yarışı (headless): merdiven, seviye atlama, bıçakla geri düşme, kazanma ve bot maçı. node scripts/ggtest.mjs
import { Game } from '../src/game/game.js';
import { GG_LADDER, ggItems, WSTATS } from '../src/game/stats.js';
import { GG_LEN } from '../src/game/match.js';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
check(GG_LEN === GG_LADDER.length, `merdiven uzunluğu ${GG_LADDER.length}`);
check(GG_LADDER.every((id) => WSTATS[id]) && GG_LADDER.at(-1) === 'knife' && WSTATS.knife.kind === 'melee', 'tüm silahlar tanımlı, son seviye bıçak');
const g = new Game(null, { headless: true, map: 'kasaba', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 4, type: 'gg', time: 900 } });
g.brains = [];
const [a, b, c] = g.soldiers;
check(g.ffa && g.mode.gungame && g.soldiers.length === 4, 'herkes tek, 4 savaşçı');
check(a.items.length === 2 && a.items[0].id === 'm4a1' && a.items[1].id === 'knife', `başlangıç: ${a.items.map((i) => i.id)}`);
for (const s of g.soldiers) { s.protT = 0; }
const kill = (killer, victim) => { victim.protT = 0; victim.takeDamage(9999, killer, 'body', victim.pos, 'test'); };
const respawnAll = () => { for (let i = 0; i < 30 * 5; i++) g.step(1 / 30); for (const s of g.soldiers) s.protT = 0; };
kill(a, b); check(a.ggLevel === 1 && a.items[0].id === 'ak47', `1 öldürme → seviye 2 (${a.items[0].id})`);
respawnAll();
check(b.alive && b.ggLevel === 0 && b.items[0].id === 'm4a1', 'ölen seviyesini korur (bıçak değil)');
// bıçakla öldürme: katil bıçağa geçer, kurban bir seviye geriler
a.setLevel(5); b.setLevel(7); a.cur = 1;                                  // a bıçak elde
check(a.stat.kind === 'melee', 'bıçak elde');
kill(a, b); respawnAll();
check(a.ggLevel === 6 && b.ggLevel === 6 && b.items[0].id === ggItems(6).at(0).id, `bıçak öldürmesi: katil ${a.ggLevel + 1}, kurban 8 → ${b.ggLevel + 1}`);
// seviye 1'de bıçakla ölen daha aşağı inmez
b.setLevel(0); a.cur = 1; kill(a, b); respawnAll(); check(b.ggLevel === 0, 'seviye 1 altına inilmez');
// son seviye: bıçak, ilk bıçak öldürmesi kazandırır; silahla öldürme yetmez
a.setLevel(GG_LADDER.length - 1); check(a.items[0].id === 'knife', 'son seviye bıçak'); respawnAll();
check(!g.ended, 'bitmedi'); a.cur = 0; kill(a, c);
for (let i = 0; i < 40; i++) g.step(1 / 30);
check(g.ended && g.winner === a.team, `bıçak öldürmesiyle kazandı: ${g.endReason}`);
// bot maçı
const g2 = new Game(null, { headless: true, map: 'kasaba', tod: 'day', weather: 'clear', diff: 'hard', match: { perTeam: 6, type: 'gg', time: 600 } });
let err = 0, lv = 0;
try { for (let i = 0; i < 600 * 30 && !g2.ended; i++) g2.step(1 / 30); } catch (e) { err++; console.log(e.stack); }
const top = [...g2.soldiers].sort((x, y) => y.ggLevel - x.ggLevel)[0];
console.log(`      bot maçı: ${Math.round(g2.time)} sn · bitti ${g2.ended} · kazanan ${top.name} seviye ${top.ggLevel + 1} · tüm seviyeler ${g2.soldiers.map((s) => s.ggLevel + 1).join(',')}`);
check(err === 0 && g2.soldiers.every((s) => Number.isFinite(s.pos.x + s.pos.y + s.pos.z)), 'bot maçında hata yok');
check(Math.max(...g2.soldiers.map((s) => s.ggLevel)) >= 5, 'botlar seviye atlıyor');
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
