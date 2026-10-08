<?php
// Contador de visitantes únicos.
// El navegador genera un identificador aleatorio (guardado en localStorage) y
// lo envía una vez; aquí solo se cuentan identificadores distintos. No se
// guarda IP ni ningún dato personal.
require __DIR__ . '/config.php';

$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $vid = (string)($input['vid'] ?? '');
    if (preg_match('/^[a-f0-9-]{16,64}$/', $vid)) {
        $stmt = $pdo->prepare("INSERT OR IGNORE INTO visitors (vid, first_seen) VALUES (?, ?)");
        $stmt->execute([$vid, time()]);
    }
}

$count = (int)$pdo->query("SELECT COUNT(*) FROM visitors")->fetchColumn();
header('Cache-Control: no-store');
json_response(['count' => $count]);
