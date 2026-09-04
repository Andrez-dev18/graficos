<?php

require_once __DIR__ . '/ventasResumenRepo.php';

class VentasResumenService
{
    private $repo;

    public function __construct($db)
    {
        $this->repo = new VentasResumenRepo($db);
    }

    /**
     * Obtiene y formatea las opciones para los filtros del módulo Ventas Resumen
     */
    public function obtenerFiltrosIniciales($lineaProceso = null)
    {
        $lineasRaw = $this->repo->getLineasProceso();
        $devsRaw   = $this->repo->getNomDevoluciones();

        $lineasProceso = array_map(function ($item) {
            return [
                'id' => $item['lineaproceso'],
                'label' => $item['lineaproceso']
            ];
        }, $lineasRaw);

        $zonasRaw = $this->repo->getZonasFiscales($lineaProceso);
        $itemsRaw = $this->repo->getItems($lineaProceso);

        $zonasFiscales = array_map(function ($item) {
            return [
                'id' => $item['zonafiscal'],
                'label' => $item['zonafiscal']
            ];
        }, $zonasRaw);

        $items = array_map(function ($item) {
            return [
                'id' => $item['coditem'],
                'label' => $item['coditem'] . ' - ' . $item['nomitem']
            ];
        }, $itemsRaw);

        $nomDevoluciones = array_map(function ($item) {
            return [
                'id' => $item['nomdevolucion'],
                'label' => $item['nomdevolucion']
            ];
        }, $devsRaw);

        return [
            'lineasProceso'   => $lineasProceso,
            'zonasFiscales'   => $zonasFiscales,
            'items'           => $items,
            'nomDevoluciones' => $nomDevoluciones
        ];
    }

    /**
     * Obtiene zonas e items asociados a una línea de proceso específica
     */
    public function obtenerOpcionesPorLinea($lineaProceso)
    {
        $zonasRaw = $this->repo->getZonasFiscales($lineaProceso);
        $itemsRaw = $this->repo->getItems($lineaProceso);

        $zonasFiscales = array_map(function ($item) {
            return [
                'id' => $item['zonafiscal'],
                'label' => $item['zonafiscal']
            ];
        }, $zonasRaw);

        $items = array_map(function ($item) {
            return [
                'id' => $item['coditem'],
                'label' => $item['coditem'] . ' - ' . $item['nomitem']
            ];
        }, $itemsRaw);

        return [
            'zonasFiscales' => $zonasFiscales,
            'items'         => $items
        ];
    }

    /**
     * Procesa y estructura la información para el gráfico 07VentasSacCoor
     */
    public function obtenerGraficoVentasSacCoor(array $filtros)
    {
        $rawRows = $this->repo->getVentasSacCoor($filtros);

        $fechas = [];
        $labels = [];

        // Series para Unidades
        $serieCantTotal = [];
        $serieCantVentas = [];
        $serieCantDevs = [];
        $serieRatioCant = [];

        // Series para Pesos
        $seriePesoTotal = [];
        $seriePesoVentas = [];
        $seriePesoDevs = [];
        $serieRatioPeso = [];

        // Series para Soles (Montos)
        $serieSubtotalTotal = [];
        $serieSubtotalVentas = [];
        $serieSubtotalDevs = [];

        $totalesGenerales = [
            'cant_total'     => 0.0,
            'cant_ventas'    => 0.0,
            'cant_devs'      => 0.0,
            'peso_total'     => 0.0,
            'peso_ventas'    => 0.0,
            'peso_devs'      => 0.0,
            'subtotal_total' => 0.0
        ];

        foreach ($rawRows as $row) {
            $fProc = $row['fechaproceso'];
            $fechas[] = $fProc;
            $labels[] = $this->formatearFechaCorta($fProc);

            // Valores de Unidades
            $cantVenta = (float)$row['cant_ventas'];
            $cantDev   = (float)$row['cant_devs'];
            $cantTot   = (float)$row['cant_total_gen'];
            $ratioCant = ($cantVenta != 0.0) ? round((abs($cantDev) / $cantVenta) * 100, 2) : 0.0;

            $serieCantTotal[]  = round($cantTot, 2);
            $serieCantVentas[] = round($cantVenta, 2);
            $serieCantDevs[]   = round($cantDev, 2);
            $serieRatioCant[]  = $ratioCant;

            // Valores de Pesos (Kg)
            $pesoVenta = (float)$row['peso_ventas'];
            $pesoDev   = (float)$row['peso_devs'];
            $pesoTot   = (float)$row['peso_total_gen'];
            $ratioPeso = ($pesoVenta != 0.0) ? round((abs($pesoDev) / $pesoVenta) * 100, 2) : 0.0;

            $seriePesoTotal[]  = round($pesoTot, 2);
            $seriePesoVentas[] = round($pesoVenta, 2);
            $seriePesoDevs[]   = round($pesoDev, 2);
            $serieRatioPeso[]  = $ratioPeso;

            // Valores de Subtotal
            $subVenta = (float)$row['subtotal_ventas'];
            $subDev   = (float)$row['subtotal_devs'];
            $subTot   = (float)$row['subtotal_total_gen'];

            $serieSubtotalTotal[]  = round($subTot, 2);
            $serieSubtotalVentas[] = round($subVenta, 2);
            $serieSubtotalDevs[]   = round($subDev, 2);

            // Acumuladores
            $totalesGenerales['cant_total']     += $cantTot;
            $totalesGenerales['cant_ventas']    += $cantVenta;
            $totalesGenerales['cant_devs']      += $cantDev;
            $totalesGenerales['peso_total']     += $pesoTot;
            $totalesGenerales['peso_ventas']    += $pesoVenta;
            $totalesGenerales['peso_devs']      += $pesoDev;
            $totalesGenerales['subtotal_total'] += $subTot;
        }

        // Ratios globales del período
        $totalesGenerales['ratio_cant_global'] = ($totalesGenerales['cant_ventas'] != 0.0)
            ? round((abs($totalesGenerales['cant_devs']) / $totalesGenerales['cant_ventas']) * 100, 2)
            : 0.0;

        $totalesGenerales['ratio_peso_global'] = ($totalesGenerales['peso_ventas'] != 0.0)
            ? round((abs($totalesGenerales['peso_devs']) / $totalesGenerales['peso_ventas']) * 100, 2)
            : 0.0;

        return [
            'fechas' => $fechas,
            'labels' => $labels,
            'lineaproceso' => $filtros['lineaproceso'] ?? 'TODO',
            'totales' => $totalesGenerales,
            'unidades' => [
                'total_general' => $serieCantTotal,
                'ventas'        => $serieCantVentas,
                'devoluciones'  => $serieCantDevs,
                'ratio_dev'     => $serieRatioCant
            ],
            'pesos' => [
                'total_general' => $seriePesoTotal,
                'ventas'        => $seriePesoVentas,
                'devoluciones'  => $seriePesoDevs,
                'ratio_dev'     => $serieRatioPeso
            ],
            'subtotales' => [
                'total_general' => $serieSubtotalTotal,
                'ventas'        => $serieSubtotalVentas,
                'devoluciones'  => $serieSubtotalDevs
            ]
        ];
    }

    /**
     * Formatea fecha YYYY-MM-DD al formato corto D/M/YYYY estilo Tableau (ej. 24/8/2026)
     */
    private function formatearFechaCorta($fechaStr)
    {
        if (empty($fechaStr)) return '';
        $partes = explode('-', $fechaStr);
        if (count($partes) === 3) {
            return (int)$partes[2] . '/' . (int)$partes[1] . '/' . $partes[0];
        }
        return $fechaStr;
    }
}
