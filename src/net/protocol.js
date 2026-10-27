// Ağ protokolü — sunucu ve istemci ortak. Şimdilik JSON (okunabilir, hata ayıklaması kolay); sonra ikiliye geçilebilir.
//
// İstemci → sunucu
//   { t:'join',  room:'ABCD', name }                 mevcut odaya katıl
//   { t:'create', name, cfg:{map,tod,weather,perTeam,type,tickets,time,diff}, team? }   yeni oda
//   { t:'opt', cls?, loadout?, spawn?, zt? }                 sonraki doğuş için sınıf/yükleme/doğma noktası
//   { t:'in', q, f, r, l, s, j, a, yw, pt, c, p, u }  girdi (her sim adımında bir tane)
//        q: sıra no · f/r: ileri/sağ (-1..1) · l: yana eğilme · s: koşma · j: zıpla · dn: dal (12.180, yüzerken çömel basılı) · a: nişan
//        yw/pt: bakış (rad) · c/p/u: çömel/yat/kalk tuşuna basıldı (kenar olayı)
//        sd: 1 = 3. şahıs sol omuz duruşu (yalnızca görsel; diğer oyuncular aynalı duruşu görsün)
//        co: [x,y,z] 3. şahıs kamerada kameranın gözden ofseti (nişan noktası; mermi yine gözden çıkar; odada izinliyse)
//        ve: 1 = araca bin / in (E) · vs: koltuk 1–4 · vl: far aç / kapa (12.177; sürücüde f / r = gaz / direksiyon, j = fren, fh = korna)
//        ab: 1 = zombi özel gücü (F / sağ tık) tuşuna basıldı · w: seçili silah · fh: ateş basılı · fp: ateşe yeni basıldı · rl: şarjör · fm: atış modu · o: nişangâh · vt: görülen sunucu adımı (lag compensation)
// Sunucu → istemci
//   { t:'welcome', id, room, cfg, roster, st }        id = senin savaşçı numaran
//   { t:'roster', roster }                            biri girip/çıkınca
//   { t:'snap', k, ack, me, s:[...], tk, tl, o }      anlık durum (bkz. packSoldier)
//   { t:'ev', l:[...] }                               olaylar (sh atış, hm isabet, dmg hasar, kill, rld, swg)
//   { t:'err', msg }

import { ZT_ORDER, SKIN_IDS, OPTIC_IDS } from '../game/stats.js';
import { CLASS_WEAR, wearCodeOf, wearEncode } from '../game/wearIds.js';

export const SIM_HZ = 60;               // sunucu ve istemci sabit sim adımı
export const SIM_DT = 1 / SIM_HZ;
export const SNAP_EVERY = 3;            // her 3 adımda bir snapshot = 20 Hz
export const DEFAULT_PORT = 8787;

const q2 = (v) => Math.round(v * 100) / 100;
const q3 = (v) => Math.round(v * 1000) / 1000;

// bayrak bitleri
export const F_CROUCH = 1, F_PRONE = 2, F_SPRINT = 4, F_ADS = 8, F_GROUND = 16, F_LEFT = 32, F_CLOAK = 64, F_PROT = 128, F_TORCH = 256;   // F_TORCH (12.159): fener açık (sunucu: ölü / zombide hep 0; eski istemci bu biti yok sayar) · F_LEFT: 3. şahıs sol omuz duruşu (görsel)

export function packFlags(s) {
  return (s.crouching ? F_CROUCH : 0) | (s.prone ? F_PRONE : 0) | (s.sprinting ? F_SPRINT : 0) | (s.ads ? F_ADS : 0) | (s.onGround ? F_GROUND : 0) | (s.stanceLeft ? F_LEFT : 0) | (s.cloaked ? F_CLOAK : 0) | (s.protT > 0 ? F_PROT : 0) | (s.flashOn && s.alive && !s.def?.zombie ? F_TORCH : 0);
}

