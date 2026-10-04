// Anlık görüntü (snapshot) boyutu ve bant genişliği: node scripts/snapsize.mjs [tür=conquest] [perTeam=10] [saniye=8]
import WebSocket from 'ws';
const type = process.argv[2] || 'conquest', per = +(process.argv[3] || 10), secs = +(process.argv[4] || 8);
const ws = new WebSocket(process.env.WS || 'ws://127.0.0.1:8787'); let snaps = 0, bytes = 0, evs = 0, evBytes = 0, other = 0, first = 0;
ws.on('open', () => ws.send(JSON.stringify({ t: 'create', name: 'S', cfg: { map: type === 'inf' ? 'newyork' : 'kasaba', type, perTeam: per, time: 600 } })));
ws.on('message', (d) => { const n = d.length; let t = ''; try { t = JSON.parse(d).t; } catch (e) { /* */ } if (t === 'snap') { if (!first) first = Date.now(); snaps++; bytes += n; } else if (t === 'ev') { evs++; evBytes += n; } else other += n; });
setTimeout(() => {
  const dt = (Date.now() - first) / 1000;
  console.log(`${type} ${per}: snapshot ${snaps} adet, ort ${Math.round(bytes / snaps)} bayt → ${(bytes / dt / 1024).toFixed(1)} KB/sn · olaylar ${(evBytes / dt / 1024).toFixed(1)} KB/sn (${(evs / dt).toFixed(0)} mesaj/sn) · toplam aşağı ${((bytes + evBytes) / dt / 1024).toFixed(1)} KB/sn`);
  process.exit(0);
}, secs * 1000);
