<?php

require_once __DIR__ . '/ParticipacionMercadoDiariaHandler.php';

class PrecioPorMesHandler
{
    private static $mesesNombres = [
        1  => 'enero',
        2  => 'febrero',
        3  => 'marzo',
        4  => 'abril',
        5  => 'mayo',
        6  => 'junio',
        7  => 'julio',
        8  => 'agosto',
        9  => 'septiembre',
        10 => 'octubre',
        11 => 'noviembre',
        12 => 'diciembre'
    ];

    public static function obtenerFiltros(PDO $db): array
    {
        $sqlRango = "
            SELECT 
                MIN(a.fecha) AS fecha_min,
                MAX(a.fecha) AS fecha_max
            FROM com_db_ingre_emp_lima a
            WHERE a.fecha IS NOT NULL
        ";
        $rango = $db->query($sqlRango)->fetch(PDO::FETCH_ASSOC) ?: [];

        $fechaMin = $rango['fecha_min'] ?? null;
        $fechaMax = $rango['fecha_max'] ?? null;

        $sqlEmpresas = "
            SELECT DISTINCT 
                TRIM(e.nombre) AS nombre
            FROM com_db_ingre_emp_lima a
            INNER JOIN com_empresa e ON a.empresa = e.codigo
            WHERE e.nombre IS NOT NULL 
              AND TRIM(e.nombre) <> ''
            ORDER BY nombre ASC
        ";
        $stmtEmpresas = $db->query($sqlEmpresas);
        $empresas = [];

        foreach ($stmtEmpresas->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $empresas[] = [
                    'id'    => $nombre,
                    'label' => $nombre
                ];
            }
        }

        // En Tableau por defecto se filtraba por SAN FERNANDO S.A.
        $empresasDefault = ['SAN FERNANDO S.A.'];
        $encontradoSanFernando = false;
        foreach ($empresas as $emp) {
            if (($emp['id'] ?? '') === 'SAN FERNANDO S.A.') {
                $encontradoSanFernando = true;
                break;
            }
        }
        if (!$encontradoSanFernando) {
            $empresasDefault = array_column($empresas, 'id');
        }

        $fechaInicioDefault = null;
        $fechaFinDefault = null;

        if ($fechaMax) {
            $fechaFinDefault = $fechaMax;
            $maxDt = new DateTimeImmutable($fechaMax);
            // Por defecto últimos 6 meses para reflejar el rango de Tableau (mayo a octubre)
            $inicioDt = $maxDt->modify('-5 months')->modify('first day of this month');
            $fechaInicioDefault = $inicioDt->format('Y-m-d');
            if ($fechaMin && $fechaInicioDefault < $fechaMin) {
                $fechaInicioDefault = $fechaMin;
            }
        }

        $meses = [];
        foreach (self::$mesesNombres as $num => $nombre) {
            $meses[] = [
                'id'    => (string)$num,
                'label' => $nombre
            ];
        }

        $mesesDefault = array_column($meses, 'id');

