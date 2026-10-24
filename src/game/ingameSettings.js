// Oyun içi Ayarlar / Kontroller paneli (Esc → duraklatma menüsü → "Ayarlar" ya da "Kontroller").
// Ana menüdeki Ayarlar + Kontroller ekranlarının tamamı; değişiklikler maç sırasında ANINDA uygulanır ve tercihlere (localStorage) kaydedilir
// (game.opts.onPref → menu.patchPrefs). Tuş atama: tıkla → yeni tuşa bas · Geri tuşu temizler · Esc vazgeçer.
import { Binds, ACTIONS, GROUPS, codeLabel, RESERVED, norm } from '../core/keybinds.js';
import { music } from './music.js';
import { t, lang, setLang, LANGS, onLang } from '../i18n/index.js';

const CSS = `
#igs{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(5,8,12,.6),rgba(5,8,12,.86));pointer-events:auto;z-index:30}
#igs .box{width:min(880px,94vw);max-height:88vh;display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(15,20,29,.98),rgba(9,12,18,.98));border:1px solid rgba(255,255,255,.12);border-top:3px solid #ff8a1f;box-shadow:0 18px 60px rgba(0,0,0,.65);clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,0 100%)}
#igs .hd{display:flex;align-items:center;gap:6px;padding:16px 22px 12px;border-bottom:1px solid rgba(255,255,255,.08)}
#igs .hd h2{margin:0 18px 0 0;font-size:26px;letter-spacing:4px;text-transform:uppercase;font-style:italic}
#igs .tab{cursor:pointer;background:transparent;color:#cfd6e2;border:0;border-bottom:3px solid transparent;padding:8px 16px;font:inherit;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
#igs .tab:hover{color:#fff;background:rgba(255,255,255,.05)}
#igs .tab.on{color:#ffb347;border-bottom-color:#ff8a1f;background:rgba(255,138,31,.08)}
#igs .x{margin-left:auto;cursor:pointer;background:#26303e;color:#e8edf5;border:0;padding:8px 18px;font:inherit;font-weight:800;letter-spacing:2px;text-transform:uppercase;clip-path:polygon(0 0,100% 0,calc(100% - 8px) 100%,0 100%)}
#igs .x:hover{background:#334052}
#igs .sc{overflow-y:auto;padding:6px 22px 20px}
#igs .pan{border-top:1px solid rgba(255,255,255,.06);padding:12px 0 6px}#igs .pan:first-child{border-top:0}
#igs h3{margin:0 0 8px;font-size:12px;letter-spacing:3px;color:#ffb347;text-transform:uppercase;display:flex;align-items:center;gap:8px}
#igs h3::before{content:'';width:8px;height:8px;background:#ff8a1f;transform:skewX(-18deg)}
#igs .sr{display:grid;grid-template-columns:220px 1fr 70px;align-items:center;gap:12px;margin:6px 0;font-size:14px}
#igs .sr em{font-style:normal;text-align:right;opacity:.9;font-variant-numeric:tabular-nums;color:#ffe2bd}
#igs input[type=range]{width:100%;accent-color:#ff9a2e}
#igs .row{display:flex;flex-wrap:wrap;gap:6px}
#igs .chip{cursor:pointer;background:#1a212c;color:#dde3ec;border:1px solid rgba(255,255,255,.12);padding:7px 14px;font:inherit;font-size:13px;transition:.12s}
#igs .chip:hover{border-color:rgba(255,255,255,.3)}
#igs .chip.on{border-color:#ff9a2e;color:#ffb347;background:linear-gradient(180deg,rgba(255,138,31,.2),rgba(255,138,31,.07))}
#igs .hint{font-size:12px;opacity:.65;margin:6px 0 2px;line-height:1.45}
#igs .kb{display:grid;grid-template-columns:1fr 120px 120px;gap:6px;align-items:center;font-size:13.5px;margin:2px 0;padding:2px 6px}
#igs .kb:nth-child(even){background:rgba(255,255,255,.025)}
#igs .kk{cursor:pointer;background:#1a212c;color:#e8edf5;border:1px solid rgba(255,255,255,.14);border-bottom-width:3px;padding:4px 8px;font:inherit;font-size:13px;font-weight:700}
#igs .kk:hover{border-color:rgba(255,255,255,.35)}
#igs .kk.cap{border-color:#ff9a2e;color:#ffb347;animation:igsb .8s infinite alternate}
@keyframes igsb{to{background:#2a2014}}
#igs .msg{color:#ffb347;font-size:12.5px;margin-top:6px}
/* dokunmatik: dokunma hedefleri ≥ 40 px, kısa ekranda tam yükseklik */
body.mob #igs .box{max-height:96vh;width:min(880px,96vw)}
body.mob #igs .hd{padding:6px 14px 4px}body.mob #igs .hd h2{font-size:20px;margin-right:10px}
body.mob #igs .tab,body.mob #igs .x,body.mob #igs .chip,body.mob #igs .kk{min-height:40px;min-width:44px}
body.mob #igs .sc{padding:4px 14px 14px}
body.mob #igs .sr{grid-template-columns:150px 1fr 56px;margin:0}
body.mob #igs input[type=range]{height:40px;margin:0}
`;

