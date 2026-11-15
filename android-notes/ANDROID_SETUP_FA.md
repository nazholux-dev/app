# یادداشت‌های اندروید

مجوزها، متادیتای FCM و آیکن اعلان **خودکار** با `scripts/patch-android.mjs` اضافه می‌شوند (هم لوکال و هم در GitHub Actions)؛ دستی کاری لازم نیست.

## فقط این‌ها دستی است
- `google-services.json` از Firebase ← `android/app/` (یا Secret به نام `GOOGLE_SERVICES_JSON` در GitHub)
- `fcm-service-account.json` ← روی سرور در `api/config/`
- keystore برای نسخه‌ی release

## باتری
Battery ← Unrestricted و Autostart برای اپ، مخصوصاً شیائومی/سامسونگ.

## آیکن
آیکن اپ از `assets/icon-only.png` ساخته می‌شود (از آیکن ۵۱۲ سایت بزرگ شده). برای کیفیت بهتر، نسخه‌ی ۱۰۲۴×۱۰۲۴ اصلی را جایگزین کن.
