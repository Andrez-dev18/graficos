<?php

declare(strict_types=1);

ob_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require_once __DIR__ . '/sip_grafica_bootstrap.php';
require_once __DIR__ . '/sip_grafica_acumulado_semanal_lib.php';
require_once __DIR__ . '/sip_grafica_pesaje_lib.php';

$boot = sip_grafica_bootstrap_http();
$conn = $boot['conn'];

$tipo = trim((string) ($_GET['tipo'] ?? 'mortalidad'));
$fechaInicio = trim((string) ($_GET['fechaInicio'] ?? ''));
$fechaFin = trim((string) ($_GET['fechaFin'] ?? ''));
$semana = (int) ($_GET['semana'] ?? 0);
$dia = (int) ($_GET['dia'] ?? 1);
$tedad = sip_grafica_pesaje_dia_api_a_tedad($dia);

if ($fechaInicio === '' || $fechaFin === '') {
    ob_clean();
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Faltan parametros: fechaInicio, fechaFin']);
    $conn->close();
    exit;
}

$result = sip_grafica_acumulado_semanal_build($conn, [
    'tipo' => $tipo,
    'fechaInicio' => $fechaInicio,
    'fechaFin' => $fechaFin,
    'semana' => $semana,
    'dia' => $dia,
    'tedad' => $tedad,
]);

$conn->close();
ob_clean();
echo json_encode($result, JSON_UNESCAPED_UNICODE);
