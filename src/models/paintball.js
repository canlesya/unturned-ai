import * as THREE from 'three';
import { box, taperBox, cyl, cylY, ico, mat } from '../core/geo.js';
import { C } from '../core/palette.js';
import { M, finish, magGroup, studs, gripTexture, sling, vents } from './weapon_util.js';

// Paintball silahları (yalnız paintball modu; sınıf listelerinde yok). origin = kabza (sağ el), namlu -Z.
// Boya rengi taşıyan parçalar (hazne, tüp şarjör, pencere topları) ortak PB_PAINT malzemesindedir: tintPaint(g, renk) savaşçının boya rengine boyar
// (birleştirme ayrı malzemede tuttuğu için 1. şahıs + 3. şahıs + lod'da çalışır; renk başına tek malzeme önbelleği).
export const PB_BASE = '#ff8a00';
const PB_PAINT = mat(PB_BASE, { roughness: 0.34 });          // parlak plastik (düz değil: mergeVC köşe rengine katmaz → ayrı mesh, boyanabilir)
PB_PAINT.userData.pbPaint = true;
const PO = { roughness: 0.34 };
const RUB = '#1c1d21', DK = '#14151a', TANK = '#2d6cdf', TANK_O = { metalness: 0.45, roughness: 0.32 };

// Nişangâh montajı (weapons.js MOUNT ile birleşir): tüfekte hazne ARKASINDA yüksek kaide (red dot hazne tepesinin ~4,5 cm üstünden bakar), tabancada tüp şarjör üstü
export const MOUNT_PB = {
  pbrifle: { z: 0.062, y: 0.182 },
  pbpistol: { z: -0.045, y: 0.091, front: 0.104, rearZ: 0.03, frontZ: -0.158, frontBase: 0.091, scale: 0.72 },
};

