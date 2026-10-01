import { TEAMS } from '../core/palette.js';
import { WSTATS, CLASS_DEFS } from './stats.js';
import { clamp } from './util.js';

const CSS = `
#hud{position:fixed;inset:0;pointer-events:none;font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#fff;user-select:none;z-index:5}
#hud *{box-sizing:border-box}
.blue{--c:#4aa3ff}.red{--c:#ff5a43}
#minimap{position:absolute;left:14px;top:14px;border:2px solid rgba(255,255,255,.35);border-radius:6px;background:#2a3a1f;box-shadow:0 2px 10px rgba(0,0,0,.5)}
#topbar{position:absolute;left:50%;top:10px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
#score{display:flex;align-items:center;gap:0;background:rgba(10,14,20,.62);border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.4)}
#score .tk{min-width:96px;padding:6px 14px;font-weight:800;font-size:24px;text-align:center}
#score .tk small{display:block;font-size:10px;font-weight:600;opacity:.8;letter-spacing:.8px}
#score .tk.blue{background:linear-gradient(90deg,#1d4f86aa,#1d4f8666);color:#9fd0ff}
#score .tk.red{background:linear-gradient(270deg,#8a2a1eaa,#8a2a1e66);color:#ffb3a6}
#timer{padding:0 14px;font-size:18px;font-weight:700;min-width:70px;text-align:center}
#flags{display:flex;gap:8px}
.flag{width:34px;height:34px;border-radius:50%;background:rgba(10,14,20,.62);border:3px solid #888;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;position:relative}
.flag i{position:absolute;inset:-3px;border-radius:50%}
#killfeed{position:absolute;right:14px;top:14px;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.kf{background:rgba(10,14,20,.6);padding:4px 10px;border-radius:5px;font-size:14px;animation:kf 6s forwards;white-space:nowrap}
.kf .b{color:#8cc4ff}.kf .r{color:#ff9a88}.kf .w{opacity:.75;font-size:12px;margin:0 6px}
@keyframes kf{0%{opacity:0;transform:translateX(20px)}5%{opacity:1;transform:none}85%{opacity:1}100%{opacity:0}}
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
#vitals{position:absolute;left:18px;bottom:18px;width:260px}
#vitals .cls{font-size:13px;opacity:.85;margin-bottom:3px;text-shadow:0 1px 3px #000}
#hpbar{height:14px;background:rgba(0,0,0,.5);border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,.25)}
#hpfill{height:100%;background:linear-gradient(90deg,#3ecf5b,#7be06f);width:100%;transition:width .15s}
#hpnum{font-size:30px;font-weight:800;text-shadow:0 1px 4px #000;line-height:1.1}
#ammo{position:absolute;right:20px;bottom:18px;text-align:right;text-shadow:0 1px 4px #000}
#ammo .n{font-size:44px;font-weight:800;line-height:1}
#ammo .n small{font-size:22px;opacity:.75;font-weight:600}
#ammo .nm{font-size:14px;opacity:.9;margin-bottom:2px}
#slots{display:flex;gap:6px;justify-content:flex-end;margin-top:8px}
.slot{padding:3px 8px;border-radius:4px;background:rgba(10,14,20,.55);font-size:12px;border:1px solid transparent;opacity:.75}
.slot.on{border-color:#fff;opacity:1;background:rgba(40,60,90,.7)}
#toasts{position:absolute;left:50%;top:128px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px}
.toast{padding:6px 16px;border-radius:6px;background:rgba(10,14,20,.7);font-weight:700;font-size:16px;animation:ts 3.2s forwards}
@keyframes ts{0%{opacity:0;transform:translateY(-8px)}8%{opacity:1;transform:none}85%{opacity:1}100%{opacity:0}}
#msg{position:absolute;left:50%;top:62%;transform:translateX(-50%);font-size:15px;font-weight:700;text-shadow:0 1px 4px #000;opacity:.95}
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
#stance{margin-top:3px;font-size:12px;opacity:.85;text-shadow:0 1px 3px #000;min-height:15px}
.overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(5,8,12,.62);pointer-events:auto}
.panel{background:rgba(14,20,30,.92);border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:22px 28px;min-width:380px;max-width:92vw;box-shadow:0 10px 40px rgba(0,0,0,.6)}
.panel h2{margin:0 0 6px;font-size:28px}.panel p{margin:4px 0;opacity:.85}
.btn{pointer-events:auto;cursor:pointer;background:#2f6fdb;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:15px;font-weight:700;margin:8px 6px 0 0}
.btn.sec{background:#3a4252}.btn:hover{filter:brightness(1.15)}
#respawn .clsrow{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.cc{pointer-events:auto;cursor:pointer;flex:1;min-width:112px;background:#1d2635;border:2px solid #34405a;border-radius:8px;padding:8px 10px;font-size:13px;text-align:left}
.cc b{display:block;font-size:14px}.cc.on{border-color:#fff;background:#27375a}.cc small{opacity:.7;display:block;margin-top:2px}
#scoreboard table{border-collapse:collapse;width:100%;font-size:14px}
#scoreboard td,#scoreboard th{padding:4px 10px;text-align:right}
#scoreboard td:first-child,#scoreboard th:first-child{text-align:left}
#scoreboard .team{display:inline-block;vertical-align:top;margin:0 10px;min-width:330px}
#scoreboard h3{margin:0 0 6px}#scoreboard tr.me{background:rgba(255,255,255,.14);font-weight:700}
#scoreboard tr.dead{opacity:.5}
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
      <canvas id="minimap" width="220" height="158"></canvas>
      <div id="topbar">
        <div id="score"><div class="tk blue"><small>MAVİ</small><span id="tkB">0</span></div><div id="timer">0:00</div><div class="tk red"><small>KIRMIZI</small><span id="tkR">0</span></div></div>
        <div id="flags"></div>
      </div>
      <div id="killfeed"></div>
      <div id="toasts"></div>
      <div id="vig"></div><div id="arrows"></div>
      <div id="advig"></div>

      <div id="cross"><span class="h l"></span><span class="h r"></span><span class="v t"></span><span class="v b"></span><span class="dot"></span></div>
      <div id="rdot"></div><div id="holo"><i></i><i></i><i></i><i></i></div><div id="hitm"></div>
      <div id="msg"></div>
      <div id="vitals"><div class="cls" id="clsname"></div><div id="stance"></div><div id="hpnum">100</div><div id="hpbar"><div id="hpfill"></div></div></div>
      <div id="ammo"><div class="nm" id="wname"></div><div class="n"><span id="mag">0</span> <small id="res">/ 0</small></div><div id="slots"></div></div>
      <div id="respawn" class="overlay"><div class="panel"><h2 id="rtitle">Öldün</h2><p id="rinfo"></p><p id="rcount" style="font-size:20px;font-weight:700"></p>
        <p style="opacity:.7;font-size:13px">Sınıf seç (1-5) · doğmak için bekle</p><div class="clsrow" id="clsrow"></div></div></div>
      <div id="scoreboard" class="overlay"><div class="panel" style="min-width:760px;text-align:center"><div id="sbbody"></div></div></div>
      <div id="pause" class="overlay"><div class="panel"><h2 id="ptitle">Hazır mısın?</h2><p id="ptext">Başlamak için tıkla. Fare ekrana kilitlenir, Esc ile duraklatırsın.</p>
        <button class="btn" id="bResume">Başla</button><button class="btn sec" id="bQuit">Ana Menü</button></div></div>
      <div id="endscreen" class="overlay"><div class="panel"><h2 id="etitle"></h2><p id="einfo"></p><div id="estats" style="margin:10px 0"></div>
        <button class="btn" id="bAgain">Tekrar Oyna</button><button class="btn sec" id="bMenu">Ana Menü</button></div></div>`;
    document.body.appendChild(el);
    this.$ = (id) => el.querySelector('#' + id);
    this.flagEls = [];
    for (const o of game.mode.objectives) {
      const f = document.createElement('div');
      f.className = 'flag'; f.innerHTML = `<i></i><span>${o.name[0]}</span>`; f.title = o.name;
      this.$('flags').appendChild(f);
      this.flagEls.push(f);
    }
    this.buildClassRow();
    this.mm = this.$('minimap');
    this.mmCtx = this.mm.getContext('2d');
    this.buildMinimapBase();
    this.hitT = 0; this.sel = null;
    this.$('bResume').onclick = () => game.requestLock();
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
      c.innerHTML = `<b>${i + 1}. ${d.label}</b><small>${d.desc}</small>`;
      c.onclick = () => this.game.requestClass(k);
      row.appendChild(c);
    });
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
    x.fillStyle = '#58703a';
    x.strokeStyle = '#2a3a1f'; x.lineWidth = 2; x.strokeRect(this.mmX(b.minX), this.mmY(b.minZ), (b.maxX - b.minX) * this.mmS, (b.maxZ - b.minZ) * this.mmS);
    x.fillStyle = '#4b4f57';
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
    const d = document.createElement('div'); d.className = 'kf';
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
      const list = g.soldiers.filter((s) => s.team === team).sort((a, b) => b.score - a.score);
      return `<div class="team ${team}"><h3 style="color:var(--c)">${TEAMS[team].name} · ${Math.max(0, g.tickets[team])}</h3><table><tr><th>Oyuncu</th><th>Ö</th><th>Ö.</th><th>Puan</th></tr>${
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
    const t = Math.max(0, Math.ceil(g.timeLeft));
    $('timer').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
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
    $('hpnum').textContent = Math.max(0, Math.ceil(p.hp));
    $('hpfill').style.width = clamp((p.hp / p.maxHp) * 100, 0, 100) + '%';
    $('hpfill').style.background = p.hp < 30 ? 'linear-gradient(90deg,#d63a2e,#f06a4a)' : 'linear-gradient(90deg,#3ecf5b,#7be06f)';
    $('clsname').textContent = `${CLASS_DEFS[p.cls].label} · ${TEAMS[p.team].name}`;
    $('wname').textContent = p.reloadT > 0 ? `${st.name} · dolduruluyor…` : p.useT > 0 ? `${st.name} · kullanılıyor…` : st.name;
    $('mag').textContent = it.mag;
    $('res').textContent = st.kind === 'throwable' || st.kind === 'medkit' || st.kind === 'melee' ? '' : '/ ' + it.reserve;
    $('slots').innerHTML = p.items.map((x, i) => `<div class="slot ${i === p.cur ? 'on' : ''}">${i + 1} ${WSTATS[x.id].name}</div>`).join('');
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
    const stTxt = [p.prone ? 'Yatıyor' : p.crouching ? 'Çömelmiş' : '', p.leanT > 0.3 ? 'Sağa eğik' : p.leanT < -0.3 ? 'Sola eğik' : '', p.opticDef && st.kind === 'gun' ? p.opticDef.label : ''].filter(Boolean).join(' · ');
    $('stance').textContent = stTxt;
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) $('hitm').style.opacity = 0; }
    if (this.vigT > 0) { this.vigT -= dt; if (this.vigT <= 0) $('vig').style.opacity = 0; }
    $('vig').style.opacity = p.alive && p.hp < 30 ? 0.55 : $('vig').style.opacity;
    // ölüm ekranı
    const rs = $('respawn');
    if (!p.alive && !g.ended) {
      rs.style.display = 'flex';
      const k = p.lastHit && p.lastHit !== p ? p.lastHit : null;
      $('rtitle').textContent = k ? `${k.name} seni öldürdü` : 'Öldün';
      $('rinfo').textContent = k ? `${CLASS_DEFS[k.cls].label} · ${k.item ? WSTATS[k.item.id].name : ''} · ${Math.ceil(k.hp)} can kaldı` : '';
      $('rcount').textContent = p.respawnT > 0 ? `Yeniden doğuş: ${Math.ceil(p.respawnT)}` : 'Doğuluyor…';
      this.markClass(g.pendingClass || p.cls);
    } else rs.style.display = 'none';
    // mesaj
    let msg = '';
    if (p.alive) {
      for (const o of g.mode.objectives) {
        if (Math.hypot(o.x - p.pos.x, o.z - p.pos.z) < o.r) { msg = o.owner === p.team && Math.abs(o.p) >= 1 ? `${o.name} · senin` : `${o.name} · ele geçiriliyor`; break; }
      }
      if (!msg && p.item.mag <= 0 && p.stat.kind === 'gun') msg = p.item.reserve > 0 ? 'Doldurmak için R' : 'Mermi bitti!';
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
      x.fillText(o.name[0], this.mmX(o.x), this.mmY(o.z) + 0.5);
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