// Bir savaşçının ağ durumu (kompakt anahtarlar)
// slow=false: yavaş değişen alanlar (eşyalar, skor, can üst sınırı, zombi türü, seviye…) çıkarılır → anlık görüntü ~%45 küçülür.
// Sunucu bu alanları yalnızca değişince (ya da periyodik/yeni katılımda) yollar; istemci `it` yoksa onları değiştirmez. Kendi durumun (me.now / ack) her zaman tam.
export function packSoldier(s, slow = true) {
  const o = {
    i: s.id,
    x: q2(s.pos.x), y: q2(s.pos.y), z: q2(s.pos.z),
    vx: q2(s.vel.x), vy: q2(s.vel.y), vz: q2(s.vel.z),
    yw: q3(s.yaw), pt: q3(s.pitch),
    a: s.alive ? 1 : 0, hp: Math.round(s.hp),
    f: packFlags(s), l: s.leanDir, c: s.cur,
  };
  if (s.veh) o.v = s.veh.idx * 4 + s.seat + 1;                         // 12.177: araçta (araç sırası · 4 + koltuk + 1); yoksa alan yazılmaz → diğer haritalarda paket aynı
  if (slow) {
    o.mh = s.maxHp; o.gl = s.ggLevel; o.zt = s.def.zombie ? ZT_ORDER.indexOf(s.ztype) + 1 : 0; o.bs = s.boss ? 1 : 0; o.zl = s.zLives;
    o.it = s.items.map((it) => it.id);
    o.kl = s.kills; o.de = s.deaths; o.sc = s.score; o.rv = s.revivable ? 1 : 0;
    if (s.assists) o.as = s.assists;                                    // 12.165 asist sayısı (0 ise yazılmaz; eski sunucu yollamaz → istemci 0 sayar)
    const sk = skinCode(s); if (sk) o.sk = sk;
    const op = opticCode(s); if (op) o.op = op;                         // 12.174: eşya başına nişangâh (3. şahıs modeli; eski istemci yok sayar)
    const wr = wearNet(s); if (wr) o.wr = wr;                           // 12.167 kıyafet kodu (yalnız insan; bot → istemci kimlikten üretir; eski istemci yok sayar)
  }
  return o;
}
// Silah kaplamaları (12.122): eşya sırasıyla kaplama numarası ('3000' = 1. silah altın); hepsi standartsa gönderilmez → yalnız yavaş alanlarda, birkaç bayt
export function skinCode(s) { if (!s.skins) return ''; const c = s.items.map((it) => Math.max(0, SKIN_IDS.indexOf(s.skins[it.id] || 'std'))).join(''); return /[1-9]/.test(c) ? c : ''; }
export function skinsFrom(code, ids) { if (!code) return null; const r = {}; ids.forEach((id, i) => { const k = SKIN_IDS[+code[i] || 0]; if (k && k !== 'std') r[id] = k; }); return Object.keys(r).length ? r : null; }
// 12.167: insan oyuncunun şu anki sınıfının kıyafet kodu (seçmediyse sınıf varsayılanı → istemci bot çeşitlemesi yerine varsayılanı çizer); zombi / bot: yok
export function wearNet(s) { if (!s.human || s.def?.zombie || !CLASS_WEAR[s.cls]) return ''; return wearCodeOf(s.wear, s.cls) || wearEncode(CLASS_WEAR[s.cls]); }
// Nişangâhlar (12.174): eşya sırasıyla OPTIC_IDS sıra numarası (36 tabanı, tek karakter; nişangâhsız eşya '-'), örn. ww_bolt + tabanca → 'a0'
export function opticCode(s) { if (!s.opticFor) return ''; const c = s.items.map((it) => { const o = s.opticFor(it.id), i = o ? OPTIC_IDS.indexOf(o) : -1; return i >= 0 ? i.toString(36) : '-'; }).join(''); return /[0-9a-z]/.test(c) ? c : ''; }
export function opticsFrom(code, ids) { const r = {}; if (!code) return r; ids.forEach((id, i) => { const c = code[i], o = c && c !== '-' ? OPTIC_IDS[parseInt(c, 36)] : null; if (o) r[id] = o; }); return r; }
// yavaş alanların imzası: değişince o savaşçı tam paketlenir
export function slowSig(s) {
  return s.maxHp + '|' + s.ggLevel + '|' + (s.def.zombie ? s.ztype : '') + (s.boss ? 'B' : '') + '|' + s.zLives + '|' + s.items.map((it) => it.id).join() + '|' + s.kills + '|' + s.deaths + '|' + (s.assists || 0) + '|' + s.score + '|' + (s.revivable ? 1 : 0) + '|' + skinCode(s) + '|' + opticCode(s) + '|' + wearNet(s);
}

export function applyFlags(s, f) {
  s.crouching = !!(f & F_CROUCH); s.prone = !!(f & F_PRONE); s.sprinting = !!(f & F_SPRINT);
  s.ads = !!(f & F_ADS); s.onGround = !!(f & F_GROUND); s.cloakNet = !!(f & F_CLOAK); s.protNet = !!(f & F_PROT); s.flashNet = !!(f & F_TORCH);
}

// Varsayılan sunucu adresi: sayfa HTTPS ile açıldıysa aynı alan adındaki /ws (ters vekil), değilse :8787
export function defaultServerUrl() {
  const loc = globalThis.location;
  if (!loc) return `ws://127.0.0.1:${DEFAULT_PORT}`;
  if (loc.protocol === 'https:') return `wss://${loc.host}/ws`;                       // TLS ters vekilin arkasında
  const dev = ['5173', '5180', '4173'].includes(loc.port);                            // Vite geliştirme/önizleme sunucusu
  if (!dev && loc.port) return `ws://${loc.host}`;                                    // oyun sunucunun kendi portundan servis ediliyor
  if (!dev) return `ws://${loc.host}/ws`;                                             // 80 portunda ters vekil
  return `ws://${loc.hostname || '127.0.0.1'}:${DEFAULT_PORT}`;
}
// Oyun bağlantısı Cloudflare'siz: HTTPS sayfada ws.<alan adı> (DNS only kaydı, doğrudan sunucu). Cloudflare'in ücretsiz planı Türkiye
// trafiğini Amsterdam'dan dolaştırıyordu (TR sunucuya ~138 ms, doğrudan ~32 ms). Ulaşılamazsa NetClient aynı alan adındaki /ws'e döner.
export function directServerUrl() {
  const loc = globalThis.location;
  if (!loc || loc.protocol !== 'https:') return null;
  const h = loc.hostname.replace(/^www\./, '');
  if (!h.includes('.') || /^[\d.]+$/.test(h) || h.startsWith('ws.')) return null;
  return `wss://ws.${h}/ws`;
}
// ws(s)://host[:port][/ws]  →  http(s)://host[:port]/health
export function healthUrl(wsUrl) {
  const u = new URL(wsUrl);
  u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
  u.pathname = '/health'; u.search = '';
  return u.toString();
}

// Oda kodu: karışması kolay harfler çıkarılmış
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export function makeRoomCode(rand = Math.random) {
  let c = '';
  for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  return c;
}
export const cleanName = (n) => String(n || 'Oyuncu').replace(/[<>&"'`]/g, '').trim().slice(0, 16) || 'Oyuncu';
// Hesap adı kuralı (istemci + sunucu ortak): 3–16 karakter, harf / rakam / _ / Türkçe harfler
export const ACCT_NAME_RE = /^[A-Za-z0-9_çğıöşüÇĞİÖŞÜ]{3,16}$/;
