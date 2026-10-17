# Sunucu kurulum dosyaları (eski VPS'teki çalışan kurulumun kopyası)

| Dosya | Sunucuda yeri |
|---|---|
| `warbyte.service` | `/etc/systemd/system/warbyte.service` (`systemctl enable --now warbyte`) |
| `update.sh` | `/opt/warbyte/update.sh` (deploy: `ssh root@IP '/opt/warbyte/update.sh'`) |
| `nginx-warbyte.conf` | `/etc/nginx/sites-available/warbyte` (+ `sites-enabled` bağlantısı, certbot) |
| `nginx-warbyte-admin.conf` | `/etc/nginx/sites-available/warbyte-admin` (+ bağlantı, certbot) |

Dizinler: uygulama `/opt/warbyte/app` (git, dal `online`, kullanıcı `warbyte`), kendi Node 22'si `/opt/warbyte/node`.
Kalıcı veri `/opt/warbyte/app/data/` (git dışı): `balance.json` + `balance-history.json` (denge), `official.json` (resmi sunucular),
`admin.json` (admin şifre özeti). İlk açılışta admin şifresi üretilir: `data/admin-password.txt` (panelden değişince silinir).
**Bu klasörü yedekle** — panelde yapılan ayarlar yalnız burada.
Genel adım adım kurulum: `../DEPLOY.md`.
