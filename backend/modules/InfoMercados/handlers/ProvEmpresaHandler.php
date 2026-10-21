<?php

require_once __DIR__ . '/EmpresaChartHelper.php';

class ProvEmpresaHandler
{
    private static function medidas(): array
    {
        $pesoProm = "(
            SUM(
                CASE
                    WHEN a.pesoMachoPromMax > 0 OR a.pesoMachoPromMin > 0 THEN
                        CASE
                            WHEN a.pesoMachoPromMax > 0 AND a.pesoMachoPromMin > 0 THEN
                                (a.pesoMachoPromMax + a.pesoMachoPromMin) / 2
                            WHEN a.pesoMachoPromMax > 0 THEN a.pesoMachoPromMax
                            WHEN a.pesoMachoPromMin > 0 THEN a.pesoMachoPromMin
                            ELSE 0
                        END
                    ELSE 0
                END
                +
                CASE
                    WHEN a.pesoHembraPromMax > 0 OR a.pesoHembraPromMin > 0 THEN
                        CASE
                            WHEN a.pesoHembraPromMax > 0 AND a.pesoHembraPromMin > 0 THEN
                                (a.pesoHembraPromMax + a.pesoHembraPromMin) / 2
                            WHEN a.pesoHembraPromMax > 0 THEN a.pesoHembraPromMax
                            WHEN a.pesoHembraPromMin > 0 THEN a.pesoHembraPromMin
                            ELSE 0
                        END
                    ELSE 0
                END
            )
            /
            NULLIF(
                SUM(
                    CASE WHEN a.pesoMachoPromMax > 0 OR a.pesoMachoPromMin > 0 THEN 1 ELSE 0 END
                    +
                    CASE WHEN a.pesoHembraPromMax > 0 OR a.pesoHembraPromMin > 0 THEN 1 ELSE 0 END
                ),
                0
            )
        )";

