<?php

declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Vary: Origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require dirname(__DIR__) . '/bootstrap.php';

$action = (string) ($_GET['action'] ?? '');
$data = $_SERVER['REQUEST_METHOD'] === 'POST' ? panel_read_json() : $_GET;

function panel_valid_date(string $value): bool
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);

    return $date !== false && $date->format('Y-m-d') === $value;
}

function panel_save_setting(string $key, string $value): void
{
    $statement = panel_db()->prepare(
        'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ' .
        'ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
    );
    $statement->execute(array($key, $value));
}

try {
    if ($action === 'status') {
        $deviceId = strtolower(trim((string) ($data['deviceId'] ?? '')));
        if (!panel_valid_device_id($deviceId)) {
            panel_json(400, array('error' => 'Identificador do dispositivo inválido.'));
        }

        $registration = panel_db()->prepare(
            'INSERT INTO app_device_registrations (device_id, app_version) VALUES (?, ?) ' .
            'ON DUPLICATE KEY UPDATE app_version = VALUES(app_version), last_seen = CURRENT_TIMESTAMP'
        );
        $registration->execute(array(
            $deviceId,
            substr(trim((string) ($data['appVersion'] ?? '')), 0, 32),
        ));

        $statement = panel_db()->prepare(
            'SELECT d.device_id, d.display_name, d.username, d.password_encrypted, d.expires_on, d.enabled, ' .
            'c.configuration_type, c.provider_url, c.playlist_url_encrypted ' .
            'FROM app_devices d LEFT JOIN app_device_configurations c ON c.device_id = d.device_id ' .
            'WHERE d.device_id = ?'
        );
        $statement->execute(array($deviceId));
        $device = $statement->fetch();
        if ($device) {
            $registration = panel_db()->prepare('DELETE FROM app_device_registrations WHERE device_id = ?');
            $registration->execute(array($deviceId));
        }
        $release = panel_latest_release();
        $pixKey = panel_setting('pix_key');
        $whatsapp = panel_setting('whatsapp');
        $common = array(
            'deviceId' => $deviceId,
            'providerUrl' => panel_setting('provider_url'),
            'pixKey' => $pixKey,
            'whatsapp' => $whatsapp,
        );

        if (!$device) {
            panel_json(200, $common + array(
                'status' => 'unregistered',
                'message' => 'Este aparelho ainda não foi cadastrado. Informe o identificador ao administrador.',
                'release' => null,
            ));
        }

        $today = new DateTimeImmutable('today');
        $expiry = new DateTimeImmutable($device['expires_on']);
        $daysRemaining = (int) $today->diff($expiry)->format('%r%a');
        $status = !(bool) $device['enabled'] ? 'blocked' :
            ($device['expires_on'] < $today->format('Y-m-d') ? 'expired' : 'active');
        $response = $common + array(
            'status' => $status,
            'deviceName' => $device['display_name'],
            'expiresOn' => $device['expires_on'],
            'daysRemaining' => $daysRemaining,
            'message' => $status === 'expired' ? 'A assinatura deste aparelho venceu.' :
                ($status === 'blocked' ? 'Este aparelho está bloqueado. Entre em contato com o suporte.' : ''),
            'release' => null,
            'account' => null,
        );

        if ($release) {
            $response['release'] = array(
                'version' => $release['version'],
                'notes' => $release['release_notes'],
                'downloadUrl' => panel_base_url() . 'download.php?deviceId=' . rawurlencode($deviceId),
                'available' => panel_compare_versions(
                    trim((string) ($data['appVersion'] ?? '0.0.0')),
                    (string) $release['version']
                ),
            );
        }

        if ($status === 'active') {
            $configurationType = $device['configuration_type'] ?: 'xtream';
            $response['configurationType'] = $configurationType;
            if ($configurationType === 'm3u') {
                $response['playlistUrl'] = panel_decrypt_password($device['playlist_url_encrypted']);
            } else {
                if (!empty($device['provider_url'])) {
                    $response['providerUrl'] = $device['provider_url'];
                }
                $response['account'] = array(
                    'username' => $device['username'],
                    'password' => panel_decrypt_password($device['password_encrypted']),
                );
            }
        }

        panel_json(200, $response);
    }

    panel_start_admin_session();

    if ($action === 'admin_login') {
        $passwordHash = (string) ($config['admin_password_hash'] ?? '');
        $now = time();
        if (($now - (int) ($_SESSION['login_window_started'] ?? 0)) > 900) {
            $_SESSION['login_attempts'] = 0;
            $_SESSION['login_window_started'] = $now;
        }
        if ((int) ($_SESSION['login_attempts'] ?? 0) >= 5) {
            panel_json(429, array('error' => 'Muitas tentativas. Aguarde 15 minutos e tente novamente.'));
        }
        if ($passwordHash === '' || $passwordHash === 'GENERATE_WITH_PHP_PASSWORD_HASH' ||
                !password_verify((string) ($data['password'] ?? ''), $passwordHash)) {
            $_SESSION['login_attempts'] = (int) ($_SESSION['login_attempts'] ?? 0) + 1;
            panel_json(401, array('error' => 'Senha incorreta ou painel ainda não configurado.'));
        }

        session_regenerate_id(true);
        $_SESSION['admin_authenticated'] = true;
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        $_SESSION['login_attempts'] = 0;
        panel_json(200, array('authenticated' => true, 'csrfToken' => $_SESSION['csrf_token']));
    }

    if ($action === 'admin_session') {
        panel_json(200, array(
            'authenticated' => !empty($_SESSION['admin_authenticated']),
            'csrfToken' => $_SESSION['csrf_token'] ?? '',
        ));
    }

    if ($action === 'admin_logout') {
        panel_require_admin($data);
        $_SESSION = array();
        session_destroy();
        panel_json(200, array('authenticated' => false));
    }

    if ($action === 'admin_release_upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = $_POST;
    }

    panel_require_admin($data);

    if ($action === 'admin_dashboard') {
        $today = new DateTimeImmutable('today');
        $todayString = $today->format('Y-m-d');
        $fiveDaysString = $today->modify('+5 days')->format('Y-m-d');
        $countStatement = panel_db()->prepare(
            'SELECT COUNT(*) AS total, ' .
            'SUM(enabled = 1 AND expires_on >= ?) AS active, ' .
            'SUM(enabled = 1 AND expires_on BETWEEN ? AND ?) AS expiring, ' .
            'SUM(enabled = 1 AND expires_on < ?) AS expired FROM app_devices'
        );
        $countStatement->execute(array($todayString, $todayString, $fiveDaysString, $todayString));
        $counts = $countStatement->fetch();
        panel_json(200, array(
            'counts' => array_map('intval', $counts),
            'release' => panel_latest_release(),
            'settings' => array(
                'providerUrl' => panel_setting('provider_url'),
                'pixKey' => panel_setting('pix_key'),
                'whatsapp' => panel_setting('whatsapp'),
            ),
        ));
    }

    if ($action === 'admin_devices') {
        $search = trim((string) ($data['search'] ?? ''));
        $sql = 'SELECT device_id, display_name, username, expires_on, enabled, created_at ' .
            'FROM app_devices';
        $parameters = array();
        if ($search !== '') {
            $sql .= ' WHERE device_id = ? OR display_name LIKE ? OR username LIKE ?';
            $parameters = array($search, '%' . $search . '%', '%' . $search . '%');
        }
        $sql .= ' ORDER BY expires_on ASC, display_name ASC LIMIT 500';
        $statement = panel_db()->prepare($sql);
        $statement->execute($parameters);
        $pendingSql = 'SELECT r.device_id, r.app_version, r.first_seen, r.last_seen ' .
            'FROM app_device_registrations r LEFT JOIN app_devices d ON d.device_id = r.device_id ' .
            'WHERE d.device_id IS NULL';
        $pendingParameters = array();
        if ($search !== '') {
            $pendingSql .= ' AND r.device_id LIKE ?';
            $pendingParameters[] = '%' . $search . '%';
        }
        $pendingSql .= ' ORDER BY r.last_seen DESC LIMIT 200';
        $pendingStatement = panel_db()->prepare($pendingSql);
        $pendingStatement->execute($pendingParameters);
        panel_json(200, array(
            'devices' => $statement->fetchAll(),
            'pendingDevices' => $pendingStatement->fetchAll(),
        ));
    }

    if ($action === 'admin_renewals') {
        $statement = panel_db()->query(
            'SELECT r.device_id, d.display_name, r.previous_expiry, r.new_expiry, r.amount, ' .
            'r.payment_reference, r.created_at FROM app_renewals r ' .
            'INNER JOIN app_devices d ON d.device_id = r.device_id ' .
            'ORDER BY r.created_at DESC, r.id DESC LIMIT 200'
        );
        panel_json(200, array('renewals' => $statement->fetchAll()));
    }

    if ($action === 'admin_device') {
        $deviceId = strtolower(trim((string) ($data['deviceId'] ?? '')));
        if (!panel_valid_device_id($deviceId)) {
            panel_json(400, array('error' => 'Identificador do aparelho inválido.'));
        }
        $statement = panel_db()->prepare(
            'SELECT d.device_id, d.display_name, d.username, d.password_encrypted, d.expires_on, d.enabled, ' .
            'c.configuration_type, c.provider_url, c.playlist_url_encrypted ' .
            'FROM app_devices d LEFT JOIN app_device_configurations c ON c.device_id = d.device_id ' .
            'WHERE d.device_id = ?'
        );
        $statement->execute(array($deviceId));
        $device = $statement->fetch();
        if (!$device) {
            panel_json(404, array('error' => 'Aparelho não encontrado.'));
        }
        $device['configuration_type'] = $device['configuration_type'] ?: 'xtream';
        $device['provider_url'] = $device['provider_url'] ?: '';
        $device['has_password'] = $device['password_encrypted'] !== '';
        unset($device['password_encrypted']);
        $device['playlist_url'] = $device['configuration_type'] === 'm3u' ?
            panel_decrypt_password($device['playlist_url_encrypted']) : '';
        unset($device['playlist_url_encrypted']);
        panel_json(200, array('device' => $device));
    }

    if ($action === 'admin_device_save') {
        $deviceId = strtolower(trim((string) ($data['deviceId'] ?? '')));
        $name = trim((string) ($data['name'] ?? ''));
        $configurationType = (string) ($data['configurationType'] ?? 'xtream');
        $providerUrl = rtrim(trim((string) ($data['providerUrl'] ?? '')), '/');
        $username = trim((string) ($data['username'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        $playlistUrl = trim((string) ($data['playlistUrl'] ?? ''));
        $expiresOn = trim((string) ($data['expiresOn'] ?? ''));
        $enabled = !empty($data['enabled']) ? 1 : 0;
        if (!panel_valid_device_id($deviceId) || $name === '' || strlen($name) > 120 ||
                strlen($username) > 190 ||
                !in_array($configurationType, array('xtream', 'm3u'), true) || !panel_valid_date($expiresOn)) {
            panel_json(400, array('error' => 'Confira o identificador, nome, tipo de configuração e vencimento.'));
        }
        if ($configurationType === 'm3u' &&
                (strlen($playlistUrl) > 2048 || !filter_var($playlistUrl, FILTER_VALIDATE_URL) ||
                    !preg_match('/^https?:\/\//i', $playlistUrl))) {
            panel_json(400, array('error' => 'Informe um endereço M3U válido, começando com http:// ou https://.'));
        }
        if ($configurationType === 'xtream' && $providerUrl !== '' &&
                (strlen($providerUrl) > 2048 || !filter_var($providerUrl, FILTER_VALIDATE_URL) ||
                !preg_match('/^https?:\/\//i', $providerUrl))) {
            panel_json(400, array('error' => 'Informe uma URL válida para o servidor IPTV.'));
        }
        if ($configurationType === 'xtream' && $username === '') {
            panel_json(400, array('error' => 'Informe o usuário da conta IPTV.'));
        }

        $statement = panel_db()->prepare(
            'SELECT expires_on, password_encrypted FROM app_devices WHERE device_id = ?'
        );
        $statement->execute(array($deviceId));
        $existing = $statement->fetch();
        if ($configurationType === 'xtream' && $password === '' &&
                (!$existing || $existing['password_encrypted'] === '')) {
            panel_json(400, array('error' => 'Informe a senha IPTV para cadastrar o aparelho.'));
        }

        $storedUsername = $configurationType === 'm3u' ? '' : $username;
        $encryptedPassword = $configurationType === 'm3u' ? '' :
            ($password !== '' ? panel_encrypt_password($password) : (string) $existing['password_encrypted']);
        $pdo = panel_db();
        $pdo->beginTransaction();
        try {
            $statement = $pdo->prepare(
                'INSERT INTO app_devices (device_id, display_name, username, password_encrypted, expires_on, enabled) ' .
                'VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), ' .
                'username = VALUES(username), password_encrypted = VALUES(password_encrypted), ' .
                'expires_on = VALUES(expires_on), enabled = VALUES(enabled)'
            );
            $statement->execute(array($deviceId, $name, $storedUsername, $encryptedPassword, $expiresOn, $enabled));

            $configuration = $pdo->prepare(
                'INSERT INTO app_device_configurations (device_id, configuration_type, provider_url, playlist_url_encrypted) ' .
                'VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE configuration_type = VALUES(configuration_type), ' .
                'provider_url = VALUES(provider_url), ' .
                'playlist_url_encrypted = VALUES(playlist_url_encrypted)'
            );
            $configuration->execute(array(
                $deviceId,
                $configurationType,
                $configurationType === 'xtream' ? $providerUrl : '',
                $configurationType === 'm3u' ? panel_encrypt_password($playlistUrl) : '',
            ));
            $registration = $pdo->prepare('DELETE FROM app_device_registrations WHERE device_id = ?');
            $registration->execute(array($deviceId));

            if ($existing && $expiresOn > $existing['expires_on']) {
                $renewal = $pdo->prepare(
                    'INSERT INTO app_renewals (device_id, previous_expiry, new_expiry, amount, payment_reference) ' .
                    'VALUES (?, ?, ?, ?, ?)'
                );
                $amount = isset($data['amount']) && $data['amount'] !== '' ? (float) $data['amount'] : null;
                $renewal->execute(array(
                    $deviceId,
                    $existing['expires_on'],
                    $expiresOn,
                    $amount,
                    trim((string) ($data['paymentReference'] ?? '')),
                ));
            }
            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }

        panel_json(200, array('saved' => true));
    }

    if ($action === 'admin_settings_save') {
        $providerUrl = rtrim(trim((string) ($data['providerUrl'] ?? '')), '/');
        $pixKey = trim((string) ($data['pixKey'] ?? ''));
        $whatsapp = preg_replace('/\D+/', '', (string) ($data['whatsapp'] ?? ''));
        if ($providerUrl !== '' && (!filter_var($providerUrl, FILTER_VALIDATE_URL) ||
                !preg_match('/^https?:\\/\\//i', $providerUrl))) {
            panel_json(400, array('error' => 'Informe um endereço válido para o provedor IPTV.'));
        }
        if ($whatsapp !== '' && strlen($whatsapp) < 10) {
            panel_json(400, array('error' => 'Informe o WhatsApp com código do país e DDD.'));
        }
        panel_save_setting('provider_url', $providerUrl);
        panel_save_setting('pix_key', $pixKey);
        panel_save_setting('whatsapp', $whatsapp);
        panel_json(200, array('saved' => true));
    }

    if ($action === 'admin_release_upload') {
        $version = trim((string) ($_POST['version'] ?? ''));
        $notes = trim((string) ($_POST['notes'] ?? ''));
        if (!preg_match('/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/', $version)) {
            panel_json(400, array('error' => 'Use uma versão no formato 1.2.3.'));
        }
        if (!isset($_FILES['apk']) || $_FILES['apk']['error'] !== UPLOAD_ERR_OK ||
                $_FILES['apk']['size'] < 4 || $_FILES['apk']['size'] > 300 * 1024 * 1024) {
            panel_json(400, array('error' => 'Selecione um APK válido de até 300 MB.'));
        }
        $temporaryFile = $_FILES['apk']['tmp_name'];
        $handle = fopen($temporaryFile, 'rb');
        $signature = $handle ? fread($handle, 4) : '';
        if ($handle) {
            fclose($handle);
        }
        if ($signature !== "PK\x03\x04") {
            panel_json(400, array('error' => 'O arquivo enviado não parece ser um APK válido.'));
        }
        $latest = panel_latest_release();
        if ($latest && !panel_compare_versions((string) $latest['version'], $version)) {
            panel_json(400, array('error' => 'A nova versão precisa ser superior à versão publicada.'));
        }

        $storageDirectory = dirname(__DIR__) . '/storage/updates';
        if (!is_dir($storageDirectory) && !mkdir($storageDirectory, 0700, true) && !is_dir($storageDirectory)) {
            panel_json(500, array('error' => 'Não foi possível preparar o armazenamento de atualizações.'));
        }
        $filename = bin2hex(random_bytes(16)) . '.apk';
        if (!move_uploaded_file($temporaryFile, $storageDirectory . '/' . $filename)) {
            panel_json(500, array('error' => 'Não foi possível armazenar o APK enviado.'));
        }
        $statement = panel_db()->prepare(
            'INSERT INTO app_releases (version, filename, release_notes) VALUES (?, ?, ?)'
        );
        $statement->execute(array($version, $filename, $notes));
        panel_json(200, array('uploaded' => true, 'version' => $version));
    }

    panel_json(404, array('error' => 'Ação não encontrada.'));
} catch (Throwable $error) {
    panel_log_error($error);
    panel_json(500, array('error' => 'Não foi possível concluir a solicitação. Verifique a configuração do servidor.'));
}
