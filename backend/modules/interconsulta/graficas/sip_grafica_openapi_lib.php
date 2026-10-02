<?php

declare(strict_types=1);

require_once __DIR__ . '/sip_grafica_catalog_lib.php';

if (!function_exists('sip_grafica_openapi_app_title')) {
    function sip_grafica_openapi_app_title(): string
    {
        $root = dirname(__DIR__, 3);
        if (is_file($root . '/includes/sip_branding.php')) {
            require_once $root . '/includes/sip_branding.php';
            if (function_exists('sip_brand_name')) {
                return sip_brand_name() . ' — API Gráficas SIP';
            }
        }

        return basename($root) . ' — API Gráficas SIP';
    }
}

if (!function_exists('sip_grafica_openapi_server_url')) {
    function sip_grafica_openapi_server_url(): string
    {
        $root = dirname(__DIR__, 3);
        $folder = basename(str_replace('\\', '/', $root));

        return 'http://localhost/' . $folder;
    }
}

if (!function_exists('sip_grafica_openapi_enrich_from_db')) {
    /**
     * @param array<string,mixed> $spec
     * @return array<string,mixed>
     */
    function sip_grafica_openapi_enrich_from_db(array $spec, mysqli $conn): array
    {
        $tipoIds = ['mortalidad'];
        $seccionIds = sip_grafica_catalog_todos_seccion_ids();
        if ($seccionIds === []) {
            $seccionIds = ['linea', 'causas', 'pareto', 'all'];
        }
        $granjaExample = '601';
        $campaniaExample = '001';
        $galponExample = '1';
        $granjaEnum = [];
        $zonaEnum = [];

        $tipos = sip_grafica_catalog_tipos_grafica();
        if (!empty($tipos['success']) && !empty($tipos['data'])) {
            $tipoIds = array_values(array_filter(array_map(static function (array $t): string {
                return trim((string) ($t['id'] ?? ''));
            }, $tipos['data'])));
        }

        $granjas = sip_grafica_catalog_granjas($conn);
        if (!empty($granjas['success']) && !empty($granjas['data'])) {
            $granjaEnum = array_values(array_filter(array_map(static function (array $g): string {
                return trim((string) ($g['granja'] ?? ''));
            }, array_slice($granjas['data'], 0, 30))));
            if ($granjaEnum !== []) {
                $granjaExample = $granjaEnum[0];
            }
        }

        $zonas = sip_grafica_catalog_zonas($conn);
        if (!empty($zonas['success']) && !empty($zonas['data'])) {
            $zonaEnum = array_slice($zonas['data'], 0, 20);
        }

        if ($granjaExample !== '') {
            $sel = sip_grafica_catalog_granjas_campanias_galpones($conn, [
                'granja' => $granjaExample,
                'periodoTipo' => 'TODOS',
            ]);
            if (!empty($sel['success'])) {
                foreach ($sel['granjas'] ?? [] as $g) {
                    if (sip_grafica_catalog_norm_granja($g['granja'] ?? '') === sip_grafica_catalog_norm_granja($granjaExample)) {
                        if (!empty($g['campanias'][0])) {
                            $campaniaExample = (string) $g['campanias'][0];
                        }
                        if (!empty($g['galpones'][0])) {
                            $galponExample = (string) $g['galpones'][0];
                        }
                        break;
                    }
                }
            }
        }

        $dataPath = &$spec['paths']['/modules/sip/graficas/get_sip_grafica_data.php']['get'];
        foreach ($dataPath['parameters'] as &$param) {
            if (($param['name'] ?? '') === 'tipo') {
                $param['schema']['enum'] = $tipoIds;
                $param['example'] = $tipoIds[0] ?? 'mortalidad';
                $param['description'] = 'Tipos disponibles (desde catálogo action=tipos)';
            }
            if (($param['name'] ?? '') === 'seccion') {
                $param['schema']['enum'] = $seccionIds;
            }
            if (($param['name'] ?? '') === 'granja') {
                $param['example'] = $granjaExample;
                if ($granjaEnum !== []) {
                    $param['schema']['enum'] = $granjaEnum;
                }
            }
            if (($param['name'] ?? '') === 'campania') {
                $param['example'] = $campaniaExample;
            }
            if (($param['name'] ?? '') === 'galpon') {
                $param['example'] = $galponExample;
            }
        }
        unset($param);

        $acumPath = &$spec['paths']['/modules/sip/graficas/get_sip_grafica_acumulado_semanal.php']['get'];
        foreach ($acumPath['parameters'] as &$param) {
            if (($param['name'] ?? '') === 'tipo') {
                $param['schema']['enum'] = $tipoIds;
                $param['example'] = $tipoIds[0] ?? 'mortalidad';
                $param['description'] = 'Tipos disponibles (desde catálogo action=tipos)';
            }
        }
        unset($param);

        foreach ([
            '/modules/sip/graficas/get_sip_granjas_campanias_galpones.php',
        ] as $pathKey) {
            if (empty($spec['paths'][$pathKey]['get']['parameters'])) {
                continue;
            }
            foreach ($spec['paths'][$pathKey]['get']['parameters'] as &$param) {
                if (($param['name'] ?? '') === 'granja' && $granjaEnum !== []) {
                    $param['schema']['enum'] = $granjaEnum;
                    $param['example'] = $granjaExample;
                }
                if (($param['name'] ?? '') === 'zona' && $zonaEnum !== []) {
                    $param['schema']['enum'] = $zonaEnum;
                }
            }
            unset($param);
        }

        unset($spec['paths']['/modules/sip/graficas/get_sip_grafica_granjas.php']);

        $spec['info']['description'] = trim((string) ($spec['info']['description'] ?? ''))
            . "\n\n**Enriquecido en vivo** con tipos, granjas y ejemplos desde BD (sesión activa).";

        $spec['x-sip-catalog-snapshot'] = [
            'generatedAt' => date('c'),
            'tipos' => $tipoIds,
            'secciones' => $seccionIds,
            'granjaEjemplo' => $granjaExample,
            'campaniaEjemplo' => $campaniaExample,
            'galponEjemplo' => $galponExample,
            'granjasDisponibles' => count($granjaEnum),
        ];

        return $spec;
    }
}

