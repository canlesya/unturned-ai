import { t } from '../i18n/index.js';
import { ATK } from './payload.js';
import * as THREE from 'three';

// Vagon modu arayüzü (hud.js'e dokunmadan, kendi küçük modülü): üst ortada ray ilerleme çubuğu (kontrol noktaları + vagon simgesi + durum),
// dünyada vagon işareti (uzaklık), pusulada vagon, mini haritada ray + vagon. Takım skor kutuları gizlenir (süre kalır). Telefonda #topbar zaten ölçeklenir.
const CSS = `
#plbox{display:flex;flex-direction:column;align-items:center;gap:3px;margin-top:-2px}
#plbar{position:relative;width:440px;height:34px}
#plbar .tr{position:absolute;left:16px;right:16px;top:19px;height:8px;background:rgba(9,13,19,.75);border:1px solid rgba(255,255,255,.2);border-radius:4px;overflow:hidden}
#plbar .fill{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#2c78c8,#5ab0ff);transition:width .25s linear}
#plbar .cp{position:absolute;top:14px;width:18px;height:18px;margin-left:-9px;transform:rotate(45deg);background:rgba(9,13,19,.9);border:2px solid #b8bec6;z-index:1}
#plbar .cp b{display:block;transform:rotate(-45deg);font-size:11px;font-weight:800;line-height:14px;text-align:center;color:#fff}
#plbar .cp.done{border-color:#5ab0ff;background:#1f5a92}
#plbar .cp.end{width:22px;height:22px;margin-left:-11px;top:12px;border-color:#ffcf5a}
#plbar .cart{position:absolute;top:-1px;width:30px;height:20px;margin-left:-15px;z-index:2;transition:left .25s linear;filter:drop-shadow(0 1px 2px #000)}
#plstat{min-width:250px;padding:3px 14px 2px;font-size:13px;font-weight:800;letter-spacing:2px;text-align:center;text-transform:uppercase;background:rgba(9,13,19,.72);border:1px solid rgba(255,255,255,.14);white-space:nowrap}
#plstat small{display:block;font-size:10px;font-weight:700;letter-spacing:1.5px;opacity:.75;text-transform:none;margin-top:1px}
#plbox.flash #plstat{animation:plfl .5s ease-out 3}
@keyframes plfl{0%{background:rgba(255,211,106,.65)}100%{background:rgba(9,13,19,.72)}}
#plmark{position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:none;flex-direction:column;align-items:center;font-weight:800;font-size:12px;letter-spacing:1px;text-shadow:0 1px 3px #000;white-space:nowrap}
#plmark svg{width:30px;height:22px;filter:drop-shadow(0 1px 2px #000)}
#plrole{position:absolute;left:50%;top:27%;transform:translate(-50%,0);font-size:26px;font-weight:800;letter-spacing:4px;text-align:center;text-shadow:0 2px 8px #000;opacity:0;transition:opacity .6s;pointer-events:none}
#plrole small{display:block;font-size:14px;letter-spacing:2px;font-weight:700;opacity:.85;margin-top:4px}
@media (max-height:520px){#plbar{width:360px}#plrole{font-size:20px}}
`;
const cartSvg = (c) => `<svg viewBox="0 0 30 20"><path d="M3 4h24l-3 10H6z" fill="${c}" stroke="#0a0e14" stroke-width="1.6" stroke-linejoin="round"/><rect x="8" y="1" width="5" height="4" fill="#c4482e" stroke="#0a0e14" stroke-width="1"/><rect x="15" y="1.5" width="5" height="3.5" fill="#c4482e" stroke="#0a0e14" stroke-width="1"/><circle cx="9" cy="16.5" r="2.6" fill="#2c2f33" stroke="#0a0e14"/><circle cx="21" cy="16.5" r="2.6" fill="#2c2f33" stroke="#0a0e14"/></svg>`;

