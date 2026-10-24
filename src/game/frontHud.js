import * as THREE from 'three';
import { t } from '../i18n/index.js';

// Cephe modu arayüzü (12.161 Cephe Hattı; hud.js'e dokunmadan): üst ortada CEPHE HATTI göstergesi — zincirin 7 noktası (Mavi KG … Kırmızı KG) bir çizgi
// üstünde, sahibin renginde; etkin nokta büyük, ele geçirme çubuğu (Mavi soldan / Kırmızı sağdan dolar) ve altında yön oku + ad + uzaklık + görev (SALDIR / SAVUN / AL).
// Skor kutuları iki takımın bileti (nokta farkı kanıyorsa ▼n). Dünyada etkin noktanın işareti (harf + uzaklık); ekran dışındaysa kenarda ok. Doğunca görev yazısı.
const CSS = `
#flags.frhide{display:none}
#frline{position:relative;display:flex;align-items:center;gap:0;margin:0 0 2px;padding:3px 8px 2px;background:rgba(9,13,19,.62);border:1px solid rgba(255,255,255,.12);border-radius:3px}
#frline .seg{width:22px;height:3px;background:#5a6068}
#frline .seg.b{background:#3f8fe0}#frline .seg.r{background:#e0533f}
#frline .nd{position:relative;width:22px;height:22px;line-height:18px;border-radius:50%;border:2px solid #8b929b;background:#20252c;color:#dfe4ea;font-size:10px;font-weight:800;text-align:center;letter-spacing:0}
#frline .nd.b{border-color:#5ab0ff;background:#1f5a92;color:#e6f2ff}#frline .nd.r{border-color:#ff6a55;background:#8f2b20;color:#ffe9e4}
#frline .nd.hq{border-radius:4px}
#frline .nd.on{width:30px;height:30px;line-height:26px;font-size:12px;border-color:#ffcf5a;box-shadow:0 0 0 2px rgba(255,207,90,.35)}
#frline .nd.on i{position:absolute;inset:-2px;border-radius:50%;pointer-events:none}
#frline .nd.me{outline:1px dashed rgba(255,255,255,.35);outline-offset:2px}
#frline.flash .nd.on{animation:frfl .5s ease-out 3}
@keyframes frfl{0%{box-shadow:0 0 0 7px rgba(255,211,106,.6)}100%{box-shadow:0 0 0 2px rgba(255,207,90,.35)}}
#frgo{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;text-shadow:0 1px 3px #000;color:#e8ecf0;white-space:nowrap}
#frgo .ar{display:inline-block;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:11px solid #ffcf5a;transform-origin:50% 60%}
#frgo .tg{padding:1px 6px;border-radius:2px;background:rgba(9,13,19,.7)}
#frmarks{position:absolute;inset:0;pointer-events:none}
#frmarks .fm{position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;font-weight:800;font-size:12px;letter-spacing:1px;text-shadow:0 1px 3px #000;white-space:nowrap}
#frmarks .fm b{min-width:24px;height:24px;line-height:20px;padding:0 3px;text-align:center;border:2px solid currentColor;border-radius:50%;background:rgba(9,13,19,.62);font-size:12px}
#frmarks .edge{position:absolute;width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:16px solid #ffcf5a;filter:drop-shadow(0 1px 2px #000);transform-origin:50% 50%}
#frrole{position:absolute;left:50%;top:27%;transform:translate(-50%,0);font-size:26px;font-weight:800;letter-spacing:4px;text-align:center;text-shadow:0 2px 8px #000;opacity:0;transition:opacity .6s;pointer-events:none}
#frrole small{display:block;font-size:14px;letter-spacing:2px;font-weight:700;opacity:.85;margin-top:4px}
@media (max-height:520px){#frline .nd{width:18px;height:18px;line-height:14px;font-size:9px}#frline .nd.on{width:24px;height:24px;line-height:20px}#frline .seg{width:14px}#frgo{font-size:10px}#frrole{font-size:20px}}
`;
const OWN = { blue: '#5ab0ff', red: '#ff6a55' };

