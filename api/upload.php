<?php
require __DIR__ . '/config.php';
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Método no permitido'], 405);
}

if (empty($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
    json_response(['error' => 'No se ha recibido ningún archivo válido'], 400);
}

$title = trim($_POST['title'] ?? '');
$category = trim($_POST['category'] ?? '');
$description = trim($_POST['description'] ?? '');

if (!array_key_exists($category, CATEGORIES)) {
    $category = 'Otros';
}

if ($title === '') {
    json_response(['error' => 'El título es obligatorio'], 400);
}

$file = $_FILES['audio'];
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

if ($ext !== 'mp3') {
    json_response(['error' => 'Solo se permiten archivos MP3'], 400);
}

// Validación básica de tipo real (magic bytes / mime)
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);
$allowed_mimes = ['audio/mpeg', 'audio/mp3'];
if (!in_array($mime, $allowed_mimes, true)) {
    json_response(['error' => 'El archivo no parece ser un MP3 válido'], 400);
}

$slug = slugify($title);
$baseSlug = $slug;
$i = 1;
$stmtCheck = db()->prepare("SELECT COUNT(*) FROM programs WHERE slug = ?");
while (true) {
    $stmtCheck->execute([$slug]);
    if ((int)$stmtCheck->fetchColumn() === 0) break;
    $slug = $baseSlug . '-' . (++$i);
}

$filename = $slug . '.mp3';
$destination = MEDIA_DIR . '/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    json_response(['error' => 'No se pudo guardar el archivo en el servidor'], 500);
}
chmod($destination, 0664);

// Duración vía ffprobe si está disponible
$duration = 0;
$ffprobe = trim((string)@shell_exec('which ffprobe 2>/dev/null'));
if ($ffprobe !== '') {
    $out = @shell_exec('ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ' . escapeshellarg($destination));
    $duration = (int)round((float)trim((string)$out));
}

// Escribimos el título como tag ID3 para que Liquidsoap lo emita como metadata
// del directo (así el frontend puede mostrar "sonando ahora").
$ffmpeg = trim((string)@shell_exec('which ffmpeg 2>/dev/null'));
if ($ffmpeg !== '') {
    // Escribimos el temporal FUERA de media/ (pero en el mismo disco, para que
    // el rename() sea atómico) para que Liquidsoap, que vigila esa carpeta,
    // nunca intente leerlo a medio escribir.
    if (!is_dir(TMP_UPLOADS_DIR)) {
        @mkdir(TMP_UPLOADS_DIR, 0775, true);
    }
    $tmpTagged = TMP_UPLOADS_DIR . '/' . uniqid('radio_tag_') . '.mp3';
    $cmd = 'ffmpeg -y -i ' . escapeshellarg($destination)
         . ' -c copy -map_metadata -1 -metadata title=' . escapeshellarg($title)
         . ' -metadata album=' . escapeshellarg('Radio Atlante')
         . ' ' . escapeshellarg($tmpTagged) . ' 2>&1';
    @shell_exec($cmd);
    if (is_file($tmpTagged) && filesize($tmpTagged) > 0) {
        rename($tmpTagged, $destination);
        chmod($destination, 0664);
    } else {
        @unlink($tmpTagged);
    }
}

$stmt = db()->prepare("INSERT INTO programs (title, slug, category, description, filename, duration_seconds, file_size_bytes)
                        VALUES (?, ?, ?, ?, ?, ?, ?)");
$stmt->execute([$title, $slug, $category, $description, $filename, $duration, filesize($destination)]);

json_response(['ok' => true, 'id' => db()->lastInsertId(), 'slug' => $slug]);
