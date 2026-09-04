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
     * Procesa y estructura la información para el Modal de Análisis Secundario (Mini Gráficos)
     */
    public function obtenerAnalisisSecundario(array $filtros)
    {
        $raw = $this->repo->getAnalisisSecundario($filtros);

        $clientesRaw = $raw['clientes'] ?? [];
        $devsRaw     = $raw['devoluciones'] ?? [];

        $clientes = [];
        $totalesGenerales = [
            'cant_ventas'     => 0.0,
            'cant_devs'       => 0.0,
            'cant_total'      => 0.0,
            'peso_ventas'     => 0.0,
            'peso_devs'       => 0.0,
            'peso_total'      => 0.0,
            'subtotal_ventas' => 0.0,
            'subtotal_devs'   => 0.0,
            'subtotal_total'  => 0.0
        ];

        foreach ($clientesRaw as $row) {
            $cVenta = (float)($row['cant_ventas'] ?? 0);
            $cDev   = (float)($row['cant_dev'] ?? ($row['cant_devs'] ?? 0));
            $cTot   = (float)($row['cant_total'] ?? 0);

            $pVenta = (float)($row['peso_ventas'] ?? 0);
            $pDev   = (float)($row['peso_dev'] ?? ($row['peso_devs'] ?? 0));
            $pTot   = (float)($row['peso_total'] ?? 0);

            $sVenta = (float)($row['subtotal_ventas'] ?? 0);
            $sDev   = (float)($row['subtotal_dev'] ?? ($row['subtotal_devs'] ?? 0));
            $sTot   = (float)($row['subtotal_total'] ?? 0);

            $clientes[] = [
                'corporativo'     => $row['corporativo'] ?? '',
                'cant_ventas'     => round($cVenta, 2),
                'cant_dev'        => round($cDev, 2),
                'cant_devs'       => round($cDev, 2),
                'cant_total'      => round($cTot, 2),
                'peso_ventas'     => round($pVenta, 2),
                'peso_dev'        => round($pDev, 2),
                'peso_devs'       => round($pDev, 2),
                'peso_total'      => round($pTot, 2),
                'subtotal_ventas' => round($sVenta, 2),
                'subtotal_dev'    => round($sDev, 2),
                'subtotal_devs'   => round($sDev, 2),
                'subtotal_total'  => round($sTot, 2)
            ];

            $totalesGenerales['cant_ventas']     += $cVenta;
            $totalesGenerales['cant_devs']       += $cDev;
            $totalesGenerales['cant_total']      += $cTot;
            $totalesGenerales['peso_ventas']     += $pVenta;
            $totalesGenerales['peso_devs']       += $pDev;
            $totalesGenerales['peso_total']      += $pTot;
            $totalesGenerales['subtotal_ventas'] += $sVenta;
            $totalesGenerales['subtotal_devs']   += $sDev;
            $totalesGenerales['subtotal_total']  += $sTot;
        }

        $devoluciones = [];
        foreach ($devsRaw as $row) {
            $devoluciones[] = [
                'nomdevolucion' => $row['nomdevolucion'],
                'corporativo'   => $row['corporativo'],
                'cantidad'      => round((float)$row['cantidad'], 2),
                'peso'          => round((float)$row['peso'], 2),
                'subtotal'      => round((float)$row['subtotal'], 2)
            ];
        }

        return [
            'fecha'        => $filtros['fecha'] ?? null,
            'lineaproceso' => $filtros['lineaproceso'] ?? 'TODO',
            'clientes'     => $clientes,
            'devoluciones' => $devoluciones,
            'totales'      => $totalesGenerales
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

