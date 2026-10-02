<?php

declare(strict_types=1);

require_once __DIR__ . '/sip_grafica_json_lib.php';
require_once __DIR__ . '/sip_grafica_catalog_lib.php';

$boot = sip_grafica_json_bootstrap();
$conn = $boot['conn'];

$result = sip_grafica_catalog_tipos_grafica();

$conn->close();
sip_grafica_json_emit($result);
