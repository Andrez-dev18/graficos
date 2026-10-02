<?php

declare(strict_types=1);

/**
 * Respuesta JSON estándar para endpoints de catálogo/gráficas.
 *
 * @param array<string,mixed> $result
 */
function sip_grafica_json_emit(array $result): void
{
    ob_clean();
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * @return array{conn:mysqli}
 */
function sip_grafica_json_bootstrap(): array
{
    ob_start();
    header('Content-Type: application/json; charset=utf-8');

    require_once __DIR__ . '/sip_grafica_bootstrap.php';

    return sip_grafica_bootstrap_http();
}
