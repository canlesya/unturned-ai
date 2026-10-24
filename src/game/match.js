// Maç türleri ve ayarları. Özel maçta her şey serbest (perTeam 1–32).
export const MATCH_TYPES = {
  conquest: { label: 'Ele Geçirme', desc: 'Bayrakları ele geçir, düşman biletlerini erit.' },
  tdm: { label: 'Takım Çatışması', desc: 'Bayrak yok: sadece öldür. Takım skoru her öldürmede artar; skor sınırına ilk ulaşan kazanır.' },
  inf: { label: 'Enfekte', desc: '1–2 dev BOSS zombi başlar. İnsan 1 ölümle zombi olur, zombi 1 ölümle (boss 3 ölümle) insana döner. Son insan düşerse zombiler, süre dolarsa ya da tüm zombiler iyileşirse insanlar kazanır.' },
  gg: { label: 'Silah Yarışı', desc: 'Herkes tek. Her öldürmede bir sonraki silah; 15. silah bıçak. Bıçakla öldürülen bir seviye geriler; bıçakla ilk öldüren kazanır (en çok 10 kişi).' },
  dm: { label: 'Ölüm Maçı', desc: 'Herkes tek. Rastgele doğ, ilk 40 öldürmeye ulaşan kazanır (en çok 10 kişi).' },
  payload: { get label() { return t('payload.label'); }, get desc() { return t('payload.desc'); } },     // Vagon: Mavi saldırır (vagonu iter), Kırmızı savunur (src/game/payload.js)
  space: { get label() { return t('space.label'); }, get desc() { return t('space.desc'); } },     // 12.157 Uzay: takım çatışması (tdm kuralları) + düşük yer çekimi + enerji silahları + uzay kıyafeti (src/game/space.js)
  front: { get label() { return t('mode.front.label'); }, get desc() { return t('mode.front.desc'); } },        // Cephe: sektör sektör ilerleme, Mavi saldırır (src/game/front.js)
  pb: { label: 'Paintball', desc: 'Herkes tek, herkesin kendi boya rengi. Sabit boya silahları, Boya Kulesi\'nde üç kat: zemin siperleri, kaleler, kule tepesi. Kuyuya düşen elenir; ilk 30 elemeye ulaşan kazanır.' },
};
import { LIMITS } from './balance.js';
import { t } from '../i18n/index.js';
import '../i18n/payload.js';
import '../i18n/space.js';
import '../i18n/front.js';
import { WSTATS } from './stats.js';

