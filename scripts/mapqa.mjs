// Toplu harita kalite denetimi:  node scripts/mapqa.mjs [harita...] [--full]
//   araç çakışması · çatı/yüksek döşeme/iç içe yapı özeti · boşluk üstü kaplama · z-fighting (toplu çözümle) ; --full: ayrıca zıplayarak "içinden geçilen hacim" taraması (yavaş)
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2), full = args.includes('--full'), maps = args.filter((a) => !a.startsWith('--'));
const run = (title, file, extra = []) => {
  console.log(`\n######## ${title}`);
  const r = spawnSync(process.execPath, [file, ...extra], { encoding: 'utf8', env: { ...process.env, TOP: process.env.TOP || '6' }, cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
  process.stdout.write(r.stdout || ''); if (r.stderr) process.stderr.write(r.stderr);
  return r.status;
};
let bad = 0;
bad += run('araç çakışması', 'scripts/vehaudit.mjs', maps) ? 1 : 0;
bad += run('kaplama boşluk üstünde mi (halı/membran merdiven boşluğunu örtüyor mu)', 'scripts/mapfloat.mjs', maps) ? 1 : 0;
run('z-fighting (toplu çözüm raporu)', 'scripts/mapzfight.mjs', maps);
run('çatı / yüksek döşeme / iç içe yapı', 'scripts/mapaudit.mjs', maps);
if (full) for (const m of (maps.length ? maps : ['kasaba', 'vadi', 'us', 'dev'])) run(`içinden geçilen hacim: ${m}`, 'scripts/probes/passthru.mjs', [m, '0.5']);
console.log(bad ? '\nKALİTE DENETİMİ: sorun var' : '\nKALİTE DENETİMİ: temiz');
process.exit(bad ? 1 : 0);
