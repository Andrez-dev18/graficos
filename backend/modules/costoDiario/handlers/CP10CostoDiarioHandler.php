<?php

class CP10CostoDiarioHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        // 1. Obtener lista de Meses Disponibles
        $stmtMeses = $db->query("
            SELECT DISTINCT DATE_FORMAT(fechahisto, '%Y-%m') as mes_val
            FROM histodatosalmaacucompa
            ORDER BY mes_val DESC
        ");
        $mesesRaw = $stmtMeses->fetchAll(PDO::FETCH_COLUMN);

        $mesesDisponibles = [];
        $mesesNombres = [
            '01' => 'enero', '02' => 'febrero', '03' => 'marzo', '04' => 'abril',
            '05' => 'mayo', '06' => 'junio', '07' => 'julio', '08' => 'agosto',
            '09' => 'septiembre', '10' => 'octubre', '11' => 'noviembre', '12' => 'diciembre'
        ];

        foreach ($mesesRaw as $mVal) {
            if (!$mVal) continue;
            $parts = explode('-', $mVal);
            $year = $parts[0];
            $monthNum = $parts[1] ?? '01';
            $monthName = $mesesNombres[$monthNum] ?? $monthNum;
            $mesesDisponibles[] = [
                'val' => $mVal,
                'label' => "{$monthName} de {$year}"
            ];
        }

        // 2. Determinar Mes Activo
        $mesSeleccionado = !empty($filtros['mes']) ? trim($filtros['mes']) : null;
        if (!$mesSeleccionado && !empty($filtros['fecha_inicio'])) {
            $mesSeleccionado = substr(trim($filtros['fecha_inicio']), 0, 7);
        }
        if (!$mesSeleccionado && !empty($filtros['fechahisto'])) {
            $mesSeleccionado = substr(trim($filtros['fechahisto']), 0, 7);
        }
        if (!$mesSeleccionado) {
            $mesSeleccionado = $mesesRaw[0] ?? '2026-08';
        }

        // Normalizar si viene en formato texto "agosto de 2026"
        if (strpos($mesSeleccionado, ' de ') !== false) {
            foreach ($mesesDisponibles as $mOpt) {
                if (strtolower($mOpt['label']) === strtolower($mesSeleccionado)) {
                    $mesSeleccionado = $mOpt['val'];
                    break;
                }
            }
        }

        $mesParts = explode('-', $mesSeleccionado);
        $mesYear = $mesParts[0] ?? '2026';
        $mesNum = $mesParts[1] ?? '08';
        $mesLabel = ($mesesNombres[$mesNum] ?? $mesNum) . " de " . $mesYear;

        // 3. Obtener Días Disponibles en el Mes Seleccionado
        $stmtDias = $db->prepare("
            SELECT DISTINCT fechahisto
            FROM histodatosalmaacucompa
            WHERE DATE_FORMAT(fechahisto, '%Y-%m') = :mes
            ORDER BY fechahisto ASC
        ");
        $stmtDias->execute([':mes' => $mesSeleccionado]);
        $diasMes = $stmtDias->fetchAll(PDO::FETCH_COLUMN);

        // Si no hay días en ese mes en histodatosalmaacucompa, buscar en histodatosprod
        if (empty($diasMes)) {
            $stmtDias2 = $db->prepare("
                SELECT DISTINCT fechahisto
                FROM histodatosprod
                WHERE DATE_FORMAT(fechahisto, '%Y-%m') = :mes
                ORDER BY fechahisto ASC
            ");
            $stmtDias2->execute([':mes' => $mesSeleccionado]);
            $diasMes = $stmtDias2->fetchAll(PDO::FETCH_COLUMN);
        }

        // 4. Determinar Día Activo para la Tabla 2 (fechahisto)
        $diaSeleccionado = !empty($filtros['fecha_dia']) ? trim($filtros['fecha_dia']) : (!empty($filtros['fechahisto']) ? trim($filtros['fechahisto']) : null);
        
        // Verificar si el día seleccionado pertenece al mes activo
        if (!$diaSeleccionado || substr($diaSeleccionado, 0, 7) !== $mesSeleccionado) {
            $diaSeleccionado = !empty($diasMes) ? end($diasMes) : ($mesSeleccionado . '-01');
        }

        // =========================================================================
        // 5. TABLA 1: COSTO PRODUCCIÓN POR KG DE POLLO VIVO DÍA A DÍA
        // =========================================================================
        $stmtT1 = $db->prepare("
            SELECT 
                fechahisto,
                linea,
                nomlinea,
                SUM(valor) as valor,
                SUM(comodin) as comodin,
                CASE WHEN SUM(comodin) > 0 THEN SUM(valor) / SUM(comodin) ELSE 0 END as cu
            FROM histodatosalmaacucompa
            WHERE DATE_FORMAT(fechahisto, '%Y-%m') = :mes
            GROUP BY fechahisto, linea, nomlinea
            ORDER BY linea, fechahisto ASC
        ");
        $stmtT1->execute([':mes' => $mesSeleccionado]);
        $rawT1 = $stmtT1->fetchAll(PDO::FETCH_ASSOC);

        $diasHeaders = [];
        $diasSet = [];
        foreach ($diasMes as $dStr) {
            $dayNum = (int)date('j', strtotime($dStr));
            $diasHeaders[] = [
                'fecha' => $dStr,
                'dia_num' => $dayNum,
                'label' => "{$dayNum} de {$mesLabel}"
            ];
            $diasSet[$dStr] = true;
        }

        $lineasMap = [];
        foreach ($rawT1 as $r) {
            $lin = (string)$r['linea'];
            $nom = (string)$r['nomlinea'];
            $fec = (string)$r['fechahisto'];
            $cu = (float)$r['cu'];
            $val = (float)$r['valor'];
            $com = (float)$r['comodin'];

            if (!isset($lineasMap[$lin])) {
                $lineasMap[$lin] = [
                    'linea' => $lin,
                    'nomlinea' => $nom,
                    'dias_raw' => []
                ];
            }

            $lineasMap[$lin]['dias_raw'][$fec] = [
                'cu' => $cu,
                'valor' => $val,
                'comodin' => $com
            ];
        }

        $tabla1Filas = [];
        foreach ($lineasMap as $lin => $lInfo) {
            $diasValores = [];
            $prevCu = null;

            foreach ($diasHeaders as $idx => $dh) {
                $fec = $dh['fecha'];
                $dData = $lInfo['dias_raw'][$fec] ?? null;

                if ($dData !== null) {
                    $cu = (float)$dData['cu'];
                    $dif = null;

                    if ($idx > 0 && $prevCu !== null) {
                        $dif = round($cu - $prevCu, 3);
                    }

                    $diasValores[$fec] = [
                        'cu' => $cu,
                        'dif_ant' => $dif,
                        'valor' => (float)$dData['valor'],
                        'comodin' => (float)$dData['comodin']
                    ];

                    $prevCu = $cu;
                } else {
                    $diasValores[$fec] = [
                        'cu' => null,
                        'dif_ant' => null,
                        'valor' => null,
                        'comodin' => null,
                        'sin_datos' => true
                    ];
                }
            }

            $tabla1Filas[] = [
                'linea' => $lInfo['linea'],
                'nomlinea' => $lInfo['nomlinea'],
                'dias' => $diasValores
            ];
        }

        // =========================================================================
        // 6. TABLA 2: DATOS PRODUCTIVOS POR DÍA (al día fechahisto seleccionado)
        // =========================================================================
        $stmtT2 = $db->prepare("
            SELECT 
                fecha,
                cencos,
                nomcencos,
                galpon,
                SUM(saca_und) as saca_und,
                SUM(saca_kilos) as saca_kilos,
                CASE WHEN SUM(saca_und) > 0 THEN SUM(saca_kilos) / SUM(saca_und) ELSE 0 END as peso_promedio,
                CASE WHEN SUM(saca_kilos) > 0 THEN SUM(calimento) / SUM(saca_kilos) ELSE 0 END as ica,
                CASE WHEN SUM(saca_und) > 0 THEN SUM(cantidadedad) / SUM(saca_und) ELSE 0 END as prom_edad_ven,
                CASE WHEN SUM(cargapollo) > 0 THEN (SUM(pollosmuertos) / SUM(cargapollo)) * 100 ELSE 0 END as porc_mort,
                CASE WHEN SUM(cantidadedad) > 0 THEN (SUM(saca_kilos) / SUM(saca_und)) / (SUM(cantidadedad) / SUM(saca_und)) ELSE 0 END as pgd
            FROM histodatosprod
            WHERE fechahisto = :fec_dia
            GROUP BY fecha, cencos, nomcencos, galpon
            ORDER BY fecha DESC, cencos ASC, CAST(galpon AS UNSIGNED) ASC
        ");
        $stmtT2->execute([':fec_dia' => $diaSeleccionado]);
        $rawT2 = $stmtT2->fetchAll(PDO::FETCH_ASSOC);

        // Total general de la Tabla 2
        $stmtTot2 = $db->prepare("
            SELECT 
                SUM(saca_und) as total_und,
                SUM(saca_kilos) as total_kilos,
                CASE WHEN SUM(saca_und) > 0 THEN SUM(saca_kilos) / SUM(saca_und) ELSE 0 END as peso_promedio,
                CASE WHEN SUM(saca_kilos) > 0 THEN SUM(calimento) / SUM(saca_kilos) ELSE 0 END as ica,
                CASE WHEN SUM(saca_und) > 0 THEN SUM(cantidadedad) / SUM(saca_und) ELSE 0 END as prom_edad_ven,
                CASE WHEN SUM(cargapollo) > 0 THEN (SUM(pollosmuertos) / SUM(cargapollo)) * 100 ELSE 0 END as porc_mort,
                CASE WHEN SUM(cantidadedad) > 0 THEN (SUM(saca_kilos) / SUM(saca_und)) / (SUM(cantidadedad) / SUM(saca_und)) ELSE 0 END as pgd
            FROM histodatosprod
            WHERE fechahisto = :fec_dia
        ");
        $stmtTot2->execute([':fec_dia' => $diaSeleccionado]);
        $tot2 = $stmtTot2->fetch(PDO::FETCH_ASSOC) ?: [];

        $diasSemana = [
            0 => 'domingo', 1 => 'lunes', 2 => 'martes', 3 => 'miércoles',
            4 => 'jueves', 5 => 'viernes', 6 => 'sábado'
        ];

        $columnasT2 = [];
        foreach ($rawT2 as $r) {
            $fec = $r['fecha'];
            $timestamp = strtotime($fec);
            $wDay = $diasSemana[(int)date('w', $timestamp)] ?? '';
            $fecFormatted = date('Y/m/d', $timestamp);
            $fecLabel = "{$wDay}, {$fecFormatted}";

            $columnasT2[] = [
                'fecha' => $fec,
                'fecha_label' => $fecLabel,
                'cencos' => $r['cencos'],
                'nomcencos' => $r['nomcencos'],
                'galpon' => $r['galpon'],
                'valores' => [
                    'saca_und' => (float)$r['saca_und'],
                    'saca_kilos' => (float)$r['saca_kilos'],
                    'peso_promedio' => (float)$r['peso_promedio'],
                    'ica' => (float)$r['ica'],
                    'prom_edad_ven' => (float)$r['prom_edad_ven'],
                    'porc_mort' => (float)$r['porc_mort'],
                    'pgd' => (float)$r['pgd']
                ]
            ];
        }

        $totalGeneralT2 = [
            'saca_und' => (float)($tot2['total_und'] ?? 0),
            'saca_kilos' => (float)($tot2['total_kilos'] ?? 0),
            'peso_promedio' => (float)($tot2['peso_promedio'] ?? 0),
            'ica' => (float)($tot2['ica'] ?? 0),
            'prom_edad_ven' => (float)($tot2['prom_edad_ven'] ?? 0),
            'porc_mort' => (float)($tot2['porc_mort'] ?? 0),
            'pgd' => (float)($tot2['pgd'] ?? 0)
        ];

        // Total General para Tabla 1 (Día a Día)
        $totalT1Dias = [];
        $prevTotCu = null;
        foreach ($diasHeaders as $idx => $dh) {
            $fec = $dh['fecha'];
            $dayCu = 0.0;
            $dayValor = 0.0;
            $dayComodin = 0.0;
            $hasData = false;

            foreach ($tabla1Filas as $f) {
                $d = $f['dias'][$fec] ?? null;
                if ($d && empty($d['sin_datos']) && $d['cu'] !== null) {
                    $dayCu += (float)$d['cu'];
                    $dayValor += (float)$d['valor'];
                    if ((float)$d['comodin'] > $dayComodin) {
                        $dayComodin = (float)$d['comodin'];
                    }
                    $hasData = true;
                }
            }

            if ($hasData) {
                $difTot = null;
                if ($idx > 0 && $prevTotCu !== null) {
                    $difTot = round($dayCu - $prevTotCu, 3);
                }
                $totalT1Dias[$fec] = [
                    'cu' => $dayCu,
                    'dif_ant' => $difTot,
                    'valor' => $dayValor,
                    'comodin' => $dayComodin
                ];
                $prevTotCu = $dayCu;
            } else {
                $totalT1Dias[$fec] = [
                    'cu' => null,
                    'dif_ant' => null,
                    'valor' => null,
                    'comodin' => null,
                    'sin_datos' => true
                ];
            }
        }

        return [
            'status' => 'success',
            'mes_seleccionado' => $mesSeleccionado,
            'mes_label' => $mesLabel,
            'dia_seleccionado' => $diaSeleccionado,
            'meses_disponibles' => $mesesDisponibles,
            'dias_disponibles_mes' => $diasMes,
            'tabla1_costo_dia_a_dia' => [
                'dias_headers' => $diasHeaders,
                'filas' => $tabla1Filas,
                'total_general' => $totalT1Dias
            ],
            'tabla2_datos_productivos_dia' => [
                'dia_activo' => $diaSeleccionado,
                'columnas' => $columnasT2,
                'total_general' => $totalGeneralT2
            ]
        ];
    }
}
