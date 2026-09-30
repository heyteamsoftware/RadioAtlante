<?php
require __DIR__ . '/config.php';
require_admin();

$pdo = db();

// Oyentes actuales (en vivo, no depende del histórico)
$current = 0;
$ctx = stream_context_create(['http' => ['timeout' => 3]]);
$raw = @file_get_contents(ICECAST_STATUS_URL, false, $ctx);
if ($raw !== false) {
    $data = json_decode($raw, true);
    $current = (int)($data['icestats']['source']['listeners'] ?? 0);
}

// Serie de las últimas 24h, agregada por hora (media y pico)
$since = time() - 86400;
$stmt = $pdo->prepare("
    SELECT
        CAST(ts / 3600 AS INTEGER) AS bucket,
        AVG(listeners) AS avg_listeners,
        MAX(listeners) AS max_listeners
    FROM listener_stats
    WHERE ts >= ?
    GROUP BY bucket
    ORDER BY bucket ASC
");
$stmt->execute([$since]);
$rows = $stmt->fetchAll();

$series = array_map(function ($r) {
    return [
        'hour' => (int)$r['bucket'] * 3600,
        'avg' => round((float)$r['avg_listeners'], 1),
        'max' => (int)$r['max_listeners'],
    ];
}, $rows);

// Pico histórico (últimos 30 días, lo que haya en la tabla)
$peakStmt = $pdo->query("SELECT MAX(listeners) AS peak, MAX(ts) AS last_ts FROM listener_stats");
$peakRow = $peakStmt->fetch();

json_response([
    'current_listeners' => $current,
    'peak_30d' => (int)($peakRow['peak'] ?? 0),
    'series_24h' => $series,
    'has_data' => count($series) > 0,
]);
