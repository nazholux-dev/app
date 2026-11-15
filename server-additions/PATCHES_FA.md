# تغییرات لازم روی سرور (۵ تکه، همه کوچک)

## ۱) دیتابیس
`database_device_tokens.sql` را روی دیتابیس اجرا کن.

## ۲) فایل جدید
`api/services/FcmService.php` را کنار بقیه‌ی services کپی کن.
فایل Service Account فایربیس را هم اینجا بگذار (خارج از دسترس وب):
`api/config/fcm-service-account.json`

## ۳) `api/services/PushService.php`
داخل `sendToUser(...)`، **اولین خط** تابع (قبل از `if (!self::isConfigured())`) این را اضافه کن
تا هم FCM (اندروید) و هم Web Push (مرورگر) کار کنند:

```php
require_once __DIR__ . '/FcmService.php';
$fcm = FcmService::sendToUser($userId, $title, $body, $link, $notificationId);
```
و در همان تابع، `return` اولی را اینطور تغییر بده:
```php
if (!self::isConfigured()) return ['sent' => $fcm['sent'], 'failed' => $fcm['failed'], 'skipped' => $fcm['skipped']];
```

## ۴) `api/controllers/NotificationController.php` — سه متد جدید
```php
public function registerDevice($user, $request) {
    if (!$user) return Response::unauthorized();
    $token = trim($request['token'] ?? '');
    if (!$token || strlen($token) > 512) return Response::error('Invalid token', 422);
    $pdo = Database::getInstance()->getConnection();
    $stmt = $pdo->prepare('INSERT INTO device_tokens (user_id, token, platform) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform), updated_at = NOW()');
    $stmt->execute([(int)$user['id'], $token, substr($request['platform'] ?? 'android', 0, 20)]);
    return Response::success(['registered' => true]);
}

public function unregisterDevice($user, $request) {
    if (!$user) return Response::unauthorized();
    $token = trim($request['token'] ?? '');
    if (!$token) return Response::error('Token required', 422);
    $pdo = Database::getInstance()->getConnection();
    $pdo->prepare('DELETE FROM device_tokens WHERE user_id = ? AND token = ?')->execute([(int)$user['id'], $token]);
    return Response::success(['unregistered' => true]);
}
```
و در `api/index.php` داخل `case 'notifications':` کنار `case 'unsubscribe':` این دو case را اضافه کن:
```php
case 'register-device':
    echo $notificationController->registerDevice($user, $request);
    break;
case 'unregister-device':
    echo $notificationController->unregisterDevice($user, $request);
    break;
```

## ۵) سمت وب (۳ خط)
- فایل `public/js/native-bridge.js` را کپی کن.
- در `index.html` بعد از `notifications.js` اضافه کن:
  `<script src="public/js/native-bridge.js"></script>`
- در `app.js` داخل `showApp()` (اول تابع) بنویس: `if (window.NativeBridge) { NativeBridge.init(); NativeBridge.bindLocalTap(); }`
- در `Auth.logout()` قبل از پاک کردن localStorage بنویس: `if (window.NativeBridge) await NativeBridge.teardown();`
