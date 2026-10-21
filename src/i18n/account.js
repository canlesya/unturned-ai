// Giriş kartı + hesap metinleri (tr + en). Anahtarlar 'acct.' ile başlar; sunucu hataları anahtarla (key) çevrilir (server/accounts.js).
import { addStrings } from './index.js';

addStrings('tr', {
  'acct.welcome': 'Hoş geldin', 'acct.sub': 'Nasıl oynamak istersin? İkisi de birkaç saniye.',
  'acct.tab.guest': 'Misafir', 'acct.tab.acct': 'Hesap', 'acct.tab.guestSub': 'kayıtsız', 'acct.tab.acctSub': 'ad + şifre',
  'acct.name': 'Takma ad', 'acct.namePh': 'Adın', 'acct.pass': 'Şifre', 'acct.passPh': 'en az 4 karakter',
  'acct.guestGo': 'Misafir olarak oyna', 'acct.guestHint': 'Kayıt yok. Seviyen bu cihazda kalır; istediğin zaman hesap açabilirsin.',
  'acct.login': 'Giriş yap', 'acct.register': 'Kayıt ol', 'acct.acctHint': 'E-posta yok. Ad ve şifre yeter; seviyen her cihazda seninle gelir.',
  'acct.nameRule': '3–16 karakter: harf, rakam, _', 'acct.busy': 'Bekle…', 'acct.close': 'Kapat',
  'acct.guest': 'Misafir', 'acct.badge': 'Hesap', 'acct.logout': 'Çıkış', 'acct.open': 'Hesap', 'acct.openT': 'Hesap aç ya da giriş yap (adın korunur)',
  'acct.registered': 'Hesap açıldı: {n}', 'acct.loggedIn': 'Giriş yapıldı: {n}', 'acct.expired': 'Oturumun sona erdi, yeniden giriş yap.',
  'acct.err.name': 'Ad 3–16 karakter olmalı (harf, rakam, _)', 'acct.err.pass': 'Şifre en az 4 karakter olmalı', 'acct.err.taken': 'Bu ad alınmış, başka bir ad dene',
  'acct.err.wrong': 'Ad ya da şifre yanlış', 'acct.err.rate': 'Çok fazla deneme, bir dakika sonra tekrar dene', 'acct.err.session': 'Oturum geçersiz, yeniden giriş yap',
  'acct.err.bad': 'Geçersiz istek', 'acct.err.server': 'Sunucu hatası, sonra tekrar dene', 'acct.err.net': 'Sunucuya ulaşılamadı',
});

addStrings('en', {
  'acct.welcome': 'Welcome', 'acct.sub': 'How do you want to play? Both take a few seconds.',
  'acct.tab.guest': 'Guest', 'acct.tab.acct': 'Account', 'acct.tab.guestSub': 'no sign-up', 'acct.tab.acctSub': 'name + password',
  'acct.name': 'Nickname', 'acct.namePh': 'Your name', 'acct.pass': 'Password', 'acct.passPh': 'at least 4 characters',
  'acct.guestGo': 'Play as guest', 'acct.guestHint': 'No sign-up. Your level stays on this device; you can create an account any time.',
  'acct.login': 'Log in', 'acct.register': 'Sign up', 'acct.acctHint': 'No email needed. A name and a password are enough; your level follows you on every device.',
  'acct.nameRule': '3–16 characters: letters, digits, _', 'acct.busy': 'Please wait…', 'acct.close': 'Close',
  'acct.guest': 'Guest', 'acct.badge': 'Account', 'acct.logout': 'Log out', 'acct.open': 'Account', 'acct.openT': 'Sign up or log in (your name is kept)',
  'acct.registered': 'Account created: {n}', 'acct.loggedIn': 'Logged in: {n}', 'acct.expired': 'Your session has expired, please log in again.',
  'acct.err.name': 'Name must be 3–16 characters (letters, digits, _)', 'acct.err.pass': 'Password must be at least 4 characters', 'acct.err.taken': 'This name is taken, try another one',
  'acct.err.wrong': 'Wrong name or password', 'acct.err.rate': 'Too many attempts, try again in a minute', 'acct.err.session': 'Session is no longer valid, please log in again',
  'acct.err.bad': 'Invalid request', 'acct.err.server': 'Server error, try again later', 'acct.err.net': 'Cannot reach the server',
});
