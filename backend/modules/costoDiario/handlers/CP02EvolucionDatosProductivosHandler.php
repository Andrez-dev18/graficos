<?php

class CP02EvolucionDatosProductivosHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2024-04-24';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2024-04-24';

        // 1. Determinar el fechahisto adecuado
        $sqlFecha = "SELECT fechahisto 
                     FROM histodatosprod 
                     WHERE fechahisto <= :fec_fin 
                     ORDER BY fechahisto DESC 
                     LIMIT 1";
        $stmtF = $db->prepare($sqlFecha);
        $stmtF->execute([':fec_fin' => $fechaFin]);
        $fechahistoEncontrado = $stmtF->fetchColumn();

        if (!$fechahistoEncontrado) {
            // Si no hay menor o igual, buscar la primera disponible
            $sqlFirst = "SELECT fechahisto FROM histodatosprod ORDER BY fechahisto ASC LIMIT 1";
            $fechahistoEncontrado = $db->query($sqlFirst)->fetchColumn() ?: $fechaFin;
        }

        $fechahisto = $fechahistoEncontrado;

        // 2. TOTAL GENERAL (Agregación sobre todo el fechahisto)
        $sqlTotal = "SELECT 
                        SUM(saca_und) AS tot_pollos,
                        SUM(saca_kilos) AS tot_kilos,
                        (SUM(saca_kilos) / NULLIF(SUM(saca_und), 0)) AS peso_prome,
                        (SUM(calimento) / NULLIF(SUM(saca_kilos), 0)) AS ica,
                        (SUM(cantidadedad) / NULLIF(SUM(saca_und), 0)) AS prom_edad,
                        ((SUM(pollosmuertos) / NULLIF(SUM(cargapollo), 0)) * 100) AS porc_mort,
                        (SUM(saca_kilos) / NULLIF(SUM(cantidadedad), 0)) AS pgd
                     FROM histodatosprod
                     WHERE fechahisto = :fec_histo";

        $stmtTot = $db->prepare($sqlTotal);
        $stmtTot->execute([':fec_histo' => $fechahisto]);
        $rawTot = $stmtTot->fetch(PDO::FETCH_ASSOC) ?: [];

        $totalGeneral = [
            'pollos'     => number_format((float)($rawTot['tot_pollos'] ?? 0), 0, ',', '.'),
            'kilos'      => number_format((float)($rawTot['tot_kilos'] ?? 0), 0, ',', '.'),
            'peso'       => number_format((float)($rawTot['peso_prome'] ?? 0), 3, ',', '.'),
            'ica'        => number_format((float)($rawTot['ica'] ?? 0), 3, ',', '.'),
            'edad'       => number_format((float)($rawTot['prom_edad'] ?? 0), 3, ',', '.'),
            'mort'       => number_format((float)($rawTot['porc_mort'] ?? 0), 3, ',', '.'),
            'pgd'        => number_format((float)($rawTot['pgd'] ?? 0), 3, ',', '.'),
            'raw_pollos' => (float)($rawTot['tot_pollos'] ?? 0),
            'raw_kilos'  => (float)($rawTot['tot_kilos'] ?? 0),
            'raw_peso'   => (float)($rawTot['peso_prome'] ?? 0),
            'raw_ica'    => (float)($rawTot['ica'] ?? 0),
            'raw_edad'   => (float)($rawTot['prom_edad'] ?? 0),
            'raw_mort'   => (float)($rawTot['porc_mort'] ?? 0),
            'raw_pgd'    => (float)($rawTot['pgd'] ?? 0)
        ];

        // 3. COLUMNAS DE LA TABLA MATRICIAL Y COMPARATIVO (Por fecha DESC, cencos ASC, galpon ASC)
        $sqlColumnas = "SELECT 
                            fecha,
                            cencos,
                            nomcencos,
                            galpon,
                            SUM(saca_und) AS pollos,
                            SUM(saca_kilos) AS kilos,
                            (SUM(saca_kilos) / NULLIF(SUM(saca_und), 0)) AS peso,
                            (SUM(calimento) / NULLIF(SUM(saca_kilos), 0)) AS ica,
                            (SUM(cantidadedad) / NULLIF(SUM(saca_und), 0)) AS edad,
                            ((SUM(pollosmuertos) / NULLIF(SUM(cargapollo), 0)) * 100) AS mort,
                            (SUM(saca_kilos) / NULLIF(SUM(cantidadedad), 0)) AS pgd
                        FROM histodatosprod
                        WHERE fechahisto = :fec_histo
                        GROUP BY fecha, cencos, nomcencos, galpon
                        ORDER BY fecha DESC, cencos ASC, CAST(galpon AS UNSIGNED) ASC";

        $stmtCol = $db->prepare($sqlColumnas);
        $stmtCol->execute([':fec_histo' => $fechahisto]);
        $rawCols = $stmtCol->fetchAll(PDO::FETCH_ASSOC);

        $diasSemana = [
            0 => 'domingo',
            1 => 'lunes',
            2 => 'martes',
            3 => 'miércoles',
            4 => 'jueves',
            5 => 'viernes',
            6 => 'sábado'
        ];

        $columnasTabla = [];
        foreach ($rawCols as $c) {
            $fec = $c['fecha'];
            $w = (int)date('w', strtotime($fec));
            $diaSemana = $diasSemana[$w] ?? '';
            $diaFormateado = "{$diaSemana}, " . str_replace('-', '/', $fec);

            $columnasTabla[] = [
                'fecha'      => $fec,
                'dia'        => $diaFormateado,
                'cencos'     => trim($c['cencos']),
                'nomcencos'  => trim($c['nomcencos']),
                'galpon'     => trim($c['galpon']),
                'pollos'     => number_format((float)$c['pollos'], 0, ',', '.'),
                'kilos'      => number_format((float)$c['kilos'], 0, ',', '.'),
                'peso'       => number_format((float)$c['peso'], 3, ',', '.'),
                'ica'        => number_format((float)$c['ica'], 3, ',', '.'),
                'edad'       => number_format((float)$c['edad'], 3, ',', '.'),
                'mort'       => number_format((float)$c['mort'], 3, ',', '.'),
                'pgd'        => number_format((float)$c['pgd'], 3, ',', '.'),
                'raw_pollos' => (float)$c['pollos'],
                'raw_kilos'  => (float)$c['kilos'],
                'raw_peso'   => round((float)$c['peso'], 3),
                'raw_ica'    => round((float)$c['ica'], 3),
                'raw_edad'   => round((float)$c['edad'], 3),
                'raw_mort'   => round((float)$c['mort'], 3),
                'raw_pgd'    => round((float)$c['pgd'], 3)
            ];
        }

        // 4. DATOS DE TENDENCIA DIARIA (Agrupados por fecha ASC)
        $sqlTendencia = "SELECT 
                            fecha,
                            SUM(saca_und) AS pollos,
                            SUM(saca_kilos) AS kilos,
                            (SUM(saca_kilos) / NULLIF(SUM(saca_und), 0)) AS peso,
                            (SUM(calimento) / NULLIF(SUM(saca_kilos), 0)) AS ica,
                            (SUM(cantidadedad) / NULLIF(SUM(saca_und), 0)) AS edad,
                            ((SUM(pollosmuertos) / NULLIF(SUM(cargapollo), 0)) * 100) AS mort,
                            (SUM(saca_kilos) / NULLIF(SUM(cantidadedad), 0)) AS pgd
                         FROM histodatosprod
                         WHERE fechahisto = :fec_histo
                         GROUP BY fecha
                         ORDER BY fecha ASC";

        $stmtTen = $db->prepare($sqlTendencia);
        $stmtTen->execute([':fec_histo' => $fechahisto]);
        $rawTen = $stmtTen->fetchAll(PDO::FETCH_ASSOC);

        $fechas = [];
        $arrPollos = [];
        $arrKilos  = [];
        $arrPeso   = [];
        $arrIca    = [];
        $arrEdad   = [];
        $arrMort   = [];
        $arrPgd    = [];

        $rawLabels = [
            'pollos' => [],
            'kilos'  => [],
            'peso'   => [],
            'ica'    => [],
            'edad'   => [],
            'mort'   => [],
            'pgd'    => []
        ];

        foreach ($rawTen as $t) {
            $fecCorta = str_replace('-', '/', $t['fecha']);
            $fechas[] = $fecCorta;

            $pVal = (float)$t['pollos'];
            $kVal = (float)$t['kilos'];
            $wVal = round((float)$t['peso'], 3);
            $iVal = round((float)$t['ica'], 3);
            $eVal = round((float)$t['edad'], 3);
            $mVal = round((float)$t['mort'], 3);
            $gVal = round((float)$t['pgd'], 3);

            $arrPollos[] = $pVal;
            $arrKilos[]  = $kVal;
            $arrPeso[]   = $wVal;
            $arrIca[]    = $iVal;
            $arrEdad[]   = $eVal;
            $arrMort[]   = $mVal;
            $arrPgd[]    = $gVal;

            $rawLabels['pollos'][] = number_format($pVal, 0, ',', '.');
            $rawLabels['kilos'][]  = number_format($kVal, 0, ',', '.');
            $rawLabels['peso'][]   = number_format($wVal, 3, ',', '.');
            $rawLabels['ica'][]    = number_format($iVal, 3, ',', '.');
            $rawLabels['edad'][]   = number_format($eVal, 3, ',', '.');
            $rawLabels['mort'][]   = number_format($mVal, 3, ',', '.');
            $rawLabels['pgd'][]    = number_format($gVal, 3, ',', '.');
        }

        $datosTendencia = [
            'fechas'     => $fechas,
            'pollos'     => $arrPollos,
            'kilos'      => $arrKilos,
            'peso'       => $arrPeso,
            'ica'        => $arrIca,
            'edad'       => $arrEdad,
            'mort'       => $arrMort,
            'pgd'        => $arrPgd,
            'rawLabels'  => $rawLabels
        ];

        $columnasComparativo = $columnasTabla;
        usort($columnasComparativo, function($a, $b) {
            $cmpFecha = strcmp($a['fecha'], $b['fecha']);
            if ($cmpFecha !== 0) return $cmpFecha;
            $cmpCencos = strcmp($a['cencos'], $b['cencos']);
            if ($cmpCencos !== 0) return $cmpCencos;
            return (int)$a['galpon'] <=> (int)$b['galpon'];
        });

        return [
            'tipo_grafico'        => 'CP02 EvolucionDatosProductivos',
            'fechahisto'          => $fechahisto,
            'totalGeneral'        => $totalGeneral,
            'columnasTabla'       => $columnasTabla,
            'columnasComparativo' => $columnasComparativo,
            'datosTendencia'      => $datosTendencia
        ];
    }
}
