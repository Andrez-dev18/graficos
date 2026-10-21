<?php

class AQPEmpresaHandler
{
    private static $meses = [
        1 => 'Enero',
        2 => 'Febrero',
        3 => 'Marzo',
        4 => 'Abril',
        5 => 'Mayo',
        6 => 'Junio',
        7 => 'Julio',
        8 => 'Agosto',
        9 => 'Septiembre',
        10 => 'Octubre',
        11 => 'Noviembre',
        12 => 'Diciembre'
    ];

    private static function medidas(): array
    {
        $pesoProm = "(
            SUM(
                CASE WHEN a.pesoMachoMax > 0 THEN a.pesoMachoMax ELSE 0 END
                +
                CASE WHEN a.pesoHembMax > 0 THEN a.pesoHembMax ELSE 0 END
            )
            /
            NULLIF(
                SUM(
                    CASE WHEN a.pesoMachoMax > 0 THEN 1 ELSE 0 END
                    +
                    CASE WHEN a.pesoHembMax > 0 THEN 1 ELSE 0 END
                ),
                0
            )
        )";

        $precioProm = "(
            SUM(
                CASE WHEN a.precioPubMax > 0 THEN a.precioPubMax ELSE 0 END
                +
                CASE WHEN a.precioPubMin > 0 THEN a.precioPubMin ELSE 0 END
            )
            /
            NULLIF(
                SUM(
                    CASE WHEN a.precioPubMax > 0 THEN 1 ELSE 0 END
                    +
                    CASE WHEN a.precioPubMin > 0 THEN 1 ELSE 0 END
                ),
                0
            )
        )";

        return [
            'AQPCantEmpresa' => [
                'titulo' => 'Comportamiento Cantidad de Aves AREQUIPA',
                'etiqueta_metrica' => 'cantidad',
                'etiqueta_eje' => 'cantidad',
                'unidad' => 'Und',
                'decimales' => 0,
                'tipo_formato' => 'numero',
                'compacto_eje' => true,
                'expresion' => 'SUM(a.cantidad)'
            ],
            'AQPPesoEmpresa' => [
                'titulo' => 'Comportamiento del Peso Promedio de Aves AREQUIPA',
                'etiqueta_metrica' => 'peso promedio',
                'etiqueta_eje' => 'PesoProm',
                'unidad' => 'Kg',
                'decimales' => 3,
                'tipo_formato' => 'numero',
                'compacto_eje' => false,
                'expresion' => $pesoProm
            ],
            'AQPKilosEmpresa' => [
                'titulo' => 'Comportamiento de los Kilogramos de Aves AREQUIPA',
                'etiqueta_metrica' => 'kilos',
                'etiqueta_eje' => 'Kilos',
                'unidad' => 'Kg',
                'decimales' => 2,
                'tipo_formato' => 'numero',
                'compacto_eje' => true,
                'expresion' => "({$pesoProm}) * SUM(a.cantidad)"
            ],
            'AQPSolesEmpresa' => [
                'titulo' => 'Comportamiento del Consumo de pollo en Soles AREQUIPA',
                'etiqueta_metrica' => 'soles',
                'etiqueta_eje' => 'Soles',
                'unidad' => 'S/',
                'decimales' => 2,
                'tipo_formato' => 'moneda',
                'compacto_eje' => true,
                'expresion' => "({$pesoProm}) * SUM(a.cantidad) * ({$precioProm})"
            ],
            'AQPPrecioEmpresa' => [
                'titulo' => 'Comportamiento del Precio Promedio de Aves AREQUIPA',
                'etiqueta_metrica' => 'precio promedio',
                'etiqueta_eje' => 'PrecioProm',
                'unidad' => 'S/',
                'decimales' => 2,
                'tipo_formato' => 'moneda',
                'compacto_eje' => false,
                'expresion' => $precioProm
            ]
        ];
    }

    private static function configuracion(string $tipoGrafico): array
    {
        $medidas = self::medidas();
        return $medidas[$tipoGrafico] ?? $medidas['AQPCantEmpresa'];
    }

    private static function rangoAnio(string $anio): array
    {
        return [
            $anio . '-01-01',
            ((int)$anio + 1) . '-01-01'
        ];
    }

    private static function nombreMes(int $mes): string
    {
        return self::$meses[$mes] ?? '';
    }

    private static function normalizarMeses($valor, array $disponibles): array
    {
        if ($valor === null) {
            return array_values(array_map(function ($item) {
                return (int)$item['mes'];
            }, $disponibles));
        }

        if (is_string($valor)) {
            $valor = explode(',', $valor);
        }

        if (!is_array($valor)) {
            return [];
        }

        $meses = [];
        foreach ($valor as $item) {
            $mes = (int)$item;
            if ($mes >= 1 && $mes <= 12) {
                $meses[$mes] = $mes;
            }
        }

        $meses = array_values($meses);
        sort($meses);

        return $meses;
    }

    private static function normalizarEmpresas($valor, array $disponibles): array
    {
        if ($valor === null) {
            return array_values(array_map(function ($item) {
                return (string)$item['id'];
            }, $disponibles));
        }

        if (is_string($valor)) {
            $valor = explode(',', $valor);
        }

        if (!is_array($valor)) {
            return [];
        }

        $empresas = [];
        foreach ($valor as $item) {
            $nombre = trim((string)$item);
            if ($nombre !== '') {
                $empresas[$nombre] = $nombre;
            }
        }

        return array_values($empresas);
    }

    public static function obtenerFiltros(PDO $db, string $anio = '2026'): array
    {
        [$fechaInicio, $fechaFin] = self::rangoAnio($anio);

        $sqlMeses = "
            SELECT DISTINCT MONTH(a.fecha) AS mes
            FROM com_db_vivo_aqp a
            INNER JOIN com_mercado m   ON a.mercado   = m.codigo
            INNER JOIN com_empresa e   ON a.empresa   = e.codigo
            INNER JOIN com_condicion c ON a.condicion = c.codigo
            INNER JOIN com_proveedor p ON a.proveedor = p.codigo
            WHERE a.fecha >= ?
              AND a.fecha < ?
            ORDER BY mes ASC
        ";

        $stmtMeses = $db->prepare($sqlMeses);
        $stmtMeses->execute([$fechaInicio, $fechaFin]);
        $filasMeses = $stmtMeses->fetchAll(PDO::FETCH_ASSOC);

        $meses = [];
        foreach ($filasMeses as $fila) {
            $mes = (int)($fila['mes'] ?? 0);
            if ($mes >= 1 && $mes <= 12) {
                $meses[] = [
                    'id' => (string)$mes,
                    'mes' => $mes,
                    'label' => self::nombreMes($mes)
                ];
            }
        }

        $sqlEmpresas = "
            SELECT DISTINCT TRIM(e.nombre) AS nombre
            FROM com_db_vivo_aqp a
            INNER JOIN com_mercado m   ON a.mercado   = m.codigo
            INNER JOIN com_empresa e   ON a.empresa   = e.codigo
            INNER JOIN com_condicion c ON a.condicion = c.codigo
            INNER JOIN com_proveedor p ON a.proveedor = p.codigo
            WHERE a.fecha >= ?
              AND a.fecha < ?
              AND e.nombre IS NOT NULL
              AND TRIM(e.nombre) <> ''
            ORDER BY nombre ASC
        ";

        $stmtEmpresas = $db->prepare($sqlEmpresas);
        $stmtEmpresas->execute([$fechaInicio, $fechaFin]);
        $filasEmpresas = $stmtEmpresas->fetchAll(PDO::FETCH_ASSOC);

        $empresas = [];
        foreach ($filasEmpresas as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $empresas[] = [
                    'id' => $nombre,
                    'label' => $nombre
                ];
            }
        }

        return [
            'anio' => $anio,
            'meses' => $meses,
            'empresas' => $empresas
        ];
    }

    public static function handle(PDO $db, array $filtros, string $anio = '2026'): array
    {
        $tipoGrafico = trim((string)($filtros['tipo_grafico'] ?? 'AQPCantEmpresa'));
        $config = self::configuracion($tipoGrafico);

        if (!array_key_exists($tipoGrafico, self::medidas())) {
            $tipoGrafico = 'AQPCantEmpresa';
        }

        [$fechaInicio, $fechaFin] = self::rangoAnio($anio);

        $opciones = self::obtenerFiltros($db, $anio);
        $meses = self::normalizarMeses(
            array_key_exists('meses', $filtros) ? $filtros['meses'] : null,
            $opciones['meses']
        );
        $empresas = self::normalizarEmpresas(
            array_key_exists('empresas', $filtros) ? $filtros['empresas'] : null,
            $opciones['empresas']
        );

        $dias = range(1, 31);
        $series = [];

        $respuestaBase = [
            'tipo_grafico' => $tipoGrafico,
            'titulo' => $config['titulo'],
            'etiqueta_metrica' => $config['etiqueta_metrica'],
            'etiqueta_eje' => $config['etiqueta_eje'],
            'unidad' => $config['unidad'],
            'decimales' => $config['decimales'],
            'tipo_formato' => $config['tipo_formato'],
            'compacto_eje' => $config['compacto_eje'],
            'anio' => $anio,
            'dias' => $dias,
            'series' => [],
            'promedio' => null
        ];

        if (empty($meses) || empty($empresas)) {
            foreach ($meses as $mes) {
                $series[] = [
                    'mes' => $mes,
                    'label' => self::nombreMes($mes),
                    'valores' => array_fill(0, 31, null)
                ];
            }

            $respuestaBase['series'] = $series;
            return $respuestaBase;
        }

        $placeholdersMeses = implode(',', array_fill(0, count($meses), '?'));
        $placeholdersEmpresas = implode(',', array_fill(0, count($empresas), '?'));

        $sql = "
            SELECT
                MONTH(a.fecha) AS mes,
                DAY(a.fecha) AS dia,
                {$config['expresion']} AS valor
            FROM com_db_vivo_aqp a
            INNER JOIN com_mercado m   ON a.mercado   = m.codigo
            INNER JOIN com_empresa e   ON a.empresa   = e.codigo
            INNER JOIN com_condicion c ON a.condicion = c.codigo
            INNER JOIN com_proveedor p ON a.proveedor = p.codigo
            WHERE a.fecha >= ?
              AND a.fecha < ?
              AND MONTH(a.fecha) IN ($placeholdersMeses)
              AND TRIM(e.nombre) IN ($placeholdersEmpresas)
            GROUP BY MONTH(a.fecha), DAY(a.fecha)
            ORDER BY mes ASC, dia ASC
        ";

        $params = array_merge([$fechaInicio, $fechaFin], $meses, $empresas);
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $porMes = [];
        foreach ($filas as $fila) {
            $mes = (int)($fila['mes'] ?? 0);
            $dia = (int)($fila['dia'] ?? 0);

            if ($mes < 1 || $mes > 12 || $dia < 1 || $dia > 31) {
                continue;
            }

            if (!isset($porMes[$mes])) {
                $porMes[$mes] = array_fill(1, 31, null);
            }

            $valor = $fila['valor'];
            $porMes[$mes][$dia] = ($valor === null) ? null : round((float)$valor, 6);
        }

        $sumaTotal = 0.0;
        $conteoTotal = 0;

        foreach ($meses as $mes) {
            $valores = isset($porMes[$mes])
                ? array_values($porMes[$mes])
                : array_fill(0, 31, null);

            foreach ($valores as $valor) {
                if ($valor !== null) {
                    $sumaTotal += $valor;
                    $conteoTotal++;
                }
            }

            $series[] = [
                'mes' => $mes,
                'label' => self::nombreMes($mes),
                'valores' => $valores
            ];
        }

        $respuestaBase['series'] = $series;
        $respuestaBase['promedio'] = $conteoTotal > 0 ? round($sumaTotal / $conteoTotal, 6) : null;

        return $respuestaBase;
    }
}
