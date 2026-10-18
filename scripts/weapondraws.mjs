// Silah çizim çağrısı sayısı (birinci şahıs modeli = birleştirilmiş ağ sayısı) ve uzak (lod) modeli.  node scripts/weapondraws.mjs [kök=..]
const root = process.argv[2] || '..';
const { createWeapon, WEAPONS } = await import(new URL(`${root}/src/models/weapons.js`, import.meta.url));
let fp = 0, lod = 0; const rows = [];
for (const id of Object.keys(WEAPONS)) {
  const n = (g) => { let c = 0; g.traverse((o) => { if (o.isMesh && o.visible !== false) c++; }); return c; };
  const a = n(createWeapon(id, 'reddot')), b = n(createWeapon(id, 'reddot', true));
  fp += a; lod += b; rows.push(`${id}:${a}/${b}`);
}
console.log(rows.join(' '));
console.log('toplam birinci şahıs', fp, '· lod', lod);