export class InGameSettings {
  constructor(game) {
    this.g = game; this.tab = 'settings'; this.cap = null; this.msg = '';
    const st = (this.st = document.createElement('style')); st.textContent = CSS; document.head.appendChild(st);
    const el = (this.el = document.createElement('div')); el.id = 'igs';
    game.hud.root.appendChild(el);
    el.addEventListener('mousedown', (e) => { e.stopPropagation(); if (e.target === el) this.close(); });
    el.addEventListener('click', (e) => this.onClick(e));
    el.addEventListener('input', (e) => this.onInput(e));
    this._key = (e) => this.onKey(e);
    this._offLang = onLang(() => { if (this.open) this.render(); });          // dil değişince panel yeniden yazılır
    window.addEventListener('keydown', this._key, true);       // yakalama: oyun tuşlarına sızmasın
  }

  get open() { return this.el.style.display === 'flex'; }
  show(tab = 'settings') { this.tab = tab; this.cap = null; this.msg = ''; this.render(); this.el.style.display = 'flex'; }
  close() { this.cap = null; this.el.style.display = 'none'; }

  save(o) { this.g.opts.onPref?.(o); }

  // ── uygulama: her ayar oyunda hemen etkili ──
  set(key, v) {
    const g = this.g, s = g.settings;
    switch (key) {
      case 'sens': s.sens = v; this.save({ sens: v }); break;
      case 'fov': s.fov = v; this.save({ [mob() ? 'fovM' : 'fov']: v }); break;                 // dokunmatikte yatay FOV, ayrı tercih (menu.js FOV_KEY)
      case 'volume': case 'vSfx': case 'vMusic': case 'vAmb': case 'rainSound':
        s[key] = v; this.save({ [key]: v });
        g.sfx?.setVolume?.(s.volume ?? 0.6);
        g.sfx?.setMix?.({ sfx: s.vSfx ?? 1, amb: s.vAmb ?? 1, rain: s.rainSound !== false });
        music.setVolume((s.volume ?? 0.6) * (s.vMusic ?? 0.5));
        break;
      case 'quality': {
        s.pixelRatio = v; this.save({ [mob() ? 'qualityM' : 'quality']: v });
        const r = g.renderer, pr = Math.min(devicePixelRatio, v);
        if (g._perf) { g._perf.max = pr; g._perf.ratio = pr; }
        r?.setPixelRatio(pr); r?.setSize(innerWidth, innerHeight, false);
        g.applyGfx?.();                                                         // gölge haritası / yumuşaklık / son işleme kademesi
        break;
      }
      case 'post': {
        s.post = v; this.save({ post: v }); g.applyGfx?.();
        break;
      }
      case 'shadows':
        s.shadows = v; this.save({ shadows: v });
        if (g.renderer) { g.renderer.shadowMap.enabled = v; g.renderer.shadowMap.needsUpdate = true; }
        g.scene?.traverse((o) => { const m = o.material; if (!m) return; for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true; });
        break;
      case 'streakSound': s.streakSound = v; this.save({ streakSound: v }); break;          // seri sesleri (killfx.js / streakSfx.js)
      case 'adaptive': s.adaptive = v; this.save({ adaptive: v }); break;
      case 'fullscreen': s.fullscreen = v; this.save({ fullscreen: v }); break;
      case 'leftHand': g.leftHand = v; this.save({ leftHand: v }); break;
      case 'adsToggle': g.opts.adsToggle = v; this.save({ adsToggle: v }); break;
    }
  }
  saveKeys() { this.g.opts.keys = this.g.binds.toJSON(); this.save({ keys: this.g.opts.keys }); }

