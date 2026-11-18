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
  'android.permission.REQUEST_INSTALL_PACKAGES', // نصب آپدیت داخل خود اپ
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
// امنیت: جلوگیری از گرفتن بکاپ داده‌های اپ (مثلاً با adb backup)
if (/android:allowBackup="true"/.test(xml)) xml = xml.replace(/android:allowBackup="true"/, 'android:allowBackup="false"');
else if (!/android:allowBackup=/.test(xml)) xml = xml.replace('<application', '<application android:allowBackup="false"');

if (!xml.includes('UpdateFileProvider')) {
  xml = xml.replace('</application>', '        <provider android:name=".UpdateFileProvider" android:authorities="com.nazholux.app.updateprovider" android:exported="false" android:grantUriPermissions="true">\n            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/nazholux_update_paths" />\n        </provider>\n    </application>');
}
fs.writeFileSync(manifestPath, xml);

const xmlDir = 'android/app/src/main/res/xml';
fs.mkdirSync(xmlDir, { recursive: true });
fs.writeFileSync(path.join(xmlDir, 'nazholux_update_paths.xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n<paths>\n    <external-files-path name="updates" path="." />\n</paths>\n');

const drawableDir = 'android/app/src/main/res/drawable';
fs.mkdirSync(drawableDir, { recursive: true });
fs.copyFileSync('resources/android/ic_stat_nazholux.png', path.join(drawableDir, 'ic_stat_nazholux.png'));
console.log('Android project patched ✔');

// MainActivity: درخواست مجوزها همان اول اجرا + چک نسخه‌ی جدید و نصب آپدیت داخل اپ
const javaDir = 'android/app/src/main/java/com/nazholux/app';
fs.mkdirSync(javaDir, { recursive: true });
fs.writeFileSync(path.join(javaDir, 'UpdateFileProvider.java'), `package com.nazholux.app;

import androidx.core.content.FileProvider;

public class UpdateFileProvider extends FileProvider {}
`);

fs.writeFileSync(path.join(javaDir, 'MainActivity.java'), `package com.nazholux.app;

import android.Manifest;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final int REQ_PERMISSIONS = 7001;
    // آخرین Release گیت‌هاب (ریپو باید Public باشد)
    private static final String RELEASES_URL = "https://api.github.com/repos/nazholux-dev/app/releases/latest";

    private boolean inFlight = false;
    private boolean askedOnce = false;
    private boolean settingsLaunched = false;

    private boolean updateChecked = false;
    private String pendingUpdateUrl = null;
    private long downloadId = -1;
    private BroadcastReceiver downloadReceiver = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        askForMissing();
    }

    @Override
    public void onResume() {
        super.onResume();
        resumePendingUpdate();
        ensureRequired();
    }

    @Override
    public void onPause() {
        super.onPause();
        if (settingsLaunched) {
            settingsLaunched = false;
            inFlight = false;
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (downloadReceiver != null) {
            try { unregisterReceiver(downloadReceiver); } catch (Exception ignored) {}
            downloadReceiver = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_PERMISSIONS) {
            inFlight = false;
            ensureRequired();
        }
    }

    // ---------------- مجوزها ----------------

    private boolean granted(String p) {
        return ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED;
    }

    private List<String> allPermissions() {
        List<String> l = new ArrayList<>();
        l.add(Manifest.permission.ACCESS_FINE_LOCATION);
        l.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        l.add(Manifest.permission.RECORD_AUDIO);
        l.add(Manifest.permission.CAMERA);
        if (Build.VERSION.SDK_INT >= 33) l.add(Manifest.permission.POST_NOTIFICATIONS);
        return l;
    }

    private List<String> missingRequired() {
        List<String> m = new ArrayList<>();
        if (!granted(Manifest.permission.ACCESS_FINE_LOCATION) && !granted(Manifest.permission.ACCESS_COARSE_LOCATION)) {
            m.add(Manifest.permission.ACCESS_FINE_LOCATION);
            m.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (!granted(Manifest.permission.RECORD_AUDIO)) m.add(Manifest.permission.RECORD_AUDIO);
        if (Build.VERSION.SDK_INT >= 33 && !granted(Manifest.permission.POST_NOTIFICATIONS)) {
            m.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        return m;
    }

    private void askForMissing() {
        List<String> need = new ArrayList<>();
        for (String p : allPermissions()) {
            if (!granted(p)) need.add(p);
        }
        if (need.isEmpty()) return;
        inFlight = true;
        askedOnce = true;
        ActivityCompat.requestPermissions(this, need.toArray(new String[0]), REQ_PERMISSIONS);
    }

    private void ensureRequired() {
        if (inFlight) return;
        List<String> missing = missingRequired();
        if (missing.isEmpty()) {
            checkForUpdate();
            return;
        }
        boolean blocked = false;
        if (askedOnce) {
            for (String p : missing) {
                if (!ActivityCompat.shouldShowRequestPermissionRationale(this, p)) blocked = true;
            }
        }
        if (blocked) {
            inFlight = true;
            settingsLaunched = true;
            Toast.makeText(this, "برای ادامه، مجوزها را در تنظیمات فعال کنید", Toast.LENGTH_LONG).show();
            startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
        } else {
            askForMissing();
        }
    }

    // ---------------- آپدیت ----------------

    private void checkForUpdate() {
        if (updateChecked) return;
        updateChecked = true;
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(RELEASES_URL).openConnection();
                c.setRequestProperty("Accept", "application/vnd.github+json");
                c.setRequestProperty("User-Agent", "nazholux-android");
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                if (c.getResponseCode() != 200) return;
                BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
                r.close();
                JSONObject j = new JSONObject(sb.toString());
                String tag = j.optString("tag_name", "");
                final String remoteName = tag.startsWith("v") ? tag.substring(1) : tag;
                String localName = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
                if (remoteName.isEmpty() || !isNewer(remoteName, localName)) return;

                String apkUrl = "";
                JSONArray assets = j.optJSONArray("assets");
                if (assets != null) {
                    for (int i = 0; i < assets.length(); i++) {
                        JSONObject a = assets.getJSONObject(i);
                        if (a.optString("name", "").endsWith(".apk")) {
                            apkUrl = a.optString("browser_download_url", "");
                            break;
                        }
                    }
                }
                if (apkUrl.isEmpty()) return;
                final String url = apkUrl;
                runOnUiThread(() -> showUpdateDialog(remoteName, url));
            } catch (Exception ignored) {
                // بدون اینترنت یا خطا: بی‌صدا رد می‌شویم
            }
        }).start();
    }

    private boolean isNewer(String remote, String local) {
        if (local == null) return true;
        String[] r = remote.split("[.]");
        String[] l = local.split("[.]");
        for (int i = 0; i < Math.max(r.length, l.length); i++) {
            int a = i < r.length ? num(r[i]) : 0;
            int b = i < l.length ? num(l[i]) : 0;
            if (a != b) return a > b;
        }
        return false;
    }

    private int num(String s) {
        try { return Integer.parseInt(s.replaceAll("[^0-9]", "")); } catch (Exception e) { return 0; }
    }

    private void showUpdateDialog(String name, String url) {
        if (isFinishing()) return;
        new AlertDialog.Builder(this)
            .setTitle("نسخه جدید " + name)
            .setMessage("نسخه جدید ناژولوکس آماده است. می‌خواهید الان به‌روزرسانی شود؟")
            .setPositiveButton("به‌روزرسانی", (d, w) -> startUpdate(url))
            .setNegativeButton("بعداً", null)
            .show();
    }

    private void startUpdate(String url) {
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            pendingUpdateUrl = url;
            Toast.makeText(this, "اجازه‌ی نصب برنامه را برای ناژولوکس فعال کنید و برگردید", Toast.LENGTH_LONG).show();
            startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
            return;
        }
        downloadApk(url);
    }

    private void resumePendingUpdate() {
        if (pendingUpdateUrl == null) return;
        String url = pendingUpdateUrl;
        pendingUpdateUrl = null;
        if (Build.VERSION.SDK_INT < 26 || getPackageManager().canRequestPackageInstalls()) downloadApk(url);
    }

    private void downloadApk(String url) {
        try {
            File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            final File apk = new File(dir, "nazholux-update.apk");
            if (apk.exists()) apk.delete();

            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setTitle("به‌روزرسانی ناژولوکس");
            req.setMimeType("application/vnd.android.package-archive");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationUri(Uri.fromFile(apk));

            final DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            downloadId = dm.enqueue(req);

            if (downloadReceiver != null) {
                try { unregisterReceiver(downloadReceiver); } catch (Exception ignored) {}
            }
            downloadReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context ctx, Intent intent) {
                    long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (id != downloadId) return;
                    boolean ok = false;
                    Cursor cur = dm.query(new DownloadManager.Query().setFilterById(id));
                    if (cur != null) {
                        if (cur.moveToFirst()) {
                            ok = cur.getInt(cur.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) == DownloadManager.STATUS_SUCCESSFUL;
                        }
                        cur.close();
                    }
                    try { unregisterReceiver(this); } catch (Exception ignored) {}
                    downloadReceiver = null;
                    if (ok) installApk(apk);
                    else Toast.makeText(MainActivity.this, "دانلود آپدیت ناموفق بود", Toast.LENGTH_LONG).show();
                }
            };
            IntentFilter f = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(downloadReceiver, f, Context.RECEIVER_EXPORTED);
            else registerReceiver(downloadReceiver, f);

            Toast.makeText(this, "دانلود آپدیت شروع شد…", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "شروع دانلود ممکن نشد", Toast.LENGTH_LONG).show();
        }
    }

    private void installApk(File apk) {
        try {
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".updateprovider", apk);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            Toast.makeText(this, "نصب آپدیت ممکن نشد", Toast.LENGTH_LONG).show();
        }
    }
}
`);
console.log('MainActivity + UpdateFileProvider patched ✔');
