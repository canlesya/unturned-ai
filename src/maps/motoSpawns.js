// 12.204 arazi motosikleti doğuşları (VERİ). Harita kimliğine göre; game/vehicles.js haritanın kendi araç listesinin SONUNA ekler (araç sırası
// sunucu ve istemcide aynı). Alanlar haritanın araç verisiyle aynı: team 'blue' | 'red' | 'flag:X' (bayrağın sahibine) | null (tarafsız: herkes
// alabilir, yol noktası), ry = bakış (sin ry, cos ry). Yerler scripts/mototest.mjs ile denetlenir: zemin düz, ayak izinde kutu / ağaç / su /
// başka araç doğuşu yok (her motor 3,0 × 1,4 m ayak izi + 1,6 m ağaç payı).
// Üslerde 4'er (kapının yanındaki açık alanda, yolun doğusu / batısı; jip / tank sırasından uzak), bayraklarda 1'er (Kavşak 2), yol noktalarında
// tarafsız 4 motor.
const PI = Math.PI;
export const MOTO_SPAWNS = {
  kuzey: [
    // üs: kapı yolunun yanında yan yana (2,6 m ara), burun yola dönük (Mavi batıya, Kırmızı doğuya): binip sola / sağa kırınca kapıdan çıkar
    { id: 'B-M1', type: 'moto', team: 'blue', x: 132, z: 638, ry: -PI / 2 }, { id: 'B-M2', type: 'moto', team: 'blue', x: 132, z: 640.6, ry: -PI / 2 },
    { id: 'B-M3', type: 'moto', team: 'blue', x: 132, z: 643.2, ry: -PI / 2 }, { id: 'B-M4', type: 'moto', team: 'blue', x: 132, z: 645.8, ry: -PI / 2 },
    { id: 'R-M1', type: 'moto', team: 'red', x: -132, z: -638, ry: PI / 2 }, { id: 'R-M2', type: 'moto', team: 'red', x: -132, z: -640.6, ry: PI / 2 },
    { id: 'R-M3', type: 'moto', team: 'red', x: -132, z: -643.2, ry: PI / 2 }, { id: 'R-M4', type: 'moto', team: 'red', x: -132, z: -645.8, ry: PI / 2 },
    // bayraklar (bayrağın sahibine; bayrak alınınca doğar)
    { id: 'A-M', type: 'moto', team: 'flag:A', x: -542.5, z: 98.7, ry: -0.69 },
    { id: 'B-M', type: 'moto', team: 'flag:B', x: -255.5, z: 244.7, ry: 1.37 },
    { id: 'C-M1', type: 'moto', team: 'flag:C', x: 6.2, z: -24.4, ry: -0.18 }, { id: 'C-M2', type: 'moto', team: 'flag:C', x: -3.8, z: -26.3, ry: 0.11 },
    { id: 'D-M', type: 'moto', team: 'flag:D', x: 277.6, z: -295.5, ry: -1.73 },
    { id: 'E-M', type: 'moto', team: 'flag:E', x: 693, z: -95.8, ry: 0.19 },
    { id: 'F-M', type: 'moto', team: 'flag:F', x: 415.8, z: 399.3, ry: -0.65 },
    { id: 'G-M', type: 'moto', team: 'flag:G', x: -381.2, z: -424, ry: 3.1 },
    // yol noktaları (tarafsız)
    { id: 'Y-M1', type: 'moto', team: null, x: 51.1, z: 320.7, ry: -0.87 },        // Benzinlik
    { id: 'Y-M2', type: 'moto', team: null, x: -473.2, z: -26.5, ry: 2.53 },       // Değirmen
    { id: 'Y-M3', type: 'moto', team: null, x: 332.9, z: -73.3, ry: -2.32 },       // Doğu Geçidi
    { id: 'Y-M4', type: 'moto', team: null, x: -206.2, z: 44.8, ry: 2.84 },        // Batı Geçidi
  ],
};
export const motoSpawnsFor = (map) => MOTO_SPAWNS[map?.id] || [];
