import * as THREE from 'three';
import { createWeapon } from '../models/weapons.js';
import { setSkinAlpha, setSkinProbe } from '../models/skins.js';
import { pbLook, spaceLook } from '../models/character.js';
import { spaceFire, spaceVm } from './space.js';
import { ww2Look } from '../models/ww2gear.js';
import { fpWearLook } from '../models/wear.js';                  // 12.167 kıyafet: birinci şahıs bilek manşeti
import { tintPaint } from '../models/paintball.js';
import { paintColorOf } from './paint.js';
import { TEAMS } from '../core/palette.js';
import { WSTATS, OPTICS, OPTIC_ALLOWED, ZT_ORDER } from './stats.js';
import { reloadAnim, meleePose, SWING_HIT_K, HEAVY_HIT_K, swingHitK } from './anim.js';
import { reloadPlan, reloadMode } from './reloadPlan.js';
import { reloadGeo, blendPoint, brkPoint, itemOff } from './reloadGeo.js';
import { fpHand, handBasis, zombieColors } from '../models/fpHands.js';
import { box } from '../core/geo.js';
import { clamp, lerp, V3, adsEase, ADS_HUD, zoomFov, SCOPE_ON, dirFromAngles } from './util.js';
import { applyInput } from '../sim/input.js';
import { proneLook, proneClamp } from '../sim/prone.js';
import { swimCanFire } from '../sim/swim.js';
import { LEAN_ROLL } from './soldier.js';
import { TUNE } from './balance.js';
import { TouchControls, isTouch } from './touch.js';
import { ScopeBreath } from './breath.js';
import { norm, codeLabel, slotOrder } from '../core/keybinds.js';
import { t as $t } from '../i18n/index.js';
import { vehCamera } from './vehicleView.js';
import { mgAt, seatGun, seatZoom, vehSeatArmed } from '../sim/vehicle.js';                   // 12.177 araç kamerası (sürücü içeriden / takip)
import { wName, opticName, fireName } from '../i18n/game.js';
import { opticSvg } from './opticIcons.js';

const VM_SCALE = 0.92;
const _q = new THREE.Quaternion(), _eu = new THREE.Euler(), _sp = new THREE.Vector3(), _sp2 = new THREE.Vector3();
export const FIRE_LABEL = { semi: 'Tek atış', burst: 'Seri (3-5 mermi)', auto: 'Otomatik' };
const ADS_FOV_PB = 68;   // 12.129: paintball (adsLow) nişanında silah kamerası 12.127 öncesi gibi genişler → marker sağ-altta görünür kalır, hazne görüşü kapatmaz
const ADS_FOV = 40;      // taslak (BattleBit): nişanda silah kamerası daralır → nişangâh ekranda ≈ 1,85 × (tan 34° / tan 20°); HUD #holo / #rdot aynı oranla büyüdü

// ───────────── Birinci şahıs silah modeli: ilk kutu eller (73b388f) ─────────────
// El = eldiven renkli kutu + gömlek renkli kol kutusu (silaha bağlı, silah yerelinde); yakın dövüş = sapı saran kutu yumruk. Zombi pençesi: organik yol (fpHands, ayrı kol, morph).
const Z = new THREE.Vector3(0, 0, 1);
const REST_L = new THREE.Vector3(-0.2, -0.3, 0.2);      // sol el dinlenme (kullanılmıyorsa ekran dışı)
// 12.195 yükleme: cep / dirsekler kamera uzayında (sağ el; sol el modunda aynalanır). Cep ekranın sol altının dışında (el orada görünmez)
const POUCH_CAM = new THREE.Vector3(-0.2, -0.6, -0.2), ELBOW_L = new THREE.Vector3(-0.3, -0.52, -0.2), ELBOW_R = new THREE.Vector3(0.3, -0.5, -0.18);
const RL_TILT = { p90: -0.22, rpg: 0, pbpistol: 0, ww_mg: 0.2 };                 // şarjör elde çekilirken eğilme (rad; dik şarjörde 0,3)
const _rlInv = new THREE.Matrix4(), _rlH = new THREE.Vector3(), _rlH2 = new THREE.Vector3(), _rlE = new THREE.Vector3(), _rlV = new THREE.Vector3(), _X = new THREE.Vector3(1, 0, 0), ZERO3 = new THREE.Vector3();
const POUCH_VM = new THREE.Vector3(-0.3, -0.34, 0.3);   // yelek şarjör cebi (silah yerelinde)
// ── Yakın dövüş (12.194, CS2 / Valorant referansı) ── tüm pozlar kamera uzayında, sağ el (sol el modunda aynalanır): p = yumruk (m), f = ağız ucunun baktığı yön, e = keskin kenarın baktığı yön (f'ye dik yapılır).
// Bekleme (CS2 varsayılan bıçak): yumruk sağ-altta, sap el sıkışır gibi yumrukta (parmaklar ağız tarafında sarılı, başparmak üstte siperin dibinde), ağız ileri-yukarı-sola,
// keskin kenar sola (ilk sağ→sol kesiğe hazır), yassı yüz kameraya dönük. Satır / tomahawk sap ucundan, daha dik ve ağır (baş / ağız yukarıda).
// spr = koşu (CS2 / Valorant: bıçak indirilir, ucu öne-aşağı): bekleme Euler açılarına eklenir.
export const K_ = (p, f, e) => ({ p, f, e });
const _fx = new THREE.Vector3(), _fy = new THREE.Vector3(), _fz = new THREE.Vector3(), _fm = new THREE.Matrix4();
const keyQ = (K) => {                                                              // f / e → dönüş (model −z = f, model −y = e)
  if (K.q) return K.q;
  _fz.set(...K.f).normalize().negate(); _fy.set(...K.e).normalize();
  _fy.addScaledVector(_fz, -_fy.dot(_fz)).normalize().negate();
  _fx.crossVectors(_fy, _fz);
  return (K.q = new THREE.Quaternion().setFromRotationMatrix(_fm.makeBasis(_fx, _fy, _fz)));
};
export const meleeIdle = (K, spr) => { const eu = new THREE.Euler().setFromQuaternion(keyQ(K), 'XYZ'); return { pos: K.p, rx: eu.x, ry: eu.y + 0.04, rz: eu.z, key: { p: K.p, q: K.q }, spr }; };      // ry + 0,04: kök dönüşünün taban sapması (update)
const SPR_LOW = { pos: [0.02, -0.035, 0.03], rx: -0.24, ry: 0.08, rz: 0.14 };
export const MELEE_IDLE = {
  knife: meleeIdle(K_([0.15, -0.14, -0.34], [-0.45, 0.6, -0.66], [-0.893, -0.285, 0.349]), SPR_LOW),
  machete: meleeIdle(K_([0.19, -0.2, -0.46], [-0.4, 0.75, -0.52], [-0.904, -0.234, 0.358]), { pos: [0.02, -0.05, 0.04], rx: -0.4, ry: 0.08, rz: 0.16 }),
  tomahawk: meleeIdle(K_([0.2, -0.2, -0.46], [-0.3, 0.85, -0.43], [-0.898, -0.101, 0.427]), { pos: [0.02, -0.05, 0.04], rx: -0.4, ry: 0.08, rz: 0.16 }),
};
// İnceleme (CS2): bıçak ekranın önüne yatay gelir (yassı yüz kameraya, ağız aşağı), sapın çevresinde yarım tur döner (öbür yüz, ağız yukarı), sonra bir yarım tur daha (tam tur) ve beklemeye döner
export const INSPECT_FP = {
  knife: K_([0.03, -0.1, -0.34], [-0.95, 0.15, -0.28], [-0.15, -0.95, 0]),
  machete: K_([0.08, -0.15, -0.42], [-0.92, 0.3, -0.25], [-0.3, -0.95, 0]),
  tomahawk: K_([0.08, -0.16, -0.42], [-0.9, 0.35, -0.25], [-0.36, -0.93, 0]),
};
// Savurma anahtarları: W = kurma (beklemeden hafif geri / dışa: anticipation), H = vuruş anı (= sunucudaki vuruş karesi swingHitK; ağız ekran ortasından geçer, kenar hareket yönünde),
// S = takip (follow-through, kısa tutulur), sonra beklemeye toparlanma. Hızlı (sol tık): rl = sağ-üstten sol-alta çapraz kesik, lr = sol-alttan sağ-üste ters el (CS2 dönüşümlü).
// heavy (sağ tık): bıçak = geri-yukarı çekip ortaya saplama, satır = yukarı-sağdan ağır çapraz iniş, tomahawk = tepeden balta inişi. Zamanlar FP_T / FP_TH.
export const SWING_FP = {
  knife: {
    rl: { W: K_([0.25, -0.06, -0.38], [0.1, 0.85, -0.5], [-1, 0, -0.1]), H: K_([0.02, -0.12, -0.46], [-0.45, 0.5, -0.74], [-0.85, -0.45, 0.2]), S: K_([-0.12, -0.14, -0.44], [-0.8, 0.25, -0.55], [-0.35, -0.9, 0.2]) },
    lr: { W: K_([-0.1, -0.17, -0.42], [-0.75, 0.2, -0.62], [0.55, 0.2, -0.6]), H: K_([0.06, -0.12, -0.47], [-0.15, 0.6, -0.78], [0.95, 0.15, -0.05]), S: K_([0.24, -0.1, -0.44], [0.55, 0.5, -0.67], [0.8, -0.35, 0.4]) },
    heavy: { W: K_([0.21, -0.05, -0.3], [-0.2, 0.85, -0.48], [-0.3, -0.45, -0.85]), H: K_([0.07, -0.13, -0.45], [-0.5, 0.5, -0.7], [-0.35, -0.8, -0.33]), S: K_([0.03, -0.16, -0.5], [-0.45, 0.35, -0.82], [-0.3, -0.9, -0.2]) },
  },
  machete: {
    rl: { W: K_([0.28, -0.08, -0.48], [0.1, 0.85, -0.5], [-1, 0, -0.1]), H: K_([0.03, -0.15, -0.55], [-0.45, 0.5, -0.74], [-0.85, -0.45, 0.2]), S: K_([-0.12, -0.18, -0.52], [-0.8, 0.25, -0.55], [-0.35, -0.9, 0.2]) },
    lr: { W: K_([-0.1, -0.2, -0.5], [-0.75, 0.2, -0.62], [0.55, 0.2, -0.6]), H: K_([0.07, -0.15, -0.55], [-0.15, 0.6, -0.78], [0.95, 0.15, -0.05]), S: K_([0.24, -0.14, -0.52], [0.55, 0.5, -0.67], [0.8, -0.35, 0.4]) },
    heavy: { W: K_([0.25, -0.03, -0.44], [0.15, 0.8, -0.58], [-0.75, -0.25, -0.55]), H: K_([0.04, -0.15, -0.55], [-0.55, 0.45, -0.7], [-0.65, -0.7, 0.06]), S: K_([-0.16, -0.22, -0.5], [-0.8, -0.05, -0.6], [-0.25, -0.95, 0.4]) },
  },
  tomahawk: {
    rl: { W: K_([0.28, -0.08, -0.46], [0.1, 0.85, -0.5], [-1, 0, -0.1]), H: K_([0.03, -0.15, -0.53], [-0.45, 0.5, -0.74], [-0.85, -0.45, 0.2]), S: K_([-0.12, -0.17, -0.5], [-0.8, 0.25, -0.55], [-0.35, -0.9, 0.2]) },
    lr: { W: K_([-0.1, -0.2, -0.48], [-0.75, 0.2, -0.62], [0.55, 0.2, -0.6]), H: K_([0.07, -0.15, -0.53], [-0.15, 0.6, -0.78], [0.95, 0.15, -0.05]), S: K_([0.24, -0.13, -0.5], [0.55, 0.5, -0.67], [0.8, -0.35, 0.4]) },
    heavy: { W: K_([0.2, -0.12, -0.42], [-0.1, 0.95, -0.3], [-0.2, 0.28, -0.94]), H: K_([0.07, -0.2, -0.42], [-0.15, 0.65, -0.75], [-0.2, -0.75, -0.6]), S: K_([0.05, -0.27, -0.42], [-0.12, 0.35, -0.93], [-0.15, -0.93, -0.33]) },
  },
};
// k zamanları: [bekleme, W, H, S, S tutma sonu, bekleme] · yumuşatma: kurma yavaşlayarak (easeOut), vuruş hızlanarak (easeIn; ağırda kübik → tok "çat"), takip yavaşlayarak, tutma, toparlanma (smooth)
const FP_T = [0, 0.2, SWING_HIT_K, 0.56, 0.63, 1], FP_TH = [0, 0.34, HEAVY_HIT_K, 0.6, 0.68, 1];
const eOut = (u) => 1 - (1 - u) * (1 - u), sm3 = (u) => u * u * (3 - 2 * u);
const FP_EASE = [eOut, (u) => u * u, eOut, () => 0, sm3], FP_EASE_H = [(u) => 1 - (1 - u) ** 3, (u) => u * u * u, eOut, () => 0, sm3];
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
// savurma pozu → bekleme pozuna göre fark: dp (kamera uzayı), dq (önden çarpılır)
function fpSwingDelta(tab, MI, k, hv, dp, dq) {
  const I = MI.key, keys = [I, tab.W, tab.H, tab.S, tab.S, I], T = hv ? FP_TH : FP_T, E = hv ? FP_EASE_H : FP_EASE;
  let i = 0; while (i < 4 && k >= T[i + 1]) i++;
  const u = E[i](clamp((k - T[i]) / (T[i + 1] - T[i]), 0, 1)), A = keys[i], B = keys[i + 1];
  dp.set(A.p[0] + (B.p[0] - A.p[0]) * u - I.p[0], A.p[1] + (B.p[1] - A.p[1]) * u - I.p[1], A.p[2] + (B.p[2] - A.p[2]) * u - I.p[2]);
  if (i === 1 || i === 2) dp.z -= Math.sin(Math.PI * clamp((k - T[1]) / (T[3] - T[1]), 0, 1)) * (hv ? 0.05 : 0.035);      // vuruş yayı: ortada hafif öne
  _qa.copy(A === I ? I.q : keyQ(A)); _qb.copy(B === I ? I.q : keyQ(B));
  dq.copy(_qa).slerp(_qb, u).multiply(_qa.copy(I.q).invert());
}
const ELBOW_FP = new THREE.Vector3(0.25, -0.48, 0.0);                             // yakın dövüş kolu: yumruktan bu "dirsek" noktasına (kamera uzayı, sağ el; ekranın altı) → kol hep sağ-alttan gelir, kameraya girmez
const CLAWS_IDLE = { pos: [0.0, -0.1, -0.44], rx: 0.12, ry: 0.0, rz: 0.0 };      // zombi elleri: iki el kalkık, pençelemeye hazır
// zombi eli (grup çerçevesinde): parmaklar yukarı-ileri ve hafif içe, el sırtı dışa-arkaya, ön kol ekranın altına iner
const ZH_MAP = handBasis(new THREE.Vector3(0.6, 0.12, 0.8), new THREE.Vector3(-0.12, 0.92, -0.35));
const ZH_ARM = new THREE.Vector3(0.22, -0.85, 0.45).normalize();
const ELBOW_CLAW = new THREE.Vector3(0.3, -0.75, -0.18);                         // zombi kolu: bilekten bu "dirsek" noktasına (kamera uzayı, sağ el); savurmada kol ekranı kesmez
const ZAX = new THREE.Vector3(0, 0, 1), _w = new THREE.Vector3(), _e = new THREE.Vector3(), _sw = new THREE.Vector3(), _swq = new THREE.Quaternion();
const GRENADE_UP = new THREE.Vector3(0, -0.035, 0.01);                           // bomba: kutu el biraz aşağı-geri → bomba kutunun üstünde görünür (ilk sürümde el içine gömülüydü)
const DS = { side: THREE.DoubleSide };                                            // el / kol kutuları çift yüzlü: nişanda yakın düzlem keserse içi dolu görünür (yarım düzlem kalmaz)
// Kol kutusu yönleri (silah yerelinde, 12.124 → 12.125'te korundu): tetik kolu kabzanın arkasından sağ-aşağı (dipçiğin / kabza ucunun DIŞINDAN), destek kolu kundağın altından sol-aşağı (şarjörün dışından).
// h = bel, a = tam nişan (geçişte yumuşak döner); off = kol kutusunun elden başlama payı. Ölçüm: scripts/armclip.mjs (kol ↔ silah ≤ 5 mm)
export const ARM = {
  item: [0.12, -0.2, 0.42],                                                      // bomba / ilk yardım / mayın: ilk kutu el yönü (73b388f) aynen
  trig: { h: [0.3, -0.5, 1.0], a: [0.2, -0.8, 0.2], lat: 0.09 }, pist: { h: [0.3, -0.5, 1.0], a: [0.3, -0.8, 0.4], lat: 0.07 },      // nişanda kol aşağı iner (ekranın altında kalır)
  sup: { h: [-0.3, -0.4, 0.8], a: [-0.5, -0.7, 0.4], lat: -0.07, latA: -0.02, p90: { h: [-0.3, -0.4, 0.8], a: [-0.6, -0.8, 0.4], lat: -0.07, latA: -0.04 } }, off: 0.05,
  cls: { p90: 'p90' },                                                           // silah → alt ayar adı (P90: destek eli gövdeye çok yakın)
};
const nv = (a) => new THREE.Vector3(...a).normalize();
// ── Birinci şahıs el oturuşu (12.127) ── yalnız FP: gripR / gripL (3. şahıs IK'si, character.js) ve namlu / mermi aynen. Ölçüm: scripts/gripfit.mjs
// r / l = gripR / gripL'ye ek kayma (silah yerelinde, m; eski sabit r [0, −0,02, 0], l [0, −0,03, 0]), rx = tetik eldiveninin X ekseni eğimi (°, + = alt ucu geriye, kabza eğimi),
// h = tetik eldiveni boyu (m; eski 0,1: üstü gövdeye 22–42 mm gömülüyordu). Tüfek varsayılanı: kabza açısı 16°, eldiven 85 mm boy ve 13 mm aşağıda (üstü gövde altında); tabanca 12°, 20 mm geride. wrist = düz dipçik / kabza ölçüsü yok, vg = dikey ön tutamak (gripfit kundak ölçüsü atlanır).
export const GLOVE = [0.1, 0.1, 0.12], GLOVE_R = [0.1, 0.085, 0.12];
export const FP_GRIP = {
  rifle: { r: [0, -0.033, 0], rx: 16 }, pistol: { r: [0, -0.024, 0.02], rx: 12 }, launcher: { r: [0, -0.03, 0], rx: 14 }, item: {},
  m4a1: { l: [0, 0.007, 0] }, scarh: { vg: 1 }, vector: { vg: 1 }, rpg: { vg: 1 }, g36: { l: [0, -0.015, 0] }, aa12: { l: [0, -0.023, 0] }, barrett: { l: [0, 0.005, 0] },      // destek eli kundağın altına değer (eskiden 10–36 mm havada)
  mp5: { r: [0, -0.04, 0], l: [0, -0.056, 0] }, lmg: { r: [0, -0.045, 0], l: [0, -0.069, 0] }, pkm: { r: [0, -0.047, 0], l: [0, -0.016, 0] },      // kundağa gömülü destek eli aşağı
  p90: { r: [0, -0.085, 0.01], rx: 6, l: [0, -0.11, 0.035], wrist: 1, vg: 1 },      // P90: tetik eli kabza panelinde (parmaklar tetik boşluğundan), destek eli ön halkanın altında (eskiden ikisi de gövdenin %44–49 içinde)
  aug: { r: [0, -0.033, -0.01], vg: 1 },      // AUG: tetik eli dev korkuluğun içindeki kabzada (şarjör / dipçik üstünde değil) · vg = destek eli dikey ön tutamakta (SCAR / Vector / RPG / AUG; kundak ölçüsü yok)
  mac10: { r: [0, -0.05, 0.005], rx: 0 }, m1911: { r: [0, -0.016, 0.02] }, deagle: { r: [0, -0.012, 0.02], rx: 14 }, revolver: { r: [0, -0.02, 0.02], rx: 8 },      // tabanca: eldiven 20 mm geride (kabza ortasında; eskiden 18–27 mm önde, korkuluğu yutuyordu), üstü çerçevenin altında
  sniper: { r: [0, -0.065, 0], rx: 20, wrist: 1 }, svd: { r: [0, -0.062, 0.02], rx: 8, wrist: 1 }, dbl: { wrist: 1, l: [0, -0.016, 0] }, m79: { wrist: 1, l: [0, -0.015, 0] },      // düz dipçik: el bileğin yüzeyinde (gömülü değil), SVD başparmak deliğinin kabzasında
  ammobox: { r: [0.206, -0.01, 0.02] }, medkit: { r: [0.251, 0.06, 0.02] },      // eşyalar: kutu sağ yanından kavranır (eskiden %90–100 kutunun içinde; altı birinci şahısta görünmez, üstteki sapta kol kutusu kutuya girer)
};
// ── Tabanca hissi (12.141, BattleBit / arcade): yay-sönüm tepmesi (hızlı kalkış ≈ 30 ms, tok toparlanma ≈ 130 ms), sürgü, kovan, alev, görüş tepmesi ──
// back = geri (m) · up = namlu kalkışı (rad, kabza çevresinde) · rise = yukarı kayma (m) · roll / yaw = yan yatış / sapma (rad, her atış rastgele yön) · cam = görüş tepmesi (rad, yalnız görsel: mermi yönü değişmez)
// w = yay hızı (1/sn; büyük = hızlı toparlanma) · z = sönüm (< 1: hafif geri sekme) · fl = alev ölçeği (0 = alev yok) · ej = kovan atar · port = atım penceresi (silah yerelinde)
// Denge (hasar / menzil / atış hızı / nişan tırmanması s.recoilP) DEĞİŞMEDİ: yalnız birinci şahıs görüntüsü + görüş tepmesi.
export const PISTOL_FEEL = {
  pistol: { back: 0.05, up: 0.2, rise: 0.012, roll: 0.06, yaw: 0.025, cam: 0.0065, w: 34, z: 0.68, fl: 1, ej: 1, port: [0.016, 0.068, -0.03] },
  m1911: { back: 0.058, up: 0.25, rise: 0.014, roll: 0.07, yaw: 0.03, cam: 0.0085, w: 31, z: 0.7, fl: 1.15, ej: 1, port: [0.0146, 0.058, -0.035] },
  deagle: { back: 0.075, up: 0.36, rise: 0.022, roll: 0.09, yaw: 0.035, cam: 0.016, w: 24, z: 0.74, fl: 1.65, ej: 1, port: [0.019, 0.062, -0.03] },
  revolver: { back: 0.07, up: 0.4, rise: 0.024, roll: 0.07, yaw: 0.03, cam: 0.019, w: 22, z: 0.76, fl: 1.8, ej: 0 },
  epistol: { back: 0.042, up: 0.17, rise: 0.01, roll: 0.05, yaw: 0.02, cam: 0.005, w: 36, z: 0.7, fl: 0.7, ej: 0 },      // 12.157 enerji tabancası: kovansız, kısa alev
  pbpistol: { back: 0.026, up: 0.07, rise: 0.006, roll: 0.03, yaw: 0.015, cam: 0.0025, w: 36, z: 0.7, fl: 0, ej: 0 },
};
// Birinci şahıs namlu alevi dokusu (12.141): yıldız biçimli ışıma (eski düz sarı kutunun yerine; tüm silahlarda)
let _flashTex = null;
function flashTex() {
  if (_flashTex) return _flashTex;
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d'), h = S / 2;
  const gr = c.createRadialGradient(h, h, 0, h, h, h);
  gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.18, 'rgba(255,226,140,0.95)'); gr.addColorStop(0.5, 'rgba(255,150,40,0.35)'); gr.addColorStop(1, 'rgba(255,90,0,0)');
  c.fillStyle = gr; c.fillRect(0, 0, S, S);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {                                                       // ışın uçları
    const a = (i / 7) * Math.PI * 2 + 0.3, L = h * (0.75 + 0.25 * ((i * 37) % 5) / 4);
    c.save(); c.translate(h, h); c.rotate(a);
    const g2 = c.createLinearGradient(0, 0, L, 0); g2.addColorStop(0, 'rgba(255,220,130,0.8)'); g2.addColorStop(1, 'rgba(255,120,20,0)');
    c.fillStyle = g2; c.beginPath(); c.moveTo(0, -h * 0.09); c.lineTo(L, 0); c.lineTo(0, h * 0.09); c.fill(); c.restore();
  }
  _flashTex = new THREE.CanvasTexture(cv); _flashTex.colorSpace = THREE.SRGBColorSpace;
  return _flashTex;
}
const _ej = new THREE.Vector3();
const easeOutBack = (t, k = 1.7) => { t = clamp(t, 0, 1) - 1; return 1 + t * t * ((k + 1) * t + k); };
const fpGrip = (id, hold) => { const d = FP_GRIP[hold === 'pistol' ? 'pistol' : hold === 'launcher' ? 'launcher' : hold === 'rifle' ? 'rifle' : 'item'], o = FP_GRIP[id] || {}; return { ...d, ...o }; };
const MELEE_SPRINT = { pos: [-0.04, 0.06, -0.06], rx: 0.65, ry: 0.3, rz: -0.1 };

