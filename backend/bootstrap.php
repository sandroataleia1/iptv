<?php

declare(strict_types=1);

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('error' => 'O painel ainda não foi configurado no servidor.'));
    exit;
}

$config = require $configFile;
date_default_timezone_set($config['timezone'] ?? 'America/Sao_Paulo');

function panel_db(): PDO
{
    static $pdo = null;
    global $config;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $database = $config['database'];
    $dsn = 'mysql:host=' . $database['host'] . ';dbname=' . $database['name'] . ';charset=utf8mb4';
    $pdo = new PDO($dsn, $database['user'], $database['password'], array(
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ));

    return $pdo;
}

function panel_setting(string $key, string $default = ''): string
{
    global $config;

    $statement = panel_db()->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ?');
    $statement->execute(array($key));
    $value = $statement->fetchColumn();

    if ($value !== false) {
        return (string) $value;
    }

    return isset($config[$key]) ? (string) $config[$key] : $default;
}

function panel_json(int $status, array $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function panel_read_json(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);

    return is_array($data) ? $data : array();
}

function panel_valid_device_id(string $deviceId): bool
{
    return (bool) preg_match(
        '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
        $deviceId
    );
}

function panel_encrypt_password(string $password): string
{
    global $config;

    $key = base64_decode((string) ($config['encryption_key'] ?? ''), true);
    if ($key === false || strlen($key) !== 32) {
        throw new RuntimeException('Configure uma chave de criptografia válida de 32 bytes.');
    }

    $nonce = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt($password, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag);
    if ($ciphertext === false) {
        throw new RuntimeException('Não foi possível proteger a senha IPTV.');
    }

    return base64_encode($nonce . $tag . $ciphertext);
}

function panel_decrypt_password(string $encrypted): string
{
    global $config;

    $key = base64_decode((string) ($config['encryption_key'] ?? ''), true);
    $payload = base64_decode($encrypted, true);
    if ($key === false || strlen($key) !== 32 || $payload === false || strlen($payload) < 29) {
        throw new RuntimeException('Não foi possível ler as credenciais IPTV protegidas.');
    }

    $password = openssl_decrypt(
        substr($payload, 28),
        'aes-256-gcm',
        $key,
        OPENSSL_RAW_DATA,
        substr($payload, 0, 12),
        substr($payload, 12, 16)
    );
    if ($password === false) {
        throw new RuntimeException('Não foi possível ler as credenciais IPTV protegidas.');
    }

    return $password;
}

function panel_latest_release(): ?array
{
    $statement = panel_db()->query(
        'SELECT version, filename, release_notes, created_at FROM app_releases ORDER BY id DESC LIMIT 1'
    );
    $release = $statement->fetch();

    return $release ?: null;
}

function panel_compare_versions(string $current, string $latest): bool
{
    return version_compare($latest, $current, '>');
}

function panel_start_admin_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name('iptv_panel_admin');
    session_set_cookie_params(array(
        'lifetime' => 0,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ));
    session_start();
}

function panel_require_admin(array $data = array()): void
{
    panel_start_admin_session();
    if (empty($_SESSION['admin_authenticated'])) {
        panel_json(401, array('error' => 'Faça login para acessar o painel.'));
    }

    $token = (string) ($data['csrfToken'] ?? '');
    if ($token === '' || empty($_SESSION['csrf_token']) ||
            !hash_equals((string) $_SESSION['csrf_token'], $token)) {
        panel_json(403, array('error' => 'A sessão do painel expirou. Entre novamente.'));
    }
}

function panel_admin_login_required(): void
{
    panel_start_admin_session();
    if (empty($_SESSION['admin_authenticated'])) {
        panel_json(401, array('error' => 'Faça login para acessar o painel.'));
    }
}

function panel_base_url(): string
{
    global $config;
    $baseUrl = rtrim((string) ($config['base_url'] ?? ''), '/') . '/';

    if (!filter_var($baseUrl, FILTER_VALIDATE_URL) || strpos($baseUrl, 'https://') !== 0) {
        throw new RuntimeException('Configure a URL HTTPS pública do painel.');
    }

    return $baseUrl;
}

function panel_log_error(Throwable $error): void
{
    error_log('IPTV panel: ' . $error->getMessage());
}
