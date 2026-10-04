// Maç türleri ve ayarları. Özel maçta her şey serbest (perTeam 1–32).
export const MATCH_TYPES = {
  conquest: { label: 'Ele Geçirme', desc: 'Bayrakları ele geçir, düşman biletlerini erit.' },
  tdm: { label: 'Takım Çatışması', desc: 'Bayrak yok: sadece öldür. Takım skoru her öldürmede artar; skor sınırına ilk ulaşan kazanır.' },
  inf: { label: 'Enfekte', desc: 'Birkaç kişi zombi başlar. Zombi öldürdüğü insanı enfekte eder; son insan da düşerse zombiler, süre dolana dek hayatta kalırsan insanlar kazanır.' },
  dm: { label: 'Ölüm Maçı', desc: 'Herkes tek. Rastgele doğ, ilk 40 öldürmeye ulaşan kazanır (en çok 10 kişi).' },
};
export const DM_KILLS = 40, DM_MAX = 10;
export const INF_MAX = 24, INF_MIN = 4;                                  // Enfekte: toplam oyuncu (çift sayı)
// Oyuncu sayısı seçici 'takım başına' değil 'toplam' olan modlar (cfg.perTeam = toplam)
export const isTotalType = (t) => t === 'dm' || t === 'inf';
export const totalMax = (t) => (t === 'inf' ? INF_MAX : DM_MAX);
export const totalMin = (t) => (t === 'inf' ? INF_MIN : 2);
export const TODS_LIST = [['day', 'Gündüz'], ['sunset', 'Gün batımı'], ['night', 'Gece']];
export const PRESETS = {
  '3v3': { label: 'Hızlı Maç 3v3', perTeam: 3, tickets: 60, time: 600 },
  '10v10': { label: 'Büyük Savaş 10v10', perTeam: 10, tickets: 200, time: 900 },
};
// Skor tabanlı modlarda (TDM) 'tickets' alanı skor sınırıdır; takım skorları 0'dan yukarı sayar
export const isScoreType = (t) => t === 'tdm';
export function defaultScoreLimit(perTeam) { return Math.max(30, Math.min(150, perTeam * 10)); }
export function defaultTickets(perTeam) { return Math.max(40, Math.round(perTeam * 20 / 10) * 10); }
export function makeMatch(o = {}) {
  const dm = o.type === 'dm', inf = o.type === 'inf';
  // Ölüm maçında perTeam = toplam oyuncu sayısı (2–10)
  const total = inf ? Math.max(INF_MIN, Math.min(INF_MAX, Math.round((o.perTeam || 12) / 2) * 2)) : 0;           // Enfekte: toplam oyuncu (çift)
  const perTeam = dm ? Math.max(2, Math.min(DM_MAX, Math.round(o.perTeam || DM_MAX))) : inf ? total / 2 : Math.max(1, Math.min(32, Math.round(o.perTeam || 10)));   // inf: motor için iki yarı
  return {
    type: dm ? 'dm' : inf ? 'inf' : o.type === 'tdm' ? 'tdm' : 'conquest',
    infection: inf,
    total: inf ? total : 0,
    killLimit: dm ? DM_KILLS : 0,
    perTeam,
    tickets: o.tickets || (o.type === 'tdm' ? defaultScoreLimit(perTeam) : defaultTickets(perTeam)),
    scoreBased: o.type === 'tdm',                                // true: tickets = skor sınırı, takım sayaçları yukarı sayar
    time: o.time === undefined ? 900 : o.time,
    label: o.label || (dm ? `${perTeam} kişilik` : inf ? `${total} kişilik` : `${perTeam}v${perTeam}`),
    allFlags: o.allFlags ?? perTeam >= 8,
  };
}