export const DM_KILLS = 40, DM_MAX = 10;                 // varsayılanlar; oyun LIMITS'i okur (admin paneli)
export const GG_LEN = 15;                                    // stats.js → GG_LADDER.length (bağımlılık olmasın diye sabit; test eşitliği doğrular)
export const INF_MAX = 24, INF_MIN = 4;                                  // Enfekte: toplam oyuncu (çift sayı)
// Oyuncu sayısı seçici 'takım başına' değil 'toplam' olan modlar (cfg.perTeam = toplam)
export const isTotalType = (t) => t === 'dm' || t === 'inf' || t === 'gg' || t === 'pb';
export const totalMax = (t) => (t === 'inf' ? LIMITS.infMax : t === 'pb' ? LIMITS.pbMax : LIMITS.dmMax);
export const totalMin = (t) => (t === 'inf' ? LIMITS.infMin : t === 'pb' ? LIMITS.pbMin : 2);
// Paintball sabit teçhizatı (sınıf / silah seçimi yok): boya silahları (pbrifle markör + pbpistol) tanımlıysa onlar, değilse geçici mp5 + tabanca. Gadget yok.
export const PB_LOADOUT = () => (WSTATS.pbrifle && WSTATS.pbpistol ? ['pbrifle', 'pbpistol', 'knife'] : ['mp5', 'pistol', 'knife']);
export const pbItems = () => PB_LOADOUT().map((id) => (WSTATS[id].kind === 'melee' ? { id, mag: 1, reserve: 0 } : { id, mag: WSTATS[id].mag, reserve: WSTATS[id].reserve }));
export const TODS_LIST = [['day', 'Gündüz'], ['sunset', 'Gün batımı'], ['night', 'Gece']];
export const PRESETS = {
  '3v3': { label: 'Hızlı Maç 3v3', perTeam: 3, tickets: 60, time: 600 },
  '10v10': { label: 'Büyük Savaş 10v10', perTeam: 10, tickets: 200, time: 900 },
};
// Skor tabanlı modlarda (TDM) 'tickets' alanı skor sınırıdır; takım skorları 0'dan yukarı sayar
export const isScoreType = (t) => t === 'tdm' || t === 'space';
export function defaultScoreLimit(perTeam) { return Math.max(30, Math.min(150, perTeam * 10)); }
export function frontTickets(perTeam) { return Math.max(60, Math.round(perTeam * LIMITS.frTickets / 10) * 10); }   // Cephe: saldıranın başlangıç bileti (oyuncu başına LIMITS.frTickets)
export function defaultTickets(perTeam) { return Math.max(40, Math.round(perTeam * 20 / 10) * 10); }
// Herkes-tek sıralaması (Ölüm Maçı / Silah Yarışı / boya): skor kutusu, skor tablosu, maç sonu ve süre bitiminde kazanan aynı ölçütü kullanır
export const ffaMetric = (s, gg) => (gg ? s.ggLevel + 1 : s.kills);          // gg: seviye (1..15), değilse öldürme
export const ffaRanking = (soldiers, gg) => soldiers.filter((s) => !s.vacant).sort((a, b) => (gg ? b.ggLevel - a.ggLevel : 0) || b.kills - a.kills || b.score - a.score);
export function makeMatch(o = {}) {
  if (o.type === 'space') return { ...makeMatch({ ...o, type: 'tdm' }), type: 'space', space: true };      // 12.157 Uzay: tdm kuralları (skor sınırı / süre) + mode.space (yer çekimi, silahlar, kıyafet)
  const fr = o.type === 'front';                                    // Cephe (12.158): conquest bayrakları sektörlere kilitli, yalnız saldıranın bileti
  const pl = o.type === 'payload', pb = o.type === 'pb', dm = o.type === 'dm' || o.type === 'gg' || pb, inf = o.type === 'inf', gg = o.type === 'gg';
  // Ölüm maçında perTeam = toplam oyuncu sayısı (2–10)
  const total = inf ? Math.max(LIMITS.infMin, Math.min(LIMITS.infMax, Math.round((o.perTeam || 12) / 2) * 2)) : 0;           // Enfekte: toplam oyuncu (çift)
  const perTeam = pb ? Math.max(LIMITS.pbMin, Math.min(LIMITS.pbMax, Math.round(o.perTeam || 8))) : dm ? Math.max(2, Math.min(LIMITS.dmMax, Math.round(o.perTeam || LIMITS.dmMax))) : inf ? total / 2 : Math.max(1, Math.min(LIMITS.maxPerTeam, Math.round(o.perTeam || 10)));   // inf: motor için iki yarı
  return {
    type: pb ? 'pb' : gg ? 'gg' : dm ? 'dm' : inf ? 'inf' : o.type === 'tdm' ? 'tdm' : pl ? 'payload' : fr ? 'front' : 'conquest',
    front: fr,
    payload: pl,                                                    // Vagon: süre = LIMITS.plTime (0 = sınırsız) + kontrol noktası ödülü; bilet yerine ilerleme yüzdesi
    infection: inf,
    total: inf ? total : 0,
    ffa: dm,                                                        // Ölüm Maçı + Silah Yarışı: herkes tek
    gungame: gg,
    paintball: pb,                                                  // Paintball: sabit boya silahları, kuyuya düşen elenir (harita voidY)
    fixed: gg || pb,                                                // sınıf / teçhizat seçimi yok (ölüm ekranında satır gizli)
    killLimit: gg ? GG_LEN : pb ? LIMITS.pbKills : dm ? LIMITS.dmKills : 0,
    perTeam,
    tickets: pl ? 100 : fr ? (o.tickets || frontTickets(perTeam)) : o.tickets || (o.type === 'tdm' ? defaultScoreLimit(perTeam) : defaultTickets(perTeam)),
    scoreBased: o.type === 'tdm',                                // true: tickets = skor sınırı, takım sayaçları yukarı sayar
    time: pl ? (o.time === 0 ? 0 : LIMITS.plTime) : o.time === undefined ? LIMITS.time : o.time,
    label: o.label || (dm ? `${perTeam} kişilik` : inf ? `${total} kişilik` : `${perTeam}v${perTeam}`),
    allFlags: fr ? true : o.allFlags ?? perTeam >= 8,
  };
}
