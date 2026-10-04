// Tuş atama mantığı testi:  node scripts/bindtest.mjs
import { Binds, ACTIONS, norm } from '../src/core/keybinds.js';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const b = new Binds();
check(b.is('forward', 'KeyW') && b.is('crouch', 'KeyC') && b.is('crouch', 'ControlRight'), 'varsayılanlar: W ileri, C ve (sağ/sol) Ctrl çömel');
check(b.slotOf('KeyG') === 2 && b.slotOf('KeyV') === 3 && b.slotOf('Digit1') === 0, 'silah yuvası tuşları (1-4, G gadget, V bıçak)');
let taken = b.set('crouch', 0, 'ControlLeft');
check(b.codes('crouch').join() === 'ControlLeft' && taken === null && !b.is('crouch', 'KeyC'), 'çömelmeyi yalnızca Ctrl’e al (C artık çömeltmez)');
taken = b.set('prone', 0, 'ControlLeft');
check(taken === 'crouch' && b.codes('crouch').length === 0 && b.is('prone', 'ControlLeft'), 'aynı tuş başka eyleme verilince oradan alınır');
check(JSON.stringify(b.toJSON()) === JSON.stringify({ crouch: [], prone: ['ControlLeft'] }), 'yalnızca varsayılandan farklılar kaydedilir');
const c = new Binds(b.toJSON());
check(c.codes('crouch').length === 0 && c.is('prone', 'ControlLeft') && c.is('forward', 'KeyW'), 'kayıttan geri yükleme (boş atama dahil)');
c.reset(); check(c.is('crouch', 'KeyC') && !c.is('prone', 'ControlLeft'), 'varsayılana dön');
check(new Binds({ forward: ['Escape', 'KeyI'] }).codes('forward').join() === 'KeyI', 'Esc atanamaz');
check(norm('ShiftRight') === 'ShiftLeft', 'sağ/sol Shift aynı');
check(ACTIONS.every((a) => a.def.length >= 1 && a.def.length <= 2), 'her eylemin 1-2 varsayılan tuşu var');
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