export class PayloadHud {
  constructor(game, pl) {
    this.g = game; this.pl = pl;
    const st = (this.st = document.createElement('style')); st.textContent = CSS; document.head.appendChild(st);
    const root = game.hud.root, top = root.querySelector('#topbar');
    root.querySelectorAll('#score .tk').forEach((e) => { e.style.display = 'none'; });       // bilet kutuları yerine ray çubuğu
    const box = (this.box = document.createElement('div')); box.id = 'plbox';
    const L = pl.end - pl.start, pos = (d) => `calc(16px + (100% - 32px) * ${((d - pl.start) / L).toFixed(4)})`;
    box.innerHTML = `<div id="plbar"><div class="tr"><div class="fill"></div></div>${pl.cps.map((d, i) => `<div class="cp" style="left:${pos(d)}"><b>${pl.def.names[i][0]}</b></div>`).join('')}<div class="cp end" style="left:${pos(pl.end)}"><b>${pl.def.names[pl.def.names.length - 1][0]}</b></div><div class="cart"></div></div><div id="plstat"></div>`;
    top.insertBefore(box, top.querySelector('#flags'));
    this.fill = box.querySelector('.fill'); this.cartEl = box.querySelector('.cart'); this.stat = box.querySelector('#plstat'); this.cpEls = [...box.querySelectorAll('.cp:not(.end)')];
    this.mark = document.createElement('div'); this.mark.id = 'plmark'; root.appendChild(this.mark);
    this.role = document.createElement('div'); this.role.id = 'plrole'; root.appendChild(this.role);
    this.v = new THREE.Vector3(); this._k = ''; this._mk = ''; this._ck = ''; this.roleT = 0;
  }

  flash() { this.box.classList.remove('flash'); void this.box.offsetWidth; this.box.classList.add('flash'); }

  // doğunca kısa rol yazısı (SALDIRI / SAVUNMA)
  showRole() {
    const me = this.g.playerSoldier, atk = me.team === ATK;
    this.role.innerHTML = `<span style="color:${atk ? '#7ec8ff' : '#ff8a7a'}">${atk ? t('payload.roleAtk') : t('payload.roleDef')}</span><small>${atk ? t('payload.roleAtkSub', { name: this.pl.def.names[this.pl.def.names.length - 1] }) : t('payload.roleDefSub')}</small>`;
    this.role.style.opacity = 1; this.roleT = 3.2;
  }

  update(dt) {
    const g = this.g, pl = this.pl, me = g.playerSoldier, col = pl.stateColor(), atk = me.team === ATK;
    if (me.alive && !this._alive) this.showRole();
    this._alive = me.alive;
    if (this.roleT > 0 && (this.roleT -= dt) <= 0) this.role.style.opacity = 0;
    const L = pl.end - pl.start, f = Math.max(0, Math.min(1, (pl.shown - pl.start) / L));
    this.fill.style.width = (f * 100).toFixed(1) + '%';
    this.cartEl.style.left = `calc(16px + (100% - 32px) * ${f.toFixed(4)})`;
    const ck = col + pl.reached;
    if (ck !== this._ck) { this._ck = ck; this.cartEl.innerHTML = cartSvg(col); this.cpEls.forEach((e, i) => e.classList.toggle('done', i < pl.reached)); }
    // durum + sıradaki hedef
    const next = pl.reached < pl.cps.length ? pl.cps[pl.reached] : pl.end, dist = Math.max(0, Math.round(next - pl.shown));
    const s = pl.state, mine = me.alive && pl.distTo(me) < 3.5;
    const main = s === 'push' ? t('payload.stPush', { n: pl.pushers }) : s === 'contest' ? t('payload.stContest') : s === 'back' ? t('payload.stBack') : s === 'block' ? t('payload.stBlock') : t('payload.stIdle');
    const sub = (mine ? (atk ? t('payload.youPush') : t('payload.youBlock')) + ' · ' : '') + t('payload.next', { name: pl.nextName, m: dist });
    const key = s + pl.pushers + '|' + sub + pl.over;
    if (key !== this._k) { this._k = key; this.stat.innerHTML = `<span style="color:${col}">${pl.over ? t('payload.overShort') + ' · ' : ''}${main}</span><small>${sub}</small>`; }
    const lim = g.hud.$('lim'); if (lim) lim.textContent = pl.over ? t('payload.overShort') : atk ? t('payload.timeAtk') : t('payload.timeDef');
    this.drawWorldMark(col);
    this.drawMinimap(col);
    this.drawCompass(col);
  }

