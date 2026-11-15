#!/usr/bin/env bash
# روی کامپیوتر خودت اجرا کن (Node 18+ و Android Studio لازم است)
set -e
npm install
[ -d android ] || npx cap add android
node scripts/patch-android.mjs
npm run assets || echo "(ساخت آیکن‌ها ناموفق بود؛ می‌توانی بعداً دستی بزنی)"
npx cap sync android
echo
echo "حالا:"
echo " 1) google-services.json را در android/app/ بگذار (از Firebase Console)"
echo " 2) npx cap open android  ←  Build > Build APK"
