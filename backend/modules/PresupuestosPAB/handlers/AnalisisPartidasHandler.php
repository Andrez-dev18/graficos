<?php

class AnalisisPartidasHandler
{
    /**
     * Procesa la consulta para el reporte AnalisisPartidas / Compras por Partida
     * 
     * @param PDO $db
     * @param array $filtros
     * @return array
     */
    public static function handle(PDO $db, array $filtros): array
    {
        // 1. Obtener lista completa y exacta de códigos de presupuesto (idéntica a filtro1.png y filtro2.png de Tableau)
        $presupuestosDisponibles = self::obtenerPresupuestosDisponibles($db);

        // 2. Determinar presupuesto seleccionado (por defecto 202410 como en Tableau)
        $presupuestoSeleccionado = '202410';
        if (isset($filtros['presupuesto']) && trim($filtros['presupuesto']) !== '') {
            $presupuestoSeleccionado = trim($filtros['presupuesto']);
        } elseif (isset($filtros['codigo_presupuesto']) && trim($filtros['codigo_presupuesto']) !== '') {
            $presupuestoSeleccionado = trim($filtros['codigo_presupuesto']);
        }

        // 3. Consulta de movimientos de compras por partida (dmovtableau + ccte)
        $whereSql = "WHERE d.presu IS NOT NULL AND TRIM(d.presu) != ''";
        $params = [];

        if ($presupuestoSeleccionado !== '(Todo)' && $presupuestoSeleccionado !== 'Todo' && $presupuestoSeleccionado !== 'all' && $presupuestoSeleccionado !== '*') {
            $whereSql .= " AND d.presu LIKE ?";
            $params[] = $presupuestoSeleccionado . '%';
        }

        $sql = "
            SELECT 
                TRIM(MID(d.presu, 7, 10)) AS partida,
                d.dalm AS zona,
                d.tdoc AS tipodoc,
                COALESCE(d.tseriealf, '') AS seriealfa,
                d.dnumfac AS nrodoc,
                d.dprocli AS ruc,
                c.nombre AS nombre,
                d.dcencos AS cencos,
                GROUP_CONCAT(DISTINCT NULLIF(TRIM(d.dglosa), '') SEPARATOR ' | ') AS glosa,
                SUM(CAST(d.dimport AS DECIMAL(14,2))) AS valor
            FROM dmovtableau d
            INNER JOIN ccte c ON d.dprocli = c.codigo
            $whereSql
            GROUP BY 
                TRIM(MID(d.presu, 7, 10)),
                d.dalm,
                d.tdoc,
                COALESCE(d.tseriealf, ''),
                d.dnumfac,
                d.dprocli,
                c.nombre,
                d.dcencos
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 4. Ordenamiento numérico por Partida (ej. 1.1, 2.1, 6.1, 7.1, 8.1, 9.1, 9.2, 10.1, 11.1, 11.2, 11.3)
        usort($filas, function ($a, $b) {
            $pA = explode('.', (string) $a['partida']);
            $pB = explode('.', (string) $b['partida']);
            $n1A = (int) ($pA[0] ?? 0);
            $n1B = (int) ($pB[0] ?? 0);
            if ($n1A !== $n1B) {
                return $n1A <=> $n1B;
            }
            $n2A = (int) ($pA[1] ?? 0);
            $n2B = (int) ($pB[1] ?? 0);
            if ($n2A !== $n2B) {
                return $n2A <=> $n2B;
            }
            $cmpDoc = strcmp((string) $a['nrodoc'], (string) $b['nrodoc']);
            if ($cmpDoc !== 0) {
                return $cmpDoc;
            }
            return strcmp((string) $a['seriealfa'], (string) $b['seriealfa']);
        });

        // 5. Agrupación por Partida, cálculo de Subtotales y Gran Total
        $partidasAgrupadas = [];
        $granTotal = 0.0;
        $maxValor = 0.0;

        foreach ($filas as $f) {
            $partidaKey = $f['partida'] !== '' ? $f['partida'] : 'Sin Partida';
            $valor = (float) ($f['valor'] ?? 0);

            if (!isset($partidasAgrupadas[$partidaKey])) {
                $partidasAgrupadas[$partidaKey] = [
                    'partida'   => $partidaKey,
                    'subtotal'  => 0.0,
                    'items'     => []
                ];
            }

            $partidasAgrupadas[$partidaKey]['subtotal'] += $valor;
            $granTotal += $valor;
            if ($valor > $maxValor) {
                $maxValor = $valor;
            }

            $partidasAgrupadas[$partidaKey]['items'][] = [
                'partida'   => $partidaKey,
                'zona'      => $f['zona'] ?? '',
                'tipodoc'   => $f['tipodoc'] ?? '',
                'seriealfa' => $f['seriealfa'] ?? '',
                'nrodoc'    => $f['nrodoc'] ?? '',
                'ruc'       => $f['ruc'] ?? '',
                'nombre'    => $f['nombre'] ?? '',
                'cencos'    => $f['cencos'] ?? '',
                'glosa'     => $f['glosa'] ?? '',
                'valor'     => $valor
            ];
        }

        // Subtotal máximo para escala
        foreach ($partidasAgrupadas as $p) {
            if ($p['subtotal'] > $maxValor) {
                $maxValor = $p['subtotal'];
            }
        }

        return [
            'success'                   => true,
            'titulo'                    => 'Compras por Partida',
            'presupuesto_seleccionado'  => $presupuestoSeleccionado,
            'presupuesto_nombre'        => $presupuestoSeleccionado,
            'presupuestos_disponibles'  => $presupuestosDisponibles,
            'gran_total'                => $granTotal,
            'max_valor'                 => $maxValor,
            'total_partidas'            => count($partidasAgrupadas),
            'total_documentos'          => count($filas),
            'partidas'                  => array_values($partidasAgrupadas)
        ];
    }

