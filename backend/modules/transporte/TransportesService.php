<?php

require_once __DIR__ . '/TransportesRepo.php';

class TransportesService
{
    private $repo;

    public function __construct($db)
    {
        $this->repo = new TransportesRepo($db);
    }

    public function obtenerDashboardCompleto(array $filtros): array
    {
        $metricas = $this->repo->getMetricasDiarias($filtros);
        $hojasRuta = $this->repo->getHojasRuta($filtros);
        $detalleRuta = $this->repo->getDetalleEventosRuta($filtros);

        foreach ($hojasRuta as &$h) {
            $h['fecha_txt'] = $this->formatearFechaTableau($h['fechaproceso']);
        }
        unset($h);

        foreach ($detalleRuta as &$d) {
            $d['dia_txt'] = $this->formatearDiaCortaTableau($d['dia']);
        }
        unset($d);

        return [
            'status'         => 'success',
            'metricas'       => $metricas,
            'hojas_ruta'     => $hojasRuta,
            'detalle_eventos'=> $detalleRuta
        ];
    }

    public function obtenerDetalleEventos(array $filtros): array
    {
        $detalle = $this->repo->getDetalleEventosRuta($filtros);

        foreach ($detalle as &$d) {
            $d['dia_txt'] = $this->formatearDiaCortaTableau($d['dia']);
        }
        unset($d);

        return [
            'status' => 'success',
            'total'  => count($detalle),
            'data'   => $detalle
        ];
    }

    private function formatearFechaTableau(?string $fecha): string
    {
        if (!$fecha) return '';
        $meses = [
            '01' => 'enero', '02' => 'febrero', '03' => 'marzo',
            '04' => 'abril', '05' => 'mayo',    '06' => 'junio',
            '07' => 'julio', '08' => 'agosto',  '09' => 'septiembre',
            '10' => 'octubre','11' => 'noviembre','12' => 'diciembre'
        ];
        $partes = explode('-', $fecha);
        if (count($partes) !== 3) return $fecha;

        $dia = (int)$partes[2];
        $mes = $meses[$partes[1]] ?? $partes[1];
        $anio = $partes[0];

        return "{$dia} de {$mes} de {$anio}";
    }

    private function formatearDiaCortaTableau(?string $fecha): string
    {
        if (!$fecha || $fecha === '0000-00-00') return '';
        $partes = explode('-', $fecha);
        if (count($partes) !== 3) return $fecha;

        $dia = (int)$partes[2];
        $mes = (int)$partes[1];
        $anio = $partes[0];

        return "{$dia}/{$mes}/{$anio}";
    }
}