<?php

declare(strict_types=1);

/**
 * Bootstrap HTTP para endpoints de graficas: sesion + conexion.
 *
 * @return array{conn:mysqli}
 */
function sip_grafica_bootstrap_http(): array
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    if (empty($_SESSION['active'])) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'No autorizado']);
        exit;
    }

    require_once dirname(__DIR__, 3) . '/bootstrap_conexion.php';

    if (!function_exists('conectar_joya_mysqli')) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'conectar_joya_mysqli no disponible']);
        exit;
    }

    $conn = conectar_joya_mysqli();
    if (!$conn) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'Error de conexion']);
        exit;
    }

    return ['conn' => $conn];
}

/**
 * Conexión opcional para OpenAPI/docs (no envía respuesta HTTP ni hace exit).
 */
function sip_grafica_bootstrap_conn_optional(): ?mysqli
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    if (empty($_SESSION['active'])) {
        return null;
    }

    require_once dirname(__DIR__, 3) . '/bootstrap_conexion.php';

    if (!function_exists('conectar_joya_mysqli')) {
        return null;
    }

    $conn = conectar_joya_mysqli();

    return $conn instanceof mysqli ? $conn : null;
}
