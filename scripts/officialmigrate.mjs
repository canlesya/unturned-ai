// Resmi sunucu geçişi testi (12.101): eski data/official.json'a eksik modlar (gg / inf / pb) eklenir, admin düzenlemeleri korunur, bir kez yapılır.  node scripts/officialmigrate.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const SELF = fileURLToPath(import.meta.url);
if (process.argv[2] === 'load') {                       // alt süreç: listeyi yükle, özet yaz
  const { officialList } = await import('../server/officialStore.js');
  console.log(JSON.stringify(officialList().map((o) => ({ code: o.code, type: o.type, name: o.name, rot: o.rotation.length, voteSec: o.voteSec, idleMin: o.idleMin }))));
  process.exit(0);
}
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-off-'));
const load = () => JSON.parse(execFileSync(process.execPath, [SELF, 'load'], { env: { ...process.env, BF_DATA: dir } }).toString().trim().split('\n').pop());
// eski biçim: 3 sunucu, biri admin tarafından yeniden adlandırılmış ve OFC6 kodu kullanılıyor (çakışma)
const old = [
  { code: 'OFC1', name: 'Benim Sunucum', type: 'conquest', perTeam: 6, time: 600, rotation: [{ map: 'liman', tod: 'night', weather: 'clear' }] },
  { code: 'OFC3', name: 'TDM', type: 'tdm', perTeam: 8, time: 600, rotation: [{ map: 'depo', tod: 'day', weather: 'clear' }] },
  { code: 'OFC6', name: 'Özel DM', type: 'dm', perTeam: 10, time: 600, rotation: [{ map: 'us', tod: 'day', weather: 'clear' }] },
];
fs.writeFileSync(path.join(dir, 'official.json'), JSON.stringify(old));
const L1 = load();
check(L1.length === 6 && ['gg', 'inf', 'pb'].every((t) => L1.some((o) => o.type === t)), 'eksik modlar eklendi: ' + L1.map((o) => `${o.code}:${o.type}`).join(' '));
check(L1[0].name === 'Benim Sunucum' && L1[0].rot === 1 && L1[2].name === 'Özel DM', 'admin düzenlemeleri korundu');
check(new Set(L1.map((o) => o.code)).size === L1.length, 'kod çakışması yok');
check(L1.every((o) => o.voteSec === 15 && o.idleMin === 10), 'varsayılan oylama 15 sn, boş oda dönüşü 10 dk');
// admin pb odasını sildi → sonraki açılışta geri gelmez
const f = JSON.parse(fs.readFileSync(path.join(dir, 'official.json'), 'utf8')).filter((o) => o.type !== 'pb');
fs.writeFileSync(path.join(dir, 'official.json'), JSON.stringify(f));
const L2 = load();
check(L2.length === 5 && !L2.some((o) => o.type === 'pb'), 'geçiş bir kez: silinen mod geri eklenmedi');
fs.rmSync(dir, { recursive: true, force: true });
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
