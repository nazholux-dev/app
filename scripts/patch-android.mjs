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
  'android.permission.ACCESS_FINE_LOCATION',   // حضور و غیاب + ارسال لوکیشن در چت
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.RECORD_AUDIO',           // ویس چت
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.CAMERA',                 // عکس/ویدیو در چت
];
// دستگاه‌هایی که سخت‌افزار ندارند هم بتوانند اپ را نصب کنند
const features = [
  'android.hardware.location', 'android.hardware.location.gps',
  'android.hardware.microphone', 'android.hardware.camera', 'android.hardware.camera.autofocus',
];
for (const f of features) {
  if (!xml.includes(`android:name="${f}"`)) {
    xml = xml.replace('</manifest>', `    <uses-feature android:name="${f}" android:required="false" />\n</manifest>`);
  }
}
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

// درخواست مجوزها همان اول اجرای اپ (بدون نیاز به رفتن به تنظیمات)
const javaDir = 'android/app/src/main/java/com/nazholux/app';
const activityPath = path.join(javaDir, 'MainActivity.java');
fs.mkdirSync(javaDir, { recursive: true });
fs.writeFileSync(activityPath, `package com.nazholux.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int REQ_STARTUP_PERMISSIONS = 7001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestStartupPermissions();
    }

    private void requestStartupPermissions() {
        List<String> perms = new ArrayList<>();
        perms.add(Manifest.permission.ACCESS_FINE_LOCATION);
        perms.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        perms.add(Manifest.permission.RECORD_AUDIO);
        perms.add(Manifest.permission.CAMERA);
        if (Build.VERSION.SDK_INT >= 33) perms.add(Manifest.permission.POST_NOTIFICATIONS);

        List<String> needed = new ArrayList<>();
        for (String p : perms) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) needed.add(p);
        }
        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), REQ_STARTUP_PERMISSIONS);
        }
    }
}
`);
console.log('MainActivity patched ✔');