if (!function_exists('sip_grafica_openapi_periodo_parameters')) {
    /**
     * @return list<array<string,mixed>>
     */
    function sip_grafica_openapi_periodo_parameters(): array
    {
        return [
            [
                'name' => 'periodoTipo',
                'in' => 'query',
                'description' => 'Solo se usan los campos del tipo activo. Atajo: `fechaInicio`+`fechaFin` sin periodoTipo implica ENTRE_FECHAS.',
                'schema' => [
                    'type' => 'string',
                    'enum' => ['TODOS', 'POR_FECHA', 'ENTRE_FECHAS', 'POR_MES', 'ENTRE_MESES', 'ULTIMA_SEMANA'],
                    'default' => 'ENTRE_MESES',
                ],
            ],
            ['name' => 'fechaUnica', 'in' => 'query', 'description' => 'Solo POR_FECHA', 'schema' => ['type' => 'string', 'format' => 'date']],
            ['name' => 'fechaInicio', 'in' => 'query', 'description' => 'ENTRE_FECHAS (o atajo sin periodoTipo)', 'schema' => ['type' => 'string', 'format' => 'date', 'example' => '2026-01-01']],
            ['name' => 'fechaFin', 'in' => 'query', 'description' => 'ENTRE_FECHAS (o atajo sin periodoTipo)', 'schema' => ['type' => 'string', 'format' => 'date', 'example' => '2026-12-31']],
            ['name' => 'mesUnico', 'in' => 'query', 'description' => 'Solo POR_MES (ignorado en ENTRE_MESES)', 'schema' => ['type' => 'string', 'example' => '2026-08']],
            ['name' => 'mesInicio', 'in' => 'query', 'description' => 'Solo ENTRE_MESES', 'schema' => ['type' => 'string', 'example' => '2026-01']],
            ['name' => 'mesFin', 'in' => 'query', 'description' => 'Solo ENTRE_MESES', 'schema' => ['type' => 'string', 'example' => '2026-12']],
        ];
    }
}

