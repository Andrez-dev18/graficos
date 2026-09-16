<?php
date_default_timezone_set('America/Lima');

class CA05AnalisisFormulasHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-08-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-08-31';

        // Si se envía fecha_inicio igual a fecha_fin (ej. '2026-08-01'),
        // se ajusta fechaInicio al 1er día del mes (ej. '2026-08-01') actuando fechaFin como fecha de corte
        if ($fechaInicio === $fechaFin && !empty($fechaFin)) {
            $fechaInicio = date('Y-m-01', strtotime($fechaFin));
        }

        // 1. Determinar el fechahisto adecuado en histoformulaalim
        $fechahisto = null;
        if (!empty($filtros['fechahisto'])) {
            $fechahisto = trim($filtros['fechahisto']);
        } else {
            // Buscamos el primer snapshot fechahisto >= fechaFin (ej. para 2026-08-01 se toma 2026-08-03)
            $sqlFecha = "SELECT fechahisto 
                         FROM histoformulaalim 
                         WHERE fechahisto >= :fec_fin 
                         ORDER BY fechahisto ASC 
                         LIMIT 1";
            $stmtF = $db->prepare($sqlFecha);
            $stmtF->execute([':fec_fin' => $fechaFin]);
            $fechahisto = $stmtF->fetchColumn();

            if (!$fechahisto) {
                $sqlPrev = "SELECT fechahisto 
                            FROM histoformulaalim 
                            WHERE fechahisto <= :fec_fin 
                            ORDER BY fechahisto DESC 
                            LIMIT 1";
                $stmtPrev = $db->prepare($sqlPrev);
                $stmtPrev->execute([':fec_fin' => $fechaFin]);
                $fechahisto = $stmtPrev->fetchColumn();
            }

            if (!$fechahisto) {
                $sqlFirst = "SELECT fechahisto FROM histoformulaalim ORDER BY fechahisto DESC LIMIT 1";
                $fechahisto = $db->query($sqlFirst)->fetchColumn() ?: $fechaFin;
            }
        }

        // 2. Obtener Catálogos disponibles para este fechahisto
        $stmtIns = $db->prepare("SELECT DISTINCT codinsu, nominsu, CONCAT(codinsu, ' ', nominsu) AS label 
                                 FROM histoformulaalim 
                                 WHERE fechahisto = :fec 
                                 ORDER BY codinsu ASC");
        $stmtIns->execute([':fec' => $fechahisto]);
        $catalogoInsumos = $stmtIns->fetchAll(PDO::FETCH_ASSOC);

        $stmtAlim = $db->prepare("SELECT DISTINCT codalim, nomalim, CONCAT(codalim, ' ', nomalim) AS label 
                                  FROM histoformulaalim 
                                  WHERE fechahisto = :fec 
                                  ORDER BY codalim ASC");
        $stmtAlim->execute([':fec' => $fechahisto]);
        $catalogoAlimentos = $stmtAlim->fetchAll(PDO::FETCH_ASSOC);

        // 3. Procesar filtros seleccionados
        $selectedInsumos = [];
        if (!empty($filtros['insumos'])) {
            $selectedInsumos = is_array($filtros['insumos']) ? $filtros['insumos'] : explode(',', $filtros['insumos']);
        } elseif (!empty($filtros['insumo'])) {
            $selectedInsumos = is_array($filtros['insumo']) ? $filtros['insumo'] : [$filtros['insumo']];
        }
        $selectedInsumos = array_values(array_filter(array_map('trim', $selectedInsumos), function ($v) {
            return $v !== '' && $v !== '(Todo)' && $v !== 'TODOS';
        }));

        $selectedCodalim = [];
        if (!empty($filtros['codalim'])) {
            $selectedCodalim = is_array($filtros['codalim']) ? $filtros['codalim'] : explode(',', $filtros['codalim']);
        } elseif (!empty($filtros['alimento'])) {
            $selectedCodalim = is_array($filtros['alimento']) ? $filtros['alimento'] : [$filtros['alimento']];
        }
        $selectedCodalim = array_values(array_filter(array_map('trim', $selectedCodalim), function ($v) {
            return $v !== '' && $v !== '(Todo)' && $v !== 'TODOS';
        }));

        // 4. Construir condiciones WHERE con parámetros
        $whereConditions = ["fechahisto = :fechahisto", "fecha BETWEEN :fec_ini AND :fec_fin"];
        $params = [
            ':fechahisto' => $fechahisto,
            ':fec_ini'    => $fechaInicio,
            ':fec_fin'    => $fechaFin
        ];

        if (!empty($selectedInsumos)) {
            $inIns = [];
            foreach ($selectedInsumos as $idx => $ins) {
                $pKey = ":ins_{$idx}";
                $pLbl = ":ins_l_{$idx}";
                $inIns[] = "(codinsu = {$pKey} OR CONCAT(codinsu, ' ', nominsu) = {$pLbl})";
                $params[$pKey] = $ins;
                $params[$pLbl] = $ins;
            }
            $whereConditions[] = "(" . implode(' OR ', $inIns) . ")";
        }

        if (!empty($selectedCodalim)) {
            $inAlim = [];
            foreach ($selectedCodalim as $idx => $alm) {
                $pKey = ":alm_{$idx}";
                $pLbl = ":alm_l_{$idx}";
                $inAlim[] = "(codalim = {$pKey} OR CONCAT(codalim, ' ', nomalim) = {$pLbl})";
                $params[$pKey] = $alm;
                $params[$pLbl] = $alm;
            }
            $whereConditions[] = "(" . implode(' OR ', $inAlim) . ")";
        }

        $whereSql = implode(' AND ', $whereConditions);

        // 5. Mapeo de meses en español para labels de fechas
        $mesesNombres = [
            1 => 'enero', 2 => 'febrero', 3 => 'marzo', 4 => 'abril', 5 => 'mayo', 6 => 'junio',
            7 => 'julio', 8 => 'agosto', 9 => 'septiembre', 10 => 'octubre', 11 => 'noviembre', 12 => 'diciembre'
        ];

        // 6. Consultar Días presentes en el rango (orden descendente)
        $sqlDias = "SELECT DISTINCT fecha 
                    FROM histoformulaalim 
                    WHERE {$whereSql} 
                    ORDER BY fecha DESC";
        $stmtDias = $db->prepare($sqlDias);
        $stmtDias->execute($params);
        $rawFechas = $stmtDias->fetchAll(PDO::FETCH_COLUMN);

        $diasColumnas = [];
        foreach ($rawFechas as $fec) {
            $ts = strtotime($fec);
            $dNum = (int)date('j', $ts);
            $mNum = (int)date('n', $ts);
            $yNum = date('Y', $ts);
            $mNom = $mesesNombres[$mNum] ?? '';
            $diasColumnas[] = [
                'id'    => $fec,
                'label' => "{$dNum} de {$mNom} de {$yNum}"
            ];
        }

        // 7. Consultar Totales Generales por Alimento e Insumo (Agregación sobre el rango)
        $sqlTotales = "SELECT 
                            codalim,
                            nomalim,
                            MAX(pesalim) AS pesalim,
                            MAX(valalim) AS valalim,
                            codinsu,
                            nominsu,
                            porinsu,
                            MAX(totinsudia) AS totinsudia,
                            SUM(pesform) AS sum_pesform,
                            SUM(pescons) AS sum_pescons,
                            SUM(valcons) AS sum_valcons,
                            (SUM(valcons) / NULLIF(SUM(pescons), 0)) AS cucons,
                            (SUM(pesform) - SUM(pescons)) AS diff_pesos
                       FROM histoformulaalim
                       WHERE {$whereSql}
                       GROUP BY codalim, nomalim, codinsu, nominsu, porinsu
                       ORDER BY codalim ASC, codinsu ASC";

        $stmtTot = $db->prepare($sqlTotales);
        $stmtTot->execute($params);
        $rawTotales = $stmtTot->fetchAll(PDO::FETCH_ASSOC);

        // 8. Consultar Desglose Diario por Alimento e Insumo
        $sqlDiario = "SELECT 
                            fecha,
                            codalim,
                            nomalim,
                            MAX(pesalim) AS pesalim,
                            MAX(valalim) AS valalim,
                            codinsu,
                            nominsu,
                            porinsu,
                            MAX(totinsudia) AS totinsudia,
                            SUM(pesform) AS sum_pesform,
                            SUM(pescons) AS sum_pescons,
                            SUM(valcons) AS sum_valcons,
                            (SUM(valcons) / NULLIF(SUM(pescons), 0)) AS cucons,
                            (SUM(pesform) - SUM(pescons)) AS diff_pesos
                       FROM histoformulaalim
                       WHERE {$whereSql}
                        GROUP BY fecha, codalim, nomalim, codinsu, nominsu, porinsu
                        ORDER BY codalim ASC, codinsu ASC, fecha DESC";

        $stmtDia = $db->prepare($sqlDiario);
        $stmtDia->execute($params);
        $rawDiario = $stmtDia->fetchAll(PDO::FETCH_ASSOC);

        // Mapa diario [codalim][codinsu][fecha]
        $mapaDiario = [];
        foreach ($rawDiario as $d) {
            $fec = $d['fecha'];
            $mapaDiario[$d['codalim']][$d['codinsu']][$fec] = [
                'pesalim'              => $d['pesalim'] !== null ? number_format((float)$d['pesalim'], 2, ',', '.') : '',
                'valalim'              => $d['valalim'] !== null ? number_format((float)$d['valalim'], 2, ',', '.') : '',
                'porc_formula'         => $d['porinsu'] !== null ? number_format((float)$d['porinsu'] * 100, 3, ',', '.') . '%' : '',
                'peso_formula'         => $d['sum_pesform'] !== null ? number_format((float)$d['sum_pesform'], 2, ',', '.') : '',
                'peso_consumido'       => $d['sum_pescons'] !== null ? number_format((float)$d['sum_pescons'], 2, ',', '.') : '',
                'valor_consumido'      => $d['sum_valcons'] !== null ? number_format((float)$d['sum_valcons'], 2, ',', '.') : '',
                'cucons'               => $d['cucons'] !== null ? number_format((float)$d['cucons'], 2, ',', '.') : '',
                'diff_pesos'           => $d['diff_pesos'] !== null ? number_format((float)$d['diff_pesos'], 2, ',', '.') : '',
                'raw_peso_formula'     => (float)($d['sum_pesform'] ?? 0),
                'raw_peso_consumido'   => (float)($d['sum_pescons'] ?? 0),
                'raw_valor_consumido'  => (float)($d['sum_valcons'] ?? 0),
                'raw_diff_pesos'       => (float)($d['diff_pesos'] ?? 0),
                'color2'               => ((float)($d['totinsudia'] ?? 0) > 0) ? 0 : 1
            ];
        }

        // 9. Consultar Totales y Subtotales por Alimento
        $sqlTotAlim = "SELECT 
                            codalim,
                            nomalim,
                            MAX(pesalim) AS pesalim,
                            MAX(valalim) AS valalim,
                            SUM(pesform) AS sum_pesform,
                            SUM(pescons) AS sum_pescons,
                            SUM(valcons) AS sum_valcons,
                            (SUM(pesform) - SUM(pescons)) AS diff_pesos
                       FROM histoformulaalim
                       WHERE {$whereSql}
                       GROUP BY codalim, nomalim
                       ORDER BY codalim ASC";

        $stmtTotAlim = $db->prepare($sqlTotAlim);
        $stmtTotAlim->execute($params);
        $rawTotAlim = $stmtTotAlim->fetchAll(PDO::FETCH_ASSOC);

        $mapaTotAlim = [];
        foreach ($rawTotAlim as $ta) {
            $mapaTotAlim[$ta['codalim']] = [
                'pesalim'         => $ta['pesalim'] !== null ? number_format((float)$ta['pesalim'], 2, ',', '.') : '',
                'valalim'         => $ta['valalim'] !== null ? number_format((float)$ta['valalim'], 2, ',', '.') : '',
                'peso_formula'    => $ta['sum_pesform'] !== null ? number_format((float)$ta['sum_pesform'], 2, ',', '.') : '',
                'peso_consumido'  => $ta['sum_pescons'] !== null ? number_format((float)$ta['sum_pescons'], 2, ',', '.') : '',
                'valor_consumido' => $ta['sum_valcons'] !== null ? number_format((float)$ta['sum_valcons'], 2, ',', '.') : '',
                'diff_pesos'      => $ta['diff_pesos'] !== null ? number_format((float)$ta['diff_pesos'], 2, ',', '.') : ''
            ];
        }

        // Subtotales Diarios por Alimento
        $sqlSubDiaAlim = "SELECT 
                            fecha,
                            codalim,
                            SUM(pesform) AS sum_pesform,
                            SUM(pescons) AS sum_pescons,
                            SUM(valcons) AS sum_valcons,
                            (SUM(pesform) - SUM(pescons)) AS diff_pesos
                          FROM histoformulaalim
                          WHERE {$whereSql}
                          GROUP BY fecha, codalim
                          ORDER BY codalim ASC, fecha DESC";

        $stmtSubDiaAlim = $db->prepare($sqlSubDiaAlim);
        $stmtSubDiaAlim->execute($params);
        $rawSubDiaAlim = $stmtSubDiaAlim->fetchAll(PDO::FETCH_ASSOC);

        $mapaSubDiaAlim = [];
        foreach ($rawSubDiaAlim as $sda) {
            $mapaSubDiaAlim[$sda['codalim']][$sda['fecha']] = [
                'peso_formula'    => $sda['sum_pesform'] !== null ? number_format((float)$sda['sum_pesform'], 2, ',', '.') : '',
                'peso_consumido'  => $sda['sum_pescons'] !== null ? number_format((float)$sda['sum_pescons'], 2, ',', '.') : '',
                'valor_consumido' => $sda['sum_valcons'] !== null ? number_format((float)$sda['sum_valcons'], 2, ',', '.') : '',
                'diff_pesos'      => $sda['diff_pesos'] !== null ? number_format((float)$sda['diff_pesos'], 2, ',', '.') : ''
            ];
        }

        // 10. Estructurar Grupos de Alimentos
        $gruposMap = [];
        foreach ($rawTotales as $r) {
            $cAlim = $r['codalim'];
            if (!isset($gruposMap[$cAlim])) {
                $subTot = $mapaTotAlim[$cAlim] ?? [];
                $subDia = $mapaSubDiaAlim[$cAlim] ?? [];
                $gruposMap[$cAlim] = [
                    'codalim' => $cAlim,
                    'nomalim' => $r['nomalim'],
                    'pesalim' => $subTot['pesalim'] ?? '',
                    'valalim' => $subTot['valalim'] ?? '',
                    'insumos' => [],
                    'total'   => [
                        'peso_formula'    => $subTot['peso_formula'] ?? '',
                        'peso_consumido'  => $subTot['peso_consumido'] ?? '',
                        'valor_consumido' => $subTot['valor_consumido'] ?? '',
                        'diff_pesos'      => $subTot['diff_pesos'] ?? '',
                        'valores_diarios' => $subDia
                    ]
                ];
            }

            $cInsu = $r['codinsu'];
            $valoresDiariosInsu = $mapaDiario[$cAlim][$cInsu] ?? [];

            $gruposMap[$cAlim]['insumos'][] = [
                'codinsu'              => $cInsu,
                'nominsu'              => $r['nominsu'],
                'porinsu'              => (float)$r['porinsu'],
                'porc_formula'         => $r['porinsu'] !== null ? number_format((float)$r['porinsu'] * 100, 3, ',', '.') . '%' : '',
                'peso_formula'         => $r['sum_pesform'] !== null ? number_format((float)$r['sum_pesform'], 2, ',', '.') : '',
                'peso_consumido'       => $r['sum_pescons'] !== null ? number_format((float)$r['sum_pescons'], 2, ',', '.') : '',
                'valor_consumido'      => $r['sum_valcons'] !== null ? number_format((float)$r['sum_valcons'], 2, ',', '.') : '',
                'cucons'               => $r['cucons'] !== null ? number_format((float)$r['cucons'], 2, ',', '.') : '',
                'diff_pesos'           => $r['diff_pesos'] !== null ? number_format((float)$r['diff_pesos'], 2, ',', '.') : '',
                'raw_peso_formula'     => (float)($r['sum_pesform'] ?? 0),
                'raw_peso_consumido'   => (float)($r['sum_pescons'] ?? 0),
                'raw_valor_consumido'  => (float)($r['sum_valcons'] ?? 0),
                'raw_diff_pesos'       => (float)($r['diff_pesos'] ?? 0),
                'color2'               => ((float)($r['totinsudia'] ?? 0) > 0) ? 0 : 1,
                'valores_diarios'      => $valoresDiariosInsu
            ];
        }

        $gruposAlimentos = array_values($gruposMap);

        // 11. Total General Global
        $sqlTotGlobal = "SELECT 
                            SUM(pesform) AS sum_pesform,
                            SUM(pescons) AS sum_pescons,
                            SUM(valcons) AS sum_valcons,
                            (SUM(pesform) - SUM(pescons)) AS diff_pesos
                         FROM histoformulaalim
                         WHERE {$whereSql}";
        $stmtTG = $db->prepare($sqlTotGlobal);
        $stmtTG->execute($params);
        $rawTG = $stmtTG->fetch(PDO::FETCH_ASSOC) ?: [];

        $sqlTotDiaGlobal = "SELECT 
                                fecha,
                                SUM(pesform) AS sum_pesform,
                                SUM(pescons) AS sum_pescons,
                                SUM(valcons) AS sum_valcons,
                                (SUM(pesform) - SUM(pescons)) AS diff_pesos
                            FROM histoformulaalim
                            WHERE {$whereSql}
                            GROUP BY fecha
                            ORDER BY fecha DESC";
        $stmtTDG = $db->prepare($sqlTotDiaGlobal);
        $stmtTDG->execute($params);
        $rawTDG = $stmtTDG->fetchAll(PDO::FETCH_ASSOC);

        $mapaTotDiaGlobal = [];
        foreach ($rawTDG as $tdg) {
            $mapaTotDiaGlobal[$tdg['fecha']] = [
                'peso_formula'    => $tdg['sum_pesform'] !== null ? number_format((float)$tdg['sum_pesform'], 2, ',', '.') : '',
                'peso_consumido'  => $tdg['sum_pescons'] !== null ? number_format((float)$tdg['sum_pescons'], 2, ',', '.') : '',
                'valor_consumido' => $tdg['sum_valcons'] !== null ? number_format((float)$tdg['sum_valcons'], 2, ',', '.') : '',
                'diff_pesos'      => $tdg['diff_pesos'] !== null ? number_format((float)$tdg['diff_pesos'], 2, ',', '.') : ''
            ];
        }

        $totalGeneral = [
            'peso_formula'    => $rawTG['sum_pesform'] !== null ? number_format((float)$rawTG['sum_pesform'], 2, ',', '.') : '',
            'peso_consumido'  => $rawTG['sum_pescons'] !== null ? number_format((float)$rawTG['sum_pescons'], 2, ',', '.') : '',
            'valor_consumido' => $rawTG['sum_valcons'] !== null ? number_format((float)$rawTG['sum_valcons'], 2, ',', '.') : '',
            'diff_pesos'      => $rawTG['diff_pesos'] !== null ? number_format((float)$rawTG['diff_pesos'], 2, ',', '.') : '',
            'valores_diarios' => $mapaTotDiaGlobal
        ];

        return [
            'tipo_grafico'        => 'CA05 AnalisisFormulas',
            'fechahisto'          => $fechahisto,
            'fecha_inicio'        => $fechaInicio,
            'fecha_fin'           => $fechaFin,
            'catalogo_insumos'    => $catalogoInsumos,
            'catalogo_alimentos'  => $catalogoAlimentos,
            'filtros_seleccionados' => [
                'insumos' => $selectedInsumos,
                'codalim' => $selectedCodalim
            ],
            'dias_columnas'       => $diasColumnas,
            'grupos_alimentos'    => $gruposAlimentos,
            'total_general'       => $totalGeneral
        ];
    }
}