export class FrontHud {
  constructor(game, fr) {
    this.g = game; this.fr = fr;
    const st = (this.st = document.createElement('style')); st.textContent = CSS; document.head.appendChild(st);
    const root = game.hud.root, top = root.querySelector('#topbar'), flags = top.querySelector('#flags');
    flags?.classList.add('frhide');
    const line = (this.line = document.createElement('div')); line.id = 'frline';
    line.innerHTML = fr.chain.map((o, i) => (i ? '<div class="seg"></div>' : '') + `<div class="nd${o.hq ? ' hq' : ''}">${o.label}<i></i></div>`).join('');
    top.insertBefore(line, flags);
    this.nds = [...line.querySelectorAll('.nd')]; this.segs = [...line.querySelectorAll('.seg')];
    const go = (this.go = document.createElement('div')); go.id = 'frgo';
    go.innerHTML = '<span class="ar"></span><span class="nm"></span><span class="tg"></span>';
    top.insertBefore(go, flags);
    this.arEl = go.querySelector('.ar'); this.nmEl = go.querySelector('.nm'); this.tgEl = go.querySelector('.tg');
    this.marks = document.createElement('div'); this.marks.id = 'frmarks'; root.appendChild(this.marks);
    this.mark = document.createElement('div'); this.mark.className = 'fm'; this.marks.appendChild(this.mark);
    this.edge = document.createElement('div'); this.edge.className = 'edge'; this.marks.appendChild(this.edge);
    this.role = document.createElement('div'); this.role.id = 'frrole'; root.appendChild(this.role);
    this.v = new THREE.Vector3(); this.f = new THREE.Vector3(); this._k = ''; this.roleT = 0;
  }

  flash() { this.line.classList.remove('flash'); void this.line.offsetWidth; this.line.classList.add('flash'); }

  // görev: etkin nokta kendi tarafına yatıksa SAVUN, düşmanınkine yatıksa SALDIR, ortadaysa AL
  task(team) { const s = this.fr.stance(team); return s === 'def' ? 'def' : s === 'atk' ? 'atk' : 'even'; }

  showRole() {
    const me = this.g.playerSoldier, k = this.task(me.team), name = this.fr.name;
    const col = k === 'def' ? '#9fe6a8' : k === 'atk' ? '#ffcf5a' : '#e8ecf0';
    this.role.innerHTML = `<span style="color:${col}">${t('front.task.' + k)}</span><small>${t('front.taskSub.' + k, { name })}</small>`;
    this.role.style.opacity = 1; this.roleT = 3.2;
  }

  update(dt) {
    const g = this.g, fr = this.fr, me = g.playerSoldier, h = g.hud, o = fr.active;
    if (me.alive && !this._alive) this.showRole();
    this._alive = me.alive;
    if (this.roleT > 0 && (this.roleT -= dt) <= 0) this.role.style.opacity = 0;
    const key = fr.a + '|' + fr.done + '|' + fr.chain.map((q) => q.owner || '-').join('');
    if (key !== this._k) {
      this._k = key;
      fr.chain.forEach((q, i) => {
        const e = this.nds[i];
        e.classList.toggle('b', q.owner === 'blue'); e.classList.toggle('r', q.owner === 'red');
        e.classList.toggle('on', i === fr.a && !fr.done);
        e.classList.toggle('me', !!q.hq && q.hq === me.team);
        if (i) { const s = this.segs[i - 1], pv = fr.chain[i - 1].owner; s.classList.toggle('b', pv === 'blue' && q.owner === 'blue'); s.classList.toggle('r', pv === 'red' && q.owner === 'red'); }
      });
    }
    // etkin noktanın çubuğu: Mavi saat yönünde, Kırmızı tersine dolar
    const on = this.nds[fr.a];
    if (on && !fr.done) {
      const p = o.p, c = p > 0 ? '#4aa3ff' : '#ff5a43', deg = Math.abs(p) * 360;
      const bg = Math.abs(p) > 0.02 ? (p > 0 ? `conic-gradient(${c} ${deg}deg, transparent 0)` : `conic-gradient(from ${-deg}deg, ${c} ${deg}deg, transparent 0)`) : 'none';
      const ie = on.firstElementChild;
      if (ie._bg !== bg) { ie._bg = bg; ie.style.background = bg; ie.style.webkitMask = ie.style.mask = 'radial-gradient(circle, transparent 58%, #000 60%)'; }
    }
    // bilet kutuları: iki takım, az noktası olan kanar
    const nb = fr.owned('blue'), nr = fr.owned('red');
    h.$('tnB').textContent = t('front.tickets') + (nr > nb ? ` ▼${nr - nb}` : '');
    h.$('tnR').textContent = t('front.tickets') + (nb > nr ? ` ▼${nb - nr}` : '');
    h.$('tbB').style.width = Math.max(0, Math.min(100, g.tickets.blue / Math.max(1, fr.t0) * 100)).toFixed(0) + '%';
    h.$('tbR').style.width = Math.max(0, Math.min(100, g.tickets.red / Math.max(1, fr.t0) * 100)).toFixed(0) + '%';
    const lim = h.$('lim'); if (lim) lim.textContent = t('front.lineLabel');
    this.drawGo(o, me);
    this.drawMark(o);
  }

