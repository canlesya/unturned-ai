import { TEAMS } from '../core/palette.js';
import { WSTATS, CLASS_DEFS } from './stats.js';
import { clamp } from './util.js';

const CSS = `
#hud{position:fixed;inset:0;pointer-events:none;font-family:Bahnschrift,'Rajdhani','Arial Narrow','Segoe UI',system-ui,sans-serif;color:#fff;user-select:none;z-index:5;letter-spacing:.5px}
#hud *{box-sizing:border-box}
.blue{--c:#4aa3ff}.red{--c:#ff5a43}
#hud .glass{background:rgba(9,13,19,.62);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(4px)}
/* üst orta: bilet + süre + bayraklar + pusula */
#topbar{position:absolute;left:50%;top:10px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
#score{display:flex;align-items:stretch;height:50px}
#score .tk{position:relative;min-width:128px;padding:4px 16px 0;font-weight:800;font-size:28px;text-align:center;line-height:1.05;background:rgba(9,13,19,.66);border:1px solid rgba(255,255,255,.12)}
#score .tk small{display:block;font-size:10px;font-weight:700;letter-spacing:3px;opacity:.8}
#score .tk .bar{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.12)}
#score .tk .bar i{display:block;height:100%;background:var(--c);transition:width .3s}
#score .tk.blue{color:#9fd0ff;clip-path:polygon(0 0,100% 0,calc(100% - 12px) 100%,0 100%)}
#score .tk.red{color:#ffb3a6;clip-path:polygon(12px 0,100% 0,100% 100%,0 100%)}
#score .tk.blue .bar i{float:right}
#timer{padding:8px 16px;font-size:22px;font-weight:700;min-width:84px;text-align:center;background:rgba(9,13,19,.85);border:1px solid rgba(255,255,255,.12);border-width:1px 0}
#flags{display:flex;gap:7px}
.flag{width:34px;height:34px;border-radius:50%;background:rgba(9,13,19,.7);border:3px solid #888;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;position:relative}
.flag i{position:absolute;inset:-3px;border-radius:50%}
.flag span{position:relative;z-index:1}
#compass{width:460px;height:30px;position:relative;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent);mask-image:linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent)}
#compass canvas{width:100%;height:100%;display:block}
/* mini harita */
#mmwrap{position:absolute;left:16px;top:16px;padding:4px;border:1px solid rgba(255,255,255,.22);background:rgba(9,13,19,.7);box-shadow:0 4px 18px rgba(0,0,0,.5)}
#mmwrap::before{content:'';position:absolute;left:-1px;top:-1px;width:14px;height:14px;border-left:3px solid #ff8a1f;border-top:3px solid #ff8a1f}
#mmwrap::after{content:'';position:absolute;right:-1px;bottom:-1px;width:14px;height:14px;border-right:3px solid #ff8a1f;border-bottom:3px solid #ff8a1f}
#minimap{display:block;background:#2a3a1f}
#mmname{position:absolute;left:8px;bottom:7px;font-size:11px;font-weight:700;letter-spacing:2px;color:#fff;text-shadow:0 1px 3px #000;text-transform:uppercase}
/* öldürme akışı */
#killfeed{position:absolute;right:16px;top:16px;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.kf{background:rgba(9,13,19,.68);padding:4px 12px;font-size:15px;animation:kf 6s forwards;white-space:nowrap;border-right:3px solid #888;font-weight:600}
.kf.me{border-right-color:#ff8a1f;background:rgba(60,34,8,.78)}
.kf .b{color:#8cc4ff}.kf .r{color:#ff9a88}.kf .w{opacity:.8;font-size:12px;margin:0 8px;color:#ffd9a8;letter-spacing:1px}
@keyframes kf{0%{opacity:0;transform:translateX(24px)}5%{opacity:1;transform:none}85%{opacity:1}100%{opacity:0}}
/* nişan */
#cross{position:absolute;left:50%;top:50%;width:0;height:0}
#cross span{position:absolute;background:#fff;box-shadow:0 0 2px #000}
#cross .h{width:8px;height:2px;top:-1px}#cross .v{width:2px;height:8px;left:-1px}
#cross .l{left:calc(-8px - var(--g,6px))}#cross .r{left:var(--g,6px)}#cross .t{top:calc(-8px - var(--g,6px))}#cross .b{top:var(--g,6px)}
#cross .dot{width:3px;height:3px;left:-1.5px;top:-1.5px;border-radius:50%}
#cross.ads span:not(.dot){display:none}
#rdot{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#ff2a1a;box-shadow:0 0 6px 2px #ff2a1acc,0 0 14px 5px #ff2a1a55;display:none}
#hitm{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;opacity:0;transition:opacity .25s}
#hitm::before,#hitm::after{content:'';position:absolute;left:12px;top:-2px;width:2px;height:30px;background:#fff;transform:rotate(45deg)}
#hitm::after{transform:rotate(-45deg)}
#hitm.k::before,#hitm.k::after{background:#ff3b2f}
/* sağlık / sınıf */
#vitals{position:absolute;left:20px;bottom:20px;width:300px;text-shadow:0 1px 4px #000}
#vitals .cls{font-size:13px;font-weight:700;letter-spacing:3px;opacity:.9;text-transform:uppercase}
#vitals .row{display:flex;align-items:flex-end;gap:12px;margin-top:2px}
#hpnum{font-size:54px;font-weight:800;line-height:.9;min-width:96px}
#hpnum small{font-size:16px;opacity:.7;margin-left:3px;font-weight:600}
#hpbar{flex:1;height:12px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.28);transform:skewX(-18deg);margin-bottom:6px;overflow:hidden}
#hpfill{height:100%;background:linear-gradient(90deg,#3ecf5b,#8be67a);width:100%;transition:width .15s}
#stance{margin-top:4px;font-size:12px;letter-spacing:2px;opacity:.85;min-height:15px;text-transform:uppercase}
/* cephane */
#ammo{position:absolute;right:22px;bottom:20px;text-align:right;text-shadow:0 1px 4px #000}
#ammo .nm{font-size:15px;font-weight:700;letter-spacing:3px;text-transform:uppercase;opacity:.92;margin-bottom:0}
#ammo .n{font-size:64px;font-weight:800;line-height:.95}
#ammo .n small{font-size:26px;opacity:.7;font-weight:600}
#ammo .n.low #mag{color:#ff6a4a}
#slots{display:flex;gap:6px;justify-content:flex-end;margin-top:8px}
.slot{padding:4px 10px;background:rgba(9,13,19,.6);font-size:12px;border:1px solid rgba(255,255,255,.14);opacity:.7;letter-spacing:1px;text-transform:uppercase;transform:skewX(-10deg)}
.slot span{display:inline-block;transform:skewX(10deg)}
.slot b{color:#ff8a1f;margin-right:5px}
.slot.on{border-color:#ff8a1f;opacity:1;background:rgba(80,42,8,.75)}
.slot.empty{opacity:.28;text-decoration:line-through}
/* bildirimler */
#toasts{position:absolute;left:50%;top:132px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px}
.toast{padding:6px 18px;background:rgba(9,13,19,.74);font-weight:700;font-size:17px;letter-spacing:1px;animation:ts 3.2s forwards;border-left:3px solid #ff8a1f;border-right:3px solid #ff8a1f}
@keyframes ts{0%{opacity:0;transform:translateY(-8px)}8%{opacity:1;transform:none}85%{opacity:1}100%{opacity:0}}
#pops{position:absolute;left:50%;top:56%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none}
.pop{font-size:22px;font-weight:800;letter-spacing:2px;color:#ffd27a;text-shadow:0 2px 6px #000;animation:pp 1.6s forwards}
.pop.head{color:#ff6a4a}
@keyframes pp{0%{opacity:0;transform:translateY(10px) scale(.8)}12%{opacity:1;transform:none scale(1.08)}80%{opacity:1}100%{opacity:0;transform:translateY(-20px)}}
#msg{position:absolute;left:50%;top:66%;transform:translateX(-50%);font-size:16px;font-weight:700;text-shadow:0 1px 4px #000;opacity:.95;letter-spacing:2px;text-transform:uppercase}
#zonew{position:absolute;left:50%;top:22%;transform:translateX(-50%);display:none;padding:12px 28px;background:rgba(120,14,8,.8);border:2px solid #ff3b2f;font-size:22px;font-weight:800;letter-spacing:3px;text-align:center;animation:zw .6s infinite alternate}
#zonew small{display:block;font-size:13px;letter-spacing:2px;font-weight:600}
@keyframes zw{to{background:rgba(180,24,12,.9)}}
#vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(200,0,0,.6) 100%);opacity:0;transition:opacity .4s}
#arrows{position:absolute;left:50%;top:50%;width:0;height:0}
.arrow{position:absolute;left:-14px;top:-130px;width:28px;height:40px;transform-origin:14px 130px;opacity:.9;animation:ar 1.4s forwards}
.arrow::before{content:'';position:absolute;left:0;top:0;border:14px solid transparent;border-bottom:26px solid #ff3b2f;border-top:0}
@keyframes ar{to{opacity:0}}
#holo{position:absolute;left:50%;top:50%;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;border:2px solid #ff3326;box-shadow:0 0 6px 1px #ff3326aa,inset 0 0 5px #ff332655;display:none}
#holo::before{content:'';position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:#ff3326;box-shadow:0 0 6px 2px #ff3326cc}
#holo i{position:absolute;background:#ff3326;box-shadow:0 0 4px #ff3326aa}
#holo i:nth-child(1){left:50%;top:-12px;width:2px;height:10px;margin-left:-1px}
#holo i:nth-child(2){left:50%;bottom:-12px;width:2px;height:10px;margin-left:-1px}
#holo i:nth-child(3){top:50%;left:-12px;height:2px;width:10px;margin-top:-1px}
#holo i:nth-child(4){top:50%;right:-12px;height:2px;width:10px;margin-top:-1px}
#advig{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.55) 100%)}
#scope{position:absolute;inset:0;display:none}
#scope .bl{position:absolute;inset:0;backdrop-filter:blur(9px) brightness(.5);-webkit-backdrop-filter:blur(9px) brightness(.5);
  -webkit-mask-image:radial-gradient(circle at center,transparent 36vh,#000 36.3vh);mask-image:radial-gradient(circle at center,transparent 36vh,#000 36.3vh)}
#scope .rg{position:absolute;left:50%;top:50%;width:72vh;height:72vh;margin:-36vh 0 0 -36vh;border-radius:50%;border:3.4vh solid #1c1e21;box-sizing:border-box;box-shadow:inset 0 0 1.2vh #000a}
#scope svg{position:absolute;left:50%;top:50%;width:65.2vh;height:65.2vh;margin:-32.6vh 0 0 -32.6vh}
#scope.chev .mil,#scope.mil .chev{display:none}
/* katmanlar: duraklat, ölüm, skor, maç sonu */
.overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(5,8,12,.66);pointer-events:auto}
.panel{background:rgba(11,15,22,.94);border:1px solid rgba(255,255,255,.16);padding:24px 32px;min-width:400px;max-width:94vw;box-shadow:0 14px 50px rgba(0,0,0,.6);clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,0 100%)}
.panel h2{margin:0 0 6px;font-size:34px;letter-spacing:4px;text-transform:uppercase;font-style:italic}.panel p{margin:4px 0;opacity:.85}
.btn{pointer-events:auto;cursor:pointer;background:linear-gradient(100deg,#ffb347,#ff7a12);color:#160a02;border:0;padding:11px 26px;font:inherit;font-size:17px;font-weight:800;margin:12px 8px 0 0;letter-spacing:3px;text-transform:uppercase;clip-path:polygon(0 0,100% 0,calc(100% - 10px) 100%,0 100%)}
.btn.sec{background:#2c3646;color:#e8edf5}.btn:hover{filter:brightness(1.15)}
#respawn{background:linear-gradient(180deg,rgba(40,5,5,.55),rgba(5,8,12,.8))}
#respawn .dep{display:grid;grid-template-columns:300px 1fr 280px;gap:18px;width:min(1180px,94vw)}
#respawn .card{background:rgba(11,15,22,.9);border:1px solid rgba(255,255,255,.14);padding:16px 18px}
#respawn h3{margin:0 0 10px;font-size:12px;letter-spacing:3px;color:#ffb347;text-transform:uppercase}
#rtitle{font-size:29px;font-weight:800;letter-spacing:2px;text-transform:uppercase;font-style:italic;margin:0 0 4px}
#rinfo{opacity:.85;font-size:15px}
#rcount{font-size:56px;font-weight:800;color:#ff8a1f;margin:6px 0 0;line-height:1}
#respawn .clsrow{display:flex;flex-direction:column;gap:6px}
.cc{pointer-events:auto;cursor:pointer;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);padding:8px 12px;font-size:13px;text-align:left;transition:.12s}
.cc b{display:block;font-size:16px;letter-spacing:2px;text-transform:uppercase}.cc.on{border-color:#ff8a1f;background:rgba(255,138,31,.2)}.cc small{opacity:.7;display:block;margin-top:2px}
.cc:hover{background:rgba(255,255,255,.13)}
.cc.dis{opacity:.4;pointer-events:none}
#spawnrow{display:flex;flex-direction:column;gap:6px}
#scoreboard table{border-collapse:collapse;width:100%;font-size:15px}
#scoreboard td,#scoreboard th{padding:4px 10px;text-align:right}
#scoreboard th{font-size:11px;letter-spacing:2px;opacity:.6;text-transform:uppercase}
#scoreboard td:first-child,#scoreboard th:first-child{text-align:left}
#scoreboard .team{display:inline-block;vertical-align:top;margin:0 10px;min-width:330px}
#scoreboard h3{margin:0 0 6px;letter-spacing:3px;text-transform:uppercase}#scoreboard tr.me{background:rgba(255,138,31,.25);font-weight:700}
#scoreboard tr.dead{opacity:.5}
#scoreboard .scroll{max-height:62vh;overflow:auto}
#endscreen .panel{text-align:center;min-width:560px}
#etitle{font-size:64px!important;letter-spacing:8px!important}
#estats .mvp{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:10px 0}
#estats .st{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);padding:8px 16px}
#estats .st b{display:block;font-size:26px;color:#ffb347}
#estats .st small{font-size:11px;letter-spacing:2px;opacity:.7;text-transform:uppercase}
`;

