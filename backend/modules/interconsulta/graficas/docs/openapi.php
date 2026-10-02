<?php

declare(strict_types=1);

/**
 * OpenAPI dinámico: enriquece enums/ejemplos desde BD si hay sesión activa.
 * Uso: openapi.php | openapi.php?format=yaml
 */

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

require_once dirname(__DIR__) . '/sip_grafica_openapi_lib.php';

$format = strtolower(trim((string) ($_GET['format'] ?? 'json')));
$conn = null;

if (!empty($_SESSION['active'])) {
    require_once dirname(__DIR__) . '/sip_grafica_bootstrap.php';
    $conn = sip_grafica_bootstrap_conn_optional();
}

$spec = sip_grafica_openapi_build($conn);
if ($conn instanceof mysqli) {
    $conn->close();
}

if ($format === 'yaml' || $format === 'yml') {
    header('Content-Type: text/yaml; charset=utf-8');
    echo sip_grafica_openapi_to_yaml($spec);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
echo json_encode($spec, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
