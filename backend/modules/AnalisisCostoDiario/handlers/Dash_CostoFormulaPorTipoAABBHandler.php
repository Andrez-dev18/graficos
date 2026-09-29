<?php

class Dash_CostoFormulaPorTipoAABBHandler
{
    private static function parseFilter($val): ?array
    {
        if ($val === null) return null;
        if (is_array($val)) {
            if (empty($val)) return [];
            $clean = [];
            $hasAll = false;
            foreach ($val as $v) {
                $v = trim((string)$v);
                if (strtoupper($v) === 'TODOS' || strtoupper($v) === 'ALL' || strtoupper($v) === '(TODO)') {
                    $hasAll = true;
                } elseif ($v !== '') {
                    $clean[] = $v;
                }
            }
            if ($hasAll && empty($clean)) return null;
            if (empty($clean)) return [];
            return array_values(array_unique($clean));
        }

        $val = trim((string)$val);
        if ($val === '' || strtoupper($val) === 'TODOS' || strtoupper($val) === 'ALL' || strtoupper($val) === '(TODO)') {
            return null;
        }
        if (strpos($val, ',') !== false) {
            $parts = explode(',', $val);
            $clean = [];
            foreach ($parts as $p) {
                $p = trim($p);
                if ($p !== '' && strtoupper($p) !== 'TODOS' && strtoupper($p) !== 'ALL' && strtoupper($p) !== '(TODO)') {
                    $clean[] = $p;
                }
            }
            return !empty($clean) ? array_values(array_unique($clean)) : null;
        }
        return [$val];
    }

    private static function formatFechaLabel(string $dateStr): array
    {
        $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        $mesesCortos = [
            1 => 'ene', 2 => 'feb', 3 => 'mar', 4 => 'abr', 5 => 'may', 6 => 'jun',
            7 => 'jul', 8 => 'ago', 9 => 'set', 10 => 'oct', 11 => 'nov', 12 => 'dic'
        ];

        $ts = strtotime($dateStr);
        $diaSemana = $dias[(int)date('w', $ts)];
        $diaNum = (int)date('j', $ts);
        $mesNum = (int)date('n', $ts);
        $mesCorto = $mesesCortos[$mesNum] ?? '';
        $ymd = date('Y/m/d', $ts);

        return [
            'fecha'       => $dateStr,
            'dia_mes'     => "{$diaNum} {$mesCorto}",
            'dia_semana'  => $diaSemana,
            'ymd'         => $ymd,
            'label_largo' => "{$diaSemana}, {$ymd}"
        ];
    }

