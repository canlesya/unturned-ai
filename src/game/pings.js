// 12.202 İşaret (ping / Battlefield "spot"): büyük haritaya tıklayınca ya da oyunda bakılan yere (orta tık / İşaret tuşu) işaret konur.
// Bakılan yerde görünen bir düşman varsa (artının ~4° yakınında, arada duvar yok) DÜŞMAN işareti olur: düşman ~6 sn takımın mini / büyük haritasında ve
// ekranında kırmızı görünür. İşaret takıma gider (çevrim içi: istemci { t:'mk', p, v } → sunucu doğrular (Game.ping) → aynı takımdaki istemcilere
// { t:'mk', by, p, v, k }); kendi işaretin sarı, manga arkadaşınınki yeşil, diğer takım arkadaşlarınınki mavi. Oyuncu başına tek işaret (yenisi eskisini siler).
// Dünyada: zeminde halka + dikey ışık (yalnız istemci, çarpışma / bot görüşü yok) + ekranda elmas, ad ve uzaklık (ekran dışındaysa kenarda).
import * as THREE from 'three';
import { t } from '../i18n/index.js';
import '../i18n/squad.js';

export const PING_TTL = { loc: 10, enemy: 6 };
export const PCOL = { me: '#ffd23a', sq: '#62f06a', team: '#68b8ff', enemy: '#ff4a3a' };
const CSS = `
#pgmk{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#pgmk .pg{position:absolute;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);font-weight:800;font-size:11px;letter-spacing:1px;color:var(--c);text-shadow:0 1px 3px #000;white-space:nowrap}
#pgmk .pg i{display:block;width:14px;height:14px;transform:rotate(45deg);border:2px solid var(--c);background:rgba(8,11,16,.55);box-shadow:0 0 8px var(--c);margin:3px 0 4px}
#pgmk .pg.en i{background:var(--c);border-color:#fff}
#pgmk .pg.edge{opacity:.85}
#pgmk .pg em{font-style:normal;font-size:10px;opacity:.85}
#pgmk .pg.new i{animation:pgnew .35s ease-out 2}
@keyframes pgnew{50%{transform:rotate(45deg) scale(1.7)}}
body.mob #pgmk .pg{transform:translate(-50%,-100%) scale(.85);transform-origin:50% 100%}
`;
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Vector3(), _h = {};