export class Hud {
  constructor(game) {
    this.game = game;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.st = st;
    const el = (this.root = document.createElement('div'));
    el.id = 'hud';
    el.innerHTML = `
      <div id="scope"><div class="bl"></div><div class="rg"></div>
        <svg viewBox="-100 -100 200 200" class="mil"><g stroke="#000" fill="none"><path d="M-100 0H-12M12 0H100M0 -100V-12M0 12V100" stroke-width=".35"/><path d="M-100 0H-62M62 0H100M0 -100V-62M0 62V100" stroke-width="2.6"/><path d="M-40 0V3M-30 0V3M-20 0V3M20 0V3M30 0V3M40 0V3M0 20H3M0 30H3M0 40H3M0 -20H3M0 -30H3M0 -40H3" stroke-width=".5"/></g><circle r=".9" fill="#ff3b2a"/></svg>
        <svg viewBox="-100 -100 200 200" class="chev"><g fill="none" stroke="#ff2e1f" stroke-linecap="round"><path d="M-14 16L0 -2L14 16" stroke-width="2.2"/><path d="M0 -2V-100M-100 0H-30M30 0H100M0 28V100" stroke-width=".3" stroke="#000"/><path d="M-10 36H10M-14 56H14M-18 76H18" stroke-width=".8" stroke="#ff2e1f"/></g><circle r=".8" fill="#ff2e1f"/></svg></div>
      <div id="mmwrap"><canvas id="minimap" width="236" height="168"></canvas><div id="mmname"></div></div>
      <div id="topbar">
        <div id="score"><div class="tk blue"><small>MAVİ</small><span id="tkB">0</span><div class="bar"><i id="tbB"></i></div></div><div id="timer">0:00</div><div class="tk red"><small>KIRMIZI</small><span id="tkR">0</span><div class="bar"><i id="tbR"></i></div></div></div>
        <div id="flags"></div>
        <div id="compass"><canvas width="920" height="60"></canvas></div>
      </div>
      <div id="killfeed"></div>
      <div id="toasts"></div>
      <div id="vig"></div><div id="arrows"></div>
      <div id="advig"></div>

      <div id="cross"><span class="h l"></span><span class="h r"></span><span class="v t"></span><span class="v b"></span><span class="dot"></span></div>
      <div id="rdot"></div><div id="holo"><i></i><i></i><i></i><i></i></div><div id="hitm"></div>
      <div id="pops"></div><div id="zonew">DÜŞMAN ÜSSÜNE GİRDİN!<small id="zonet"></small></div><div id="msg"></div>
      <div id="vitals"><div class="cls" id="clsname"></div><div class="row"><div id="hpnum">100</div><div id="hpbar"><div id="hpfill"></div></div></div><div id="stance"></div></div>
      <div id="ammo"><div class="nm" id="wname"></div><div class="n"><span id="mag">0</span> <small id="res">/ 0</small></div><div id="slots"></div></div>
      <div id="respawn" class="overlay"><div class="dep">
        <div class="card"><h3>Durum</h3><div id="rtitle">Öldün</div><p id="rinfo"></p><div id="rcount"></div></div>
        <div class="card"><h3>Sınıf seç <span style="opacity:.6;letter-spacing:1px;text-transform:none">(1–5)</span></h3><div class="clsrow" id="clsrow"></div></div>
        <div class="card"><h3>Doğma noktası</h3><div id="spawnrow"></div></div></div></div>
      <div id="scoreboard" class="overlay"><div class="panel" style="min-width:760px;text-align:center"><div class="scroll" id="sbbody"></div></div></div>
      <div id="pause" class="overlay"><div class="panel"><h2 id="ptitle">Hazır mısın?</h2><p id="ptext">Başlamak için tıkla. Fare ekrana kilitlenir, Esc ile duraklatırsın.</p>
        <button class="btn" id="bResume">Başla</button><button class="btn sec" id="bKill" title="Sıkıştıysan kendini öldürüp yeniden doğ">Kill (yeniden doğ)</button><button class="btn sec" id="bQuit">Ana Menü</button></div></div>
      <div id="endscreen" class="overlay"><div class="panel"><h2 id="etitle"></h2><p id="einfo"></p><div id="estats" style="margin:10px 0"></div>
        <button class="btn" id="bAgain">Tekrar Oyna</button><button class="btn sec" id="bMenu">Ana Menü</button></div></div>`;
    document.body.appendChild(el);
    this.$ = (id) => el.querySelector('#' + id);
    this.flagEls = [];
    for (const o of game.mode.objectives) {
      const f = document.createElement('div');
      f.className = 'flag'; f.innerHTML = `<i></i><span>${o.label || o.name[0]}</span>`; f.title = o.name;
      this.$('flags').appendChild(f);
      this.flagEls.push(f);
    }
    this.buildClassRow();
    this.$('mmname').textContent = game.map.name || '';
    this.mm = this.$('minimap');
    this.mmCtx = this.mm.getContext('2d');
    this.buildMinimapBase();
    this.hitT = 0; this.sel = null; this.zoneT = 0; this.cmp = this.root.querySelector('#compass canvas').getContext('2d');
    this.maxTk = game.mode.tickets;
    this.$('bResume').onclick = () => game.requestLock();
    this.$('bKill').onclick = () => { game.requestKill(); game.requestLock(); };
    this.$('bQuit').onclick = () => game.exit();
    this.$('bAgain').onclick = () => game.restart();
    this.$('bMenu').onclick = () => game.exit();
    this.$('pause').addEventListener('mousedown', (e) => { if (e.target.id === 'pause') game.requestLock(); });
  }

