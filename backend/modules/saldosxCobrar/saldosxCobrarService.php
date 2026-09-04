<?php
require_once __DIR__ . '/saldosxCobrarRepo.php';

class saldosxCobrarService
{
    private $repo;

    public function __construct($db)
    {
        $this->repo = new saldosxCobrarRepo($db);
    }

    /**
     * FUNCIONES PARA GRAFICO DE BARRAS SALDOS POR COBRAR
     * Devuelve las opciones formateadas para los dropdowns de filtros
     */
    public function obtenerFiltrosIniciales()
    {
        $cuentasRaw = $this->repo->getCuentasVenta();
        $clientesRaw = $this->repo->getClientes();

        $cuentas = array_map(function ($item) {
            return [
                'id' => $item['cuentaventa'],
                'label' => $item['cuentaventa'] . ' - ' . $item['nomcuentaventa']
            ];
        }, $cuentasRaw);

        $clientes = array_map(function ($item) {
            return [
                'id' => $item['nomcliente'],
                'label' => $item['nomcliente']
            ];
        }, $clientesRaw);

        return [
            'cuentas' => $cuentas,
            'clientes' => $clientes
        ];
    }

    /**
     * Procesa la lógica de cálculo de saldos y estructura la salida por cuenta
     */
    public function obtenerSaldosGrafico(array $filtros)
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-01-01');
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');
        $cuentas     = is_array($filtros['cuentas'] ?? null) ? $filtros['cuentas'] : [];
        $clientes    = is_array($filtros['clientes'] ?? null) ? $filtros['clientes'] : [];

        if (empty($cuentas)) {
            return [
                'status' => 'empty',
                'message' => 'Debe seleccionar al menos una cuenta de venta',
                'data' => []
            ];
        }

        $registros = $this->repo->getSaldosPorCuentaPorDia($fechaInicio, $fechaFin, $cuentas, $clientes);

        // Agrupar registros por cuentaventa para facilitar el render de tarjetas
        $dataAgrupada = [];
        foreach ($cuentas as $cta) {
            $dataAgrupada[$cta] = [];
        }

        foreach ($registros as $row) {
            $cta = $row['cuentaventa'];
            if (!isset($dataAgrupada[$cta])) {
                $dataAgrupada[$cta] = [];
            }

            $dataAgrupada[$cta][] = [
                'fecha' => $row['fechacarga'],
                'nomcuentaventa' => $row['nomcuentaventa'],
                'saldofinal' => (float) $row['total_saldofinal']
            ];
        }

