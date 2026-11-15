/**
 * NativeBridge — فقط داخل اپ اندروید (Capacitor) فعال می‌شود.
 * در مرورگر معمولی هیچ کاری نمی‌کند، پس وب مثل قبل کار می‌کند.
 *
 * وظایف:
 *  1) گرفتن اجازه‌ی نوتیفیکیشن + ساخت کانال با صدای پیش‌فرض
 *  2) ثبت توکن FCM روی سرور (notifications/register-device)
 *  3) باز کردن صفحه‌ی درست با تپ روی نوتیفیکیشن
 *  4) نوتیفیکیشن محلی زمان‌بندی‌شده (یادآوری) برای کارهای ساعت‌دار
 */
class NativeBridge {
    static CHANNEL_ID = 'nazholux_default';
    static TOKEN_KEY = 'nazholux_fcm_token';

    static get cap() { return window.Capacitor; }
    static get isNative() { return !!(this.cap && this.cap.isNativePlatform && this.cap.isNativePlatform()); }
    static plugin(name) { return this.cap && this.cap.Plugins ? this.cap.Plugins[name] : null; }

    static async init() {
        if (!this.isNative || this._started) return;
        const Push = this.plugin('PushNotifications');
        if (!Push) { console.warn('PushNotifications plugin not available'); return; }
        this._started = true;

        try {
            let perm = await Push.checkPermissions();
            if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await Push.requestPermissions();
            if (perm.receive !== 'granted') { console.warn('Notification permission denied'); return; }

            await Push.createChannel({
                id: this.CHANNEL_ID, name: 'اعلان‌های ناژولوکس', description: 'پیام‌ها، وظایف و یادآورها',
                importance: 5, visibility: 1, vibration: true, sound: 'default'
            });

            await Push.addListener('registration', async (t) => {
                try {
                    localStorage.setItem(this.TOKEN_KEY, t.value);
                    await Api.post('notifications/register-device', { token: t.value, platform: 'android' });
                } catch (e) { console.warn('register-device failed', e); }
            });
            await Push.addListener('registrationError', (e) => console.warn('FCM registration error', e));

            // اپ باز است: فقط بج/لیست اعلان‌ها را تازه کن (خود سیستم اعلان را نشان می‌دهد)
            await Push.addListener('pushNotificationReceived', () => {
                if (window.Notifications) Notifications.refreshBadge();
            });

            // تپ روی نوتیفیکیشن
            await Push.addListener('pushNotificationActionPerformed', (a) => {
                const link = a && a.notification && a.notification.data ? a.notification.data.link : null;
                if (link && window.app) window.app.followNotificationLink(link);
            });

            await Push.register();
        } catch (e) { console.warn('NativeBridge init failed', e); }
    }

    /** موقع خروج صدا بزن تا اعلان‌های این کاربر روی این گوشی نیاید */
    static async teardown() {
        if (!this.isNative) return;
        const token = localStorage.getItem(this.TOKEN_KEY);
        try { if (token) await Api.post('notifications/unregister-device', { token }); } catch (e) {}
        localStorage.removeItem(this.TOKEN_KEY);
        this._started = false;
    }

    /**
     * یادآور محلی (بدون نیاز به اینترنت/سرور). مثال:
     * NativeBridge.scheduleReminder({ id: 1001, title: 'جلسه', body: 'ساعت ۱۰', at: new Date(Date.now()+600000) })
     * تکرار: every: 'day' | 'week' | 'hour' ...
     */
    static async scheduleReminder({ id, title, body = '', at, every = null, link = 'dashboard' }) {
        const LN = this.plugin('LocalNotifications');
        if (!this.isNative || !LN) return false;
        const p = await LN.requestPermissions();
        if (p.display !== 'granted') return false;
        const schedule = { at: new Date(at), allowWhileIdle: true };
        if (every) schedule.every = every;
        await LN.schedule({ notifications: [{
            id, title, body, schedule, channelId: this.CHANNEL_ID,
            smallIcon: 'ic_stat_nazholux', extra: { link }
        }]});
        return true;
    }

    static async cancelReminder(id) {
        const LN = this.plugin('LocalNotifications');
        if (this.isNative && LN) await LN.cancel({ notifications: [{ id }] });
    }

    static bindLocalTap() {
        const LN = this.plugin('LocalNotifications');
        if (!this.isNative || !LN) return;
        LN.addListener('localNotificationActionPerformed', (a) => {
            const link = a && a.notification && a.notification.extra ? a.notification.extra.link : null;
            if (link && window.app) window.app.followNotificationLink(link);
        });
    }
}
window.NativeBridge = NativeBridge;
