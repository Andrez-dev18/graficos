<?php

require_once __DIR__ . '/AlmacenMermasVivoRepo.php';

class AlmacenMermasVivoService
{
    private $repo;

    public function __construct($db)
    {
        $this->repo = new AlmacenMermasVivoRepo($db);
    }

    public function obtenerPorcMermaProcesoDiaClientePlaca(array $filtros): array
    {
        $filasRaw = $this->repo->getPorcMermaProcesoDiaClientePlaca($filtros);

        $matriz = [];
        foreach ($filasRaw as $row) {
            $matriz[] = [
                'fechaproceso'                => $row['fechaproceso'],
                'fecha_formateada'            => $this->formatearFechaTableau($row['fechaproceso']),
                'cliente'                     => $row['cliente'],
                'placa'                       => $row['placa'],
                'dato'                        => $row['dato'],
                'total_entrada'               => (float)$row['total_entrada'],
                'pct_mermatotal'              => (float)$row['pct_mermatotal'],
                'pct_mermaalmacenaje'         => (float)$row['pct_mermaalmacenaje'],
                'pct_mermamuertodistribucion' => (float)$row['pct_mermamuertodistribucion'],
                'pct_mermamuertotransporte'   => (float)$row['pct_mermamuertotransporte'],
                'pct_mermanoapto'             => (float)$row['pct_mermanoapto'],
                'pct_mermatransporte'         => (float)$row['pct_mermatransporte'],
                'pct_mermatransbenemanual'    => (float)$row['pct_mermatransbenemanual'],
                'pct_mermatransbenemecani'    => (float)$row['pct_mermatransbenemecani'],
                'sum_mermatotal'              => (float)$row['sum_mermatotal'],
                'sum_mermatransporte'         => (float)$row['sum_mermatransporte'],
                'sum_mermamuertotransporte'   => (float)$row['sum_mermamuertotransporte'],
                'sum_mermatransbenemecani'    => (float)$row['sum_mermatransbenemecani']
            ];
        }

        return [
            'status' => 'success',
            'total'  => count($matriz),
            'data'   => $matriz
        ];
    }

    public function obtenerPorcMermaProcesoDiaCliente(array $filtros): array
    {
        $filasRaw = $this->repo->getPorcMermaProcesoDiaCliente($filtros);

        $matriz = [];
        foreach ($filasRaw as $row) {
            $matriz[] = [
                'fechaproceso'                => $row['fechaproceso'],
                'fecha_formateada'            => $this->formatearFechaTableau($row['fechaproceso']),
                'cliente'                     => $row['cliente'],
                'dato'                        => $row['dato'],
                'total_entrada'               => (float)$row['total_entrada'],
                'pct_mermatotal'              => (float)$row['pct_mermatotal'],
                'pct_mermaalmacenaje'         => (float)$row['pct_mermaalmacenaje'],
                'pct_mermamuertodistribucion' => (float)$row['pct_mermamuertodistribucion'],
                'pct_mermamuertotransporte'   => (float)$row['pct_mermamuertotransporte'],
                'pct_mermanoapto'             => (float)$row['pct_mermanoapto'],
                'pct_mermatransporte'         => (float)$row['pct_mermatransporte'],
                'pct_mermatransbenemanual'    => (float)$row['pct_mermatransbenemanual'],
                'pct_mermatransbenemecani'    => (float)$row['pct_mermatransbenemecani'],
                'sum_mermatotal'              => (float)$row['sum_mermatotal'],
                'sum_mermatransporte'         => (float)$row['sum_mermatransporte'],
                'sum_mermamuertotransporte'   => (float)$row['sum_mermamuertotransporte'],
                'sum_mermatransbenemecani'    => (float)$row['sum_mermatransbenemecani']
            ];
        }

        return [
            'status' => 'success',
            'total'  => count($matriz),
            'data'   => $matriz
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
}