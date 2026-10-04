// Müzik: dosya tabanlı (sentez yok). public/audio/music/ altına eklenen dosyalar otomatik çalar; dosya yoksa sessiz kalır (hata vermez).
//   lobby  → ana menü / lobi           : audio/music/lobby.mp3 (ya da .ogg)
//   match  → maç içi (sırayla / karışık): audio/music/match1.mp3, match2.mp3, match3.mp3 (varsa)
// Yeni bir kanal/ad eklemek için TRACKS'e yaz; çalmak için music.play('ad'). Sesi Ayarlar → Müzik ve Ana ses belirler.
const TRACKS = {
  lobby: ['lobby'],
  match: ['match1', 'match2', 'match3'],
};
const EXT = ['mp3', 'ogg', 'm4a'];
const BASE = '/audio/music/';

const exists = new Map();
async function probe(url) {
  if (exists.has(url)) return exists.get(url);
  let ok = false;
  try {
    const r = await fetch(url, { method: 'HEAD' });
    ok = r.ok && /audio|ogg|mpeg|octet/i.test(r.headers.get('content-type') || '');
  } catch (e) { ok = false; }
  exists.set(url, ok);
  return ok;
}

class Music {
  constructor() { this.vol = 0.3; this.audio = null; this.group = null; this.token = 0; }

  setVolume(v) { this.vol = Math.max(0, Math.min(1, v)); if (this.audio) this.audio.volume = this.vol; }

  // grup çalmaya başlar (zaten çalıyorsa dokunmaz); dosya bulunamazsa hiçbir şey olmaz
  async play(group) {
    if (this.group === group && this.audio) return;
    this.stop();
    this.group = group;
    const tok = ++this.token;
    const names = (TRACKS[group] || []).slice();
    for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    const found = [];
    for (const n of names) for (const e of EXT) { const u = `${BASE}${n}.${e}`; if (await probe(u)) { found.push(u); break; } if (tok !== this.token) return; }
    if (!found.length || tok !== this.token) return;
    let i = 0;
    const next = () => {
      if (tok !== this.token) return;
      const a = new Audio(found[i++ % found.length]);
      a.volume = this.vol;
      a.loop = found.length === 1;
      a.onended = next;
      this.audio = a;
      a.play().catch(() => {                                    // tarayıcı otomatik oynatmayı engelledi: ilk tıklama/tuşta dene
        const retry = () => { removeEventListener('pointerdown', retry, true); removeEventListener('keydown', retry, true); if (tok === this.token) a.play().catch(() => {}); };
        addEventListener('pointerdown', retry, true); addEventListener('keydown', retry, true);
      });
    };
    next();
  }

  stop() {
    this.token++;
    this.group = null;
    if (this.audio) { try { this.audio.pause(); } catch (e) { /* yok say */ } this.audio.onended = null; this.audio = null; }
  }
}

export const music = new Music();
