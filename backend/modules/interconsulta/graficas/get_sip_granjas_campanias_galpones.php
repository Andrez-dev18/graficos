<?php

declare(strict_types=1);

require_once __DIR__ . '/sip_grafica_json_lib.php';
require_once __DIR__ . '/sip_grafica_catalog_lib.php';

$boot = sip_grafica_json_bootstrap();
$conn = $boot['conn'];

$result = sip_grafica_catalog_granjas_campanias_galpones($conn, array_merge($_GET, sip_grafica_catalog_periodo_params($_GET)));

$conn->close();
sip_grafica_json_emit($result);
