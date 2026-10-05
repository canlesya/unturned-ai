// Çöl Geçidi kalıcı harita düzenlemeleri (oyun içi harita editöründen: geliştirici modu → I). Kurulumun sonunda uygulanır (sunucu + istemci).
// Biçim: { id, at:[x,y,z], del?:true, d?:[dx,dy,dz], s?:[sx,sy,sz] } — at: nesnenin düzenlemeden önceki taban-merkezi (veri değişirse yanlış nesneye uygulanmasın).
export default [
  { id: 'bina:11', at: [-33.03, 0.7, -54.482], del: true },          // Window cebi yanında 0,5 × 1 m'lik ince bina köşesi (kullanıcı, 2026-10-05)
];
