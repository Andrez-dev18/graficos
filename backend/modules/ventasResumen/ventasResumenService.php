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
}