// ───────────────────────── Paintball tüfeği (marker) ─────────────────────────
// Üstte iri yuvarlak hazne (boya rengi), dipçik yerine mavi CO2 tüpü, uzun ince delikli namlu, dikey ön kabza, tetik koruması
function pbrifle() {
  const g = new THREE.Group();
  box(g, [0.052, 0.078, 0.28], C.black, [0, 0.021, -0.07], null, M);                      // gövde
  taperBox(g, [0.046, 0.02, 0.27], C.gunLight, [0, 0.067, -0.07], null, [0.8, 1], [1, 1], M);   // üst kapak (eğimli)
  for (const sx of [-1, 1]) box(g, [0.004, 0.034, 0.17], '#3a7fd6', [sx * 0.0265, 0.018, -0.08]);   // yan renk şeridi (mavi eloksal)
  box(g, [0.04, 0.115, 0.05], RUB, [0, -0.07, 0.04], [0.22, 0, 0]);                         // kabza
  gripTexture(g, -0.035, 0.04, 0.04, 0.08, 4, 0.22, '#0c0c0e');
  box(g, [0.012, 0.012, 0.1], C.steel, [0, -0.047, -0.03]);                                // tetik koruması
  box(g, [0.012, 0.042, 0.012], C.steel, [0, -0.027, -0.08]);
  box(g, [0.008, 0.026, 0.008], C.chrome, [0, -0.026, -0.028], [0.25, 0, 0], M);           // tetik
  box(g, [0.014, 0.016, 0.03], C.steel, [0.03, 0.03, 0.02]);                               // emniyet / mod düğmesi
  box(g, [0.006, 0.02, 0.05], DK, [0.0265, 0.045, -0.14]);                                 // top besleme gözü
  // dikey ön kabza (sol el)
  box(g, [0.034, 0.105, 0.038], RUB, [0, -0.052, -0.255], [-0.08, 0, 0]);
  for (let i = 0; i < 4; i++) box(g, [0.036, 0.006, 0.04], '#0c0c0e', [0, -0.02 - i * 0.022, -0.257], [-0.08, 0, 0]);
  box(g, [0.04, 0.012, 0.044], C.steel, [0, -0.002, -0.255]);                              // kabza kelepçesi
  // uzun ince namlu (delikli uç)
  cyl(g, 0.0135, 0.0135, 0.44, C.steel, [0, 0.032, -0.43], 10, M);
  cyl(g, 0.019, 0.019, 0.03, C.black, [0, 0.032, -0.225], 10, M);                         // namlu yuvası
  cyl(g, 0.016, 0.016, 0.024, C.black, [0, 0.032, -0.652], 10, M);                         // namlu ağzı bileziği
  for (let i = 0; i < 6; i++) box(g, [0.007, 0.004, 0.012], DK, [0, 0.0465, -0.5 - i * 0.026]);   // üst delikler (porting)
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) box(g, [0.004, 0.006, 0.01], DK, [sx * 0.0135, 0.032, -0.53 - i * 0.03]);
  // besleme boynu + hazne (boya rengi): basık, nişan hattı tepesinin ~3,5 cm altında kalır
  cylY(g, 0.019, 0.022, 0.04, C.black, [0, 0.077, -0.05], 10, null, M);
  cylY(g, 0.026, 0.026, 0.008, C.steel, [0, 0.062, -0.05], 10, null, M);                   // boyun kelepçesi
  const hp = new THREE.Group();                                                           // hazne (birleştirmede ayrı: boyanabilir malzeme)
  g.add(hp);
  ico(hp, 0.072, PB_BASE, [0, 0.13, -0.05], 2, [0.86, 0.56, 1.22], PO);                    // gövde: basık yumurta (tepe 0,170)
  cylY(hp, 0.05, 0.05, 0.014, DK, [0, 0.094, -0.05], 12, null);                           // taban halkası
  for (const sx of [-1, 1]) {
    box(hp, [0.004, 0.02, 0.07], DK, [sx * 0.0595, 0.13, -0.05]);                         // yan pencere (koyu)
    for (let i = 0; i < 3; i++) ico(hp, 0.009, PB_BASE, [sx * 0.0605, 0.13, -0.073 + i * 0.023], 0, [0.6, 1, 1], PO);   // pencereden görünen toplar
  }
  const lid = magGroup(g);                                                                // kapak: doldururken yukarı açılır (reload)
  taperBox(lid, [0.066, 0.012, 0.096], DK, [0, 0.167, -0.05], null, [0.78, 0.8], [1, 1]);
  box(lid, [0.028, 0.007, 0.036], C.gunLight, [0, 0.175, -0.042]);                        // kapak mandalı
  // red dot kaidesi: haznenin arkasında alüminyum köprü (iki yan levha, ortası boş → nişanda arkası görünür)
  box(g, [0.036, 0.014, 0.05], C.gunLight, [0, 0.067, 0.062], null, M);
  for (const sx of [-1, 1]) taperBox(g, [0.006, 0.104, 0.046], C.gunLight, [sx * 0.012, 0.122, 0.062], null, [1, 0.8], [1, 1], M);
  box(g, [0.032, 0.008, 0.046], C.gunLight, [0, 0.178, 0.062], null, M);
  box(g, [0.034, 0.003, 0.03], C.black, [0, 0.1, 0.062]);                                 // ara bağlantı
  // dipçik: mavi CO2 tüpü + regülatör + dipçik pedi
  box(g, [0.04, 0.05, 0.05], C.steel, [0, 0.01, 0.095], null, M);                          // arka bağlantı / regülatör
  cyl(g, 0.026, 0.026, 0.03, C.chrome, [0, 0.0, 0.13], 10, M);                             // tüp vanası
  cyl(g, 0.042, 0.042, 0.23, TANK, [0, -0.005, 0.26], 12, TANK_O);                         // tüp
  cyl(g, 0.042, 0.03, 0.03, TANK, [0, -0.005, 0.39], 12, TANK_O);                          // tüp kubbesi
  for (const z of [0.18, 0.34]) cyl(g, 0.044, 0.044, 0.012, C.black, [0, -0.005, z], 12, M);   // tüp bantları
  box(g, [0.004, 0.03, 0.12], '#e8e8e4', [0.042, -0.005, 0.26]);                            // tüp etiketi
  box(g, [0.05, 0.1, 0.02], RUB, [0, -0.01, 0.41]);                                        // dipçik pedi
  box(g, [0.012, 0.012, 0.15], RUB, [0, -0.05, 0.19], [0.08, 0, 0]);                        // hortum (tüp → kabza)
  studs(g, [[0.02, -0.18], [0.02, 0.03]], C.steel, 0.008, 0.0265);
  vents(g, 0.0, -0.02, 3, 0.03, 0.0265, 0.016, 0.01);
  sling(g, [0, -0.04, 0.35]);
  return finish(g, {
    name: 'Paintball Tüfeği', mag: lid, magAxis: [0, 1, 0], hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.07, -0.255], muzzle: [0, 0.032, -0.67], length: 1.08,
  });
}

