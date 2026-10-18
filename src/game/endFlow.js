// Maç sonu akışı: sonuç ekranının altına "sonraki maç" kartları + geri sayım. Hiçbir durumda ana menüye kendiliğinden dönülmez.
// Çevrimiçi resmi oda: sunucunun 3 seçeneğine oy (canlı oy sayıları, 1–3 tuşları), süre dolunca sunucu yeni maçı kurar ve aynı bağlantıda yeni 'welcome' yollar.
// Çevrimiçi oyuncu odası: aynı ayarla sonraki maç kartı. Çevrimdışı: 3 seçenekten biri seçilir (varsayılan ilk), 15 sn sonra ya da "Hemen başla" ile yeni maç.
import { t } from '../i18n/index.js';
import '../i18n/match.js';
import { MAPS } from '../maps/index.js';
import { nextOptions } from './nextMatch.js';

const OFFLINE_MS = 15000;
const CSS = `
#mnext{margin:14px auto 6px;max-width:720px;text-align:left}
#mnext .mn-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:13px;letter-spacing:3px;text-transform:uppercase;opacity:.92}
#mnext .mn-h b{font-size:22px;letter-spacing:1px;color:#ffb347;font-variant-numeric:tabular-nums}
#mnext .mn-bar{height:4px;background:rgba(255,255,255,.12);margin:6px 0 10px;overflow:hidden}
#mnext .mn-bar i{display:block;height:100%;background:linear-gradient(90deg,#ff8a1f,#ffb347);width:100%}
#mnext .mn-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
#mnext .mn-c{position:relative;height:128px;border:2px solid rgba(255,255,255,.18);background:#222 center/cover no-repeat;color:#fff;cursor:pointer;padding:0;text-align:left;font:inherit;overflow:hidden;transition:transform .12s,border-color .12s}
#mnext .mn-c:hover{transform:translateY(-2px);border-color:rgba(255,179,71,.7)}
#mnext .mn-c.on{border-color:#ff8a1f;box-shadow:0 0 0 2px rgba(255,138,31,.45),0 6px 22px rgba(255,138,31,.25)}
#mnext .mn-c.lead .mn-v{background:#ff8a1f;color:#111}
#mnext .mn-c.ro{cursor:default}
#mnext .mn-c::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 30%,rgba(0,0,0,.82))}
#mnext .mn-k{position:absolute;left:8px;top:8px;z-index:1;font-size:12px;font-weight:700;background:rgba(0,0,0,.55);padding:2px 7px}
#mnext .mn-v{position:absolute;right:8px;top:8px;z-index:1;font-size:14px;font-weight:700;background:rgba(0,0,0,.6);padding:2px 9px;min-width:16px;text-align:center}
#mnext .mn-me{position:absolute;right:8px;top:8px;z-index:1;font-size:10px;letter-spacing:2px;font-style:normal;background:#ff8a1f;color:#111;padding:2px 6px;display:none}
#mnext .mn-c.on .mn-me{display:block}#mnext .mn-v+.mn-me{top:36px}
#mnext .mn-l{position:absolute;left:10px;right:10px;bottom:8px;z-index:1}
#mnext .mn-l b{display:block;font-size:18px;letter-spacing:1px}
#mnext .mn-l small{font-size:12px;opacity:.85}
#mnext .mn-s{font-size:12px;opacity:.7;margin-top:8px;text-align:center}
@media (max-width:700px){#endscreen .panel{min-width:0!important;width:94vw}#mnext .mn-cards{grid-template-columns:repeat(3,1fr);gap:6px}#mnext .mn-c{height:96px}#mnext .mn-l b{font-size:14px}}
@media (max-height:520px){#endscreen .panel{max-height:96vh;overflow-y:auto;padding-top:10px;padding-bottom:10px}#etitle{font-size:34px!important;letter-spacing:4px!important;margin:0!important}#einfo{margin:4px 0!important;font-size:13px}
  #estats .mvp{margin:4px 0}#estats .st{padding:4px 12px}#estats .st b{font-size:18px}#mnext{margin:6px auto 4px}#mnext .mn-c{height:84px}#mnext .mn-bar{margin:4px 0 6px}#mnext .mn-s{margin-top:4px}}
@media (max-height:420px){#endscreen .panel{padding:6px 14px!important}#etitle{font-size:26px!important}#einfo{font-size:12px;margin:2px 0!important}#estats{margin:2px 0!important}#estats .mvp{gap:6px;margin:2px 0}#estats .st{padding:2px 10px}#estats .st b{font-size:15px}#estats .st small{font-size:9px}#estats>small{font-size:11px}
  #mnext{margin:4px auto 2px}#mnext .mn-h{font-size:11px}#mnext .mn-h b{font-size:16px}#mnext .mn-c{height:66px}#mnext .mn-l{bottom:4px}#mnext .mn-l b{font-size:13px}#mnext .mn-l small{font-size:10px}#mnext .mn-s{font-size:10px;margin-top:2px}#endscreen .btn{padding:7px 18px!important;font-size:12px!important;margin-top:4px!important}}
#mnext .mn-c:focus{outline:none}#mnext .mn-c:focus-visible{outline:2px solid #ffb347}
`;

const label = (o) => `${t('match.tod.' + o.tod)} · ${t('match.w.' + o.weather)}`;

