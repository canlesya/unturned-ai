# WarByte — Sunucu (VPS) Kurulumu

Çok oyunculu mod tek bir Node.js sürecidir: **hem oyunu (derlenmiş istemci) hem WebSocket oyun sunucusunu** aynı porttan verir.
Veritabanı yok; odalar bellekte tutulur (sunucu yeniden başlarsa odalar kapanır).

> Geliştirme bilgisi için bkz. [`OYUN.md`](OYUN.md) §12 · Yerel kurulum için [`KURULUM.md`](KURULUM.md)

---

## 1. Önerilen sunucu

| | Küçük beta (≈3–5 oda, 10–20 oyuncu) | Daha kalabalık |
|---|---|---|
| CPU / RAM | 1–2 vCPU, 1–2 GB | 2–4 vCPU, 4 GB |
| Ağ | 1 Gbit, aylık 1+ TB | aynı |
| OS | Ubuntu 22.04 / 24.04 | |

Ölçülen: 32v32 (64 savaşçı) tek oda ≈ 3 ms/adım (60 Hz'de çekirdeğin ~%18'i). Bir oda başına bant genişliği şimdilik
≈ oyuncu başına 100–200 KB/s (JSON); 10 kişilik odada yaklaşık 1–2 MB/s. Beta için yeterli, kalabalıkta ikiliye geçilebilir (bkz. OYUN.md §12.6).

---

## 2. Kurulum (Ubuntu)

```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Kod
git clone https://github.com/canlesya/unturned-ai.git
cd unturned-ai
git checkout online            # çevrimiçi sürüm (main'e birleşince gerekmez)
npm ci
npm run build                  # dist/ üretir (istemci)

# Çalıştır (deneme)
PORT=8787 npm start            # http://SUNUCU_IP:8787
```

Tarayıcıdan `http://SUNUCU_IP:8787` açılır; menüde **Çevrimiçi → Oda kur**. Sunucu adresi otomatik gelir.
Durum kontrolü: `curl http://SUNUCU_IP:8787/health` → `{"ok":true,"rooms":0,"players":0}`

## 3. Sürekli çalıştırma (pm2)

```bash
sudo npm i -g pm2
PORT=8787 pm2 start server/index.js --name warbyte
pm2 save && pm2 startup        # çıkan komutu çalıştır (yeniden başlatmada otomatik açılır)
pm2 logs warbyte            # günlük
```

Güncelleme:
```bash
cd unturned-ai && git pull && npm ci && npm run build && pm2 restart warbyte
```
> Yeniden başlatmak açık odaları kapatır; oyuncular yeniden oda kurar.

## 4. Alan adı + HTTPS (nginx)  — önerilir

Güvenli bağlantı (HTTPS) olmadan tarayıcılar bazı şeyleri kısıtlar, ayrıca alan adıyla paylaşmak kolaydır.
`oyun.ornek.com` alan adının A kaydını sunucu IP'sine yönlendir, sonra:

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo tee /etc/nginx/sites-available/warbyte >/dev/null <<'EOF'
server {
  server_name oyun.ornek.com;
  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;       # WebSocket
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
  }
}
EOF
sudo ln -s /etc/nginx/sites-available/warbyte /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d oyun.ornek.com      # ücretsiz TLS
```

İstemci HTTPS'te otomatik `wss://oyun.ornek.com/ws` adresine bağlanır (nginx yukarıdaki kural ile hepsini 8787'ye iletir).

Güvenlik duvarı:
```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
# nginx kullanmıyorsan doğrudan: sudo ufw allow 8787/tcp
```
nginx kullanıyorsan Node'un 8787 portunu dışarı açma (yalnızca 127.0.0.1'den erişilsin).

### Cloudflare arkasında
Alan adını Cloudflare'a (turuncu bulut / proxied) bağladıysan: WebSocket 80/443'ten çalışır (8787'yi doğrudan açmana gerek yok).
Sertifikayı `sudo certbot --nginx -d alan.com -d www.alan.com --no-redirect` ile al (HTTP-01 proxy arkasında da çalışır; `--no-redirect` HTTPS yönlendirmesini Cloudflare'a bırakır).
Cloudflare SSL/TLS modu **Full** olmalı. Tarayıcıda **521 Web server is down** görürsen: sunucuda 443 dinlenmiyor (sertifika/nginx), ya da Node servisi kapalı (`systemctl status warbyte`).

## 5. Ortam değişkenleri

| Değişken | Varsayılan | Anlam |
|---|---|---|
| `PORT` | 8787 | Dinlenen port |
| `MAX_ROOMS` | 20 | Aynı anda açık oda sınırı (sunucuyu korur) |
| `BF_RESTART_MS` | 15000 | Maç bitince sonuç ekranı süresi, sonra oda yeni maça hazırlanır |
| `BF_DEBUG` | kapalı | **Yalnızca test için** ışınlanma/eşya/bilet komutlarını açar. **VPS'te kullanma.** |

## 6. Resmi sunucular ve oda listesi

Sunucu açılışında `server/official.js` içindeki **3 resmi oda** otomatik kurulur (10v10 Ele Geçirme, 16v16 Büyük Savaş, 8v8 Takım Çatışması;
hepsi botlu, haritalar sırayla döner). Oyuncu girince bir bot azalır; boşken CPU harcamaz. Menüdeki oda listesi `GET /rooms` ile gelir:
`curl http://SUNUCU/rooms`. Resmi odaları değiştirmek için `server/official.js` dosyasını düzenle (ad, mod, boyut, harita listesi).

## 7. Beta testi için kontrol listesi

- [ ] `curl https://oyun.ornek.com/health` çalışıyor
- [ ] İki farklı bilgisayar / ağdan oda kur + koda katıl
- [ ] Ping rozeti (sol üst, minimap altı) makul (<100 ms aynı bölgede)
- [ ] Resmi sunucu listede görünüyor, katılınca bot sayısı azalıyor
- [ ] Şifreli / gizli / botsuz oda kur, başka bilgisayardan listeden katıl
- [ ] Oyunda `M` ile takım değiştir
- [ ] Ateş, öldürme, doğma, bayrak, gadget'lar
- [ ] Maç bitince 15 sn sonra odanın yenilendiği
- [ ] `pm2 logs warbyte` içinde hata yok

Bilinen sınırlar: hesap/giriş yok (takma ad), odalar yeniden başlatmada silinir, hile önlemleri temel düzeyde
(sunucu otoriter ateş/hasar/hareket kontrolü var; hız/konum doğrulaması ek sertleştirme ister).
