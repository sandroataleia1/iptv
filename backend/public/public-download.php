<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    exit('Method not allowed.');
}

try {
    $release = panel_latest_release();
    if (!$release) {
        http_response_code(404);
        exit('No app release is available yet.');
    }

    $file = dirname(__DIR__) . '/storage/updates/' . basename($release['filename']);
    if (!is_file($file) || !is_readable($file)) {
        http_response_code(404);
        exit('App download is unavailable.');
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
    exit('Unable to download the app.');
}
