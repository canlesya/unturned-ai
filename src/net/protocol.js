// Ağ protokolü — sunucu ve istemci ortak. Şimdilik JSON (okunabilir, hata ayıklaması kolay); sonra ikiliye geçilebilir.
//
// İstemci → sunucu
//   { t:'join',  room:'ABCD', name }                 mevcut odaya katıl
//   { t:'create', name, cfg:{map,tod,weather,perTeam,type,tickets,time,diff}, team? }   yeni oda
//   { t:'opt', cls?, loadout?, spawn? }                 sonraki doğuş için sınıf/yükleme/doğma noktası
//   { t:'in', q, f, r, l, s, j, a, yw, pt, c, p, u }  girdi (her sim adımında bir tane)
//        q: sıra no · f/r: ileri/sağ (-1..1) · l: yana eğilme · s: koşma · j: zıpla · a: nişan
//        yw/pt: bakış (rad) · c/p/u: çömel/yat/kalk tuşuna basıldı (kenar olayı)
//        co: [x,y,z] 3. şahıs kamerada kameranın gözden ofseti (atış kameradan çıkar; odada izinliyse)
//        w: seçili silah · fh: ateş basılı · fp: ateşe yeni basıldı · rl: şarjör · fm: atış modu · o: nişangâh · vt: görülen sunucu adımı (lag compensation)
// Sunucu → istemci
//   { t:'welcome', id, room, cfg, roster, st }        id = senin savaşçı numaran
//   { t:'roster', roster }                            biri girip/çıkınca
//   { t:'snap', k, ack, me, s:[...], tk, tl, o }      anlık durum (bkz. packSoldier)
//   { t:'ev', l:[...] }                               olaylar (sh atış, hm isabet, dmg hasar, kill, rld, swg)
//   { t:'err', msg }

export const SIM_HZ = 60;               // sunucu ve istemci sabit sim adımı
export const SIM_DT = 1 / SIM_HZ;
export const SNAP_EVERY = 3;            // her 3 adımda bir snapshot = 20 Hz
export const DEFAULT_PORT = 8787;

const q2 = (v) => Math.round(v * 100) / 100;
const q3 = (v) => Math.round(v * 1000) / 1000;

// bayrak bitleri
export const F_CROUCH = 1, F_PRONE = 2, F_SPRINT = 4, F_ADS = 8, F_GROUND = 16;

export function packFlags(s) {
  return (s.crouching ? F_CROUCH : 0) | (s.prone ? F_PRONE : 0) | (s.sprinting ? F_SPRINT : 0) | (s.ads ? F_ADS : 0) | (s.onGround ? F_GROUND : 0);
}

// Bir savaşçının ağ durumu (kompakt anahtarlar)
export function packSoldier(s) {
  return {
    i: s.id,
    x: q2(s.pos.x), y: q2(s.pos.y), z: q2(s.pos.z),
    vx: q2(s.vel.x), vy: q2(s.vel.y), vz: q2(s.vel.z),
    yw: q3(s.yaw), pt: q3(s.pitch),
    a: s.alive ? 1 : 0, hp: Math.round(s.hp),
    f: packFlags(s), l: s.leanDir, c: s.cur,
    it: s.items.map((it) => it.id),
    kl: s.kills, de: s.deaths, sc: s.score, rv: s.revivable ? 1 : 0,
  };
}

export function applyFlags(s, f) {
  s.crouching = !!(f & F_CROUCH); s.prone = !!(f & F_PRONE); s.sprinting = !!(f & F_SPRINT);
  s.ads = !!(f & F_ADS); s.onGround = !!(f & F_GROUND);
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
