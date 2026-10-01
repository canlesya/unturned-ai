// Menü stilleri (JS içinde: tek dosya derlemede de çalışsın)
export const MENU_CSS = `
#menu{position:fixed;inset:0;z-index:20;overflow:hidden;color:#e8edf5;background:#070a10;font-family:Bahnschrift,'Rajdhani','Oswald','Arial Narrow','Segoe UI',system-ui,sans-serif;
  --acc:#ff8a1f;--acc2:#ffb347;--blue:#4aa3ff;--red:#ff5a43;--dim:#8d99ab;--pan:rgba(11,15,22,.78);--line:rgba(255,255,255,.1)}
#menu *{box-sizing:border-box}
#menu canvas#mnBg{position:absolute;inset:0;width:100%;height:100%;display:block}
#menu .mn-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 30% 50%,transparent 0%,rgba(4,6,10,.35) 55%,rgba(4,6,10,.88) 100%),linear-gradient(90deg,rgba(4,6,10,.88) 0%,rgba(4,6,10,.35) 38%,rgba(4,6,10,.1) 60%,rgba(4,6,10,.55) 100%)}
#menu .mn-vig.light{background:linear-gradient(90deg,rgba(4,6,10,.0) 0%,rgba(4,6,10,.0) 40%,rgba(4,6,10,.7) 100%)}
#menu button{font:inherit;color:inherit;cursor:pointer;border:0;background:none}
#menu .mn-top{position:absolute;left:44px;top:26px;right:44px;display:flex;align-items:flex-start;justify-content:space-between;z-index:3}
#menu .mn-logo{font-size:58px;line-height:.9;font-weight:800;letter-spacing:5px;text-transform:uppercase;font-style:italic;text-shadow:0 4px 24px rgba(0,0,0,.6)}
#menu .mn-logo b{color:var(--acc);font-weight:800}
#menu .mn-logo small{display:block;font-size:12px;letter-spacing:6px;color:var(--dim);font-style:normal;font-weight:600;margin-top:8px}
#menu .mn-user{display:flex;gap:14px;align-items:center;background:var(--pan);border:1px solid var(--line);padding:9px 16px 9px 12px;backdrop-filter:blur(8px);clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)}
#menu .mn-lv{width:46px;height:46px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;background:linear-gradient(135deg,var(--acc),#c4560a);color:#160a02;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
#menu .mn-user .nm{font-size:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
#menu .mn-user .nm input{background:none;border:0;border-bottom:1px dashed #ffffff44;color:inherit;font:inherit;text-transform:inherit;letter-spacing:inherit;width:140px;outline:0}
#menu .mn-user .xp{height:5px;background:#ffffff1c;margin-top:5px;width:170px}
#menu .mn-user .xp i{display:block;height:100%;background:var(--acc)}
#menu .mn-user small{display:block;color:var(--dim);font-size:11px;letter-spacing:1px;margin-top:3px}
#menu .mn-side{position:absolute;left:44px;top:170px;bottom:70px;width:290px;display:flex;flex-direction:column;gap:4px;z-index:3}
#menu .mn-nav{position:relative;text-align:left;padding:14px 20px 14px 22px;font-size:21px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#c5cfdd;transition:.18s;border-left:4px solid transparent;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0))}
#menu .mn-nav small{display:block;font-size:11px;letter-spacing:2px;color:var(--dim);font-weight:600;margin-top:1px}
#menu .mn-nav:hover{color:#fff;padding-left:30px;background:linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,0))}
#menu .mn-nav.on{color:#fff;border-left-color:var(--acc);background:linear-gradient(90deg,rgba(255,138,31,.28),rgba(255,138,31,0));padding-left:30px}
#menu .mn-spacer{flex:1}
#menu .mn-stage{position:absolute;left:380px;right:44px;top:150px;bottom:64px;z-index:2;display:flex;flex-direction:column}
#menu .mn-stage.right{left:auto;width:min(46vw,760px)}
#menu .mn-foot{position:absolute;left:44px;right:44px;bottom:22px;display:flex;justify-content:space-between;color:var(--dim);font-size:13px;letter-spacing:1px;z-index:3}
#menu .mn-foot b{color:var(--acc2)}
#menu .scroll{overflow-y:auto;padding-right:10px;flex:1;min-height:0;scrollbar-width:thin;scrollbar-color:#ffffff33 transparent}
#menu .pan{background:var(--pan);border:1px solid var(--line);padding:16px 20px 18px;margin-bottom:14px;backdrop-filter:blur(10px);clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)}
#menu .pan h3{margin:0 0 12px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:var(--acc2);font-weight:700;display:flex;gap:10px;align-items:center}
#menu .pan h3::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--line),transparent)}
#menu .pan h3 em{font-style:normal;color:var(--dim);letter-spacing:1px;font-weight:600;text-transform:none;font-size:12px;order:3}
#menu .row{display:flex;gap:10px;flex-wrap:wrap}
#menu .chip{padding:9px 16px;background:#ffffff0d;border:1px solid var(--line);font-size:15px;font-weight:600;letter-spacing:1px;transition:.15s;text-transform:uppercase;min-width:64px;text-align:center}
#menu .chip:hover{background:#ffffff1c;border-color:#ffffff44}
#menu .chip.on{background:linear-gradient(180deg,rgba(255,138,31,.36),rgba(255,138,31,.16));border-color:var(--acc);color:#fff;box-shadow:0 0 14px rgba(255,138,31,.25)}
#menu .chip.blue.on{background:rgba(74,163,255,.28);border-color:var(--blue);box-shadow:0 0 14px rgba(74,163,255,.25)}
#menu .chip.red.on{background:rgba(255,90,67,.28);border-color:var(--red);box-shadow:0 0 14px rgba(255,90,67,.25)}
#menu .chip small{display:block;font-size:11px;font-weight:500;color:var(--dim);letter-spacing:.5px;text-transform:none}
#menu .maps{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
#menu .mapc{position:relative;aspect-ratio:16/10;overflow:hidden;border:2px solid var(--line);transition:.18s;text-align:left;background:#10151f}
#menu .mapc img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:.4s}
#menu .mapc:hover img{transform:scale(1.06)}
#menu .mapc::after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,rgba(5,8,12,.95) 0%,rgba(5,8,12,.2) 55%,transparent)}
#menu .mapc .t{position:absolute;left:12px;bottom:9px;z-index:2}
#menu .mapc .t b{display:block;font-size:19px;letter-spacing:2px;text-transform:uppercase}
#menu .mapc .t small{font-size:11px;color:#aeb8c8;letter-spacing:1px}
#menu .mapc.on{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc),0 0 22px rgba(255,138,31,.35)}
#menu .mapc.rnd{display:flex;align-items:center;justify-content:center;font-size:46px;background:repeating-linear-gradient(45deg,#121926,#121926 10px,#0e131c 10px,#0e131c 20px)}
#menu .mapdesc{margin-top:12px;color:#b9c3d2;font-size:15px;line-height:1.5;min-height:46px}
#menu .mapdesc b{color:#fff}
#menu .tods{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
#menu .tod{height:86px;border:2px solid var(--line);position:relative;overflow:hidden;text-align:left;padding:10px 12px;display:flex;align-items:flex-end;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:16px;transition:.18s}
#menu .tod span{position:relative;z-index:2;text-shadow:0 1px 6px #000}
#menu .tod::before{content:'';position:absolute;inset:0}
#menu .tod.day::before{background:linear-gradient(180deg,#4f94d8,#bcd9ee 60%,#e5d6a8)}
#menu .tod.sunset::before{background:linear-gradient(180deg,#27346a,#d96f45 55%,#ffc17a)}
#menu .tod.night::before{background:radial-gradient(circle at 78% 24%,#f1f5ff 0 7px,transparent 8px),radial-gradient(circle at 30% 30%,#fff 0 1px,transparent 2px),radial-gradient(circle at 52% 16%,#fff 0 1px,transparent 2px),radial-gradient(circle at 12% 18%,#fff 0 1px,transparent 2px),linear-gradient(180deg,#04081a,#162a52)}
#menu .tod.rnd::before{background:repeating-linear-gradient(45deg,#121926,#121926 10px,#0e131c 10px,#0e131c 20px)}
#menu .tod.on{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc),0 0 22px rgba(255,138,31,.35)}
#menu .tod:hover{filter:brightness(1.15)}
#menu .big{display:flex;align-items:baseline;gap:16px;margin-bottom:6px}
#menu .big .n{font-size:64px;font-weight:800;line-height:1;letter-spacing:2px}
#menu .big .n i{color:var(--dim);font-style:normal;font-size:30px;margin:0 12px}
#menu .big .tx{color:var(--dim);font-size:14px;letter-spacing:.5px;max-width:420px;line-height:1.35}
#menu input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:30px;background:none;margin:2px 0 8px}
#menu input[type=range]::-webkit-slider-runnable-track{height:6px;background:linear-gradient(90deg,var(--acc) var(--p,50%),#ffffff1f var(--p,50%))}
#menu input[type=range]::-moz-range-track{height:6px;background:#ffffff1f}
#menu input[type=range]::-moz-range-progress{height:6px;background:var(--acc)}
#menu input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:26px;margin-top:-10px;background:#fff;border:0;transform:skewX(-14deg);box-shadow:0 0 12px rgba(255,138,31,.6)}
#menu input[type=range]::-moz-range-thumb{width:16px;height:26px;background:#fff;border:0;border-radius:0}
#menu .split{display:grid;grid-template-columns:1fr 1fr;gap:14px}
#menu .split3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
#menu .play{position:relative;padding:22px 44px 22px 34px;font-size:34px;font-weight:800;letter-spacing:5px;text-transform:uppercase;font-style:italic;color:#160a02;background:linear-gradient(100deg,#ffb347,#ff7a12 60%,#e85d04);clip-path:polygon(0 0,100% 0,calc(100% - 22px) 100%,0 100%);transition:.2s;box-shadow:0 0 40px rgba(255,138,31,.4);text-align:left;min-width:420px}
#menu .play small{display:block;font-size:13px;letter-spacing:2px;font-style:normal;font-weight:700;opacity:.75;margin-top:4px}
#menu .play:hover{filter:brightness(1.1) saturate(1.1);padding-left:48px}
#menu .play.sec{background:linear-gradient(100deg,#2c3646,#1d2530);color:#e8edf5;box-shadow:none;font-size:22px;padding:14px 34px 14px 24px;min-width:0}
#menu .play.sec:hover{background:linear-gradient(100deg,#3a475c,#26303f)}
#menu .home{display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:18px}
#menu .home .cta{display:flex;gap:14px;align-items:stretch;flex-wrap:wrap}
#menu .sumline{display:flex;gap:10px;flex-wrap:wrap}
#menu .sumline span{background:#ffffff12;border:1px solid var(--line);padding:5px 12px;font-size:14px;letter-spacing:1px;text-transform:uppercase}
#menu .sumline span b{color:var(--acc2)}
#menu .news{position:absolute;right:0;top:0;width:340px;background:var(--pan);border:1px solid var(--line);padding:14px 18px;backdrop-filter:blur(8px)}
#menu .news h3{margin:0 0 8px;font-size:13px;letter-spacing:3px;color:var(--acc2)}
#menu .news li{margin:7px 0;font-size:14px;color:#c5cfdd;line-height:1.35;list-style:none;padding-left:16px;position:relative}
#menu .news li::before{content:'▸';position:absolute;left:0;color:var(--acc)}
#menu .news ul{margin:0;padding:0}
#menu .tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
#menu .tab{padding:10px 16px;background:#ffffff0d;border:1px solid var(--line);font-size:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;transition:.15s}
#menu .tab:hover{background:#ffffff1c}
#menu .tab.on{background:var(--acc);color:#160a02;border-color:var(--acc)}
#menu .slots{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
#menu .slotb{text-align:left;padding:8px 10px;background:#ffffff0a;border:1px solid var(--line);transition:.15s;min-height:92px;position:relative;overflow:hidden}
#menu .slotb small{display:block;font-size:11px;letter-spacing:2px;color:var(--dim);text-transform:uppercase}
#menu .slotb b{display:block;font-size:15px;letter-spacing:1px;text-transform:uppercase;margin-top:2px}
#menu .slotb img{position:absolute;right:2px;bottom:2px;width:58%;opacity:.95;pointer-events:none}
#menu .slotb:hover{background:#ffffff18}
#menu .slotb.on{border-color:var(--acc);background:rgba(255,138,31,.16)}
#menu .wgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
#menu .wc{text-align:left;position:relative;background:#ffffff0a;border:1px solid var(--line);padding:8px 10px 10px;transition:.15s}
#menu .wc:hover{background:#ffffff1a;transform:translateY(-2px)}
#menu .wc.on{border-color:var(--acc);background:rgba(255,138,31,.17);box-shadow:inset 0 0 0 1px var(--acc)}
#menu .wc img{width:100%;height:68px;object-fit:contain;display:block}
#menu .wc b{display:block;font-size:15px;letter-spacing:1px;text-transform:uppercase}
#menu .wc .mini{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;margin-top:5px;font-size:10px;letter-spacing:1px;color:var(--dim);text-transform:uppercase;align-items:center}
#menu .bar{height:4px;background:#ffffff1c;position:relative}
#menu .bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,var(--acc),var(--acc2))}
#menu .wdesc{margin-top:10px;color:#b9c3d2;font-size:15px;line-height:1.45;min-height:44px}
#menu .stat{display:grid;grid-template-columns:96px 1fr 38px;gap:10px;align-items:center;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--dim);margin:6px 0}
#menu .stat .bar{height:6px}
#menu .stat em{font-style:normal;color:#fff;text-align:right}
#menu .setrow{display:grid;grid-template-columns:200px 1fr 70px;gap:14px;align-items:center;margin:8px 0;font-size:16px;letter-spacing:1px;text-transform:uppercase}
#menu .setrow em{font-style:normal;color:var(--acc2);text-align:right;font-weight:700}
#menu table.keys{width:100%;border-collapse:collapse;font-size:15px}
#menu table.keys td{padding:8px 4px;border-bottom:1px solid var(--line);vertical-align:top}
#menu table.keys td:first-child{color:var(--dim);letter-spacing:2px;text-transform:uppercase;width:36%;font-size:13px}
#menu kbd{display:inline-block;background:#ffffff18;border:1px solid #ffffff33;border-bottom-width:3px;padding:0 8px;margin:0 2px;font:inherit;font-size:13px;font-weight:700;min-width:26px;text-align:center}
#menu .hint{color:var(--dim);font-size:13px;margin-top:8px;letter-spacing:.5px;line-height:1.4}
#menu .warn{color:#ffcf7a}
#menu .startbar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding-top:12px;border-top:1px solid var(--line);margin-top:2px}
@media(max-width:1100px){#menu .mn-side{width:210px}#menu .mn-stage{left:270px}#menu .maps,#menu .tods{grid-template-columns:repeat(2,1fr)}#menu .news{display:none}#menu .mn-logo{font-size:40px}}
@media(max-width:760px){#menu .mn-side{top:130px;width:auto;flex-direction:row;right:10px;bottom:auto;left:10px;overflow-x:auto}#menu .mn-nav{font-size:14px;padding:8px 10px;letter-spacing:1px}#menu .mn-nav small{display:none}#menu .mn-stage,#menu .mn-stage.right{left:10px;right:10px;top:200px;width:auto}#menu .mn-top{left:14px;right:14px}#menu .mn-user{display:none}#menu .split,#menu .split3{grid-template-columns:1fr}#menu .wgrid{grid-template-columns:repeat(2,1fr)}#menu .play{min-width:0;font-size:24px;width:100%}}
#loading{position:fixed;inset:0;display:none;z-index:50;background:radial-gradient(900px 500px at 30% 40%,#1b2433,#070a10);color:#e8edf5;font-family:Bahnschrift,'Rajdhani','Arial Narrow','Segoe UI',system-ui,sans-serif;flex-direction:column;align-items:center;justify-content:center;gap:18px;letter-spacing:4px;text-transform:uppercase}
#loading .lg{font-size:54px;font-weight:800;font-style:italic}#loading .lg b{color:#ff8a1f}
#loading .lb{width:340px;height:4px;background:#ffffff1f;overflow:hidden;position:relative}
#loading .lb::after{content:'';position:absolute;left:-40%;top:0;bottom:0;width:40%;background:#ff8a1f;animation:ldb 1.1s infinite ease-in-out}
@keyframes ldb{to{left:100%}}
#loading .lt{font-size:14px;color:#8d99ab;letter-spacing:2px;text-transform:none;max-width:520px;text-align:center;line-height:1.5}
`;
