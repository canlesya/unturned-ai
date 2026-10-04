// Maç türleri ve ayarları. Özel maçta her şey serbest (perTeam 1–32).
export const MATCH_TYPES = {
  conquest: { label: 'Ele Geçirme', desc: 'Bayrakları ele geçir, düşman biletlerini erit.' },
  tdm: { label: 'Takım Çatışması', desc: 'Bayrak yok: sadece öldür. Takım skoru her öldürmede artar; skor sınırına ilk ulaşan kazanır.' },
  dm: { label: 'Ölüm Maçı', desc: 'Herkes tek. Rastgele doğ, ilk 40 öldürmeye ulaşan kazanır (en çok 10 kişi).' },
};
export const DM_KILLS = 40, DM_MAX = 10;
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
  const dm = o.type === 'dm';
  // Ölüm maçında perTeam = toplam oyuncu sayısı (2–10)
  const perTeam = dm ? Math.max(2, Math.min(DM_MAX, Math.round(o.perTeam || DM_MAX))) : Math.max(1, Math.min(32, Math.round(o.perTeam || 10)));
  return {
    type: dm ? 'dm' : o.type === 'tdm' ? 'tdm' : 'conquest',
    killLimit: dm ? DM_KILLS : 0,
    perTeam,
    tickets: o.tickets || (o.type === 'tdm' ? defaultScoreLimit(perTeam) : defaultTickets(perTeam)),
    scoreBased: o.type === 'tdm',                                // true: tickets = skor sınırı, takım sayaçları yukarı sayar
    time: o.time === undefined ? 900 : o.time,
    label: o.label || (dm ? `${perTeam} kişilik` : `${perTeam}v${perTeam}`),
    allFlags: o.allFlags ?? perTeam >= 8,
  };
}
