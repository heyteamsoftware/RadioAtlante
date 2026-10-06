<?php
// Configuración central de Radio Atlante

define('BASE_DIR', dirname(__DIR__));
define('DB_PATH', BASE_DIR . '/db/radio.sqlite');
define('MEDIA_DIR', BASE_DIR . '/media');
define('TMP_UPLOADS_DIR', BASE_DIR . '/tmp_uploads');
define('MEDIA_URL_PATH', '/Tony_RadioAtlante/media');
define('COVERS_DIR', BASE_DIR . '/covers');
define('COVERS_URL_PATH', '/Tony_RadioAtlante/covers');
define('ICECAST_STATUS_URL', 'http://127.0.0.1:8000/status-json.xsl');
define('ICECAST_STREAM_URL', 'https://myappsserver.duckdns.org/Tony_RadioAtlante/stream');

session_name('tonyradio_admin');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/Tony_RadioAtlante/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO('sqlite:' . DB_PATH);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    }
    return $pdo;
}

function json_response($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function require_admin(): void {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    if (empty($_SESSION['admin_logged_in'])) {
        json_response(['error' => 'No autorizado'], 401);
    }
}

// Categorías fijas de la radio y su portada por defecto en media/covers/
const CATEGORIES = [
    'Onda Azul' => 'onda_azul.jpg',
    'Cosas que Importan' => 'cosas_que_importan.jpg',
    'Conoce tu Empresa' => 'conoce_tu_empresa.jpg',
    'Salud en las Ondas' => 'salud_en_las_ondas.jpg',
    'Eventos' => 'eventos.jpg',
    'Otros' => 'otros.jpg',
];

function slugify(string $text): string {
    $text = iconv('UTF-8', 'ASCII//TRANSLIT', $text);
    $text = strtolower($text);
    $text = preg_replace('/[^a-z0-9]+/', '-', $text);
    return trim($text, '-');
}