if (!function_exists('sip_grafica_openapi_paths')) {
    /**
     * @return array<string,mixed>
     */
    function sip_grafica_openapi_paths(): array
    {
        $periodo = sip_grafica_openapi_periodo_parameters();

        return [
            '/modules/sip/graficas/get_sip_grafica_tipos.php' => [
                'get' => [
                    'tags' => ['Catálogo'],
                    'summary' => 'Tipos de gráfica',
                    'description' => 'Alias legacy: `get_sip_tipos_grafica.php`',
                    'operationId' => 'getTiposGrafica',
                    'responses' => [
                        '200' => [
                            'description' => 'Tipos y secciones disponibles',
                            'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/CatalogTiposGrafica']]],
                        ],
                        '401' => ['description' => 'Sin sesión'],
                    ],
                ],
            ],
            '/modules/sip/graficas/get_sip_granjas_campanias_galpones.php' => [
                'get' => [
                    'tags' => ['Catálogo'],
                    'summary' => 'Granjas, campañas y galpones',
                    'description' => 'Un solo request con árbol de selección. `campanias` es `string[]`. Acepta `fechaInicio`/`fechaFin` o `periodoTipo` HC.',
                    'operationId' => 'getGranjasCampaniasGalpones',
                    'parameters' => array_merge([
                        ['name' => 'granja', 'in' => 'query', 'schema' => ['type' => 'string'], 'description' => 'Filtro opcional por granja'],
                        ['name' => 'zona', 'in' => 'query', 'schema' => ['type' => 'string'], 'description' => 'Filtro opcional por zona'],
                    ], $periodo),
                    'responses' => [
                        '200' => [
                            'description' => 'Árbol de selección',
                            'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/CatalogGranjasCampaniasGalpones']]],
                        ],
                        '401' => ['description' => 'Sin sesión'],
                    ],
                ],
            ],
            '/modules/sip/graficas/get_sip_grafica_data.php' => [
                'get' => [
                    'tags' => ['Datos'],
                    'summary' => 'Datos de gráfica',
                    'operationId' => 'getGraficaData',
                    'parameters' => [
                        ['name' => 'tipo', 'in' => 'query', 'required' => true, 'schema' => ['type' => 'string', 'enum' => ['mortalidad', 'consumo_alimento', 'consumo_gas', 'consumo_agua', 'pesaje_pollo', 'ganancia_peso', 'cv_peso', 'cv_ganancia', 'nivel_cloro', 'respiratorio', 'digestivo']], 'example' => 'mortalidad'],
                        ['name' => 'granja', 'in' => 'query', 'required' => true, 'schema' => ['type' => 'string'], 'example' => '601'],
                        ['name' => 'campania', 'in' => 'query', 'required' => true, 'schema' => ['type' => 'string'], 'example' => '001'],
                        ['name' => 'galpon', 'in' => 'query', 'schema' => ['type' => 'string'], 'description' => 'Obligatorio salvo mortalidad con seccion=causas o pareto', 'example' => '1'],
                        ['name' => 'seccion', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['linea', 'causas', 'pareto', 'all'], 'default' => 'linea'], 'description' => 'Solo aplica a tipo=mortalidad; ignorado en el resto'],
                    ],
                    'responses' => [
                        '200' => [
                            'description' => 'JSON para Chart.js',
                            'content' => ['application/json' => ['schema' => ['oneOf' => [
                                ['$ref' => '#/components/schemas/MortalidadLinea'],
                                ['$ref' => '#/components/schemas/MortalidadCausas'],
                                ['$ref' => '#/components/schemas/MortalidadPareto'],
                                ['$ref' => '#/components/schemas/MortalidadAll'],
                                ['$ref' => '#/components/schemas/RespiratorioLinea'],
                                ['$ref' => '#/components/schemas/DigestivoLinea'],
                            ]]]],
                        ],
                        '400' => ['description' => 'Parámetros faltantes'],
                        '401' => ['description' => 'Sin sesión'],
                    ],
                ],
            ],
            '/modules/sip/graficas/get_sip_grafica_pesaje_dias.php' => [
                'get' => [
                    'tags' => ['Catálogo'],
                    'summary' => 'Días canónicos de pesaje/ganancia (horizontal)',
                    'description' => 'Lista fija de días según tipo: pesaje_pollo (incluye día 1); cv_peso, ganancia_peso y cv_ganancia (sin día 1). Cada ítem incluye `semana` cuando aplica. Usar `dia` al consultar el acumulado.',
                    'operationId' => 'getGraficaPesajeDias',
                    'parameters' => [
                        ['name' => 'tipo', 'in' => 'query', 'required' => false, 'schema' => ['type' => 'string', 'enum' => ['pesaje_pollo', 'cv_peso', 'ganancia_peso', 'cv_ganancia'], 'default' => 'pesaje_pollo'], 'example' => 'pesaje_pollo', 'description' => 'Tipo de gráfica que define qué días devolver'],
                    ],
                    'responses' => [
                        '200' => [
                            'description' => 'Lista canónica de días con semana opcional',
                            'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/PesajeDiasList']]],
                        ],
                        '400' => ['description' => 'Tipo inválido'],
                        '401' => ['description' => 'Sin sesión'],
                    ],
                ],
            ],
            '/modules/sip/graficas/get_sip_grafica_acumulado_semanal.php' => [
                'get' => [
                    'tags' => ['Datos'],
                    'summary' => 'Acumulado semanal por granja/galpón en un periodo',
                    'description' => 'Devuelve el valor acumulado de la semana solicitada para todas las granjas/galpones cuyo lote solapa el periodo. Pesaje, ganancia y CV de peso: muestreoaves por `dia` (API). CV de ganancia: muestreoaves por `semana`. Sin cabecera en san_fact se usan fechas live desde movi_zonas.',
                    'operationId' => 'getGraficaAcumuladoSemanal',
                    'parameters' => [
                        ['name' => 'tipo', 'in' => 'query', 'required' => true, 'schema' => ['type' => 'string', 'enum' => ['mortalidad', 'consumo_alimento', 'consumo_gas', 'consumo_agua', 'pesaje_pollo', 'ganancia_peso', 'cv_peso', 'cv_ganancia', 'nivel_cloro']], 'example' => 'mortalidad'],
                        ['name' => 'fechaInicio', 'in' => 'query', 'required' => true, 'schema' => ['type' => 'string', 'format' => 'date'], 'example' => '2026-01-01', 'description' => 'Inicio del periodo (YYYY-MM-DD)'],
                        ['name' => 'fechaFin', 'in' => 'query', 'required' => true, 'schema' => ['type' => 'string', 'format' => 'date'], 'example' => '2026-12-31', 'description' => 'Fin del periodo (YYYY-MM-DD)'],
                        ['name' => 'semana', 'in' => 'query', 'required' => false, 'schema' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 10], 'example' => 1, 'description' => 'Semana acumulada (obligatorio salvo pesaje_pollo, ganancia_peso, cv_peso y cv_ganancia).'],
                        ['name' => 'dia', 'in' => 'query', 'required' => false, 'schema' => ['type' => 'integer', 'enum' => [1, 8, 15, 22, 36, 38, 41, 43]], 'example' => 8, 'description' => 'Día de pesaje/ganancia/CV (pesaje_pollo, ganancia_peso, cv_peso, cv_ganancia). Ver get_sip_grafica_pesaje_dias.php?tipo=.... Default: 1.'],
                    ],
                    'responses' => [
                        '200' => [
                            'description' => 'Acumulado semanal de todas las combinaciones',
                            'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/AcumuladoSemanal']]],
                        ],
                        '400' => ['description' => 'Parámetros faltantes o inválidos'],
                        '401' => ['description' => 'Sin sesión'],
                    ],
                ],
            ],
        ];
    }
}

