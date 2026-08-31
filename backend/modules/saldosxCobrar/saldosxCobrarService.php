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

}
