// Maç türleri ve ayarları. Özel maçta her şey serbest (perTeam 1–32).
export const MATCH_TYPES = {
  conquest: { label: 'Ele Geçirme', desc: 'Bayrakları ele geçir, düşman biletlerini erit.' },
  tdm: { label: 'Takım Çatışması', desc: 'Bayrak yok: sadece öldür. Her ölüm bir bilet.' },
};
export const TODS_LIST = [['day', 'Gündüz'], ['sunset', 'Gün batımı'], ['night', 'Gece']];
export const PRESETS = {
  '3v3': { label: 'Hızlı Maç 3v3', perTeam: 3, tickets: 60, time: 600 },
  '10v10': { label: 'Büyük Savaş 10v10', perTeam: 10, tickets: 200, time: 900 },
};
export function defaultTickets(perTeam) { return Math.max(40, Math.round(perTeam * 20 / 10) * 10); }
export function makeMatch(o = {}) {
  const perTeam = Math.max(1, Math.min(32, Math.round(o.perTeam || 10)));
  return {
    type: o.type === 'tdm' ? 'tdm' : 'conquest',
    perTeam,
    tickets: o.tickets || defaultTickets(perTeam),
    time: o.time === undefined ? 900 : o.time,
    label: o.label || `${perTeam}v${perTeam}`,
    allFlags: o.allFlags ?? perTeam >= 8,
  };
}