    /**
     * Obtiene la lista exacta de códigos de presupuestos disponibles según Tableau (filtro1.png y filtro2.png)
     */
    private static function obtenerPresupuestosDisponibles(PDO $db): array
    {
        // Orden exacto de Tableau documentado en las capturas filtro1.png y filtro2.png
        $tableauExactList = [
            "(Todo)",
            "0", "1", "1.4", "2", "3", "6", "6.2", "9",
            "00", "17", "19", "000", "001", "100", "0000", "1180",
            "20403", "20504", "20601",
            "202050", "202260", "202304",
            "202401", "202402", "202403", "202405", "202407", "202408", "202409",
            "202410", "202411",
            "202501", "202502", "202503", "202504", "202505",
            "202601", "202602", "202603", "202604", "202605", "202606", "202610",
            "206010", "206101", "206202"
        ];

        // Consultar dinámicamente de la base de datos para asegurar sincronía con cualquier nuevo registro
        try {
            $sql = "
                SELECT DISTINCT TRIM(LEFT(presu, 6)) AS codigo
                FROM dmovtableau
                WHERE presu IS NOT NULL AND TRIM(presu) != ''
                UNION
                SELECT DISTINCT TRIM(LEFT(presupuesto, 6)) AS codigo
                FROM tmppresucencos
                WHERE presupuesto IS NOT NULL AND TRIM(presupuesto) != ''
            ";
            $stmt = $db->query($sql);
            $dbCodes = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            $allCodes = array_unique(array_merge($tableauExactList, $dbCodes));
            
            // Ordenar respetando el orden natural de Tableau (filtro1 y filtro2)
            $orderMap = array_flip($tableauExactList);
            usort($allCodes, function ($a, $b) use ($orderMap) {
                if ($a === '(Todo)') return -1;
                if ($b === '(Todo)') return 1;
                $idxA = $orderMap[$a] ?? 999;
                $idxB = $orderMap[$b] ?? 999;
                if ($idxA !== $idxB) return $idxA <=> $idxB;
                return strcmp($a, $b);
            });

            return array_map(function ($c) {
                return ['codigo' => $c, 'nombre' => $c];
            }, $allCodes);
        } catch (\Exception $e) {
            return array_map(function ($c) {
                return ['codigo' => $c, 'nombre' => $c];
            }, $tableauExactList);
        }
    }
}