  // ── görünüm ──
  render() {
    const g = this.g, s = g.settings;
    const sl = (id, label, min, max, step, v, fmt) => `<div class="sr"><span>${label}</span><input type="range" data-k="${id}" min="${min}" max="${max}" step="${step}" value="${v}"><em id="igv_${id}">${fmt(v)}</em></div>`;
    const ch = (k, v, on, label) => `<button class="chip ${on ? 'on' : ''}" data-k="${k}" data-v="${v}">${label}</button>`;
    let body;
    if (this.tab === 'settings') {
      const q = s.pixelRatio || 1;
      body = `<div class="pan"><h3>${t('set.lang')}</h3><div class="row">${LANGS.map(([l, n]) => ch('lang', l, lang() === l, n)).join('')}</div></div>
        <div class="pan"><h3>${t('set.mouse')}</h3>
        ${sl('sens', t('set.sens'), 0.0008, 0.006, 0.0001, s.sens ?? 0.0022, FMT.sens)}
        ${mob() ? sl('fov', t('set.fovH'), 70, 110, 1, s.fov ?? 80, FMT.fov) : sl('fov', t('set.fov'), 60, 100, 1, s.fov ?? 80, FMT.fov)}</div>
        <div class="pan"><h3>${t('set.sound')}</h3>
        ${sl('volume', t('set.vol'), 0, 1, 0.05, s.volume ?? 0.6, FMT.pct)}
        ${sl('vSfx', t('set.sfx'), 0, 1, 0.05, s.vSfx ?? 1, FMT.pct)}
        ${sl('vMusic', t('set.music'), 0, 1, 0.05, s.vMusic ?? 0.5, FMT.pct)}
        ${sl('vAmb', t('set.amb'), 0, 1, 0.05, s.vAmb ?? 1, FMT.pct)}
        <div class="row" style="margin-top:6px">${ch('rainSound', s.rainSound === false ? 1 : 0, s.rainSound !== false, `${t('set.rain')}: ${onoff(s.rainSound !== false)}`)}${ch('streakSound', s.streakSound === false ? 1 : 0, s.streakSound !== false, `${t('set.streak')}: ${onoff(s.streakSound !== false)}`)}</div></div>
        <div class="pan"><h3>${t('set.gfx')}</h3><div class="row">
        ${[[1, 'set.low'], [1.5, 'set.mid'], [2, 'set.high']].map(([v, l]) => ch('quality', v, q === v, t(l))).join('')}
        ${ch('shadows', s.shadows === false ? 1 : 0, s.shadows !== false, `${t('set.shadows')}: ${onoff(s.shadows !== false)}`)}
        ${ch('post', postOn(s) ? 0 : 1, postOn(s), `${t('set.post')}: ${onoff(postOn(s))}`)}
        ${ch('adaptive', s.adaptive === false ? 1 : 0, s.adaptive !== false, `${t('set.adaptive')}: ${onoff(s.adaptive !== false)}`)}
        ${ch('fullscreen', s.fullscreen === false ? 1 : 0, s.fullscreen !== false, `${t('set.fs')}: ${onoff(s.fullscreen !== false)}`)}</div>
        <div class="hint">${t('set.gfxHint')}</div></div>`;
    } else {
      const kb = g.binds, cap = this.cap;
      const keyRows = GROUPS.map((gr, gi) => `<div class="pan"><h3>${tg(`set.grp.${gi}`, gr)}</h3>${ACTIONS.filter((a) => a.group === gi).map((a) => `<div class="kb"><span>${actLabel(a)}</span>${[0, 1].map((sl2) => {
        const on = cap && cap.id === a.id && cap.slot === sl2;
        return `<button class="kk ${on ? 'cap' : ''}" data-bind="${a.id}" data-slot="${sl2}">${on ? t('set.press') : keyLabel(kb.codes(a.id)[sl2])}</button>`;
      }).join('')}</div>`).join('')}</div>`).join('');
      const touchPan = mob() ? `<div class="pan"><h3>${t('set.touch')}</h3><div class="row"><button class="chip" data-k="touchEd" data-v="1">${t('set.touchBtn')}</button></div><div class="hint">${t('set.touchHint')}</div></div>` : '';
      body = `${touchPan}<div class="pan"><h3>${t('set.hand')}</h3><div class="row">${ch('leftHand', 0, !g.leftHand, t('set.right'))}${ch('leftHand', 1, !!g.leftHand, t('set.left'))}</div></div>${mob() ? '' : `
        <div class="pan"><h3>${t('set.ads')}</h3><div class="row">${ch('adsToggle', 0, !g.opts.adsToggle, t('set.hold'))}${ch('adsToggle', 1, !!g.opts.adsToggle, t('set.toggle'))}</div></div>
        <div class="pan"><h3>${t('set.keys')}</h3><div class="hint">${t('set.keysHint')}</div>
        <div class="row" style="margin-top:6px"><button class="chip" data-k="kreset" data-v="1">${t('set.reset')}</button></div>${this.msg ? `<div class="msg">${this.msg}</div>` : ''}</div>
        ${keyRows}
        <div class="pan"><h3>${t('set.fixed')}</h3><div class="hint">${t('set.fixedHint')}</div></div>`}`;      // dokunmatikte tuş atama yok
    }
    const keep = this.el.querySelector('.sc')?.scrollTop || 0;
    this.el.innerHTML = `<div class="box"><div class="hd"><h2>${this.tab === 'settings' ? t('set.settings') : t('set.controls')}</h2>
      <button class="tab ${this.tab === 'settings' ? 'on' : ''}" data-tab="settings">${t('set.settings')}</button><button class="tab ${this.tab === 'controls' ? 'on' : ''}" data-tab="controls">${t('set.controls')}</button>
      <button class="x" data-close="1">${t('set.back')}</button></div><div class="sc">${body}</div></div>`;
    this.el.querySelector('.sc').scrollTop = keep;
  }