if (!function_exists('sip_grafica_openapi_build')) {
    /**
     * @return array<string,mixed>
     */
    function sip_grafica_openapi_build(?mysqli $conn = null): array
    {
        $spec = [
            'openapi' => '3.0.3',
            'info' => [
                'title' => sip_grafica_openapi_app_title(),
                'description' => implode("\n", [
                    'API HTTP para gráficas SIP y catálogo de selectores (endpoints separados).',
                    'Requiere sesión PHP activa (`PHPSESSID`) tras login.',
                    '',
                    '**Flujo recomendado:**',
                    '1. `GET get_sip_grafica_tipos.php`',
                    '2. `GET get_sip_granjas_campanias_galpones.php?fechaInicio=…&fechaFin=…`',
                    '3. `GET get_sip_grafica_data.php?tipo=mortalidad&…`',
                ]),
                'version' => '1.4.0',
            ],
            'servers' => [
                ['url' => sip_grafica_openapi_server_url(), 'description' => 'Servidor actual'],
            ],
            'tags' => [
                ['name' => 'Catálogo', 'description' => 'Tipos, granjas, campañas y galpones'],
                ['name' => 'Datos', 'description' => 'JSON listo para Chart.js'],
            ],
            'paths' => sip_grafica_openapi_paths(),
            'components' => [
                'schemas' => sip_grafica_openapi_schemas(),
            ],
        ];

        if ($conn instanceof mysqli) {
            $spec = sip_grafica_openapi_enrich_from_db($spec, $conn);
        }

        return $spec;
    }
}

