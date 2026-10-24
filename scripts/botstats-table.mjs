// botstats.mjs JSON satırlarını tabloya çevirir: node scripts/botstats-table.mjs once.jsonl [sonra.jsonl]
// İki dosya verilirse aynı (harita, mod, zorluk) satırları "önce→sonra" olarak yan yana yazılır.
import fs from 'node:fs';
const load = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const A = load(process.argv[2]), B = process.argv[3] ? load(process.argv[3]) : null;
const key = (r) => `${r.map}|${r.type}|${r.diff}`;
const cols = [['kills', 'öldürme'], ['lifeAvg', 'yaşam sn'], ['acc', 'isabet%'], ['head', 'kafa%'], ['reactMed', 'tepki'], ['firstHitMed', 'ilk isabet'], ['killDistMed', 'öl.mes'], ['snKills', 'nişancı öl.'], ['snKillDistMed', 'nş.mes'],
  ['expo', 'görünür%'], ['expoIdle', 'boşta açık%'], ['unaware', 'habersiz hasar%'], ['block', 'sürtünme%'], ['stuckPerMin', 'takılma/dk'], ['spinPerMin', 'dönme/dk'], ['jumpsPerMin', 'zıplama/dk'], ['objPct', 'bayrakta%'], ['flags', 'bayrak'], ['routeRep', 'rota tekrar'], ['brainMsStep', 'beyin ms/adım'], ['kd', 'K/Ö mavi·kırmızı']];
const fmt = (v) => (v && typeof v === 'object' ? `${v.blue} · ${v.red}` : String(v));
const rows = A.map((a) => [key(a), a, B ? B.find((b) => key(b) === key(a)) : null]);
const head = ['harita | mod | zorluk', ...cols.map((c) => c[1])];
console.log('| ' + head.join(' | ') + ' |');
console.log('|' + head.map(() => '---').join('|') + '|');
for (const [k, a, b] of rows) console.log('| ' + [k.replace(/\|/g, ' · '), ...cols.map(([c]) => (b ? `${fmt(a[c])} → ${fmt(b[c])}` : fmt(a[c])))].join(' | ') + ' |');
if (process.env.ROLES) for (const [k, a, b] of rows) console.log(`${k}: sınıf ${a.cls}${b ? `\n   sonra roller ${b.roles}` : ` · roller ${a.roles}`}`);