// ───────────────────────── Paintball tabancası ─────────────────────────
// Kompakt gövde, üstte boya renkli tüp şarjör (öne kayar), kabzada CO2 kartuşu (alttan çıkan gümüş kapak)
function pbpistol() {
  const g = new THREE.Group();
  box(g, [0.034, 0.05, 0.2], C.gun, [0, 0.03, -0.06], null, M);                             // gövde
  box(g, [0.03, 0.016, 0.18], C.black, [0, 0.0, -0.055]);                                  // alt çerçeve
  for (const sx of [-1, 1]) box(g, [0.003, 0.02, 0.12], '#3a7fd6', [sx * 0.0175, 0.03, -0.07]);   // yan şerit
  cyl(g, 0.011, 0.011, 0.07, C.steel, [0, 0.03, -0.19], 10, M);                             // namlu
  cyl(g, 0.014, 0.014, 0.014, C.black, [0, 0.03, -0.222], 10, M);
  box(g, [0.036, 0.105, 0.054], RUB, [0, -0.045, 0.022], [0.2, 0, 0]);                      // kabza (CO2 içinde)
  gripTexture(g, -0.02, 0.022, 0.036, 0.07, 4, 0.2, '#0c0c0e');
  cylY(g, 0.017, 0.017, 0.016, C.chrome, [0, -0.1, 0.034], 10, [0.2, 0, 0], M);             // CO2 kapağı (alttan)
  cylY(g, 0.012, 0.012, 0.012, C.steel, [0, -0.114, 0.037], 8, [0.2, 0, 0], M);
  box(g, [0.01, 0.012, 0.07], C.black, [0, -0.015, -0.04]);                                 // tetik koruması
  box(g, [0.01, 0.03, 0.01], C.black, [0, -0.002, -0.075]);
  box(g, [0.007, 0.02, 0.007], C.chrome, [0, -0.004, -0.035], [0.25, 0, 0], M);            // tetik
  box(g, [0.012, 0.012, 0.024], C.steel, [0.02, 0.022, -0.01]);                             // emniyet
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) box(g, [0.004, 0.03, 0.004], C.black, [sx * 0.0175, 0.032, 0.0 + i * 0.012]);   // arka tırtıl
  box(g, [0.024, 0.014, 0.05], C.black, [0, 0.062, 0.02]);                                  // besleme bloğu
  // tüp şarjör (öne kayar: reload)
  const tb = magGroup(g);
  cyl(tb, 0.0165, 0.0165, 0.18, PB_BASE, [0, 0.074, -0.065], 12, PO);
  cyl(tb, 0.019, 0.019, 0.016, DK, [0, 0.074, -0.16], 12);                                  // ön kapak
  cyl(tb, 0.019, 0.019, 0.012, DK, [0, 0.074, 0.03], 12);                                   // arka kapak
  for (const sx of [-1, 1]) box(tb, [0.003, 0.008, 0.11], DK, [sx * 0.016, 0.074, -0.065]);  // yan pencere
  return finish(g, {
    name: 'Paintball Tabancası', mag: tb, magAxis: [0, 0, -1], hold: 'pistol', gripR: [0, -0.03, 0.022], gripL: null, muzzle: [0, 0.03, -0.235], length: 0.3,
  });
}

export const PAINTBALL = { pbrifle, pbpistol };

// Boya renkli parçaları verilen renge boyar (aynı renkte malzeme paylaşılır)
const TINT = new Map();
export function tintPaint(root, color) {
  if (!root || !color) return root;
  let m = TINT.get(color);
  if (!m) { m = PB_PAINT.clone(); m.color.set(color); m.userData.pbPaint = true; TINT.set(color, m); }
  root.traverse((o) => { if (o.isMesh && o.material?.userData?.pbPaint) o.material = m; });
  return root;
}
