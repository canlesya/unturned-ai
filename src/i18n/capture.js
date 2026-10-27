// 12.191 ele geçirme geri bildirimi metinleri (tr + en): alan göstergesi, bayrak bildirimleri, öldürme akışı
import { addStrings } from './index.js';

addStrings('tr', {
  'cap.st.capturing': 'ELE GEÇİRİLİYOR', 'cap.st.neutralizing': 'NÖTRLEŞTİRİLİYOR', 'cap.st.contested': 'ÇEKİŞMELİ', 'cap.st.defending': 'SAVUNULUYOR',
  'cap.st.restoring': 'GERİ ALINIYOR', 'cap.st.losing': 'KAYBEDİLİYOR', 'cap.st.enemyCap': 'DÜŞMAN ELE GEÇİRİYOR', 'cap.st.enemyHeld': 'DÜŞMAN BÖLGESİ',
  'cap.st.locked': 'KİLİTLİ', 'cap.st.captured': 'ELE GEÇİRİLDİ!', 'cap.st.neutralized': 'NÖTRLEŞTİRİLDİ', 'cap.st.lost': 'KAYBEDİLDİ!', 'cap.st.left': 'BÖLGEDEN ÇIKTIN',
  'cap.sub.contested': 'ilerleme durdu', 'cap.sub.held': 'bayrak sizin', 'cap.sub.outnum': 'üstünlük sizde',
  'cap.sub.restoring': 'bayrak hâlâ sizin · çubuk doluyor', 'cap.sub.enemyMore': 'düşman sayıca üstün', 'cap.sub.enemyHeld': 'sayıca azsınız · ilerleme yok',
  'cap.sub.neuIn': 'önce nötr · ~{n} sn', 'cap.sub.locked': 'bu nokta şu an alınamaz', 'cap.sub.lockN': '{n} sn sonra açılır',
  'cap.sub.capNow': 'bayrak sizin', 'cap.sub.neuNow': 'şimdi ele geçir', 'cap.sub.lostNow': 'düşman aldı', 'cap.sub.keep': 'ilerleme korunur · dönünce sürer', 'cap.sub.left': 'ele geçirme durdu',
  'cap.eta.cap': 'ele geçmesine', 'cap.eta.restore': 'dolmasına', 'cap.eta.lose': 'kaybetmeye', 'cap.eta.enemy': 'düşman alır', 'cap.sec': 'sn',
  'cap.rate': 'hız ×{n}', 'cap.rateMax': '×3 en çok', 'cap.vs': 'vs',
  'cap.t.won': '{l} — {f} ele geçirildi', 'cap.t.lost': '{l} — {f} kaybedildi', 'cap.t.enemyTook': '{l} — {f} düşman ele geçirdi',
  'cap.t.neuEnemy': '{l} — {f} nötrleştirildi', 'cap.t.neuOurs': '{l} — {f} düşman nötrleştirdi',
  'cap.kf.took': 'ele geçirdi', 'cap.kf.neu': 'nötrleştirdi',
});
addStrings('en', {
  'cap.st.capturing': 'CAPTURING', 'cap.st.neutralizing': 'NEUTRALIZING', 'cap.st.contested': 'CONTESTED', 'cap.st.defending': 'DEFENDING',
  'cap.st.restoring': 'RECLAIMING', 'cap.st.losing': 'LOSING', 'cap.st.enemyCap': 'ENEMY CAPTURING', 'cap.st.enemyHeld': 'ENEMY ZONE',
  'cap.st.locked': 'LOCKED', 'cap.st.captured': 'CAPTURED!', 'cap.st.neutralized': 'NEUTRALIZED', 'cap.st.lost': 'LOST!', 'cap.st.left': 'LEFT THE ZONE',
  'cap.sub.contested': 'progress halted', 'cap.sub.held': 'flag is yours', 'cap.sub.outnum': 'you have the edge',
  'cap.sub.restoring': 'still yours · refilling', 'cap.sub.enemyMore': 'enemy outnumbers you', 'cap.sub.enemyHeld': 'outnumbered · no progress',
  'cap.sub.neuIn': 'neutral first · ~{n} s', 'cap.sub.locked': 'not capturable right now', 'cap.sub.lockN': 'unlocks in {n} s',
  'cap.sub.capNow': 'flag is yours', 'cap.sub.neuNow': 'now capture it', 'cap.sub.lostNow': 'enemy took it', 'cap.sub.keep': 'progress kept · resumes when back', 'cap.sub.left': 'capture stopped',
  'cap.eta.cap': 'to capture', 'cap.eta.restore': 'to refill', 'cap.eta.lose': 'until lost', 'cap.eta.enemy': 'enemy takes it', 'cap.sec': 's',
  'cap.rate': 'speed ×{n}', 'cap.rateMax': '×3 max', 'cap.vs': 'vs',
  'cap.t.won': '{l} — {f} captured', 'cap.t.lost': '{l} — {f} lost', 'cap.t.enemyTook': '{l} — {f} taken by the enemy',
  'cap.t.neuEnemy': '{l} — {f} neutralized', 'cap.t.neuOurs': '{l} — {f} neutralized by the enemy',
  'cap.kf.took': 'captured', 'cap.kf.neu': 'neutralized',
});