export class EndFlow {
  // net: çevrimiçi 'end' mesajı { ms, vote:{ opts, c }, next } · null = çevrimdışı
  constructor(game, net) {
    this.game = game; this.net = net; this.online = !!game.online;
    const hud = game.hud, panel = hud.$('endscreen').querySelector('.panel');
    if (!document.getElementById('mnextCss')) { const st = document.createElement('style'); st.id = 'mnextCss'; st.textContent = CSS; document.head.appendChild(st); }
    this.mode = this.online ? (net && net.vote ? 'vote' : 'next') : 'pick';
    if (this.mode === 'vote') { this.opts = net.vote.opts; this.counts = net.vote.c || this.opts.map(() => 0); }
    else if (this.mode === 'next') this.opts = net && net.next ? [net.next] : [];
    else this.opts = nextOptions({ type: game.mode.type || game.opts.match?.type, cur: { map: game.mapDef.id, tod: game.opts.tod, weather: game.opts.weather } });
    this.sel = this.mode === 'pick' ? 0 : -1;
    this.dur = this.mode === 'pick' ? OFFLINE_MS : Math.max(1000, (net && net.ms) || 15000);
    this.endAt = performance.now() + this.dur;
    this.total = 1;
    const el = (this.el = document.createElement('div'));
    el.id = 'mnext';
    panel.insertBefore(el, hud.$('bAgain'));
    // düğmeler: çevrimiçi "Tekrar Oyna" yok (sunucu otomatik geçirir), çevrimdışı "Hemen başla"
    const again = hud.$('bAgain'), menu = hud.$('bMenu');
    menu.textContent = t('match.menu');
    if (this.online) again.style.display = 'none';
    else { again.textContent = t('match.nextNow'); again.onclick = () => this.go(); }
    this.render();
    this._kd = (e) => { const i = +e.key - 1; if (i >= 0 && i < this.opts.length && !e.repeat) this.choose(i); };
    document.addEventListener('keydown', this._kd);
    this._iv = setInterval(() => this.tick(), 200);
    this.tick();
  }

  render() {
    const vote = this.mode === 'vote', ro = this.mode === 'next', max = vote ? Math.max(0, ...this.counts) : 0;
    const title = vote ? t('match.voteTitle') : ro ? t('match.nextTitle') : t('match.pickTitle');
    this.el.innerHTML = `<div class="mn-h"><span>${title}</span><b id="mnT"></b></div><div class="mn-bar"><i id="mnBar"></i></div>
      <div class="mn-cards">${this.opts.map((o, i) => { const m = MAPS[o.map] || { name: o.map, thumb: '' }; return `<button type="button" class="mn-c ${i === this.sel ? 'on' : ''} ${vote && max && this.counts[i] === max ? 'lead' : ''} ${ro ? 'ro' : ''}" data-i="${i}" style="background-image:url('${m.thumb}')">
        ${ro ? '' : `<span class="mn-k">${i + 1}</span>`}${vote ? `<span class="mn-v">${this.counts[i] || 0}</span>` : ''}<em class="mn-me">${vote ? t('match.myVote') : t('match.picked')}</em>
        <div class="mn-l"><b>${m.name}</b><small>${label(o)}</small></div></button>`; }).join('')}</div>
      <div class="mn-s" id="mnS"></div>`;
    this.el.querySelectorAll('.mn-c').forEach((b) => (b.onclick = () => this.choose(+b.dataset.i)));
    this.hint();
  }

  hint() {
    const s = this.el.querySelector('#mnS');
    if (!s) return;
    const n = this.counts ? this.counts.reduce((a, b) => a + b, 0) : 0;
    s.textContent = this.mode === 'vote' ? (this.total > 1 || n ? t('match.voteHint', { n, total: this.total }) : t('match.voteHint1')) : this.mode === 'pick' ? t('match.pickHint') : '';
  }

  choose(i) {
    if (this.mode === 'next' || this.done) return;
    this.sel = i;
    if (this.mode === 'vote') this.game.online?.send({ t: 'vote', i });
    this.el.querySelectorAll('.mn-c').forEach((b) => b.classList.toggle('on', +b.dataset.i === i));
  }

  // sunucudan canlı oy sayıları { c, n, ms }
  votes(m) {
    if (this.mode !== 'vote' || !Array.isArray(m.c)) return;
    this.counts = m.c; this.total = m.n || 1;
    if (Number.isFinite(m.ms)) this.endAt = Math.min(this.endAt, performance.now() + m.ms);
    this.render();
    this.tick();
  }

  tick() {
    const left = Math.max(0, this.endAt - performance.now()), T = this.el.querySelector('#mnT'), bar = this.el.querySelector('#mnBar');
    if (this.online && this.game.online?.closed) { T.textContent = ''; this.el.querySelector('#mnS').textContent = t('match.lost'); bar.style.width = '0'; clearInterval(this._iv); return; }
    T.textContent = left > 0 ? t('match.startsIn', { s: Math.ceil(left / 1000) }) : this.online ? '' : t('match.startsIn', { s: 0 });
    bar.style.width = (left / this.dur) * 100 + '%';
    if (left <= 0) {
      if (this.online) { this.el.querySelector('#mnS').textContent = t('match.preparing'); }       // sunucu yeni maçı kurup 'welcome' yollayacak
      else this.go();
    }
  }

  // çevrimdışı: seçili seçenekle yeni maç
  go() {
    if (this.done || this.online) return;
    this.done = true;
    const o = this.opts[Math.max(0, this.sel)];
    this.game.restart(o ? { map: o.map, tod: o.tod, weather: o.weather } : null);
  }

  dispose() {
    clearInterval(this._iv);
    document.removeEventListener('keydown', this._kd);
    this.el.remove();
  }
}
