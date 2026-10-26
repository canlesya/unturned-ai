// Çöl Geçidi kalıcı harita düzenlemeleri (ana menü → Harita Editörü → "Düzenlemeleri kopyala"). Kurulumun sonunda uygulanır (sunucu + istemci).
// Biçim: { id, at:[x,y,z], del?:true, d?:[dx,dy,dz], s?:[sx,sy,sz], clip?:[x0,x1,y0,y1,z0,z1] (yalnız çarpışmayı kırpar; null = sınırsız), trim?:true (üst şerit / korniş ölçeklenmez) } — at: nesnenin düzenlemeden önceki taban-merkezi (veri değişirse yanlış nesneye uygulanmasın).
// 12.171 (v2, sıfırdan): eski 40 düzenlemenin AMACI yeni plana işlendi (assets/colgecidi/plan.js + build.js; ayrıntı OYUN.md 12.171) — bina:11 silindi,
// bina:15 / bina:37 kaydı, Titanic batı + kuzey duvarı tek parça yüksek duvar, Mid ↔ Cat tek düz duvar (2,82), Xbox iki kasa, Pit kenar duvarları / korkuluk,
// kasalar (kasa:7 / 12 / 15 / 17 / 26 / 31) yeni boy / yerlerinde, palmiye:6 taşındı / palmiye:7 yok, gürültü kat kenarları (kenar:0,5,7–10,12,13,15,16,18,20,33,46–49) yok.
// Eski kimlikler yeni yapıda aynı nesneyi göstermediği için liste boş başlar.
export default [
];