export class Pings {
  constructor(game) {
    this.g = game; this.items = new Map(); this.lastT = -9;
    if (game.headless) return;
    if (!document.getElementById('pgCss')) { const st = document.createElement('style'); st.id = 'pgCss'; st.textContent = CSS; document.head.appendChild(st); }
    this.el = document.createElement('div'); this.el.id = 'pgmk'; game.hud.root.prepend(this.el);
    this.beamGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 6, 1, true); this.beamGeo.translate(0, 0.5, 0);
    this.ringGeo = new THREE.RingGeometry(0.55, 0.85, 28); this.ringGeo.rotateX(-Math.PI / 2);
  }

  colorOf(p) {
    const me = this.g.playerSoldier;
    if (p.k === 'enemy') return PCOL.enemy;
    if (p.by === me?.id) return PCOL.me;
    const s = this.g.soldiers[p.by];
    return s && me && s.team === me.team && s.squad === me.squad ? PCOL.sq : PCOL.team;
  }

  // Oyunda bakılan yere işaret (orta tık / İşaret tuşu): önce görünen düşman, yoksa bakış ışınının çarptığı nokta (en çok 500 m)
  spot() {
    const g = this.g, me = g.playerSoldier;
    if (!me?.alive || g.ended) return;
    const cam = g.camera, o = cam.getWorldPosition(_c.set(0, 0, 0)).clone(), dir = cam.getWorldDirection(_d).clone();
    let best = null, bc = -1;
    for (const e of g.soldiers) {
      if (!e.alive || e.vacant || e.team === me.team) continue;
      _v.set(e.pos.x, e.pos.y + (e.height || 1.7) * 0.6, e.pos.z).sub(o);
      const d = _v.length(); if (d > 350 || d < 0.5) continue;
      const c = _v.dot(dir) / d, tol = Math.cos(Math.max(4 * Math.PI / 180, Math.atan(1.1 / d)));      // ~4° koni (yakında gövde genişliği)
      if (c < tol || c <= bc) continue;
      if (!g.losClear(o, _v.clone().add(o))) continue;
      best = e; bc = c;
    }
    if (best) { this.send({ x: best.pos.x, y: best.pos.y, z: best.pos.z }, best.id); return; }
    const hit = g.world.raycast(o, dir, 500, _h);
    if (!hit) { g.hud.toast(t('sq.t.far'), '#ffd27a'); return; }
    this.send({ x: hit.point.x, y: hit.point.y, z: hit.point.z }, -1);
  }

  // Büyük haritadan: (x, z) zemine
  mapPing(x, z) { const g = this.g; this.send({ x, y: g.world.groundAt(x, z), z }, -1); }

  send(p, v = -1) {
    const g = this.g, me = g.playerSoldier, now = performance.now();
    if (now - this.lastT < 450) return;                                          // sunucu da 0,4 sn sınırlar
    this.lastT = now;
    const pt = [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)];
    if (g.online) { g.online.send({ t: 'mk', p: pt, v }); this.add({ by: me.id, p: pt, v, k: v >= 0 ? 'enemy' : 'loc', local: true }); return; }
    const r = g.ping(me, { x: pt[0], y: pt[1], z: pt[2] }, v);
    if (r) this.add({ by: me.id, p: [r.x, r.y, r.z], v: r.v, k: r.k });
  }

  // Ağdan / yerelden gelen işaret: gönderen başına tek kayıt
  add(m) {
    const g = this.g, me = g.playerSoldier;
    if (!Number.isInteger(m.by) || !Array.isArray(m.p)) return;
    const prev = this.items.get(m.by);
    if (m.by === me?.id && !m.local && prev && prev.local && Math.hypot(prev.x - m.p[0], prev.z - m.p[2]) < 0.5) { prev.local = false; prev.k = m.k; prev.v = m.v; return; }      // sunucunun onayı (kendi işaretim zaten gösteriliyor)
    if (prev) this.remove(m.by);
    const p = { by: m.by, k: m.k === 'enemy' ? 'enemy' : 'loc', v: m.v ?? -1, x: m.p[0], y: m.p[1], z: m.p[2], t0: g.time, local: !!m.local };
    p.ttl = PING_TTL[p.k];
    if (p.k === 'enemy') { const e = g.soldiers[p.v]; if (e) e.spottedT = Math.max(e.spottedT ?? -99, g.time + PING_TTL.enemy - 2.5); }      // mini harita: spottedT + 2,5 sn görünür
    this.items.set(m.by, p);
    if (g.headless || !this.el) return;
    const col = this.colorOf(p);
    p.el = document.createElement('div'); p.el.className = 'pg new' + (p.k === 'enemy' ? ' en' : ''); p.el.style.setProperty('--c', col);
    const by = g.soldiers[p.by];
    p.el.innerHTML = `<span>${p.k === 'enemy' ? t('sq.pingEnemy') : by && by !== me ? escapeHtml(by.name) : ''}</span><i></i><em></em>`;
    p.dEl = p.el.querySelector('em');
    this.el.appendChild(p.el);
    setTimeout(() => p.el?.classList.remove('new'), 800);
    if (p.k === 'loc') {
      const c = new THREE.Color(col);
      const mb = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      const mr = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const grp = new THREE.Group(), beam = new THREE.Mesh(this.beamGeo, mb), ring = new THREE.Mesh(this.ringGeo, mr);
      beam.scale.y = 22; ring.position.y = 0.06; beam.renderOrder = ring.renderOrder = 5;
      grp.add(beam, ring); grp.position.set(p.x, p.y, p.z);
      g.scene.add(grp); p.obj = grp; p.ring = ring; p.mats = [mb, mr];
    }
    if (by && by !== me) g.sfx?.ping?.(p.k === 'enemy');
    else g.sfx?.ping?.(p.k === 'enemy', true);
  }

  remove(by) {
    const p = this.items.get(by); if (!p) return;
    this.items.delete(by);
    p.el?.remove();
    if (p.obj) { this.g.scene.remove(p.obj); for (const m of p.mats) m.dispose(); }
  }

  // her kare (Hud.update): süre, düşman işareti hedefi izler, ekran işaretleri
  update() {
    const g = this.g, me = g.playerSoldier;
    if (!this.items.size || !me) return;
    const cam = g.camera, W = innerWidth, H = innerHeight;
    for (const p of [...this.items.values()]) {
      const age = g.time - p.t0, tg = p.k === 'enemy' ? g.soldiers[p.v] : null;
      if (age > p.ttl || (p.k === 'enemy' && (!tg || !tg.alive))) { this.remove(p.by); continue; }
      if (tg) { p.x = tg.pos.x; p.y = tg.pos.y; p.z = tg.pos.z; }
      if (p.ring) { const k = 1 + 0.25 * Math.sin(age * 6); p.ring.scale.set(k, 1, k); const f = Math.min(1, (p.ttl - age) / 1.5); p.mats[0].opacity = 0.32 * f; p.mats[1].opacity = 0.85 * f; }
      if (!p.el) continue;
      _v.set(p.x, p.y + (tg ? 2.3 : 1.2), p.z).project(cam);
      const behind = _v.z > 1;
      let sx = (_v.x + 1) / 2 * W, sy = (1 - _v.y) / 2 * H;
      if (behind) { sx = W - sx; sy = H - sy; }
      const edge = behind || sx < 24 || sx > W - 24 || sy < 40 || sy > H - 12;
      if (edge) {                                                               // ekran dışı / arkada: merkezden o yöne, kenarda
        const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy, k = Math.min((W / 2 - 28) / Math.max(1, Math.abs(dx)), (H / 2 - 40) / Math.max(1, Math.abs(dy)));
        if (behind || k < 1) { sx = cx + dx * k; sy = cy + dy * k; }
      }
      p.el.classList.toggle('edge', edge);
      p.el.style.left = sx.toFixed(0) + 'px'; p.el.style.top = sy.toFixed(0) + 'px';
      const d = Math.hypot(p.x - me.pos.x, p.z - me.pos.z), ds = d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m';
      if (p.dEl._t !== ds) { p.dEl._t = ds; p.dEl.textContent = ds; }
      const op = Math.min(1, (p.ttl - age) / 1.2).toFixed(2); if (p.el._op !== op) { p.el._op = op; p.el.style.opacity = op; }
    }
  }

  // mini / büyük harita: elmas (k: ölçek)
  drawMap(x, mx, my, k = 1) {
    for (const p of this.items.values()) {
      const X = mx(p.x), Y = my(p.z), r = 5 * k;
      x.save(); x.translate(X, Y); x.rotate(Math.PI / 4);
      x.fillStyle = p.k === 'enemy' ? PCOL.enemy : 'rgba(8,11,16,.6)'; x.strokeStyle = this.colorOf(p); x.lineWidth = 2 * Math.max(1, k * 0.7);
      x.fillRect(-r, -r, r * 2, r * 2); x.strokeRect(-r, -r, r * 2, r * 2);
      x.restore();
    }
  }

  dispose() { for (const by of [...this.items.keys()]) this.remove(by); this.el?.remove(); this.beamGeo?.dispose(); this.ringGeo?.dispose(); }
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
