import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nazholux.app',
  appName: 'ناژولوکس',
  webDir: 'www', // فقط صفحه‌ی آفلاین؛ محتوای اصلی از سرور لود می‌شود

  server: {
    // قلب این روش: اپ، سایت زنده را باز می‌کند → آپدیت وب = آپدیت اپ
    url: 'https://app.nazholux.com/index.html',
    cleartext: false,
    allowNavigation: ['app.nazholux.com', 'dl.nazholux.com'],
    errorPath: 'index.html' // اگر اینترنت نبود، صفحه‌ی آفلاین www/index.html
  },

  android: {
    allowMixedContent: false,
    backgroundColor: '#171512',
    webContentsDebuggingEnabled: false // برای تست true کن
  },

  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: '#171512', showSpinner: false },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
    LocalNotifications: { smallIcon: 'ic_stat_nazholux', iconColor: '#C9A24B' }
  }
};

export default config;
