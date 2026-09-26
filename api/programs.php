<?php
require __DIR__ . '/config.php';

$stmt = db()->query("SELECT id, title, slug, category, description, filename, cover_image, duration_seconds, uploaded_at
                      FROM programs WHERE active = 1 ORDER BY uploaded_at DESC");
$programs = $stmt->fetchAll();

// Mapa case-insensitive de categoría -> portada por defecto
$categoryCoversLower = [];
foreach (CATEGORIES as $name => $cover) {
    $categoryCoversLower[strtolower($name)] = $cover;
}

foreach ($programs as &$p) {
    $p['stream_url'] = MEDIA_URL_PATH . '/' . rawurlencode($p['filename']);

    $cover = $p['cover_image'];
    if (!$cover) {
        $catKey = strtolower(trim($p['category'] ?? ''));
        $cover = $categoryCoversLower[$catKey] ?? null;
    }
    $p['cover_url'] = $cover ? COVERS_URL_PATH . '/' . rawurlencode($cover) : null;
    unset($p['filename']);
}

json_response(['programs' => $programs, 'categories' => array_keys(CATEGORIES)]);
