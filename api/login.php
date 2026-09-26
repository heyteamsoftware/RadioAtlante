<?php
require __DIR__ . '/config.php';

if (session_status() !== PHP_SESSION_ACTIVE) session_start();

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$password = $input['password'] ?? '';

if ($password === '') {
    json_response(['error' => 'Contraseña requerida'], 400);
}

// Acceso solo por contraseña (un único admin fijo)
$stmt = db()->prepare("SELECT * FROM admin_users WHERE username = 'admin'");
$stmt->execute();
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    json_response(['error' => 'Credenciales incorrectas'], 401);
}

$_SESSION['admin_logged_in'] = true;
$_SESSION['admin_username'] = $user['username'];

json_response(['ok' => true, 'username' => $user['username']]);
