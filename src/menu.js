import { CLASS_DEFS, MODES, DIFFICULTY, OPTICS, OPTIC_ORDER } from './game/stats.js';

const KEY = 'blockfront.v1';
export const DEFAULTS = { mode: '10v10', team: 'blue', cls: 'assault', diff: 'normal', optic: 'reddot', sens: 0.0022, fov: 75, volume: 0.6, shadows: true };

export function loadPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return { ...DEFAULTS }; }
}
function savePrefs(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* yok say */ } }

export function showMenu(onStart) {
  const el = document.getElementById('menu');
  const p = loadPrefs();
  el.style.display = 'block';
  const opts = (items, cur, cls = '') => items.map(([k, t, s]) => `<div class="opt ${cls || k} ${cur === k ? 'on' : ''}" data-k="${k}"><b>${t}</b><small>${s || ''}</small></div>`).join('');
  el.innerHTML = `<div class="wrap">
    <h1><span>BLOCK</span><b>FRONT</b></h1>
    <div class="sub">Unturned tarzı kutu karakterlerle BattleBit usulü takım savaşı · Kasaba haritası</div>
    <div class="grid">
      <div>
        <div class="card"><h3>1 · Oyun modu</h3><div class="row" id="gMode">${opts(Object.entries(MODES).map(([k, m]) => [k, m.label, `${m.perTeam} + ${m.perTeam} oyuncu · ${m.objectives.length} hedef · ${m.tickets} bilet`]), p.mode, 'neutral')}</div></div>
        <div class="card"><h3>2 · Takım</h3><div class="row" id="gTeam">${opts([['blue', 'Mavi Takım', 'Batıdaki çiftlikte doğarsın'], ['red', 'Kırmızı Takım', 'Doğudaki depoda doğarsın']], p.team)}</div></div>
        <div class="card"><h3>3 · Sınıf</h3><div class="row" id="gCls">${opts(Object.entries(CLASS_DEFS).map(([k, d]) => [k, d.label, d.desc]), p.cls, 'neutral')}</div></div>
        <div class="card"><h3>4 · Nişangâh</h3><div class="row" id="gOptic">${opts(OPTIC_ORDER.map((k) => [k, OPTICS[k].label, k === 'iron' ? 'Arpacık + gez' : k === 'reddot' ? 'Kompakt, hızlı' : k === 'holo' ? 'Geniş pencere, halkalı' : '3x yakınlaştırma']), p.optic, 'neutral')}</div><div class="foot">Oyunda <kbd>B</kbd> ile değiştir. Keskin nişancı tüfeği her zaman 4x dürbün kullanır.</div></div>
        <div class="card"><h3>5 · Bot zorluğu</h3><div class="row" id="gDiff">${opts(Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label, '']), p.diff, 'neutral')}</div></div>
      </div>
      <div>
        <div class="card"><h3>Oda</h3>
          <div class="room"><img src="/img/kasaba.png" alt="Kasaba"/>
            <div><h4>Kasaba</h4><p><span class="tag">YEREL</span><span class="tag">BOTLU</span></p><p>Mavi çiftlik ↔ Kırmızı depo, ortada benzinlik, pazar ve kilise.</p>
            <p><span class="tag soon">YAKINDA</span>Çok oyunculu odalar</p></div></div></div>
        <button class="play" id="bPlay">OYUNA GİR</button>
        <div style="height:16px"></div>
        <div class="card"><h3>Ayarlar</h3>
          <label><span>Hassasiyet</span><input type="range" id="sSens" min="0.0008" max="0.006" step="0.0001" value="${p.sens}"><em id="vSens"></em></label>
          <label><span>Görüş açısı</span><input type="range" id="sFov" min="60" max="100" step="1" value="${p.fov}"><em id="vFov"></em></label>
          <label><span>Ses</span><input type="range" id="sVol" min="0" max="1" step="0.05" value="${p.volume}"><em id="vVol"></em></label>
          <label><span>Gölgeler</span><input type="checkbox" id="sSh" ${p.shadows ? 'checked' : ''}></label></div>
        <div class="card"><h3>Kontroller</h3><table class="keys">
          <tr><td>Hareket</td><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · koşma <kbd>Shift</kbd> · zıpla <kbd>Boşluk</kbd></td></tr>
          <tr><td>Duruş</td><td>çömel <kbd>Ctrl</kbd> / <kbd>C</kbd> · yat <kbd>Z</kbd> · kalkmak için <kbd>Boşluk</kbd></td></tr>
          <tr><td>Eğilme</td><td>sola <kbd>Q</kbd> · sağa <kbd>E</kbd> (eğilerek ateş edilir)</td></tr>
          <tr><td>Nişangâh</td><td><kbd>B</kbd> ile demir / red dot / holografik / ACOG</td></tr>
          <tr><td>Ateş / Nişan</td><td>Sol tık / Sağ tık (basılı tut)</td></tr>
          <tr><td>Şarjör</td><td><kbd>R</kbd></td></tr>
          <tr><td>Silah</td><td><kbd>1</kbd> ana · <kbd>2</kbd> tabanca · <kbd>3</kbd> gadget · <kbd>4</kbd> bıçak · fare tekeri</td></tr>
          <tr><td>Bakış (yedek)</td><td>Fare kilitlenmezse ok tuşları</td></tr>
          <tr><td>Skor tablosu</td><td><kbd>Tab</kbd> · duraklat <kbd>Esc</kbd></td></tr></table></div>
      </div>
    </div>
    <div class="foot">İpucu: hedef bölgelerinde kal, bayrağı ele geçir; dostların yanında sıhhiye varsa canın yenilenir.</div></div>`;

  const q = (s) => el.querySelector(s);
  const bindGroup = (id, key) => {
    q(id).querySelectorAll('.opt').forEach((o) => o.addEventListener('click', () => {
      p[key] = o.dataset.k;
      q(id).querySelectorAll('.opt').forEach((x) => x.classList.toggle('on', x === o));
      savePrefs(p);
    }));
  };
  bindGroup('#gMode', 'mode'); bindGroup('#gTeam', 'team'); bindGroup('#gCls', 'cls'); bindGroup('#gDiff', 'diff'); bindGroup('#gOptic', 'optic');
  const slider = (id, vid, key, fmt) => {
    const s = q(id), v = q(vid);
    const upd = () => { p[key] = +s.value; v.textContent = fmt(+s.value); savePrefs(p); };
    s.addEventListener('input', upd); v.textContent = fmt(+s.value);
  };
  slider('#sSens', '#vSens', 'sens', (x) => (x / 0.0022).toFixed(2) + '×');
  slider('#sFov', '#vFov', 'fov', (x) => x + '°');
  slider('#sVol', '#vVol', 'volume', (x) => Math.round(x * 100) + '%');
  q('#sSh').addEventListener('change', (e) => { p.shadows = e.target.checked; savePrefs(p); });
  q('#bPlay').addEventListener('click', () => { el.style.display = 'none'; onStart({ mode: p.mode, team: p.team, cls: p.cls, diff: p.diff, optic: p.optic, settings: { sens: p.sens, fov: p.fov, volume: p.volume, shadows: p.shadows, pixelRatio: 1.5 } }); });
}
