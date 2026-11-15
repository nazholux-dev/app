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
    // اسپلش نیتیو تا اولین نقاشی لودر وب می‌ماند (index.html خودش آن را می‌بندد)؛
    // launchShowDuration فقط سقف اطمینان است اگر سایت دیر لود شد.
    SplashScreen: {
      launchShowDuration: 6000,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#171512',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false
    },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
    LocalNotifications: { smallIcon: 'ic_stat_nazholux', iconColor: '#C9A24B' }
  }
};

export default config;