if (!function_exists('sip_grafica_openapi_schemas')) {
    /**
     * @return array<string,mixed>
     */
    function sip_grafica_openapi_schemas(): array
    {
        return [
            'CatalogTipoItem' => [
                'type' => 'object',
                'properties' => [
                    'id' => ['type' => 'string', 'example' => 'mortalidad'],
                    'label' => ['type' => 'string'],
                    'chartType' => [
                        'type' => 'string',
                        'enum' => ['line', 'bar'],
                        'description' => 'Tipo Chart.js cuando el tipo tiene una sola vista',
                    ],
                    'barMode' => [
                        'type' => 'string',
                        'enum' => ['grouped', 'stacked'],
                        'description' => 'Solo si chartType=bar: grouped (barras separadas) o stacked (apiladas)',
                    ],
                    'secciones' => [
                        'type' => 'array',
                        'description' => 'Solo mortalidad: vistas alternativas del mismo tipo',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'id' => ['type' => 'string', 'description' => 'Vista (linea, causas, pareto, all)'],
                                'label' => ['type' => 'string'],
                                'chartType' => [
                                    'type' => 'string',
                                    'enum' => ['line', 'bar'],
                                ],
                                'barMode' => [
                                    'type' => 'string',
                                    'enum' => ['grouped', 'stacked'],
                                    'description' => 'Solo si chartType=bar',
                                ],
                            ],
                        ],
                    ],
                ],
            ],
            'CatalogTiposGrafica' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean'],
                    'data' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/CatalogTipoItem']],
                ],
            ],
            'CatalogTipos' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean'],
                    'data' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/CatalogTipoItem']],
                ],
            ],
            'CatalogGranjaItem' => [
                'type' => 'object',
                'properties' => [
                    'granja' => ['type' => 'string'],
                    'nombre' => ['type' => 'string'],
                    'zona' => ['type' => 'string'],
                    'subzona' => ['type' => 'string'],
                ],
            ],
            'CatalogGranjas' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean'],
                    'data' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/CatalogGranjaItem']],
                ],
            ],
            'CatalogZonas' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean'],
                    'data' => ['type' => 'array', 'items' => ['type' => 'string']],
                ],
            ],
            'CatalogGranjaItem' => [
                'type' => 'object',
                'properties' => [
                    'granja' => ['type' => 'string'],
                    'nombre' => ['type' => 'string'],
                    'zona' => ['type' => 'string'],
                    'subzona' => ['type' => 'string'],
                    'campanias' => ['type' => 'array', 'items' => ['type' => 'string'], 'example' => ['190', '191']],
                    'galpones' => ['type' => 'array', 'items' => ['type' => 'string'], 'example' => ['1', '2']],
                ],
            ],
            'PeriodoRango' => [
                'type' => 'object',
                'properties' => [
                    'desde' => ['type' => 'string', 'format' => 'date'],
                    'hasta' => ['type' => 'string', 'format' => 'date'],
                ],
            ],
            'CatalogGranjasCampaniasGalpones' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean'],
                    'periodo' => ['$ref' => '#/components/schemas/PeriodoRango', 'nullable' => true],
                    'granjas' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/CatalogGranjaItem']],
                    'message' => ['type' => 'string'],
                ],
            ],
            'MortalidadLineaDia' => [
                'type' => 'object',
                'properties' => [
                    'dia' => ['type' => 'integer'],
                    'fecha' => ['type' => 'string', 'format' => 'date', 'nullable' => true],
                    'estandar' => ['type' => 'object', 'properties' => [
                        'min' => ['type' => 'number', 'nullable' => true],
                        'max' => ['type' => 'number', 'nullable' => true],
                    ]],
                    'macho' => ['$ref' => '#/components/schemas/MortalidadSexoValor'],
                    'hembra' => ['$ref' => '#/components/schemas/MortalidadSexoValor'],
                ],
            ],
            'MortalidadSexoValor' => [
                'type' => 'object',
                'properties' => [
                    'valor' => ['type' => 'number', 'nullable' => true],
                    'cumple' => ['type' => 'boolean', 'nullable' => true],
                ],
            ],
            'MortalidadLinea' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean'],
                    'dataPorDia' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/MortalidadLineaDia']],
                    'unidad' => ['type' => 'string', 'example' => '%'],
                    'esMh' => ['type' => 'boolean'],
                    'modoEvaluacion' => ['type' => 'string'],
                    'tareaKey' => ['type' => 'string'],
                ],
            ],
            'MortalidadCausaItem' => [
                'type' => 'object',
                'properties' => [
                    'codigo' => ['type' => 'integer'],
                    'nombre' => ['type' => 'string'],
                    'total' => ['type' => 'integer'],
                ],
            ],
            'MortalidadCausasDia' => [
                'type' => 'object',
                'properties' => [
                    'fecha' => ['type' => 'string', 'format' => 'date'],
                    'dia' => ['type' => 'integer', 'nullable' => true],
                    'total' => ['type' => 'integer'],
                    'causas' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/MortalidadCausaItem']],
                ],
            ],
            'MortalidadCausas' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean'],
                    'porFecha' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/MortalidadCausasDia']],
                ],
            ],
            'MortalidadPareto' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean'],
                    'total' => ['type' => 'integer'],
                    'items' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => [
                        'codigo' => ['type' => 'integer'],
                        'nombre' => ['type' => 'string'],
                        'total' => ['type' => 'integer'],
                        'pct' => ['type' => 'number'],
                        'pctAcum' => ['type' => 'number'],
                    ]]],
                ],
            ],
            'MortalidadAll' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean'],
                    'linea' => ['$ref' => '#/components/schemas/MortalidadLinea'],
                    'causas' => ['$ref' => '#/components/schemas/MortalidadCausas'],
                    'pareto' => ['$ref' => '#/components/schemas/MortalidadPareto'],
                ],
            ],
            'RespiratorioSexoValor' => [
                'type' => 'object',
                'properties' => [
                    'valor' => ['type' => 'number', 'nullable' => true],
                ],
            ],
            'RespiratorioMetricaDia' => [
                'type' => 'object',
                'properties' => [
                    'macho' => ['$ref' => '#/components/schemas/RespiratorioSexoValor'],
                    'hembra' => ['$ref' => '#/components/schemas/RespiratorioSexoValor'],
                ],
            ],
            'RespiratorioLineaDia' => [
                'type' => 'object',
                'properties' => [
                    'dia' => ['type' => 'integer'],
                    'fecha' => ['type' => 'string', 'format' => 'date', 'nullable' => true],
                    'estornudo' => ['$ref' => '#/components/schemas/RespiratorioMetricaDia'],
                    'ronquera' => ['$ref' => '#/components/schemas/RespiratorioMetricaDia'],
                ],
            ],
            'RespiratorioLinea' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean'],
                    'tipo' => ['type' => 'string', 'example' => 'respiratorio'],
                    'nombre' => ['type' => 'string'],
                    'metricas' => ['type' => 'array', 'items' => ['type' => 'string'], 'example' => ['estornudo', 'ronquera']],
                    'dataPorDia' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/RespiratorioLineaDia']],
                    'unidad' => ['type' => 'string'],
                    'esMh' => ['type' => 'boolean'],
                    'tareaKey' => ['type' => 'string'],
                ],
            ],
            'DigestivoSlotDia' => [
                'type' => 'object',
                'properties' => [
                    'valor' => ['type' => 'number', 'nullable' => true],
                ],
            ],
            'DigestivoLineaDia' => [
                'type' => 'object',
                'properties' => [
                    'dia' => ['type' => 'integer'],
                    'fecha' => ['type' => 'string', 'format' => 'date', 'nullable' => true],
                    'A' => ['$ref' => '#/components/schemas/DigestivoSlotDia'],
                    'P' => ['$ref' => '#/components/schemas/DigestivoSlotDia'],
                    'S' => ['$ref' => '#/components/schemas/DigestivoSlotDia'],
                    'R' => ['$ref' => '#/components/schemas/DigestivoSlotDia'],
                ],
            ],
            'DigestivoLinea' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean'],
                    'tipo' => ['type' => 'string', 'example' => 'digestivo'],
                    'nombre' => ['type' => 'string'],
                    'metricas' => ['type' => 'array', 'items' => ['type' => 'string'], 'example' => ['A', 'P', 'S', 'R']],
                    'dataPorDia' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/DigestivoLineaDia']],
                    'unidad' => ['type' => 'string'],
                    'esMh' => ['type' => 'boolean'],
                    'tareaKey' => ['type' => 'string'],
                ],
            ],
            'AcumuladoSemanalRegistro' => [
                'type' => 'object',
                'properties' => [
                    'granja' => ['type' => 'string', 'description' => 'Código numérico de granja'],
                    'granjaNombre' => ['type' => 'string', 'description' => 'Abreviatura de la granja (ej: GL II)'],
                    'campania' => ['type' => 'string'],
                    'galpon' => ['type' => 'string'],
                    'fechaCarga' => ['type' => 'string', 'format' => 'date', 'nullable' => true, 'description' => 'Fecha de carga de pollo (solo orden)'],
                    'fechaSemana' => ['type' => 'string', 'format' => 'date', 'nullable' => true, 'description' => 'Fecha real de la semana solicitada'],
                    'valorM' => ['type' => 'number', 'nullable' => true],
                    'valorH' => ['type' => 'number', 'nullable' => true],
                    'estandarM' => ['type' => 'number', 'nullable' => true, 'description' => 'Estándar acumulado macho hasta la semana solicitada'],
                    'estandarH' => ['type' => 'number', 'nullable' => true, 'description' => 'Estándar acumulado hembra hasta la semana solicitada'],
                    'dia' => ['type' => 'integer', 'nullable' => true, 'description' => 'Día de pesaje/ganancia consultado'],
                    'semana' => ['type' => 'integer', 'nullable' => true, 'description' => 'Semana de negocio asociada al día (null si no aplica)'],
                ],
            ],
            'PesajeDiaCatalogo' => [
                'type' => 'object',
                'properties' => [
                    'dia' => ['type' => 'integer', 'example' => 8],
                    'semana' => ['type' => 'integer', 'nullable' => true, 'example' => 1, 'description' => 'Semana de ganancia asociada; null en días 1, 38 y 41'],
                ],
            ],
            'PesajeDiasList' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean'],
                    'tipo' => ['type' => 'string', 'example' => 'pesaje_pollo'],
                    'dias' => [
                        'type' => 'array',
                        'items' => ['$ref' => '#/components/schemas/PesajeDiaCatalogo'],
                        'example' => [
                            ['dia' => 1, 'semana' => null],
                            ['dia' => 8, 'semana' => 1],
                            ['dia' => 15, 'semana' => 2],
                        ],
                    ],
                    'message' => ['type' => 'string'],
                ],
            ],
            'AcumuladoSemanal' => [
                'type' => 'object',
                'properties' => [
                    'success' => ['type' => 'boolean'],
                    'tipo' => ['type' => 'string'],
                    'nombre' => ['type' => 'string'],
                    'semana' => ['type' => 'integer', 'nullable' => true, 'description' => 'Semana de negocio del día consultado (null si no aplica) o semana acumulada'],
                    'dia' => ['type' => 'integer', 'nullable' => true, 'description' => 'Día consultado (pesaje_pollo, ganancia_peso, cv_peso, cv_ganancia)'],
                    'periodo' => ['$ref' => '#/components/schemas/PeriodoRango'],
                    'unidad' => ['type' => 'string'],
                    'totalRegistros' => ['type' => 'integer'],
                    'registros' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/AcumuladoSemanalRegistro']],
                    'message' => ['type' => 'string'],
                ],
            ],
        ];
    }
}

