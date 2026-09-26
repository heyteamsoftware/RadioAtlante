<?php
require __DIR__ . '/config.php';
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Método no permitido'], 405);
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$id = (int)($input['id'] ?? 0);

if ($id <= 0) {
    json_response(['error' => 'ID inválido'], 400);
}

$stmt = db()->prepare("SELECT filename FROM programs WHERE id = ?");
$stmt->execute([$id]);
$program = $stmt->fetch();

if (!$program) {
    json_response(['error' => 'Programa no encontrado'], 404);
}

$path = MEDIA_DIR . '/' . $program['filename'];
if (is_file($path)) {
    @unlink($path);
}

$del = db()->prepare("DELETE FROM programs WHERE id = ?");
$del->execute([$id]);

json_response(['ok' => true]);