  dispose() { this.root.remove(); this.st.remove(); }

  buildClassRow() {
    const row = this.$('clsrow');
    row.innerHTML = '';
    Object.entries(CLASS_DEFS).forEach(([k, d], i) => {
      const c = document.createElement('div');
      c.className = 'cc'; c.dataset.k = k;
      c.innerHTML = `<b>${i + 1} · ${d.label}</b><small>${d.desc}</small>`;
      c.onclick = () => this.game.requestClass(k);
      row.appendChild(c);
    });
  }

  // + puan / bildirim
  popup(text, head = false) {
    const d = document.createElement('div'); d.className = 'pop' + (head ? ' head' : ''); d.textContent = text;
    const box = this.$('pops'); box.appendChild(d);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => d.remove(), 1700);
  }

  zoneWarn(left) {
    this.zoneT = 0.25;
    const z = this.$('zonew'); z.style.display = 'block';
    this.$('zonet').textContent = left > 0 ? `GERİ DÖN · ${Math.ceil(left)} sn` : 'CAN KAYBEDİYORSUN';
  }

  onPlayerSpawn() { this._spKey = null; }

  markSpawn(id) { this.$('spawnrow').querySelectorAll('.cc').forEach((c) => c.classList.toggle('on', c.dataset.k === id)); }

  buildSpawnRow() {
    const g = this.game, row = this.$('spawnrow');
    const opts = g.spawnOptions();
    const key = opts.map((o) => o.id + (o.ok ? 1 : 0)).join(',') + '|' + g.spawnChoice;
    if (key === this._spKey) return;
    this._spKey = key;
    row.innerHTML = '';
    for (const o of opts) {
      const c = document.createElement('div');
      c.className = 'cc' + (o.ok ? '' : ' dis') + (g.spawnChoice === o.id ? ' on' : ''); c.dataset.k = o.id;
      c.innerHTML = `<b>${o.id === 'base' ? '⌂ ' : '⚑ '}${o.name}</b><small>${o.id === 'base' ? 'Ana üs (güvenli)' : o.ok ? 'Ele geçirdiğin bölge' : 'Kullanılamaz'}</small>`;
      c.onclick = () => { g.requestSpawn(o.id); this._spKey = null; };
      row.appendChild(c);
    }
    if (!opts.find((o) => o.id === g.spawnChoice && o.ok)) g.spawnChoice = 'base';
  }

  drawCompass() {
    const g = this.game, p = g.playerSoldier, x = this.cmp, W = 920, H = 60, span = Math.PI;   // ±90°
    x.clearRect(0, 0, W, H);
    const bearing = ((-p.yaw * 180) / Math.PI % 360 + 360) % 360;
    x.font = 'bold 22px Bahnschrift, Arial Narrow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let d = 0; d < 360; d += 5) {
      let rel = ((d - bearing + 540) % 360) - 180;
      if (Math.abs(rel) > 95) continue;
      const px = W / 2 + (rel / 180) * W;
      const major = d % 45 === 0, mid = d % 15 === 0;
      x.fillStyle = major ? '#fff' : 'rgba(255,255,255,.55)';
      x.fillRect(px - 1, major ? 6 : mid ? 12 : 17, 2, major ? 14 : mid ? 10 : 6);
      if (major) { x.fillStyle = d === 0 ? '#ff8a1f' : '#fff'; x.fillText({ 0: 'K', 45: 'KD', 90: 'D', 135: 'GD', 180: 'G', 225: 'GB', 270: 'B', 315: 'KB' }[d], px, 40); }
    }
    for (const o of g.mode.objectives) {
      const brg = (Math.atan2(o.x - p.pos.x, -(o.z - p.pos.z)) * 180) / Math.PI;
      const rel = ((brg - bearing + 540) % 360) - 180;
      if (Math.abs(rel) > 92) continue;
      const px = W / 2 + (rel / 180) * W;
      x.fillStyle = o.owner === 'blue' ? '#4aa3ff' : o.owner === 'red' ? '#ff5a43' : '#d0d6de';
      x.beginPath(); x.moveTo(px, 4); x.lineTo(px + 11, 17); x.lineTo(px, 30); x.lineTo(px - 11, 17); x.closePath(); x.fill();
      x.fillStyle = '#0a0e14'; x.font = 'bold 15px Bahnschrift, sans-serif'; x.fillText(o.label || o.name[0], px, 18.5); x.font = 'bold 22px Bahnschrift, Arial Narrow, sans-serif';
    }
    x.fillStyle = '#ff8a1f'; x.beginPath(); x.moveTo(W / 2 - 8, 0); x.lineTo(W / 2 + 8, 0); x.lineTo(W / 2, 9); x.fill();
  }

  markClass(k) { this.$('clsrow').querySelectorAll('.cc').forEach((c) => c.classList.toggle('on', c.dataset.k === k)); }

  buildMinimapBase() {
    const g = this.game, b = g.map.bounds;
    const W = this.mm.width, H = this.mm.height;
    const pad = 4;
    this.mmS = Math.min((W - pad * 2) / (b.maxX - b.minX), (H - pad * 2) / (b.maxZ - b.minZ));
    this.mmX = (x) => W / 2 + x * this.mmS;
    this.mmY = (z) => H / 2 + z * this.mmS;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#6d8a45'; x.fillRect(0, 0, W, H);
    if (g.terrain) {
      // arazi: yükseklik rengi + gölgelendirme, su mavi
      const T = g.terrain, img = x.createImageData(W, H);
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const wx = (px - W / 2) / this.mmS, wz = (py - H / 2) / this.mmS;
        const h = T.heightAt(wx, wz);
        const dx = T.heightAt(wx + 1.2, wz) - T.heightAt(wx - 1.2, wz), dz = T.heightAt(wx, wz + 1.2) - T.heightAt(wx, wz - 1.2);
        const sh = clamp(0.95 + (-dx - dz) * 0.09, 0.55, 1.3);
        let r, gg, b;
        if (h < -0.25) { r = 74; gg = 144; b = 184; }
        else { const t = clamp(h / 14, 0, 1); r = (109 + 50 * t) * sh; gg = (138 + 6 * t) * sh; b = (69 + 30 * t) * sh; }
        const k = (py * W + px) * 4;
        img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    }
    x.fillStyle = '#58703a';
    x.strokeStyle = '#2a3a1f'; x.lineWidth = 2; x.strokeRect(this.mmX(b.minX), this.mmY(b.minZ), (b.maxX - b.minX) * this.mmS, (b.maxZ - b.minZ) * this.mmS);
    x.fillStyle = g.map.roadColor || '#4b4f57';
    for (const r of g.map.roads || []) x.fillRect(this.mmX(r.x0), this.mmY(r.z0), (r.x1 - r.x0) * this.mmS, (r.z1 - r.z0) * this.mmS);
    for (const cl of g.map.colliders) {
      const w = cl.max[0] - cl.min[0], d = cl.max[2] - cl.min[2], h = cl.max[1] - cl.min[1];
      if (cl.max[1] < 0.5) continue;
      if (w > 60 || d > 60) continue;
      x.fillStyle = h > 4 && (w > 3 || d > 3) ? '#d6cfba' : h > 1.5 ? '#9c9482' : '#7a7566';
      x.fillRect(this.mmX(cl.min[0]), this.mmY(cl.min[2]), Math.max(1, w * this.mmS), Math.max(1, d * this.mmS));
    }
    this.mmBase = c;
  }

  killFeed(killer, victim, weapon, hs) {
    const f = this.$('killfeed');
    const d = document.createElement('div'); d.className = 'kf' + ((killer && killer.isPlayer) || (victim && victim.isPlayer) ? ' me' : '');
    const cls = (s) => (s.team === 'blue' ? 'b' : 'r');
    d.innerHTML = killer && killer !== victim
      ? `<span class="${cls(killer)}">${killer.name}</span><span class="w">[${weapon}${hs ? ' ★' : ''}]</span><span class="${cls(victim)}">${victim.name}</span>`
      : `<span class="${cls(victim)}">${victim.name}</span><span class="w">öldü</span>`;
    f.appendChild(d);
    while (f.children.length > 6) f.firstChild.remove();
    setTimeout(() => d.remove(), 6000);
  }

  toast(text, color = '#fff') {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = text; t.style.color = color;
    this.$('toasts').appendChild(t);
    setTimeout(() => t.remove(), 3300);
  }

  hitmarker(dead, head) {
    const h = this.$('hitm');
    h.classList.toggle('k', dead);
    h.style.opacity = 1;
    this.hitT = dead ? 0.35 : 0.14;
  }

  damageFrom(fromPos, me) {
    this.$('vig').style.opacity = 1;
    this.vigT = 0.25;
    if (!fromPos) return;
    const dx = fromPos.x - me.pos.x, dz = fromPos.z - me.pos.z;
    const ang = Math.atan2(dx, -dz) - (-me.yaw) ;
    // yaw artışı sola döner: ekran açısı = bakış yönüne göre göreli açı
    const rel = Math.atan2(-dx, -dz) - me.yaw;
    const a = document.createElement('div'); a.className = 'arrow';
    a.style.transform = `rotate(${(-rel * 180) / Math.PI}deg)`;
    this.$('arrows').appendChild(a);
    setTimeout(() => a.remove(), 1400);
  }

  showScoreboard(v) { this.sbShown = v; this.$('scoreboard').style.display = v ? 'flex' : 'none'; if (v) this.renderScoreboard(); }

  renderScoreboard() {
    const g = this.game;
    const col = (team) => {
      const list = g.soldiers.filter((s) => s.team === team && !s.vacant).sort((a, b) => b.score - a.score);
      return `<div class="team ${team}"><h3 style="color:var(--c)">${TEAMS[team].name} · ${Math.max(0, g.tickets[team])}</h3><table><tr><th>Oyuncu</th><th>Öl</th><th>Ölüm</th><th>Puan</th></tr>${
        list.map((s) => `<tr class="${s.isPlayer ? 'me' : ''} ${s.alive ? '' : 'dead'}"><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.score}</td></tr>`).join('')}</table></div>`;
    };
    this.$('sbbody').innerHTML = col('blue') + col('red');
  }

  setPaused(v) {
    this.$('pause').style.display = v ? 'flex' : 'none';
    if (v && this.game.time > 0.5) {
      this.$('ptitle').textContent = 'Duraklatıldı';
      this.$('ptext').textContent = 'Devam etmek için tıkla.';
      this.$('bResume').textContent = 'Devam';
    }
  }

  showEnd(win, title, info, rows) {
    this.$('etitle').textContent = title;
    this.$('etitle').style.color = win ? '#7be06f' : '#ff7b6b';
    this.$('einfo').textContent = info;
    this.$('estats').innerHTML = rows;
    this.$('endscreen').style.display = 'flex';
    this.$('pause').style.display = 'none';
    this.$('respawn').style.display = 'none';
  }

  update(dt) {
    const g = this.game, p = g.playerSoldier, $ = this.$;
    $('tkB').textContent = Math.max(0, Math.round(g.tickets.blue));
    $('tkR').textContent = Math.max(0, Math.round(g.tickets.red));
    $('tbB').style.width = clamp((g.tickets.blue / this.maxTk) * 100, 0, 100) + '%';
    $('tbR').style.width = clamp((g.tickets.red / this.maxTk) * 100, 0, 100) + '%';
    const t = Math.max(0, Math.ceil(g.timeLeft));
    $('timer').textContent = g.timeLeft === Infinity ? '∞' : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    this.drawCompass();
    if (this.zoneT > 0) { this.zoneT -= dt; if (this.zoneT <= 0) $('zonew').style.display = 'none'; }
    g.mode.objectives.forEach((o, i) => {
      const f = this.flagEls[i];
      const col = o.owner === 'blue' ? '#4aa3ff' : o.owner === 'red' ? '#ff5a43' : '#9aa0a8';
      f.style.borderColor = col;
      const pr = o.p;
      const c2 = pr > 0 ? '#4aa3ff' : '#ff5a43';
      f.querySelector('i').style.background = Math.abs(pr) > 0.02 && Math.abs(pr) < 1 ? `conic-gradient(${c2} ${Math.abs(pr) * 360}deg, transparent 0)` : 'none';
      f.firstElementChild.style.opacity = 0.55;
    });
    // oyuncu durumu
    const st = p.stat, it = p.item;
    $('hpnum').innerHTML = `${Math.max(0, Math.ceil(p.hp))}<small>HP</small>`;
    $('hpfill').style.width = clamp((p.hp / p.maxHp) * 100, 0, 100) + '%';
    $('hpfill').style.background = p.hp < 30 ? 'linear-gradient(90deg,#d63a2e,#f06a4a)' : 'linear-gradient(90deg,#3ecf5b,#7be06f)';
    $('clsname').textContent = `${CLASS_DEFS[p.cls].label} · ${TEAMS[p.team].name}`;
    $('wname').textContent = p.reloadT > 0 ? `${st.name} · dolduruluyor…` : p.useT > 0 ? `${st.name} · kullanılıyor…` : st.name;
    $('mag').textContent = it.mag;
    $('res').textContent = st.kind === 'throwable' || st.kind === 'medkit' || st.kind === 'melee' ? '' : '/ ' + it.reserve;
    $('slots').innerHTML = p.items.map((x, i) => `<div class="slot ${i === p.cur ? 'on' : ''} ${p.canEquip(i) ? '' : 'empty'}"><span><b>${i + 1}</b>${WSTATS[x.id].name}</span></div>`).join('');
    this.$('ammo').querySelector('.n').classList.toggle('low', st.mag > 1 && it.mag <= st.mag * 0.25);
    // nişangâh / örtüler
    const cross = $('cross');
    const ov = p.overlay, ads = p.adsT;
    const scopeOn = p.alive && ov === 'scope' && ads > 0.9;
    const showCross = p.alive && ads < 0.6;
    cross.style.display = showCross ? 'block' : 'none';
    cross.classList.toggle('ads', ads > 0.5);
    const spread = p.spreadNow(st) * 900;
    cross.style.setProperty('--g', clamp(3 + spread, 3, 60) + 'px');
    $('rdot').style.display = p.alive && ov === 'dot' && ads > 0.6 ? 'block' : 'none';
    $('holo').style.display = p.alive && ov === 'holo' && ads > 0.6 ? 'block' : 'none';
    const sc = $('scope');
    sc.style.display = scopeOn ? 'block' : 'none';
    if (scopeOn) sc.className = (p.opticDef.reticle === 'chevron') ? 'chev' : 'mil';
    $('advig').style.opacity = p.alive && ov !== 'scope' ? (ads * 0.55).toFixed(2) : 0;
    const stTxt = [p.prone ? 'Yatıyor' : p.crouching ? 'Çömelmiş' : '', p.leanT > 0.3 ? 'Sağa eğik' : p.leanT < -0.3 ? 'Sola eğik' : '', p.opticDef && st.kind === 'gun' ? p.opticDef.label : '', st.kind === 'gun' && st.auto ? (p.item.semi ? 'Yarı otomatik [X]' : 'Otomatik [X]') : ''].filter(Boolean).join(' · ');
    $('stance').textContent = stTxt;
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) $('hitm').style.opacity = 0; }
    if (this.vigT > 0) { this.vigT -= dt; if (this.vigT <= 0) $('vig').style.opacity = 0; }
    $('vig').style.opacity = p.alive && p.hp < 30 ? 0.55 : $('vig').style.opacity;
    // ölüm ekranı
    const rs = $('respawn');
    if (!p.alive && !g.ended) {
      rs.style.display = 'flex';
      const k = p.lastHit && p.lastHit !== p ? p.lastHit : null;
      $('rtitle').textContent = k ? 'Öldürüldün' : 'Öldün';
      $('rinfo').innerHTML = k ? `<b>${k.name}</b> · ${CLASS_DEFS[k.cls].label}<br>${k.item ? WSTATS[k.item.id].name : ''} · ${Math.ceil(k.hp)} can kaldı` : '';
      $('rcount').textContent = p.respawnT > 0 ? Math.ceil(p.respawnT) : '…';
      this.buildSpawnRow();
      this.markClass(g.pendingClass || p.cls);
    } else { rs.style.display = 'none'; this._spKey = null; }
    // mesaj
    let msg = '';
    if (p.alive) {
      for (const o of g.mode.objectives) {
        if (Math.hypot(o.x - p.pos.x, o.z - p.pos.z) < o.r) { msg = o.owner === p.team && Math.abs(o.p) >= 1 ? `${o.name} · senin` : `${o.name} · ele geçiriliyor`; break; }
      }
      if (!msg && p.stat.kind === 'medkit' && p.item.mag > 0 && g.findRevivable(p)) msg = 'Canlandır · sol tık';
      if (!msg && p.item.mag <= 0 && p.stat.kind === 'gun') msg = p.item.reserve > 0 ? 'ŞARJÖR BOŞ · R ile doldur' : 'ŞARJÖR BOŞ · mermi kalmadı!';
    }
    $('msg').textContent = msg;
    if (this.sbShown) this.renderScoreboard();
    this.drawMinimap();
  }

  drawMinimap() {
    const g = this.game, x = this.mmCtx, p = g.playerSoldier;
    x.clearRect(0, 0, this.mm.width, this.mm.height);
    x.drawImage(this.mmBase, 0, 0);
    for (const o of g.mode.objectives) {
      x.beginPath();
      x.arc(this.mmX(o.x), this.mmY(o.z), 9, 0, 6.3);
      x.fillStyle = o.owner === 'blue' ? '#4aa3ffaa' : o.owner === 'red' ? '#ff5a43aa' : '#ffffff66';
      x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.stroke();
      x.fillStyle = '#fff'; x.font = 'bold 10px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(o.label || o.name[0], this.mmX(o.x), this.mmY(o.z) + 0.5);
    }
    for (const s of g.soldiers) {
      if (!s.alive) continue;
      const friendly = s.team === p.team;
      if (!friendly && !(g.time - (s.spottedT ?? -99) < 2.5)) continue;
      x.beginPath();
      x.fillStyle = s.team === 'blue' ? '#4aa3ff' : '#ff5a43';
      x.arc(this.mmX(s.pos.x), this.mmY(s.pos.z), s.isPlayer ? 0 : 2.6, 0, 6.3);
      x.fill();
      if (!friendly) { x.strokeStyle = '#fff'; x.lineWidth = 1; x.stroke(); }
    }
    if (p.alive) {
      x.save();
      x.translate(this.mmX(p.pos.x), this.mmY(p.pos.z));
      x.rotate(-p.yaw);
      x.fillStyle = '#fff';
      x.beginPath(); x.moveTo(0, -6); x.lineTo(4.5, 5); x.lineTo(0, 2.5); x.lineTo(-4.5, 5); x.closePath(); x.fill();
      x.strokeStyle = '#000'; x.lineWidth = 1; x.stroke();
      x.restore();
    }
  }
}
