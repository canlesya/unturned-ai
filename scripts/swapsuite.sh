#!/bin/sh
# 12.210 silah değiştirme ölçüm takımı (sırayla; GPU paylaşılmasın): scripts/swapsuite.sh <çıktı klasörü> [taban url]
#   Çöl Geçidi masaüstü (+ CPU 4× yavaş), Pixel 7 yatay (touch=1); Kuzey Vadisi 64v64 masaüstü + Pixel 7
O=$1; B=${2:-http://127.0.0.1:5297}; mkdir -p "$O"
node scripts/swapperf.mjs "$O/cg-desk.json" "$B" > "$O/cg-desk.log" 2>&1
CPU=4 node scripts/swapperf.mjs "$O/cg-desk-cpu4.json" "$B" > "$O/cg-desk-cpu4.log" 2>&1
DEV=mob node scripts/swapperf.mjs "$O/cg-mob.json" "$B" > "$O/cg-mob.log" 2>&1
MAP=kuzey SIZE=64v64 node scripts/swapperf.mjs "$O/kz64-desk.json" "$B" > "$O/kz64-desk.log" 2>&1
MAP=kuzey SIZE=64v64 DEV=mob node scripts/swapperf.mjs "$O/kz64-mob.json" "$B" > "$O/kz64-mob.log" 2>&1
echo bitti > "$O/DONE"