// ── ACOG / PSO-1 merceği (12.162; 12.128–12.155'teki resim-içinde-resim kaldırıldı) ── nişanda dünya kamerası TAM EKRAN yakınlaşır (OPTICS.acog.zoom, 12.163 taslak C ×1,5; dokunmatik ×1,85),
// göz merceğindeki disk saydam camdır: önce (renderOrder −1) yalnız derinliğe yazılır → arkasındaki tüp / mercek çizilmez, dünya görünür (mercek içi = dışı, doğal).
// Geçişte disk koyu camdan saydama açılır (LENS_ON → +LENS_FADE); retikül 3B ışıyan nokta, tam nişanda HUD #rdot (red dot ile aynı, ADS_HUD).
export const LENS_ON = 0.3, LENS_FADE = 0.2;
const VM_CACHE = 14;      // 12.210: birinci şahıs model önbelleği (donanım 4 eşya + ana silahın nişangâhları ≈ 8–10; J/K ile gezerken eskiyen atılır)
const LENS_MASK = new THREE.MeshBasicMaterial({ colorWrite: false });
const LENS_TINT = new THREE.MeshBasicMaterial({ color: '#030606', transparent: true, opacity: 1, depthWrite: false });

export class ViewModel {
  static MELEE = { MELEE_IDLE, SWING_FP, meleeIdle, K_ };      // 12.194: poz ayar betikleri (tune) aynı modül örneğine erişsin
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(54, 1, 0.01, 10);
    this.scene.add(this.cam);
    this.scene.environment = game.scene.environment;
    this.scene.environmentIntensity = 0.7;
    this.scene.add(new THREE.HemisphereLight('#cfe3ff', '#8a7a58', 1.5));
    const sun = new THREE.DirectionalLight('#fff0d2', 2.2);
    sun.position.set(2, 3, 2);
    this.scene.add(sun);
    this.root = new THREE.Group();
    this.cam.add(this.root);
    this.model = null; this.id = null; this.arms = [];
    this.kick = 0; this.kickR = 0; this.bobT = 0; this.raise = 1; this.raiseRate = 3.5;
    this.boltT = 0; this.hitKick = 0; this.throwT = 0; this.dryT = 0;
    this.camRoll = 0; this.camPitch = 0; this.inspectT = 0;
    this.pos = new THREE.Vector3(0.2, -0.21, -0.66);           // bel duruşu (ilk kutu el sürümü)
    this.flash = null; this.flashT = 0;
    this.handL = null; this.handR = null;
    // 12.141 tabanca hissi: yaylar (K = ana tepme, S = yan, C = görüş), sürgü / silindir, kovanlar, namlu ışığı
    this.feel = null; this.rk = { K: 0, Kv: 0, S: 0, Sv: 0, C: 0, Cv: 0 }; this.punch = 0; this.punchR = 0;
    this.slideT = 9; this.slideX = 0; this.cylA = 0; this.cylTo = 0; this._slLock = false;
    this.casings = [];
    this.lensScr = { on: false, x: 0, y: 0, r: 0 };                          // 12.190: büyüten merceğin ekrandaki yeri (HUD #lens)
    this.mLight = new THREE.PointLight('#ffb35a', 0, 1.6, 2);                  // namlu ışığı: atış anında el + silah kısa parlar (hep sahnede: ışık sayısı sabit → yeniden derleme yok)
    this.root.add(this.mLight);
  }

  // Tabanca: yay-sönüm tepmesi (tek atış ≈ 1; seri atışta üst üste biner, en çok ~1,7)
  fireFeel(s, amt = 1) {
    const f = this.feel, r = this.rk, E = Math.E;
    if (r.K < 1.7) r.Kv += f.w * E * amt;
    r.Sv += (Math.random() < 0.5 ? -1 : 1) * f.w * E * amt * (0.55 + Math.random() * 0.45);
    r.Cv += f.w * 1.3 * E * amt;
    if (amt < 1) return;
    this.slideT = 0; this.cylTo += Math.PI / 3;
    if (f.ej && this.model) this.eject();
  }
  // kovan (kamera uzayında; 0,5 sn uçar, döner, düşer)
  eject() {
    let c = this.casings.find((o) => !o.mesh.visible);
    if (!c) {
      if (this.casings.length >= 6) c = this.casings[0];
      else {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.019, 7), new THREE.MeshStandardMaterial({ color: '#c99a3e', metalness: 0.85, roughness: 0.32 }));
        m.rotation.order = 'XYZ'; m.frustumCulled = false; this.cam.add(m);
        c = { mesh: m, v: new THREE.Vector3(), sp: new THREE.Vector3(), life: 0 }; this.casings.push(c);
      }
    }
    const port = this.feel.port || [0.015, 0.06, -0.03], mir = this.game.leftHand ? -1 : 1;
    this.model.updateWorldMatrix(true, false);
    this.cam.worldToLocal(_ej.set(...port).applyMatrix4(this.model.matrixWorld));
    c.mesh.position.copy(_ej); c.mesh.visible = true; c.life = 0.55;
    c.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.PI / 2);
    c.v.set((1.15 + Math.random() * 0.5) * mir, 1.25 + Math.random() * 0.45, 0.2 + Math.random() * 0.2);
    c.sp.set(18 + Math.random() * 10, 6 * (Math.random() - 0.5), 14 + Math.random() * 8);
  }

  // 12.210: silah değiştirme takılması. Eskiden her değişimde silah + eller + kollar baştan kuruluyor, eskisi atılıyordu (geometri / malzeme üretimi
  // + ilk çizimde GPU'ya yeniden yükleme ≈ 7–9 ms, zayıf işlemcide 15–25 ms; zombi pençesine her geçişte program silinip yeniden derleniyordu).
  // Şimdi (silah, takım, nişangâh, kaplama, kıyafet) başına kurulan model önbellekte kalır: geri dönüşte yalnız sahneye takılır (GPU arabellekleri yerinde).
  // Ön ısıtma (warmup.js) donanımdaki eşyaları zaten kurup çizdiği için maçtaki ilk değişim de sıcak. En çok VM_CACHE model; eskiyen atılır.
  _stash() {
    for (const a of this.arms) this.cam.remove(a.mesh);
    if (this.model) this.root.remove(this.model);
    if (this.lensDisc) this.root.remove(this.lensDisc);
  }
  _evict() {
    const C = this._cache;
    for (const [k, e] of C) {
      if (C.size <= VM_CACHE) break;
      if (e.g === this.model) continue;
      C.delete(k);
      const own = e.g.userData.ownMat;
      e.g.traverse((o) => { o.geometry?.dispose(); const mt = o.material; if (mt && !Array.isArray(mt) && (own || (mt.userData.skinMat && !mt.userData.shared))) mt.dispose(); });      // setFade kopyaları + modele özel kaplama malzemesi (eski değişim temizliğiyle aynı)
      e.flash?.userData.mat.dispose();
      for (const a of e.arms) a.mesh.geometry.dispose();
      e.lensDisc?.geometry.dispose();
    }
  }

  setItem(id, team, kind, optic, skin, wskin = 'std') {
    this._stash();
    this.arms = [];
    this.clearDrops();
    this.id = id;
    this.raise = 1; this.slideT = 9; this.cylA = this.cylTo = 0; this.rk.K = this.rk.Kv = this.rk.S = this.rk.Sv = 0;
    this.raiseRate = 1 / Math.max(0.15, Math.min(0.35, WSTATS[id]?.equip ?? 0.3));
    if (kind === 'melee' && id !== 'claws') this.raiseRate = 1 / 0.42;      // 12.194: bıçak çekişi (görsel 0,42 sn; oyun hazır olma süresi equip aynen — savurma başlarsa çekiş hızla biter)
    this._swRef = null; this._swBlend = 0; this.strikeK = 0;
    this.boltT = 0;
    const C = (this._cache ||= new Map()), key = id + '|' + team + '|' + kind + '|' + optic + '|' + (skin || '') + '|' + wskin + '|' + (id !== 'claws' && this.look ? JSON.stringify(this.look) : '');
    const hit = C.get(key);
    if (hit) {
      C.delete(key); C.set(key, hit);                                           // en son kullanılan sona (LRU)
      this.model = hit.g; this.flash = hit.flash; this.feel = hit.feel; this.zh = hit.zh; this.handR = hit.handR; this.handL = hit.handL;
      this.hLfg = hit.hLfg; this.hRgrip = hit.hRgrip; this.arms = hit.arms; this.lensDisc = hit.lensDisc;
      if (this.flash) this.flash.visible = false;
      if (this.handL) this.handL.visible = !!this.hLfg;
      if (this.lensDisc) { this.lensDisc.visible = false; this.root.add(this.lensDisc); }
      for (const a of this.arms) this.cam.add(a.mesh);
      this.root.add(this.model);
      return;
    }
    this.lensDisc = null;
    const c = id !== 'claws' && this.look ? { ...TEAMS[team], ...this.look } : TEAMS[id === 'claws' ? 'zomb' : team];      // look: paintball forması (kol = boya rengi, eldiven koyu)
    const g = new THREE.Group();
    this.flash = null; this.feel = null;
    this.zh = null;
    if (kind === 'medkit') {
      const m = createWeapon('medkit', null, false); m.scale.setScalar(1.5); m.position.set(0, -0.08, 0); g.add(m);      // S3 ilk yardım (12.123; eski eşya modeliyle aynı ölçü / konum)
      g.userData = { gripR: new THREE.Vector3(0.02, -0.02, 0.0), gripL: null, muzzle: new THREE.Vector3(), sight: [0, 0, 0], dist: 0.3, noAds: true };
    } else {
      const w = createWeapon(id, optic, false, wskin);         // wskin: S3 silah kaplaması (skin = zombi ten rengi)
      g.add(w);
      const st = WSTATS[id];
      g.userData = { ...w.userData, sight: w.userData.sight ?? st.sight, dist: w.userData.dist ?? st.dist };
      if (kind === 'throwable' || kind === 'mine' || kind === 'ammobox' || kind === 'melee') g.userData.noAds = true;
      this.feel = (kind === 'gun' && w.userData.hold === 'pistol' && PISTOL_FEEL[id]) || null;      // 12.141: tabanca hissi (MAC-10 makineli: eski tepme)
      if ((kind === 'gun' || kind === 'launcher') && !st.ball) {
        // namlu alevi (12.141): iki çapraz yıldız düzlemi (namlu ekseni boyunca) + ön yıldız; her atışta rastgele döner / boy değiştirir
        const fl = this.feel ? this.feel.fl : 1, L = 0.2 * fl, Wd = 0.13 * fl;
        const f = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ map: flashTex(), color: '#ffe0a0', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const pg = new THREE.PlaneGeometry(1, 1);
        for (const rz of [0, Math.PI / 2]) { const q = new THREE.Mesh(pg, mat); q.rotation.set(0, Math.PI / 2, 0); q.rotateX(rz); q.scale.set(L, Wd, 1); q.position.z = -L * 0.42; f.add(q); }
        const fr = new THREE.Mesh(pg, mat); fr.scale.set(Wd * 1.15, Wd * 1.15, 1); fr.position.z = -0.012; f.add(fr);
        f.position.copy(w.userData.muzzle);
        f.visible = false; f.userData.mat = mat; f.userData.fl = fl;
        if (fl > 0) { w.add(f); this.flash = f; }
      }
    }
    // eller + kollar (silaha bağlı). Eller ayrı gruplardır: yükleme animasyonunda bağımsız hareket eder
    const fg = fpGrip(id, g.userData.hold), gunK = kind === 'gun' || kind === 'launcher';
    const hand = (p, side) => {
      const grp = new THREE.Group();
      grp.position.copy(p);
      const glove = box(grp, side > 0 && gunK ? fg.h ? [0.1, fg.h, 0.12] : GLOVE_R : GLOVE, c.gloves, [0, 0, 0], side > 0 ? [-(fg.rx || 0) * Math.PI / 180, 0, 0] : null, DS);      // tetik eli kabza açısında (eski eksen hizalı kutu önde boşluk bırakıp tetik korkuluğunu yutuyordu)
      grp.userData.glove = glove;
      const gun = kind === 'gun' || kind === 'launcher', A = side < 0 ? ARM.sup : g.userData.hold === 'pistol' ? ARM.pist : ARM.trig;
      const B = gun ? A[ARM.cls[this.id]] || A : A, dir = nv(gun ? B.h : [ARM.item[0] * side, ARM.item[1], ARM.item[2]]), dirA = gun ? nv(B.a) : dir.clone(), off = gun ? ARM.off : 0.05;
      const len = 0.5, lat = new THREE.Vector3(gun ? B.lat || 0 : 0, 0, 0), latA = new THREE.Vector3(gun ? B.latA ?? B.lat ?? 0 : 0, 0, 0);      // lat: kol kutusu elin dışından başlar (bilek yana kırık; şarjör / dipçik / bullpup gövdesi kolun içine girmez)
      const sleeve = box(grp, [0.11, 0.11, len], c.shirt, [0, 0, 0], null, DS);
      sleeve.position.copy(dir).multiplyScalar(len / 2 + off).add(lat);
      sleeve.quaternion.setFromUnitVectors(Z, dir);
      if (c.cuff) { const cf = box(sleeve, [0.135, 0.135, 0.07], c.cuff, [0, 0, -len / 2 + 0.035], null, DS); cf.userData.cuff = true; }      // 12.157 Uzay: kalın bilek halkası (kolla birlikte döner)
      grp.userData.sleeve = sleeve; grp.userData.dir0 = dir; grp.userData.dirA = dirA; grp.userData.len = len; grp.userData.off = off; grp.userData.lat = lat; grp.userData.latA = latA;
      g.add(grp);
      return grp;
    };
    // yakın dövüş: sapı saran kutu yumruk (12.194, CS2 tutuşu; aynı kutu el üslubu). Sap ekseni z (ağız −z), keskin kenar −y, el sırtı +x.
    // Avuç / el sırtı bloğu sapın sırt tarafını, 4 parmak (araları 1,3 mm boşluk → koyu iç kutu oluk gibi görünür) ağız tarafını sarar; başparmak iç yanda siperin dibine yatık.
    // Parçalar birbirine gömülü ama hiçbir dış yüzü aynı düzlemde değil (eski yumrukta yan / üst / avuç kutularının ön yüzleri çakışıyordu → titreyen pikseller; parmak çizgileri 3,5 mm dışarı taşıyordu).
    const fist = (p, side = 1) => {
      const grp = new THREE.Group(), fg = new THREE.Group();
      grp.position.copy(p); fg.scale.setScalar(1.12); grp.add(fg);
      box(fg, [0.052, 0.058, 0.066], '#121316', [0, -0.002, -0.013]);                   // koyu iç (parmak aralarında görünür)
      box(fg, [0.056, 0.042, 0.07], c.gloves, [0, 0.009, -0.0135]);                     // avuç + el sırtı (sapın sırt tarafı)
      for (const [z0, z1] of [[-0.047, -0.0307], [-0.0294, -0.0131], [-0.0118, 0.0045], [0.0058, 0.0221]]) box(fg, [0.056, 0.024, z1 - z0], c.gloves, [0.0015, -0.022, (z0 + z1) / 2]);      // parmaklar (işaret → serçe), boğumlar el sırtından 1,5 mm taşar
      box(fg, [0.008, 0.034, 0.0265], c.gloves, [-0.03, -0.009, -0.03225]);             // başparmak: iç yanda, işaret parmağının üstüne yatık
      const dir = new THREE.Vector3(0.12 * side, -0.2, 0.42).normalize(), len = 0.5;      // ilk yön; her karede dirsek noktasına döner (update)
      const sleeve = box(grp, [0.092, 0.092, len], c.shirt, [0, 0, 0]);
      sleeve.position.copy(dir).multiplyScalar(len / 2 + 0.05);
      sleeve.quaternion.setFromUnitVectors(Z, dir);
      grp.userData.sleeve = sleeve; grp.userData.len = len;
      g.add(grp);
      return grp;
    };
    const u = g.userData;
    if (id === 'claws') {                                                        // zombi: iki çıplak, kemikli, kanca parmaklı el (türün ten rengi)
      this.hLfg = null; this.handL = null;
      // iki bağımsız el grubu: her biri kendi omzundan (ekran altı) koşarken sağa / sola açılır ve dönüşümlü ileri-geri sallanır
      const w = g.children.find((o) => o.userData && o.userData.id === 'claws') || g.children[0];
      g.remove(w); w.traverse((o) => o.geometry?.dispose());                     // 3. şahıs pençe modeli birinci şahısta kullanılmaz
      const zc = zombieColors(skin || '#86a273', TEAMS.zomb.shirt);
      const mk = (mirror) => {
        const grp = new THREE.Group(), m = fpHand({ colors: zc, map: ZH_MAP, mirror, arm: ZH_ARM.clone().setX(ZH_ARM.x * (mirror ? -1 : 1)), armLen: 0.62, pose: 'claw', pose2: 'claw2', scale: 1.45, split: true });
        grp.add(m); g.add(grp);
        const a = m.userData.arm; if (a) { this.cam.add(a); this.arms.push({ grp, mesh: a, wrist: m.userData.wrist, elbow: ELBOW_CLAW.clone().setX(ELBOW_CLAW.x * (mirror ? -1 : 1)) }); }   // ayrı kol: bilekten dirseğe
        return grp;
      };
      const hR = mk(false), hL = mk(true);
      this.zh = { R: hR, L: hL };
      this.handR = hR;
    } else if (kind === 'melee' && u.gripR) {
      this.handR = fist(u.gripR.clone()); this.hLfg = null; this.handL = null;
    } else {
      this.handR = u.gripR ? hand(u.gripR.clone().add(fg.r ? new THREE.Vector3(...fg.r) : u.hold === 'grenade' ? GRENADE_UP : new THREE.Vector3(0.0, -0.02, 0.0)), 1) : null;
      this.hLfg = u.gripL ? u.gripL.clone().add(new THREE.Vector3(...(fg.l || [0, -0.03, 0]))) : null;
      this.handL = (kind === 'gun' || kind === 'launcher') ? hand(this.hLfg || REST_L, -1) : null;
      if (this.handL && !this.hLfg) this.handL.visible = false;
    }
    this.hRgrip = gunK && this.handR ? this.handR.position.clone() : null;      // 12.195: sağ elin kabza yeri (sürgü çekerken oradan ayrılır)
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    this.model = g;
    this.root.add(g);
    const L = g.userData.lens;                                                                // ACOG / PSO-1: göz merceğinde saydam disk (modelin dışında: setFade / atma döngüsü dokunmaz)
    if (L) {
      const geo = new THREE.CircleGeometry(L[0], 40);
      const d = new THREE.Mesh(geo, LENS_MASK); d.renderOrder = -1;                           // derinlik maskesi: silah ağından önce çizilir
      const t = new THREE.Mesh(geo, (this._lensTint ||= LENS_TINT.clone())); t.position.z = 0.0001; t.renderOrder = 3;      // geçişte koyu cam (saydamlaşır)
      d.add(t); d.position.set(L[1], L[2], L[3]); d.visible = false; d.frustumCulled = t.frustumCulled = false; d.userData.r = L[0];
      this.lensDisc = d; this.root.add(d);
    }
    C.set(key, { g, flash: this.flash, feel: this.feel, zh: this.zh, handR: this.handR, handL: this.handL, hLfg: this.hLfg, hRgrip: this.hRgrip, arms: this.arms, lensDisc: this.lensDisc });
    this._evict();
  }

  // Silah inceleme (Y): ~3,4 sn; ateş/nişan/yükleme/sprint/silah değişimi/savurma iptal eder
  inspect(s) {
    if (this.inspectT > 0) { this.inspectT = 0; return; }
    if (s.adsT > 0.05 || s.reloadT > 0 || s.sprinting || s.swing || s.useT > 0 || this.raise > 0.05 || this.kick > 0.02) return;
    this.inspectT = 0.0001;
  }

  adsTarget(u) {
    const [sx, sy, sz] = u.sight || [0, 0.1, -0.1];
    const k = VM_SCALE;   // model ölçeklendiği için nişan noktası da ölçeklenir
    return new THREE.Vector3(-sx * k, -sy * k, -(u.dist ?? 0.3) - sz * k);
  }

  update(dt, p) {
    const s = p.s, st = s.stat;
    const u = this.model?.userData || {};
    const hip = this.pos;
    const ads = u.noAds ? 0 : adsEase(s.adsT);
    const tgt = this.adsTarget(u);
    if (st.adsLow) tgt.x += st.adsLow[0], tgt.y += st.adsLow[1], tgt.z += st.adsLow[2];      // paintball: nişanda model iner / sağa kayar (hazne görüşü kapatmasın; nişangâh HUD'da halka)
    const speed = Math.hypot(s.vel.x, s.vel.z);
    const isMelee = st.kind === 'melee';
    const isGun = st.kind === 'gun' || st.kind === 'launcher';
    this.bobT += dt * (speed > 0.5 && s.onGround ? 1 : 0) * (s.sprinting ? 12 : 8);
    const bobAmt = (1 - ads * 0.85) * clamp(speed / 5, 0, 1) * (s.sprinting ? 1.6 : 1);
    this.kick = Math.max(0, this.kick - dt * 6 * (0.2 + this.kick * 10));
    if (st.space) spaceVm(this, s, dt);                                            // 12.157: enerji parçalarının ışıma gücü
    this.kickR = Math.max(0, this.kickR - dt * 5);
    const blade = isMelee && this.id !== 'claws';
    this.raise = Math.max(0, this.raise - dt * (blade && s.swing ? 12 : this.raiseRate));
    this.hitKick = Math.max(0, this.hitKick - dt * 7);
    this.throwT = Math.max(0, this.throwT - dt * 3);
    this.dryT = Math.max(0, this.dryT - dt * 8);
    this.boltT = Math.max(0, this.boltT - dt / 0.95);
    const fe = isGun ? this.feel : null;
    if (fe) {                                                                   // 12.141: yay-sönüm (1/240 sn alt adım: kararlı)
      const r = this.rk, n = Math.max(1, Math.ceil(dt * 240)), h = dt / n, w = fe.w, wc = w * 1.3, z = fe.z;
      for (let i = 0; i < n; i++) {
        r.Kv += (-w * w * r.K - 2 * z * w * r.Kv) * h; r.K += r.Kv * h;
        r.Sv += (-w * w * r.S - 2 * z * w * r.Sv) * h; r.S += r.Sv * h;
        r.Cv += (-wc * wc * r.C - 2 * 0.8 * wc * r.Cv) * h; r.C += r.Cv * h;
      }
      this.slideT += dt;
    }
    const rz0 = fe || blade ? 0 : this.raise * this.raise;      // bıçak: aşağıda ayrı çekiş (çevirme)

    let pos = new THREE.Vector3().lerpVectors(hip, tgt, ads);
    pos.x += Math.sin(this.bobT) * 0.012 * bobAmt;
    pos.y += Math.abs(Math.cos(this.bobT)) * 0.012 * bobAmt - rz0 * 0.38;
    pos.z += this.kick * (0.9 - ads * 0.6);
    let rx = this.kickR * 0.4 * (1 - ads), ry = (this.id === 'claws' ? 0.06 : -0.04) * (1 - ads), rz = 0;      // zombi pençesi: bdecbe0 duruşu aynen · nişandaki tepme aşağıda nişan noktası çevresinde
    rx += this.dryT * 0.05 - rz0 * 0.5;
    this.breathT = (this.breathT || 0) + dt;                                    // nefes: yavaş, çok hafif iniş-kalkış ve yalpa (nişanda sönümlenir)
    const br = Math.sin(this.breathT * 1.55) * (1 - ads) * (1 - clamp(speed / 3, 0, 1) * 0.6), br2 = Math.sin(this.breathT * 0.8 + 1.3) * (1 - ads);
    pos.y += br * 0.0035; rx += br * 0.008; rz += br2 * 0.008; pos.x += br2 * 0.0015;
    if (isMelee) { rz += Math.sin(this.bobT) * 0.04 * bobAmt; rx += Math.abs(Math.cos(this.bobT)) * 0.03 * bobAmt; pos.x += Math.sin(this.bobT) * 0.006 * bobAmt; }   // yürürken bıçak eli yalpalar (CS2: yana 8 çizen salınım)
    if (fe) {
      // 12.141 çekme: sağ-alttan yan yatık gelir, hafif aşıp yerine oturur (easeOutBack)
      if (this.raise > 0) { const r = 1 - easeOutBack(1 - this.raise, 1.4); pos.y -= r * 0.3; rx -= r * 0.62; rz += r * 0.5; pos.x += r * 0.06; }
      // atış: geri + yukarı vuruş + namlu kalkışı (kabza çevresinde) + yan yatış; nişanda kalkış aşağıda nişan noktası çevresinde
      const K = this.rk.K, S = this.rk.S, hp = 1 - ads;
      pos.z += K * fe.back * (1 - ads * 0.45); pos.y += K * fe.rise * hp;
      rx += K * fe.up * hp; rz += S * fe.roll * (1 - ads * 0.7); ry += S * fe.yaw * hp;
    }

    // yeniden doldurma ilerlemesi
    // 12.195: reloadPlan (CS2 düzeni) — el adlandırılmış noktalar arasında gezer, şarjör ele bağlı; bitince (ya da fişekte ateşle kesilince) son pozdan 0,22 sn'de yerine döner
    let ra = null;
    const rlMode = isGun ? reloadMode(this.id, st) : null;
    if (s.reloadT > 0 && isGun) {
      const el = s.reloadTotal - s.reloadT, sh = rlMode === 'shell';
      ra = reloadPlan(rlMode, clamp(el / s.reloadTotal, 0, 1), s.reloadEmpty, sh ? ((el / st.shell) % 1 + 1) % 1 : 0, sh ? st.shell / s.reloadTotal : 0.2);
      this.rlOut = 1;
    } else if (isGun && this.rlOut > 0 && this.rlLast) {
      this.rlOut = Math.max(0, this.rlOut - dt / 0.22);
      const e = this.rlOut * this.rlOut * (3 - 2 * this.rlOut), L = this.rlLast;
      ra = { mode: L.mode, post: e, act: L.act * e, tilt: L.tilt * e, lift: L.lift * e, slap: 0, L: null, R: null, ch: 0, bolt: L.bolt * e, brk: L.brk * e, cyl: L.cyl * e, lid: L.lid * e, slide: 0, mag: 'gun', item: null };
      if (this.rlOut <= 0) this.rlLast = null;
    } else this.rlOut = 0;
    if (ra && !ra.post) this.rlLast = ra;

    // sprint (bıçakta yukarıda tutulur; yüklerken sprint pozu azalır)
    const sp = s.sprinting ? 1 : 0;
    this.sprintT = lerp(this.sprintT || 0, sp, Math.min(1, dt * 9));
    const sprK = this.sprK = this.sprintT * (1 - (ra ? ra.tilt * 0.8 : 0)) * (1 - ads);      // 12.145: nişan koşu pozunu bastırır (eski: tam nişanda %27 koşu pozu kalıyor, silah yan dönük)
    if (isMelee) {
      const MI = this.id === 'claws' ? CLAWS_IDLE : MELEE_IDLE[this.id] || MELEE_IDLE.knife;
      pos.x += MI.pos[0] - hip.x; pos.y += MI.pos[1] - hip.y; pos.z += MI.pos[2] - hip.z;
      rx += MI.rx; ry += MI.ry; rz += MI.rz;
      if (this.id !== 'claws') {                                      // bıçak vb.: koşarken indirilir, ucu öne-aşağı (12.194, CS2 / Valorant) · zombi elleri: aşağıdaki ayrı el animasyonu
        const MS = MI.spr || MELEE_SPRINT;
        pos.x += MS.pos[0] * sprK; pos.y += MS.pos[1] * sprK; pos.z += MS.pos[2] * sprK;
        rx += MS.rx * sprK; ry += MS.ry * sprK; rz += MS.rz * sprK;
      }
    } else {
      pos.x -= sprK * 0.1; pos.y -= sprK * 0.1; pos.z += sprK * 0.05;
      rx -= sprK * 0.55; ry += sprK * 0.7;
    }
    // 12.180 yüzerken: ateş edilemeyen silah aşağıda (görüşü kapatmaz), tabanca yüzeyde hazır ama dalgada sallanır
    const swTo = s.swim ? (swimCanFire(s, st) ? 0.12 : 1) : 0;
    this.swimK = lerp(this.swimK || 0, swTo, Math.min(1, dt * 7));
    if (this.swimK > 0.002) {
      const sk = this.swimK, wv = Math.sin(this.game.time * 1.9);
      pos.y -= sk * 0.34 - wv * 0.01 * (s.swim ? 1 : 0); pos.z += sk * 0.06; rx -= sk * 0.7; rz += wv * 0.04 * (s.swim ? 1 : 0);
    }

    // ── silah inceleme: öne/ortaya al, yandan göster, ters çevir, üstten bak, geri indir ──
    let insp = 0; this.inspSpin = 0; if (this._inspQ) this._inspQ.identity();
    if (this.inspectT > 0) {
      if (s.adsT > 0.05 || s.reloadT > 0 || s.sprinting || s.swing || s.useT > 0 || this.raise > 0.05 || this.kick > 0.02 || s.cd > 0.05) this.inspectT = 0;
      else this.inspectT += dt / (blade ? 2.9 : 3.4);
      if (this.inspectT >= 1) this.inspectT = 0;
    }
    if (this.inspectT > 0) {
      const t = this.inspectT, sm = (x) => x * x * (3 - 2 * x);
      insp = sm(clamp(t / 0.12, 0, 1)) * sm(clamp((1 - t) / 0.14, 0, 1));
      const pl = (x) => Math.sin(clamp(x, 0, 1) * Math.PI);
      const a = pl((t - 0.1) / 0.36), b = pl((t - 0.42) / 0.3), c = pl((t - 0.66) / 0.24);
      if (blade) {                                                  // 12.194 CS2 bıçak incelemesi: ortaya kalkar, sapın çevresinde döner (öbür yüz), geri döner, ağzı yukarı bakar, sonunda tam tur çevirme
        const IK = INSPECT_FP[this.id], MI = MELEE_IDLE[this.id];
        if (IK && MI?.key) {
          pos.x += (IK.p[0] - MI.key.p[0]) * insp; pos.y += (IK.p[1] - MI.key.p[1]) * insp; pos.z += (IK.p[2] - MI.key.p[2]) * insp;
          _qa.copy(keyQ(IK)).multiply(_qb.copy(MI.key.q).invert());
          this._inspQ = (this._inspQ ||= new THREE.Quaternion()).identity().slerp(_qa, insp);
        }
        this.inspSpin = Math.PI * sm(clamp((t - 0.36) / 0.16, 0, 1)) + Math.PI * sm(clamp((t - 0.7) / 0.13, 0, 1));
      } else {
        pos.x -= 0.19 * insp; pos.y += 0.05 * insp; pos.z += (this.id === 'claws' ? -0.14 : 0.07) * insp;
        ry += 0.95 * a + 0.25 * b; rx += -0.2 * a + 0.5 * c; rz += -0.95 * b + 0.3 * c;
      }
    }

    // ── yükleme: silah yana yatar, sol el şarjöre/kemere gider, şarjör çıkar-takılır, kol şarjı ──
    let camRoll = 0, camPitch = 0;
    if (ra) {
      pos.y += ra.tilt * 0.07 - ra.slap * 0.012; pos.x -= ra.tilt * 0.12; pos.z += ra.slap * 0.035 - ra.tilt * 0.1;
      rx -= ra.tilt * 0.22 + ra.slap * 0.05; rz -= ra.tilt * 0.62; ry += ra.tilt * 0.3;
    } else if (s.useT > 0) {
      const tot = Math.max(0.5, st.useTime || 1.4);
      const b = Math.sin(clamp(1 - s.useT / tot, 0, 1) * Math.PI);
      pos.y -= b * 0.18; pos.x -= b * 0.05; rx -= b * 0.7; rz += b * 0.5;
    }
    // sürgülü: ateşten sonra sürgü çekilir (kısa el hareketi)
    let boltK = 0;
    if (u.bolt && !ra) { const b = 1 - this.boltT; boltK = this.boltT > 0 ? Math.sin(Math.PI * clamp((b - 0.3) / 0.55, 0, 1)) : 0; rz -= boltK * 0.35; pos.x -= boltK * 0.02; }      // 12.153: sürgü sesiyle aynı anda (0,3–0,85 sn; ses 0,55 / 0,73)
    this.boltK = boltK;
    if (p.scopeOn && boltK > 0) { camRoll += boltK * 0.035 * (this.game.leftHand ? -1 : 1); camPitch -= boltK * 0.012; }      // 12.153: dürbünde kalınır; sürgü çekilirken görüş hafif yatar / iner (HUD'da dürbün halkası kayar), atış zaten bekleme süresinde
    if (u.bolt) { const bb = ra ? ra.bolt : boltK; u.bolt.g.position.set(0, u.bolt.pivot, bb * 0.085); u.bolt.g.rotation.z = u.boltSlide ? 0 : bb * 0.9; }      // boltSlide (12.158): kurma kolu yalnız kayar
    // 12.141 tabanca sürgüsü: atışta 14 ms'de geri, 24 ms'ye dek bekler, 70 ms'de önde; son mermide geride kilitli kalır. Boş doldurmada şarjör takılınca (%64) öne fırlar (+ küçük sarsıntı)
    if (u.slide && fe) {
      const sl = u.slide;
      if (sl.kind === 'cyl') {                                                  // revolver: silindir atıştan 35 ms sonra 60° döner
        if (this.slideT > 0.035) this.cylA += (this.cylTo - this.cylA) * Math.min(1, dt * 26);
        sl.g.rotation.z = -this.cylA;
        const cg = ra?.cyl ? reloadGeo(u, this.id, rlMode).cyl : null, ct = ra?.cyl || 0;      // 12.195: doldururken silindir sola açılır
        sl.g.position.set(cg ? cg.out.x * ct : 0, sl.pivot + (cg ? cg.out.y * ct : 0), 0);
      } else {
        const t = this.slideT, it = s.item;
        let x = t < 0.014 ? t / 0.014 : t < 0.024 ? 1 : 1 - (1 - (1 - clamp((t - 0.024) / 0.046, 0, 1)) ** 3);
        let lock = !!it && it.mag <= 0 && st.mag > 0;
        if (ra && !ra.post) { lock = s.reloadEmpty && ra.slide >= 1; if (s.reloadEmpty) x = Math.max(x, ra.slide); }      // 12.195: boşta sürgü şarjör oturduktan sonra (plan.slide) öne fırlar
        if (lock) x = t < 0.014 ? Math.max(x, this.slideX) : 1;
        if (this._slLock && !lock && ra) this.fireFeel(s, 0.35);              // sürgü bırakıldı: tok "çak"
        this._slLock = lock; this.slideX = x;
        sl.g.position.z = x * sl.travel;
      }
    }
    // sol el (yüklemede: aşağıda, kök dönüşümünden sonra — cep / dirsek kamera uzayında)
    if (this.handL && !ra) {
      this.handL.visible = !!this.hLfg && insp < 0.15;               // incelerken sol el silahı bırakır
      if (this.hLfg) this.handL.position.copy(this.hLfg);
    }
    if (this.handR && this.hRgrip && !ra?.R) this.handR.position.copy(this.hRgrip);
    if (u.mag && !ra) {                                              // şarjör alt grubu (yükleme dışında yerinde)
      u.mag.visible = !u.magHidden && !(u.pingEmpty && s.item?.mag === 0);      // magHidden (12.158): şerit klips yalnız doldururken; pingEmpty: yarı otomatikte boş klips fırlamış
      u.mag.position.set(0, 0, 0); u.mag.quaternion.identity();
    }
    if (u.brk && !ra) u.brk.g.rotation.x = 0;
    // kol kutuları (12.124 yönleri, 12.125'te korundu): belden nişana yumuşak döner (dir0 → dirA); yeni yönlerle kol bel / geçiş / nişanda silaha girmez (armclip 0 mm)
    for (const hd of isMelee || this.zh ? [] : [this.handR, this.handL]) {
      const sl = hd?.userData.sleeve; if (!sl) continue;
      const k = (hd === this.handL && ra) || st.adsLow ? 0 : clamp((ads - 0.2) / 0.65, 0, 1), U = hd.userData;
      const kk = k * k * (3 - 2 * k);
      _w.copy(U.dir0).lerp(U.dirA, kk).normalize();
      sl.position.copy(_w).multiplyScalar(U.len / 2 + U.off).add(_e.copy(U.lat).lerp(U.latA, kk)); sl.quaternion.setFromUnitVectors(Z, _w);
    }
    // tam nişan (12.126): yakın düzlem kesmesi kalktı → destek kolu sol-altta görünür (BattleBit gibi, armclip 0 mm); tüfekte tetik eli ads > 0,85'te gizli (kabza arkası göz altında, tabancada görünür)
    const slL0 = this.handL?.userData.sleeve; if (slL0) slL0.visible = true;
    if (this.handR && !this.zh && !isMelee) this.handR.visible = !(!u.noAds && u.sight && u.hold !== 'pistol' && ads > 0.85 && !st.adsLow);
    // ── yakın dövüş savurması ──
    const mir = this.game.leftHand ? -1 : 1;
    let swQ = null;
    const swTab = isMelee && s.swing && (SWING_FP[this.id]?.[s.swing.hv ? 'heavy' : s.swing.kind] || (blade && SWING_FP[this.id]?.[s.swing.kind === 'lr' ? 'lr' : 'rl']));      // tablosuz tür (eski istemci) → kesik
    this._swBlend = Math.max(0, (this._swBlend || 0) - dt / 0.09);
    this.strikeK = Math.max(0, (this.strikeK || 0) - dt * 7);
    if (swTab) {                                                     // 12.135 / 12.194: silah başına anahtar pozlar (f / e yönleri, dördey geçiş)
      const sw = s.swing, k = clamp(sw.t / sw.dur, 0, 1), hk = swingHitK(sw);
      if (sw !== this._swRef) {                                      // yeni savurma: zincirde önceki savurmanın kaldığı pozdan 90 ms'de geçer (sıçrama yok)
        if (this._swRef && this._swLast) { this._swDp0 = (this._swDp0 || new THREE.Vector3()).copy(this._swLast.p); this._swDq0 = (this._swDq0 || new THREE.Quaternion()).copy(this._swLast.q); this._swBlend = 1; }
        this._swRef = sw; this._swK = 0;
      }
      fpSwingDelta(swTab, MELEE_IDLE[this.id], k, !!sw.hv, _sw, _swq);
      if (this._swBlend > 0 && this._swDp0) { const w = this._swBlend * this._swBlend * (3 - 2 * this._swBlend); _sw.lerp(this._swDp0, w); _swq.slerp(this._swDq0, w); }
      (this._swLast ||= { p: new THREE.Vector3(), q: new THREE.Quaternion() }).p.copy(_sw); this._swLast.q.copy(_swq);
      if (this._swK < hk && k >= hk) this.strikeK = sw.hv ? 1.6 : 1;      // vuruş karesi (sunucudaki vuruş anı): kamera mikro tepmesi
      this._swK = k;
      pos.add(_sw); swQ = _swq;
      const dirS = sw.hv ? 0 : sw.kind === 'lr' ? 1 : -1;
      camRoll = _sw.x * 0.06 * mir + this.strikeK * 0.012 * dirS * mir; camPitch = _sw.y * 0.12 - this.strikeK * (sw.hv ? 0.016 : 0.009);
      pos.z -= this.strikeK * 0.012;
    } else if (isMelee && !s.swing && this._swRef) { this._swRef = null; this._swLast?.p.set(0, 0, 0); this._swLast?.q.identity(); } else if (isMelee && s.swing) {                                 // zombi pençesi: eski ortak eğri
      const sw = s.swing;
      const mpz = meleePose(sw.kind, clamp(sw.t / sw.dur, 0, 1));
      pos.x += mpz.x * 1.9; pos.y += mpz.y * 1.7; pos.z += mpz.z * 1.6;
      rx += mpz.rx; ry += mpz.ry; rz += mpz.rz;
      camRoll = -mpz.ry * 0.025; camPitch = mpz.rx * 0.012;
    }
    // vuruş geri tepmesi ve fırlatma
    pos.z += this.hitKick * 0.06; rx += this.hitKick * 0.18;
    // 12.144: bomba — pim çekilince (pişirme / önizleme) el geri ve yukarı kurulur; bırakınca ileri-aşağı savrulur, atılan bomba elde görünmez (cd boyunca)
    this.cookK = (this.cookK || 0) + ((s.cook ? 1 : 0) - (this.cookK || 0)) * Math.min(1, dt * 12);
    this.underK = (this.underK || 0) + ((s.nadeUnder && st.kind === 'throwable' ? 1 : 0) - (this.underK || 0)) * Math.min(1, dt * 10);      // 12.193 alttan: el aşağıda, savruluş yukarı
    const uk = this.underK, okk = 1 - uk;
    if (this.cookK > 0.001) { const c = this.cookK; pos.z += 0.09 * c * okk + 0.04 * c * uk; pos.y += 0.06 * c * okk - 0.16 * c * uk; pos.x += 0.02 * c; rx += 0.45 * c * okk - 0.55 * c * uk; }
    else if (uk > 0.001) { pos.y -= 0.05 * uk; rx -= 0.2 * uk; }
    if (s.cook?.lit) { const lt = Math.min(1, (s.cook.t || 0) / 0.18); pos.x -= 0.03 * Math.sin(lt * Math.PI); }      // pim çekilişi: el kısa bir silkinme
    if (this.throwT > 0) { const f = Math.sin((1 - this.throwT) * Math.PI); pos.z -= f * 0.2; pos.y += f * (0.1 * uk - 0.07 * okk); rx += f * (0.5 * uk - 0.7 * okk); }
    if (st.kind === 'throwable' && this.model?.children[0]) this.model.children[0].visible = !(s.cd > 0 && !s.cook);
    // sallanma (mouse)
    this.sx = lerp(this.sx || 0, -p.lookDX * 0.0006, Math.min(1, dt * 12));
    this.sy = lerp(this.sy || 0, p.lookDY * 0.0006, Math.min(1, dt * 12));
    ry += clamp(this.sx, -0.05, 0.05) * (1 - ads);
    rx += clamp(this.sy, -0.05, 0.05) * (1 - ads);

    // zombi elleri: koşarken biri sağa biri sola açılır, dönüşümlü ileri-geri sallanır; dururken hafif nefes alır
    if (this.zh) {
      const kk = s.swing ? clamp(s.swing.t / s.swing.dur, 0, 1) : 1, spread = Math.sin(Math.PI * clamp(kk / 0.62, 0, 1));   // savurmada parmaklar açılır, vuruştan sonra yeniden kancalanır
      this.handMorph(this.zh.R, spread); this.handMorph(this.zh.L, spread * 0.7);
      const k = this.sprintT || 0, sw = Math.sin(this.bobT * 0.9) * k, br = Math.sin(this.game.time * 1.7) * 0.012;
      const R = this.zh.R, L = this.zh.L;
      R.position.set(0.17 + 0.16 * k, -0.02 * k + br, -sw * 0.12 - 0.03 * k);
      L.position.set(-0.17 - 0.16 * k, -0.02 * k - br, sw * 0.12 - 0.03 * k);
      R.rotation.set(sw * 0.35, -0.12 - 0.42 * k, -0.1 - 0.34 * k);
      L.rotation.set(-sw * 0.35, 0.12 + 0.42 * k, 0.1 + 0.34 * k);
    }
    // sol el: bütün model ve konum/dönüşler x ekseninde aynalanır (negatif ölçek üç.js'te yüz yönünü otomatik düzeltir)
    this.root.position.set(pos.x * mir, pos.y, pos.z);
    this.root.rotation.set(rx, ry * mir, rz * mir);
    if (swQ) { if (mir < 0) swQ.y = -swQ.y, swQ.z = -swQ.z; this.root.quaternion.premultiply(swQ); }      // aynada dördey: (x, −y, −z, w)
    if (blade && this._inspQ && this.inspSpin !== undefined && this.inspectT > 0) { _q.copy(this._inspQ); if (mir < 0) _q.y = -_q.y, _q.z = -_q.z; this.root.quaternion.premultiply(_q); }      // inceleme pozu (aynada dördey aynalanır)
    if (blade && (this.raise > 0 || this.inspSpin)) {               // 12.194 CS2 çekiş: sağ-alttan, ucu aşağıdan kalkarak, sapın çevresinde yarım tur çevrilerek gelir, hafif aşıp oturur · inceleme çevirmesi
      const d = 1 - this.raise, off = 1 - easeOutBack(d, 1.3), spin = this.raise > 0 ? -Math.PI * this.raise ** 3 : 0;
      if (this.raise > 0) { this.root.position.y -= off * 0.24; this.root.position.x += off * 0.05 * mir; this.root.quaternion.premultiply(_q.setFromEuler(_eu.set(-off * 0.8, 0, off * 0.35 * mir))); }
      const a = spin + (this.inspSpin || 0);
      if (a) this.root.quaternion.multiply(_q.setFromAxisAngle(ZAX, a));
    }
    this.root.scale.set(VM_SCALE * mir, VM_SCALE, VM_SCALE);
    if (ra && this.model) this.reloadPose(ra, u, rlMode, s, mir);
    this.stepDrops(dt);
    const hs = isMelee && !this.zh && this.handR?.userData.sleeve;
    if (hs) {                                                        // yakın dövüş kolu: yumruktan dirsek noktasına (12.135; eskiden sapın uzantısıydı → bazı pozlarda kameraya giriyordu)
      const hr = this.handR, U = hr.userData;
      this.root.updateMatrix(); this.model.updateMatrix(); hr.updateMatrix();
      _fm.multiplyMatrices(this.root.matrix, this.model.matrix).multiply(hr.matrix).invert();
      _w.set(ELBOW_FP.x * mir, ELBOW_FP.y, ELBOW_FP.z).applyMatrix4(_fm).normalize();
      hs.position.copy(_w).multiplyScalar(U.len / 2 + 0.04); hs.quaternion.setFromUnitVectors(Z, _w);
    }
    // nişan (12.122): nefes + hafif sallanma + fare gecikmesi + tepme, NİŞAN NOKTASI çevresinde döner → retikül / gez ekran ortasında (= mermi noktası) kalır, gövde oynar
    if (ads > 0.001 && u.sight && !this.noSway) {
      const bt = this.breathT, mv = clamp(speed / 3, 0, 1) * (s.onGround ? 1 : 1.5), ik = u.pivot ? 0.4 : 1;      // demirde %40: arpacık ortada, gez yalnız birkaç piksel oynar
      // tepme nişanda 0,06 × (eskiden kabza çevresinde 0,1 ×): namlu kalkar, retikül ortada kalır, kickR sönümlenince geri oturur
      let ax = ((Math.sin(bt * 1.13) * 0.0021 + Math.sin(bt * 2.31 + 0.7) * 0.0007) * (1 + mv * 1.6) + this.kickR * 0.06 + (fe ? this.rk.K * fe.up * 0.2 : 0) + clamp(this.sy, -0.05, 0.05) * 0.3) * ads;
      let ay = ((Math.sin(bt * 0.71 + 1.9) * 0.0024 + Math.sin(bt * 1.67) * 0.0006) * (1 + mv * 1.6) + clamp(this.sx, -0.05, 0.05) * 0.3 + (fe ? this.rk.S * fe.yaw * 0.35 : 0)) * ads;
      const az = Math.sin(bt * 0.53 + 0.4) * 0.004 * ads;
      ax *= ik; ay *= ik;
      this.root.updateMatrix();
      const pv = u.pivot || u.sight;                                                            // dönme merkezi: optikte nişan noktası, demirde arpacık tepesi
      _sp.set(pv[0], pv[1], pv[2]).applyMatrix4(this.root.matrix);                              // (kamera uzayı)
      _q.setFromEuler(_eu.set(ax, ay * mir, az * mir));
      _sp2.copy(this.root.position).sub(_sp).applyQuaternion(_q).add(_sp);
      this.root.position.copy(_sp2);
      this.root.quaternion.premultiply(_q);
    }
    this.camRoll = lerp(this.camRoll, camRoll, Math.min(1, dt * 14));
    this.camPitch = lerp(this.camPitch, camPitch, Math.min(1, dt * 14));

    this.flashT = Math.max(0, this.flashT - dt);
    if (this.flash) {
      this.flash.visible = this.flashT > 0;
      if (this.flashT > 0) this.flash.userData.mat.opacity = clamp(this.flashT / 0.03, 0.25, 1);
    }
    this.mLight.intensity = this.flash && this.flashT > 0 ? 0.55 * (this.flash.userData.fl || 1) * clamp(this.flashT / 0.03, 0, 1) : 0;
    if (this.flash) { this.mLight.position.copy(this.flash.position); this.mLight.position.z -= 0.04; }
    for (const c of this.casings) {                                            // kovanlar
      if (!c.mesh.visible) continue;
      c.life -= dt; if (c.life <= 0) { c.mesh.visible = false; continue; }
      c.v.y -= 7.5 * dt; c.mesh.position.addScaledVector(c.v, dt);
      c.mesh.rotation.x += c.sp.x * dt; c.mesh.rotation.y += c.sp.y * dt; c.mesh.rotation.z += c.sp.z * dt;
      c.mesh.visible = this.root.visible;
    }
    // görüş tepmesi (yalnız görsel; Player kamerasına eklenir): nişanda biraz az
    this.punch = fe ? this.rk.C * fe.cam * (1 - ads * 0.3) : 0; this.punchR = fe ? this.rk.S * fe.cam * 0.35 : 0;
    // dürbün örtüsü (12.127): adsT > 0,9'da açılır; çıkışta dünya büyütmesi ×2'nin altına inene dek açık kalır (eski: 0,9'da kapanıyor, ×4,6 dünyanın önünde 3B dürbün gövdesi ekranı kaplıyordu) → kapanınca HUD kısa kararma
    const zE = p.zoomEff?.() || 1;
    p.scopeOn = s.alive && s.overlay === 'scope' && (s.adsT > SCOPE_ON || (!!p.scopeOn && zE > 2 && p.zoomCur() >= 2));      // 12.153: 0,9 → SCOPE_ON (göz merceği ekranı kaplamadan, tam kararmanın arkasında açılır)
    this.root.visible = this.forceShow || !p.scopeOn;      // dürbünlü silahta örtü açıkken model gizli (HUD aynı bayrağı kullanır; forceShow: adsalign testi)
    this.cam.rotation.z = -(s.leanK || 0) * LEAN_ROLL;   // yana eğilirken silah da kafayla birlikte yatar (12.166: gerçekleşen eğilme; dünya kamerasıyla aynı açı → nişangâh merkezde)
    if (this.arms.length) {                    // zombi kolları: bilek ucundan dirsek noktasına (kamera uzayı; sol el modunda aynalı)
      this.cam.updateMatrixWorld(true);
      for (const a of this.arms) {
        const w = this.cam.worldToLocal(a.grp.localToWorld(_w.copy(a.wrist)));
        a.mesh.position.copy(w);
        _e.set(a.elbow.x * mir, a.elbow.y, a.elbow.z);
        a.mesh.quaternion.setFromUnitVectors(ZAX, _e.sub(w).normalize());
        const k = VM_SCALE; a.mesh.scale.set(k * mir, k, k);
        a.mesh.visible = this.root.visible && a.grp.visible;
      }
    }
    // nişan alırken silah kamerasının görüş açısı genişler: silah/nişangâh ekranda küçülür, rakip örtülmez (dürbünsüz silahlarda)
    const fovT = 54 + ((st.adsLow ? ADS_FOV_PB : ADS_FOV) - 54) * (u.noAds ? 0 : ads);      // 12.129: paintball 12.127 öncesi gibi genişler (40'ta adsLow ile aşağı inen marker ekranın altından çıkıyordu)
    const nearT = 0.01;      // yakın düzlem hep 1 cm (12.126): nişanda kesme yok → dipçik / kabza / gövde arkası alt-ortada bütün kütle (eski ADS_NEAR 25–33 cm'de silahı dilimliyordu)
    if (Math.abs(this.cam.fov - fovT) > 0.01 || Math.abs(this.cam.near - nearT) > 1e-4) { this.cam.fov = fovT; this.cam.near = nearT; this.cam.updateProjectionMatrix(); }
    // dokunmatik: dürbünsüz nişanda (demir / red dot / holo) silah modeli yarı saydamlaşır. Küçük ekranda nişangâh gövdesi merkezin
    // %36-50'sini (3° içinde, bkz. adsview.mjs) kapatıyor, hedef tamamen arkasında kalıyordu; nişangâh HUD'da (#rdot / #holo / nokta) net kalır
    // telefon (12.123): HUD retikülü (#rdot / #holo, nişangâh boyutu ayarıyla büyük) ads > 0,97'de çıkar → 3B ışıyan nokta / halka soluklaşmayla birlikte söner (iki farklı boy halka üst üste görünmez)
    // 12.127: ışıyan 3B halka / nokta tam HUD eşiğinde (ADS_HUD) söner: eski 0,95'te sıfırlanıp HUD 0,97'de geliyordu → arada retikülsüz kareler. HUD halkası artık 3B çerçeveyle aynı boy, geçiş zıplamaz
    // 12.128: masaüstünde de 3B ışıma HUD retikülüyle aynı karede söner (ışıma ×3 ton eşlemede pembeleşip nefes / sallanmayla HUD noktasının arkasında kayıyordu); ACOG PiP açıkken 3B nokta söner (mercekte gölgelendirici noktası)
    const fk = p.touch && s.overlay !== 'scope' && s.overlay !== 'lens' && !st.adsLow && !this.noFade ?      // 12.129: paintball marker sağ-altta, merkezi kapatmaz → telefonda soluklaşmaz
      clamp((ads - 0.55) / 0.4, 0, 1) : 0;
    // 12.162: ACOG merceği adsT > LENS_ON'da saydamlaşır (derinlik maskesi); koyu cam LENS_FADE boyunca söner. Retikül red dot gibi: 3B nokta tam nişanda HUD #rdot'a geçer
    if (this.lensDisc) { const on = s.alive && s.overlay === 'lens' && s.adsT > LENS_ON; this.lensDisc.visible = on; if (on) this._lensTint.opacity = 1 - clamp((s.adsT - LENS_ON) / LENS_FADE, 0, 1); this.lensDisc.children[0].visible = on && this._lensTint.opacity > 0.004; }
    // 12.190: büyüten merceğin (2× / 3× / 4×) ekrandaki yeri ve yarıçapı (CSS px, ekran ortasına göre): HUD #lens retikülü + dış bulanıklık / gövde halkası merceği izler.
    // Tam nişanda nişan noktası (mercek merkezi) ekran ortasında → retikül = mermi noktası (sallanma / tepme nişan noktası çevresinde döner, merkez kaymaz)
    const ls = this.lensScr;
    ls.on = false;
    if (this.lensDisc && s.alive && s.overlay === 'lens' && ads > 0.02) {
      this.cam.updateMatrixWorld(true);
      const W = innerWidth, H = innerHeight;
      this.lensDisc.getWorldPosition(_sp).project(this.cam);
      _sp2.set(this.lensDisc.userData.r, 0, 0); this.lensDisc.localToWorld(_sp2).project(this.cam);
      ls.x = (_sp.x * W) / 2; ls.y = (-_sp.y * H) / 2; ls.r = Math.hypot(((_sp2.x - _sp.x) * W) / 2, ((_sp2.y - _sp.y) * H) / 2); ls.on = _sp.z < 1;
    }
    this.setFade(fk * 0.5, (s.overlay === 'dot' || s.overlay === 'holo' || (s.overlay === 'lens' && s.opticDef?.reticle === 'dot')) && ads > ADS_HUD && !this.noFade ? 0 : 1);      // 12.174: öncü dürbünün siyah retikülü 3B kalır (HUD'a geçmez)      // noFade: adsalign 3B retikülü ölçer
  }

  // ── 12.195 yükleme pozu: sol / sağ el plan noktalarında, şarjör ele bağlı (elin tutma noktasında; havada süzülmez), cep ve dirsek kamera uzayında ──
  reloadPose(ra, u, mode, s, mir) {
    const geo = reloadGeo(u, this.id, mode), g = this.model;
    this.root.updateMatrix(); g.updateMatrix();
    _fm.multiplyMatrices(this.root.matrix, g.matrix); _rlInv.copy(_fm).invert();
    const toGun = (x, y, z, o) => o.set(x * mir, y, z).applyMatrix4(_rlInv);
    const ex = this._rlEx || (this._rlEx = { fg: null, pouch: new THREE.Vector3(), gR: new THREE.Vector3(), u: null });
    ex.fg = this.hLfg; ex.u = u; ex.gR.copy(this.hRgrip || u.gripR || ZERO3);
    toGun(POUCH_CAM.x, POUCH_CAM.y, POUCH_CAM.z, ex.pouch);
    const post = ra.post ?? 0;
    if (u.brk) u.brk.g.rotation.x = (geo.brk?.A ?? -0.6) * (ra.brk || 0);         // kırma namlu
    const hL = this.handL;
    if (hL) {
      if (ra.L) { blendPoint(geo, ra.L, ra, ex, _rlH); (this._rlHL ||= new THREE.Vector3()).copy(_rlH); }
      else _rlH.copy(this.hLfg || ex.pouch).lerp(this._rlHL || _rlH, post);      // bitiş: son pozdan kundağa / cebe
      hL.position.copy(_rlH); hL.visible = true;
      const sl = hL.userData.sleeve;                                                    // kol: elden ekran dışındaki dirseğe (silahın dışından)
      if (sl) {
        toGun(ELBOW_L.x, ELBOW_L.y, ELBOW_L.z, _rlE).sub(_rlH).normalize();
        _w.copy(hL.userData.dir0).lerp(_rlE, clamp(ra.act * 1.4, 0, 1)).normalize();
        sl.position.copy(_w).multiplyScalar(hL.userData.len / 2 + hL.userData.off).add(hL.userData.lat); sl.quaternion.setFromUnitVectors(Z, _w);
      }
    }
    const hR = this.handR;
    if (hR && ra.R) {
      blendPoint(geo, ra.R, ra, ex, _rlH2); hR.position.copy(_rlH2);
      const gw = ra.R.reduce((a, [n, c]) => a + (n === 'gR' ? c : 0), 0), sl = hR.userData.sleeve;
      if (sl) {
        toGun(ELBOW_R.x, ELBOW_R.y, ELBOW_R.z, _rlE).sub(_rlH2).normalize();
        _w.copy(hR.userData.dir0).lerp(_rlE, clamp((1 - gw) * 1.4, 0, 1)).normalize();
        sl.position.copy(_w).multiplyScalar(hR.userData.len / 2 + hR.userData.off).add(hR.userData.lat); sl.quaternion.setFromUnitVectors(Z, _w);
      }
    }
    // şarjör: takılı / elde / bırakıldı
    const mg = u.mag, st = ra.mag, prev = this._rlMag;
    if (mg) {
      if (st === 'hand' && hL) {
        const d = _rlH.distanceTo(geo.G), a = (RL_TILT[this.id] ?? (Math.abs(geo.out.y) >= 0.7 ? 0.3 : 0)) * clamp(d / geo.L, 0, 1);
        mg.quaternion.setFromAxisAngle(geo.tAx, a);
        mg.position.copy(geo.G).applyQuaternion(mg.quaternion).negate().add(_rlH);
        mg.visible = true;
      } else if (mode === 'hopper' && geo.lid) {                                       // paintball: kapak menteşesinden açılır (silaha bağlı)
        mg.quaternion.setFromAxisAngle(_X, geo.lid.A * (ra.lid || 0));
        mg.position.copy(geo.lid.piv).applyQuaternion(mg.quaternion).negate().add(geo.lid.piv); mg.visible = true;
      } else {
        mg.position.set(0, 0, 0); mg.quaternion.identity();
        mg.visible = post ? !u.magHidden : st === 'gun';
      }
      if (st === 'drop' && prev && prev !== 'drop' && !post) this.dropPart(mg, prev === 'hand' ? _rlV.set(-0.5 * mir, -0.4, 0.25) : _rlV.set(-0.05 * mir, -0.9, 0.05));      // eski şarjör düşer
      if (st === 'drop') mg.visible = false;
    }
    this._rlMag = post ? null : st;
    // eldeki parça (fişek / 40 mm / doldurucu / boya tüpü)
    const it = ra.item, pit = this._rlItem;
    for (const [n, m] of Object.entries(this._rlItems || {})) m.visible = n === it;
    if (it && hL) {
      const m = this.itemMesh(it); m.visible = true; itemOff(geo, it, ra.brk || 0, m.position);
      m.rotation.set(geo.brk && (it === 'round' || it === 'shell') ? geo.brk.A * (ra.brk || 0) : 0, 0, 0);
    }
    if (pit && !it && ra.toss != null && !post) { const m = this.itemMesh(pit); m.visible = true; this.dropPart(m, _rlV.set(-0.6 * mir, 0.2, 0.3)); m.visible = false; }
    this._rlItem = post ? null : it;
    // boş kovan (M79 / revolver)
    const kk = post ? 1 : clamp((s.reloadTotal - s.reloadT) / s.reloadTotal, 0, 1);
    if (ra.eject != null && !post && kk >= ra.eject && !this._rlEj) { this._rlEj = true; this.ejectCases(mode, geo, mir); }
    if (post || kk < (ra.eject ?? 0)) this._rlEj = false;
  }
  // elde taşınan parça ağı (el grubunun çocuğu; ilk kullanımda kurulur)
  itemMesh(name) {
    const its = this._rlItems || (this._rlItems = {});
    if (its[name] && its[name].parent === this.handL) return its[name];
    const M = (c, mt = 0.2) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: mt });
    const cy = (r, l, mt, z = 0, x = 0, y = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 10), mt); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m; };
    const grp = new THREE.Group();
    if (name === 'shell') grp.add(cy(0.0095, 0.05, M('#b3261e', 0.05), -0.006), cy(0.0102, 0.016, M('#c9a043', 0.85), 0.026));
    else if (name === 'round') grp.add(cy(0.02, 0.05, M('#c9a043', 0.8), 0.02), cy(0.0185, 0.035, M('#5d6b3a', 0.2), -0.02));
    else if (name === 'loader') { grp.add(cy(0.027, 0.018, M('#2a2b2e', 0.5)), cy(0.008, 0.03, M('#3a3b3e', 0.4), 0.02)); for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3 + Math.PI / 2; grp.add(cy(0.0052, 0.03, M('#c9a043', 0.85), -0.022, Math.cos(an) * 0.019, Math.sin(an) * 0.019)); } }
    else if (name === 'pod') { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.11, 12), new THREE.MeshStandardMaterial({ color: '#e8e8ea', roughness: 0.3, transparent: true, opacity: 0.75 })); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.09, 10), M(this.model?.userData.paint || '#ff4fa3', 0)); grp.add(a, b); }
    grp.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    this.handL.add(grp); its[name] = grp;
    return grp;
  }
  // düşen parça: kamera uzayına kopyalanır, yer çekimiyle düşer, döner, ~0,75 sn sonra kaybolur (en çok 8)
  dropPart(src, v) {
    this.root.updateMatrixWorld(true); this.cam.updateMatrixWorld(true);
    const c = src.clone(); c.visible = true;
    _fm.copy(this.cam.matrixWorld).invert().multiply(src.matrixWorld);
    _fm.decompose(c.position, c.quaternion, c.scale);
    c.traverse((o) => { o.frustumCulled = false; });
    this.cam.add(c);
    (this.drops ||= []).push({ o: c, v: v.clone(), w: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 8), life: 0.75 });
    while (this.drops.length > 8) this.cam.remove(this.drops.shift().o);
  }
  stepDrops(dt) {
    if (!this.drops?.length) return;
    for (const d of this.drops) {
      d.life -= dt; d.v.y -= 7.5 * dt; d.o.position.addScaledVector(d.v, dt);
      d.o.rotation.x += d.w.x * dt; d.o.rotation.y += d.w.y * dt; d.o.rotation.z += d.w.z * dt;
      d.o.visible = this.root.visible && d.life > 0;
    }
    this.drops = this.drops.filter((d) => { if (d.life > 0) return true; this.cam.remove(d.o); return false; });
  }
  clearDrops() { for (const d of this.drops || []) this.cam.remove(d.o); this.drops = []; for (const m of Object.values(this._rlItems || {})) { m.removeFromParent(); m.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); } this._rlMag = this._rlItem = null; this._rlItems = null; this.rlOut = 0; this.rlLast = null; this._rlHL = null; this._rlEj = false; }      // 12.210: eldeki fişek / doldurucu önbellekteki sol elde kalmasın
  // boş kovanlar: M79 tek 40 mm kovan, revolver altı kovan (silindirin arkasından)
  ejectCases(mode, geo, mir) {
    const mat = new THREE.MeshStandardMaterial({ color: '#c99a3e', metalness: 0.85, roughness: 0.32 });
    const ps = [];
    if (mode === 'break' && geo.brk) ps.push(brkPoint(geo, geo.brk.rear, 1, new THREE.Vector3()).add(new THREE.Vector3(0, 0, 0.03)));
    if (mode === 'cyl' && geo.cyl) for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ps.push(geo.cyl.rear.clone().add(geo.cyl.out).add(new THREE.Vector3(Math.cos(a) * 0.019, Math.sin(a) * 0.019, 0.01))); }
    for (const p of ps) {
      const r = mode === 'break' ? 0.02 : 0.0052, m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, mode === 'break' ? 0.05 : 0.03, 10), mat);
      m.rotation.x = Math.PI / 2; m.position.copy(p); this.model.add(m);
      this.dropPart(m, _rlV.set((-0.2 + Math.random() * 0.2) * mir, mode === 'break' ? 0.7 : -0.4 - Math.random() * 0.3, mode === 'break' ? 0.6 : 0.1));
      this.model.remove(m);
    }
  }

  // adsalign testi: S3 retikülleri saf eflatun (ekranda merkez ölçümü)
  probe(on) { setSkinProbe(on); }

  // El ağının morph hedefi (0: ana poz, 1: ikinci poz)
  handMorph(grp, v) { const m = grp && grp.children.find((o) => o.userData.fpHand); if (m && m.morphTargetInfluences) m.morphTargetInfluences[0] = v; }

  // Modelin saydamlığı (0 = opak). Malzemeler önbellekte paylaşılıyor (3. şahıs silahları): ilk kullanımda bu modele özel kopyalanır
  setFade(f, ga = 1) {
    const m = this.model, go = m?.userData.glowA ?? 1;
    if (!m || (Math.abs(f - (m.userData.fade || 0)) < 0.01 && (ga === go || (Math.abs(ga - go) < 0.01 && ga > 0 && ga < 1)))) return;      // uçlar (0 / 1) her zaman tam yazılır
    const own = (x) => x.blending === THREE.AdditiveBlending || (x.userData.skinMat && !x.userData.shared);       // S3 kaplama malzemesi zaten bu modele özel (klonlanmaz: uniform'lar paylaşılmaz)
    if (!m.userData.ownMat) { m.traverse((o) => { if (o.isMesh && o.material && !own(o.material)) o.material = Array.isArray(o.material) ? o.material.map((x) => x.clone()) : o.material.clone(); }); m.userData.ownMat = true; }
    m.userData.fade = f; m.userData.glowA = ga;
    m.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const x of Array.isArray(o.material) ? o.material : [o.material]) {
        if (x.blending === THREE.AdditiveBlending) continue;
        if (x.userData.skinMat) { setSkinAlpha(x, 1 - f, ga); continue; }                          // ışıyan retikül: ga (telefonda HUD retikülüne geçişte söner)
        if (x._op0 === undefined) x._op0 = x.opacity, x._tr0 = x.transparent;
        const tr = x._tr0 || f > 0;
        if (tr !== x.transparent) { x.transparent = tr; x.needsUpdate = true; }
        x.opacity = x._op0 * (1 - f);
      }
    });
  }

  render(renderer, w, h) {
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
    renderer.clearDepth();
    renderer.render(this.scene, this.cam);
  }
}

