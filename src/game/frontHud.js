import * as THREE from 'three';
import { t } from '../i18n/index.js';

// Cephe modu arayüzü (hud.js'e dokunmadan): üst ortada sektör şeridi (geçilen / etkin / sıradaki), sağ kutu = sektör, sol kutu = saldıranın bileti;
// bayrak sırasında yalnız etkin sektörün noktaları parlak (geçilenler kilitli mavi, sıradakiler soluk); dünyada etkin noktaların işareti (harf + uzaklık); doğunca rol yazısı.
const CSS = `
#frbox{display:flex;gap:3px;margin:-1px 0 1px}
#frbox .sg{min-width:84px;padding:2px 8px 1px;font-size:10px;font-weight:800;letter-spacing:1.6px;text-align:center;text-transform:uppercase;background:rgba(9,13,19,.72);border:1px solid rgba(255,255,255,.14);color:#9aa3ad;white-space:nowrap}
#frbox .sg.done{background:rgba(31,90,146,.78);color:#d9ecff;border-color:#5ab0ff}
#frbox .sg.on{color:#fff;border-color:#ffcf5a;box-shadow:0 0 0 1px rgba(255,207,90,.4) inset}
#frbox.flash .sg.on{animation:frfl .5s ease-out 3}
@keyframes frfl{0%{background:rgba(255,211,106,.65)}100%{background:rgba(9,13,19,.72)}}
.flag.frlock{opacity:.32}
.flag.frdone{opacity:.55}
#frmarks{position:absolute;inset:0;pointer-events:none}
#frmarks .fm{position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;font-weight:800;font-size:12px;letter-spacing:1px;text-shadow:0 1px 3px #000;white-space:nowrap}
#frmarks .fm b{width:24px;height:24px;line-height:20px;text-align:center;border:2px solid currentColor;border-radius:50%;background:rgba(9,13,19,.62);font-size:13px}
#frrole{position:absolute;left:50%;top:27%;transform:translate(-50%,0);font-size:26px;font-weight:800;letter-spacing:4px;text-align:center;text-shadow:0 2px 8px #000;opacity:0;transition:opacity .6s;pointer-events:none}
#frrole small{display:block;font-size:14px;letter-spacing:2px;font-weight:700;opacity:.85;margin-top:4px}
@media (max-height:520px){#frbox .sg{min-width:60px;font-size:9px;padding:1px 5px}#frrole{font-size:20px}}
`;
const OWN = { blue: '#5ab0ff', red: '#ff6a55' };

export class FrontHud {
  constructor(game, fr) {
    this.g = game; this.fr = fr;
    const st = (this.st = document.createElement('style')); st.textContent = CSS; document.head.appendChild(st);
    const root = game.hud.root, top = root.querySelector('#topbar');
    const box = (this.box = document.createElement('div')); box.id = 'frbox';
    box.innerHTML = fr.def.sectors.map((_, i) => `<div class="sg">${fr.secName(i)}</div>`).join('');
    top.insertBefore(box, top.querySelector('#flags'));
    this.sgs = [...box.children];
    this.marks = document.createElement('div'); this.marks.id = 'frmarks'; root.appendChild(this.marks);
    this.role = document.createElement('div'); this.role.id = 'frrole'; root.appendChild(this.role);
    this.v = new THREE.Vector3(); this._k = ''; this.roleT = 0; this.markEls = [];
  }

  flash() { this.box.classList.remove('flash'); void this.box.offsetWidth; this.box.classList.add('flash'); }

  showRole() {
    const me = this.g.playerSoldier, atk = me.team === 'blue', name = this.fr.name;
    this.role.innerHTML = `<span style="color:${atk ? '#7ec8ff' : '#ff8a7a'}">${atk ? t('front.roleAtk') : t('front.roleDef')}</span><small>${atk ? t('front.roleAtkSub', { name }) : t('front.roleDefSub', { name })}</small>`;
    this.role.style.opacity = 1; this.roleT = 3.2;
  }

  update(dt) {
    const g = this.g, fr = this.fr, me = g.playerSoldier, h = g.hud, atk = me.team === 'blue';
    if (me.alive && !this._alive) this.showRole();
    this._alive = me.alive;
    if (this.roleT > 0 && (this.roleT -= dt) <= 0) this.role.style.opacity = 0;
    const key = fr.sector + '|' + fr.done;
    if (key !== this._k) {
      this._k = key;
      this.sgs.forEach((e, i) => { e.classList.toggle('done', i < fr.sector); e.classList.toggle('on', i === fr.sector && !fr.done); });
    }
    // skor kutuları: sol = saldıranın bileti, sağ = sektör
    h.$('tnB').textContent = t('front.tickets'); h.$('tnR').textContent = t('front.secLabel', { i: Math.min(fr.sector + 1, fr.n), n: fr.n });
    h.$('tkR').textContent = fr.n - fr.sector; h.$('tbR').style.width = ((fr.n - fr.sector) / fr.n * 100).toFixed(0) + '%';
    h.$('tbB').style.width = Math.max(0, Math.min(100, g.tickets.blue / Math.max(1, fr.t0) * 100)).toFixed(0) + '%';
    const lim = h.$('lim'); if (lim) lim.textContent = atk ? t('front.roleAtk') : t('front.roleDef');
    g.mode.objectives.forEach((o, i) => { const f = h.flagEls[i]; if (!f) return; f.classList.toggle('frlock', o.sector > fr.sector); f.classList.toggle('frdone', o.sector < fr.sector); });
    this.drawMarks();
  }

  // etkin sektörün noktaları: ekranda harf + uzaklık (kameranın arkasındaysa gizli)
  drawMarks() {
    const g = this.g, cam = g.camera, act = this.fr.done ? [] : this.fr.active();
    while (this.markEls.length < act.length) { const e = document.createElement('div'); e.className = 'fm'; this.marks.appendChild(e); this.markEls.push(e); }
    this.markEls.forEach((e, i) => {
      const o = act[i];
      if (!o) { e.style.display = 'none'; return; }
      const v = this.v.set(o.x, (o.y || 0) + 3.2, o.z), d = v.distanceTo(cam.position);
      v.project(cam);
      const show = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && d > 6;
      e.style.display = show ? 'flex' : 'none';
      if (!show) return;
      e.style.left = ((v.x + 1) / 2 * innerWidth).toFixed(0) + 'px'; e.style.top = ((1 - v.y) / 2 * innerHeight).toFixed(0) + 'px';
      const col = o.owner ? OWN[o.owner] : '#e8ecf0', k = col + o.label + Math.round(d);
      if (e._k !== k) { e._k = k; e.style.color = col; e.innerHTML = `<b>${o.label || o.name[0]}</b><span>${Math.round(d)} m</span>`; }
    });
  }

  dispose() { this.st.remove(); this.box.remove(); this.marks.remove(); this.role.remove(); }
}