        return [
            'tipo_grafico'          => 'PrecioPorMes',
            'titulo'                => 'Precios Promedios por Mes',
            'fecha_min'             => $fechaMin,
            'fecha_max'             => $fechaMax,
            'fecha_inicio_default'  => $fechaInicioDefault,
            'fecha_fin_default'     => $fechaFinDefault,
            'empresas'              => $empresas,
            'empresas_default'      => $empresasDefault,
            'meses'                 => $meses,
            'meses_default'         => $mesesDefault
        ];
    }

    public static function handle(PDO $db, array $filtros): array
    {
        $opciones = self::obtenerFiltros($db);

        $fechaInicio = ParticipacionMercadoDiariaHandler::resolverFecha(
            $filtros['fecha_inicio'] ?? '',
            (string)($opciones['fecha_inicio_default'] ?? $opciones['fecha_min'] ?? '')
        );
        $fechaFin = ParticipacionMercadoDiariaHandler::resolverFecha(
            $filtros['fecha_fin'] ?? '',
            (string)($opciones['fecha_fin_default'] ?? $opciones['fecha_max'] ?? '')
        );

        if ($fechaInicio > $fechaFin) {
            throw new InvalidArgumentException('La fecha inicial no puede ser mayor que la fecha final.');
        }

        $empresasSeleccionadas = ParticipacionMercadoDiariaHandler::normalizarSeleccion(
            array_key_exists('empresas', $filtros) ? $filtros['empresas'] : $opciones['empresas_default'],
            $opciones['empresas']
        );

        // Filtro de meses seleccionados
        $mesesSeleccionados = [];
        if (isset($filtros['meses']) && is_array($filtros['meses']) && !empty($filtros['meses'])) {
            foreach ($filtros['meses'] as $m) {
                $val = (int)$m;
                if ($val >= 1 && $val <= 12) {
                    $mesesSeleccionados[] = $val;
                }
            }
        }

        $dias = range(1, 31);

        $respuestaBase = [
            'tipo_grafico'    => 'PrecioPorMes',
            'titulo'          => 'Precios Promedios por Mes',
            'subtitulo'       => 'Día de fecha',
            'fecha_inicio'    => $fechaInicio,
            'fecha_fin'       => $fechaFin,
            'dias'            => $dias,
            'series'          => [],
            'empresas'        => $empresasSeleccionadas,
            'meses'           => $opciones['meses'],
            'meses_default'   => $opciones['meses_default'],
            'total_registros' => 0
        ];

        if (empty($empresasSeleccionadas)) {
            return $respuestaBase;
        }

        $placeholdersEmpresas = implode(',', array_fill(0, count($empresasSeleccionadas), '?'));
        $whereMeses = '';
        $paramsMeses = [];

        if (!empty($mesesSeleccionados)) {
            $placeholdersMeses = implode(',', array_fill(0, count($mesesSeleccionados), '?'));
            $whereMeses = " AND MONTH(a.fecha) IN ($placeholdersMeses)";
            $paramsMeses = $mesesSeleccionados;
        }

        $sql = "
            SELECT
                DATE_FORMAT(a.fecha, '%Y-%m') AS ym,
                YEAR(a.fecha) AS anio,
                MONTH(a.fecha) AS mes_num,
                DAY(a.fecha) AS dia,
                AVG(a.peso_promedio) AS peso_promedio
            FROM com_db_ingre_emp_lima a
            INNER JOIN com_empresa e ON a.empresa = e.codigo
            WHERE a.fecha >= ?
              AND a.fecha <= ?
              AND TRIM(e.nombre) IN ($placeholdersEmpresas)
              $whereMeses
            GROUP BY DATE_FORMAT(a.fecha, '%Y-%m'), YEAR(a.fecha), MONTH(a.fecha), DAY(a.fecha)
            ORDER BY ym ASC, dia ASC
        ";

        $params = array_merge([$fechaInicio, $fechaFin], $empresasSeleccionadas, $paramsMeses);
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($filas)) {
            return $respuestaBase;
        }

        // Agrupar por ym (Año-Mes)
        $mesesData = [];
        $mesesMeta = [];

        foreach ($filas as $fila) {
            $ym = (string)($fila['ym'] ?? '');
            $mesNum = (int)($fila['mes_num'] ?? 0);
            $anio = (int)($fila['anio'] ?? 0);
            $dia = (int)($fila['dia'] ?? 0);
            $peso = (float)($fila['peso_promedio'] ?? 0);

            if ($ym === '' || $dia < 1 || $dia > 31) {
                continue;
            }

            if (!isset($mesesData[$ym])) {
                $mesesData[$ym] = [];
                $nombreMes = self::$mesesNombres[$mesNum] ?? "mes $mesNum";
                $mesesMeta[$ym] = [
                    'ym'      => $ym,
                    'mes_num' => $mesNum,
                    'anio'    => $anio,
                    'nombre'  => $nombreMes,
                    'label'   => $nombreMes
                ];
            }

            $mesesData[$ym][$dia] = $peso;
        }

        // Si hay meses duplicados de diferentes años, añadir el año al label
        $conteoNombres = [];
        foreach ($mesesMeta as $meta) {
            $nom = $meta['nombre'];
            $conteoNombres[$nom] = ($conteoNombres[$nom] ?? 0) + 1;
        }

        $series = [];
        foreach ($mesesMeta as $ym => $meta) {
            $valores = [];
            for ($d = 1; $d <= 31; $d++) {
                if (isset($mesesData[$ym][$d])) {
                    $valores[] = round((float)$mesesData[$ym][$d], 3);
                } else {
                    $valores[] = null;
                }
            }

            $labelFinal = ($conteoNombres[$meta['nombre']] > 1)
                ? $meta['nombre'] . ' ' . $meta['anio']
                : $meta['nombre'];

            $series[] = [
                'ym'      => $ym,
                'mes_num' => $meta['mes_num'],
                'nombre'  => $meta['nombre'],
                'anio'    => $meta['anio'],
                'label'   => $labelFinal,
                'valores' => $valores
            ];
        }

        $respuestaBase['series'] = $series;
        $respuestaBase['total_registros'] = count($filas);

        return $respuestaBase;
    }
}
