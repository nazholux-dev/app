# Nazholux Android (Capacitor shell)

اپ اندروید ناژولوکس: یک قاب نیتیو سبک که `https://app.nazholux.com` را باز می‌کند.
آپدیت وب = آپدیت اپ، و نوتیفیکیشن/یادآور نیتیو اندروید (FCM + Local Notifications).

> این ریپو **فقط پوسته‌ی اندروید** است. کد وب‌اپ و رازها (کلید FCM، keystore، `google-services.json`) داخلش نیست و `.gitignore` جلوی commit شدنشان را می‌گیرد.

## ساختار
| مسیر | کار |
|---|---|
| `capacitor.config.ts` | آدرس سایت، appId، تنظیم پلاگین‌ها |
| `www/index.html` | صفحه‌ی آفلاین |
| `web-additions/public/js/native-bridge.js` | پل وب ↔ نیتیو؛ به وب‌اپ اضافه می‌شود |
| `server-additions/` | FCM سمت PHP + SQL + راهنما (`PATCHES_FA.md`) |
| `scripts/patch-android.mjs` | مجوزها، متادیتای FCM و آیکن اعلان را خودکار اضافه می‌کند |
| `assets/icon-only.png`, `resources/android/` | آیکن اپ و آیکن اعلان |
| `.github/workflows/android.yml` | ساخت APK روی GitHub Actions |

## ۱) سمت سرور و وب (یک‌بار)
مراحل `server-additions/PATCHES_FA.md` را روی سایت اعمال کن.

## ۲) Firebase (یک‌بار)
1. پروژه‌ی Firebase بساز و اپ Android با package name برابر `com.nazholux.app` اضافه کن.
2. `google-services.json` را دانلود کن.
3. در Project settings ← Service accounts یک private key بساز و روی **سرور** بگذار: `api/config/fcm-service-account.json`.

## ۳) ساخت با GitHub Actions (بدون Android Studio)
در GitHub: Settings ← Secrets and variables ← Actions، این Secretها را بساز:

| Secret | مقدار |
|---|---|
| `GOOGLE_SERVICES_JSON` | خروجی `base64 -w0 google-services.json` |
| `KEYSTORE_BASE64` | (اختیاری، برای release) خروجی `base64 -w0 release.keystore` |
| `KEYSTORE_PASSWORD` | (اختیاری) رمز keystore و key (باید یکی باشند) |
| `KEY_ALIAS` | (اختیاری) alias کلید |

- هر push روی `main` یک **debug APK** می‌سازد ← تب Actions ← Artifacts.
- ساخت **release امضاشده**: تگ بزن، مثلاً `git tag v1.0.0 && git push --tags`.
- بدون `GOOGLE_SERVICES_JSON` هم build می‌شود ولی اعلان Push کار نمی‌کند.

keystore بساز (فقط یک‌بار و نگهش دار؛ گم شود، آپدیت اپ ممکن نیست):
```bash
keytool -genkeypair -v -keystore release.keystore -alias nazholux -keyalg RSA -keysize 2048 -validity 10000
```

## ساخت لوکال
```bash
npm run setup        # npm install + cap add + patch + assets + sync
# google-services.json را بگذار در android/app/
npx cap open android # Build > Build APK
```

## تنظیم گوشی (مهم)
روی شیائومی/سامسونگ/... برای اپ: Battery ← Unrestricted و Autostart روشن، وگرنه اعلان گاهی دیر می‌رسد.

## محدودیت‌ها
- آدرس سایت داخل اپ ثابت است؛ تغییر دامنه = build جدید.
- فایل‌آپلود/ویدیوی چت و ورود بیومتریک را روی گوشی واقعی تست کن.
- Google Play ممکن است اپ «فقط WebView» را رد کند؛ برای تیم داخلی APK مستقیم کافی است.
