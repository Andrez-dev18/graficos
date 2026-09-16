<?php
date_default_timezone_set('America/Lima');
class CA04RevisionAlimentoHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-08-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-08-31';

        // Si se envía fecha_inicio igual a fecha_fin (ej. '2026-08-27'),
        // se ajusta fechaInicio al 1er día del mes (ej. '2026-08-01') actuando fechaFin como fecha de corte
        if ($fechaInicio === $fechaFin && !empty($fechaFin)) {
            $fechaInicio = date('Y-m-01', strtotime($fechaFin));
        }

        // 1. Determinar el fechahisto adecuado en histcostdiaalim2
        $fechahisto = null;
        if (!empty($filtros['fechahisto'])) {
            $fechahisto = trim($filtros['fechahisto']);
        } else {
            $sqlFecha = "SELECT fechahisto 
                         FROM histcostdiaalim2 
                         WHERE fechahisto <= :fec_fin 
                         ORDER BY fechahisto DESC 
                         LIMIT 1";
            $stmtF = $db->prepare($sqlFecha);
            $stmtF->execute([':fec_fin' => $fechaFin]);
            $fechahisto = $stmtF->fetchColumn();

            if (!$fechahisto) {
                $sqlFirst = "SELECT fechahisto FROM histcostdiaalim2 ORDER BY fechahisto DESC LIMIT 1";
                $fechahisto = $db->query($sqlFirst)->fetchColumn() ?: $fechaFin;
            }
        }

        // 2. Determinar el período (YYYY-MM) para el factor CF
        $periodo = substr($fechahisto, 0, 7); // ej: '2026-08'

        // 3. Obtener el factor CF desde la tabla de configuración conf_factor_alimento
        $factorCF = 0.127; // Valor por defecto
        try {
            $stmtCF = $db->prepare("SELECT factor_cf FROM conf_factor_alimento WHERE periodo = :periodo LIMIT 1");
            $stmtCF->execute([':periodo' => $periodo]);
            $cfVal = $stmtCF->fetchColumn();
            if ($cfVal !== false && $cfVal !== null) {
                $factorCF = (float)$cfVal;
            }
        } catch (Exception $e) {
            // Si la tabla no existe o error, mantener valor por defecto
            $factorCF = 0.127;
        }

        $factorCM = 0.013; // Fijo constante
        $factorTotal = $factorCF + $factorCM;

        // 4. Mapeo de meses y días en español
        $diasSemana = [
            0 => 'domingo',
            1 => 'lunes',
            2 => 'martes',
            3 => 'miércoles',
            4 => 'jueves',
            5 => 'viernes',
            6 => 'sábado'
        ];

        $mesesCortos = [
            1 => 'ene', 2 => 'feb', 3 => 'mar', 4 => 'abr', 5 => 'may', 6 => 'jun',
            7 => 'jul', 8 => 'ago', 9 => 'set', 10 => 'oct', 11 => 'nov', 12 => 'dic'
        ];

        // 5. Consultar Serie General Diaria (Gráfico Superior Izquierdo)
        $sqlGeneral = "SELECT 
                            fecha,
                            SUM(peso) AS sum_peso,
                            SUM(valor) AS sum_valor,
                            (SUM(valor) / NULLIF(SUM(peso), 0)) AS pu
                       FROM histcostdiaalim2
                       WHERE fechahisto = :fechahisto AND fecha BETWEEN :fec_ini AND :fec_fin
                       GROUP BY fecha
                       ORDER BY fecha ASC";

        $stmtGen = $db->prepare($sqlGeneral);
        $stmtGen->execute([
            ':fechahisto' => $fechahisto,
            ':fec_ini'    => $fechaInicio,
            ':fec_fin'    => $fechaFin
        ]);
        $rawGeneral = $stmtGen->fetchAll(PDO::FETCH_ASSOC);

        $fechasLabels = [];
        $fechasAsc = [];
        $generalSinFactor = [];
        $generalConFactor = [];

        foreach ($rawGeneral as $row) {
            $fec = $row['fecha'];
            $fechasAsc[] = $fec;
            $ts = strtotime($fec);
            $dNum = (int)date('j', $ts);
            $mNum = (int)date('n', $ts);
            $mCorta = $mesesCortos[$mNum] ?? '';
            $fechasLabels[] = "{$dNum} {$mCorta}";

            $pu = $row['pu'] !== null ? round((float)$row['pu'], 3) : 0;
            $generalSinFactor[] = $pu;
            $generalConFactor[] = round($pu + $factorTotal, 3);
        }

        // 6. Consultar Series Individuales por Alimento (Gráfico Superior Derecho)
        $sqlIndividual = "SELECT 
                            coditem,
                            nomitem,
                            CONCAT(coditem, ' ', nomitem) AS item_label,
                            fecha,
                            SUM(peso) AS peso,
                            SUM(valor) AS valor,
                            (SUM(valor) / NULLIF(SUM(peso), 0)) AS pu
                          FROM histcostdiaalim2
                          WHERE fechahisto = :fechahisto AND fecha BETWEEN :fec_ini AND :fec_fin
                          GROUP BY coditem, nomitem, fecha
                          ORDER BY coditem ASC, fecha ASC";

        $stmtIndiv = $db->prepare($sqlIndividual);
        $stmtIndiv->execute([
            ':fechahisto' => $fechahisto,
            ':fec_ini'    => $fechaInicio,
            ':fec_fin'    => $fechaFin
        ]);
        $rawIndiv = $stmtIndiv->fetchAll(PDO::FETCH_ASSOC);

        // Agrupar puntos por coditem
        $itemsIndivMap = [];
        $palette = ['#2b8a8f', '#59a14f', '#4fa8d1', '#f28e2b', '#e15759', '#76b7b2', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];
        $colorIdx = 0;

        foreach ($rawIndiv as $r) {
            $cod = $r['coditem'];
            if (!isset($itemsIndivMap[$cod])) {
                $itemsIndivMap[$cod] = [
                    'coditem'    => $cod,
                    'nomitem'    => $r['nomitem'],
                    'item_label' => $r['item_label'],
                    'color'      => $palette[$colorIdx % count($palette)],
                    'puntos'     => []
                ];
                $colorIdx++;
            }

            $ts = strtotime($r['fecha']);
            $dNum = (int)date('j', $ts);
            $mNum = (int)date('n', $ts);
            $mCorta = $mesesCortos[$mNum] ?? '';
            $diaCorto = "{$dNum} {$mCorta}";

            $itemsIndivMap[$cod]['puntos'][] = [
                'fecha'     => $r['fecha'],
                'dia'       => $diaCorto,
                'val'       => $r['pu'] !== null ? round((float)$r['pu'], 3) : null,
                'val_label' => $r['pu'] !== null ? number_format((float)$r['pu'], 3, ',', '.') : '',
                'peso'      => $r['peso'] !== null ? round((float)$r['peso'], 2) : 0,
                'peso_label'=> $r['peso'] !== null ? number_format((float)$r['peso'], 2, ',', '.') : ''
            ];
        }

        $seriesIndividuales = array_values($itemsIndivMap);

        // 7. Columnas de Fechas Diarias (Orden DESCENDENTE para la tabla inferior)
        $fechasDesc = $fechasAsc;
        rsort($fechasDesc);

        $columnasFechas = [];
        foreach ($fechasDesc as $fec) {
            $ts = strtotime($fec);
            $w = (int)date('w', $ts);
            $diaSem = $diasSemana[$w] ?? '';
            $fecFormatted = str_replace('-', '/', $fec);
            $labelHeader = "{$diaSem},\n{$fecFormatted}";

            $columnasFechas[] = [
                'id'          => $fecFormatted,
                'fecha'       => $fec,
                'label'       => $labelHeader,
                'dia_semana'  => $diaSem,
                'fecha_corta' => $fecFormatted
            ];
        }

        // 8. Consultar Desglose para la Tabla Matriz (Inferior)
        // 8.1 Totales Generales por Item
        $sqlTotItem = "SELECT 
                            tipo,
                            coditem,
                            nomitem,
                            CONCAT(coditem, ' ', nomitem) AS item_label,
                            SUM(peso) AS total_peso,
                            SUM(valor) AS total_valor,
                            (SUM(valor) / NULLIF(SUM(peso), 0)) AS total_pu
                       FROM histcostdiaalim2
                       WHERE fechahisto = :fechahisto AND fecha BETWEEN :fec_ini AND :fec_fin
                       GROUP BY tipo, coditem, nomitem
                       ORDER BY tipo ASC, coditem ASC";

        $stmtTotItem = $db->prepare($sqlTotItem);
        $stmtTotItem->execute([
            ':fechahisto' => $fechahisto,
            ':fec_ini'    => $fechaInicio,
            ':fec_fin'    => $fechaFin
        ]);
        $rawTotItem = $stmtTotItem->fetchAll(PDO::FETCH_ASSOC);

        // 8.2 Datos Diarios por Item
        $sqlDiaItem = "SELECT 
                            tipo,
                            coditem,
                            fecha,
                            SUM(peso) AS peso,
                            SUM(valor) AS valor,
                            (SUM(valor) / NULLIF(SUM(peso), 0)) AS pu
                       FROM histcostdiaalim2
                       WHERE fechahisto = :fechahisto AND fecha BETWEEN :fec_ini AND :fec_fin
                       GROUP BY tipo, coditem, fecha
                       ORDER BY tipo ASC, coditem ASC, fecha DESC";

        $stmtDiaItem = $db->prepare($sqlDiaItem);
        $stmtDiaItem->execute([
            ':fechahisto' => $fechahisto,
            ':fec_ini'    => $fechaInicio,
            ':fec_fin'    => $fechaFin
        ]);
        $rawDiaItem = $stmtDiaItem->fetchAll(PDO::FETCH_ASSOC);

        $mapaDiaItem = [];
        foreach ($rawDiaItem as $r) {
            $fecFormatted = str_replace('-', '/', $r['fecha']);
            $mapaDiaItem[$r['tipo']][$r['coditem']][$fecFormatted] = [
                'pu'       => $r['pu'] !== null ? number_format((float)$r['pu'], 3, ',', '.') : '',
                'peso'     => $r['peso'] !== null ? number_format((float)$r['peso'], 2, ',', '.') : '',
                'raw_pu'   => $r['pu'] !== null ? round((float)$r['pu'], 3) : null,
                'raw_peso' => $r['peso'] !== null ? round((float)$r['peso'], 2) : 0
            ];
        }

        // 8.3 Subtotales Generales por Tipo de AABB
        $sqlSubTot = "SELECT 
                            tipo,
                            SUM(peso) AS total_peso,
                            SUM(valor) AS total_valor,
                            (SUM(valor) / NULLIF(SUM(peso), 0)) AS total_pu
                      FROM histcostdiaalim2
                      WHERE fechahisto = :fechahisto AND fecha BETWEEN :fec_ini AND :fec_fin
                      GROUP BY tipo
                      ORDER BY tipo ASC";

        $stmtSubTot = $db->prepare($sqlSubTot);
        $stmtSubTot->execute([
            ':fechahisto' => $fechahisto,
            ':fec_ini'    => $fechaInicio,
            ':fec_fin'    => $fechaFin
        ]);
        $rawSubTot = $stmtSubTot->fetchAll(PDO::FETCH_ASSOC);

        $mapaSubTot = [];
        foreach ($rawSubTot as $st) {
            $mapaSubTot[$st['tipo']] = [
                'total_pu'       => $st['total_pu'] !== null ? number_format((float)$st['total_pu'], 3, ',', '.') : '',
                'total_peso'     => $st['total_peso'] !== null ? number_format((float)$st['total_peso'], 2, ',', '.') : '',
                'raw_total_pu'   => $st['total_pu'] !== null ? round((float)$st['total_pu'], 3) : null,
                'raw_total_peso' => $st['total_peso'] !== null ? round((float)$st['total_peso'], 2) : 0
            ];
        }

        // 8.4 Subtotales Diarios por Tipo de AABB
        $sqlSubDia = "SELECT 
                            tipo,
                            fecha,
                            SUM(peso) AS peso,
                            SUM(valor) AS valor,
                            (SUM(valor) / NULLIF(SUM(peso), 0)) AS pu
                      FROM histcostdiaalim2
                      WHERE fechahisto = :fechahisto AND fecha BETWEEN :fec_ini AND :fec_fin
                      GROUP BY tipo, fecha
                      ORDER BY tipo ASC, fecha DESC";

        $stmtSubDia = $db->prepare($sqlSubDia);
        $stmtSubDia->execute([
            ':fechahisto' => $fechahisto,
            ':fec_ini'    => $fechaInicio,
            ':fec_fin'    => $fechaFin
        ]);
        $rawSubDia = $stmtSubDia->fetchAll(PDO::FETCH_ASSOC);

        $mapaSubDia = [];
        foreach ($rawSubDia as $r) {
            $fecFormatted = str_replace('-', '/', $r['fecha']);
            $mapaSubDia[$r['tipo']][$fecFormatted] = [
                'pu'       => $r['pu'] !== null ? number_format((float)$r['pu'], 3, ',', '.') : '',
                'peso'     => $r['peso'] !== null ? number_format((float)$r['peso'], 2, ',', '.') : '',
                'raw_pu'   => $r['pu'] !== null ? round((float)$r['pu'], 3) : null,
                'raw_peso' => $r['peso'] !== null ? round((float)$r['peso'], 2) : 0
            ];
        }

        // 8.5 Estructurar Grupos AABB
        $gruposMap = [];
        foreach ($rawTotItem as $it) {
            $t = $it['tipo'];
            if (!isset($gruposMap[$t])) {
                $gruposMap[$t] = [
                    'tipo'     => $t,
                    'items'    => [],
                    'subtotal' => [
                        'label'      => 'Total',
                        'total_pu'   => $mapaSubTot[$t]['total_pu'] ?? '',
                        'total_peso' => $mapaSubTot[$t]['total_peso'] ?? '',
                        'valores'    => $mapaSubDia[$t] ?? []
                    ]
                ];
            }

            $cod = $it['coditem'];
            $valoresItem = $mapaDiaItem[$t][$cod] ?? [];

            $gruposMap[$t]['items'][] = [
                'coditem'    => $cod,
                'nomitem'    => $it['nomitem'],
                'item'       => $it['item_label'],
                'total_pu'   => $it['total_pu'] !== null ? number_format((float)$it['total_pu'], 3, ',', '.') : '',
                'total_peso' => $it['total_peso'] !== null ? number_format((float)$it['total_peso'], 2, ',', '.') : '',
                'valores'    => $valoresItem
            ];
        }

        $gruposAABB = array_values($gruposMap);

        return [
            'tipo_grafico'        => 'CA04 RevisionAlimento',
            'fechahisto'          => $fechahisto,
            'periodo'             => $periodo,
            'factor_cf'           => $factorCF,
            'factor_cm'           => $factorCM,
            'factor_total'        => $factorTotal,
            'fecha_inicio'        => $fechaInicio,
            'fecha_fin'           => $fechaFin,
            'fechasLabels'        => $fechasLabels,
            'generalSinFactor'    => $generalSinFactor,
            'generalConFactor'    => $generalConFactor,
            'seriesIndividuales'  => $seriesIndividuales,
            'columnasFechas'      => $columnasFechas,
            'gruposAABB'          => $gruposAABB
        ];
    }

    public static function guardarFactorCF(PDO $db, array $data): array
    {
        $periodo = !empty($data['periodo']) ? trim($data['periodo']) : date('Y-m');
        $factorCF = isset($data['factor_cf']) ? (float)$data['factor_cf'] : 0.127;
        $now = date('Y-m-d H:i:s');

        $stmt = $db->prepare("
            INSERT INTO conf_factor_alimento (periodo, factor_cf, fecha_actualizacion)
            VALUES (:periodo, :factor_cf, :fecha_act)
            ON DUPLICATE KEY UPDATE 
                factor_cf = VALUES(factor_cf),
                fecha_actualizacion = VALUES(fecha_actualizacion)
        ");
        $stmt->execute([
            ':periodo'   => $periodo,
            ':factor_cf' => $factorCF,
            ':fecha_act' => $now
        ]);

        return [
            'success'   => true,
            'periodo'   => $periodo,
            'factor_cf' => $factorCF,
            'mensaje'   => "Factor CF guardado correctamente para el período {$periodo}"
        ];
    }
}
