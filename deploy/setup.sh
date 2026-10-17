#!/bin/bash
# WarByte sunucu kurulumu (temiz Ubuntu 22.04/24.04, root):  bash setup.sh warbyte.io [eposta]
# Kurar: nginx + certbot, warbyte kullanıcısı, resmi Node 22 (/opt/warbyte/node, SHA256 doğrulamalı), uygulama (/opt/warbyte/app, dal online),
# systemd servisi, /opt/warbyte/update.sh, nginx (oyun: DOMAIN + www, admin: admin.DOMAIN), Let's Encrypt sertifikaları.
# Önkoşul: Cloudflare'de DOMAIN, www, admin A kayıtları bu sunucuya (proxied olabilir; SSL modu Full) + ws A kaydı DNS ONLY (gri bulut).
set -euo pipefail
DOMAIN="${1:?alan adı gerekli: bash setup.sh warbyte.io}"
EMAIL="${2:-}"
REPO=https://github.com/canlesya/unturned-ai
HERE="$(cd "$(dirname "$0")" && pwd)"

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q nginx certbot python3-certbot-nginx curl git ca-certificates xz-utils

id warbyte >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/warbyte --shell /usr/sbin/nologin warbyte
mkdir -p /opt/warbyte && chown warbyte:warbyte /opt/warbyte

# Node 22 (resmi ikili, SHA256SUMS ile doğrulanır)
if [ ! -x /opt/warbyte/node/bin/node ]; then
  BASE=https://nodejs.org/dist/latest-v22.x
  TMP=$(mktemp -d)
  curl -fsSL "$BASE/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
  FILE=$(grep -o 'node-v22[0-9.]*-linux-x64.tar.xz' "$TMP/SHASUMS256.txt" | head -1)
  curl -fsSL "$BASE/$FILE" -o "$TMP/$FILE"
  (cd "$TMP" && grep " $FILE\$" SHASUMS256.txt | sha256sum -c -)
  mkdir -p /opt/warbyte/node && tar -xJf "$TMP/$FILE" -C /opt/warbyte/node --strip-components=1
  chown -R warbyte:warbyte /opt/warbyte/node && rm -rf "$TMP"
fi
/opt/warbyte/node/bin/node -v

# uygulama
[ -d /opt/warbyte/app/.git ] || sudo -u warbyte git clone -q -b online "$REPO" /opt/warbyte/app
install -m 755 "$HERE/update.sh" /opt/warbyte/update.sh
install -m 644 "$HERE/warbyte.service" /etc/systemd/system/warbyte.service
systemctl daemon-reload
systemctl enable -q warbyte
/opt/warbyte/update.sh online

# nginx
sed "s/warbyte\.io/$DOMAIN/g" "$HERE/nginx-warbyte.conf" > /etc/nginx/sites-available/warbyte
sed "s/warbyte\.io/$DOMAIN/g" "$HERE/nginx-warbyte-admin.conf" > /etc/nginx/sites-available/warbyte-admin
sed "s/warbyte\.io/$DOMAIN/g" "$HERE/nginx-warbyte-ws.conf" > /etc/nginx/sites-available/warbyte-ws
ln -sf /etc/nginx/sites-available/warbyte /etc/nginx/sites-enabled/warbyte
ln -sf /etc/nginx/sites-available/warbyte-admin /etc/nginx/sites-enabled/warbyte-admin
ln -sf /etc/nginx/sites-available/warbyte-ws /etc/nginx/sites-enabled/warbyte-ws
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# sertifikalar (HTTP-01 Cloudflare proxy arkasında da çalışır)
M=(--register-unsafely-without-email); [ -n "$EMAIL" ] && M=(-m "$EMAIL")
certbot --nginx --non-interactive --agree-tos "${M[@]}" -d "$DOMAIN" -d "www.$DOMAIN" --no-redirect
certbot --nginx --non-interactive --agree-tos "${M[@]}" -d "admin.$DOMAIN" --redirect
certbot --nginx --non-interactive --agree-tos "${M[@]}" -d "ws.$DOMAIN" --redirect       # oyun bağlantısı (Cloudflare'siz: DNS only)
nginx -t && systemctl reload nginx

# güvenlik duvarı: yalnız SSH / 80 / 443 (8787 ve admin 8788 dışarı kapalı, nginx üzerinden)
ufw allow OpenSSH >/dev/null && ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null && ufw --force enable
echo "--- hazır ---"
curl -s http://127.0.0.1:8787/health; echo
echo "admin ilk şifresi: /opt/warbyte/app/data/admin-password.txt"
