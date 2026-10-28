// 12.157 Uzay modu: istemci tarafı görsel / ses kancaları (kural / fizik değil: yer çekimi World.grav, düşme kuralı sim/fall.js, donanım stats.js SPACE_CLASS).
//   spaceSetup(game)     maç başında: parçacıklar düşük yer çekimiyle, kask içi hafif boğuk ses
//   spaceFire(vm, s, g)  birinci şahısta atış: namlu alevi silahın enerji renginde, enerji parçası kısa parlar; ray tüfeğinde şarj sıfırlanır + şarj sesi; makinelide ısı artar
//   spaceVm(vm, s, dt)   her kare: ışıma gücü (uEnK) — ray tüfeği atıştan sonra 0,15'ten yeniden dolar, makineli seride kızarır (renk beyaz-turuncuya kayar), diğerlerinde atış parlaması söner
//   spaceTp(s, dt)       12.160 her kare (3. şahıs model): ray tüfeği şarjı başkalarında da görünür (s.railT: _fire / ağ 'sh' olayı sıfırlar; yeni ağ alanı yok)
import * as THREE from 'three';
import { WSTATS } from './stats.js';
import { STD, skinMaterial, setSkin } from '../models/skins.js';
import { setHelmet, railCharge, railReady } from './spaceSfx.js';

export function spaceSetup(g) {
  if (g.headless || !g.mode.space) return;
  if (g.effects) g.effects.gravMul = Math.sqrt(g.world.grav);                 // parçacıklar: yavaş ama havada asılı kalmayacak kadar (0,6×; isabet parçaları ekranı doldurmasın)
  setHelmet(g.sfx, true);
}

const HOT = new THREE.Color('#fff0c8');
const matOf = (vm) => {
  if (vm._enFor === vm.model) return vm._enMat;
  let m = null;
  vm.model?.traverse((o) => { if (!m && o.material?.userData?.U?.uEnK) m = o.material; });
  if (m) { const ud = m.userData; ud.en0 ||= ud.U.uEn.value.clone(); ud.U.uEn.value.copy(ud.en0); ud.U.uEnK.value = 1; }      // 12.210: model önbellekten geri gelebilir → özgün enerji rengi malzemede saklı (ısınmış renk taban sanılmasın)
  vm._enFor = vm.model; vm._enMat = m; vm._en0 = m ? m.userData.en0 : null; vm.heat = 0; vm.charge = 1; vm.pulse = 0;
  return m;
};

export function spaceFire(vm, s, g) {
  const st = s.stat; if (!st.space) return;
  const m = matOf(vm); if (!m) return;
  vm.pulse = 1;
  if (st.heat) vm.heat = Math.min(1, (vm.heat || 0) + 0.04);
  if (s.item.id === 'railgun') { vm.charge = 0; railCharge(g.sfx, 60 / st.rpm); }
  const fm = vm.flash?.userData?.mat, en = STD[s.item.id]?.en;
  if (fm && en) fm.color.set(en).lerp(HOT, 0.35);
}

export function spaceVm(vm, s, dt) {
  const st = s.stat; if (!st?.space) return;
  const m = matOf(vm); if (!m) return;
  const U = m.userData.U;
  vm.pulse = Math.max(0, (vm.pulse || 0) - dt * 9);
  let k = 1 + 0.6 * vm.pulse;
  if (s.item.id === 'railgun') { vm.charge = Math.min(1, (vm.charge ?? 1) + dt / (60 / st.rpm)); k = 0.15 + 0.85 * vm.charge * vm.charge + 0.5 * vm.pulse; }
  if (st.heat) {
    vm.heat = Math.max(0, (vm.heat || 0) - dt * 0.3);
    k = 0.4 + 2.2 * vm.heat + 0.3 * vm.pulse;                                     // soğukken sönük kızıl, uzun seride beyaz-sarı kor
    U.uEn.value.copy(vm._en0).lerp(HOT, 0.9 * Math.pow(vm.heat, 1.5));
  }
  U.uEnK.value = k;
}

// 12.160: 3. şahıs ray tüfeği şarjı (uzak oyuncu, bot, 3. şahısta kendin). Aynı eğri biçimi (karesel; 3. şahısta 0 → 1, atış parlaması), dolunca 0,3 sn "hazır" parıltısı.
// 3. şahıs silahı (silah, kaplama) başına PAYLAŞILAN malzemededir → ilk atışta bu askerin silah ağlarına kendi kopyası takılır (skinMaterial paylaşımsız):
// customProgramCacheKey + parametreler aynı → three.js mevcut programı yeniden kullanır (derleme yok, renderer.info.programs sabit); sonra yalnız uEnK uniform'u değişir.
const RAIL_T = 60 / WSTATS.railgun.rpm, FLARE = 0.3;
export function spaceTp(s, dt) {
  const w = s.model?.weapon;
  if (s.railT === undefined || !w || w.userData.id !== 'railgun') return;      // hiç ateş etmedi: paylaşılan malzeme tam parlak (uEnK 1)
  if (w.userData.railMat !== s._railMat || !s._railMat) {                      // silah modeli yeniden kuruldu (silah değişimi / doğuş) → kopyayı yeniden tak
    const sk = w.userData.skin || 'std';
    if (!s._railMat) s._railMat = skinMaterial('railgun', sk, false); else if (s._railMat.userData.skin !== sk) setSkin(s._railMat, sk);
    w.traverse((o) => { if (o.material?.userData?.skinMat && o.material.userData.weapon === 'railgun') o.material = s._railMat; });
    w.userData.railMat = s._railMat;
  }
  const t0 = s.railT; s.railT += dt;
  const c = Math.min(1, s.railT / RAIL_T), pulse = Math.max(0, 1 - s.railT * 9), fl = s.railT >= RAIL_T ? Math.max(0, 1 - (s.railT - RAIL_T) / FLARE) : 0;
  s._railMat.userData.U.uEnK.value = c * c + 0.5 * pulse + 0.9 * fl;      // 1. şahıstaki eğri (karesel) ama 0'dan: küçük / uzak modelde sönük hâl okunsun (0,15'te ton eşleme farkı siliyordu)
  if (t0 < RAIL_T && s.railT >= RAIL_T && !s.isPlayer && s.alive) {             // "hazır" tıkı: yalnız yakında (≤ 15 m), çok kısık, konumlu (kendi silahının sesi birinci şahıs railCharge'da)
    const g = s.game, cam = g.camera?.position;
    if (cam && cam.distanceTo(s.pos) <= 15) railReady(g.sfx, s.pos);
  }
}
void WSTATS;