if (!function_exists('sip_grafica_openapi_is_list')) {
    /**
     * @param array<int|string,mixed> $a
     */
    function sip_grafica_openapi_is_list(array $a): bool
    {
        if ($a === []) {
            return true;
        }
        $i = 0;
        foreach ($a as $k => $unused) {
            if ($k !== $i) {
                return false;
            }
            $i++;
        }

        return true;
    }
}

if (!function_exists('sip_grafica_openapi_to_yaml')) {
    /**
     * @param array<string,mixed> $spec
     */
    function sip_grafica_openapi_to_yaml(array $spec, int $indent = 0): string
    {
        $pad = str_repeat('  ', $indent);
        $out = '';

        foreach ($spec as $key => $value) {
            if (is_int($key)) {
                if (is_array($value)) {
                    $out .= $pad . "-\n" . sip_grafica_openapi_to_yaml($value, $indent + 1);
                } else {
                    $out .= $pad . '- ' . sip_grafica_openapi_yaml_scalar($value) . "\n";
                }
                continue;
            }

            if (is_array($value)) {
                if ($value === []) {
                    $out .= $pad . $key . ": []\n";
                } elseif (sip_grafica_openapi_is_list($value) && !is_array($value[0] ?? null)) {
                    $out .= $pad . $key . ":\n";
                    foreach ($value as $item) {
                        $out .= $pad . '  - ' . sip_grafica_openapi_yaml_scalar($item) . "\n";
                    }
                } else {
                    $out .= $pad . $key . ":\n" . sip_grafica_openapi_to_yaml($value, $indent + 1);
                }
            } else {
                $out .= $pad . $key . ': ' . sip_grafica_openapi_yaml_scalar($value) . "\n";
            }
        }

        return $out;
    }
}

if (!function_exists('sip_grafica_openapi_yaml_scalar')) {
    /**
     * @param mixed $value
     */
    function sip_grafica_openapi_yaml_scalar($value): string
    {
        if ($value === null) {
            return 'null';
        }
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }
        $s = (string) $value;
        if ($s === '' || preg_match('/[:#\\[\\]{}&,*?|\\-<>=!%@`]/', $s) || preg_match('/^(true|false|null)$/i', $s)) {
            return '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $s) . '"';
        }

        return $s;
    }
}
