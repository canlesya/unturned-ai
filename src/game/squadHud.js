// 12.202 Manga HUD'u: mini haritanın altında mangan (ad, sınıf, can, ölü / araçta, ★ lider) + manga arkadaşlarının başında yeşil işaret
// (duvar arkasından da görünür, Battlefield gibi; yakındaysa ya da artıya yakınsa adı). Mini / büyük haritada da yeşil (hud.drawMinimap, bigMap).
import * as THREE from 'three';
import { t, lang } from '../i18n/index.js';
import '../i18n/squad.js';
import { className } from '../i18n/data.js';
import { squadOn, squadMembers, squadLeader, squadName } from './squad.js';
import { PCOL } from './pings.js';

export const SQ_COL = PCOL.sq;
const CSS = `
#sqp{position:absolute;left:16px;top:222px;width:244px;font-size:12px;letter-spacing:1px;text-shadow:0 1px 2px #000;pointer-events:none}
#sqp h4{margin:0 0 3px;font-size:11px;letter-spacing:3px;color:${SQ_COL};font-weight:800;text-transform:uppercase;display:flex;justify-content:space-between}
#sqp h4 span{color:rgba(255,255,255,.55);letter-spacing:1px}
#sqp .r{display:flex;align-items:center;gap:6px;padding:3px 7px;margin-bottom:2px;background:linear-gradient(90deg,rgba(9,13,19,.78),rgba(9,13,19,.35));border-left:2px solid ${SQ_COL}}
#sqp .r.me{border-left-color:#ffd23a;background:linear-gradient(90deg,rgba(60,48,10,.7),rgba(9,13,19,.3))}
#sqp .r .ld{width:10px;color:#ffd23a;font-size:11px}
#sqp .r .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;color:#e9ffe9}
#sqp .r.me .nm{color:#fff3c0}
#sqp .r small{opacity:.6;font-size:10px;text-transform:uppercase;white-space:nowrap}
#sqp .r .hp{width:38px;height:4px;background:rgba(255,255,255,.15)}
#sqp .r .hp u{display:block;height:100%;background:${SQ_COL}}
#sqp .r.dead{opacity:.55;border-left-color:#777}
#sqp .r.dead .nm{text-decoration:line-through;color:#bbb}
#sqp .r .st{font-size:10px;font-weight:800;color:#ff8a7a;text-transform:uppercase}
#sqp .r .st.v{color:#9fd0ff}
#sqmk{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#sqmk .m{position:absolute;display:none;transform:translate(-50%,-100%);flex-direction:column;align-items:center;font-weight:800;font-size:11px;letter-spacing:1px;color:${SQ_COL};text-shadow:0 1px 3px #000;white-space:nowrap}
#sqmk .m i{display:block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid ${SQ_COL};filter:drop-shadow(0 0 2px #000)}
#sqmk .m span{display:none;margin-bottom:1px}
#sqmk .m.nm span{display:block}
body.mob #sqp{zoom:.66;left:calc(19vw / .66);top:calc(27vh / .66);width:200px}
body.mob #sqp .r small{display:none}
`;
const _v = new THREE.Vector3();

export class SquadHud {
  constructor(game) {
    this.g = game; this.key = '';
    if (!document.getElementById('sqCss')) { const st = document.createElement('style'); st.id = 'sqCss'; st.textContent = CSS; document.head.appendChild(st); }
    const root = game.hud.root;
    this.p = document.createElement('div'); this.p.id = 'sqp'; root.appendChild(this.p);
    this.mk = document.createElement('div'); this.mk.id = 'sqmk'; root.prepend(this.mk);
    this.marks = new Map();
  }

  members() { const me = this.g.playerSoldier; return me ? squadMembers(this.g, me.team, me.squad).sort((a, b) => (a === me ? -1 : b === me ? 1 : a.id - b.id)) : []; }

  update() {
    const g = this.g, me = g.playerSoldier;
    if (!me || !squadOn(g)) { this.p.style.display = 'none'; return; }
    const list = this.members(), ld = squadLeader(g, me.team, me.squad);
    const st = (s) => (!s.alive ? 'd' : s.veh ? 'v' : Math.ceil(s.hp / (s.maxHp || 100) * 10));
    const key = list.map((s) => `${s.id}:${s.name}:${s.cls}:${st(s)}`).join('|') + '|' + me.squad + '|' + (ld?.id ?? -1) + '|' + lang() + '|' + (g.bigMap?.open ? 1 : 0);
    if (key !== this.key) {
      this.key = key;
      this.p.style.display = g.bigMap?.mode === 'map' ? 'none' : '';
      this.p.innerHTML = `<h4>${t('sq.title', { n: squadName(me.squad) })}<span>${list.length}/4</span></h4>` + list.map((s) => {
        const dead = !s.alive, hp = Math.max(0, Math.min(100, s.hp / (s.maxHp || 100) * 100));
        return `<div class="r ${s === me ? 'me' : ''} ${dead ? 'dead' : ''}"><b class="ld">${s === ld ? '★' : ''}</b><span class="nm">${esc(s.name)}</span><small>${className(s.cls)}</small>${dead ? `<span class="st">${t('sq.dead')}</span>` : s.veh ? `<span class="st v">${t('sq.inVeh')}</span>` : `<i class="hp"><u style="width:${hp.toFixed(0)}%"></u></i>`}</div>`;
      }).join('');
    }
    this.drawMarks(list, me);
  }

  // manga arkadaşlarının başında yeşil ok (+ yakın / artıya yakınsa ad)
  drawMarks(list, me) {
    const g = this.g, cam = g.camera, W = innerWidth, H = innerHeight, seen = new Set();
    const hideAll = !me.alive || g.bigMap?.mode === 'map';
    for (const s of list) {
      if (s === me) continue;
      seen.add(s.id);
      let m = this.marks.get(s.id);
      if (!m) { const el = document.createElement('div'); el.className = 'm'; el.innerHTML = '<span></span><i></i>'; this.mk.appendChild(el); m = { el, nm: el.firstChild, on: false }; this.marks.set(s.id, m); }
      let vis = !hideAll && s.alive;
      let sx = 0, sy = 0, d = 0;
      if (vis) {
        const hy = s.veh ? 2.6 : (s.height || 1.8) + 0.45;
        _v.set(s.pos.x, s.pos.y + hy, s.pos.z).project(cam);
        sx = (_v.x + 1) / 2 * W; sy = (1 - _v.y) / 2 * H;
        vis = _v.z < 1 && sx > -20 && sx < W + 20 && sy > 0 && sy < H;
        d = Math.hypot(s.pos.x - me.pos.x, s.pos.z - me.pos.z);
        if (d < 2.5) vis = false;
      }
      if (vis !== m.on) { m.on = vis; m.el.style.display = vis ? 'flex' : 'none'; }
      if (!vis) continue;
      m.el.style.left = sx.toFixed(0) + 'px'; m.el.style.top = sy.toFixed(0) + 'px';
      const near = d < 45 || Math.hypot(sx - W / 2, sy - H / 2) < 110;
      m.el.classList.toggle('nm', near);
      if (m.nm._t !== s.name) { m.nm._t = s.name; m.nm.textContent = s.name; }
      const op = d > 250 ? '0.55' : '0.95'; if (m._op !== op) { m._op = op; m.el.style.opacity = op; }
    }
    for (const [id, m] of this.marks) if (!seen.has(id)) { m.el.remove(); this.marks.delete(id); }
  }

  dispose() { this.p.remove(); this.mk.remove(); }
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
