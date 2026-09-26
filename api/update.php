<?php
require __DIR__ . '/config.php';
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Método no permitido'], 405);
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$id = (int)($input['id'] ?? 0);
$title = trim($input['title'] ?? '');
$category = trim($input['category'] ?? '');
$description = trim($input['description'] ?? '');

if ($id <= 0 || $title === '') {
    json_response(['error' => 'ID y título son obligatorios'], 400);
}

if (!array_key_exists($category, CATEGORIES)) {
    $category = 'Otros';
}

$stmt = db()->prepare("SELECT * FROM programs WHERE id = ?");
$stmt->execute([$id]);
$program = $stmt->fetch();
if (!$program) {
    json_response(['error' => 'Programa no encontrado'], 404);
}

$upd = db()->prepare("UPDATE programs SET title = ?, category = ?, description = ? WHERE id = ?");
$upd->execute([$title, $category, $description, $id]);

// Si cambió el título, actualizamos también el tag ID3 (metadata del directo)
if ($title !== $program['title']) {
    $path = MEDIA_DIR . '/' . $program['filename'];
    $ffmpeg = trim((string)@shell_exec('which ffmpeg 2>/dev/null'));
    if ($ffmpeg !== '' && is_file($path)) {
        if (!is_dir(TMP_UPLOADS_DIR)) {
            @mkdir(TMP_UPLOADS_DIR, 0775, true);
        }
        $tmpTagged = TMP_UPLOADS_DIR . '/' . uniqid('radio_tag_') . '.mp3';
        $cmd = 'ffmpeg -y -i ' . escapeshellarg($path)
             . ' -c copy -map_metadata -1 -metadata title=' . escapeshellarg($title)
             . ' -metadata album=' . escapeshellarg('Radio Atlante')
             . ' ' . escapeshellarg($tmpTagged) . ' 2>&1';
        @shell_exec($cmd);
        if (is_file($tmpTagged) && filesize($tmpTagged) > 0) {
            rename($tmpTagged, $path);
            chmod($path, 0664);
        } else {
            @unlink($tmpTagged);
        }
    }
}

json_response(['ok' => true]);