// ───────────── Oyuncu kontrolcüsü ─────────────
export class Player {
  constructor(game, soldier, settings) {
    this.game = game;
    this.s = soldier;
    this.set = settings;
    this.keys = new Set();
    this.kb = game.binds;
    this.fireHeld = false; this.fireBuf = 0;
    this.lookDX = 0; this.lookDY = 0;
    this.locked = false;
    this.vm = new ViewModel(game);
    this.breath = new ScopeBreath(game);                                       // 12.156: dürbün sallanması + nefes tutma (bakışa eklenir)
    this.fov = settings.fov;
    this.camPos = new THREE.Vector3();
    this.bodyVisible = false;
    this.third = false; this.thirdT = 0; this.side = 1; this.sideT = 1;      // 3. şahıs: açık mı, geçiş (0..1), omuz hedefi (±1), omuz geçişi
    this._tv = { p: new THREE.Vector3(), f: new THREE.Vector3(), r: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3(), q: new THREE.Vector3(), hit: {} };
    this._cs = null;
    this.deathCamT = 0;
    this._bound = [];
    this.bind();
    if (isTouch()) { game.noPointerLock = true; this.touch = new TouchControls(this); }      // telefon / tablet: fare kilidi yok, ekran kontrolleri
    this.refreshWeapon();
    game.on('switch', (s) => { if (s === this.s) this.refreshWeapon(); });
    game.on('spawn', (s) => { if (s === this.s) this.refreshWeapon(); });
    if (this.devTools()) setTimeout(() => game.hud?.toast($t('hud.t.workshop'), '#ffb347'), 2500);
    game.on('fire', (s) => {
      if (s !== this.s) return;
      const vm = this.vm;
      if (vm.feel) vm.fireFeel(s); else { vm.kick = Math.min(vm.kick + 0.045, 0.12); vm.kickR = Math.min(vm.kickR + 0.18, 0.5); }      // 12.141: tabanca yay tepmesi, diğerleri eski
      vm.flashT = 0.045;
      if (s.stat.space) spaceFire(vm, s, game);                                    // 12.157: enerji alevi rengi, ışıma darbesi, ray tüfeği şarjı, makineli ısınması
      if (vm.flash) { const f = vm.flash, k = (0.82 + Math.random() * 0.36) * (1 - 0.45 * s.adsT); f.rotation.z = Math.random() * Math.PI; f.scale.set(k, k, 0.85 + Math.random() * 0.3); }      // her atışta farklı alev (nişanda küçük: nişangâhı örtmesin)
    });
    game.on('bolt', (s) => { if (s === this.s) this.vm.kickR += 0.2; });
    game.on('melee', (s) => { if (s === this.s) this.vm.kick = 0.02; });
    game.on('meleehit', () => { this.vm.hitKick = 1; });
    game.on('throw', (s) => { if (s === this.s) this.vm.throwT = 1; });
    game.on('dry', (s) => { if (s === this.s) this.vm.dryT = 1; });
    game.on('firemode', (s) => { if (s === this.s) { this.game.hud.toast($t('hud.t.fireMode', { m: fireName(s.fireModeNow) }), '#cfe6ff'); this.vm.dryT = 1; } });
    // flaşbang (beyaz) ve duman (gri) ekran örtüsü: HUD'dan bağımsız, kendi katmanı
    const ov = (this.fx = document.createElement('div'));
    ov.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;background:#fff';
    const sm = (this.fxSmoke = document.createElement('div'));
    sm.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;background:#9aa0a6';
    document.body.append(sm, ov);
  }

