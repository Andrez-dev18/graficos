<?php

class CP05CAABBvsICAHandler
{
    private static $mesesLargo = [
        '01' => 'enero', '02' => 'febrero', '03' => 'marzo', '04' => 'abril',
        '05' => 'mayo', '06' => 'junio', '07' => 'julio', '08' => 'agosto',
        '09' => 'septiembre', '10' => 'octubre', '11' => 'noviembre', '12' => 'diciembre'
    ];

    private static $mesesCorto = [
        '01' => 'ene', '02' => 'feb', '03' => 'mar', '04' => 'abr',
        '05' => 'may', '06' => 'jun', '07' => 'jul', '08' => 'ago',
        '09' => 'sept', '10' => 'oct', '11' => 'nov', '12' => 'dic'
    ];

    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-04-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-08-31';
        $zonaFiltro  = !empty($filtros['zona']) ? trim($filtros['zona']) : null;

        $params = [
            ':fecha_ini' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $whereZona = "";
        if (!empty($zonaFiltro) && strtoupper($zonaFiltro) !== 'TODOS' && strtoupper($zonaFiltro) !== '(TODO)') {
            $whereZona = " AND zona = :zona ";
            $params[':zona'] = $zonaFiltro;
        }

        // 1. Gráfica consolidada mensual (Doble eje: Costo x Kg vs ICA)
        $sqlGrafica = "
            SELECT 
                DATE_FORMAT(fecha, '%Y-%m') AS mes_key,
                DATE_FORMAT(fecha, '%Y') AS anio,
                DATE_FORMAT(fecha, '%m') AS mes_num,
                SUM(calimento) AS sum_calimento,
                SUM(saca_kilos) AS sum_saca_kilos,
                SUM(saca_und) AS sum_saca_und,
                (SUM(calimento) / NULLIF(SUM(saca_kilos), 0)) AS costo_x_kg,
                (SUM(saca_kilos) / NULLIF(SUM(saca_und), 0)) AS ica
            FROM costomenzona
            WHERE fecha >= :fecha_ini AND fecha <= LAST_DAY(:fecha_fin)
              {$whereZona}
            GROUP BY mes_key, anio, mes_num
            ORDER BY mes_key ASC
        ";
        $stmtG = $db->prepare($sqlGrafica);
        $stmtG->execute($params);
        $rawGrafica = $stmtG->fetchAll(PDO::FETCH_ASSOC);

        $periodos = [];
        $grafica = [];

        foreach ($rawGrafica as $rg) {
            $key = $rg['mes_key'];
            $anio = $rg['anio'];
            $mesNum = $rg['mes_num'];
            $mesNomLargo = self::$mesesLargo[$mesNum] ?? "mes $mesNum";
            $mesNomCorto = self::$mesesCorto[$mesNum] ?? "m$mesNum";
            $mesLarga = "$mesNomLargo de $anio";
            $mesCorta = "$mesNomCorto $anio";

            $costoXKg = round((float)($rg['costo_x_kg'] ?? 0), 3);
            $ica = round((float)($rg['ica'] ?? 0), 3);

            $periodos[] = [
                'key'       => $key,
                'mes_corta' => $mesCorta,
                'mes_larga' => $mesLarga,
                'anio'      => $anio,
                'mes_num'   => $mesNum
            ];

            $grafica[] = [
                'key'            => $key,
                'mes_corta'      => $mesCorta,
                'mes_larga'      => $mesLarga,
                'anio'           => $anio,
                'mes_num'        => $mesNum,
                'sum_calimento'  => (float)($rg['sum_calimento'] ?? 0),
                'sum_saca_kilos' => (float)($rg['sum_saca_kilos'] ?? 0),
                'sum_saca_und'   => (float)($rg['sum_saca_und'] ?? 0),
                'costo_x_kg'     => $costoXKg,
                'ica'            => $ica
            ];
        }

        // 2. Detalle por Cencos y Mes para la matriz inferior
        $sqlDetalle = "
            SELECT 
                DATE_FORMAT(fecha, '%Y-%m') AS mes_key,
                DATE_FORMAT(fecha, '%Y') AS anio,
                DATE_FORMAT(fecha, '%m') AS mes_num,
                cencos,
                nomcencos,
                SUM(calimento) AS kg_alimento,
                SUM(saca_kilos) AS saca_kg,
                SUM(saca_und) AS saca_und,
                (SUM(calimento) / NULLIF(SUM(saca_kilos), 0)) AS costo_x_kg,
                (SUM(saca_kilos) / NULLIF(SUM(saca_und), 0)) AS ica
            FROM costomenzona
            WHERE fecha >= :fecha_ini AND fecha <= LAST_DAY(:fecha_fin)
              {$whereZona}
            GROUP BY mes_key, anio, mes_num, cencos, nomcencos
            ORDER BY mes_key ASC, CAST(cencos AS UNSIGNED) ASC
        ";
        $stmtD = $db->prepare($sqlDetalle);
        $stmtD->execute($params);
        $rawDetalle = $stmtD->fetchAll(PDO::FETCH_ASSOC);

        $mesesDetalleMap = [];
        $mesesTotalesMap = [];

        foreach ($rawDetalle as $rd) {
            $key = $rd['mes_key'];
            $anio = $rd['anio'];
            $mesNum = $rd['mes_num'];
            $mesNomLargo = self::$mesesLargo[$mesNum] ?? "mes $mesNum";
            $mesLarga = "$mesNomLargo de $anio";

            if (!isset($mesesDetalleMap[$key])) {
                $mesesDetalleMap[$key] = [
                    'key'        => $key,
                    'mes'        => $mesLarga,
                    'cencosList' => [],
                    'columnas'   => []
                ];
                $mesesTotalesMap[$key] = [
                    'kg_alimento' => 0.0,
                    'saca_kg'     => 0.0,
                    'saca_und'    => 0.0
                ];
            }

            $cencos = trim((string)$rd['cencos']);
            $kgAlim = (float)($rd['kg_alimento'] ?? 0);
            $sacaKg = (float)($rd['saca_kg'] ?? 0);
            $sacaUnd = (float)($rd['saca_und'] ?? 0);
            $costoXKg = round((float)($rd['costo_x_kg'] ?? 0), 3);
            $ica = round((float)($rd['ica'] ?? 0), 3);

            $mesesDetalleMap[$key]['cencosList'][] = $cencos;
            $mesesDetalleMap[$key]['columnas'][$cencos] = [
                'cencos'      => $cencos,
                'nomcencos'   => $rd['nomcencos'],
                'kg_alimento' => $kgAlim,
                'saca_kg'     => $sacaKg,
                'saca_und'    => $sacaUnd,
                'costo_x_kg'  => $costoXKg,
                'ica'         => $ica
            ];

            $mesesTotalesMap[$key]['kg_alimento'] += $kgAlim;
            $mesesTotalesMap[$key]['saca_kg']     += $sacaKg;
            $mesesTotalesMap[$key]['saca_und']    += $sacaUnd;
        }

        // Agregar la columna 'Total' al final de cada mes
        foreach ($mesesDetalleMap as $key => &$mObj) {
            $tot = $mesesTotalesMap[$key];
            $totCostoXKg = ($tot['saca_kg'] > 0) ? round($tot['kg_alimento'] / $tot['saca_kg'], 3) : 0.0;
            $totIca      = ($tot['saca_und'] > 0) ? round($tot['saca_kg'] / $tot['saca_und'], 3) : 0.0;

            $mObj['cencosList'][] = 'Total';
            $mObj['columnas']['Total'] = [
                'cencos'      => 'Total',
                'nomcencos'   => 'Total Mes',
                'kg_alimento' => $tot['kg_alimento'],
                'saca_kg'     => $tot['saca_kg'],
                'saca_und'    => $tot['saca_und'],
                'costo_x_kg'  => $tot['costo_x_kg'] = $totCostoXKg,
                'ica'         => $tot['ica'] = $totIca
            ];
        }
        unset($mObj);

        // Zonas disponibles
        $zonas = $db->query("SELECT DISTINCT zona FROM costomenzona WHERE zona IS NOT NULL AND zona != '' ORDER BY zona ASC")->fetchAll(PDO::FETCH_COLUMN);

        return [
            'tipo_grafico'     => 'CP05 CAABBvsICA',
            'zona'             => $zonaFiltro,
            'periodos'         => $periodos,
            'grafica'          => $grafica,
            'detalleMeses'     => array_values($mesesDetalleMap),
            'zonasDisponibles' => $zonas
        ];
    }
}
