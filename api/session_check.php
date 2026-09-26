<?php
require __DIR__ . '/config.php';
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
json_response([
    'logged_in' => !empty($_SESSION['admin_logged_in']),
    'username' => $_SESSION['admin_username'] ?? null,
]);