  // Geliştirici haritası (yalnızca çevrimdışı): L uçuş, J/K elindeki yuvadaki silahı sıradakiyle değiştirir
  devTools() { return (!!this.game.mapDef?.dev || !!this.game.opts.devMode) && !this.game.online; }

  flyMove(f, r, k, dt) {
    const s = this.s, kb = this.kb, sp = (this.flySpeed || 13) * (kb.held('sprint', k) ? 3 : 1), cp = Math.cos(s.pitch);
    const up = (kb.held('jump', k) ? 1 : 0) - (kb.held('crouch', k) ? 1 : 0);
    let x = -Math.sin(s.yaw) * cp * f + Math.cos(s.yaw) * r, y = Math.sin(s.pitch) * f + up, z = -Math.cos(s.yaw) * cp * f - Math.sin(s.yaw) * r;
    const l = Math.hypot(x, y, z) || 1;
    s.vel.set((x / l) * sp, (y / l) * sp, (z / l) * sp);
    s.leanDir = 0; s.sprinting = false; s.crouching = false; s.prone = false;
  }

  cycleWeapon(dir) {
    const s = this.s, slot = ['primary', 'secondary', 'gadget', 'melee'][s.cur];
    const list = Object.keys(WSTATS).filter((id) => WSTATS[id].slot === slot);
    const id = list[(list.indexOf(s.item.id) + dir + list.length) % list.length], st = WSTATS[id], n = st.count || 1;
    s.items[s.cur] = st.kind === 'gun' ? { id, mag: st.mag, reserve: st.reserve } : st.kind === 'launcher' ? { id, mag: 1, reserve: n - 1 } : st.kind === 'melee' ? { id, mag: 1, reserve: 0 } : { id, mag: n, reserve: 0 };
    s.reloadT = 0; s.cd = 0; s.useT = 0; s.swing = null;
    this.refreshWeapon();
    this.game.hud.toast(`${wName(id)}  (${list.indexOf(id) + 1}/${list.length})`);
  }

