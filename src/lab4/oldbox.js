import * as THREE from 'three';
import { box } from '../core/geo.js';
import { TEAMS } from '../core/palette.js';
import { CurrentHands } from './current.js';

// ESKİ kutu eller (dfdc3c0^ öncesi, a3a05c6'dan 2026-10-18'e kadar oyundaydı; 12.97'de fpHands ile değişti): karşılaştırma satırı.
// Oyunun bugünkü ViewModel'i sürülür, fpHand elleri / kolları sökülüp dfdc3c0^ player.js'teki `hand` (0,10×0,10×0,12 kutu + 0,11 kol) ve `fist` (parmak levhası +
// 4 koyu parmak çizgisi + yan / avuç levhaları + başparmak) birebir eklenir; bıçak beklemede eski MELEE_IDLE (0,09 −0,15 −0,5 · 0,5 0,35 −1,05) uygulanır.
const Z = new THREE.Vector3(0, 0, 1);
const OLD_MELEE_IDLE = { pos: [0.09, -0.15, -0.5], rx: 0.5, ry: 0.35, rz: -1.05 };
export class OldBoxHands extends CurrentHands {
  setWeapon(id, team = 'blue', optic = 'reddot') {
    super.setWeapon(id, team, optic);
    const vm = this.vm, g = vm.model, c = TEAMS[team] || TEAMS.blue, u = g.userData, kind = this.s.stat.kind;
    for (const a of vm.arms || []) { vm.cam.remove(a.mesh); a.mesh.geometry.dispose(); } vm.arms = [];
    if (vm.idleL) { vm.cam.remove(vm.idleL); vm.idleL = null; }
    for (const h of [vm.handR, vm.handL]) if (h) { h.parent?.remove(h); h.traverse((o) => o.geometry?.dispose?.()); }
    if (vm.zh) return;                                                               // zombi pençeleri: olduğu gibi
    const hand = (p, side) => {
      const grp = new THREE.Group(); grp.position.copy(p);
      box(grp, [0.1, 0.1, 0.12], c.gloves, [0, 0, 0]);
      const dir = new THREE.Vector3(side * 0.12, -0.2, 0.42).normalize(), len = 0.5;
      const sleeve = box(grp, [0.11, 0.11, len], c.shirt, [0, 0, 0]); sleeve.position.copy(dir).multiplyScalar(len / 2 + 0.05); sleeve.quaternion.setFromUnitVectors(Z, dir);
      g.add(grp); return grp;
    };
    const fist = (p, side = 1) => {
      const grp = new THREE.Group(); grp.position.copy(p);
      box(grp, [0.064, 0.016, 0.06], c.gloves, [0, 0.03, 0]);
      for (let i = 0; i < 4; i++) box(grp, [0.066, 0.006, 0.004], '#101114', [0, 0.0385, -0.022 + i * 0.015]);
      box(grp, [0.016, 0.06, 0.06], c.gloves, [0.03, 0.0, 0]); box(grp, [0.016, 0.06, 0.06], c.gloves, [-0.03, 0.0, 0]);
      box(grp, [0.064, 0.022, 0.07], c.gloves, [0, -0.032, 0.005]);
      box(grp, [0.02, 0.02, 0.05], c.gloves, [-0.02, 0.04, -0.045], [0, 0.3, 0]);
      const dir = new THREE.Vector3(0.12 * side, -0.2, 0.42).normalize(), len = 0.5;
      const sleeve = box(grp, [0.11, 0.11, len], c.shirt, [0, 0, 0]); sleeve.position.copy(dir).multiplyScalar(len / 2 + 0.05); sleeve.quaternion.setFromUnitVectors(Z, dir);
      g.add(grp); return grp;
    };
    if (kind === 'melee' && u.gripR) { g.scale.setScalar(1); vm.handR = fist(u.gripR.clone()); vm.hLfg = null; vm.handL = null; this.oldMelee = true; }
    else {
      this.oldMelee = false;
      vm.handR = u.gripR ? hand(u.gripR.clone().add(new THREE.Vector3(0, -0.02, 0)), 1) : null;
      vm.hLfg = u.gripL ? u.gripL.clone().add(new THREE.Vector3(0, -0.03, 0)) : null;
      vm.handL = (kind === 'gun' || kind === 'launcher') ? hand(vm.hLfg || new THREE.Vector3(-0.2, -0.3, 0.2), -1) : null;
      if (vm.handL && !vm.hLfg) vm.handL.visible = false;
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  }
  update(state) {
    super.update(state);
    if (this.oldMelee && state.anim === 'idle') { const M = OLD_MELEE_IDLE; this.vm.root.position.set(...M.pos); this.vm.root.rotation.set(M.rx, M.ry, M.rz); }
  }
}
