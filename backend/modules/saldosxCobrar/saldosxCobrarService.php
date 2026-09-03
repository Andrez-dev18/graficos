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

        if (empty($cuentaventa) || empty($fechacarga)) {
            return [
                'status' => 'error',
                'message' => 'Parámetros cuentaventa y fechacarga son requeridos',
                'resumen' => null,
                'datos_completos' => []
            ];
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
                'ratio_cobranza' => $ratio
            ];
        }, $detalleRaw);

        $sumResta = round($totalSaldoinicial - $totalSaldofinal, 2);
        // En Tableau: ROUND((sum([saldoinicial])-sum([saldofinal]))/sum([saldoinicial]), 2) y formateado a 6 decimales (ej. 0,430000)
        $ratioCobranza = ($totalSaldoinicial != 0.0) ? round(round($sumResta / $totalSaldoinicial, 2), 6) : 0.0;

        return [
            'status' => 'success',
            'resumen' => [
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
}