        return [
            'status' => 'success',
            'periodo' => [
                'inicio' => $fechaInicio,
                'fin' => $fechaFin
            ],
            'cuentas' => $cuentas,
            'data' => $dataAgrupada
        ];
    }

    /**
     * Procesa los datos de Resumen y Datos Completos para el modal 'Ver Datos'
     */
    public function obtenerDetalleModal(array $params)
    {
        $cuentaventa = $params['cuentaventa'] ?? '';
        $fechacarga  = $params['fechacarga'] ?? '';
        $nomcorp     = $params['nomcorporativo'] ?? '';
        $tipoGrafico = $params['tipo_grafico'] ?? '';

        // Para gráficos estándar se requiere cuentaventa. Para 18CorporativosZonaDeudores se requiere nomcorporativo y fechacarga
        if ($tipoGrafico === '18CorporativosZonaDeudores') {
            if (empty($nomcorp) || empty($fechacarga)) {
                return [
                    'status' => 'error',
                    'message' => 'Parámetros nomcorporativo y fechacarga son requeridos',
                    'resumen' => null,
                    'datos_completos' => []
                ];
            }
        } else {
            if (empty($cuentaventa) || empty($fechacarga)) {
                return [
                    'status' => 'error',
                    'message' => 'Parámetros cuentaventa y fechacarga son requeridos',
                    'resumen' => null,
                    'datos_completos' => []
                ];
            }
        }

        // Pasar los filtros dinámicos al repo
        $detalleRaw = $this->repo->getDetallePorCuentaYFecha($params);

        $totalSaldofinal = 0.0;
        $totalSaldoinicial = 0.0;
        $datosCompletos = array_map(function ($row) use (&$totalSaldofinal, &$totalSaldoinicial) {
            $monto = (float) $row['saldofinal'];
            $saldoIni = (float) ($row['saldoinicial'] ?? 0);
            $totalSaldofinal += $monto;
            $totalSaldoinicial += $saldoIni;

            $restaSaldo = round($saldoIni - $monto, 2);
            // En Tableau: ROUND(..., 2) y formateado a 5 decimales (ej. 0,54000, 0,99000)
            $ratio = ($saldoIni != 0.0) ? round(round($restaSaldo / $saldoIni, 2), 5) : 0.0;

            return [
                'cuentaventa'    => $row['cuentaventa'],
                'nomcuentaventa' => $row['nomcuentaventa'],
                'zonafiscal'     => $row['zonafiscal'],
                'fechacarga'     => $row['fechacarga'],
                'codcliente'     => $row['codcliente'],
                'nomcliente'     => $row['nomcliente'],
                'condicionpago'  => $row['condicionpago'],
                'numerodoc'      => $row['numerodoc'],
                'decision'       => $row['decision'],
                'observacion'    => $row['observacion'],
                'vencimiento'    => $row['vencimiento'],
                'saldofinal'     => $monto,
                'saldoinicial'   => $saldoIni,
                'resta_saldo'    => $restaSaldo,
                'ratio_cobranza' => $ratio,
                'fechacontable'  => $row['fechacontable'] ?? '',
                'horacreacion'   => $row['horacreacion'] ?? '',
                'nomcorporativo' => $row['nomcorporativo'] ?? ''
            ];
        }, $detalleRaw);

        $sumResta = round($totalSaldoinicial - $totalSaldofinal, 2);
        // En Tableau: ROUND((sum([saldoinicial])-sum([saldofinal]))/sum([saldoinicial]), 2) y formateado a 6 decimales (ej. 0,430000)
        $ratioCobranza = ($totalSaldoinicial != 0.0) ? round(round($sumResta / $totalSaldoinicial, 2), 6) : 0.0;

        return [
            'status' => 'success',
            'resumen' => [
                'nomcorporativo' => $nomcorp ?: ($detalleRaw[0]['nomcorporativo'] ?? ''),
                'cuentaventa'    => $cuentaventa,
                'nomcuentaventa' => $detalleRaw[0]['nomcuentaventa'] ?? '',
                'zonafiscal'     => $params['zonafiscal'] ?? ($detalleRaw[0]['zonafiscal'] ?? ''),
                'fechacarga'     => $fechacarga,
                'saldofinal'     => round($totalSaldofinal, 2),
                'saldoinicial'   => round($totalSaldoinicial, 2),
                'resta_saldo'    => $sumResta,
                'ratio_cobranza' => $ratioCobranza
            ],
            'total_filas' => count($datosCompletos),
            'datos_completos' => $datosCompletos
        ];
    }


    /**
     * FUNCIONES PARA GRAFICO DE LINEAS SALDOS POR COBRAR
     */

    /**
     * Obtiene y formatea las opciones de filtros para la vista por zonas
     */
    public function obtenerFiltrosZona()
    {
        return $this->repo->getFiltrosZona();
    }

    /**
     * Procesa la información agrupada por Cuenta y Zonas Fiscales
     */
    public function obtenerGraficoZona(array $filtros)
    {
        $rawRows = $this->repo->getSaldosPorZona($filtros);
        $resultado = [];

        foreach ($rawRows as $row) {
            $cta  = $row['cuentaventa'];
            $nom  = $row['nomcuentaventa'];
            $zona = $row['zonafiscal'];

            if (!isset($resultado[$cta])) {
                $resultado[$cta] = [
                    'cuentaventa'    => $cta,
                    'nomcuentaventa' => $nom,
                    'zonas'          => []
                ];
            }

            if (!isset($resultado[$cta]['zonas'][$zona])) {
                $resultado[$cta]['zonas'][$zona] = [];
            }

            $resultado[$cta]['zonas'][$zona][] = [
                'fecha'      => $row['fechacarga'],
                'saldofinal' => (float) $row['saldofinal']
            ];
        }

        return $resultado;
    }

    //exportar detalle a excel
    public function exportarExcelDetalle(array $params)
    {
        require_once __DIR__ . '/saldosExportExcel.php';

        // Reutiliza la misma consulta con filtros del modal
        $datos = $this->repo->getDetallePorCuentaYFecha($params);

        $exportador = new SaldosExportExcel();
        $exportador->generarExcelDetalle($datos, $params);
    }
    /**
     * FIN FUNCIONES PARA GRAFICO DE LINEAS SALDOS POR COBRAR
     */

    /**
     * FUNCIONES PARA GRAFICO DE ANTICIPOS
     */
    public function obtenerGraficoAnticiposData(array $params)
    {
        $fechaInicio = $params['fecha_inicio'] ?? '';
        $fechaFin    = $params['fecha_fin'] ?? '';
        $cuentas     = is_array($params['cuentas'] ?? null) ? $params['cuentas'] : [];

        if (empty($fechaInicio) || empty($fechaFin) || empty($cuentas)) {
            return [
                'status'  => 'error',
                'message' => 'Parámetros incompletos (fechas o cuentas faltantes)',
                'data'    => []
            ];
        }

        $filas = $this->repo->getDatosIndicadorAnticipos([
            'fecha_inicio' => $fechaInicio,
            'fecha_fin'    => $fechaFin,
            'cuentas'      => $cuentas
        ]);

        $resultado = [];
        foreach ($filas as $row) {
            $cta = $row['cuentaventa'];
            if (!isset($resultado[$cta])) {
                $resultado[$cta] = [
                    'cuentaventa'    => $cta,
                    'nomcuentaventa' => $row['nomcuentaventa'],
                    'fechas'         => []
                ];
            }

            $resultado[$cta]['fechas'][] = [
                'fecha'               => $row['fechacarga'],
                'saldoinicial'        => (float) $row['saldoinicial'],
                'saldofinal'          => (float) $row['saldofinal'],
                'resta_saldo'         => (float) $row['resta_saldo'],
                'porcentaje_cobranza' => (float) $row['porcentaje_cobranza']
            ];
        }

        return [
            'status' => 'success',
            'data'   => $resultado
        ];
    }
    /**
     * FIN FUNCIONES PARA GRAFICO DE ANTICIPOS
     */

    /**
     * FUNCIONES PARA 20DashAnalisisCtasMaxDeudoresDocs (Saldos por Cuenta de Venta)
     */
    public function obtenerGraficoAnalisisCuentas(array $params)
    {
        $fechaInicio = $params['fecha_inicio'] ?? '';
        $fechaFin    = $params['fecha_fin'] ?? '';
        $cuentas     = is_array($params['cuentas'] ?? null) ? $params['cuentas'] : [];

        if (empty($fechaInicio) || empty($fechaFin) || empty($cuentas)) {
            return [
                'status'  => 'error',
                'message' => 'Parámetros incompletos (fechas o cuentas faltantes)',
                'data'    => []
            ];
        }

        $filas = $this->repo->getSaldosPorCuentaAnalisis($params);

        $resultado = [];
        foreach ($filas as $row) {
            $cta = $row['cuentaventa'];
            if (!isset($resultado[$cta])) {
                $resultado[$cta] = [
                    'cuentaventa'    => $cta,
                    'nomcuentaventa' => $row['nomcuentaventa'],
                    'fechas'         => []
                ];
            }

            $resultado[$cta]['fechas'][] = [
                'fecha'      => $row['fechacarga'],
                'saldofinal' => (float) $row['saldofinal']
            ];
        }

        return [
            'status' => 'success',
            'data'   => $resultado
        ];
    }

    /**
     * Procesa y agrupa los documentos y corporativos para el modal de análisis de 20DashAnalisisCtasMaxDeudoresDocs
     *
     * @param array $params
     * @return array
     */
    public function obtenerAnalisisCorporativosYDocs(array $params)
    {
        $cuentaventa = $params['cuentaventa'] ?? '';
        $fechacarga  = $params['fechacarga'] ?? '';

        if (empty($cuentaventa) || empty($fechacarga)) {
            return [
                'status'  => 'error',
                'message' => 'Parámetros incompletos (cuentaventa y fechacarga son requeridos)'
            ];
        }

        $docsRaw = $this->repo->getAnalisisCorporativosYDocs($params);

        // Agrupación de corporativos
        $corporativosMap = [];
        $listadoDocs = [];

        foreach ($docsRaw as $doc) {
            $corp = $doc['nomcorporativo'];
            $sIni = (float) $doc['saldoinicial'];
            $sFin = (float) $doc['saldofinal'];

            // % Cobrado por documento = (saldoinicial - saldofinal) / saldoinicial
            // En Tableau este cálculo está redondeado a 2 decimales (0,05) y se formatea con 5 decimales (0,05000)
            $pctCobrado = 0.0;
            if ($sFin == 0.0) {
                $pctCobrado = 1.0;
            } elseif ($sIni > 0.0) {
                $pctCobrado = round(($sIni - $sFin) / $sIni, 2);
                if ($pctCobrado < 0) $pctCobrado = 0.0;
            }

            // Formateo horario amigable idéntico a Tableau (ej: "9:23:23 p. m.")
            $horaFormateada = $doc['horacreacion'];
            if (!empty($doc['horacreacion'])) {
                $ts = strtotime($doc['horacreacion']);
                if ($ts !== false) {
                    $hora12 = date('g:i:s', $ts);
                    $ampm = (date('a', $ts) === 'pm') ? 'p. m.' : 'a. m.';
                    $horaFormateada = "{$hora12} {$ampm}";
                }
            }

            $listadoDocs[] = [
                'fechacarga'     => $doc['fechacarga'],
                'fechacontable'  => $doc['fechacontable'] ?? $doc['fechacarga'],
                'numerodoc'      => $doc['numerodoc'],
                'horacreacion'   => $horaFormateada,
                'condicionpago'  => $doc['condicionpago'],
                'saldoinicial'   => $sIni,
                'saldofinal'     => $sFin,
                'pct_cobrado'    => $pctCobrado,
                'nomcorporativo' => $corp
            ];

            if (!isset($corporativosMap[$corp])) {
                $corporativosMap[$corp] = [
                    'nomcorporativo' => $corp,
                    'total_saldofinal' => 0.0,
                    'total_saldoinicial' => 0.0,
                    'cant_docs' => 0,
                    'montos_docs' => []
                ];
            }

            $corporativosMap[$corp]['total_saldofinal'] += $sFin;
            $corporativosMap[$corp]['total_saldoinicial'] += $sIni;
            $corporativosMap[$corp]['cant_docs']++;
            if ($sFin > 0) {
                $corporativosMap[$corp]['montos_docs'][] = [
                    'monto'        => $sFin,
                    'horacreacion' => $doc['horacreacion'] ?? '',
                    'numerodoc'    => $doc['numerodoc']
                ];
            }
        }

        // Ordenar corporativos por total_saldofinal DESC
        $corporativosList = array_values($corporativosMap);
        usort($corporativosList, function ($a, $b) {
            if ($b['total_saldofinal'] == $a['total_saldofinal']) {
                return strcmp($a['nomcorporativo'], $b['nomcorporativo']);
            }
            return ($b['total_saldofinal'] > $a['total_saldofinal']) ? 1 : -1;
        });

        // Redondear montos de corporativos y ordenar sus documentos por horacreacion DESC (orden exacto Tableau)
        foreach ($corporativosList as &$c) {
            $c['total_saldofinal'] = round($c['total_saldofinal'], 2);
            $c['total_saldoinicial'] = round($c['total_saldoinicial'], 2);
            usort($c['montos_docs'], function ($x, $y) {
                if ($x['horacreacion'] == $y['horacreacion']) {
                    return strcmp($y['numerodoc'], $x['numerodoc']);
                }
                return strcmp($y['horacreacion'], $x['horacreacion']);
            });
        }
        unset($c);

        return [
            'status'        => 'success',
            'cuentaventa'   => $cuentaventa,
            'nomcuentaventa'=> $docsRaw[0]['nomcuentaventa'] ?? '',
            'fechacarga'    => $fechacarga,
            'total_docs'    => count($listadoDocs),
            'corporativos'  => $corporativosList,
            'docs'          => $listadoDocs
        ];
    }

    /**
     * Procesa y estructura la matriz de Corporativos x Zona Fiscal para 18CorporativosZonaDeudores
     *
     * @param array $filtros
     * @return array
     */
    public function obtenerCorporativosZonaDeudores(array $filtros)
    {
        $rows = $this->repo->getCorporativosZonaDeudores($filtros);

        if (empty($rows)) {
            return [
                'status'       => 'empty',
                'zonas'        => [],
                'corporativos' => [],
                'max_saldo'    => 0,
                'total_deuda'  => 0
            ];
        }

        // Orden canónico de zonas fiscales de Tableau
        $zonasCanonicas = [
            'AREQUIPA', 'CAMANA', 'CUZCO', 'ILO', 'JULIACA', 
            'LA JOYA', 'MOLLENDO', 'MOQUEGUA', 'PEDREGAL', 'PUNO', 'TACNA'
        ];

        // Mapeo y acumulación
        $corporativosMap = [];
        $zonasDetectadas = [];
        $maxSaldo = 0.0;
        $totalDeuda = 0.0;

        foreach ($rows as $row) {
            $corp = trim($row['nomcorporativo']);
            $zona = trim($row['zonafiscal']);
            $saldo = (float) $row['saldofinal'];

            if (!in_array($zona, $zonasDetectadas, true)) {
                $zonasDetectadas[] = $zona;
            }

            if (!isset($corporativosMap[$corp])) {
                $corporativosMap[$corp] = [
                    'nomcorporativo' => $corp,
                    'total'          => 0.0,
                    'zonas'          => []
                ];
            }

            $corporativosMap[$corp]['zonas'][$zona] = $saldo;
            $corporativosMap[$corp]['total'] += $saldo;
            $totalDeuda += $saldo;

            if ($saldo > $maxSaldo) {
                $maxSaldo = $saldo;
            }
        }

        // Construir lista de zonas ordenadas respetando el orden canónico y agregando otras si hubiera
        $zonasOrdenadas = [];
        foreach ($zonasCanonicas as $zCan) {
            if (in_array($zCan, $zonasDetectadas, true)) {
                $zonasOrdenadas[] = $zCan;
            }
        }
        foreach ($zonasDetectadas as $zDet) {
            if (!in_array($zDet, $zonasOrdenadas, true)) {
                $zonasOrdenadas[] = $zDet;
            }
        }

        // Ordenar corporativos por total deudor descendente
        $corporativosList = array_values($corporativosMap);
        usort($corporativosList, function ($a, $b) {
            if ($b['total'] == $a['total']) {
                return strcmp($a['nomcorporativo'], $b['nomcorporativo']);
            }
            return ($b['total'] > $a['total']) ? 1 : -1;
        });

        // Redondear totales
        foreach ($corporativosList as &$c) {
            $c['total'] = round($c['total'], 2);
            foreach ($c['zonas'] as $z => $val) {
                $c['zonas'][$z] = round($val, 2);
            }
        }
        unset($c);

        return [
            'status'       => 'success',
            'zonas'        => $zonasOrdenadas,
            'corporativos' => $corporativosList,
            'max_saldo'    => round($maxSaldo, 2),
            'total_deuda'  => round($totalDeuda, 2)
        ];
    }
}


