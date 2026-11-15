// بعد از `npx cap add android` اجرا می‌شود: مجوزها، متادیتای FCM و آیکن اعلان را اضافه می‌کند.
// چند بار اجرا شود مشکلی ندارد (idempotent).
import fs from 'node:fs';
import path from 'node:path';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
if (!fs.existsSync(manifestPath)) { console.error('android/ پیدا نشد؛ اول `npx cap add android` را بزن.'); process.exit(1); }

let xml = fs.readFileSync(manifestPath, 'utf8');
const perms = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.VIBRATE',
];
for (const p of perms) {
  if (!xml.includes(`android:name="${p}"`)) {
    xml = xml.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
  }
}
const metas = [
  ['com.google.firebase.messaging.default_notification_icon', 'android:resource="@drawable/ic_stat_nazholux"'],
  ['com.google.firebase.messaging.default_notification_channel_id', 'android:value="nazholux_default"'],
];
for (const [name, attr] of metas) {
  if (!xml.includes(name)) {
    xml = xml.replace('</application>', `        <meta-data android:name="${name}" ${attr} />\n    </application>`);
  }
}
fs.writeFileSync(manifestPath, xml);

const drawableDir = 'android/app/src/main/res/drawable';
fs.mkdirSync(drawableDir, { recursive: true });
fs.copyFileSync('resources/android/ic_stat_nazholux.png', path.join(drawableDir, 'ic_stat_nazholux.png'));
console.log('Android project patched ✔');
