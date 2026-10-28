// 12.206 oyuncu sayısına göre araç sayısı (kullanıcı: "kişi sayısına göre helikopter tank vs sayısı da artmalı"). VERİ + kural; three.js yok (sunucu,
// istemci, betikler ortak okur). Taban (≤ 16 kişilik takım) = haritanın kendi araç listesi (Kuzey: takım başına üste 2 tank, 5 jip, 2 helikopter, 4 motor).
// Büyük maçta üsse EK araç: çarpan m = 1 + log2(takım / 16), 1 ile 3,5 arası (16 → 1 · 24 → 1,58 · 32 → 2 · 48 → 2,58 · 64 → 3 · 128 → 3,5) → tür başına
// round(taban × m), tür sınırıyla (tank 7, jip 16, helikopter 6, motor 14). Ek doğuşlar haritanın listesinin SONUNA (motorlardan sonra) eklenir; sıra
// takım büyüklüğünden belirlenir → sunucu = istemci (ikisi de odanın perTeam'ini bilir). Ek helikopterlerin helipedi harita kurulumunda hep çizilir
// (kuzey.js; 10v10'da boş beton pist) — blockout'un ayak izi listesine girmez (girseydi orman / piyade doğuşu yerleşimi kayardı).
// Yerler scripts/vehscaleplan.mjs ile arandı (zemin düz, yol / su / yapı / ağaç / yaprak yok, piyade doğuşundan ≥ 3 m, tür aralığı, helipedin 13 m içinde
// rotoru kesen bir şey yok); scripts/vehground.mjs (PER=64) + mototest doğrular.
const PI = Math.PI;
export const VEH_BASE = { tank: 2, jip: 5, heli: 2, moto: 4 };
export const VEH_CAP = { tank: 7, jip: 16, heli: 6, moto: 14 };
export const vehMult = (per) => Math.max(1, Math.min(3.5, 1 + Math.log2(Math.max(1, per || 0) / 16)));
export const vehCount = (k, per) => Math.min(VEH_CAP[k], Math.round(VEH_BASE[k] * vehMult(per)));

// Ek doğuşlar (öncelik sırasıyla: önce gelen önce kullanılır). type 'heli-s' (saldırı) · pad: helipedin kimliği (aynı yerde)
const E = (team, k, list) => list.map(([x, z, ry], i) => ({ id: `${team === 'blue' ? 'B' : 'R'}-X${k[0].toUpperCase()}${i + 1}`, type: k === 'heli' ? 'heli-s' : k, team, x, z, ry, k, ...(k === 'heli' ? { pad: `${team === 'blue' ? 'B' : 'R'}HX${i + 1}` } : {}) }));
const DATA = {
  kuzey: {
    blue: {
      heli: [[30, 735, PI], [210, 735, PI], [180, 705, PI], [180, 645, PI]],
      tank: [[38, 668, PI], [118, 668, PI], [70, 655, PI], [70, 681, PI], [86, 655, PI]],
      jip: [[166, 656, PI], [174, 672, PI], [142, 664, PI], [198, 664, PI], [158, 672, PI], [182, 672, PI], [134, 664, PI], [206, 664, PI], [150, 656, PI], [150, 672, PI], [190, 672, PI]],
      moto: [[132, 648.4, -PI / 2], [132, 651, -PI / 2], [128, 640.6, -PI / 2], [136, 640.6, -PI / 2], [128, 643.2, -PI / 2], [136, 643.2, -PI / 2], [136, 638, -PI / 2], [128, 648.4, -PI / 2], [136, 635.4, -PI / 2], [136, 648.4, -PI / 2]],
    },
    red: {
      heli: [[-150, -735, 0], [-210, -735, 0], [-30, -735, 0], [-90, -645, 0]],
      tank: [[-38, -668, 0], [-86, -681, 0], [-70, -681, 0], [-70, -655, 0], [-134, -668, 0]],
      jip: [[-166, -672, 0], [-166, -656, 0], [-190, -664, 0], [-174, -672, 0], [-174, -656, 0], [-158, -656, 0], [-198, -664, 0], [-182, -672, 0], [-182, -656, 0], [-150, -672, 0], [-206, -664, 0]],
      moto: [[-132, -635.4, PI / 2], [-136, -640.6, PI / 2], [-128, -640.6, PI / 2], [-128, -643.2, PI / 2], [-136, -638, PI / 2], [-128, -638, PI / 2], [-136, -635.4, PI / 2], [-128, -648.4, PI / 2], [-128, -635.4, PI / 2], [-124, -640.6, PI / 2]],
    },
  },
};
export const VEH_SCALE = {};
for (const [map, T] of Object.entries(DATA)) {
  const spawns = [];
  for (const team of ['blue', 'red']) for (const k of ['heli', 'tank', 'jip', 'moto']) spawns.push(...E(team, k, T[team][k]));
  VEH_SCALE[map] = { spawns, helipads: spawns.filter((d) => d.pad).map((d) => ({ id: d.pad, team: d.team, x: d.x, z: d.z, r: 9 })) };
}
// Bu maçın ek araç doğuşları (takım başına kişi: perTeam). Tür başına (vehCount − taban) kadar, listedeki sırayla
export function extraSpawnsFor(map, per) {
  const S = VEH_SCALE[map?.id]; if (!S) return [];
  const out = [];
  for (const team of ['blue', 'red']) for (const k of ['heli', 'tank', 'jip', 'moto']) {
    const n = Math.max(0, vehCount(k, per) - VEH_BASE[k]);
    out.push(...S.spawns.filter((d) => d.team === team && d.k === k).slice(0, n));
  }
  return out;
}
export const extraHelipadsFor = (id) => VEH_SCALE[id]?.helipads || [];
