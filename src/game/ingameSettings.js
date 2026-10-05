// Oyun içi Ayarlar / Kontroller paneli (Esc → duraklatma menüsü → "Ayarlar" ya da "Kontroller").
// Ana menüdeki Ayarlar + Kontroller ekranlarının tamamı; değişiklikler maç sırasında ANINDA uygulanır ve tercihlere (localStorage) kaydedilir
// (game.opts.onPref → menu.patchPrefs). Tuş atama: tıkla → yeni tuşa bas · Geri tuşu temizler · Esc vazgeçer.
import { Binds, ACTIONS, GROUPS, codeLabel, RESERVED, norm } from '../core/keybinds.js';
import { music } from './music.js';

const CSS = `
#igs{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(5,8,12,.72);pointer-events:auto;z-index:30}
#igs .box{width:min(860px,94vw);max-height:88vh;display:flex;flex-direction:column;background:rgba(11,15,22,.97);border:1px solid rgba(255,255,255,.16);box-shadow:0 14px 50px rgba(0,0,0,.6);clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,0 100%)}
#igs .hd{display:flex;align-items:center;gap:6px;padding:16px 22px 0}
#igs .hd h2{margin:0 18px 0 0;font-size:26px;letter-spacing:4px;text-transform:uppercase;font-style:italic}
#igs .tab{cursor:pointer;background:#1c2431;color:#cfd6e2;border:0;padding:8px 16px;font:inherit;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
#igs .tab.on{background:linear-gradient(100deg,#ffb347,#ff7a12);color:#160a02}
#igs .x{margin-left:auto;cursor:pointer;background:#2c3646;color:#e8edf5;border:0;padding:8px 14px;font:inherit;font-weight:800;letter-spacing:2px}
#igs .sc{overflow-y:auto;padding:12px 22px 20px}
#igs .pan{border-top:1px solid rgba(255,255,255,.08);padding:12px 0 6px}
#igs h3{margin:0 0 8px;font-size:12px;letter-spacing:3px;color:#ffb347;text-transform:uppercase}
#igs .sr{display:grid;grid-template-columns:200px 1fr 70px;align-items:center;gap:12px;margin:6px 0;font-size:14px}
#igs .sr em{font-style:normal;text-align:right;opacity:.85}
#igs input[type=range]{width:100%;accent-color:#ff9a2e}
#igs .row{display:flex;flex-wrap:wrap;gap:6px}
#igs .chip{cursor:pointer;background:#1c2431;color:#dde3ec;border:1px solid rgba(255,255,255,.12);padding:7px 12px;font:inherit;font-size:13px}
#igs .chip.on{border-color:#ff9a2e;color:#ffb347;background:#2a2014}
#igs .hint{font-size:12px;opacity:.65;margin:6px 0 2px;line-height:1.45}
#igs .kb{display:grid;grid-template-columns:1fr 110px 110px;gap:6px;align-items:center;font-size:13.5px;margin:3px 0}
#igs .kk{cursor:pointer;background:#1a212c;color:#e8edf5;border:1px solid rgba(255,255,255,.14);padding:5px 8px;font:inherit;font-size:13px;font-weight:700}
#igs .kk.cap{border-color:#ff9a2e;color:#ffb347;animation:igsb .8s infinite alternate}
@keyframes igsb{to{background:#2a2014}}
#igs .msg{color:#ffb347;font-size:12.5px;margin-top:6px}
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
      case 'fov': s.fov = v; this.save({ fov: v }); break;
      case 'volume': case 'vSfx': case 'vMusic': case 'vAmb': case 'rainSound':
        s[key] = v; this.save({ [key]: v });
        g.sfx?.setVolume?.(s.volume ?? 0.6);
        g.sfx?.setMix?.({ sfx: s.vSfx ?? 1, amb: s.vAmb ?? 1, rain: s.rainSound !== false });
        music.setVolume((s.volume ?? 0.6) * (s.vMusic ?? 0.5));
        break;
      case 'quality': {
        s.pixelRatio = v; this.save({ quality: v });
        const r = g.renderer, pr = Math.min(devicePixelRatio, v);
        if (g._perf) { g._perf.max = pr; g._perf.ratio = pr; }
        r?.setPixelRatio(pr); r?.setSize(innerWidth, innerHeight, false);
        break;
      }
      case 'shadows':
        s.shadows = v; this.save({ shadows: v });
        if (g.renderer) { g.renderer.shadowMap.enabled = v; g.renderer.shadowMap.needsUpdate = true; }
        g.scene?.traverse((o) => { const m = o.material; if (!m) return; for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true; });
        break;
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
      body = `<div class="pan"><h3>Fare ve görüş</h3>
        ${sl('sens', 'Hassasiyet', 0.0008, 0.006, 0.0001, s.sens ?? 0.0022, FMT.sens)}
        ${sl('fov', 'Görüş açısı', 60, 100, 1, s.fov ?? 80, FMT.fov)}</div>
        <div class="pan"><h3>Ses</h3>
        ${sl('volume', 'Ana ses', 0, 1, 0.05, s.volume ?? 0.6, FMT.pct)}
        ${sl('vSfx', 'Efekt sesleri', 0, 1, 0.05, s.vSfx ?? 1, FMT.pct)}
        ${sl('vMusic', 'Müzik', 0, 1, 0.05, s.vMusic ?? 0.5, FMT.pct)}
        ${sl('vAmb', 'Ortam (yağmur, rüzgâr)', 0, 1, 0.05, s.vAmb ?? 1, FMT.pct)}
        <div class="row" style="margin-top:6px">${ch('rainSound', s.rainSound === false ? 1 : 0, s.rainSound !== false, `Yağmur sesi: ${s.rainSound !== false ? 'Açık' : 'Kapalı'}`)}</div></div>
        <div class="pan"><h3>Grafik</h3><div class="row">
        ${[[1, 'Düşük'], [1.5, 'Orta'], [2, 'Yüksek']].map(([v, l]) => ch('quality', v, q === v, l)).join('')}
        ${ch('shadows', s.shadows === false ? 1 : 0, s.shadows !== false, `Gölgeler: ${s.shadows !== false ? 'Açık' : 'Kapalı'}`)}
        ${ch('adaptive', s.adaptive === false ? 1 : 0, s.adaptive !== false, `Otomatik çözünürlük: ${s.adaptive !== false ? 'Açık' : 'Kapalı'}`)}
        ${ch('fullscreen', s.fullscreen === false ? 1 : 0, s.fullscreen !== false, `Tam ekran + Ctrl+W koruması: ${s.fullscreen !== false ? 'Açık' : 'Kapalı'}`)}</div>
        <div class="hint">Düşük kalite ve kapalı gölge, zayıf bilgisayarlarda ve büyük maçlarda akıcılığı artırır. Tam ekran değişikliği oyuna döndüğünde uygulanır.</div></div>`;
    } else {
      const kb = g.binds, cap = this.cap;
      const keyRows = GROUPS.map((gr, gi) => `<div class="pan"><h3>${gr}</h3>${ACTIONS.filter((a) => a.group === gi).map((a) => `<div class="kb"><span>${a.label}</span>${[0, 1].map((sl2) => {
        const on = cap && cap.id === a.id && cap.slot === sl2;
        return `<button class="kk ${on ? 'cap' : ''}" data-bind="${a.id}" data-slot="${sl2}">${on ? 'Tuşa bas…' : codeLabel(kb.codes(a.id)[sl2])}</button>`;
      }).join('')}</div>`).join('')}</div>`).join('');
      body = `<div class="pan"><h3>Silahı tutan el</h3><div class="row">${ch('leftHand', 0, !g.leftHand, 'Sağ el')}${ch('leftHand', 1, !!g.leftHand, 'Sol el')}</div></div>
        <div class="pan"><h3>Nişan alma (sağ tık)</h3><div class="row">${ch('adsToggle', 0, !g.opts.adsToggle, 'Basılı tut')}${ch('adsToggle', 1, !!g.opts.adsToggle, 'Bir kez bas (aç-kapa)')}</div></div>
        <div class="pan"><h3>Tuş atama</h3><div class="hint">Bir tuşa tıkla, sonra yeni tuşa bas. Her eyleme en çok 2 tuş. Geri tuşu temizler, Esc vazgeçer. Aynı tuş başka eyleme atanmışsa oradan alınır.</div>
        <div class="row" style="margin-top:6px"><button class="chip" data-k="kreset" data-v="1">Varsayılana dön</button></div>${this.msg ? `<div class="msg">${this.msg}</div>` : ''}</div>
        ${keyRows}
        <div class="pan"><h3>Sabit tuşlar</h3><div class="hint">Ateş / nişan: sol tık / sağ tık · Silah değiştir: fare tekeri · Duraklat: Esc</div></div>`;
    }
    const keep = this.el.querySelector('.sc')?.scrollTop || 0;
    this.el.innerHTML = `<div class="box"><div class="hd"><h2>${this.tab === 'settings' ? 'Ayarlar' : 'Kontroller'}</h2>
      <button class="tab ${this.tab === 'settings' ? 'on' : ''}" data-tab="settings">Ayarlar</button><button class="tab ${this.tab === 'controls' ? 'on' : ''}" data-tab="controls">Kontroller</button>
      <button class="x" data-close="1">Geri</button></div><div class="sc">${body}</div></div>`;
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
    if (k === 'kreset') { this.g.binds.reset(); this.saveKeys(); this.msg = 'Tuşlar varsayılana döndü'; this.render(); return; }
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
      if (code === 'Backspace' || code === 'Delete') { kb.clear(id, slot); this.saveKeys(); this.cap = null; this.msg = 'Tuş temizlendi'; this.render(); return; }
      if (RESERVED.has(code)) { this.msg = 'Bu tuş atanamaz'; this.render(); return; }
      const taken = kb.set(id, slot, code); this.saveKeys(); this.cap = null;
      this.msg = taken ? `"${codeLabel(code)}" tuşu "${ACTIONS.find((a) => a.id === taken).label}" eyleminden alındı` : '';
      this.render(); return;
    }
    if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); return; }
    e.stopPropagation();                                          // panel açıkken oyun kısayolları çalışmasın
  }

  dispose() { window.removeEventListener('keydown', this._key, true); this.el.remove(); this.st.remove(); }
}

const FMT = { sens: (x) => (x / 0.0022).toFixed(2) + '×', fov: (x) => x + '°', pct: (x) => Math.round(x * 100) + '%' };
