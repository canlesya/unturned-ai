// Cephe modu hızlı başsız denetim: node scripts/frontquick.mjs [NvN] [sn]
// Kurulum (8 nokta, 4 aşama doğuşu, FRONT_KIT donanımı, 1940'lar üniforması), kural (yalnız etkin sektör alınır, sektör düşünce doğuş kayar + bilet ödülü,
// bilet / süre biterse Kırmızı, son sektör düşerse Mavi), sonra botlu kısa maç (takılma yok, hata yok).
import { MapBuilder } from '../src/maps/builder.js';
import { Game } from '../src/game/game.js';
import { TUNE } from '../src/game/balance.js';
MapBuilder.noVisual = true;
const N = +(process.argv[2] || 8), SEC = +(process.argv[3] || 60);
const ok = [], bad = [];
const chk = (c, m) => (c ? ok : bad).push(m);
const mk = () => new Game(null, { headless: true, map: 'cephe', diff: 'normal', match: { perTeam: N, type: 'front', time: 1200 } });
let g = mk();
chk(g.front && g.mode.objectives.length === 8, 'kurulum: 8 nokta');
chk(g.mode.objectives.every((o) => o.owner === 'red' && o.sector >= 0), 'başlangıç: tüm noktalar savunanda');
chk(g.soldiers.filter((s) => s.team === 'blue').every((s) => s.items[0].id.startsWith('ww_')), 'Mavi donanımı 1940\'lar');
chk(g.soldiers.every((s) => s.items[0].id.startsWith('ww_')), 'tüm donanım 1940\'lar');
const t0 = g.tickets.blue;
chk(t0 > 0 && g.tickets.red === 4, `bilet: Mavi ${t0}, Kırmızı = kalan sektör 4`);
// yalnız etkin sektör: C'ye Mavi koy → alınmamalı
for (const b of g.brains) b.update = () => {};
const blue = g.soldiers.filter((s) => s.team === 'blue'), red = g.soldiers.filter((s) => s.team === 'red');
for (const s of red) { s.alive = false; s.respawnT = 1e9; }
const C = g.mode.objectives.find((o) => o.id === 'C'), A = g.mode.objectives.find((o) => o.id === 'A'), Bo = g.mode.objectives.find((o) => o.id === 'B');
const put = (s, o) => { s.pos.set(o.x, g.world.heightAt(o.x, o.z), o.z); s.vel.set(0, 0, 0); };
for (const s of blue) put(s, C);
for (let i = 0; i < 600; i++) g.step(1 / 60);
chk(C.owner === 'red' && C.p === -1, 'kilitli sektör (C) alınmadı');
const sp0 = g.map.spawns.red[0];
// A + B al
blue.forEach((s, i) => put(s, i % 2 ? A : Bo));
let tsec = 0;
for (let i = 0; i < 60 * 60 && g.front.sector === 0; i++) { g.step(1 / 60); blue.forEach((s, j) => { if (s.alive) put(s, j % 2 ? A : Bo); }); tsec = i / 60; }
chk(g.front.sector === 1, `sektör 1 düştü (${tsec.toFixed(1)} sn)`);
chk(g.map.spawns.red[0] !== sp0 && g.map.spawns.red[0].z < -30, 'savunanın doğuşu geri kaydı (çukur yol)');
chk(g.tickets.blue >= t0 + Math.round(t0 * TUNE.frBonus) - 2, `bilet ödülü (+${Math.round(t0 * TUNE.frBonus)})`);
chk(A.owner === 'blue' && Bo.owner === 'blue', 'geçilen noktalar Mavi (kilitli)');
// bilet bitişi → Kırmızı
g.tickets.blue = 0; g.step(1 / 60);
chk(g.ended && g.winner === 'red', 'bilet bitti → Kırmızı kazandı');
// süre bitişi → Kırmızı
g = mk(); g.timeLeft = 0.01; g.step(1 / 60); g.step(1 / 60);
chk(g.ended && g.winner === 'red', 'süre bitti → Kırmızı kazandı');
// son sektör → Mavi
g = mk(); while (g.front.sector < 3) g.front.advance(true);
for (const o of g.front.active()) { o.owner = 'blue'; o.p = 1; }
g.step(1 / 60);
chk(g.ended && g.winner === 'blue', 'son sektör düştü → Mavi kazandı');
// botlu kısa maç
g = mk();
let t1 = performance.now(), steps = 0, err = null;
try { for (let i = 0; i < SEC * 60 && !g.ended; i++) { g.step(1 / 60); steps++; } } catch (e) { err = e; }
const ms = (performance.now() - t1) / steps;
chk(!err, 'botlu maç hatasız' + (err ? ': ' + err.stack.split('\n').slice(0, 3).join(' | ') : ''));
const kills = g.soldiers.reduce((a, s) => a + s.kills, 0);
console.log(`botlu ${N}v${N} ${SEC} sn: adım ${ms.toFixed(2)} ms, öldürme ${kills}, sektör ${g.front.sector}, bilet ${g.tickets.blue}, sahipler ${g.mode.objectives.map((o) => o.id + (o.owner ? o.owner[0] : '-')).join(' ')}`);
for (const m of ok) console.log('OK  ', m);
for (const m of bad) console.log('HATA', m);
process.exit(bad.length ? 1 : 0);
