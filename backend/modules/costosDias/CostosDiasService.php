<?php

require_once __DIR__ . '/CostosDiasRepo.php';

class CostosDiasService
{
    private $repo;

    private static $mesesNombres = [
        '01' => 'Enero', '02' => 'Febrero', '03' => 'Marzo', '04' => 'Abril',
        '05' => 'Mayo', '06' => 'Junio', '07' => 'Julio', '08' => 'Agosto',
        '09' => 'Septiembre', '10' => 'Octubre', '11' => 'Noviembre', '12' => 'Diciembre'
    ];

    public function __construct(PDO $db)
    {
        $this->repo = new CostosDiasRepo($db);
    }

    /**
     * Procesa y estructura los datos del dashboard para GraficaCosto y Matriz Detalle
     */
    public function obtenerDashboard(array $filtros): array
    {
        // 1. Parsear rangos de período
        $fechaInicio = !empty($filtros['fecha_inicio']) ? $filtros['fecha_inicio'] : '2025-01-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? $filtros['fecha_fin'] : '2025-12-31';

        $periodoIni = str_replace('-', '', substr($fechaInicio, 0, 7)); // e.g. 202501
        $periodoFin = str_replace('-', '', substr($fechaFin, 0, 7));    // e.g. 202512

        // 2. Consultar repositorio
        $rawGrafica = $this->repo->getGraficaCosto($periodoIni, $periodoFin);
        $rawMatriz  = $this->repo->getMatrizCostos($periodoIni, $periodoFin);

        // 3. Formatear datos cronológicos por año y período
        $graficaCosto    = [];
        $graficaPorAnio  = [];
        $periodos        = [];
        $aniosEstructura = [];
        $aniosLista      = [];
        $prevTotalRaw    = null;

        foreach ($rawGrafica as $g) {
            $anio   = trim($g['tanio']);
            $mesNum = str_pad(trim($g['tmes']), 2, '0', STR_PAD_LEFT);
            $mesNom = self::$mesesNombres[$mesNum] ?? (!empty($g['tnomMes']) ? ucfirst(strtolower($g['tnomMes'])) : "Mes $mesNum");
            $key    = "$anio-$mesNum";

            if (!in_array($anio, $aniosLista)) {
                $aniosLista[] = $anio;
            }

            $rawCU = (float)$g['cu'];
            $difTotal = ($prevTotalRaw !== null) ? round(($prevTotalRaw - $rawCU), 3) : null;
            if ($difTotal !== null && abs($difTotal) < 0.000001) {
                $difTotal = 0.0;
            }

            $punto = [
                'key'     => $key,
                'anio'    => $anio,
                'mes'     => $mesNom,
                'mes_num' => $mesNum,
                'costo'   => round($rawCU, 3),
                'dif'     => $difTotal,
                'importe' => (float)$g['sum_importe'],
                'peso'    => (float)$g['pes_mes']
            ];

            $graficaCosto[] = $punto;
            $graficaPorAnio[$anio][] = $punto;

            $periodos[] = [
                'key'     => $key,
                'anio'    => $anio,
                'mes'     => $mesNom,
                'mes_num' => $mesNum
            ];

            if (!isset($aniosEstructura[$anio])) {
                $aniosEstructura[$anio] = [
                    'anio'  => $anio,
                    'meses' => []
                ];
            }
            $aniosEstructura[$anio]['meses'][] = [
                'key'     => $key,
                'mes'     => $mesNom,
                'mes_num' => $mesNum
            ];

            $prevTotalRaw = $rawCU;
        }

        // 4. Mapear y jerarquizar matriz de Familias y SubFamilias indexadas por clave única $anio-$mes
        $familiasMap = [];
        foreach ($rawMatriz as $row) {
            $famCod = trim($row['tcodgrupo1']);
            $famNom = trim($row['familia']);
            $subCod = trim($row['tcodgrupo2']);
            $subNom = trim($row['subfamilia']);
            $anio   = trim($row['tanio']);
            $mesNum = str_pad(trim($row['tmes']), 2, '0', STR_PAD_LEFT);
            $key    = "$anio-$mesNum";

            if (!isset($familiasMap[$famCod])) {
                $familiasMap[$famCod] = [
                    'codigo'      => $famCod,
                    'familia'     => $famNom,
                    'subfamilias' => []
                ];
            }

            if (!isset($familiasMap[$famCod]['subfamilias'][$subCod])) {
                $familiasMap[$famCod]['subfamilias'][$subCod] = [
                    'codigo'      => $subCod,
                    'subfamilia'  => $subNom,
                    'valores_raw' => []
                ];
            }

            $familiasMap[$famCod]['subfamilias'][$subCod]['valores_raw'][$key] = (float)$row['cu'];
        }

        // 5. Calcular variaciones (Dif) cronológicamente a través de todos los períodos
        $matrizFamilias = [];
        foreach ($familiasMap as $famCod => $famData) {
            $subfamiliasArr = [];
            foreach ($famData['subfamilias'] as $subCod => $subData) {
                $valoresFinal = [];
                $prevCURaw = null;

                foreach ($periodos as $p) {
                    $pKey = $p['key'];
                    if (isset($subData['valores_raw'][$pKey])) {
                        $cuRaw = (float)$subData['valores_raw'][$pKey];
                        $cuActual = round($cuRaw, 3);
                        $dif = ($prevCURaw !== null) ? round(($prevCURaw - $cuRaw), 3) : null;
                        if ($dif !== null && abs($dif) < 0.000001) {
                            $dif = 0.0;
                        }
                        $valoresFinal[$pKey] = [
                            'key'  => $pKey,
                            'anio' => $p['anio'],
                            'mes'  => $p['mes'],
                            'cu'   => $cuActual,
                            'dif'  => $dif
                        ];
                        $prevCURaw = $cuRaw;
                    } else {
                        $cuRaw = 0.0;
                        $dif = ($prevCURaw !== null) ? round(($prevCURaw - 0.0), 3) : null;
                        if ($dif !== null && abs($dif) < 0.000001) {
                            $dif = 0.0;
                        }
                        $valoresFinal[$pKey] = [
                            'key'  => $pKey,
                            'anio' => $p['anio'],
                            'mes'  => $p['mes'],
                            'cu'   => 0.000,
                            'dif'  => $dif
                        ];
                        $prevCURaw = $cuRaw;
                    }
                }

                $subfamiliasArr[] = [
                    'codigo'      => $subCod,
                    'subfamilia'  => $subData['subfamilia'],
                    'valores'     => $valoresFinal
                ];
            }

            $matrizFamilias[] = [
                'codigo'      => $famData['codigo'],
                'familia'     => $famData['familia'],
                'subfamilias' => $subfamiliasArr
            ];
        }

        return [
            'status'          => 'success',
            'anio'            => !empty($aniosLista) ? implode(' - ', $aniosLista) : '2025',
            'aniosLista'      => $aniosLista,
            'aniosEstructura' => array_values($aniosEstructura),
            'periodos'        => $periodos,
            'meses'           => array_column($periodos, 'mes'),
            'graficaCosto'    => $graficaCosto,
            'graficaPorAnio'  => $graficaPorAnio,
            'matrizFamilias'  => $matrizFamilias
        ];
    }
}
