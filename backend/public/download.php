<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

$deviceId = strtolower(trim((string) ($_GET['deviceId'] ?? '')));
if (!panel_valid_device_id($deviceId)) {
    http_response_code(400);
    exit('Identificador inválido.');
}

try {
    $statement = panel_db()->prepare('SELECT enabled FROM app_devices WHERE device_id = ?');
    $statement->execute(array($deviceId));
    if ($statement->fetchColumn() === false) {
        http_response_code(404);
        exit('Aparelho não encontrado.');
    }

    $release = panel_latest_release();
    if (!$release) {
        http_response_code(404);
        exit('Nenhuma atualização disponível.');
    }

    $file = dirname(__DIR__) . '/storage/updates/' . basename($release['filename']);
    if (!is_file($file)) {
        http_response_code(404);
        exit('Arquivo de atualização não encontrado.');
    }

    header('Content-Type: application/vnd.android.package-archive');
    header('Content-Length: ' . filesize($file));
    header('Content-Disposition: attachment; filename="iptv-lab-' .
        preg_replace('/[^a-zA-Z0-9._-]/', '', $release['version']) . '.apk"');
    header('Cache-Control: no-store');
    readfile($file);
} catch (Throwable $error) {
    panel_log_error($error);
    http_response_code(503);
    exit('Não foi possível baixar a atualização.');
}
