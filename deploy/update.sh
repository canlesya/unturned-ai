#!/bin/bash
# /opt/warbyte/update.sh — WarByte güncelleme: GitHub'daki son sürümü çekip derler ve servisi yeniden başlatır (açık odalar kapanır).
set -e
BR="${1:-online}"
cd /opt/warbyte/app
sudo -u warbyte git fetch -q origin "$BR"
sudo -u warbyte git checkout -q "$BR"
sudo -u warbyte git pull -q --ff-only origin "$BR"
sudo -u warbyte env HOME=/opt/warbyte PATH=/opt/warbyte/node/bin:$PATH npm ci --no-audit --no-fund 2>&1 | tail -1
sudo -u warbyte env HOME=/opt/warbyte PATH=/opt/warbyte/node/bin:$PATH npm run build 2>&1 | tail -1
systemctl restart warbyte
sleep 4
systemctl is-active warbyte
curl -s http://127.0.0.1:8787/health; echo
sudo -u warbyte git log --oneline | head -1
