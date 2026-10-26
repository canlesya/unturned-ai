// Asist (12.165): bir düşman ölünce, öldüren dışında son ASSIST.window sn içinde ona yeterince hasar veren her savaşçı (oyuncu / bot) asist alır.
//   • Kayıt: Soldier.takeDamage'daki tek kanca → hit(kurban, saldıran, hasar). Yalnız düşman hasarı (takım modunda karşı takım, herkes tek modlarda başkası);
//     hasar kurbanın kalan canıyla sınırlı (aşırı hasar sayılmaz). Ölüm, yeniden doğuş ve tam iyileşme kaydı sıfırlar.
//   • Eşik: toplam ≥ min(25, can üst sınırının %25'i) · Paintball'da ≥ 1 isabet (hasar sayısı oyuncuya görünmez, "isabet" görünür).
//   • Öldürensiz ölüm (düştü, intihar, kendi bombası, düşman üssü): son ASSIST.credit sn'de hasar veren son düşmana öldürme yazılır
//     (Kuyu kuralıyla aynı; 12.165), diğer katkı verenler asist alır.
//   • Puan: ASSIST.pts (öldürmenin yarısı). Öldürme akışına yazılmaz; asist alana kişisel "+ASİST 50 · ad" bildirimi (#pops yığını) + kısa ses.
//   • YETKİLİ taraf (çevrimdışı oyun / sunucu) sayar; çevrim içi istemci yalnız 'as' olayını (yalnız ilgilisine) ve anlık görüntüdeki `as` sayısını alır.
import { t } from '../i18n/index.js';
import '../i18n/assist.js';

export const ASSIST = {
  window: 10,          // sn: bu süreden eski hasar sayılmaz
  minDmg: 25,          // toplam hasar eşiği (100 canlı askerde %25)
  minFrac: 0.25,       // düşük canlılarda: can üst sınırının oranı (eşik = ikisinin küçüğü)
  pbHits: 1,           // paintball: en az isabet
  pts: 50,             // asist puanı (öldürme 100 / kafadan 150)
  credit: 5,           // sn: öldürensiz ölümde öldürmenin yazılacağı son düşman hasarı
  maxLog: 48,          // kurban başına en çok kayıt (otomatik silah 10 sn'de ~100 isabet yapamaz; taşarsa en eski düşer)
};

const foe = (g, a, v) => !!a && a !== v && !a.vacant && (g.ffa || a.team !== v.team);

export class Assists {
  constructor(game) { this.g = game; this.given = 0; }
  get off() { return !!this.g.online; }                        // çevrim içi istemci: sunucu sayar

  // takeDamage kancası (hasar uygulanmadan hemen önce): kim, kime, ne kadar, ne zaman
  hit(v, a, amount) {
    if (this.off || !foe(this.g, a, v) || !(amount > 0) || !(v.hp > 0)) return;
    const now = this.g.time, log = (v.dmgLog ||= []);
    log.push({ a, d: Math.min(amount, v.hp), t: now });
    while (log.length && (now - log[0].t > ASSIST.window || log.length > ASSIST.maxLog)) log.shift();
  }
  clear(v) { if (v.dmgLog) v.dmgLog.length = 0; }
  healed(v) { if (v.hp >= v.maxHp) this.clear(v); }            // tam iyileşme: eski hasar katkı sayılmaz

  // Öldürensiz ölüm: son ASSIST.credit sn içinde hasar veren son düşman (yoksa null)
  creditFor(v) {
    const log = v.dmgLog, now = this.g.time;
    if (this.off || !log) return null;
    for (let i = log.length - 1; i >= 0; i--) { const e = log[i]; if (now - e.t > ASSIST.credit) break; if (foe(this.g, e.a, v)) return e.a; }
    return null;
  }

  // Ölüm: öldüren dışındaki katkı verenler asist alır. Dönen: asist alanlar
  onDeath(v, killer) {
    const g = this.g, log = v.dmgLog, out = [];
    if (this.off || !log?.length) { this.clear(v); return out; }
    const now = g.time, sum = new Map();
    for (const e of log) {
      if (now - e.t > ASSIST.window || e.a === killer || !foe(g, e.a, v)) continue;
      const s = sum.get(e.a) || { d: 0, n: 0 }; s.d += e.d; s.n++; sum.set(e.a, s);
    }
    this.clear(v);
    const thr = Math.min(ASSIST.minDmg, ASSIST.minFrac * (v.maxHp || 100)) - 1e-6;
    for (const [a, s] of sum) {
      if (g.mode.paintball ? s.n < ASSIST.pbHits : s.d < thr) continue;
      a.assists = (a.assists || 0) + 1; a.score += ASSIST.pts; this.given++;
      out.push(a);
      g.emit('assist', { by: a, victim: v, pts: ASSIST.pts, dmg: Math.round(s.d) });
      if (a.isPlayer && !g.headless) assistPop(g, v, ASSIST.pts);
      else if (a.human) g.netEvent({ e: 'as', to: a.id, v: v.id, p: ASSIST.pts });      // kişisel: sunucu yalnız bu oyuncuya yollar (room.step)
    }
    return out;
  }
}

// ───── kişisel bildirim: HUD'daki #pops yığınına (+80 CANLANDIRMA ile aynı yer; öldürme kartının üstünde, üst üste binmez)
const CSS = `
.pop.as{display:flex;align-items:baseline;gap:8px;font-size:18px;letter-spacing:3px;color:#ffe08a;padding:2px 14px;background:linear-gradient(90deg,rgba(10,13,18,0),rgba(10,13,18,.62) 20%,rgba(10,13,18,.62) 80%,rgba(10,13,18,0))}
.pop.as .al{font-size:13px;letter-spacing:3px;color:#ffb35c}
.pop.as .ap{font-weight:900;color:#ffd35a}
.pop.as .an{font-size:13px;font-weight:700;letter-spacing:1px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.9}
.pop.as .an.b{color:#9fd0ff}.pop.as .an.r{color:#ffab9a}
`;
let cssOn = false;
export function assistPop(g, victim, pts = ASSIST.pts) {
  if (g.headless || typeof document === 'undefined') return;
  if (!cssOn) { cssOn = true; const st = document.createElement('style'); st.id = 'assistcss'; st.textContent = CSS; document.head.appendChild(st); }
  const box = g.hud?.$?.('pops');
  if (!box) return;
  const d = document.createElement('div'); d.className = 'pop as';
  d.innerHTML = '<span class="al"></span><span class="ap"></span><span class="an"></span>';
  d.querySelector('.al').textContent = t('as.label');
  d.querySelector('.ap').textContent = String(pts);
  const an = d.querySelector('.an');
  an.textContent = victim?.name || ''; an.className = 'an ' + (g.ffa ? 'r' : victim?.team === 'blue' ? 'b' : 'r');
  box.appendChild(d);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => d.remove(), 1700);
  g.sfx?.assist?.();
  g.assistShown = (g.assistShown || 0) + 1;                   // test sayacı
}
