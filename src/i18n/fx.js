// Vuruş / öldürme hissi metinleri (src/game/killfx.js): merkez öldürme bildirimi, çoklu öldürme ve seri çağrıları. Anahtarlar fx.* .
import { addStrings } from './index.js';
addStrings('tr', {
  'fx.elim': 'ELENDİ', 'fx.head': 'KAFADAN', 'fx.melee': 'BIÇAKLA', 'fx.pts': '+{n}',
  'fx.multi2': 'ÇİFT ÖLDÜRME', 'fx.multi3': 'ÜÇLÜ ÖLDÜRME', 'fx.multi4': 'DÖRTLÜ ÖLDÜRME', 'fx.multi5': 'KATLİAM',
  'fx.spree3': 'SERİ', 'fx.spree5': 'DURDURULAMAZ', 'fx.spree7': 'YIKIM', 'fx.spree10': 'EFSANE', 'fx.streakN': '{n} ÖLDÜRME SERİSİ',
});
addStrings('en', {
  'fx.elim': 'ELIMINATED', 'fx.head': 'HEADSHOT', 'fx.melee': 'MELEE', 'fx.pts': '+{n}',
  'fx.multi2': 'DOUBLE KILL', 'fx.multi3': 'TRIPLE KILL', 'fx.multi4': 'QUAD KILL', 'fx.multi5': 'RAMPAGE',
  'fx.spree3': 'KILLING SPREE', 'fx.spree5': 'UNSTOPPABLE', 'fx.spree7': 'DEVASTATION', 'fx.spree10': 'LEGENDARY', 'fx.streakN': '{n} KILL STREAK',
});