  refreshWeapon() {
    const s = this.s;
    this.vm.look = this.game.mode.paintball && !s.def?.zombie ? pbLook(paintColorOf(s)) : this.game.mode.space && !s.def?.zombie ? spaceLook(s.team) : this.game.mode.front && !s.def?.zombie ? ww2Look(s.team) : !s.def?.zombie && !this.game.mode.paintball ? fpWearLook(s.team, s.model?.wear) : null;      // 12.167 kıyafet manşeti · 12.157: Uzay kıyafeti kolu · 12.158: Cephe ceket kolu + koyu eldiven · paintball: forma rengi
    this.vm.setItem(s.item.id, s.team, s.stat.kind, s.opticId || s.optic, s.def?.zombie ? s.zt?.skin : null, s.skinOf(s.item.id));
    if (s.stat.ball) { tintPaint(this.vm.model, paintColorOf(s)); this.vm.flash?.removeFromParent(); this.vm.flash = null; }      // paintball: hazne / tüp kendi boya rengimde, namlu alevi yok
    if (s.stat.kind === 'melee' && (this.touch || this.game.opts.adsToggle)) { s.ads = false; this.touch?.b?.ads?.classList.remove('on'); }      // 12.194: aç-kapa nişan açıkken bıçağa geçilirse sağ tık (ağır vuruş) kendiliğinden tekrarlamasın
  }

