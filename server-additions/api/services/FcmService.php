<?php
/**
 * FCM HTTP v1 sender — بدون وابستگی composer (فقط curl + openssl).
 * فایل Service Account را از Firebase Console دانلود کن و اینجا بگذار:
 *   api/config/fcm-service-account.json   (حتماً غیرقابل‌دسترس از وب؛ پوشه‌ی config .htaccess دارد)
 */
class FcmService {
    private static function saPath() { return __DIR__ . '/../config/fcm-service-account.json'; }

    public static function isConfigured() { return is_file(self::saPath()); }

    private static function b64url($d) { return rtrim(strtr(base64_encode($d), '+/', '-_'), '='); }

    private static function accessToken() {
        $cache = sys_get_temp_dir() . '/nazholux_fcm_token.json';
        if (is_file($cache)) {
            $c = json_decode(file_get_contents($cache), true);
            if (!empty($c['token']) && ($c['exp'] ?? 0) > time() + 60) return $c['token'];
        }
        $sa = json_decode(file_get_contents(self::saPath()), true);
        $now = time();
        $header = self::b64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $claim = self::b64url(json_encode([
            'iss' => $sa['client_email'],
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now, 'exp' => $now + 3600,
        ]));
        openssl_sign("$header.$claim", $sig, $sa['private_key'], OPENSSL_ALGO_SHA256);
        $jwt = "$header.$claim." . self::b64url($sig);

        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt_array($ch, [
            CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
            CURLOPT_POSTFIELDS => http_build_query(['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $jwt]),
        ]);
        $res = json_decode(curl_exec($ch), true);
        curl_close($ch);
        if (empty($res['access_token'])) throw new Exception('FCM auth failed');
        @file_put_contents($cache, json_encode(['token' => $res['access_token'], 'exp' => $now + (int)($res['expires_in'] ?? 3500)]));
        return $res['access_token'];
    }

    public static function sendToUser($userId, $title, $body = '', $link = null, $notificationId = null) {
        try {
            return self::doSend($userId, $title, $body, $link, $notificationId);
        } catch (Throwable $e) {
            // خطای FCM نباید ساخت اعلان یا Web Push را خراب کند
            Logger::error('FCM exception', ['user_id' => $userId, 'error' => $e->getMessage()]);
            return ['sent' => 0, 'failed' => 1, 'skipped' => false];
        }
    }

    private static function doSend($userId, $title, $body, $link, $notificationId) {
        if (!self::isConfigured()) return ['sent' => 0, 'failed' => 0, 'skipped' => true];

        $pdo = Database::getInstance()->getConnection();
        $stmt = $pdo->prepare('SELECT id, token FROM device_tokens WHERE user_id = ?');
        $stmt->execute([(int)$userId]);
        $rows = $stmt->fetchAll();
        if (!$rows) return ['sent' => 0, 'failed' => 0, 'skipped' => false];

        $sa = json_decode(file_get_contents(self::saPath()), true);
        $url = 'https://fcm.googleapis.com/v1/projects/' . $sa['project_id'] . '/messages:send';
        $access = self::accessToken();
        $sent = 0; $failed = 0;

        foreach ($rows as $row) {
            $payload = ['message' => [
                'token' => $row['token'],
                'notification' => ['title' => (string)$title, 'body' => (string)($body ?: '')],
                'data' => ['link' => (string)($link ?: 'dashboard'), 'notificationId' => (string)($notificationId ?: '')],
                'android' => [
                    'priority' => 'HIGH',
                    'ttl' => '86400s',
                    'notification' => ['channel_id' => 'nazholux_default', 'sound' => 'default'],
                ],
            ]];
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
                CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $access, 'Content-Type: application/json'],
                CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            ]);
            $res = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($code === 200) { $sent++; continue; }
            $failed++;
            // توکن باطل‌شده (حذف اپ / ...) را پاک کن
            if ($code === 404 || strpos((string)$res, 'UNREGISTERED') !== false) {
                $pdo->prepare('DELETE FROM device_tokens WHERE id = ?')->execute([(int)$row['id']]);
            }
            Logger::warning('FCM delivery failed', ['code' => $code, 'res' => substr((string)$res, 0, 300)]);
        }
        return ['sent' => $sent, 'failed' => $failed, 'skipped' => false];
    }
}
