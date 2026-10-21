import { ViewModel } from '../game/player.js';
import { WSTATS } from '../game/stats.js';

// Mevcut oyun elleri (karşılaştırma satırı): gerçek ViewModel sahte game / player ile sürülür; oyun kodu değişmez.
export class CurrentHands {
  constructor(envTex) {
    this.game = { scene: { environment: envTex }, leftHand: false, time: 0 };
    this.vm = new ViewModel(this.game);
    this.s = null;
  }
  setWeapon(id, team = 'blue', optic = 'reddot') {
    const st = WSTATS[id];
    this.s = { stat: st, vel: { x: 0, z: 0 }, onGround: true, sprinting: false, adsT: 0, ads: false, reloadT: 0, reloadTotal: 0, reloadStyle: st.reloadStyle || 'mag', reloadEmpty: true, swing: null, useT: 0, cd: 0, overlay: 'none', leanT: 0 };
    this.vm.setItem(id, team, st.kind, optic, '#86a273');
    this.vm.raise = 0; this.vm.kick = 0; this.vm.kickR = 0;
    this.vm.setFade(0);
  }
  // state: { anim, t, ads, sprint, bobT, time } → oyunun kendi animasyonlarına çevrilir
  update(state) {
    const s = this.s, vm = this.vm, st = s.stat, t = state.t ?? 0;
    this.game.time = state.time || 0;
    s.adsT = state.ads || 0; s.ads = s.adsT > 0.5; s.sprinting = (state.sprint || 0) > 0.5; s.vel.x = state.bobT ? 3 : 0;
    s.reloadT = 0; s.swing = null; vm.inspectT = 0; vm.throwT = 0; vm.boltT = 0;
    if (state.anim === 'reload' || state.anim === 'shell') { const tot = st.reload || 2; s.reloadStyle = st.reloadStyle || 'mag'; s.reloadTotal = s.reloadStyle === 'shell' ? st.shell * 4 : tot; s.reloadT = Math.max(0.001, s.reloadTotal * (1 - t)); }
    if (state.anim === 'bolt') { s.reloadStyle = 'bolt'; s.reloadTotal = st.reload || 2.2; s.reloadT = Math.max(0.001, s.reloadTotal * (1 - (0.55 + t * 0.4))); }
    if (state.anim === 'slash' || state.anim === 'stab') { const dur = state.anim === 'stab' ? (st.stabT || 0.4) : (st.swingT || 0.5); s.swing = { t: dur * t, dur, kind: state.anim === 'stab' ? 'stab' : 'rl', idx: 0, done: true }; }
    if (state.anim === 'throw') vm.throwT = Math.max(0, 1 - Math.max(0, (t - 0.45) / 0.5));
    if (state.anim === 'sprint2ads') { s.sprinting = t < 0.35; s.adsT = Math.min(1, Math.max(0, (t - 0.55) / 0.4)); }
    if (state.anim === 'inspect') vm.inspectT = Math.max(0.0001, Math.min(0.999, t));
    vm.sprintT = s.sprinting ? 1 : 0; vm.bobT = state.bobT || 0;
    for (let i = 0; i < 6; i++) vm.update(1 / 120, { s, lookDX: 0, lookDY: 0, touch: false });
  }
}
