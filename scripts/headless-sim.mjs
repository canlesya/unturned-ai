// Başsız (headless) oyun testi — tarayıcı yok: node scripts/headless-sim.mjs [harita=kasaba] [NvN=10] [saniye=240]
// Game'i opts.headless ile kurar, botları saniyede 30 adımla oynatır, özet basar. Hata sayısı 0 olmalı.
import { Game } from '../src/game/game.js';

const map = process.argv[2] || 'kasaba';
const per = +(process.argv[3] || 10);
const secs = +(process.argv[4] || 240);

const t0 = performance.now();
const game = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type: 'conquest' } });
const tBuild = performance.now() - t0;

let errors = 0, flagEvents = 0;
game.on('flag', () => flagEvents++);
const dt = 1 / 30;
const s0 = performance.now();
let steps = 0;
try {
  for (; steps < secs * 30 && !game.ended; steps++) game.step(dt);
} catch (e) { errors++; console.log('HATA:', e.stack); }
const ms = performance.now() - s0;

const S = game.soldiers;
const bad = S.filter((s) => !Number.isFinite(s.pos.x + s.pos.y + s.pos.z) || s.pos.y < -5);
console.log(`harita: ${game.map.name} · ${per}v${per} · kurulum ${tBuild.toFixed(0)} ms`);
console.log(`simülasyon: ${(steps * dt).toFixed(0)} sn · adım ${(ms / steps).toFixed(2)} ms · biten: ${game.ended ? game.winner + ' (' + game.endReason + ')' : 'hayır'}`);
console.log(`biletler: mavi ${Math.round(game.tickets.blue)} / kırmızı ${Math.round(game.tickets.red)} · hayatta ${S.filter((s) => s.alive).length}/${S.length} · bayrak değişimi ${flagEvents}`);
console.log('hedefler: ' + game.mode.objectives.map((o) => `${o.name}:${o.owner || '-'}`).join(', '));
console.log(`öldürme toplamı ${S.reduce((a, s) => a + s.kills, 0)} · geçersiz/yeraltı: ${bad.length}`);
const ok = errors === 0 && bad.length === 0 && flagEvents > 0;
console.log(ok ? 'sonuç: OK' : 'sonuç: HATA');
process.exit(ok ? 0 : 1);