  // yön oku + ad + uzaklık + görev (kameranın baktığı yöne göre)
  drawGo(o, me) {
    const g = this.g, cam = g.camera, fr = this.fr;
    if (fr.done) { this.go.style.visibility = 'hidden'; return; }
    this.go.style.visibility = 'visible';
    cam.getWorldDirection(this.f);
    const yawC = Math.atan2(this.f.x, this.f.z), yawO = Math.atan2(o.x - cam.position.x, o.z - cam.position.z);
    const rel = Math.atan2(Math.sin(yawO - yawC), Math.cos(yawO - yawC));
    this.arEl.style.transform = `rotate(${(-rel * 180 / Math.PI).toFixed(0)}deg)`;
    const d = Math.round(Math.hypot(o.x - me.pos.x, o.z - me.pos.z)), k = this.task(me.team);
    const lk = Math.ceil(fr.lockLeft()), s = `${o.label} ${o.name} · ${d} m` + (lk > 0 ? ` · ${t('front.lock', { n: lk })}` : ''), tg = t('front.task.' + k);
    if (this.nmEl._s !== s) { this.nmEl._s = s; this.nmEl.textContent = s; }
    if (this.tgEl._s !== tg) { this.tgEl._s = tg; this.tgEl.textContent = tg; this.tgEl.style.color = k === 'def' ? '#9fe6a8' : k === 'atk' ? '#ffcf5a' : '#e8ecf0'; }
  }

  // dünyada etkin nokta işareti; ekran dışındaysa / arkadaysa kenarda yön oku
  drawMark(o) {
    const g = this.g, cam = g.camera;
    if (this.fr.done) { this.mark.style.display = this.edge.style.display = 'none'; return; }
    const v = this.v.set(o.x, (o.y || 0) + 3.2, o.z), d = v.distanceTo(cam.position);
    v.project(cam);
    const show = v.z < 1 && Math.abs(v.x) < 1.0 && Math.abs(v.y) < 1.0;
    this.mark.style.display = show && d > 6 ? 'flex' : 'none';
    this.edge.style.display = show ? 'none' : 'block';
    if (show) {
      this.mark.style.left = ((v.x + 1) / 2 * innerWidth).toFixed(0) + 'px'; this.mark.style.top = ((1 - v.y) / 2 * innerHeight).toFixed(0) + 'px';
      const col = o.owner ? OWN[o.owner] : '#e8ecf0', k = col + o.label + Math.round(d);
      if (this.mark._k !== k) { this.mark._k = k; this.mark.style.color = col; this.mark.innerHTML = `<b>${o.label}</b><span>${Math.round(d)} m</span>`; }
      return;
    }
    // ekran dışı: kameranın baktığı yöne göre noktanın yatay açısı → ekran merkezi çevresindeki elipste ok (öndeyse üstte, arkadaysa altta)
    cam.getWorldDirection(this.f);
    const rel = Math.atan2(Math.sin(Math.atan2(o.x - cam.position.x, o.z - cam.position.z) - Math.atan2(this.f.x, this.f.z)), Math.cos(Math.atan2(o.x - cam.position.x, o.z - cam.position.z) - Math.atan2(this.f.x, this.f.z)));
    const sx = -Math.sin(rel), sy = -Math.cos(rel);                                 // three: +açı sola döner → ekranda sol
    this.edge.style.left = (innerWidth / 2 + sx * innerWidth * 0.4 - 9).toFixed(0) + 'px'; this.edge.style.top = (innerHeight / 2 + sy * innerHeight * 0.36 - 8).toFixed(0) + 'px';
    this.edge.style.transform = `rotate(${(Math.atan2(sx, -sy) * 180 / Math.PI).toFixed(0)}deg)`;
  }

  dispose() { this.st.remove(); this.line.remove(); this.go.remove(); this.marks.remove(); this.role.remove(); this.g.hud.root.querySelector('#flags')?.classList.remove('frhide'); }
}
