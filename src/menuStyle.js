// Menü stilleri (JS içinde: tek dosya derlemede de çalışsın). Tasarım dili: koyu cam paneller, kesik köşe, turuncu vurgu, Bahnschrift / Rajdhani büyük harf.
// Ortak ölçüler :root yerine #menu üstünde (--acc turuncu, --pan cam panel, --line ince çizgi, --cut köşe kesiği); telefon kuralları dosya sonunda (max-height:520 · html.touch).
export const MENU_CSS = `
#menu{position:fixed;inset:0;z-index:20;overflow:hidden;color:#e8edf5;background:#070a10;font-family:Bahnschrift,'Rajdhani','Oswald','Arial Narrow','Segoe UI',system-ui,sans-serif;-webkit-font-smoothing:antialiased;
  --acc:#ff8a1f;--acc2:#ffb347;--acc3:#e85d04;--blue:#4aa3ff;--red:#ff5a43;--txt:#e8edf5;--dim:#8d99ab;--dim2:#6b778b;--pan:rgba(10,14,21,.8);--pan2:rgba(14,19,28,.9);--line:rgba(255,255,255,.09);--line2:rgba(255,255,255,.2);--cut:12px;--ease:cubic-bezier(.2,.7,.2,1)}
#menu *{box-sizing:border-box}
#menu canvas#mnBg{position:absolute;inset:0;width:100%;height:100%;display:block}
#menu .mn-vig{position:absolute;inset:0;pointer-events:none;transition:background .4s;background:radial-gradient(ellipse at 30% 50%,transparent 0%,rgba(4,6,10,.35) 55%,rgba(4,6,10,.88) 100%),linear-gradient(90deg,rgba(4,6,10,.9) 0%,rgba(4,6,10,.45) 30%,rgba(4,6,10,.2) 60%,rgba(4,6,10,.6) 100%)}
#menu .mn-vig.home{background:linear-gradient(0deg,rgba(4,6,10,.92) 0%,rgba(4,6,10,.35) 38%,transparent 60%),linear-gradient(90deg,rgba(4,6,10,.85) 0%,rgba(4,6,10,.25) 32%,transparent 55%,rgba(4,6,10,.45) 100%)}
#menu .mn-vig.light{background:linear-gradient(90deg,rgba(4,6,10,.55) 0%,rgba(4,6,10,0) 22%,rgba(4,6,10,0) 42%,rgba(4,6,10,.72) 100%)}
#menu button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;-webkit-tap-highlight-color:transparent}
#menu button:focus-visible,#menu input:focus-visible{outline:2px solid var(--acc2);outline-offset:2px}
#menu svg.ic{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
#menu b,#menu strong{font-weight:700}

/* ── üst çubuk: logo · dil · oyuncu kartı ── */
#menu .mn-top{position:absolute;left:40px;top:24px;right:40px;display:flex;align-items:flex-start;justify-content:space-between;z-index:3;pointer-events:none}
#menu .mn-top > *{pointer-events:auto}
#menu .mn-logo{font-size:52px;line-height:.9;font-weight:800;letter-spacing:5px;text-transform:uppercase;font-style:italic;text-shadow:0 4px 24px rgba(0,0,0,.6);user-select:none}
#menu .mn-logo b{color:var(--acc);font-weight:800}
#menu .mn-logo small{display:block;font-size:11px;letter-spacing:6px;color:var(--dim);font-style:normal;font-weight:600;margin-top:9px}
#menu .mn-topr{display:flex;gap:10px;align-items:stretch}
#menu .mn-langs{display:flex;background:var(--pan);border:1px solid var(--line);backdrop-filter:blur(8px)}
#menu .mn-langs .lg{min-width:44px;padding:0 10px;font-size:13px;font-weight:700;letter-spacing:2px;color:var(--dim);transition:color .15s,background .15s}
#menu .mn-langs .lg:hover{color:#fff;background:#ffffff10}
#menu .mn-langs .lg.on{color:#160a02;background:var(--acc)}
#menu .mn-user{display:flex;gap:14px;align-items:center;background:var(--pan);border:1px solid var(--line);padding:8px 16px 8px 10px;backdrop-filter:blur(8px);clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)}
#menu .mn-lv{width:48px;height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:23px;line-height:1;font-weight:800;background:linear-gradient(135deg,var(--acc2),var(--acc3));color:#160a02;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
#menu .mn-lv small{font-size:8px;letter-spacing:1.5px;font-weight:800;opacity:.85;margin-bottom:1px;color:#3a1800}
#menu .mn-user .nm{font-size:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
#menu .mn-user .nm input{background:none;border:0;border-bottom:1px dashed #ffffff40;color:inherit;font:inherit;text-transform:inherit;letter-spacing:inherit;width:150px;outline:0;padding:1px 0;transition:border-color .15s}
#menu .mn-user .nm input:hover,#menu .mn-user .nm input:focus{border-bottom-color:var(--acc)}
#menu .mn-user .xp{height:4px;background:#ffffff1c;margin-top:6px;width:170px;overflow:hidden}
#menu .mn-user .xp i{display:block;height:100%;background:linear-gradient(90deg,var(--acc),var(--acc2))}
#menu .mn-user small{display:block;color:var(--dim);font-size:11px;letter-spacing:1px;margin-top:4px}

/* ── sol gezinme ── */
#menu .mn-side{position:absolute;left:40px;top:144px;bottom:64px;width:272px;display:flex;flex-direction:column;gap:3px;z-index:3}
#menu .mn-nav{position:relative;display:flex;align-items:center;gap:14px;text-align:left;padding:9px 14px 9px 12px;font-size:19px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#c5cfdd;transition:color .18s,background .18s,transform .18s var(--ease)}
#menu .mn-nav .ic{width:40px;height:40px;padding:9px;border:1px solid var(--line);background:rgba(10,14,21,.55);color:var(--dim);transition:inherit;stroke-width:1.6}
#menu .mn-nav .tx{display:block;min-width:0}
#menu .mn-nav small{display:block;font-size:11px;letter-spacing:1.5px;color:var(--dim);font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#menu .mn-nav::before{content:'';position:absolute;left:-12px;top:50%;width:4px;height:0;background:var(--acc);transition:height .2s var(--ease),top .2s var(--ease);box-shadow:0 0 12px rgba(255,138,31,.7)}
#menu .mn-nav:hover{color:#fff;background:linear-gradient(90deg,rgba(255,255,255,.08),rgba(255,255,255,0));transform:translateX(4px)}
#menu .mn-nav:hover .ic{color:#fff;border-color:var(--line2)}
#menu .mn-nav.on{color:#fff;background:linear-gradient(90deg,rgba(255,138,31,.26),rgba(255,138,31,0) 85%)}
#menu .mn-nav.on::before{height:100%;top:0}
#menu .mn-nav.on .ic{background:var(--acc);border-color:var(--acc);color:#160a02;box-shadow:0 0 18px rgba(255,138,31,.35)}
#menu .mn-nav.on small{color:#ffcf9a}
#menu .mn-spacer{flex:1}

/* ── sahne + ekran başlığı ── */
#menu .mn-stage{position:absolute;left:344px;right:40px;top:132px;bottom:56px;z-index:2;display:flex;flex-direction:column;min-height:0}
#menu .mn-stage.right{left:auto;width:min(46vw,760px)}
#menu .mn-stage.enter > *{animation:mnIn .32s var(--ease) both}
#menu .mn-stage.enter > *:nth-child(2){animation-delay:.04s}
#menu .mn-stage.enter > *:nth-child(3){animation-delay:.08s}
@keyframes mnIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
#menu .mn-head{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid var(--line);flex:none}
#menu .mn-head h1{margin:0;font-size:30px;line-height:1;font-weight:800;letter-spacing:4px;text-transform:uppercase;font-style:italic;text-shadow:0 2px 16px rgba(0,0,0,.6)}
#menu .mn-head h1::before{content:'';display:inline-block;width:8px;height:22px;background:var(--acc);margin-right:12px;transform:skewX(-14deg);vertical-align:-1px}
#menu .mn-head p{margin:0;color:#aab5c5;font-size:14px;letter-spacing:.5px;text-shadow:0 1px 8px rgba(0,0,0,.8);flex:1;min-width:200px}
#menu .mn-head em{font-style:normal;font-size:13px;letter-spacing:1px;color:var(--dim);margin-left:auto;padding:5px 10px;background:var(--pan);border:1px solid var(--line)}
#menu .mn-head em.ok{color:#7be07a;border-color:rgba(123,224,122,.35)}#menu .mn-head em.bad{color:#ff8a7a;border-color:rgba(255,138,122,.35)}
#menu .mn-foot{position:absolute;left:40px;right:40px;bottom:20px;display:flex;justify-content:space-between;gap:20px;color:var(--dim);font-size:13px;letter-spacing:1px;z-index:3;text-shadow:0 1px 6px #000}
#menu .mn-foot #mnTip{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#menu .mn-foot b{color:var(--acc2)}
#menu .mn-foot #mnVer{flex:none;opacity:.8}
#menu .scroll{overflow-y:auto;padding-right:10px;flex:1;min-height:0;scrollbar-width:thin;scrollbar-color:#ffffff33 transparent;overscroll-behavior:contain}
#menu .scroll::-webkit-scrollbar{width:6px}#menu .scroll::-webkit-scrollbar-thumb{background:#ffffff2a}

/* ── panel / kart / çip ── */
#menu .pan,#menu .card{background:var(--pan);border:1px solid var(--line);padding:16px 20px 18px;margin-bottom:12px;backdrop-filter:blur(10px);clip-path:polygon(0 0,calc(100% - var(--cut)) 0,100% var(--cut),100% 100%,0 100%)}
#menu .pan h3,#menu .card h3{margin:0 0 12px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:var(--acc2);font-weight:700;display:flex;gap:10px;align-items:center}
#menu .pan h3::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--line2),transparent)}
#menu .pan h3 em{font-style:normal;color:var(--dim);letter-spacing:1px;font-weight:600;text-transform:none;font-size:12px;order:3}
#menu .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#menu .lbl{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin:0 0 6px;font-weight:600}
#menu .chip{position:relative;padding:9px 16px;background:#ffffff0b;border:1px solid var(--line);font-size:15px;font-weight:600;letter-spacing:1px;transition:background .15s,border-color .15s,color .15s,box-shadow .15s,transform .15s var(--ease);text-transform:uppercase;min-width:64px;text-align:center;color:#d5dde8}
#menu .chip:hover{background:#ffffff1a;border-color:var(--line2);color:#fff}
#menu .chip:active{transform:translateY(1px)}
#menu .chip.on{background:linear-gradient(180deg,rgba(255,138,31,.34),rgba(255,138,31,.14));border-color:var(--acc);color:#fff;box-shadow:inset 0 -2px 0 var(--acc),0 0 14px rgba(255,138,31,.22)}
#menu .chip.blue.on{background:rgba(74,163,255,.26);border-color:var(--blue);box-shadow:inset 0 -2px 0 var(--blue),0 0 14px rgba(74,163,255,.22)}
#menu .chip.red.on{background:rgba(255,90,67,.26);border-color:var(--red);box-shadow:inset 0 -2px 0 var(--red),0 0 14px rgba(255,90,67,.22)}
#menu .chip small{display:block;font-size:11px;font-weight:500;color:var(--dim);letter-spacing:.5px;text-transform:none}
#menu .chip.on small{color:#ffd3a6}
#menu .chip.tog{display:inline-flex;align-items:center;gap:10px;text-align:left}
#menu .chip.tog small{display:inline-block;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:2px 7px;background:#ffffff14;color:var(--dim)}
#menu .chip.tog.on small{background:var(--acc);color:#160a02}
#menu .chip.lang{display:inline-flex;align-items:center;gap:10px;min-width:150px;justify-content:space-between;text-transform:none;font-size:17px}
#menu .chip.lang small{display:inline-block;font-weight:700;letter-spacing:2px}
#menu .chip.danger:hover{border-color:var(--red);background:rgba(255,90,67,.16)}
#menu .chip[disabled]{opacity:.45;cursor:not-allowed}
#menu .hint{color:var(--dim);font-size:13px;margin-top:8px;letter-spacing:.4px;line-height:1.45}
#menu .hint b{color:#cfd7e3}
#menu .warn{color:#ffcf7a}
#menu kbd{display:inline-block;background:#ffffff16;border:1px solid #ffffff30;border-bottom-width:3px;padding:0 7px;margin:0 2px;font:inherit;font-size:.9em;font-weight:700;min-width:24px;text-align:center;line-height:1.5}

/* ── harita / gün saati kartları ── */
#menu .maps{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
#menu .mapc{position:relative;aspect-ratio:16/10;overflow:hidden;border:1px solid var(--line);transition:border-color .18s,box-shadow .18s,transform .18s var(--ease);text-align:left;background:#10151f}
#menu .mapc img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .5s var(--ease),filter .3s;filter:saturate(.85) brightness(.9)}
#menu .mapc:hover{transform:translateY(-2px);border-color:var(--line2)}
#menu .mapc:hover img{transform:scale(1.07);filter:none}
#menu .mapc::after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,rgba(5,8,12,.95) 0%,rgba(5,8,12,.25) 55%,transparent)}
#menu .mapc .t{position:absolute;left:12px;right:10px;bottom:9px;z-index:2}
#menu .mapc .t b{display:block;font-size:18px;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#menu .mapc .t small{display:block;font-size:11px;color:#aeb8c8;letter-spacing:.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#menu .mapc .mob{position:absolute;top:7px;right:7px;z-index:2;font-style:normal;font-size:10px;font-weight:700;line-height:1;letter-spacing:1px;text-transform:uppercase;padding:4px 7px;background:rgba(40,160,110,.92);color:#fff}
#menu .mapc.on{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc),0 0 22px rgba(255,138,31,.35)}
#menu .mapc.on img{filter:none}
#menu .mapc.on .t b{color:var(--acc2)}
#menu .mapc.rnd{display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(45deg,#121926,#121926 10px,#0e131c 10px,#0e131c 20px)}
#menu .mapc.rnd > .ic{width:46px;height:46px;color:var(--dim);margin-bottom:22px;stroke-width:1.4}
#menu .mapc.rnd.on > .ic{color:var(--acc)}
#menu .mapdesc{margin-top:10px;color:#c5cfdd;font-size:14px;line-height:1.5;letter-spacing:.3px;background:var(--pan2);border:1px solid var(--line);border-left:3px solid var(--acc);padding:10px 14px}
#menu .mapdesc b{color:#fff}
#menu .tods{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
#menu .tod{height:78px;border:1px solid var(--line);position:relative;overflow:hidden;text-align:left;padding:10px 12px;display:flex;align-items:flex-end;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:15px;transition:border-color .18s,box-shadow .18s,filter .18s}
#menu .tod span{position:relative;z-index:2;text-shadow:0 1px 6px #000}
#menu .tod::before{content:'';position:absolute;inset:0}
#menu .tod.day::before{background:linear-gradient(180deg,#4f94d8,#bcd9ee 60%,#e5d6a8)}
#menu .tod.sunset::before{background:linear-gradient(180deg,#27346a,#d96f45 55%,#ffc17a)}
#menu .tod.night::before{background:radial-gradient(circle at 78% 24%,#f1f5ff 0 7px,transparent 8px),radial-gradient(circle at 30% 30%,#fff 0 1px,transparent 2px),radial-gradient(circle at 52% 16%,#fff 0 1px,transparent 2px),radial-gradient(circle at 12% 18%,#fff 0 1px,transparent 2px),linear-gradient(180deg,#04081a,#162a52)}
#menu .tod.rnd::before{background:repeating-linear-gradient(45deg,#121926,#121926 10px,#0e131c 10px,#0e131c 20px)}
#menu .tod.on{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc),0 0 22px rgba(255,138,31,.35)}
#menu .tod:hover{filter:brightness(1.15)}
#menu .big{display:flex;align-items:baseline;gap:16px;margin-bottom:6px}
#menu .big .n{font-size:60px;font-weight:800;line-height:1;letter-spacing:2px;font-style:italic;white-space:nowrap}
#menu .big .n i{color:var(--dim);font-style:normal;font-size:26px;margin:0 10px}
#menu .big .tx{color:var(--dim);font-size:14px;letter-spacing:.4px;max-width:440px;line-height:1.4}
#menu input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:30px;background:none;margin:2px 0 8px;cursor:pointer}
#menu input[type=range]::-webkit-slider-runnable-track{height:6px;background:linear-gradient(90deg,var(--acc) var(--p,50%),#ffffff1f var(--p,50%))}
#menu input[type=range]::-moz-range-track{height:6px;background:#ffffff1f}
#menu input[type=range]::-moz-range-progress{height:6px;background:var(--acc)}
#menu input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:24px;margin-top:-9px;background:#fff;border:0;transform:skewX(-14deg);box-shadow:0 0 12px rgba(255,138,31,.6);transition:transform .15s}
#menu input[type=range]:hover::-webkit-slider-thumb{transform:skewX(-14deg) scale(1.12)}
#menu input[type=range]::-moz-range-thumb{width:16px;height:24px;background:#fff;border:0;border-radius:0}
#menu .split{display:grid;grid-template-columns:1fr 1fr;gap:12px}
#menu .split > .pan{margin-bottom:12px}

/* ── ana düğmeler ── */
#menu .play{position:relative;display:flex;align-items:center;gap:16px;padding:20px 48px 20px 30px;font-size:34px;font-weight:800;letter-spacing:5px;text-transform:uppercase;font-style:italic;color:#160a02;background:linear-gradient(100deg,#ffb347,#ff7a12 60%,#e85d04);clip-path:polygon(0 0,100% 0,calc(100% - 22px) 100%,0 100%);transition:filter .2s,padding .2s var(--ease),box-shadow .2s;box-shadow:0 0 40px rgba(255,138,31,.4);text-align:left;min-width:420px;line-height:1}
#menu .play > span{display:block;min-width:0}
#menu .play small{display:block;font-size:13px;letter-spacing:2px;font-style:normal;font-weight:700;opacity:.72;margin-top:6px}
#menu .play .ic{width:30px;height:30px;stroke-width:2}
#menu .play:hover{filter:brightness(1.1) saturate(1.1);padding-left:40px}
#menu .play::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.35) 45%,transparent 60%);transform:translateX(-100%);transition:transform .6s var(--ease);pointer-events:none}
#menu .play:hover::after{transform:translateX(100%)}
#menu .play.sec{background:linear-gradient(100deg,rgba(40,50,66,.92),rgba(24,31,42,.92));color:#e8edf5;box-shadow:inset 0 0 0 1px var(--line);font-size:19px;letter-spacing:3px;padding:14px 30px 14px 20px;min-width:0;gap:12px;backdrop-filter:blur(8px)}
#menu .play.sec .ic{width:22px;height:22px;color:var(--acc2)}
#menu .play.sec:hover{background:linear-gradient(100deg,rgba(58,71,92,.95),rgba(38,48,63,.95));padding-left:26px;box-shadow:inset 0 0 0 1px var(--acc)}
#menu .play.sec::after{display:none}
#menu .play[disabled]{opacity:.5;cursor:wait}

/* ── Ana Menü: sol altta seçili maç + düğmeler, sağ üstte yenilikler + teçhizat ── */
#menu .home{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:28px;height:100%;min-height:0}
#menu .hero{grid-column:1;grid-row:1;align-self:end;display:flex;flex-direction:column;gap:12px;min-width:0}
#menu .hero .kick{display:flex;align-items:center;gap:10px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:var(--acc2);font-weight:700}
#menu .hero .kick::before{content:'';width:28px;height:2px;background:var(--acc)}
#menu .hero h1{margin:0;font-size:72px;line-height:.9;font-weight:800;letter-spacing:4px;text-transform:uppercase;font-style:italic;text-shadow:0 4px 30px rgba(0,0,0,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#menu .hero .htag{color:#b9c3d2;font-size:14px;letter-spacing:3px;text-transform:uppercase;margin-top:-4px;text-shadow:0 1px 8px #000}
#menu .home .cta{display:flex;flex-direction:column;gap:10px;align-items:flex-start;margin-top:6px}
#menu .home .cta2{display:flex;gap:10px;flex-wrap:wrap}
#menu .sumline{display:flex;gap:8px;flex-wrap:wrap}
#menu .sumline span{display:inline-flex;align-items:center;gap:8px;background:rgba(10,14,21,.72);border:1px solid var(--line);padding:6px 12px;font-size:14px;letter-spacing:1px;text-transform:uppercase;backdrop-filter:blur(6px)}
#menu .sumline span .ic{width:16px;height:16px;color:var(--acc2)}
#menu .sumline span b{color:var(--acc2)}
#menu .sumline span.dev{border-color:var(--acc);color:var(--acc2)}
#menu .home-side{grid-column:2;grid-row:1;align-self:start;display:flex;flex-direction:column;gap:10px;min-height:0}
#menu .news{margin:0;padding:14px 18px}
#menu .news h3{justify-content:space-between}
#menu .news h3 em{font-style:normal;font-size:11px;letter-spacing:1px;padding:2px 7px;background:var(--acc);color:#160a02}
#menu .news ul{margin:0;padding:0}
#menu .news li{margin:7px 0;font-size:14px;color:#c5cfdd;line-height:1.35;list-style:none;padding-left:16px;position:relative}
#menu .news li::before{content:'';position:absolute;left:0;top:7px;width:6px;height:6px;background:var(--acc);transform:rotate(45deg)}
#menu .lcard{position:relative;display:block;width:100%;margin:0;text-align:left;padding:12px 40px 13px 18px;transition:border-color .18s,background .18s}
#menu .lcard small{display:block;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--acc2);font-weight:700}
#menu .lcard b{display:block;font-size:20px;letter-spacing:2px;text-transform:uppercase;margin-top:3px}
#menu .lcard span{display:block;font-size:13px;color:var(--dim);letter-spacing:.5px;margin-top:2px}
#menu .lcard i{position:absolute;right:16px;top:50%;transform:translateY(-50%);font-style:normal;font-size:28px;color:var(--dim);transition:transform .18s var(--ease),color .18s}
#menu .lcard:hover{border-color:var(--acc);background:var(--pan2)}
#menu .lcard:hover i{color:var(--acc);transform:translate(4px,-50%)}

/* ── Sınıf & Silah ── */
#menu .tabs{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;flex:none}
#menu .tab{padding:10px 16px;background:rgba(10,14,21,.75);border:1px solid var(--line);font-size:15px;font-weight:700;letter-spacing:2px;text-transform:uppercase;transition:background .15s,border-color .15s,color .15s;backdrop-filter:blur(6px)}
#menu .tab:hover{background:#ffffff1c;border-color:var(--line2)}
#menu .tab.on{background:var(--acc);color:#160a02;border-color:var(--acc);box-shadow:0 0 18px rgba(255,138,31,.3)}
#menu .clsdesc{color:#c5cfdd;font-size:14px;letter-spacing:.5px;margin:0 0 10px;padding:8px 12px;background:var(--pan);border-left:3px solid var(--acc)}
#menu .slots{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
#menu .slotb{text-align:left;padding:8px 10px;background:var(--pan);border:1px solid var(--line);transition:background .15s,border-color .15s;min-height:92px;position:relative;overflow:hidden;backdrop-filter:blur(8px)}
#menu .slotb small{display:block;font-size:11px;letter-spacing:2px;color:var(--dim);text-transform:uppercase}
#menu .slotb b{display:block;font-size:15px;letter-spacing:1px;text-transform:uppercase;margin-top:2px;position:relative;z-index:1}
#menu .slotb img{position:absolute;right:2px;bottom:2px;width:58%;opacity:.95;pointer-events:none}
#menu .slotb:hover{background:var(--pan2);border-color:var(--line2)}
#menu .slotb.on{border-color:var(--acc);background:linear-gradient(180deg,rgba(255,138,31,.2),rgba(255,138,31,.06));box-shadow:inset 0 -2px 0 var(--acc)}
#menu .slotb.on small{color:var(--acc2)}
#menu .wgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
/* silah kaplaması çipleri (12.122): seçili silah kartlarının altında; renk örneği kamuflaj desenli */
#menu .skins{margin-top:12px}
#menu .skins h4{margin:0 0 8px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:var(--acc2);font-weight:700}
#menu .skins h4 em{font-style:normal;color:var(--dim);letter-spacing:1px;font-weight:600;text-transform:none;margin-left:8px}
#menu .chip.sk{display:inline-flex;align-items:center;gap:8px;padding:8px 12px 8px 8px;font-size:13px;min-height:40px;min-width:0}
#menu .chip.sk .sw{width:22px;height:22px;flex:none;border:1px solid #ffffff40;box-shadow:inset 0 0 0 1px #0006}
#menu .sw-wood{background:radial-gradient(circle at 30% 35%,#6e5435 0 22%,transparent 23%),radial-gradient(circle at 72% 64%,#23241e 0 20%,transparent 21%),radial-gradient(circle at 70% 22%,#8f8a5e 0 14%,transparent 15%),#56603a !important}
#menu .sw-urban{background:linear-gradient(90deg,#4f5359 0 25%,transparent 25% 50%,#26282c 50% 62%,transparent 62%),linear-gradient(0deg,#b3b6ba 0 30%,transparent 30% 70%,#4f5359 70%),#7d8187 !important}
#menu .sw-gold{background:linear-gradient(135deg,#f6d27a,#d9a93c 45%,#8f6a1c) !important}
#menu .sw-desert{background:linear-gradient(180deg,#b89a6a,#a8895c) !important}
#menu .wc{text-align:left;position:relative;background:#ffffff08;border:1px solid var(--line);padding:8px 10px 10px;transition:background .15s,border-color .15s,transform .15s var(--ease)}
#menu .wc:hover{background:#ffffff14;transform:translateY(-2px);border-color:var(--line2)}
#menu .wc.on{border-color:var(--acc);background:rgba(255,138,31,.15);box-shadow:inset 0 0 0 1px var(--acc)}
#menu .wc img{width:100%;height:68px;object-fit:contain;display:block}
#menu img:not([src]){visibility:hidden}
#menu .wc b{display:block;font-size:15px;letter-spacing:1px;text-transform:uppercase}
#menu .wc .mini{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;margin-top:5px;font-size:10px;letter-spacing:1px;color:var(--dim);text-transform:uppercase;align-items:center}
#menu .bar{height:4px;background:#ffffff1c;position:relative}
#menu .bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,var(--acc),var(--acc2))}
#menu .wdesc{margin-top:10px;color:#b9c3d2;font-size:15px;line-height:1.45;min-height:22px}
#menu .stat{display:grid;grid-template-columns:110px 1fr 38px;gap:10px;align-items:center;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--dim);margin:6px 0}
#menu .stat .bar{height:6px}
#menu .stat em{font-style:normal;color:#fff;text-align:right;font-weight:700}

/* ── Ayarlar / Kontroller ── */
#menu .s-settings .pan{max-width:980px}
#menu .setrow{display:grid;grid-template-columns:220px 1fr 70px;gap:14px;align-items:center;margin:6px 0;font-size:15px;letter-spacing:1px;text-transform:uppercase}
#menu .setrow em{font-style:normal;color:var(--acc2);text-align:right;font-weight:700}
#menu .kgrid{display:grid;grid-template-columns:1fr 1fr;gap:0 12px;align-items:start}
#menu .kbrow{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:5px 0;border-bottom:1px solid var(--line);font-size:14px;letter-spacing:.4px}
#menu .kbrow:last-child{border-bottom:0}
#menu .kbrow > div{display:flex;gap:6px}
#menu .kbk{min-width:84px;padding:6px 10px;background:#ffffff10;border:1px solid var(--line);border-bottom-width:3px;font:inherit;font-size:14px;font-weight:700;color:#fff;cursor:pointer;text-transform:uppercase;transition:background .15s,border-color .15s}
#menu .kbk:hover{background:#ffffff22;border-color:var(--line2)}
#menu .kbk.cap{background:rgba(255,138,31,.3);border-color:var(--acc);animation:kbp 1s infinite alternate}
@keyframes kbp{to{box-shadow:0 0 14px rgba(255,138,31,.6)}}
#menu table.keys{width:100%;border-collapse:collapse;font-size:15px}
#menu table.keys td{padding:8px 4px;border-bottom:1px solid var(--line);vertical-align:top}
#menu table.keys tr:last-child td{border-bottom:0}
#menu table.keys td:first-child{color:var(--dim);letter-spacing:2px;text-transform:uppercase;width:36%;font-size:13px}

/* ── Çevrimiçi ── */
#menu .olin{width:100%;padding:12px 14px;background:#ffffff0d;border:1px solid var(--line);color:#fff;font:600 17px/1 Consolas,'Courier New',monospace;letter-spacing:1px;outline:none;transition:border-color .15s,background .15s}
#menu .olin:focus{border-color:var(--acc);background:#ffffff16}
#menu .olin::placeholder{color:#ffffff55}
#menu .olin.code{font-size:30px;letter-spacing:12px;text-align:center;text-transform:uppercase;padding:10px 0 10px 12px}
#menu .codejoin{display:grid;grid-template-columns:150px 1fr auto;gap:8px;align-items:stretch}
#menu .codejoin .play.sec{padding:10px 22px;font-size:17px}
#menu .olmsg{padding:12px 16px;border:1px solid var(--line);background:var(--pan);font-size:15px;letter-spacing:.5px;margin-bottom:12px}
#menu .olmsg.err{border-color:var(--red);color:#ffb3a8;background:rgba(60,14,10,.82)}
#menu h3.sub{margin:4px 0 10px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--acc2);display:flex;gap:10px;align-items:center;flex-wrap:wrap}#menu h3.sub em{font-style:normal;color:var(--dim);letter-spacing:.5px;text-transform:none;font-weight:500}
#menu .rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));gap:10px}
#menu .rcard{display:flex;align-items:stretch;background:#ffffff08;border:1px solid var(--line);min-height:84px;overflow:hidden;transition:border-color .15s,background .15s}
#menu .rcard:hover{border-color:var(--line2);background:#ffffff10}
#menu .rcard.off{border-color:rgba(255,138,31,.4);background:linear-gradient(90deg,rgba(255,138,31,.12),#ffffff06)}
#menu .rcard .th{width:96px;flex:none;background-size:cover;background-position:center;opacity:.9}
#menu .rcard .rb{flex:1;padding:8px 12px;min-width:0}
#menu .rcard .rt{display:flex;gap:6px;align-items:center;font-size:17px;white-space:nowrap;overflow:hidden}#menu .rcard .rt b{overflow:hidden;text-overflow:ellipsis}
#menu .rcard .rs{font-size:13px;color:var(--dim);letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#menu .rcard .rs.by{opacity:.7}
#menu .bd{font-style:normal;font-size:10px;letter-spacing:2px;background:var(--acc);color:#111;padding:2px 6px;font-weight:800}#menu .lk{font-style:normal;font-size:13px}
#menu .rcard .rp{display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;padding:8px 10px;gap:6px}
#menu .pc{font-size:20px;text-align:right;line-height:1}#menu .pc small{display:block;font-size:10px;color:var(--dim);letter-spacing:1.5px;text-transform:uppercase}#menu .pc.full b{color:var(--red)}
#menu .chip.join{min-width:78px;padding:6px 12px}
#menu .pwp{border-color:var(--acc)}

/* ── Maç kurucu (Özel Oyun / Oda Kur): 1 Mod → 2 Harita → 3 Ayarlar + sağda canlı özet ── */
#menu .bld{display:grid;grid-template-columns:minmax(0,1fr) 336px;gap:20px;flex:1;min-height:0}
#menu .bld > .scroll{padding-right:12px;scroll-behavior:smooth}
#menu .bsteps{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:flex-start;gap:8px;padding:6px 10px;margin:0 0 14px;background:rgba(8,11,17,.94);border:1px solid var(--line);backdrop-filter:blur(10px)}
#menu .bsteps span{width:40px;height:1px;background:var(--line2)}
#menu .bsteps button{display:flex;align-items:center;gap:9px;padding:6px 14px 6px 8px;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--dim);transition:color .15s}
#menu .bsteps button i{font-style:normal;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--dim);border-radius:50%;font-size:12px;transition:background .15s,border-color .15s,color .15s}
#menu .bsteps button:hover{color:#fff}
#menu .bsteps button.on{color:#fff}
#menu .bsteps button.on i{background:var(--acc);border-color:var(--acc);color:#160a02}
#menu section.bs{margin-bottom:24px;scroll-margin-top:58px}
#menu section.bs h2{margin:0 0 12px;display:flex;align-items:center;gap:12px;font-size:19px;letter-spacing:3px;text-transform:uppercase;font-weight:800;text-shadow:0 1px 10px #000}
#menu section.bs h2 i{font-style:normal;width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--acc2),var(--acc3));color:#160a02;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);font-size:15px}
#menu section.bs h2 small{font-size:12px;letter-spacing:2px;color:var(--dim);font-weight:600;margin-left:4px}
#menu .mdgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
#menu .mdc{position:relative;text-align:left;padding:14px 16px 14px 66px;min-height:108px;background:var(--pan2);border:1px solid var(--line);transition:border-color .16s,background .16s,transform .16s var(--ease);clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%)}
#menu .mdc:hover{border-color:var(--line2);background:rgba(22,28,40,.92);transform:translateY(-2px)}
#menu .mdc .ic{position:absolute;left:14px;top:14px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:22px;background:#ffffff0d;border:1px solid var(--line);transition:background .16s,border-color .16s}
#menu .mdc b{display:block;font-size:18px;letter-spacing:2px;text-transform:uppercase}
#menu .mdc em{display:block;font-style:normal;font-size:11px;letter-spacing:1.5px;color:var(--acc2);font-weight:700;text-transform:uppercase;margin:1px 0 5px}
#menu .mdc small{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:12.5px;line-height:1.35;color:var(--dim);letter-spacing:.2px}
#menu .mdc.on{border-color:var(--acc);background:linear-gradient(180deg,rgba(255,138,31,.2),rgba(255,138,31,.06)),var(--pan2);box-shadow:inset 0 0 0 1px var(--acc)}
#menu .mdc.on .ic{background:var(--acc);border-color:var(--acc)}
#menu .mdc.on small{color:#c5cfdd}
#menu section.bs .hint{background:var(--pan2);border:1px solid var(--line);padding:8px 12px;margin-top:8px}
#menu .sgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#menu .sc{background:var(--pan2);border:1px solid var(--line);padding:13px 16px 15px;backdrop-filter:blur(10px)}
#menu .sc.wide{grid-column:1/-1}
#menu .sc h4{margin:0 0 10px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:var(--acc2);font-weight:700;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
#menu .sc h4 em{font-style:normal;color:var(--dim);letter-spacing:.5px;font-weight:600;text-transform:none;font-size:12px}
#menu .sc .row + .row,#menu .sc .row + .hint,#menu .sc .hint + .row{margin-top:10px}
#menu .sc .big .n{font-size:52px}
#menu .sc .warn{display:block;color:#ffb347;margin-top:4px}
#menu .sc .hint{background:none;border:0;padding:0}
#menu .bld-mini{display:none}
#menu .bld-side{min-height:0;display:flex}
#menu .pv{flex:1;display:flex;flex-direction:column;background:var(--pan);border:1px solid var(--line);padding:12px;backdrop-filter:blur(12px);clip-path:polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%);overflow:hidden}
#menu .pvimg{position:relative;aspect-ratio:16/8.2;background:#10151f center/cover;border:1px solid var(--line);flex:none}
#menu .pvimg.rnd{display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(45deg,#121926,#121926 10px,#0e131c 10px,#0e131c 20px)}
#menu .pvimg.rnd .ic{width:52px;height:52px;color:var(--dim);stroke-width:1.4}
#menu .pvm{position:absolute;left:8px;top:8px;padding:4px 10px;background:rgba(7,10,16,.88);border:1px solid var(--acc);font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--acc2)}
#menu .pv h2{margin:12px 0 0;font-size:26px;letter-spacing:3px;text-transform:uppercase;font-weight:800;font-style:italic}
#menu .pvtag{color:var(--dim);font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px}
#menu .pvl{list-style:none;margin:0;padding:0;flex:1;overflow:auto;border-top:1px solid var(--line)}
#menu .pvl li{display:flex;justify-content:space-between;gap:10px;padding:6px 2px;border-bottom:1px solid #ffffff0d;font-size:14px;letter-spacing:.5px}
#menu .pvl li span{color:var(--dim);text-transform:uppercase;font-size:12px;letter-spacing:2px;flex:none}
#menu .pvl li b{text-align:right;font-weight:700}
#menu .pvbtn{display:flex;flex-direction:column;gap:8px;padding-top:12px}
#menu .pvbtn .play,#menu .bld-mini .play{width:100%;min-width:0;font-size:25px;letter-spacing:3px;padding:14px 18px;white-space:nowrap;gap:12px}
#menu .pvbtn .play small,#menu .bld-mini .play small{display:inline;margin-left:10px;font-size:12px;opacity:.7;letter-spacing:1px}
#menu .pvbtn .play .ic,#menu .bld-mini .play .ic{width:24px;height:24px}
#menu .pvbtn .back{width:100%;text-align:center}

@media(max-width:1180px){#menu .bld{grid-template-columns:1fr}#menu .bld-side{display:none}#menu .bld-mini{display:flex;gap:10px;padding:10px 0 4px;position:sticky;bottom:0;background:linear-gradient(0deg,rgba(7,10,16,.95),transparent)}#menu .home{grid-template-columns:1fr}#menu .home-side{display:none}#menu .kgrid{grid-template-columns:1fr}}
@media(max-width:1100px){#menu .mn-side{width:220px}#menu .mn-stage{left:280px}#menu .maps,#menu .tods{grid-template-columns:repeat(2,1fr)}#menu .mn-logo{font-size:40px}#menu .hero h1{font-size:56px}#menu .play{min-width:0}}
@media(max-width:760px){#menu .mn-side{top:120px;width:auto;flex-direction:row;right:10px;bottom:auto;left:10px;overflow-x:auto}#menu .mn-nav{font-size:13px;padding:6px 10px;letter-spacing:1px;gap:8px}#menu .mn-nav .ic{width:30px;height:30px;padding:6px}#menu .mn-nav small,#menu .mn-nav::before{display:none}#menu .mn-stage,#menu .mn-stage.right{left:10px;right:10px;top:190px;width:auto}#menu .mn-top{left:14px;right:14px}#menu .mn-user{display:none}#menu .split{grid-template-columns:1fr}#menu .wgrid{grid-template-columns:repeat(2,1fr)}#menu .play{min-width:0;font-size:24px;width:100%}#menu .sgrid{grid-template-columns:1fr}#menu .mdgrid{grid-template-columns:1fr}#menu .setrow{grid-template-columns:1fr 70px}#menu .setrow input{grid-column:1/-1;grid-row:2}#menu .codejoin{grid-template-columns:1fr}}

/* yatay telefon (kısa ekran): küçük logo, solda dar dikey menü (ikon + ad), sağda kayan içerik */
@media(max-height:520px){
#menu .mn-top{left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));top:8px}#menu .mn-logo{font-size:24px;letter-spacing:3px}#menu .mn-logo small{font-size:8px;letter-spacing:3px;margin-top:3px}#menu .mn-user,#menu .mn-langs{display:none}
#menu .mn-side{left:max(10px,env(safe-area-inset-left));top:44px;bottom:22px;right:auto;width:156px;flex-direction:column;overflow-y:auto;overflow-x:hidden;gap:2px}
#menu .mn-logo small{display:none}
#menu .mn-nav{font-size:11.5px;padding:4px 6px;letter-spacing:.6px;gap:8px;white-space:nowrap}#menu .mn-nav .tx{overflow:hidden;text-overflow:ellipsis}#menu .mn-nav small{display:none}#menu .mn-nav .ic{width:30px;height:30px;padding:6px}#menu .mn-nav::before{left:-10px}#menu .mn-nav:hover{transform:none}
#menu .mn-stage,#menu .mn-stage.right{left:calc(max(10px,env(safe-area-inset-left)) + 168px);right:max(10px,env(safe-area-inset-right));top:10px;bottom:22px;width:auto}
#menu .mn-head{margin:0 0 8px;padding-bottom:6px;gap:10px;flex-wrap:nowrap}#menu .mn-head h1{font-size:18px;letter-spacing:2px}#menu .mn-head h1::before{width:5px;height:14px;margin-right:8px}#menu .mn-head p{display:none}#menu .mn-head em{font-size:11px;padding:3px 8px}
#menu .s-custom .mn-head,#menu .s-ocreate .mn-head{display:none}
#menu .mn-foot{left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));bottom:4px;font-size:10px}
#menu .play{font-size:22px;min-width:0;padding:12px 28px 12px 18px}#menu .play .ic{width:22px;height:22px}#menu .play small{font-size:10px;margin-top:3px}
#menu .play.sec{font-size:14px;padding:8px 18px 8px 12px;letter-spacing:2px}#menu .play.sec .ic{width:18px;height:18px}
#menu .split{grid-template-columns:1fr}
#menu .home{grid-template-columns:1fr}#menu .home-side{display:none}#menu .hero{gap:7px}#menu .hero h1{font-size:34px;letter-spacing:2px}#menu .hero .kick{font-size:10px}#menu .hero .htag{font-size:11px;margin-top:-2px}
#menu .home .play{width:auto}#menu .sumline span{font-size:11px;padding:3px 8px}#menu .sumline span .ic{display:none}#menu .home .cta{flex-direction:row;flex-wrap:wrap;align-items:stretch}#menu .home .cta2{gap:6px}
#menu .pan{padding:10px 12px 12px;margin-bottom:8px}#menu .pan h3{margin-bottom:8px;font-size:12px}
#menu .mdgrid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}#menu .mdc{padding:8px 10px 8px 50px;min-height:0}#menu .mdc .ic{left:8px;top:8px;width:34px;height:34px;font-size:18px}#menu .mdc b{font-size:15px}#menu .mdc small{-webkit-line-clamp:2;font-size:11.5px}
#menu section.bs{margin-bottom:16px}#menu section.bs h2{font-size:15px;margin-bottom:8px}#menu .bsteps{padding:2px 6px;margin-bottom:10px}#menu .bsteps button{font-size:12px}#menu .bsteps span{width:16px}
#menu .bld-mini .play{font-size:18px;padding:8px 14px}#menu .bld-mini{padding:6px 0 2px}#menu .bld-mini .chip.back{flex:none}
#menu .big .n{font-size:38px}#menu .sc .big .n{font-size:38px}#menu .sc{padding:10px 12px 12px}
#menu .setrow{grid-template-columns:150px 1fr 54px;font-size:13px;gap:10px}
#menu .kgrid{grid-template-columns:1fr}#menu .rgrid{grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}#menu .rcard .th,#menu .rcard .bd{display:none}#menu .rcard{min-height:0}#menu .rcard .rt{font-size:15px}#menu .rcard .rs{font-size:12px}
#menu .s-loadout .pan,#menu .s-loadout .slotb,#menu .s-loadout .clsdesc{background:rgba(10,14,21,.94)}
#menu .slotb{min-height:70px}#menu .wc img{height:50px}#menu .clsdesc{font-size:12px;padding:5px 10px;margin-bottom:6px}#menu .tabs{gap:4px;margin-bottom:6px}#menu .tab{padding:6px 10px;font-size:12px;letter-spacing:1px}
#menu .codejoin{grid-template-columns:120px 1fr auto}#menu .olin.code{font-size:22px;letter-spacing:8px}
}
/* ── hesap: oyuncu kartında rozet + eylem, telefonda sol menünün üstünde satır, ilk açılışta giriş kartı (menu.js renderAuth) ── */
#menu .mn-user .nmrow{display:flex;align-items:center;gap:8px}
#menu .mn-user .nmv{display:inline-block;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;padding:1px 0}
#menu .mn-user .ub{font-style:normal;font-size:9.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:3px 6px;background:rgba(255,138,31,.2);color:var(--acc2);border:1px solid rgba(255,138,31,.45);line-height:1}
#menu .mn-user .ub.g{background:#ffffff0d;color:var(--dim);border-color:var(--line2)}
#menu .mn-user .ua{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#cfd7e3;padding:4px 9px;border:1px solid var(--line2);background:#ffffff0a;margin-left:auto;transition:color .15s,border-color .15s,background .15s}
#menu .mn-user .ua:hover{color:#fff;border-color:var(--acc);background:rgba(255,138,31,.16)}
#menu .mn-acct{display:none}
#menu .mn-acct .pa{width:100%}
#menu .mn-acct .pa .tx > span{display:block;overflow:hidden;text-overflow:ellipsis;max-width:100%}
#menu .mn-acct .pa small{display:block!important;font-size:9px;letter-spacing:1px;color:var(--acc2);margin-top:1px}
#menu .mn-auth{position:absolute;inset:0;z-index:30;display:flex;overflow-y:auto;overscroll-behavior:contain;padding:24px max(16px,env(safe-area-inset-right)) 24px max(16px,env(safe-area-inset-left));background:radial-gradient(ellipse at 50% 45%,rgba(4,6,10,.4),rgba(4,6,10,.9) 75%);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:mnIn .3s var(--ease) both}
#menu .mn-auth[hidden]{display:none}
#menu .au-card{margin:auto;width:min(460px,100%);background:linear-gradient(180deg,rgba(16,21,31,.96),rgba(9,12,18,.96));border:1px solid var(--line2);border-top:3px solid var(--acc);padding:22px 28px 22px;clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px));box-shadow:0 30px 80px rgba(0,0,0,.6)}
#menu .au-top{display:flex;align-items:center;gap:10px;margin-bottom:14px}
#menu .au-logo{font-size:30px;line-height:1;font-weight:800;letter-spacing:4px;font-style:italic;text-transform:uppercase;margin-right:auto;user-select:none}
#menu .au-logo b{color:var(--acc)}
#menu .au-langs{display:flex;border:1px solid var(--line)}
#menu .au-langs .lg{min-width:40px;height:32px;font-size:12px;font-weight:700;letter-spacing:2px;color:var(--dim)}
#menu .au-langs .lg.on{color:#160a02;background:var(--acc)}
#menu .au-x{width:32px;height:32px;font-size:16px;color:var(--dim);border:1px solid var(--line)}
#menu .au-x:hover{color:#fff;border-color:var(--line2)}
#menu .au-hd h2{margin:0;font-size:26px;letter-spacing:3px;text-transform:uppercase;font-style:italic;font-weight:800}
#menu .au-hd h2::before{content:'';display:inline-block;width:7px;height:19px;background:var(--acc);margin-right:10px;transform:skewX(-14deg);vertical-align:-1px}
#menu .au-sub{margin:4px 0 14px;color:#aab5c5;font-size:14px;letter-spacing:.3px}
#menu .au-tabs{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line);margin-bottom:14px;background:#ffffff06}
#menu .au-tabs button{padding:9px 12px;text-align:left;color:#aab5c5;transition:background .15s,color .15s;border-bottom:2px solid transparent}
#menu .au-tabs button b{display:block;font-size:15px;letter-spacing:2px;text-transform:uppercase}
#menu .au-tabs button small{display:block;font-size:11px;color:var(--dim);letter-spacing:.5px;margin-top:1px}
#menu .au-tabs button:hover{color:#fff;background:#ffffff0c}
#menu .au-tabs button.on{color:#fff;background:linear-gradient(180deg,rgba(255,138,31,.28),rgba(255,138,31,.1));border-bottom-color:var(--acc)}
#menu .au-tabs button.on small{color:#ffd3a6}
#menu .au-fields{display:grid;gap:10px}
#menu .au-fields label > span{display:block;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);font-weight:600;margin-bottom:5px}
#menu .au-fields label > span em{font-style:normal;text-transform:none;letter-spacing:.3px;color:var(--dim2);margin-left:8px;font-weight:500}
#menu .au-fields .olin{font:600 17px/1.2 Bahnschrift,'Rajdhani','Segoe UI',system-ui,sans-serif;letter-spacing:1px;min-height:44px}
#menu .au-msg{margin-top:10px;padding:9px 12px;font-size:14px;border:1px solid var(--line);background:#ffffff0a}
#menu .au-msg.err{border-color:var(--red);color:#ffb3a8;background:rgba(60,14,10,.82)}
#menu .au-f .play.au-go{width:100%;min-width:0;margin-top:14px;font-size:24px;letter-spacing:3px;padding:15px 26px 15px 20px;gap:12px}
#menu .au-f .play.au-go .ic{width:24px;height:24px}
#menu .au-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
#menu .au-btns .play{margin-top:0!important;min-width:0;width:100%;justify-content:center;font-size:19px;padding:14px 20px 14px 14px}
#menu .au-btns .play.sec{justify-content:center}
#menu .au-f .hint{margin-top:10px;font-size:12.5px}
@media(max-width:760px){#menu .mn-acct{display:block;flex:none}#menu .mn-acct .pa small{display:none!important}}
@media(max-height:520px){
#menu .mn-acct{display:block;flex:none;order:-1;margin-bottom:3px;border-bottom:1px solid var(--line);padding-bottom:3px}      /* telefonda menünün en üstünde: ekran kısa, altta kalırsa görünmüyordu */
#menu .mn-auth{padding:8px max(12px,env(safe-area-inset-right)) 8px max(12px,env(safe-area-inset-left))}
#menu .au-card{width:min(600px,100%);padding:12px 18px 12px}
#menu .au-top{margin-bottom:6px}#menu .au-logo{font-size:20px;letter-spacing:3px}
#menu .au-hd{display:flex;align-items:baseline;gap:12px}#menu .au-hd h2{font-size:18px;letter-spacing:2px;white-space:nowrap}#menu .au-hd h2::before{width:5px;height:13px;margin-right:8px}
#menu .au-sub{margin:0 0 8px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#menu .au-tabs{margin-bottom:8px}#menu .au-tabs button{padding:4px 10px}#menu .au-tabs button b{font-size:13px}#menu .au-tabs button small{font-size:10px}
#menu .au-fields.two{grid-template-columns:1fr 1fr}#menu .au-fields label > span{font-size:10px;margin-bottom:3px}
#menu .au-fields .olin{min-height:40px;padding:8px 12px;font-size:16px}
#menu .au-f .play.au-go{margin-top:8px;font-size:18px;padding:10px 18px}#menu .au-btns{margin-top:8px}#menu .au-btns .play{font-size:16px;padding:10px 12px}
#menu .au-f .hint{margin-top:6px;font-size:11px;line-height:1.35}#menu .au-msg{margin-top:6px;padding:6px 10px;font-size:13px}
}
html.touch #menu .au-langs .lg,html.touch #menu .au-x{min-height:40px;height:40px}
html.touch #menu .mn-user .ua{min-height:40px}
/* dokunmatik cihaz (main.js → html.touch): her düğme / kaydırıcı en az 40 px (parmakla rahat); masaüstü etkilenmez */
html.touch #menu button{min-height:40px;min-width:40px}
html.touch #menu .mn-nav{min-height:40px}
html.touch #menu input[type=range]{height:40px;margin:0}
html.touch #menu input[type=text],html.touch #menu input[type=password],html.touch #menu .olin{min-height:40px}
html.touch #menu .mn-user .nm input{min-height:40px}
html.touch #menu *:hover{transform:none}

/* ── yükleme ekranı (main.js) ── */
#loading{position:fixed;inset:0;display:none;z-index:50;background:radial-gradient(900px 500px at 30% 40%,#1b2433,#070a10);color:#e8edf5;font-family:Bahnschrift,'Rajdhani','Arial Narrow','Segoe UI',system-ui,sans-serif;flex-direction:column;align-items:center;justify-content:center;gap:16px;letter-spacing:4px;text-transform:uppercase;padding:20px}
#loading::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 79px,rgba(255,255,255,.025) 79px 80px),repeating-linear-gradient(0deg,transparent 0 79px,rgba(255,255,255,.025) 79px 80px);pointer-events:none}
#loading .lg{font-size:54px;font-weight:800;font-style:italic;position:relative;text-shadow:0 4px 30px rgba(0,0,0,.6)}#loading .lg b{color:#ff8a1f}
#loading .lm{position:relative;font-size:15px;letter-spacing:4px;color:#ffb347;font-weight:700;text-align:center}
#loading .nk{position:relative;display:flex;flex-direction:column;align-items:center;gap:14px;width:min(380px,100%)}#loading .nk .lm{font-size:16px}#loading .nk input{width:100%;box-sizing:border-box;font-family:inherit;font-size:22px;font-weight:600;line-height:1.2;letter-spacing:1px;text-transform:none;text-align:center;color:#fff;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:12px 14px;outline:none}#loading .nk input:focus{border-color:#ff8a1f}#loading .nk button{width:100%;font-family:inherit;font-size:18px;font-weight:800;line-height:1;letter-spacing:3px;text-transform:uppercase;color:#111;background:#ff8a1f;border:0;border-radius:8px;padding:14px;cursor:pointer}#loading .nk button:active{transform:translateY(1px)}
#loading .lm small{display:block;font-size:11px;letter-spacing:3px;color:#8d99ab;margin-top:6px;font-weight:600}
#loading .lb{width:min(340px,80vw);height:4px;background:#ffffff1f;overflow:hidden;position:relative}
#loading .lb::after{content:'';position:absolute;left:-40%;top:0;bottom:0;width:40%;background:linear-gradient(90deg,#ff8a1f,#ffb347);animation:ldb 1.1s infinite ease-in-out}
@keyframes ldb{to{left:100%}}
#loading .lt{position:relative;font-size:14px;color:#8d99ab;letter-spacing:1.5px;text-transform:none;max-width:520px;text-align:center;line-height:1.5}
#loading .lt b{color:#ffb347}
#loading .lt a{color:#ff8a1f}
@media(max-height:520px){#loading{gap:10px}#loading .lg{font-size:36px}}
`;
