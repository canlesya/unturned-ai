// 12.202 Büyük harita (M) + ölüm doğuş ekranı (Battlefield gibi).
// · M: tam ekran üstten harita — arazi / yapılar / bölge adları, bayraklar (sahip + ilerleme halkası + nabız), iki takımın üssü, takım arkadaşları,
//   manga (yeşil, adlı), görülen / işaretlenen düşmanlar, araçlar, işaretler, kendi konumun + bakış konisi, son 30 sn'lik çatışma yoğunluğu (kırmızı).
//   Haritaya tıklamak işaret koyar (pings.js). Harita açıkken yürünebilir; fare kilitliyse fare haritada sanal imleçtir (bakış dönmez, ateş edilmez).
// · Ölünce aynı harita ölüm ekranının ortasında doğuş seçicidir: üs, takımın bayrakları, manga arkadaşları (uygunsa) tıklanır, "Doğ" ile doğulur
//   (Boşluk da). Geri sayım bitmeden basılırsa hazır bekler; hiç basılmazsa süre bitiminden DEPLOY_AUTO sn sonra seçili noktada kendiliğinden doğulur.
// · Mobil: dokunmatikte harita düğmesi / mini haritaya dokunma (touch.js), haritaya dokunmak işaret, ✕ kapatır.
import { t, lang } from '../i18n/index.js';
import '../i18n/squad.js';
import { clamp } from './util.js';
import { mapName } from '../i18n/data.js';
import { mapText, placeName } from '../i18n/game.js';
import { squadOn, squadMates, SP } from './squad.js';
import { PCOL } from './pings.js';
import { HEAT_SEC } from './heat.js';
import { codeLabel } from '../core/keybinds.js';