  onInput(e) {
    const t = e.target, k = t.dataset.k; if (!k || t.type !== 'range') return;
    const v = +t.value; this.set(k, v);
    const em = this.el.querySelector('#igv_' + k); if (em) em.textContent = (k === 'sens' ? FMT.sens : k === 'fov' ? FMT.fov : FMT.pct)(v);
  }

  onClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.close) { this.close(); return; }
    if (b.dataset.tab) { this.tab = b.dataset.tab; this.cap = null; this.msg = ''; this.render(); return; }
    if (b.dataset.bind) { this.cap = { id: b.dataset.bind, slot: +b.dataset.slot }; this.msg = ''; this.render(); return; }
    const k = b.dataset.k; if (!k) return;
    if (k === 'touchEd') { this.close(); this.g.player.touch?.openEditor(); return; }
    if (k === 'kreset') { this.g.binds.reset(); this.saveKeys(); this.msg = t('set.resetDone'); this.render(); return; }
    if (k === 'lang') { setLang(b.dataset.v); this.render(); return; }                  // dil: HUD onLang ile kendini yeniden yazar
    const v = +b.dataset.v;
    this.set(k, k === 'quality' ? v : !!v);
    this.render();
  }

  onKey(e) {
    if (!this.open) return;
    if (this.cap) {
      e.preventDefault(); e.stopPropagation();
      const code = norm(e.code), { id, slot } = this.cap, kb = this.g.binds;
      if (code === 'Escape') { this.cap = null; this.msg = ''; this.render(); return; }
      if (code === 'Backspace' || code === 'Delete') { kb.clear(id, slot); this.saveKeys(); this.cap = null; this.msg = t('set.cleared'); this.render(); return; }
      if (RESERVED.has(code)) { this.msg = t('set.reserved'); this.render(); return; }
      const taken = kb.set(id, slot, code); this.saveKeys(); this.cap = null;
      this.msg = taken ? t('set.taken', { k: keyLabel(code), a: actLabel(ACTIONS.find((a) => a.id === taken)) }) : '';
      this.render(); return;
    }
    if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); return; }
    e.stopPropagation();                                          // panel açıkken oyun kısayolları çalışmasın
  }

  dispose() { this._offLang?.(); window.removeEventListener('keydown', this._key, true); this.el.remove(); this.st.remove(); }
}

const mob = () => document.body.classList.contains('mob');              // dokunmatik kontroller açık (touch.js)
const onoff = (v) => (v ? t('set.on') : t('set.off'));
const tg = (k, fb) => { const s = t(k); return s === k ? fb : s; };                  // anahtar yoksa keybinds.js'teki Türkçe ad
const actLabel = (a) => tg(`set.act.${a.id}`, a.label);
const keyLabel = (c) => (c === 'Space' ? t('set.space') : codeLabel(c));
const postOn = (s) => s.post ?? !mob();                                    // son işleme: telefonda varsayılan kapalı
const FMT = { sens: (x) => (x / 0.0022).toFixed(2) + '×', fov: (x) => x + '°', pct: (x) => Math.round(x * 100) + '%' };
