<?php

declare(strict_types=1);

require_once __DIR__ . '/sip_grafica_json_lib.php';
require_once __DIR__ . '/sip_grafica_pesaje_lib.php';

$boot = sip_grafica_json_bootstrap();
$conn = $boot['conn'];

$tipo = trim((string) ($_GET['tipo'] ?? 'pesaje_pollo'));

$result = sip_grafica_pesaje_dias_build($tipo);

$conn->close();
sip_grafica_json_emit($result);
