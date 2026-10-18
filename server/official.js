// Resmi sunucular: sunucu açılışında kurulur, hep açıktır. Her oyun modundan en az bir oda; maç sonunda oyuncular sonraki haritayı + gün saatini oylar,
// oda boşken idleMin dakikada bir harita kendiliğinden döner. Botlar açık; oyuncu girince bir bot azalır. Bu liste data/official.json yoksa kullanılır.
// code: 4 karakterli sabit oda kimliği (listeden girilir; kullanıcılar elle yazmaz) · voteSec: maç sonu oylama süresi · idleMin: boş oda harita değişimi (0 = kapalı)
const R = (map, tod = 'day', weather = 'clear') => ({ map, tod, weather });

export const OFFICIAL = [
  {
    code: 'OFC1', name: 'Resmi Sunucu #1', desc: 'Ele Geçirme · 10v10 · bot destekli',
    type: 'conquest', perTeam: 10, time: 900, diff: 'normal',
    rotation: [R('kasaba'), R('vadi', 'sunset'), R('us', 'day', 'fog'), R('depo'), R('liman', 'sunset'), R('colgecidi')],
  },
  {
    code: 'OFC2', name: 'Resmi Sunucu #2', desc: 'Büyük Savaş · 16v16 · bot destekli',
    type: 'conquest', perTeam: 16, time: 1200, diff: 'normal',
    rotation: [R('us'), R('kasaba', 'sunset'), R('vadi', 'day', 'rain')],
  },
  {
    code: 'OFC3', name: 'Resmi Sunucu #3', desc: 'Takım Çatışması · 8v8 · bot destekli',
    type: 'tdm', perTeam: 8, time: 600, diff: 'hard',
    rotation: [R('kasaba', 'night'), R('depo'), R('vadi'), R('liman', 'night'), R('us', 'sunset')],
  },
  {
    code: 'OFC4', name: 'Resmi Sunucu #4', desc: 'Ölüm Maçı · herkes tek · ilk 40 · 10 kişi · bot destekli',
    type: 'dm', perTeam: 10, time: 600, diff: 'normal',
    rotation: [R('depo'), R('us'), R('liman', 'sunset'), R('kasaba'), R('colgecidi'), R('vadi', 'sunset')],
  },
  {
    code: 'OFC5', name: 'Resmi Sunucu #5', desc: 'Çöl Geçidi · Takım Çatışması · 8v8 · bot destekli',
    type: 'tdm', perTeam: 8, time: 600, diff: 'normal',
    rotation: [R('colgecidi'), R('colgecidi', 'sunset')],
  },
  {
    code: 'OFC6', name: 'Resmi Sunucu #6', desc: 'Silah Yarışı · herkes tek · 10 kişi · bot destekli',
    type: 'gg', perTeam: 10, time: 600, diff: 'normal',
    rotation: [R('liman'), R('depo', 'sunset'), R('colgecidi'), R('kasaba', 'night'), R('us')],
  },
  {
    code: 'OFC7', name: 'Resmi Sunucu #7', desc: 'Enfekte · New York · gece · 16 kişi',
    type: 'inf', perTeam: 16, time: 600, diff: 'hard',
    rotation: [R('newyork', 'night'), R('newyork', 'night', 'fog'), R('newyork', 'night', 'rain')],
  },
  {
    code: 'OFC8', name: 'Resmi Sunucu #8', desc: 'Paintball · Boya Kulesi + Orman Kalesi · 10 kişi',
    type: 'pb', perTeam: 10, time: 600, diff: 'normal',
    rotation: [R('boyakulesi'), R('ormankale'), R('boyakulesi', 'sunset'), R('ormankale', 'sunset')],
  },
];
// Mevcut data/official.json'da hiç odası olmayan moda eklenecek hazır kayıt (her moddan bir oda; admin düzenlemelerine dokunulmaz)
export const MODE_DEFAULTS = { conquest: 'OFC1', tdm: 'OFC3', dm: 'OFC4', gg: 'OFC6', inf: 'OFC7', pb: 'OFC8' };
