// Oyun içi sohbet (yalnızca çevrimiçi). Enter: herkese · Shift+Enter: takıma · yazarken Tab kanal değiştirir · Enter gönderir · Esc iptal.
// Sunucu mesajı temizler ve herkese/takıma dağıtır; gönderen de kendi mesajını sunucudan alır (sıra herkeste aynı).

const CSS = `
#chat{position:absolute;left:20px;bottom:150px;width:min(420px,44vw);display:flex;flex-direction:column;gap:6px;text-shadow:0 1px 3px #000}
#chlog{display:flex;flex-direction:column;gap:2px;max-height:210px;overflow:hidden;justify-content:flex-end}
#chat.open #chlog{overflow-y:auto;pointer-events:auto;background:rgba(8,11,17,.55);padding:6px 8px;border-left:2px solid rgba(255,255,255,.18)}
.cm{font-size:15px;line-height:1.25;font-weight:600;padding:2px 8px;background:rgba(8,11,17,.5);border-left:3px solid #8a93a3;word-break:break-word;transition:opacity .8s;max-width:100%}
.cm.blue{border-left-color:#5aa9ff}.cm.red{border-left-color:#ff6a5a}.cm.sys{border-left-color:#ffd27a;color:#ffd27a;font-weight:500;font-size:14px}
.cm .n{margin-right:6px}.cm.blue .n{color:#8cc4ff}.cm.red .n{color:#ff9a88}
.cm .tg{font-size:11px;letter-spacing:1.5px;color:#9fe6a8;margin-right:6px;font-weight:700}
.cm.old{opacity:0}
#chat.open .cm.old{opacity:1}
#chbox{display:none;align-items:center;gap:8px;background:rgba(8,11,17,.82);border:1px solid rgba(255,255,255,.28);padding:6px 10px;pointer-events:auto}
#chat.open #chbox{display:flex}
#chch{font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#cfe6ff;white-space:nowrap}
#chch.team{color:#9fe6a8}
#chin{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#fff;font:600 16px Bahnschrift,Rajdhani,'Segoe UI',system-ui,sans-serif;letter-spacing:.4px}
#chhint{font-size:11px;opacity:.55;letter-spacing:1px;white-space:nowrap}
`;

export class Chat {
  constructor(game) {
    this.game = game;
    this.isOpen = false; this.channel = 'all'; this.max = 60;
    const st = (this.st = document.createElement('style')); st.textContent = CSS; document.head.appendChild(st);
    const el = (this.el = document.createElement('div'));
    el.id = 'chat';
    el.innerHTML = '<div id="chlog"></div><div id="chbox"><span id="chch">Herkes</span><input id="chin" maxlength="120" autocomplete="off" spellcheck="false" placeholder="Mesaj yaz…"><span id="chhint">Enter gönder · Tab kanal · Esc iptal</span></div>';
    game.hud.root.appendChild(el);
    this.log = el.querySelector('#chlog'); this.in = el.querySelector('#chin'); this.chEl = el.querySelector('#chch');
    // yazarken oyun tuşları (W/A/S/D, 1-4, R…) çalışmasın: olaylar kutudan çıkmaz
    for (const ev of ['keydown', 'keyup', 'keypress']) this.in.addEventListener(ev, (e) => {
      e.stopPropagation();
      if (ev !== 'keydown') return;
      if (e.key === 'Enter') { e.preventDefault(); this.submit(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      else if (e.key === 'Tab') { e.preventDefault(); if (this.teamOk) this.setChannel(this.channel === 'all' ? 'team' : 'all'); }
    });
  }

  get teamOk() { return !this.game.ffa; }                                         // ölüm maçı / silah yarışı: takım yok

  setChannel(ch) {
    this.channel = ch === 'team' && this.teamOk ? 'team' : 'all';
    this.chEl.textContent = this.channel === 'team' ? 'Takım' : 'Herkes';
    this.chEl.classList.toggle('team', this.channel === 'team');
  }

  open(team) {
    if (this.isOpen || !this.game.online || this.game.ended) return;
    this.isOpen = true; this.game.chatOpen = true;
    const p = this.game.player; if (p) { p.keys.clear(); p.fireHeld = false; this.game.playerSoldier.ads = false; }       // takılı tuş / ateş kalmasın
    this.el.classList.add('open');
    this.setChannel(team ? 'team' : 'all');
    this.in.value = '';
    this.log.scrollTop = this.log.scrollHeight;
    setTimeout(() => this.in.focus(), 0);                                          // açan Enter tuşunun kendisi kutuya yazılmasın
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false; this.game.chatOpen = false;
    this.el.classList.remove('open');
    this.in.blur(); this.in.value = '';
  }

  submit() {
    const m = this.in.value.trim();
    if (m) this.game.online.send({ t: 'chat', m, tm: this.channel === 'team' });
    this.close();
  }

  // sunucudan gelen mesaj: { id, name, team, tc, m } ya da sistem mesajı { sys:1, m }
  add(m) {
    const d = document.createElement('div');
    d.className = 'cm ' + (m.sys ? 'sys' : m.team === 'red' ? 'red' : 'blue');
    if (m.sys) d.textContent = m.m;
    else {
      if (m.tc) { const t = document.createElement('span'); t.className = 'tg'; t.textContent = 'TAKIM'; d.appendChild(t); }
      const n = document.createElement('span'); n.className = 'n'; n.textContent = m.name + ':';          // textContent: HTML enjekte edilemez
      d.appendChild(n); d.appendChild(document.createTextNode(m.m));
    }
    this.log.appendChild(d);
    while (this.log.children.length > this.max) this.log.firstChild.remove();
    if (this.isOpen) this.log.scrollTop = this.log.scrollHeight;
    setTimeout(() => d.classList.add('old'), 9000);                                // kutu kapalıyken 9 sn sonra solar
    if (!m.sys && m.id !== this.game.playerSoldier?.id && this.game.sfx?.chat) this.game.sfx.chat();
  }

  dispose() { this.close(); this.el.remove(); this.st.remove(); }
}
