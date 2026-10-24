// Bot davranışı parmak izi (tohumlu Math.random): node scripts/botdeterm.mjs [harita=kasaba] [mod=conquest] [NvN=6] [sn=90]
// Aynı tohumla iki kod sürümünün çıktısı birebir aynıysa o modda bot davranışı değişmemiştir (ör. Vagon'a özgü değişikliğin diğer modlara etkisi yok).
let seed = 12345;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const { Game } = await import('../src/game/game.js');
const [map = 'kasaba', type = 'conquest', per = '6', secs = '90'] = process.argv.slice(2);
const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: +per, type } });
for (let i = 0; i < +secs * 30 && !g.ended; i++) g.step(1 / 30);
let h = 0;
for (const s of g.soldiers) for (const v of [s.pos.x, s.pos.y, s.pos.z, s.hp, s.kills, s.deaths || 0]) h = (h * 31 + Math.round(v * 1000)) | 0;
console.log(`${map} ${type} ${per}v${per} ${secs} sn · öldürme ${g.soldiers.reduce((a, s) => a + s.kills, 0)} · parmak izi ${h >>> 0}`);