    public static function handle(PDO $db, array $filtros): array
    {
        // 1. Rango de Fechas
        $fechaInicio = $filtros['fecha_inicio'] ?? $filtros['fecha1'] ?? '2026-02-19';
        $fechaFin    = $filtros['fecha_fin'] ?? $filtros['fecha2'] ?? '2026-03-21';

        $whereGeneral = [];
        $paramsGeneral = [];

        if (!empty($fechaInicio) && !empty($fechaFin)) {
            $whereGeneral[] = "fecha BETWEEN ? AND ?";
            $paramsGeneral[] = $fechaInicio;
            $paramsGeneral[] = $fechaFin;
        }

        // 2. Filtro Tipo de Alimento
        $tipos = self::parseFilter($filtros['tipo'] ?? $filtros['tipos'] ?? null);
        $whereDetalle = $whereGeneral;
        $whereDetalle[] = "TRIM(IFNULL(tipo, '')) != ''";
        $paramsDetalle = $paramsGeneral;

        if ($tipos === []) {
            $whereDetalle[] = "1 = 0";
        } elseif ($tipos !== null) {
            $placeholders = implode(',', array_fill(0, count($tipos), '?'));
            $whereDetalle[] = "TRIM(tipo) IN ($placeholders)";
            foreach ($tipos as $t) {
                $paramsDetalle[] = $t;
            }
        }

        // Filtro opcional si se seleccionó una fecha específica para el gráfico de detalle
        $fechaSeleccionada = $filtros['fecha_seleccionada'] ?? null;
        if (!empty($fechaSeleccionada) && $fechaSeleccionada !== 'todas') {
            $whereDetalle[] = "fecha = ?";
            $paramsDetalle[] = $fechaSeleccionada;
        }

        $whereGenSql = !empty($whereGeneral) ? 'WHERE ' . implode(' AND ', $whereGeneral) : '';
        $whereDetSql = !empty($whereDetalle) ? 'WHERE ' . implode(' AND ', $whereDetalle) : '';

        // -------------------------------------------------------------
        // CONSULTA 1: Costo Formula Alimento General (Gráfica Superior)
        // -------------------------------------------------------------
        $sqlGeneral = "
            SELECT 
                fecha,
                SUM(peso) AS total_peso,
                SUM(valor) AS total_valor,
                CASE 
                    WHEN SUM(peso) > 0 THEN ROUND(SUM(valor) / SUM(peso), 3)
                    ELSE 0.000 
                END AS pu
            FROM histcostdiaalim2
            {$whereGenSql}
            GROUP BY fecha
            ORDER BY fecha ASC
        ";

        $stmtGen = $db->prepare($sqlGeneral);
        $stmtGen->execute($paramsGeneral);
        $rawGeneral = $stmtGen->fetchAll(PDO::FETCH_ASSOC);

        $alimentoGeneral = [];
        $granTotalPeso = 0.0;
        $granTotalValor = 0.0;
        $minPu = null;
        $maxPu = null;

        foreach ($rawGeneral as $row) {
            $fInfo = self::formatFechaLabel($row['fecha']);
            $peso = (float)$row['total_peso'];
            $valor = (float)$row['total_valor'];
            $pu = (float)$row['pu'];

            $granTotalPeso += $peso;
            $granTotalValor += $valor;

            if ($minPu === null || $pu < $minPu) $minPu = $pu;
            if ($maxPu === null || $pu > $maxPu) $maxPu = $pu;

            $alimentoGeneral[] = [
                'fecha'       => $row['fecha'],
                'dia_mes'     => $fInfo['dia_mes'],
                'dia_semana'  => $fInfo['dia_semana'],
                'fecha_label' => $fInfo['label_largo'],
                'peso'        => round($peso, 2),
                'valor'       => round($valor, 2),
                'pu'          => $pu
            ];
        }

        $puGeneralGlobal = ($granTotalPeso > 0) ? round($granTotalValor / $granTotalPeso, 3) : 0.000;

        // -------------------------------------------------------------
        // CONSULTA 2: Detalle de Tipo de Alimento (Gráfica Inferior)
        // -------------------------------------------------------------
        $sqlDetalle = "
            SELECT 
                fecha,
                TRIM(tipo) AS tipo,
                TRIM(coditem) AS coditem,
                TRIM(nomitem) AS nomitem,
                CONCAT(TRIM(coditem), ' ', TRIM(nomitem)) AS item,
                SUM(peso) AS total_peso,
                SUM(valor) AS total_valor,
                CASE 
                    WHEN SUM(peso) > 0 THEN ROUND(SUM(valor) / SUM(peso), 3)
                    ELSE 0.000 
                END AS pu
            FROM histcostdiaalim2
            {$whereDetSql}
            GROUP BY fecha, tipo, coditem, nomitem
            ORDER BY tipo ASC, coditem ASC, fecha ASC
        ";

        $stmtDet = $db->prepare($sqlDetalle);
        $stmtDet->execute($paramsDetalle);
        $rawDetalle = $stmtDet->fetchAll(PDO::FETCH_ASSOC);

        $alimentoDetalle = [];
        $tiposSet = [];
        $fechasDetalleSet = [];

        // Agrupación para series de gráfica
        $seriesPorTipo = [];
        $detallePorFecha = [];

        foreach ($rawDetalle as $row) {
            $fInfo = self::formatFechaLabel($row['fecha']);
            $tipo = $row['tipo'] ?: 'SIN TIPO';
            $item = $row['item'] ?: '';
            $peso = (float)$row['total_peso'];
            $valor = (float)$row['total_valor'];
            $pu = (float)$row['pu'];

            $tiposSet[$tipo] = true;
            $fechasDetalleSet[$row['fecha']] = $fInfo['label_largo'];

            $itemData = [
                'fecha'       => $row['fecha'],
                'fecha_label' => $fInfo['label_largo'],
                'dia_mes'     => $fInfo['dia_mes'],
                'dia_semana'  => $fInfo['dia_semana'],
                'ymd'         => $fInfo['ymd'],
                'tipo'        => $tipo,
                'coditem'     => $row['coditem'],
                'nomitem'     => $row['nomitem'],
                'item'        => $item,
                'peso'        => round($peso, 2),
                'valor'       => round($valor, 2),
                'pu'          => $pu
            ];

            $alimentoDetalle[] = $itemData;

            if (!isset($seriesPorTipo[$tipo])) {
                $seriesPorTipo[$tipo] = [];
            }
            $seriesPorTipo[$tipo][] = $itemData;

            if (!isset($detallePorFecha[$row['fecha']])) {
                $detallePorFecha[$row['fecha']] = [];
            }
            $detallePorFecha[$row['fecha']][] = $itemData;
        }

        // Paleta de colores oficial de Tableau para los Tipos de Alimento
        $coloresTipo = [
            '21 PRE INICIO'     => '#78b5e3', // Azul claro
            '22 INICIO'         => '#305f8f', // Azul oscuro
            '23 ACABADO 1'      => '#db4343', // Rojo
            '24 ACABADO 2'      => '#e88938', // Naranja
            '25 TERMINADOR'     => '#967b2d', // Mostaza / Marrón claro
            '26 FINALIZADOR'    => '#499844', // Verde
            '26 FINALIZADOR 1'  => '#3b7a37', // Verde oscuro
            '27 FINALIZADOR 2'  => '#2d8e87'  // Verde azulado / Teal
        ];

        return [
            'success'            => true,
            'status'             => 'success',
            'tipo_grafico'       => 'CostoFormulaPorTipoAABB',
            'titulo'             => 'Costo Formula Por Tipo AABB',
            'fecha_inicio'       => $fechaInicio,
            'fecha_fin'          => $fechaFin,
            'fecha_seleccionada' => $fechaSeleccionada,
            'resumen_general'    => [
                'total_peso'     => round($granTotalPeso, 2),
                'total_valor'    => round($granTotalValor, 2),
                'pu_promedio'    => $puGeneralGlobal,
                'min_pu'         => $minPu !== null ? round($minPu, 3) : 0,
                'max_pu'         => $maxPu !== null ? round($maxPu, 3) : 0,
                'total_dias'     => count($alimentoGeneral)
            ],
            'alimento_general'   => $alimentoGeneral,
            'alimento_detalle'   => $alimentoDetalle,
            'series_por_tipo'    => $seriesPorTipo,
            'detalle_por_fecha'  => $detallePorFecha,
            'tipos_disponibles'  => array_keys($tiposSet),
            'colores_tipo'       => $coloresTipo
        ];
    }
}