        $precioProm = "(
            AVG(
                CASE
                    WHEN a.precioPubMax > 0 AND a.precioPubMin > 0 THEN
                        (a.precioPubMax + a.precioPubMin) / 2
                    WHEN a.precioPubMax > 0 THEN a.precioPubMax
                    WHEN a.precioPubMin > 0 THEN a.precioPubMin
                    ELSE NULL
                END
            )
        )";

        return [
            'PROVCantEmpresa' => [
                'titulo' => 'Comportamiento Cantidad de Aves PROVINCIAS',
                'etiqueta_metrica' => 'cantidad',
                'etiqueta_eje' => 'cantidad',
                'unidad' => 'Und',
                'decimales' => 0,
                'tipo_formato' => 'numero',
                'compacto_eje' => true,
                'expresion' => 'SUM(a.cantidad)'
            ],
            'PROVPesoEmpresa' => [
                'titulo' => 'Comportamiento del Peso Promedio de Aves PROVINCIAS',
                'etiqueta_metrica' => 'peso promedio',
                'etiqueta_eje' => 'PesoProm',
                'unidad' => 'Kg',
                'decimales' => 3,
                'tipo_formato' => 'numero',
                'compacto_eje' => false,
                'expresion' => $pesoProm
            ],
            'PROVKilosEmpresa' => [
                'titulo' => 'Comportamiento de los Kilogramos de Aves PROVINCIAS',
                'etiqueta_metrica' => 'kilos',
                'etiqueta_eje' => 'Kilos',
                'unidad' => 'Kg',
                'decimales' => 2,
                'tipo_formato' => 'numero',
                'compacto_eje' => true,
                'expresion' => "({$pesoProm}) * SUM(a.cantidad)"
            ],
            'PROVSolesEmpresa' => [
                'titulo' => 'Comportamiento del Consumo de pollo en Soles PROVINCIAS',
                'etiqueta_metrica' => 'soles',
                'etiqueta_eje' => 'Soles',
                'unidad' => 'S/',
                'decimales' => 2,
                'tipo_formato' => 'moneda',
                'compacto_eje' => true,
                'expresion' => "({$pesoProm}) * SUM(a.cantidad) * ({$precioProm})"
            ],
            'PROVPrecioEmpresa' => [
                'titulo' => 'Comportamiento del Precio Promedio de Aves PROVINCIAS',
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
        return $medidas[$tipoGrafico] ?? $medidas['PROVCantEmpresa'];
    }

    public static function obtenerFiltros(PDO $db, string $anio = '2026'): array
    {
        [$fechaInicio, $fechaFin] = EmpresaChartHelper::rangoAnio($anio);

        $sqlProvincias = "
            SELECT DISTINCT TRIM(pr.nombre) AS nombre
            FROM com_db_vivo_provincia a
            INNER JOIN com_proveedor p ON a.proveedor = p.codigo
            INNER JOIN com_provincia pr ON a.provincia = pr.codigo
            INNER JOIN com_tipo t ON a.tipo = t.codigo
            WHERE a.fecha >= ?
              AND a.fecha < ?
              AND TRIM(t.nombre) = 'Vivo'
              AND pr.nombre IS NOT NULL
              AND TRIM(pr.nombre) <> ''
            ORDER BY nombre ASC
        ";

        $stmtProvincias = $db->prepare($sqlProvincias);
        $stmtProvincias->execute([$fechaInicio, $fechaFin]);
        $filasProvincias = $stmtProvincias->fetchAll(PDO::FETCH_ASSOC);

        $provincias = [];
        foreach ($filasProvincias as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $provincias[] = [
                    'id' => $nombre,
                    'label' => $nombre
                ];
            }
        }

        $sqlProveedores = "
            SELECT DISTINCT TRIM(p.nombre) AS nombre
            FROM com_db_vivo_provincia a
            INNER JOIN com_proveedor p ON a.proveedor = p.codigo
            INNER JOIN com_provincia pr ON a.provincia = pr.codigo
            INNER JOIN com_tipo t ON a.tipo = t.codigo
            WHERE a.fecha >= ?
              AND a.fecha < ?
              AND TRIM(t.nombre) = 'Vivo'
              AND p.nombre IS NOT NULL
              AND TRIM(p.nombre) <> ''
            ORDER BY nombre ASC
        ";

        $stmtProveedores = $db->prepare($sqlProveedores);
        $stmtProveedores->execute([$fechaInicio, $fechaFin]);
        $filasProveedores = $stmtProveedores->fetchAll(PDO::FETCH_ASSOC);

        $proveedores = [];
        foreach ($filasProveedores as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $proveedores[] = [
                    'id' => $nombre,
                    'label' => $nombre
                ];
            }
        }

        return [
            'anio' => $anio,
            'provincias' => $provincias,
            'proveedores' => $proveedores
        ];
    }

    public static function handle(PDO $db, array $filtros, string $anio = '2026'): array
    {
        $tipoGrafico = trim((string)($filtros['tipo_grafico'] ?? 'PROVCantEmpresa'));
        $config = self::configuracion($tipoGrafico);

        if (!array_key_exists($tipoGrafico, self::medidas())) {
            $tipoGrafico = 'PROVCantEmpresa';
        }

        $opciones = self::obtenerFiltros($db, $anio);
        $provincias = EmpresaChartHelper::normalizarNombres(
            array_key_exists('provincias', $filtros) ? $filtros['provincias'] : null,
            $opciones['provincias']
        );
        $proveedores = EmpresaChartHelper::normalizarNombres(
            array_key_exists('proveedores', $filtros) ? $filtros['proveedores'] : null,
            $opciones['proveedores']
        );

        $dias = range(1, 31);

        $respuestaBase = [
            'familia' => 'PROV',
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

        if (empty($provincias) || empty($proveedores)) {
            return $respuestaBase;
        }

        [$fechaInicio, $fechaFin] = EmpresaChartHelper::rangoAnio($anio);

        $placeholdersProvincias = implode(',', array_fill(0, count($provincias), '?'));
        $placeholdersProveedores = implode(',', array_fill(0, count($proveedores), '?'));

        $sql = "
            SELECT
                MONTH(a.fecha) AS mes,
                DAY(a.fecha) AS dia,
                {$config['expresion']} AS valor
            FROM com_db_vivo_provincia a
            INNER JOIN com_proveedor p ON a.proveedor = p.codigo
            INNER JOIN com_provincia pr ON a.provincia = pr.codigo
            INNER JOIN com_tipo t ON a.tipo = t.codigo
            WHERE a.fecha >= ?
              AND a.fecha < ?
              AND TRIM(t.nombre) = 'Vivo'
              AND TRIM(pr.nombre) IN ($placeholdersProvincias)
              AND TRIM(p.nombre) IN ($placeholdersProveedores)
            GROUP BY MONTH(a.fecha), DAY(a.fecha)
            ORDER BY mes ASC, dia ASC
        ";

        $params = array_merge([$fechaInicio, $fechaFin], $provincias, $proveedores);
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $mesesDetectados = [];
        foreach ($filas as $fila) {
            $mes = (int)($fila['mes'] ?? 0);
            if ($mes >= 1 && $mes <= 12) {
                $mesesDetectados[$mes] = $mes;
            }
        }

        $meses = array_values($mesesDetectados);
        sort($meses);

        if (empty($meses)) {
            return $respuestaBase;
        }

        $construido = EmpresaChartHelper::construirSeries($filas, $meses, $dias);
        $respuestaBase['series'] = $construido['series'];
        $respuestaBase['promedio'] = $construido['promedio'];

        return $respuestaBase;
    }
}