  // vagonun üstünde ekran işareti + uzaklık (kameranın arkasındaysa gizli)
  drawWorldMark(col) {
    const g = this.g, pl = this.pl, cam = g.camera, v = this.v.set(pl.p.x, 2.25, pl.p.z);
    const d = v.distanceTo(cam.position);
    v.project(cam);
    const show = !pl.done && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && d > 4;
    this.mark.style.display = show ? 'flex' : 'none';
    if (!show) return;
    this.mark.style.left = ((v.x + 1) / 2 * innerWidth).toFixed(0) + 'px';
    this.mark.style.top = ((1 - v.y) / 2 * innerHeight).toFixed(0) + 'px';
    const k = col + Math.round(d);
    if (k !== this._mk) { this._mk = k; this.mark.innerHTML = `${cartSvg(col)}<span style="color:${col}">${Math.round(d)} m</span>`; }
  }

  drawMinimap(col) {
    const h = this.g.hud, x = h.mmCtx, pl = this.pl, tr = pl.track;
    if (!x || !h.mmX) return;
    const X = h.mmX, Y = h.mmY;
    x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = 'rgba(20,14,8,.85)'; x.lineWidth = 3.2; x.beginPath();
    tr.parts.forEach((p, i) => { if (!i) x.moveTo(X(p.a[0]), Y(p.a[1])); x.lineTo(X(p.b[0]), Y(p.b[1])); }); x.stroke();
    x.strokeStyle = '#5ab0ff'; x.lineWidth = 2; x.beginPath();                    // geçilen kısım
    let first = true;
    for (const p of tr.parts) {
      if (p.d0 > pl.shown) break;
      if (p.d0 + p.L < pl.start) continue;
      const a0 = Math.max(0, (pl.start - p.d0) / p.L), a1 = Math.min(1, (pl.shown - p.d0) / p.L);
      const ax = p.a[0] + (p.b[0] - p.a[0]) * a0, az = p.a[1] + (p.b[1] - p.a[1]) * a0, bx = p.a[0] + (p.b[0] - p.a[0]) * a1, bz = p.a[1] + (p.b[1] - p.a[1]) * a1;
      if (first) { x.moveTo(X(ax), Y(az)); first = false; }
      x.lineTo(X(bx), Y(bz));
    }
    x.stroke();
    const q = {};
    x.font = 'bold 8px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    [...pl.cps, pl.end].forEach((d, i) => {
      tr.at(d, q); const px = X(q.x), py = Y(q.z);
      x.fillStyle = i < pl.reached ? '#1f5a92' : 'rgba(9,13,19,.9)'; x.strokeStyle = i === pl.cps.length ? '#ffcf5a' : '#fff'; x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(px, py - 5.5); x.lineTo(px + 5.5, py); x.lineTo(px, py + 5.5); x.lineTo(px - 5.5, py); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#fff'; x.fillText(pl.def.names[i][0], px, py + 0.5);
    });
    const cx = X(pl.p.x), cy = Y(pl.p.z);
    x.fillStyle = col; x.strokeStyle = '#0a0e14'; x.lineWidth = 1.5;
    x.fillRect(cx - 4, cy - 4, 8, 8); x.strokeRect(cx - 4, cy - 4, 8, 8);
    x.restore();
  }

  drawCompass(col) {
    const g = this.g, x = g.hud.cmp, p = g.playerSoldier, pl = this.pl, W = 920;
    if (!x || pl.done) return;
    const bearing = ((-p.yaw * 180) / Math.PI % 360 + 360) % 360;
    const brg = (Math.atan2(pl.p.x - p.pos.x, -(pl.p.z - p.pos.z)) * 180) / Math.PI;
    const rel = ((brg - bearing + 540) % 360) - 180;
    if (Math.abs(rel) > 92) return;
    const px = W / 2 + (rel / 180) * W;
    x.save();
    x.fillStyle = col; x.strokeStyle = '#0a0e14'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(px - 13, 6); x.lineTo(px + 13, 6); x.lineTo(px + 9, 22); x.lineTo(px - 9, 22); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#2c2f33'; for (const o of [-6, 6]) { x.beginPath(); x.arc(px + o, 26, 3.6, 0, 6.3); x.fill(); }
    x.restore();
  }

  dispose() { this.st.remove(); this.box.remove(); this.mark.remove(); this.role.remove(); }
}
