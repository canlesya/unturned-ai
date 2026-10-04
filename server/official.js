// Resmi sunucular: sunucu açılışında kurulur, hep açıktır, maç bitince harita sırayla döner. Botlar açık; oyuncu girince bir bot azalır.
// code: 4 karakterli sabit oda kimliği (listeden girilir; kullanıcılar elle yazmaz)
const R = (map, tod = 'day', weather = 'clear') => ({ map, tod, weather });

export const OFFICIAL = [
  {
    code: 'OFC1', name: 'Resmi Sunucu #1', desc: 'Ele Geçirme · 10v10 · bot destekli',
    type: 'conquest', perTeam: 10, time: 900, diff: 'normal',
    rotation: [R('kasaba'), R('vadi', 'sunset'), R('us', 'day', 'fog')],
  },
  {
    code: 'OFC2', name: 'Resmi Sunucu #2', desc: 'Büyük Savaş · 16v16 · bot destekli',
    type: 'conquest', perTeam: 16, time: 1200, diff: 'normal',
    rotation: [R('us'), R('kasaba', 'sunset'), R('vadi', 'day', 'rain')],
  },
  {
    code: 'OFC3', name: 'Resmi Sunucu #3', desc: 'Takım Çatışması · 8v8 · bot destekli',
    type: 'tdm', perTeam: 8, time: 600, diff: 'hard',
    rotation: [R('kasaba', 'night'), R('vadi'), R('us', 'sunset')],
  },
  {
    code: 'OFC4', name: 'Resmi Sunucu #4', desc: 'Ölüm Maçı · herkes tek · ilk 40 · 10 kişi · bot destekli',
    type: 'dm', perTeam: 10, time: 600, diff: 'normal',
    rotation: [R('us'), R('kasaba'), R('vadi', 'sunset')],
  },
  {
    code: 'OFC5', name: 'Resmi Sunucu #5', desc: 'Çöl Geçidi · Takım Çatışması · 8v8 · bot destekli',
    type: 'tdm', perTeam: 8, time: 600, diff: 'normal',
    rotation: [R('colgecidi'), R('colgecidi', 'sunset')],
  },
];
