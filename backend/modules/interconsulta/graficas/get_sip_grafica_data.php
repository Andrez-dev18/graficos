<?php

declare(strict_types=1);

ob_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/sip_grafica_bootstrap.php';
require_once __DIR__ . '/sip_grafica_data_lib.php';
require_once __DIR__ . '/sip_grafica_catalog_lib.php';

$boot = sip_grafica_bootstrap_http();
$conn = $boot['conn'];

$tipo = trim((string) ($_GET['tipo'] ?? 'mortalidad'));
$granja = trim((string) ($_GET['granja'] ?? ''));
$campania = trim((string) ($_GET['campania'] ?? ''));
$galpon = trim((string) ($_GET['galpon'] ?? ''));
$seccion = trim((string) ($_GET['seccion'] ?? 'linea'));

if ($granja === '' || $campania === '') {
    ob_clean();
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Faltan parametros: granja, campania']);
    $conn->close();
    exit;
}

if (sip_grafica_catalog_requiere_galpon($tipo, $seccion) && $galpon === '') {
    ob_clean();
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Falta parametro galpon']);
    $conn->close();
    exit;
}

$buildOpts = [
    'granja' => $granja,
    'campania' => $campania,
    'galpon' => $galpon,
];
if (sip_grafica_catalog_tipo_usa_seccion($tipo)) {
    $buildOpts['seccion'] = $seccion;
}

$result = sip_grafica_build($conn, $tipo, $buildOpts);

$conn->close();
ob_clean();
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
