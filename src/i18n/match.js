// Maç sonu ekranı + sonraki maç / oylama metinleri (anahtarlar match.*)
import { addStrings } from './index.js';

addStrings('tr', {
  'match.victory': 'ZAFER!', 'match.defeat': 'YENİLGİ', 'match.draw': 'BERABERE', 'match.drawWhy': '{why}. Skorlar eşit: berabere.',
  'match.kills': 'Öldürme', 'match.deaths': 'Ölüm', 'match.score': 'Puan', 'match.xp': 'XP',
  'match.won': '{why}. {team} kazandı.', 'match.wonFfa': '{why}.',
  'match.rank': 'Sıralama', 'match.lvl': 'Sv ',
  'match.teamBest': 'Takımın en iyisi: {name} ({score})',
  'match.blueRed': 'Mavi {b} – {r} Kırmızı', 'match.humZom': 'İnsan {b} – {r} Zombi',
  'match.humans': 'İnsanlar', 'match.zombies': 'Zombiler',
  'match.voteTitle': 'Sonraki haritayı oyla', 'match.pickTitle': 'Sonraki maçı seç', 'match.nextTitle': 'Sonraki maç',
  'match.voteHint': '{n} / {total} oyuncu oy verdi · tıkla ya da 1–3', 'match.voteHint1': 'Tıkla ya da 1–3 · oy gelmezse ilk harita',
  'match.pickHint': 'Tıkla ya da 1–3 · süre dolunca seçili harita başlar',
  'match.startsIn': '{s} sn', 'match.preparing': 'Yeni maç hazırlanıyor…', 'match.lost': 'Sunucu bağlantısı koptu',
  'match.myVote': 'SEÇİMİN', 'match.picked': 'SEÇİLDİ', 'match.votes': '{n} oy',
  'match.nextNow': 'Hemen başla', 'match.menu': 'Menüye dön',
  'match.waitNext': 'Maç bitti, yeni maç {s} sn içinde başlıyor. Otomatik katılacaksın…',
  'match.tod.day': 'Gündüz', 'match.tod.sunset': 'Gün batımı', 'match.tod.night': 'Gece',
  'match.w.clear': 'Açık', 'match.w.rain': 'Yağmur', 'match.w.fog': 'Sis',
});

addStrings('en', {
  'match.victory': 'VICTORY!', 'match.defeat': 'DEFEAT', 'match.draw': 'DRAW', 'match.drawWhy': '{why}. Scores are level: draw.',
  'match.kills': 'Kills', 'match.deaths': 'Deaths', 'match.score': 'Score', 'match.xp': 'XP',
  'match.won': '{why}. {team} won.', 'match.wonFfa': '{why}.',
  'match.rank': 'Ranking', 'match.lvl': 'Lv ',
  'match.teamBest': 'Team MVP: {name} ({score})',
  'match.blueRed': 'Blue {b} – {r} Red', 'match.humZom': 'Humans {b} – {r} Zombies',
  'match.humans': 'Humans', 'match.zombies': 'Zombies',
  'match.voteTitle': 'Vote for the next map', 'match.pickTitle': 'Pick the next match', 'match.nextTitle': 'Next match',
  'match.voteHint': '{n} / {total} players voted · click or press 1–3', 'match.voteHint1': 'Click or press 1–3 · no votes = first map',
  'match.pickHint': 'Click or press 1–3 · the selected map starts when time is up',
  'match.startsIn': '{s} s', 'match.preparing': 'Preparing the next match…', 'match.lost': 'Lost connection to the server',
  'match.myVote': 'YOUR VOTE', 'match.picked': 'SELECTED', 'match.votes': '{n} votes',
  'match.nextNow': 'Start now', 'match.menu': 'Back to menu',
  'match.waitNext': 'Match over, the next one starts in {s} s. You will join automatically…',
  'match.tod.day': 'Day', 'match.tod.sunset': 'Sunset', 'match.tod.night': 'Night',
  'match.w.clear': 'Clear', 'match.w.rain': 'Rain', 'match.w.fog': 'Fog',
});
