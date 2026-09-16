<?php

class CA03RevisionInsumosHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2024-02-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2024-02-18';

        // Si se envía fecha_inicio igual a fecha_fin (ej. '2024-02-18'),
        // se ajusta fechaInicio al 1er día del mes (ej. '2024-02-01') actuando fechaFin como fecha de corte
        if ($fechaInicio === $fechaFin && !empty($fechaFin)) {
            $fechaInicio = date('Y-m-01', strtotime($fechaFin));
        }

        // 1. Determinar el fechahisto adecuado
        $sqlFecha = "SELECT fechahisto 
                     FROM histcostdiaalim 
                     WHERE fechahisto <= :fec_fin 
                     ORDER BY fechahisto DESC 
                     LIMIT 1";
        $stmtF = $db->prepare($sqlFecha);
        $stmtF->execute([':fec_fin' => $fechaFin]);
        $fechahistoEncontrado = $stmtF->fetchColumn();

        if (!$fechahistoEncontrado) {
            $sqlFirst = "SELECT fechahisto FROM histcostdiaalim ORDER BY fechahisto DESC LIMIT 1";
            $fechahistoEncontrado = $db->query($sqlFirst)->fetchColumn() ?: $fechaFin;
        }

        $fechahisto = $fechahistoEncontrado;

        // 2. Obtener catálogos para filtros disponibles en este fechahisto
        $stmtTipos = $db->prepare("SELECT DISTINCT tipo FROM histcostdiaalim WHERE fechahisto = :fec ORDER BY tipo ASC");
        $stmtTipos->execute([':fec' => $fechahisto]);
        $catalogoTipos = $stmtTipos->fetchAll(PDO::FETCH_COLUMN);

        $stmtTrans = $db->prepare("SELECT DISTINCT transaccion FROM histcostdiaalim WHERE fechahisto = :fec ORDER BY transaccion ASC");
        $stmtTrans->execute([':fec' => $fechahisto]);
        $catalogoTrans = $stmtTrans->fetchAll(PDO::FETCH_COLUMN);

        $stmtItems = $db->prepare("SELECT DISTINCT coditem, nomitem, CONCAT(coditem, ' ', nomitem) AS item_label 
                                   FROM histcostdiaalim 
                                   WHERE fechahisto = :fec 
                                   ORDER BY coditem ASC");
        $stmtItems->execute([':fec' => $fechahisto]);
        $catalogoItems = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

        // 3. Procesar filtros seleccionados
        // Filtro Tipos (por defecto INSUMO si no se especifica)
        $selectedTipos = [];
        if (!empty($filtros['tipos'])) {
            $selectedTipos = is_array($filtros['tipos']) ? $filtros['tipos'] : explode(',', $filtros['tipos']);
        } elseif (!empty($filtros['tipo'])) {
            $selectedTipos = is_array($filtros['tipo']) ? $filtros['tipo'] : [$filtros['tipo']];
        } else {
            $selectedTipos = ['INSUMO'];
        }
        $selectedTipos = array_values(array_filter(array_map('trim', $selectedTipos)));

        // Filtro Transacciones (por defecto E003, S003 si no se especifica)
        $selectedTrans = [];
        if (!empty($filtros['transacciones'])) {
            $selectedTrans = is_array($filtros['transacciones']) ? $filtros['transacciones'] : explode(',', $filtros['transacciones']);
        } elseif (!empty($filtros['transaccion'])) {
            $selectedTrans = is_array($filtros['transaccion']) ? $filtros['transaccion'] : [$filtros['transaccion']];
        } else {
            $selectedTrans = ['E003', 'S003'];
        }
        $selectedTrans = array_values(array_filter(array_map('trim', $selectedTrans)));

        // Filtro Items (si no se especifica, toma todos los disponibles para no excluir nada)
        $selectedItems = [];
        if (!empty($filtros['items'])) {
            $selectedItems = is_array($filtros['items']) ? $filtros['items'] : explode(',', $filtros['items']);
        } elseif (!empty($filtros['item'])) {
            $selectedItems = is_array($filtros['item']) ? $filtros['item'] : [$filtros['item']];
        } elseif (!empty($filtros['coditem'])) {
            $selectedItems = is_array($filtros['coditem']) ? $filtros['coditem'] : [$filtros['coditem']];
        }
        $selectedItems = array_values(array_filter(array_map('trim', $selectedItems)));

        // 4. Construir consulta con parámetros
        $whereConditions = ["fechahisto = :fechahisto"];
        $params = [':fechahisto' => $fechahisto];

        // Rango de fechas de movimientos
        if (!empty($fechaInicio) && !empty($fechaFin)) {
            $whereConditions[] = "fecha BETWEEN :fec_ini AND :fec_fin";
            $params[':fec_ini'] = $fechaInicio;
            $params[':fec_fin'] = $fechaFin;
        }

        if (!empty($selectedTipos)) {
            $inTipos = [];
            foreach ($selectedTipos as $idx => $t) {
                $pKey = ":tipo_{$idx}";
                $inTipos[] = $pKey;
                $params[$pKey] = $t;
            }
            $whereConditions[] = "tipo IN (" . implode(',', $inTipos) . ")";
        }

        if (!empty($selectedTrans)) {
            $inTrans = [];
            foreach ($selectedTrans as $idx => $tr) {
                $pKey = ":trans_{$idx}";
                $inTrans[] = $pKey;
                $params[$pKey] = $tr;
            }
            $whereConditions[] = "transaccion IN (" . implode(',', $inTrans) . ")";
        }

        if (!empty($selectedItems)) {
            $inCod = [];
            $inLbl = [];
            foreach ($selectedItems as $idx => $it) {
                $pCod = ":item_c_{$idx}";
                $pLbl = ":item_l_{$idx}";
                $inCod[] = $pCod;
                $inLbl[] = $pLbl;
                $params[$pCod] = $it;
                $params[$pLbl] = $it;
            }
            $whereConditions[] = "(coditem IN (" . implode(',', $inCod) . ") OR CONCAT(coditem, ' ', nomitem) IN (" . implode(',', $inLbl) . "))";
        }

        $whereSql = implode(' AND ', $whereConditions);

        // 5. Consultar Total General por Item y Transacción
        $sqlTotales = "SELECT 
                            tipo,
                            coditem,
                            nomitem,
                            CONCAT(coditem, ' ', nomitem) AS item_label,
                            transaccion,
                            SUM(peso) AS total_peso,
                            SUM(valor) AS total_valor,
                            (SUM(valor) / NULLIF(SUM(peso), 0)) AS total_pu
                       FROM histcostdiaalim
                       WHERE {$whereSql}
                       GROUP BY tipo, coditem, nomitem, transaccion
                       ORDER BY coditem ASC, transaccion ASC";

        $stmtTot = $db->prepare($sqlTotales);
        $stmtTot->execute($params);
        $rawTotales = $stmtTot->fetchAll(PDO::FETCH_ASSOC);

        // 6. Consultar Desglose Diario por Item y Transacción
        $sqlDiario = "SELECT 
                            fecha,
                            tipo,
                            coditem,
                            nomitem,
                            CONCAT(coditem, ' ', nomitem) AS item_label,
                            transaccion,
                            SUM(peso) AS peso,
                            SUM(valor) AS valor,
                            (SUM(valor) / NULLIF(SUM(peso), 0)) AS pu
                       FROM histcostdiaalim
                       WHERE {$whereSql}
                       GROUP BY fecha, tipo, coditem, nomitem, transaccion
                       ORDER BY fecha ASC, coditem ASC, transaccion ASC";

        $stmtDia = $db->prepare($sqlDiario);
        $stmtDia->execute($params);
        $rawDiario = $stmtDia->fetchAll(PDO::FETCH_ASSOC);

        // 7. Estructurar Días Únicos
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

        // Obtener lista única de fechas presentes
        $fechasSet = [];
        foreach ($rawDiario as $d) {
            $fechasSet[$d['fecha']] = true;
        }
        $fechasAsc = array_keys($fechasSet);
        sort($fechasAsc); // Ascendente para gráfica de líneas

        $fechasDesc = $fechasAsc;
        rsort($fechasDesc); // Descendente para columnas de la tabla

        $columnasFechas = [];
        foreach ($fechasDesc as $fec) {
            $ts = strtotime($fec);
            $w = (int)date('w', $ts);
            $diaSem = $diasSemana[$w] ?? '';
            $colDia = "{$diaSem}, " . str_replace('-', '/', $fec);

            $mNum = (int)date('n', $ts);
            $dNum = (int)date('j', $ts);
            $mCorta = $mesesCortos[$mNum] ?? '';
            $diaCorto = "{$dNum} {$mCorta}";

            $columnasFechas[] = [
                'fecha'       => $fec,
                'dia_label'   => $colDia,
                'dia_corto'   => $diaCorto,
                'fecha_corta' => str_replace('-', '/', $fec)
            ];
        }

        // Mapa de datos diarios [tipo_coditem_trans][fecha]
        $mapaDiario = [];
        foreach ($rawDiario as $d) {
            $key = $d['tipo'] . '_' . $d['coditem'] . '_' . $d['transaccion'];
            $mapaDiario[$key][$d['fecha']] = [
                'pu'       => number_format((float)$d['pu'], 3, ',', '.'),
                'peso'     => number_format((float)$d['peso'], 2, ',', '.'),
                'raw_pu'   => round((float)$d['pu'], 3),
                'raw_peso' => round((float)$d['peso'], 2),
                'raw_val'  => (float)$d['valor']
            ];
        }

        // 8. Construir filas de la Tabla Matriz
        $tablaMatriz = [];
        foreach ($rawTotales as $t) {
            $key = $t['tipo'] . '_' . $t['coditem'] . '_' . $t['transaccion'];
            $valoresDiarios = $mapaDiario[$key] ?? [];

            $tablaMatriz[] = [
                'tipo'            => $t['tipo'],
                'coditem'         => $t['coditem'],
                'nomitem'         => $t['nomitem'],
                'item_label'      => $t['item_label'],
                'transaccion'     => $t['transaccion'],
                'total_pu'        => number_format((float)$t['total_pu'], 3, ',', '.'),
                'total_peso'      => number_format((float)$t['total_peso'], 2, ',', '.'),
                'raw_total_pu'    => round((float)$t['total_pu'], 3),
                'raw_total_peso'  => round((float)$t['total_peso'], 2),
                'valores_diarios' => $valoresDiarios
            ];
        }

        // 9. Construir series de Gráficas de Líneas (una por cada Item + Transacción)
        $graficaLineas = [];
        foreach ($rawTotales as $t) {
            $key = $t['tipo'] . '_' . $t['coditem'] . '_' . $t['transaccion'];
            $valoresDiarios = $mapaDiario[$key] ?? [];

            $puntos = [];
            foreach ($fechasAsc as $fec) {
                $ts = strtotime($fec);
                $mNum = (int)date('n', $ts);
                $dNum = (int)date('j', $ts);
                $mCorta = $mesesCortos[$mNum] ?? '';
                $diaCorto = "{$dNum} {$mCorta}";

                $vd = $valoresDiarios[$fec] ?? null;
                $puntos[] = [
                    'fecha'       => $fec,
                    'fecha_corta' => str_replace('-', '/', $fec),
                    'dia_corto'   => $diaCorto,
                    'pu'          => $vd ? $vd['raw_pu'] : null,
                    'pu_label'    => $vd ? $vd['pu'] : '',
                    'peso'        => $vd ? $vd['raw_peso'] : null,
                    'peso_label'  => $vd ? $vd['peso'] : ''
                ];
            }

            $graficaLineas[] = [
                'tipo'        => $t['tipo'],
                'coditem'     => $t['coditem'],
                'nomitem'     => $t['nomitem'],
                'item_label'  => $t['item_label'],
                'transaccion' => $t['transaccion'],
                'puntos'      => $puntos
            ];
        }

        // Fechas de eje X para el gráfico de líneas
        $labelsEjeX = [];
        foreach ($fechasAsc as $fec) {
            $ts = strtotime($fec);
            $mNum = (int)date('n', $ts);
            $dNum = (int)date('j', $ts);
            $mCorta = $mesesCortos[$mNum] ?? '';
            $labelsEjeX[] = "{$dNum} {$mCorta}";
        }

        return [
            'tipo_grafico'            => 'CA03 RevisionInsumos',
            'fechahisto'              => $fechahisto,
            'fecha_inicio'            => $fechaInicio,
            'fecha_fin'               => $fechaFin,
            'catalogo_tipos'          => $catalogoTipos,
            'catalogo_transacciones'  => $catalogoTrans,
            'catalogo_items'          => $catalogoItems,
            'filtros_seleccionados'   => [
                'tipos'         => $selectedTipos,
                'transacciones' => $selectedTrans,
                'items'         => $selectedItems
            ],
            'columnas_fechas'         => $columnasFechas,
            'fechas_asc'              => $fechasAsc,
            'labels_eje_x'            => $labelsEjeX,
            'tabla_matriz'            => $tablaMatriz,
            'grafica_lineas'          => $graficaLineas
        ];
    }
}