export const DEPLOY_AUTO = 10;                    // süre bitiminden sonra "Doğ"a basılmazsa kendiliğinden doğuş (sn; AFK koruması)
const COL = { blue: '#4aa3ff', red: '#ff5a43' };
const CSS = `
#bmap{position:fixed;inset:0;z-index:24;display:none;align-items:center;justify-content:center;background:rgba(4,7,11,.72);font-family:Bahnschrift,'Rajdhani','Arial Narrow',system-ui,sans-serif;color:#e8edf5;user-select:none;-webkit-user-select:none;touch-action:none}
#bmap.on{display:flex}
#bmap .bmf{display:flex;flex-direction:column;width:min(1240px,96vw);height:min(92vh,880px);background:linear-gradient(180deg,rgba(14,19,27,.96),rgba(8,11,17,.96));border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 40px rgba(0,0,0,.6)}
#bmap .bmh{display:flex;align-items:center;gap:14px;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,.08)}
#bmap .bmh b{font-size:18px;letter-spacing:4px;text-transform:uppercase;color:#ff8a1f}
#bmap .bmh .md{font-size:12px;letter-spacing:2px;opacity:.7;text-transform:uppercase}
#bmap .bmh .hn{flex:1;text-align:right;font-size:12px;letter-spacing:1px;opacity:.6}
#bmap .bmh button{all:unset;cursor:pointer;padding:5px 12px;border:1px solid rgba(255,255,255,.2);font-size:12px;letter-spacing:2px;text-transform:uppercase}
#bmap .bmh button:hover{background:rgba(255,255,255,.1)}
#bmap .bmv{flex:1;min-height:0;position:relative}
#bmap .bml{display:flex;flex-wrap:wrap;gap:4px 16px;padding:6px 14px 8px;font-size:11px;letter-spacing:1px;opacity:.8;border-top:1px solid rgba(255,255,255,.06)}
#bmap .bml i{display:inline-block;width:10px;height:10px;margin-right:6px;vertical-align:-1px;border-radius:50%}
#bmap .bml i.d{border-radius:0;transform:rotate(45deg);width:8px;height:8px}
#bmap .bml i.h{background:radial-gradient(circle,rgba(255,50,30,.9),rgba(255,50,30,0) 70%);width:14px;height:14px;vertical-align:-3px}
.bmview{position:absolute;inset:0;overflow:hidden}
.bmview canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block;cursor:crosshair}
#bmcur{position:fixed;z-index:60;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;pointer-events:none;display:none}
#bmcur::before,#bmcur::after{content:'';position:absolute;background:#fff;box-shadow:0 0 0 1px #000}
#bmcur::before{left:10px;top:0;width:2px;height:22px}#bmcur::after{top:10px;left:0;height:2px;width:22px}
#bmcur.on{display:block}
#bmtip{position:fixed;z-index:61;pointer-events:none;display:none;padding:3px 8px;background:rgba(8,11,17,.9);border:1px solid rgba(255,255,255,.2);font:700 12px Bahnschrift,'Arial Narrow',sans-serif;letter-spacing:1px;color:#fff;white-space:nowrap;transform:translate(14px,8px)}
#respawn.dmap .dep{width:min(1320px,97vw)}
#respawn.dmap .deploy{height:min(64vh,620px)}
#respawn.dmap .ccls{flex:none;width:236px;overflow:auto}
#respawn.dmap .clsrow{grid-template-columns:1fr;gap:5px}
#respawn.dmap .clsrow .cc{padding:6px 10px}#respawn.dmap .clsrow .cc small{display:none}#respawn.dmap .clsrow .cc em{margin-top:2px}
#respawn.dmap .cspn{width:220px;overflow:auto}
#respawn .cmap{display:none;flex:1;min-width:0;flex-direction:column;padding:10px 12px}
#respawn.dmap .cmap{display:flex}
#respawn .cmap .dmv{position:relative;flex:1;min-height:0;background:#0b0f15;border:1px solid rgba(255,255,255,.08)}
#respawn .cmap .dmb{display:flex;align-items:center;gap:12px;margin-top:8px}
#respawn .cmap .dsel{flex:1;min-width:0;font-size:15px;font-weight:800;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#respawn .cmap .dsel small{display:block;font-size:11px;letter-spacing:1px;font-weight:600;opacity:.65;text-transform:none}
#respawn .cmap .dgo{pointer-events:auto;cursor:pointer;min-width:170px;padding:11px 22px;font:800 18px Bahnschrift,'Arial Narrow',sans-serif;letter-spacing:4px;text-transform:uppercase;color:#160a02;background:linear-gradient(180deg,#ffa347,#ff8a1f);border:0;box-shadow:0 0 18px rgba(255,138,31,.35)}
#respawn .cmap .dgo.arm{background:linear-gradient(180deg,#8ff08a,#4fd35a);box-shadow:0 0 18px rgba(80,220,90,.4)}
#respawn .cmap .dgo.dis{opacity:.45;filter:grayscale(.6);cursor:default}
#respawn .cmap .dgo small{font-size:12px;letter-spacing:1px;margin-left:6px;opacity:.8}
@media (max-height:520px){
#bmap .bmf{width:100vw;height:100vh;border:0}
#bmap .bmh{padding:4px 10px;gap:8px}#bmap .bmh b{font-size:13px;letter-spacing:2px}#bmap .bmh .hn{font-size:10px}
#bmap .bmh button{padding:6px 12px;font-size:12px}
#bmap .bml{display:none}
#respawn.dmap #rkill,#respawn.dmap #rinfo{display:none}
#respawn.dmap .deploy{height:calc(100vh - 14px)}
#respawn.dmap .ccls{width:128px}
#respawn.dmap .clsrow .cc{min-height:0;padding:4px 7px}#respawn.dmap .clsrow .cc em{display:none}
#respawn.dmap .cspn{display:none}
#respawn .cmap{padding:5px 6px}
#respawn .cmap .dmb{margin-top:4px;gap:8px}
#respawn .cmap .dsel{font-size:12px;letter-spacing:1px}#respawn .cmap .dsel small{font-size:10px}
#respawn .cmap .dgo{min-width:120px;padding:9px 14px;font-size:15px;letter-spacing:2px}
}
`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class BigMap {
  constructor(game) {
    this.g = game; this.open = false; this.mode = null;               // mode: 'map' (M) | 'deploy' (ölüm ekranı)
    this.deployOn = squadOn(game);
    if (!document.getElementById('bmCss')) { const st = document.createElement('style'); st.id = 'bmCss'; st.textContent = CSS; document.head.appendChild(st); }
    const ov = (this.ov = document.createElement('div')); ov.id = 'bmap';
    ov.innerHTML = `<div class="bmf"><div class="bmh"><b></b><span class="md"></span><span class="hn"></span><button class="tm" style="display:none"></button><button class="x">✕</button></div><div class="bmv"></div><div class="bml"></div></div>`;
    document.body.appendChild(ov);
    this.view = document.createElement('div'); this.view.className = 'bmview';
    this.cv = document.createElement('canvas'); this.view.appendChild(this.cv); this.x = this.cv.getContext('2d');
    ov.querySelector('.bmv').appendChild(this.view);
    ov.querySelector('.x').onclick = () => this.toggle(false);
    const tm = ov.querySelector('.tm');
    if (game.online && !game.ffa && !game.mode.infection) { tm.style.display = ''; tm.onclick = () => { this.toggle(false); game.toggleTeamMenu(true); }; }
    ov.addEventListener('pointerdown', (e) => { if (e.target === ov) this.toggle(false); });
    this.cur = document.createElement('div'); this.cur.id = 'bmcur'; document.body.appendChild(this.cur);
    this.tip = document.createElement('div'); this.tip.id = 'bmtip'; document.body.appendChild(this.tip);
    this.cx = innerWidth / 2; this.cy = innerHeight / 2;
    this.cv.addEventListener('pointermove', (e) => { if (document.pointerLockElement) return; this.hoverAt(e.clientX, e.clientY); });
    this.cv.addEventListener('pointerleave', () => { if (!document.pointerLockElement) { this.hover = null; this.tip.style.display = 'none'; } });
    this.cv.addEventListener('pointerdown', (e) => { if (document.pointerLockElement) return; e.preventDefault(); e.stopPropagation(); this.clickAt(e.clientX, e.clientY, e.button); });
    this.cv.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('keydown', this._kd = (e) => {
      if (e.repeat || this.mode !== 'deploy' || this.g.chatOpen) return;
      if (e.code === 'Space') { e.preventDefault(); this.g.requestDeploy(); }
    });
    // ölüm ekranındaki harita kartı (hud.js #respawn .deploy: sınıf | harita | doğuş listesi)
    const dep = game.hud.root.querySelector('#respawn .deploy');
    if (dep && this.deployOn) {
      const c = (this.card = document.createElement('div')); c.className = 'card cmap';
      c.innerHTML = '<h3><span class="dmt" style="opacity:1;letter-spacing:3px;text-transform:uppercase;color:inherit"></span> <span class="dmh"></span></h3><div class="dmv"></div><div class="dmb"><div class="dsel"></div><button class="dgo"></button></div>';
      dep.insertBefore(c, dep.querySelector('.cspn'));
      this.goBtn = c.querySelector('.dgo'); this.selEl = c.querySelector('.dsel');
      this.goBtn.onclick = (e) => { e.stopPropagation(); game.requestDeploy(); };
    }
    this.applyLang();
  }

  applyLang() {
    const g = this.g, ov = this.ov;
    ov.querySelector('.bmh b').textContent = mapName(g.mapDef?.id || g.opts.map);
    ov.querySelector('.tm').textContent = t('sq.teamBtn', { k: codeLabel(g.binds.codes('team')[0]) });
    ov.querySelector('.hn').textContent = t(document.body.classList.contains('mob') ? 'sq.mapHintTouch' : 'sq.mapHint', { k: codeLabel(g.binds.codes('map')[0]) });
    const on = squadOn(g);
    ov.querySelector('.bml').innerHTML = [`<span><i style="background:#ffd23a"></i>${t('sq.lg.me')}</span>`, on ? `<span><i style="background:${PCOL.sq}"></i>${t('sq.lg.squad')}</span>` : '', !g.ffa ? `<span><i style="background:${COL[g.playerSoldier?.team] || COL.blue}"></i>${t('sq.lg.team')}</span>` : '',
      `<span><i style="background:${COL.red};box-shadow:0 0 0 1px #fff"></i>${t('sq.lg.enemy')}</span>`, `<span><i class="d" style="background:${PCOL.me}"></i>${t('sq.lg.ping')}</span>`, `<span><i class="h"></i>${t('sq.lg.heat', { n: HEAT_SEC })}</span>`].join('');
    if (this.card) { this.card.querySelector('.dmt').textContent = t('sq.deployTitle'); this.card.querySelector('.dmh').textContent = t(document.body.classList.contains('mob') ? 'sq.deployHintTouch' : 'sq.deployHint'); }
    this._baseKey = null;
  }

  // M / dokunmatik harita düğmesi
  toggle(on = !(this.open && this.mode === 'map')) {
    if (this.mode === 'deploy') return;                                    // ölüyken harita zaten açık (ölüm ekranında)
    const g = this.g;
    if (on && (g.ended || !g.running)) return;
    this.open = on; this.mode = on ? 'map' : null;
    this.ov.classList.toggle('on', on);
    if (on) { this.ov.querySelector('.bmv').appendChild(this.view); this.cx = innerWidth / 2; this.cy = innerHeight / 2; this.applyLang(); g.player && (g.player.fireHeld = false); }
    this.cur.classList.toggle('on', on && !!document.pointerLockElement);
    if (!on) { this.tip.style.display = 'none'; this.hover = null; }
  }

  enterDeploy() {
    if (this.mode === 'map') this.toggle(false);
    this.mode = 'deploy'; this.open = true;
    this.card.querySelector('.dmv').appendChild(this.view);
    this.g.hud.$('respawn').classList.add('dmap');
    this.cx = innerWidth / 2; this.cy = innerHeight / 2;
    this._baseKey = null;
  }
  exitDeploy() {
    this.mode = null; this.open = false;
    this.g.hud.$('respawn').classList.remove('dmap');
    this.cur.classList.remove('on'); this.tip.style.display = 'none'; this.hover = null;
  }

  // Player (fare kilitliyken): harita açık → fare sanal imleç
  moveCursor(dx, dy) {
    this.cx = clamp(this.cx + dx, 0, innerWidth - 1); this.cy = clamp(this.cy + dy, 0, innerHeight - 1);
    this.cur.style.left = this.cx + 'px'; this.cur.style.top = this.cy + 'px';
    this.cur.classList.add('on');
    this.hoverAt(this.cx, this.cy);
  }
  // Fare kilitliyken tık: imlecin altındaki öğe (harita / sınıf kartı / Doğ / doğuş listesi / düğme)
  lockedClick(button) {
    this.cur.style.display = 'none'; const el = document.elementFromPoint(this.cx, this.cy); this.cur.style.display = '';
    if (!el) return;
    if (el === this.cv) { this.clickAt(this.cx, this.cy, button); return; }
    const b = el.closest('button, .cc, [data-k]');
    if (b && button === 0) b.click();
  }

  // ── koordinat dönüşümü (CSS pikseli, canvas'a göre) ──
  area() {
    const g = this.g, b = g.map.bounds, A = g.map.playArea;
    if (!A) return b;
    const mx = (A.maxX - A.minX) * 0.06, mz = (A.maxZ - A.minZ) * 0.06;
    return { minX: Math.max(b.minX, A.minX - mx), maxX: Math.min(b.maxX, A.maxX + mx), minZ: Math.max(b.minZ, A.minZ - mz), maxZ: Math.min(b.maxZ, A.maxZ + mz) };
  }
  fit(W, H) {
    const a = this.area(), pad = 12 * this.dpr, bw = a.maxX - a.minX, bh = a.maxZ - a.minZ;
    const s = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh);
    const ox = (W - bw * s) / 2 - a.minX * s, oy = (H - bh * s) / 2 - a.minZ * s;
    this.s = s; this.X = (x) => ox + x * s; this.Y = (z) => oy + z * s;
    this.IX = (px) => (px - ox) / s; this.IZ = (py) => (py - oy) / s;
  }
  local(clientX, clientY) { const r = this.cv.getBoundingClientRect(); return [(clientX - r.left) * this.dpr, (clientY - r.top) * this.dpr, r]; }

  // ── doğuş hedefleri (ölüm ekranı) ──
  baseAt(team) { const P = this.g.map.spawns[team] || []; if (!P.length) return null; let x = 0, z = 0; for (const p of P) { x += p.x; z += p.z; } return { x: x / P.length, z: z / P.length }; }
  targets() {
    const g = this.g, me = g.playerSoldier, out = [];
    if (!me || !this.deployOn) return out;
    for (const o of g.spawnOptions()) {
      if (o.id === 'base') { const b = this.baseAt(me.team); if (b) out.push({ ...o, kind: 'base', x: b.x, z: b.z }); }
      else if (o.id === 'front') continue;                                  // ön hat: yalnız listede (bayraklar arasından sunucu seçer)
      else if (o.mate) out.push({ ...o, kind: 'mate', x: o.mate.pos.x, z: o.mate.pos.z });
      else { const ob = g.mode.objectives.find((q) => q.id === o.id); if (ob) out.push({ ...o, kind: 'flag', x: ob.x, z: ob.z }); }
    }
    return out;
  }
  pick(clientX, clientY) {
    const [px, py] = this.local(clientX, clientY), R = 22 * this.dpr;
    let best = null, bd = R;
    for (const tg of this.mode === 'deploy' ? this.targets() : []) { const d = Math.hypot(this.X(tg.x) - px, this.Y(tg.z) - py); if (d < bd) { bd = d; best = tg; } }
    return best;
  }
  hoverAt(cx, cy) {
    if (!this.open || !this.X) return;
    const r = this.cv.getBoundingClientRect(), inside = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
    const tg = inside ? this.pick(cx, cy) : null;
    this.hover = tg;
    if (!tg) { this.tip.style.display = 'none'; return; }
    this.tip.style.display = 'block'; this.tip.style.left = cx + 'px'; this.tip.style.top = cy + 'px';
    this.tip.textContent = `${this.label(tg)} · ${tg.ok ? t('sq.canSpawn') : this.why(tg)}`;
  }
  label(o) { return o.kind === 'base' || o.id === 'base' ? '⌂ ' + t('death.base') : o.mate || o.kind === 'mate' ? '◆ ' + o.name : o.id === 'front' ? '▲ ' + placeName(o.name) : '⚑ ' + placeName(o.name); }
  why(o) {
    if (o.mate) return t('sq.st.' + (o.st ?? SP.DEAD));
    return t('death.unavail');
  }
  clickAt(cx, cy, button = 0) {
    const g = this.g;
    if (button === 2) return;
    const r = this.cv.getBoundingClientRect();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return;
    const tg = this.pick(cx, cy);
    if (tg) {
      if (tg.ok) { g.requestSpawn(tg.id); g.sfx?.ui?.('click'); } else g.hud.toast(`${this.label(tg)}: ${this.why(tg)}`, '#ffb38a');
      return;
    }
    const [px, py] = this.local(cx, cy);
    const a = this.area(), x = this.IX(px), z = this.IZ(py);
    if (x < a.minX || x > a.maxX || z < a.minZ || z > a.maxZ) return;
    g.pings?.mapPing(x, z);
  }

  // ── her kare (Hud.update) ──
  update() {
    const g = this.g, me = g.playerSoldier;
    if (!me) return;
    const rs = g.hud.$('respawn'), dead = this.deployOn && !me.alive && !g.ended && rs.style.display === 'flex';
    if (dead && this.mode !== 'deploy') this.enterDeploy();
    else if (!dead && this.mode === 'deploy') this.exitDeploy();
    if (this.mode === 'map' && g.ended) this.toggle(false);
    if (!this.open) return;
    this.cur.classList.toggle('on', !!document.pointerLockElement);
    if (document.pointerLockElement) { this.cur.style.left = this.cx + 'px'; this.cur.style.top = this.cy + 'px'; }
    this.draw();
    if (this.mode === 'deploy') this.deployBar();
  }

  deployBar() {
    const g = this.g, me = g.playerSoldier, opts = g.spawnOptions(), sel = opts.find((o) => o.id === g.spawnChoice) || opts[0];
    const rt = me.respawnT || 0, ok = !!sel?.ok, armed = !!g.deployArmed();
    const n = Math.ceil(Math.max(0, rt)), auto = Math.ceil(DEPLOY_AUTO + Math.min(0, rt));
    const lbl = rt > 0 ? `${armed ? t('sq.ready') : t('sq.deploy')}<small>${n}</small>` : armed ? t('sq.deploying') : `${t('sq.deploy')}${auto > 0 ? `<small>${t('sq.autoIn', { n: auto })}</small>` : ''}`;
    if (this.goBtn._h !== lbl) { this.goBtn._h = lbl; this.goBtn.innerHTML = lbl; }
    this.goBtn.classList.toggle('arm', armed); this.goBtn.classList.toggle('dis', !ok);
    const sub = sel ? (sel.ok ? (sel.mate ? t('sq.mateOk') : sel.id === 'base' ? t('death.baseSafe') : t('death.flagOwned')) : this.why(sel)) : '';
    const h = sel ? `${esc(this.label(sel))}<small>${esc(sub)}</small>` : '';
    if (this.selEl._h !== h) { this.selEl._h = h; this.selEl.innerHTML = h; }
  }

  // ── çizim ──
  resize() {
    const r = this.view.getBoundingClientRect(), dpr = (this.dpr = Math.min(1.5, devicePixelRatio || 1));
    const W = Math.max(50, Math.round(r.width * dpr)), H = Math.max(50, Math.round(r.height * dpr));
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; this._baseKey = null; }
    return [W, H];
  }

  buildBase(W, H) {
    const g = this.g, key = W + 'x' + H + '|' + lang();
    if (this._baseKey === key) return;
    this._baseKey = key;
    this.fit(W, H);
    const c = (this.base ||= document.createElement('canvas')); c.width = W; c.height = H;
    const x = c.getContext('2d'), a = this.area(), s = this.s, X = this.X, Y = this.Y, mini = g.map.mini;
    x.fillStyle = '#0b0f15'; x.fillRect(0, 0, W, H);
    const rx = X(a.minX), ry = Y(a.minZ), rw = (a.maxX - a.minX) * s, rh = (a.maxZ - a.minZ) * s;
    x.fillStyle = mini ? mini.bg : '#6d8a45'; x.fillRect(rx, ry, rw, rh);
    if (g.terrain) {                                                            // arazi: düşük çözünürlükte gölgeli renk, büyütülerek
      const T = g.terrain, gw = Math.max(40, Math.min(360, Math.round(rw / 2))), gh = Math.max(30, Math.round(gw * rh / rw));
      const tc = document.createElement('canvas'); tc.width = gw; tc.height = gh;
      const tx = tc.getContext('2d'), img = tx.createImageData(gw, gh), st = (a.maxX - a.minX) / gw;
      for (let py = 0; py < gh; py++) for (let px = 0; px < gw; px++) {
        const wx = a.minX + (px + 0.5) * st, wz = a.minZ + (py + 0.5) / gh * (a.maxZ - a.minZ), h = T.heightAt(wx, wz), e = Math.max(1.2, st * 0.6);
        const dx = T.heightAt(wx + e, wz) - T.heightAt(wx - e, wz), dz = T.heightAt(wx, wz + e) - T.heightAt(wx, wz - e);
        const sh = clamp(0.95 + (-dx - dz) * 0.09 * (1.2 / e), 0.55, 1.3);
        let r, gg, b;
        if (h < -0.25 || (T.waterY != null && h < T.waterY)) [r, gg, b] = mini?.pit || [74, 144, 184];
        else if (mini) { const k = clamp(h / 5, 0, 1), s2 = 0.9 + (sh - 0.95) * 0.5; r = (mini.ground[0] - 14 * k) * s2; gg = (mini.ground[1] - 14 * k) * s2; b = (mini.ground[2] - 16 * k) * s2; }
        else { const k = clamp(h / 14, 0, 1); r = (109 + 50 * k) * sh; gg = (138 + 6 * k) * sh; b = (69 + 30 * k) * sh; }
        const o = (py * gw + px) * 4; img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
      }
      tx.putImageData(img, 0, 0);
      x.imageSmoothingEnabled = true; x.drawImage(tc, rx, ry, rw, rh);
    }
    x.fillStyle = g.map.roadColor || '#4b4f57';
    for (const r of g.map.roads || []) x.fillRect(X(r.x0), Y(r.z0), Math.max(1, (r.x1 - r.x0) * s), Math.max(1, (r.z1 - r.z0) * s));
    for (const cl of g.map.colliders) {
      const w = cl.max[0] - cl.min[0], d = cl.max[2] - cl.min[2], h = cl.max[1] - cl.min[1];
      if (cl.max[1] < 0.5 || w > 60 || d > 60) continue;
      if (mini && cl.tag === 'roof') x.fillStyle = mini.roof;
      else x.fillStyle = mini ? (h > 4 && (w > 3 || d > 3) ? mini.wall : h > 1.5 ? mini.mid : mini.low) : h > 4 && (w > 3 || d > 3) ? '#d6cfba' : h > 1.5 ? '#9c9482' : '#7a7566';
      x.fillRect(X(cl.min[0]), Y(cl.min[2]), Math.max(1, w * s), Math.max(1, d * s));
    }
    const A = g.map.playArea;
    if (A) { x.setLineDash([8 * this.dpr, 6 * this.dpr]); x.strokeStyle = 'rgba(255,90,60,.7)'; x.lineWidth = 2 * this.dpr; x.strokeRect(X(A.minX), Y(A.minZ), (A.maxX - A.minX) * s, (A.maxZ - A.minZ) * s); x.setLineDash([]); }
    // üs bölgeleri (girilmez): takım renginde soluk alan
    const Z = g.map.baseZones;
    if (Z) for (const tm of ['blue', 'red']) { const z = Z[tm]; if (!z) continue; x.fillStyle = tm === 'blue' ? 'rgba(74,163,255,.12)' : 'rgba(255,90,67,.12)'; x.strokeStyle = tm === 'blue' ? 'rgba(74,163,255,.5)' : 'rgba(255,90,67,.5)'; x.lineWidth = 1.5 * this.dpr; x.fillRect(X(z.minX), Y(z.minZ), (z.maxX - z.minX) * s, (z.maxZ - z.minZ) * s); x.strokeRect(X(z.minX), Y(z.minZ), (z.maxX - z.minX) * s, (z.maxZ - z.minZ) * s); }
    // bölge adları (tümü; ana bölgeler büyük)
    if (g.map.callouts) {
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
      const D = this.dpr, big = Math.max(11, Math.min(15, s * 4)), sm = Math.max(9, Math.min(12, s * 3));
      const flagsAt = g.mode.objectives.map((o) => [X(o.x), Y(o.z)]);
      for (const cl of g.map.callouts) {
        const px = X(cl.x), py = Y(cl.z), nm = mapText(cl.name);
        if (!cl.major && flagsAt.some(([fx, fy]) => Math.hypot(fx - px, fy - py) < 18 * D)) continue;       // bayrağın üstündeki ad bayrak etiketinde
        x.font = `${cl.major ? 800 : 600} ${(cl.major ? big : sm) * D}px Bahnschrift, Arial Narrow, sans-serif`;
        x.lineWidth = 3 * D; x.strokeStyle = 'rgba(12,10,6,.78)'; x.fillStyle = cl.major ? '#fff6dc' : 'rgba(255,248,226,.86)';
        x.strokeText(nm, px, py); x.fillText(nm, px, py);
      }
    }
  }

  draw() {
    const g = this.g, me = g.playerSoldier, [W, H] = this.resize();
    this.buildBase(W, H);
    this.fit(W, H);
    const x = this.x, X = this.X, Y = this.Y, D = this.dpr, now = performance.now();
    x.clearRect(0, 0, W, H);
    x.drawImage(this.base, 0, 0);
    // çatışma yoğunluğu
    if (g.heat) {
      const R = Math.max(14 * D, 11 * this.s), spr = this.blob();
      for (const [hx, hz, k] of g.heat.list(g.time)) { x.globalAlpha = Math.min(0.85, 0.25 + k * 0.6); x.drawImage(spr, X(hx) - R, Y(hz) - R, R * 2, R * 2); }
      x.globalAlpha = 1;
    }
    const team = me.team, sqOn = squadOn(g);
    // üsler
    if (!g.ffa && !g.mode.infection) for (const tm of ['blue', 'red']) {
      const b = this.baseAt(tm); if (!b) continue;
      const px = X(b.x), py = Y(b.z), r = 11 * D;
      x.fillStyle = tm === 'blue' ? 'rgba(74,163,255,.85)' : 'rgba(255,90,67,.85)'; x.strokeStyle = '#fff'; x.lineWidth = 1.5 * D;
      x.fillRect(px - r, py - r, r * 2, r * 2); x.strokeRect(px - r, py - r, r * 2, r * 2);
      x.fillStyle = '#fff'; x.font = `800 ${11 * D}px Bahnschrift, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('⌂', px, py + 0.5 * D);
      x.font = `700 ${10 * D}px Bahnschrift, sans-serif`; x.lineWidth = 3 * D; x.strokeStyle = 'rgba(0,0,0,.7)';
      const lb = tm === team ? t('sq.ourBase') : t('sq.enemyBase'); x.strokeText(lb, px, py + r + 9 * D); x.fillText(lb, px, py + r + 9 * D);
    }
    // bayraklar
    for (const o of g.mode.objectives) {
      const px = X(o.x), py = Y(o.z), r = 13 * D, st = g.hud.cap?.flagState(o), pd = o.pd ?? o.p;
      if (o.r && o.r * this.s > r * 1.2) { x.beginPath(); x.arc(px, py, o.r * this.s, 0, 6.3); x.fillStyle = o.owner === 'blue' ? 'rgba(74,163,255,.14)' : o.owner === 'red' ? 'rgba(255,90,67,.14)' : 'rgba(255,255,255,.08)'; x.fill(); }
      if (st && (st.cap || st.ctd)) { const k = (now / 700) % 1; x.beginPath(); x.arc(px, py, r + 3 * D + k * 10 * D, 0, 6.3); x.strokeStyle = st.ctd ? `rgba(255,207,90,${1 - k})` : st.rate > 0 ? `rgba(74,163,255,${1 - k})` : `rgba(255,90,67,${1 - k})`; x.lineWidth = 2.5 * D; x.stroke(); }
      x.beginPath(); x.arc(px, py, r, 0, 6.3);
      x.fillStyle = o.owner === 'blue' ? '#2f7fd8' : o.owner === 'red' ? '#d8452f' : 'rgba(40,46,56,.92)'; x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 1.6 * D; x.stroke();
      if (Math.abs(pd) > 0.015 && Math.abs(pd) < 0.999) { x.beginPath(); const a0 = -Math.PI / 2, aa = Math.abs(pd) * Math.PI * 2; if (pd > 0) x.arc(px, py, r + 3 * D, a0, a0 + aa); else x.arc(px, py, r + 3 * D, a0 - aa, a0); x.strokeStyle = pd > 0 ? COL.blue : COL.red; x.lineWidth = 4 * D; x.stroke(); }
      x.fillStyle = '#fff'; x.font = `800 ${13 * D}px Bahnschrift, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(o.label || o.name[0], px, py + 0.5 * D);
      const nm = placeName(o.name); x.font = `700 ${10.5 * D}px Bahnschrift, sans-serif`; x.lineWidth = 3 * D; x.strokeStyle = 'rgba(0,0,0,.75)'; x.fillStyle = '#fff';
      x.strokeText(nm, px, py + r + 10 * D); x.fillText(nm, px, py + r + 10 * D);
    }
    // araçlar (mini haritayla aynı kural: dost / boş hep, düşman görüldüyse)
    if (g.vehicles) for (const v of g.vehicles.list) {
      if (!v.alive || !v.st) continue;
      const occ = v.seats.filter(Boolean), tm = occ.length ? occ[0].team : v.paint;
      if (tm && tm !== team && !occ.some((o) => g.time - (o.spottedT ?? -99) < 2.5)) continue;
      x.save(); x.translate(X(v.st.x), Y(v.st.z)); x.rotate(-v.st.yaw);
      const w = Math.max(4.5 * D, 2.4 * this.s), h = Math.max(8 * D, 4.4 * this.s);
      x.fillStyle = tm === 'blue' ? '#4aa3ff' : tm === 'red' ? '#ff5a43' : '#d8d4c4'; x.strokeStyle = occ.some((o) => o.team === team && o.squad === me.squad && sqOn) ? PCOL.sq : occ.length ? '#fff' : '#0009'; x.lineWidth = 1.5 * D;
      x.fillRect(-w / 2, -h / 2, w, h); x.strokeRect(-w / 2, -h / 2, w, h); x.restore();
    }
    // askerler
    const labels = [];
    for (const s of g.soldiers) {
      if (!s.alive || s.vacant || s === me || s.veh) continue;
      const fr = s.team === team && !g.ffa, mate = fr && sqOn && s.squad === me.squad;
      if (!fr && !(g.time - (s.spottedT ?? -99) < 2.5)) continue;
      const px = X(s.pos.x), py = Y(s.pos.z);
      x.beginPath(); x.arc(px, py, (mate ? 4.6 : 3.4) * D, 0, 6.3);
      x.fillStyle = mate ? PCOL.sq : s.team === 'blue' ? COL.blue : COL.red; x.fill();
      x.strokeStyle = fr ? 'rgba(0,0,0,.6)' : '#fff'; x.lineWidth = (fr ? 1 : 1.6) * D; x.stroke();
      if (mate) labels.push([s.name, px, py]);
    }
    x.font = `700 ${10.5 * D}px Bahnschrift, sans-serif`; x.textAlign = 'left'; x.textBaseline = 'middle'; x.lineWidth = 3 * D; x.strokeStyle = 'rgba(0,0,0,.8)'; x.fillStyle = PCOL.sq;
    for (const [nm, px, py] of labels) { x.strokeText(nm, px + 7 * D, py); x.fillText(nm, px + 7 * D, py); }
    g.pings?.drawMap(x, X, Y, 1.3 * D);
    // doğuş hedefleri
    if (this.mode === 'deploy') this.drawTargets(x, D, now);
    // ben: bakış konisi + ok
    if (me.alive || this.mode === 'map') {
      const px = X(me.pos.x), py = Y(me.pos.z), fa = Math.atan2(-Math.cos(me.yaw), -Math.sin(me.yaw));      // ekranda bakış açısı (x sağ, z aşağı)
      const L = 70 * D, sp = 0.5;
      const gr = x.createRadialGradient(px, py, 0, px, py, L); gr.addColorStop(0, 'rgba(255,230,140,.38)'); gr.addColorStop(1, 'rgba(255,230,140,0)');
      x.beginPath(); x.moveTo(px, py); x.arc(px, py, L, fa - sp, fa + sp); x.closePath(); x.fillStyle = gr; x.fill();
      x.save(); x.translate(px, py); x.rotate(-me.yaw);
      x.fillStyle = '#ffd23a'; x.strokeStyle = '#000'; x.lineWidth = 1.3 * D;
      x.beginPath(); x.moveTo(0, -9 * D); x.lineTo(6.5 * D, 7 * D); x.lineTo(0, 3.5 * D); x.lineTo(-6.5 * D, 7 * D); x.closePath(); x.fill(); x.stroke();
      x.restore();
    }
  }

  drawTargets(x, D, now) {
    const g = this.g, X = this.X, Y = this.Y, pul = 0.5 + 0.5 * Math.sin(now / 220);
    for (const tg of this.targets()) {
      const px = X(tg.x), py = Y(tg.z), sel = g.spawnChoice === tg.id, hov = this.hover?.id === tg.id;
      const r = (tg.kind === 'mate' ? 9 : tg.kind === 'base' ? 17 : 19) * D;
      if (tg.kind === 'mate') {
        x.save(); x.translate(px, py); x.rotate(Math.PI / 4);
        x.fillStyle = tg.ok ? PCOL.sq : 'rgba(120,120,120,.85)'; x.strokeStyle = sel ? '#ff8a1f' : '#fff'; x.lineWidth = (sel ? 3 : 1.5) * D;
        x.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); x.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); x.restore();
        if (!tg.ok) { x.font = `800 ${10 * D}px Bahnschrift, sans-serif`; x.textAlign = 'center'; x.fillStyle = '#ff9a80'; x.lineWidth = 3 * D; x.strokeStyle = 'rgba(0,0,0,.8)'; const s = t('sq.st.' + (tg.st ?? SP.DEAD)); x.strokeText(s, px, py - r - 6 * D); x.fillText(s, px, py - r - 6 * D); }
      } else if (tg.ok) {
        x.beginPath(); x.arc(px, py, r + (sel ? pul * 4 * D : 0), 0, 6.3); x.strokeStyle = sel ? '#ff8a1f' : hov ? '#fff' : 'rgba(140,255,150,.75)'; x.lineWidth = (sel ? 3.5 : 2) * D;
        if (!sel) x.setLineDash([5 * D, 4 * D]); x.stroke(); x.setLineDash([]);
      }
      if (sel) {
        x.font = `800 ${11 * D}px Bahnschrift, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        const s = t('sq.spawnHere'), w = x.measureText(s).width + 12 * D, yy = py - r - 16 * D;
        x.fillStyle = '#ff8a1f'; x.fillRect(px - w / 2, yy - 8 * D, w, 16 * D); x.fillStyle = '#160a02'; x.fillText(s, px, yy + 0.5 * D);
      }
    }
  }

  // ısı lekesi: kırmızı ışınsal geçiş (bir kez)
  blob() {
    if (this._blob) return this._blob;
    const c = (this._blob = document.createElement('canvas')); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,60,30,.75)'); gr.addColorStop(0.45, 'rgba(255,40,20,.4)'); gr.addColorStop(1, 'rgba(255,30,10,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return c;
  }

  dispose() { removeEventListener('keydown', this._kd); this.ov.remove(); this.cur.remove(); this.tip.remove(); this.card?.remove(); }
}
