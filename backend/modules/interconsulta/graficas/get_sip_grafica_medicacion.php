<?php

declare(strict_types=1);

/**
 * Endpoint de medicación aplicada (bar stacked por día y medicina).
 *
 * GET /modules/sip/graficas/get_sip_grafica_medicacion.php
 *   ?granja=630&campania=151&galpon=1
 *
 * Respuesta: dataPorDia[{dia, fecha, <medicina>: {valor}}] + metricas/medicinas.
 */

ob_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require_once __DIR__ . '/sip_grafica_bootstrap.php';
require_once __DIR__ . '/sip_grafica_data_lib.php';

$boot = sip_grafica_bootstrap_http();
$conn = $boot['conn'];

$granja = trim((string) ($_GET['granja'] ?? ''));
$campania = trim((string) ($_GET['campania'] ?? ''));
$galpon = trim((string) ($_GET['galpon'] ?? ''));

if ($granja === '' || $campania === '' || $galpon === '') {
    ob_clean();
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Faltan parametros: granja, campania, galpon']);
    $conn->close();
    exit;
}

$result = sip_grafica_build($conn, 'medicacion', [
    'granja' => $granja,
    'campania' => $campania,
    'galpon' => $galpon,
]);

$conn->close();
ob_clean();
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
