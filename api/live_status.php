<?php
require __DIR__ . '/config.php';

$ctx = stream_context_create(['http' => ['timeout' => 3]]);
$raw = @file_get_contents(ICECAST_STATUS_URL, false, $ctx);

if ($raw === false) {
    json_response(['live' => false, 'listeners' => 0, 'stream_url' => ICECAST_STREAM_URL]);
}

$data = json_decode($raw, true);
$source = $data['icestats']['source'] ?? null;

if (!$source) {
    json_response(['live' => false, 'listeners' => 0, 'stream_url' => ICECAST_STREAM_URL]);
}

$nowPlayingTitle = $source['title'] ?? null;
$elapsedSeconds = null;
$durationSeconds = null;

// Leemos el instante de inicio de la pista actual (lo escribe Liquidsoap en
// cada cambio de pista) para calcular por qué minuto va la emisión.
$nowPlayingFile = BASE_DIR . '/db/now_playing.json';
if ($nowPlayingTitle && is_file($nowPlayingFile)) {
    $raw = @file_get_contents($nowPlayingFile);
    $data = json_decode((string)$raw, true);
    if ($data && ($data['title'] ?? null) === $nowPlayingTitle) {
        $elapsedSeconds = max(0, time() - (int)$data['started_at']);
    }
}

// Duración y portada, si el título coincide con algún programa de la biblioteca
$nowPlayingCover = null;
if ($nowPlayingTitle) {
    $stmt = db()->prepare("SELECT duration_seconds, category, cover_image FROM programs WHERE title = ? LIMIT 1");
    $stmt->execute([$nowPlayingTitle]);
    $row = $stmt->fetch();
    if ($row) {
        $durationSeconds = (int)$row['duration_seconds'];
        $cover = $row['cover_image'];
        if (!$cover) {
            $catKey = strtolower(trim($row['category'] ?? ''));
            foreach (CATEGORIES as $name => $file) {
                if (strtolower($name) === $catKey) {
                    $cover = $file;
                    break;
                }
            }
        }
        $nowPlayingCover = $cover ? COVERS_URL_PATH . '/' . rawurlencode($cover) : null;
    }
}

json_response([
    'live' => true,
    'listeners' => $source['listeners'] ?? 0,
    'now_playing' => $nowPlayingTitle,
    'now_playing_cover' => $nowPlayingCover,
    'elapsed_seconds' => $elapsedSeconds,
    'duration_seconds' => $durationSeconds,
    'stream_url' => ICECAST_STREAM_URL,
]);
