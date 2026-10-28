<?php

require_once __DIR__ . '/AlmacenMermasVivoRepo.php';
require_once __DIR__ . '/handlers/MermaDiariaClienteHandler.php';
require_once __DIR__ . '/handlers/MermaDiariaClientePlacaHandler.php';
require_once __DIR__ . '/handlers/MermaDiariaClienteMesHandler.php';

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

    public function obtenerPorcMermaProcesoDiaClienteZona(array $filtros): array
    {
        $filasRaw = $this->repo->getPorcMermaProcesoDiaClienteZona($filtros);

        $matriz = [];
        foreach ($filasRaw as $row) {
            $matriz[] = [
                'fechaproceso'                => $row['fechaproceso'],
                'fecha_formateada'            => $this->formatearFechaTableau($row['fechaproceso']),
                'zonaorigen'                  => $row['zonaorigen'],
                'cliente'                     => $row['cliente'],
                'dato'                        => $row['dato'],
                'avg_objetivo'                => (float)$row['avg_objetivo'],
                'total_entrada'               => (float)$row['total_entrada'],
                'pct_mermatotal'              => (float)$row['pct_mermatotal'],
                'pct_variacion'               => (float)$row['pct_variacion'],
                'sum_mermatotal'              => (float)$row['sum_mermatotal'],
                'sum_mermaalmacenaje'         => (float)$row['sum_mermaalmacenaje'],
                'sum_mermamuertodistribucion' => (float)$row['sum_mermamuertodistribucion'],
                'sum_mermamuertotransporte'   => (float)$row['sum_mermamuertotransporte'],
                'sum_mermanoapto'             => (float)$row['sum_mermanoapto'],
                'sum_mermatransporte'         => (float)$row['sum_mermatransporte'],
                'sum_mermatransbenemanual'    => (float)$row['sum_mermatransbenemanual'],
                'sum_mermatransbenemecani'    => (float)$row['sum_mermatransbenemecani']
            ];
        }

        return [
            'status' => 'success',
            'total'  => count($matriz),
            'data'   => $matriz
        ];
    }

    public function obtenerPorcMermaDiariaProceso(array $filtros): array
    {
        return $this->obtenerPorcMermaLinea($filtros, 'dia', true);
    }

    public function obtenerPorcMermaDiariaProcesoMesZona(array $filtros): array
    {
        return $this->obtenerPorcMermaLinea($filtros, 'mes', false);
    }

    public function obtenerPorcMermaDiariaProcesoMes(array $filtros): array
    {
        $filasRaw = $this->repo->getPorcMermaDiariaClienteMes($filtros);
        return MermaDiariaClienteMesHandler::formatear($filasRaw, $filtros);
    }

    public function obtenerPorcMermaDiariaProcesoCiente(array $filtros): array
    {
        $filasRaw = $this->repo->getPorcMermaDiariaCliente($filtros);
        return MermaDiariaClienteHandler::formatear($filasRaw, $filtros);
    }

    public function obtenerPorcMermaDiariaProcesoCientePlaca(array $filtros): array
    {
        $filasRaw = $this->repo->getPorcMermaDiariaClientePlaca($filtros);
        return MermaDiariaClientePlacaHandler::formatear($filasRaw, $filtros);
    }

    public function obtenerFiltrosMerma(): array
    {
        $filtros = $this->repo->getFiltrosClientesPlacas();
        return [
            'status'   => 'success',
            'clientes' => $filtros['clientes'],
            'placas'   => $filtros['placas']
        ];
    }

    private function obtenerPorcMermaLinea(array $filtros, string $granularidad, bool $forzarPeso): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d');
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');
        $dato        = trim($filtros['dato'] ?? 'TODO');

        $filasRaw = $this->repo->getPorcMermaLinea($filtros, $granularidad, $forzarPeso);

        $valoresPorPeriodo = [];
        foreach ($filasRaw as $row) {
            $periodo = (string)($row['periodo'] ?? '');
            if ($periodo === '') {
                continue;
            }
            $valoresPorPeriodo[$periodo] = (float)($row['valor'] ?? 0);
        }

        $inicio = new DateTimeImmutable($fechaInicio);
        $fin = new DateTimeImmutable($fechaFin);

        $puntos = [];
        if ($granularidad === 'mes') {
            $cursor = $inicio->modify('first day of this month')->setTime(0, 0);
            $limite = $fin->modify('first day of this month')->setTime(0, 0);
            while ($cursor <= $limite) {
                $periodo = $cursor->format('Y-m');
                $puntos[] = [
                    'periodo' => $periodo,
                    'valor'   => array_key_exists($periodo, $valoresPorPeriodo) ? $valoresPorPeriodo[$periodo] : null
                ];
                $cursor = $cursor->modify('+1 month');
            }
        } else {
            $cursor = $inicio->setTime(0, 0);
            $limite = $fin->setTime(0, 0);
            while ($cursor <= $limite) {
                $periodo = $cursor->format('Y-m-d');
                $puntos[] = [
                    'periodo' => $periodo,
                    'valor'   => array_key_exists($periodo, $valoresPorPeriodo) ? $valoresPorPeriodo[$periodo] : null
                ];
                $cursor = $cursor->modify('+1 day');
            }
        }

        $esMes = $granularidad === 'mes';
        $datoAplicado = $forzarPeso ? 'Peso' : $dato;

        return [
            'status'       => 'success',
            'total'        => count($puntos),
            'data'         => $puntos,
            'granularidad' => $granularidad,
            'titulo'       => $esMes
                ? 'Porcentaje de Merma Mensualizada por Fecha de Proceso'
                : 'Porcentaje de Merma Diaria por Fecha de Proceso',
            'subtitulo'    => 'Merma total sobre la entrada',
            'etiqueta_y'   => 'Porcentaje de Merma',
            'dato'         => $datoAplicado,
            'fecha_inicio' => $fechaInicio,
            'fecha_fin'    => $fechaFin
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

    public function obtenerMermaProcesoPlacaObjetivo(array $filtros): array
    {
        $filasRaw = $this->repo->getMermaProcesoPlacaObjetivo($filtros);

        $matriz = [];
        foreach ($filasRaw as $row) {
            $matriz[] = [
                'fechaproceso'     => $row['fechaproceso'],
                'fecha_formateada' => $this->formatearFechaTableau($row['fechaproceso']),
                'zonaorigen'       => $row['zonaorigen'],
                'cliente'          => $row['cliente'],
                'placa'            => $row['placa'],
                'dato'             => $row['dato'],
                'total_entrada'    => (float)$row['total_entrada'],
                'total_mermatotal' => (float)$row['total_mermatotal'],
                'prom_objetivo'    => (float)$row['prom_objetivo'],
                'pct_mermatotal'   => (float)$row['pct_mermatotal'],
                'variacion_pct'    => (float)$row['variacion_pct']
            ];
        }

        return [
            'status' => 'success',
            'total'  => count($matriz),
            'data'   => $matriz
        ];
    }

    public function obtenerDetallePlacaRutaCausales(array $filtros): array
    {
        $data = $this->repo->getDetallePlacaRutaCausales($filtros);

        return [
            'status'   => 'success',
            'ruta'     => $data['ruta'],
            'causales' => $data['causales']
        ];
    }


}
