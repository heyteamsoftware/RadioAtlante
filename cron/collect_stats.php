<?php
// Muestra el número de oyentes actuales de Icecast y lo guarda en SQLite.
// Pensado para ejecutarse cada minuto vía cron (usuario www-data).
// No afecta a la emisión ni al frontend si falla: cualquier error se ignora.

require __DIR__ . '/../api/config.php';

$ctx = stream_context_create(['http' => ['timeout' => 3]]);
$raw = @file_get_contents(ICECAST_STATUS_URL, false, $ctx);
if ($raw === false) {
    exit(0);
}

$data = json_decode($raw, true);
$source = $data['icestats']['source'] ?? null;
$listeners = $source['listeners'] ?? 0;

try {
    $pdo = db();
    $stmt = $pdo->prepare("INSERT INTO listener_stats (ts, listeners) VALUES (?, ?)");
    $stmt->execute([time(), (int)$listeners]);

    // Limpieza: no guardamos más de 30 días de histórico
    $cutoff = time() - (30 * 86400);
    $pdo->prepare("DELETE FROM listener_stats WHERE ts < ?")->execute([$cutoff]);
} catch (Throwable $e) {
    // Silencioso: esto nunca debe romper nada ni generar ruido en cron
    exit(0);
}