  on(target, ev, fn, opt) { target.addEventListener(ev, fn, opt); this._bound.push([target, ev, fn, opt]); }

  // Zombi özel gücü: çevrimdışı hemen uygula; çevrimiçinde sunucu uygular (kenar olayı gönderilir)
  zAbility() {
    const s = this.s;
    if (this.game.online) this.game.online.edge('ab'); else s.useAbility();
  }

  bind() {
    const cv = this.game.canvas;
    this.on(window, 'keydown', (e) => {
      const code = norm(e.code), kb = this.kb;
      if (code === 'Tab' || code === 'Space' || code.startsWith('Arrow') || code === 'F3' || kb.is('scoreboard', code) || kb.is('jump', code)) { if (this.game.running) e.preventDefault(); }   // basılı tutunca tekrar eden olaylar dahil
      if (e.repeat) return;
      this.keys.add(code);
      const s = this.s;
      if (!this.game.running) return;
      if (kb.is('chat', code) && this.game.chat && this.locked && !this.wheel) { e.preventDefault(); this.game.chat.open(e.shiftKey); return; }      // sohbet (çevrimiçi): Enter herkese, Shift+Enter takıma
      if (kb.is('map', code) && this.game.bigMap && !this.wheel) { e.preventDefault(); this.game.bigMap.toggle(); }      // 12.202 büyük harita (M)
      if (kb.is('ping', code) && s.alive && this.locked && !this.wheel) this.game.pings?.spot();                         // 12.202 işaret / düşman işaretle
      if (kb.is('wheel', code) && s.alive && !this.wheel && !s.veh) this.openWheel();
      // 12.177 araç: E bin / in (yanında ya da içindeyken; değilse E sağa eğilmedir), V kamera (sürücü), 1–4 koltuk
      const V = this.game.vehicles;
      if (V && s.alive && kb.is('vehicle', code) && (s.veh || V.near(s))) { this.vehLatch = true; if (this.game.online) this.game.online.edge('ve'); else V.toggle(s); }
      if (V && s.alive && kb.is('vehAlt', code) && this.pilotArmed()) this.vehWeapon();      // 12.206 helikopter pilotu: Q = burun topu ↔ roket (seçili silah sol tıkla)
      if (V && s.veh && kb.is('vehCam', code)) { this.vehCam = this.vehCam === 'first' ? 'third' : 'first'; this.game.hud.toast($t(this.vehCam === 'first' ? 'veh.t.camFirst' : 'veh.t.camThird'), '#cfe6ff'); }
      if (kb.is('third', code) && s.alive && !s.veh) this.toggleThird();
      if (kb.is('inspect', code) && s.alive && !this.wheel) this.vm.inspect(s);                  // silah inceleme (CS tarzı)
      if (kb.is('leftHand', code)) this.toggleHand();
      if (this.devTools() && s.alive) {
        if (e.code === 'KeyL') { s.fly = !s.fly; if (!s.fly) s.vel.set(0, 0, 0); this.game.hud.toast(s.fly ? $t('hud.t.flyOn') : $t('hud.t.flyOff')); }
        if (e.code === 'KeyP') { const g = this.game, c = g.map.callouts, p = s.pos; let nm = ''; if (c) { let bd = 1e9; for (const q of c) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; nm = q.name; } } } const t = `Konum x ${p.x.toFixed(1)} · y ${p.y.toFixed(1)} · z ${p.z.toFixed(1)}${nm ? ' · ' + nm : ''} · ${s.fly ? 'UÇUŞ AÇIK (çarpışma yok)' : 'yürüyorsun'}`; console.log('[geliştirici]', t); g.hud.toast(t, '#cfe6ff'); }
        if (e.code === 'KeyN') { const g = this.game; if (g.brainsOff) { g.brains.push(...g.brainsOff); g.brainsOff = null; g.hud.toast($t('hud.t.botsOn'), '#9fe6a8'); } else { g.brainsOff = g.brains.splice(0); g.hud.toast($t('hud.t.botsOff'), '#ffd27a'); } }
        if (e.code === 'KeyO') { const g = this.game; g.devGod = !g.devGod; g.hud.toast(g.devGod ? $t('hud.t.godOn') : $t('hud.t.godOff'), '#cfe6ff'); }
        if (e.code === 'KeyJ') this.cycleWeapon(-1);
        if (e.code === 'KeyK') this.cycleWeapon(1);
      }
      if (this.third && kb.is('leanLeft', code)) this.side = -1;                     // 3. şahıs: eğilme tuşları omuz değiştirir (aynı zamanda yatırır)
      if (this.third && kb.is('leanRight', code)) this.side = 1;
      if (kb.is('reload', code)) { if (s.stat.kind === 'throwable') this.cookReq = true; else s.startReload(); this.game.online?.edge('rl'); if (this.pilotArmed() && !this.game.online) V.reloadRockets(s.veh); }      // 12.206 pilotta R = roket kapsülünü doldur      // 12.193: bombada R = pimi çek (adımda, sunucuyla aynı sırada)
      if (kb.is('quickNade', code) && s.alive && !s.veh && !this.wheel) this.quickNade(true);
      if (s.alive && !s.veh && kb.is('crouch', code)) { s.toggleCrouch(); this.game.online?.edge('c'); }
      if (s.alive && !s.veh && kb.is('prone', code)) { s.toggleProne(); this.game.online?.edge('p'); }
      if (s.alive && kb.is('optic', code)) { this.game.online?.edge('o'); const o = s.cycleOptic(); if (o) { this.game.hud.toast($t('hud.t.optic', { o: opticName(s.opticId) }), '#cfe6ff'); this.saveEraOptic(); } }
      const slot = kb.slotOf(code);                                                 // tuş konumu (1 ana, 2 yedek, 3 bıçak, 4 ekipman) → items indeksi
      if (s.veh) { const n = /^Digit[1-4]$/.test(code) ? +code[5] - 1 : -1; if (n >= 0 && s.alive) { if (this.game.online) this.game.online.edges.vs = n + 1; else V.seatTo(s, n); } }      // araçta 1–4 = koltuk (silah: fare tekerleği)
      else if (slot >= 0) { const i = slotOrder(s.items.length)[slot]; if (i !== undefined) s.switchTo(i); }
      if (kb.is('fireMode', code) && s.alive) { s.toggleFireMode(); this.game.online?.edge('fm'); }
      if (kb.is('scoreboard', code)) { e.preventDefault(); this.game.hud.showScoreboard(true); }
      if (kb.is('ability', code) && s.alive && s.def.zombie && !e.repeat) this.zAbility();
      if (code === 'Space' || code.startsWith('Arrow')) e.preventDefault();
      if (kb.is('jump', code) && s.alive && (s.prone || s.crouching)) { s.standUp(); this.game.online?.edge('u'); this.spaceLatch = true; }   // yatarken/çömelirken zıplama tuşu = kalk
      if (code === 'Escape' && this.game.noPointerLock) this.game.togglePause();
      if (!s.alive && this.game.respawnReady() && this.game.mode.infection) {                                  // Enfekte ölüm ekranı: 1-5 zombi türü
        const n = slot >= 0 ? slot : code === 'Digit5' ? 4 : -1;
        const ks = Object.keys(this.game.classDefs);
        if (s.willCure) { if (n >= 0 && ks[n]) this.game.requestClass(ks[n]); }                   // can hakkı bitti: insan olarak doğacaksın → sınıf seç
        else if (!s.boss && n >= 0 && ZT_ORDER[n]) this.game.requestZType(ZT_ORDER[n]);
      }
      if (!s.alive && this.game.respawnReady() && !this.game.mode.infection && !this.game.mode.fixed) {                                 // ölüm ekranında sınıf seç: yuva tuşları 1-4, Digit5 beşinci sınıf
        const keys = Object.keys(this.game.classDefs);
        const n = slot >= 0 ? slot : code === 'Digit5' ? 4 : -1;
        if (n >= 0 && keys[n]) this.game.requestClass(keys[n]);
        const step = kb.is('leanLeft', code) || code === 'ArrowLeft' ? -1 : kb.is('leanRight', code) || code === 'ArrowRight' ? 1 : 0;   // doğma noktası: sol/sağ eğil tuşları (ya da ← →) seçeneği değiştirir
        if (step) this.game.cycleSpawn(step);
      }
    });
    this.on(window, 'blur', () => { this.keys.clear(); this.fireHeld = false; this.mmb = false; this.s.ads = false; this.game.hud.showScoreboard(false); this.closeWheel(); });     // pencere odağı gidince takılı tuş kalmasın
    this.on(window, 'keyup', (e) => {
      const code = norm(e.code), kb = this.kb;
      if (kb.is('wheel', code)) this.closeWheel();
      if (code === 'Tab' || kb.is('scoreboard', code)) e.preventDefault();
      this.keys.delete(code);
      if (kb.is('vehicle', code)) this.vehLatch = false;
      if (kb.is('quickNade', code) && this.qNade) this.qNade.held = false;
      if (kb.is('jump', code)) this.spaceLatch = false;
      if (kb.is('scoreboard', code)) this.game.hud.showScoreboard(false);
    });
    this.on(document, 'mousemove', (e) => {
      if (this.game.chatOpen) return;                                                          // yazarken bakış donar
      if (this.skipMove > 0) { this.skipMove--; return; }                                    // kilit sonrası ilk olaylar sıçrar
      // ani sıçramaları (sürücü/Chrome hatası) kes: tek olayda 120 pikselden fazla gerçek bir fare hareketi değildir
      const mx = Math.max(-120, Math.min(120, e.movementX || 0)), my = Math.max(-120, Math.min(120, e.movementY || 0));
      if (this.wheel) { this.wheelMove(mx, my); return; }                                      // T basılıyken fare seçim imlecidir
      const bm = this.game.bigMap;
      if (bm?.open) { if (document.pointerLockElement) bm.moveCursor(mx, my); return; }       // 12.202 büyük harita / doğuş ekranı: fare haritada imleç (bakış dönmez)
      if (!this.locked) return;
      const k = this.set.sens / Math.pow(this.zoomCur(), 0.8);      // 12.127: hassasiyet o anki büyütmeyle sürekli (eski adsT 0,5'te basamak)
      this.look(mx * k, my * k);
      this.lookDX += mx; this.lookDY += my;
    });
    this.on(cv, 'mousedown', (e) => {
      if (this.wheel) { if (e.button === 0) this.wheelPick(); return; }                       // tekerlek açıkken tık = seçim (ateş değil)
      if (this.game.bigMap?.open && document.pointerLockElement) { this.game.bigMap.lockedDown(e.button); return; }      // 12.202 harita açık: tık imlecin altındakine · 12.205 basılı sürükleme = kaydırma (bırakınca tık)
      if (e.button === 1) { e.preventDefault(); if (this.locked && this.s.alive) this.game.pings?.spot(); return; }       // 12.202 orta tık: işaret (Battlefield spot) · 12.206: helikopter pilotunda da (roket artık seçili silah: Q / tekerlek + sol tık)
      if (!this.locked) { this.game.requestLock(); return; }
      if (this.game.chatOpen) return;
      if (e.button === 0) { this.fireHeld = true; this.fireBuf = 0.15; this.game.online?.edge('fp'); }
      if (e.button === 2 && this.s.def.zombie) { this.zAbility(); return; }                  // zombi: sağ tık = özel güç
      if (e.button === 2 && this.s.stat.kind === 'throwable') { this.nadeModeReq = true; this.game.online?.edge('nu'); return; }      // 12.193 PUBG: bombada sağ tık = üstten ↔ alttan
      if (e.button === 2) this.s.ads = this.game.opts.adsToggle ? !this.s.ads : true;          // Ayarlar: basılı tut ya da bir kez bas (aç-kapa)
    });
    this.on(window, 'mouseup', (e) => {
      if (this.game.bigMap?.open && document.pointerLockElement) this.game.bigMap.lockedUp(e.button);      // 12.205
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 1) this.mmb = false;
      if (e.button === 2 && !this.game.opts.adsToggle) this.s.ads = false;
    });
    this.on(document, 'contextmenu', (e) => e.preventDefault());                      // sağ tık menüsü oyunda hiç çıkmasın (nişan alırken takılıyordu)
    this.on(window, 'wheel', (e) => {
      if (!this.locked || !this.s.alive || this.game.bigMap?.open) return;
      const dir = e.deltaY > 0 ? 1 : -1, s = this.s;
      if (s.fly && this.devTools()) { this.flySpeed = Math.max(3, Math.min(120, (this.flySpeed || 13) * (dir > 0 ? 0.8 : 1.25))); this.game.hud.toast($t('hud.t.flySpeed', { n: this.flySpeed.toFixed(0) }), '#cfe6ff'); return; }       // uçarken tekerlek hız ayarlar
      if (this.pilotArmed()) { const t = performance.now(); if (t - (this._vwT || 0) > 220) { this._vwT = t; this.vehWeapon(); } return; }      // 12.206 helikopter pilotu: tekerlek = burun topu ↔ roket (bir tekerlek hareketi = bir değişim)
      if (this.varZoomStep(dir)) return;                                                                 // 12.190: değişken dürbünde nişandayken tekerlek = büyütme (silah değiştirmez)
      const ord = slotOrder(s.items.length), n = ord.length, at = Math.max(0, ord.indexOf(s.cur));      // tuş / HUD sırasında (ana → yedek → bıçak → ekipman) döner
      for (let k = 1; k <= n; k++) { const j = ord[(at + dir * k + n * 2) % n]; if (j !== s.cur && s.canEquip(j)) { s.switchTo(j); break; } }       // boş slotları atla
    }, { passive: true });
  }

  // Silahı tutan eli değiştir (sağ ↔ sol): birinci şahıs modeli aynalanır; tercih kaydedilir
  toggleHand() {
    const g = this.game;
    g.leftHand = !g.leftHand;
    g.hud.toast(g.leftHand ? $t('hud.t.leftHand') : $t('hud.t.rightHand'), '#cfe6ff');
    g.opts.onPref?.({ leftHand: g.leftHand });
  }

  // ── 3. şahıs kamera (H) ──
  toggleThird() {
    const g = this.game;
    if (!g.thirdAllowed) { g.hud.toast($t('hud.t.thirdOff'), '#ffd27a'); return; }
    this.third = !this.third;
    g.hud.toast(this.third ? $t('hud.t.third', { a: codeLabel(this.kb.codes('leanLeft')[0]), b: codeLabel(this.kb.codes('leanRight')[0]), c: codeLabel(this.kb.codes('third')[0]) }) : $t('hud.t.first'), '#cfe6ff');
  }

  // Omuz üstü kamera: gözün arkasında ve yanında; duvara girerse yaklaşır, yere gömülmez; Q/E ile sağ-sol omuz akıcı geçer
  thirdCamera(dt, T) {
    const s = this.s, g = this.game, v = this._tv, cam = g.camera;
    const fwd = s.aimDir(v.f), right = s.right(v.r);
    // 12.163: nişanda kamera YERİNDE kalır (yalnız FOV daralır). Eskiden 2,5 → 1,375 m'ye yaklaşıp omuzdan %30 içeri kayıyordu: FOV büyütmesiyle birlikte
    // yakın nesne orantısız büyüyordu (oyuncudan 1,5 m'deki duvar ×2,79, 40 m'deki hedef ×2,05; ACOG ×2'de %36 fark, scripts/depthzoom.mjs THIRD=1)
    const pivot = s.eye(v.p); pivot.y += 0.1;
    const des = v.d.copy(pivot).addScaledVector(fwd, -2.5 * T).addScaledVector(right, this.sideT * 0.72 * T);
    des.y += 0.2 * T;
    const dir = v.e.subVectors(des, pivot), len = dir.length();
    if (len > 1e-4) {
      dir.multiplyScalar(1 / len);
      const h = g.world.raycast(pivot, dir, len + 0.2, v.hit);
      const use = h ? Math.max(0.25, h.t - 0.22) : len;
      this.camHit = h ? h.t : 0;
      des.copy(pivot).addScaledVector(dir, Math.min(len, use));
    }
    des.y = Math.max(des.y, g.world.heightAt(des.x, des.z) + 0.3);              // yere gömülme
    if (!this._cs) this._cs = des.clone(); else this._cs.lerp(des, 1 - Math.exp(-28 * dt));
    cam.position.copy(this._cs);
    s.shotOff = (s.shotOff || (s.shotOff = new THREE.Vector3())).subVectors(cam.position, s.eye(v.q));
    // kamera duvar dibinde göze yapışırsa kendi kafan görüşü kapatmasın: gövdeyi gizle, 1. şahıs silahını göster (histerezis)
    this.bodyVisible = T > 0.3 && s.shotOff.length() > (this.bodyVisible ? 0.65 : 0.85);
  }

  // ── T tekerleği: silahın uygun nişangâhları (ileride silah özelleştirmeleri de buraya eklenir) ──
  openWheel() {
    const s = this.s, g = this.game;
    if (!this.locked && !g.opts.nolock) return;
    const list = this.opticList();
    if (list.length < 2) { g.hud.toast($t('hud.t.noOptic', { w: wName(s.item.id) }), '#cfd3d8'); return; }
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:25;pointer-events:none;font-family:Bahnschrift,Rajdhani,Arial Narrow,sans-serif;color:#e8edf5;background:radial-gradient(circle at 50% 50%,rgba(4,6,10,.15),rgba(4,6,10,.62))';
    const R = 150, n = list.length;
    const opts = list.map((id, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, d = document.createElement('div');
      d.style.cssText = `position:absolute;left:calc(50% + ${Math.cos(a) * R}px);top:calc(50% + ${Math.sin(a) * R}px);transform:translate(-50%,-50%);min-width:130px;padding:10px 14px;text-align:center;background:rgba(9,13,19,.78);border:2px solid rgba(255,255,255,.2);letter-spacing:2px;text-transform:uppercase;transition:.08s`;
      d.innerHTML = `<div style="width:30px;height:30px;margin:0 auto 4px;background:#05070a;border-radius:50%">${opticSvg(id)}</div><div style="font-size:18px;font-weight:700">${opticName(id)}</div><div style="font-size:11px;opacity:.65;margin-top:3px">${OPTICS[id].zoom ? $t('hud.zoom', { n: +this.zoomOf(OPTICS[id].zoom, OPTICS[id]).toFixed(2) }) : ''}</div>`;
      el.appendChild(d);
      return { id, a, d };
    });
    const head = document.createElement('div');
    head.style.cssText = 'position:absolute;left:50%;top:calc(50% - 14px);transform:translateX(-50%);font-size:13px;letter-spacing:4px;opacity:.8;text-align:center';
    head.innerHTML = `${$t('hud.wheel')}<div style="font-size:11px;opacity:.7;letter-spacing:1px;margin-top:4px">${$t('hud.wheelHint', { w: wName(s.item.id) })}</div>`;
    const cur = document.createElement('div');
    cur.style.cssText = 'position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#ff8a1f;box-shadow:0 0 12px #ff8a1f';
    el.append(head, cur);
    document.body.appendChild(el);
    this.wheel = { el, opts, cur, x: 0, y: 0, hover: null };
    this.fireHeld = false;
    this.wheelPaint();
  }

  wheelMove(dx, dy) {
    const w = this.wheel; if (!w) return;
    w.x += dx; w.y += dy;
    const l = Math.hypot(w.x, w.y), max = 210;
    if (l > max) { w.x *= max / l; w.y *= max / l; }
    w.cur.style.transform = `translate(${w.x}px,${w.y}px)`;
    // imleç merkezden yeterince uzaksa açıya göre en yakın seçenek
    w.hover = null;
    if (Math.hypot(w.x, w.y) > 55) {
      const ang = Math.atan2(w.y, w.x);
      let best = Infinity;
      for (const o of w.opts) { const d = Math.abs(((ang - o.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (d < best) { best = d; w.hover = o; } }
    }
    this.wheelPaint();
  }

  wheelPaint() {
    const w = this.wheel; if (!w) return;
    const now = this.s.opticId;
    for (const o of w.opts) {
      const on = o === w.hover, cur = o.id === now;
      o.d.style.borderColor = on ? '#ff8a1f' : cur ? '#7be07a' : 'rgba(255,255,255,.2)';
      o.d.style.background = on ? 'rgba(80,42,8,.88)' : 'rgba(9,13,19,.78)';
      o.d.style.transform = `translate(-50%,-50%) scale(${on ? 1.08 : 1})`;
    }
  }

  wheelPick() {
    const w = this.wheel; if (!w || !w.hover) return;
    this.pickOptic(w.hover.id);
    this.wheelPaint();
  }
  // Elimdeki silahın seçilebilir nişangâhları (T tekerleği ve dokunmatik nişangâh seçicisi ortak)
  opticList() { return (OPTIC_ALLOWED[this.s.item.id] || []).filter((id) => OPTICS[id]); }
  // Nişangâhı seç: yerelde hemen, çevrimiçinde sunucuya da (room.opt → setOptic). Dönen: nişangâh tanımı ya da null
  pickOptic(id) {
    const o = this.s.alive ? this.s.setOptic(id) : null;
    if (o) { this.game.online?.send({ t: 'opt', optic: id }); this.game.hud.toast($t('hud.t.optic', { o: opticName(id) }), '#cfe6ff'); this.saveEraOptic(); }
    return o;
  }
  // 12.174: seçilen nişangâh kalıcı (silah başına; menü → Cephanelik ile aynı kayıt, frontOptics — 12.190'dan beri modern silahlar da)
  saveEraOptic() {
    const s = this.s, g = this.game;
    g.opts.frontOptics = { ...(g.opts.frontOptics || {}), ...s.optics };
    g.opts.onPref?.({ frontOptics: g.opts.frontOptics });
  }

  closeWheel() {
    if (!this.wheel) return;
    this.wheel.el.remove();
    this.wheel = null;
  }

  // Etkin nişan büyütmesi: dokunmatikte dürbünsüz nişangâhlar (demir / red dot / holo, ≤ 2×) daha çok yakınlaştırır (küçük ekranda hedef seçilsin):
  // demir 1,15 → 1,30×, red dot / holo 1,3 → 1,60× (önce ×1,6: 1,24 / 1,48); dürbünler (4×, 6×) aynı
  // 12.163: nişangâhın kendi dokunmatik büyütmesi varsa (ACOG ×1,5 → ×1,85; genel kural onu ×2'ye çıkarıp red dot ×1,6'ya çok yaklaştırırdı) o kullanılır
  zoomOf(z, o) { return !this.touch ? z : o?.touchZoom && z === o.zoom ? o.touchZoom : z > 1 && z < 2 ? 1 + (z - 1) * 2 : z; }
  // 12.190 değişken büyütme (PUBG 6× = 3–6×, 8× = 4–8×): nişandayken fare tekerleği 1× adımla değiştirir (nişangâh başına hatırlanır), görüntü ~0,12 sn'de yumuşak geçer
  zoomEff() { const s = this.s, o = s.stat.ball ? null : s.opticDef; return o?.zoomMin && this._vzS ? this._vzS : this.zoomOf(s.zoomNow || 0, o); }
  varZoomStep(dir) {
    const s = this.s, o = s.opticDef, id = s.opticId;
    if (!o?.zoomMin || !s.ads || s.adsT < 0.5) return false;
    const cur = (this.vz ||= {})[id] ?? o.zoom, nx = clamp(cur + (dir > 0 ? -1 : 1), o.zoomMin, o.zoom);
    if (nx !== cur) { this.vz[id] = nx; this.game.hud.toast($t('hud.zoom', { n: nx }), '#cfe6ff'); }
    return true;
  }
  // o anki görüş büyütmesi (model ile aynı eğri, 1 = yok): FOV, fare / ok tuşu / dokunmatik hassasiyeti bunu kullanır
  zoomCur() {
    const s = this.s;
    if (s.veh && vehSeatArmed(s.veh.def, s.seat)) { const Z = this._vehZ || 0, b = this._vehZ0 || 1; return Z ? lerp(b, Z, adsEase(this._vehK || 0)) : b; }      // 12.201 araç koltuğu: aracın yakınlaştırması (piyade optiği yok)
    const z = this.zoomEff(); return z > 1 && !this.vm.model?.userData.noAds ? lerp(1, z, adsEase(s.adsT)) : 1;
  }
  // 12.201 araç koltuğunda sağ tık yakınlaştırması (Battlefield): tank sürücüsü dürbün ×2,6 (temel ×1,15) / takip ×1,6, helikopter pilotu ×1,5 (burun artısı),
  // makineli koltukları ×1,4; ~0,14 sn'de yumuşak. Bin / in / koltuk değişince sıfırlanır. Kendi silahıyla ateş eden yolcuda piyade optiği (adsT) aynen.
  vehZoom(dt) {
    const s = this.s, v = s.alive ? s.veh : null, key = v ? v.idx * 8 + s.seat : -1;
    if (key !== this._vehKey) {                                         // bin / in / koltuk: nişan + yakınlaştırma temiz (aç-kapa nişan da kapanır)
      this._vehKey = key; this._vehK = 0; s.ads = false; s.adsT = 0; this._zTail = null; this.mmb = false; s.vw = 0;      // 12.206 silah: burun topu
      this.touch?.b?.ads?.classList.remove('on'); if (this.touch) this.touch.rk = false;
    }
    const armed = !!(v && vehSeatArmed(v.def, s.seat)), first = this.vehCam === 'first', tk = !!(v && s.seat === 0 && v.def.cannon);
    this._vehZ = armed ? seatZoom(v.def, s.seat, first) : 0;
    this._vehZ0 = tk && first ? 1.15 : 1;
    this._vehK = clamp((this._vehK || 0) + (this._vehZ && s.ads ? 1 : -1) * dt * 7, 0, 1);
  }
  // 12.206 helikopter pilotunun silahı (Battlefield saldırı helikopteri): s.vw 0 = burun topu, 1 = roket kapsülü; sol tık seçili silahı ateşler.
  // Değiştirme: Q (vehAlt) / fare tekerleği / telefonda SİLAH düğmesi. Bin / in / koltuk değişince burun topuna döner (vehZoom). Çevrim içinde girdi 'vw'.
  pilotArmed() { const s = this.s, v = s.alive ? s.veh : null; return !!(v && s.seat === 0 && v.def.rockets && v.def.nose); }
  vehWeapon(to) {
    const s = this.s; if (!this.pilotArmed()) return;
    const n = to ?? (s.vw ? 0 : 1); if (n === (s.vw || 0)) return;
    s.vw = n; this.game.sfx._tone?.({ gain: 0.06, dur: 0.05, f0: n ? 900 : 1300, f1: n ? 700 : 1100, type: 'square', att: 0.001 });
    this.game.emit('vehweapon', s);
  }
  // Dikey FOV (derece): masaüstünde ayar doğrudan dikey FOV; dokunmatikte ayar YATAY FOV'dur (2,2:1 telefonda dikey 75° → yatay 118°, düşman küçücük kalıyordu)
  baseFov() { const f = this.set.fov; if (!this.touch) return f; const a = this.game.camera.aspect || 16 / 9; return (2 * Math.atan(Math.tan((f * Math.PI) / 360) / a) * 180) / Math.PI; }

  look(dx, dy) {
    const s = this.s, y0 = s.yaw;
    s.yaw -= dx;
    s.pitch = clamp(s.pitch - dy, -1.5, 1.5);
    proneClamp(s, true, y0);                                     // 12.199 yüzüstü: bakış gövdeye göre ±50° (taşan kısım gövdeyi sonraki adımlarda döndürür)
  }

  // 12.177 araçtaki girdi: sürücü → gaz / direksiyon / fren (Boşluk) / korna (sol tık) aracı bir adım sürer (çevrimdışı yetkili, çevrim içi tahmin);
  // yolcu → yalnız silah (ateş, şarjör). Bakış araçla döner (aracın yaw değişimi bakışa eklenir: kamera araca göre aynı yöne bakmaya devam eder).
  vehInput(dt, k, kb, T) {
    const s = this.s, g = this.game, V = g.vehicles, v = s.veh;
    if (!v || !v.st) return;
    const yw = v.st.yaw, stab = !!(v.def.turret || v.def.heli);             // 12.179 helikopter: burun bakışı izler (gövde dönüşü bakışa eklenirse geri besleme olur)                         // 12.178 tank: bakış dünyada sabit (kule dengeli), gövde dönüşü bakışı döndürmez
    if (!stab && this._vveh === v && this._vyaw !== undefined) s.yaw += ((yw - this._vyaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this._vyaw = yw; this._vveh = v;
    const drv = s.seat === 0;
    const f = drv ? (kb.held('forward', k) ? 1 : 0) - (kb.held('back', k) ? 1 : 0) || (T ? T.f : 0) : 0;
    const r = drv ? (kb.held('right', k) ? 1 : 0) - (kb.held('left', k) ? 1 : 0) || (T ? T.r : 0) : 0;
    const brake = drv && (kb.held('jump', k) || !!(T && T.jump)), dn = drv && !!v.def.heli && (kb.held('crouch', k) || !!(T && T.down));      // helikopter: Boşluk yüksel, C / Ctrl alçal
    const inp = { f, r, lean: 0, sprint: false, jump: brake, dn };
    if (drv && v.def.turret) {                                           // 12.188 tank: top artının gösterdiği noktaya (kamera ışını) balistik hedeflenir
      const cam = g.camera.position, pc = this.vehCam === 'first' ? Math.max(-0.5, Math.min(0.6, s.pitch)) : Math.max(-0.75, Math.min(0.55, s.pitch));
      s.gunAim = V.gunAimFor(v, cam, dirFromAngles(s.yaw, pc), s, (s._ga ||= {}));
    } else if (drv && v.def.nose) {                                     // 12.201 helikopter: burun (yaw + eğim) ve burun topu artının noktasına (Battlefield: mermi artıya gider)
      const cam = g.camera.position, pc = this.vehCam === 'first' ? Math.max(-1.2, Math.min(1.0, s.pitch)) : Math.max(-0.75, Math.min(0.55, s.pitch)) - 0.16;      // vehCamera ile aynı bakış
      s.gunAim = V.noseAimFor(v, cam, dirFromAngles(s.yaw, pc), s, (s._ga ||= {}));
    } else s.gunAim = null;
    if (!(drv && v.def.rockets)) s.vw = 0;
    s.rkHeld = !!(drv && v.def.rockets && this.locked && s.vw === 1 && this.fireHeld);      // 12.206 roket: seçili silah roketken sol tık (telefonda ATEŞ); Q / tekerlek / SİLAH değiştirir
    if (drv) {
      v.horn = !!v.def.horn && this.fireHeld && this.locked;             // 12.188: korna yalnız jipte (helikopterde sol tık = burun topu)
      V.drive(v, { f, r, b: brake, u: brake, d: dn, yw: s.gunAim ? s.gunAim.y : s.yaw, pt: s.gunAim ? s.gunAim.p : s.pitch }, dt);
      if (v.def.cannon && this.fireHeld && this.locked && !g.online) V.fireCannon(v, s);      // çevrimdışı: ana top (çevrim içinde sunucu ateşler, 'ts' olayı)
      if (s.rkHeld && !g.online) V.fireRocket(v, s);                                       // 12.188 helikopter roketleri (12.201: Q / orta tık; çevrim içinde sunucu, girdi 'rk')
      V.place(s);
      if (!g.online) for (const o of v.seats) if (o && o !== s) V.place(o);
      this._vyaw = v.st.yaw;
    } else V.place(s);
    if (g.online) { g.online.pushInput(inp, s, this.fireHeld); if (drv) g.online.markVeh(v); }
    if (seatGun(v.def, s.seat)) V.mgFire(s, this.fireHeld && this.locked && !(drv && s.vw === 1), dt);      // 12.206 pilotta roket seçiliyken burun topu ateşlenmez (soğur)      // tank / jip / kapı nişancısı + 12.188 helikopter pilotunun burun topu (çevrim içinde iz / ses tahmini, hasar sunucuda)
    else if (!drv && this.locked) {
      const st = s.stat;
      if (st.kind === 'melee') { if (s.meleeInput(this.fireHeld, this.fireBuf)) this.meleeStarted(s); }
      else if (s.triggerUpdate(this.fireHeld, this.fireBuf)) this.fireBuf = 0;
    }
    if (g.online) g.online.markAmmo(s);
  }

  // 12.193 Hızlı atış: G (masaüstü) / bomba düğmesi (dokunmatik). Bomba çekilir, çekiliş biter bitmez hazırlanır (yörünge), tuş bırakılınca atılır
  // (kısa dokunuş = hemen at). Dokunmatikte iptal alanında bırakılırsa atılmaz (pim çekilmediyse bomba cebe döner).
  quickNade(down) {
    const s = this.s;
    if (!down) { if (this.qNade) this.qNade.held = false; return; }
    const ni = s.items.findIndex((it) => WSTATS[it.id]?.kind === 'throwable');
    if (ni < 0 || !s.canEquip(ni) || s.veh || !s.alive) return;
    this.qNade = { held: true, t: 0, ni, cooked: false, back: s.cur !== ni ? s.cur : -1 };
    if (s.cur !== ni) s.switchTo(ni);
  }
  cancelNade() {
    const s = this.s, q = this.qNade;
    this.qNade = null; this.fireHeld = false;
    if (!s.cook || s.cook.lit) return false;                                   // pimi çekildiyse iptal yok (bırakınca atılır)
    const b = q && q.back >= 0 ? q.back : s.backTo >= 0 ? s.backTo : 0;
    if (s.canEquip(b) && b !== s.cur) s.switchTo(b); else s.cook = null;
    return true;
  }
  // her adım: hızlı atışın etkin tetiği. held: basılı sayılır, buf: yeni basış tamponu
  nadeTick(dt) {
    const s = this.s, q = this.qNade, R = (this._qn ||= { held: false, buf: 0 });
    R.held = false; R.buf = 0;
    if (!q) return R;
    q.t += dt;
    if (!s.alive || s.veh || q.t > 3 || (s.items[q.ni]?.mag <= 0 && !s.cook)) { this.qNade = null; return R; }
    if (s.cur !== q.ni) { if (q.cooked || !s.canEquip(q.ni)) this.qNade = null; return R; }      // çekiliyor ya da başka silaha geçildi
    if (s.cook) { q.cooked = true; R.held = q.held; return R; }
    if (q.cooked) { this.qNade = null; return R; }                             // atıldı
    R.held = true;
    if (s.switchT <= 0 && s.cd <= 0) R.buf = 0.15;
    return R;
  }

  dispose() { this.closeWheel(); for (const [t, ev, fn, opt] of this._bound) t.removeEventListener(ev, fn, opt); this._bound = []; this.fx?.remove(); this.fxSmoke?.remove(); this.touch?.dispose(); }

  // 12.180 suya giriş / çıkış: giriş anında elde ateş edilemeyen silah varsa yan silaha geçilir (çıkınca eskisine döner); nişan kapanır; yüzeye çıkış nefesi
  // 12.194 yakın dövüş başladı: ateş tamponu söner; aç-kapa nişan ayarında sağ tık ağır vuruşu tek seferliktir (nişan bayrağı açık kalıp sürekli saplamasın)
  meleeStarted(s) {
    this.fireBuf = 0;
    if (s.swing?.hv && this.game.opts.adsToggle) s.ads = false;
  }

  swimEdge(s) {
    this._swimWas = s.swim;
    if (s.swim) {
      s.ads = false;
      const sec = s.items.findIndex((it) => WSTATS[it.id]?.slot === 'secondary' && WSTATS[it.id]?.kind === 'gun');
      if (s.stat.slot !== 'secondary' && sec >= 0 && s.canEquip(sec)) { this._preSwim = s.cur; s.switchTo(sec); }
      this.game.hud.swimHint?.();
    } else if (this._preSwim != null) { if (s.alive && s.canEquip(this._preSwim)) s.switchTo(this._preSwim); this._preSwim = null; }
  }

  update(dt) {
    const s = this.s, g = this.game;
    this.fireBuf = Math.max(0, this.fireBuf - dt);
    if (this.touch && !g.opts.autoplay) this.touch.assist(dt);                      // dokunmatik nişan yardımı (masaüstünde yok)
    if (s.alive && this.locked && !g.opts.autoplay) {
      const kk = this.keys, sp = 1.9 * dt / Math.pow(this.zoomCur(), 0.7);
      if (kk.has('ArrowLeft')) s.yaw += sp;
      if (kk.has('ArrowRight')) s.yaw -= sp;
      if (kk.has('ArrowUp')) s.pitch = clamp(s.pitch + sp, -1.5, 1.5);
      if (kk.has('ArrowDown')) s.pitch = clamp(s.pitch - sp, -1.5, 1.5);
    }
    if (!s.alive) this.breath.reset();
    this.vehZoom(dt);
    if (s.alive && !g.opts.autoplay) {
      const k = this.keys;
      const kb = this.kb, T = this.touch;
      if (s.veh) this.vehInput(dt, k, kb, T); else {
      // 12.156: dürbün sallanması bakışa (yaw / pitch) "sanal fare" olarak eklenir → kamera, retikül, mermi ve sunucuya giden yaw / pitch aynı
      const bw = this.breath.step(dt, s, this.locked && (kb.held('holdBreath', k) || !!T?.breath));
      if (bw[0] || bw[1]) { s.yaw += bw[0]; s.pitch = clamp(s.pitch + bw[1], -1.5, 1.5); }
      const f = (kb.held('forward', k) ? 1 : 0) - (kb.held('back', k) ? 1 : 0) || (T ? T.f : 0);
      // koşu ↔ nişan (12.145): nişan isteği koşuyu o karede keser (applyInput: s.ads → koşu yok), bırakınca koşu tuşu basılıysa koşuya dönülür.
      // Aç-kapa nişanda koşu tuşuna ileri giderken YENİDEN basmak nişanı kapatıp koşturur (basılı tutulan Shift nişanı kapatmaz; eski: koşu sürdükçe nişan hiç açılmıyordu). Silah değişimi nişanı kapatır.
      const sprintReq = kb.held('sprint', k) && f > 0;
      const brK = s.overlay === 'scope' && s.ads && kb.held('holdBreath', k);          // 12.156: dürbünde koşu tuşu = nefes tut (aç-kapa nişanda dürbünden çıkarmasın)
      if (g.opts.adsToggle && ((sprintReq && !this._sprintReq && !brK) || s.cur !== this._adsCur)) s.ads = false;
      this._sprintReq = sprintReq; this._adsCur = s.cur;
      const r = (kb.held('right', k) ? 1 : 0) - (kb.held('left', k) ? 1 : 0) || (T ? T.r : 0);
      const st = s.stat;
      const lean = (kb.held('leanRight', k) && !this.vehLatch ? 1 : 0) - (kb.held('leanLeft', k) ? 1 : 0);                 // 3. şahısta da Q/E yatar (ve omuzu değiştirir) · 12.177: araca binme / inme E'si basılıyken eğilmez
      const inp = { f, r, lean, sprint: kb.held('sprint', k) || !!(T && T.sprint), jump: (kb.held('jump', k) && !this.spaceLatch) || !!(T && T.jump), dive: kb.held('crouch', k) || !!(T && T.dive) };      // 12.180 dive: çömel BASILI (yüzerken dal)
      if (s.swim !== !!this._swimWas) this.swimEdge(s);
      proneLook(s, dt, { pend: true });                                                // 12.199 yüzüstü: gövde ≤ 90°/sn döner, bakış sınırda (sunucu humanTick aynı sıra)
      if (s.fly) this.flyMove(f, r, k, dt); else applyInput(s, inp, dt);
      // 12.193 bomba: hızlı atış (G / dokunmatik bomba düğmesi) = çek + hazırla + bırakınca at; R (pişir) ve sağ tık (atış şekli) girdinin adımında (sunucu: humanTick aynı sıra)
      const qn = this.nadeTick(dt);
      const fHeld = this.fireHeld || qn.held, fBuf = Math.max(this.fireBuf, qn.buf);
      if (qn.buf > 0) g.online?.edge('fp');
      if (g.online) g.online.pushInput(inp, s, fHeld);
      if (!kb.held('jump', k)) this.spaceLatch = false;

      // ateş
      if (this.cookReq) { this.cookReq = false; if (s.stat.kind === 'throwable') s.startReload(); }
      if (this.nadeModeReq) { this.nadeModeReq = false; s.toggleNadeMode(); }
      if (this.locked || qn.held || qn.buf) {
        if (st.kind === 'melee') { if (s.meleeInput(this.fireHeld, this.fireBuf)) this.meleeStarted(s); }
        else if (s.triggerUpdate(fHeld, fBuf)) this.fireBuf = 0;
      } else if (s.cook) { this.fireHeld = false; s.triggerUpdate(false, 0); }                                    // kilit gitti (Esc): pişirilen bomba bırakılır (sunucu da tetiği bırakılmış görür)
      if (g.online) g.online.markAmmo(s);                                              // bu girdinin sonundaki cephane (sunucunun ack anındakiyle karşılaştırılır, 12.138)
      // 12.180 yüzme kulacı sesi
      if (s.swim) { const hv = Math.hypot(s.vel.x, s.vel.z, s.vel.y); if (hv > 0.6 && (this._strokeT = (this._strokeT || 0) - dt) <= 0) { this._strokeT = 0.85; g.sfx.stroke?.(null); } }
      // adım sesi
      const sp = Math.hypot(s.vel.x, s.vel.z);
      if (s.onGround && sp > 1.5 && !s.crouching && !s.prone) {
        s.stepT -= dt * (sp / TUNE.walkSpeed) * (g.abfx?.stepMul || 1);             // atılış / öfke: adım temposu hızlanır
        if (s.stepT <= 0) { s.stepT = 0.42; g.sfx.step(null); }
      }
      }
    }

    // ── kamera ──
    const cam = g.camera;
    g.abfx?.update(dt);                                                                // zombi gücü ekran efektleri (FOV vuruşu / adım temposu buradan)
    const baseFov = this.baseFov();
    // 12.127: nişan büyütmesi DOĞRUDAN modelle aynı eğriden yazılır (eski ikinci üstel gecikme dünyayı silahın ~100 ms arkasında bırakıyordu: dürbün çıkışında ×4,6 dünyada 3B gövde); yalnız güç FOV vuruşu yumuşatılır
    this._fovAdd = (this._fovAdd || 0) + ((g.abfx?.fovAdd || 0) - (this._fovAdd || 0)) * Math.min(1, dt * 18);
    // 12.154: silah / nişangâh nişandayken değişince (adsT Soldier'da sıfırlanır) dünya kamerası eski büyütmeyi o silahın çıkış eğrisiyle söndürür → tek karede sıçrama yok
    const od = s.opticDef, vzT = od?.zoomMin && !s.stat.ball ? (this.vz?.[s.opticId] ?? od.zoom) : 0;      // 12.190 değişken büyütme hedefi
    this._vzS = !vzT ? 0 : !this._vzS || this._vzK !== s.opticId ? vzT : this._vzS + (vzT - this._vzS) * Math.min(1, dt * 14); this._vzK = s.opticId;
    const aimKey = s.item.id + '|' + s.opticId;
    if (aimKey !== this._aimKey) { if (this._aimKey !== undefined && this._aimAds > 0 && this._aimZ > 1) this._zTail = { z: this._aimZ, t: this._aimAds, r: this._aimRate }; this._aimKey = aimKey; }
    let zc = this.zoomCur();      // 12.162: tüm optiklerde dünya kamerası tam ekran büyür (ACOG da; eski PiP'te mercek dışı ×1,15)
    if (this._zTail) { const q = this._zTail; q.t = Math.max(0, q.t - dt * q.r); zc = Math.max(zc, lerp(1, q.z, adsEase(q.t))); if (q.t <= 0) this._zTail = null; }
    this._aimAds = s.adsT; this._aimZ = this.vm.model?.userData.noAds ? 1 : this.zoomEff(); this._aimRate = s.adsRate;      // Soldier'daki adsT hızıyla aynı (12.153 adsTime)
    cam.fov = zoomFov(baseFov, zc) + this._fovAdd;
    cam.updateProjectionMatrix();
    const sh = g.effects.shake;
    // 3. şahıs geçişi: dürbünle / 2×+ mercekle nişan alırken otomatik 1. şahsa döner
    const wantThird = this.third && s.alive && !((s.overlay === 'scope' || (s.overlay === 'lens' && (s.opticDef?.zoom || 1) >= 2)) && s.adsT > 0.35) ? 1 : 0;      // 12.190: büyüten mercekte de (PUBG: nişan = birinci şahıs)
    this.thirdT += Math.sign(wantThird - this.thirdT) * Math.min(Math.abs(wantThird - this.thirdT), dt * 4.5);
    this.sideT += (this.side - this.sideT) * (1 - Math.exp(-9 * dt));
    s.stanceLeft = this.third && this.thirdT > 0.3 && this.side < 0;          // karakter modeli sol omuz duruşuna geçsin (aynalı)
    if (s.alive && s.veh && vehCamera(this, dt)) { this.deathCamT = 0; this.camPos.copy(cam.position); }      // 12.177 araç kamerası (sürücü: içeriden / takip; yolcu takipte)
    else if (s.alive) {
      this.deathCamT = 0;
      if (this._vcam) { this._vcam = null; this.bodyVisible = false; }
      s.eye(cam.position);
      cam.rotation.order = 'YXZ';
      cam.rotation.set(
        s.pitch + s.recoilP + (Math.random() - 0.5) * sh * 0.06 + this.vm.camPitch + this.vm.punch * (1 - this.thirdT),      // 12.141: tabanca görüş tepmesi (görsel)
        s.yaw + (Math.random() - 0.5) * sh * 0.06,
        -s.leanK * LEAN_ROLL * (1 - 0.6 * this.thirdT) + this.vm.camRoll + this.vm.punchR * (1 - this.thirdT) + (Math.random() - 0.5) * sh * 0.03,
      );
      if (this.thirdT > 0.002) this.thirdCamera(dt, this.thirdT); else { this._cs = null; s.shotOff = null; this.bodyVisible = false; }
      const vo = g.online && g.online.viewOff;                      // çevrimiçi: tahmin düzeltmesi kamerada yumuşatılır (bkz. NetClient.reconcile)
      if (vo) { const k = Math.exp(-dt * 11); vo.x *= k; vo.y *= k; vo.z *= k; cam.position.x += vo.x; cam.position.y += vo.y; cam.position.z += vo.z; }
      // 12.180: kenara tutunup çıkışta göz yumuşak yükselir (tek karede 1,5 m sıçrama yok) + yüzeyde yüzerken hafif dalga salınımı
      if (s.climbUp > 0) { this._climbOff = Math.max(-2.6, (this._climbOff || 0) - s.climbUp); s.climbUp = 0; }
      if (this._climbOff) { this._climbOff *= Math.exp(-dt * 7); if (this._climbOff > -0.005) this._climbOff = 0; cam.position.y += this._climbOff; }
      this._bobK = lerp(this._bobK || 0, s.swim && !s.under ? 1 : 0, Math.min(1, dt * 4));
      if (this._bobK > 0.01) cam.position.y += Math.sin(g.time * 1.7) * 0.03 * this._bobK;
      this.camPos.copy(cam.position);
    } else {
      s.shotOff = null; this._cs = null; this.bodyVisible = false;
      this.deathCamT += dt;
      const t = Math.min(1, this.deathCamT * 2.5);
      cam.position.set(this.camPos.x, Math.max(0.35, this.camPos.y - t * 1.1), this.camPos.z);
      const killer = s.lastHit && s.lastHit !== s ? s.lastHit : null;
      if (killer) {
        const dx = killer.pos.x - cam.position.x, dz = killer.pos.z - cam.position.z;
        const ty = Math.atan2(-dx, -dz);
        s.yaw += clamp(((ty - s.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -2 * dt, 2 * dt);
      }
      cam.rotation.set(Math.max(-0.2, s.pitch * (1 - t) - t * 0.15), s.yaw, t * 0.5);
    }
    g.sfx.setListener(cam);
    // ekran örtüleri
    const bl = s.alive && s.blindT > 0 ? Math.min(1, s.blindT / (Math.max(0.5, s.blindMax) * 0.5)) : 0;
    this.fx.style.opacity = bl.toFixed(2);
    const sd = s.alive ? (g.smokeDensity?.(cam.position) || 0) : 0;
    this.fxSmoke.style.opacity = (sd * 0.92).toFixed(2);
    this.vm.update(dt, this);
    this.lookDX *= 0.5; this.lookDY *= 0.5;
  }
}
