// 12.157 Uzay modu: istemci tarafı görsel / ses kancaları (kural / fizik değil: yer çekimi World.grav, düşme kuralı sim/fall.js, donanım stats.js SPACE_CLASS).
//   spaceSetup(game)     maç başında: parçacıklar düşük yer çekimiyle, kask içi hafif boğuk ses
//   spaceFire(vm, s, g)  birinci şahısta atış: namlu alevi silahın enerji renginde, enerji parçası kısa parlar; ray tüfeğinde şarj sıfırlanır + şarj sesi; makinelide ısı artar
//   spaceVm(vm, s, dt)   her kare: ışıma gücü (uEnK) — ray tüfeği atıştan sonra 0,15'ten yeniden dolar, makineli seride kızarır (renk beyaz-turuncuya kayar), diğerlerinde atış parlaması söner
import * as THREE from 'three';
import { WSTATS } from './stats.js';
import { STD } from '../models/skins.js';
import { setHelmet, railCharge } from './spaceSfx.js';

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
  vm._enFor = vm.model; vm._enMat = m; vm._en0 = m ? m.userData.U.uEn.value.clone() : null; vm.heat = 0; vm.charge = 1; vm.pulse = 0;
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
void WSTATS;
