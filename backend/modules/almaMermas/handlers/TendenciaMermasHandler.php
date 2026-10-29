<?php

class TendenciaMermasHandler
{
    private $repo;

    private $medidas = [
        'mermatotal' => 'Merma Total',
        'mermaalmacenaje' => 'Merma Almacenaje',
        'mermamuertodistribucion' => 'Merma Muerto Distribucion',
        'mermamuertotransporte' => 'Merma Muerto Transporte',
        'mermanoapto' => 'Merma No Apto',
        'mermatransporte' => 'Merma Transporte',
        'mermatransbenemanual' => 'Merma BNE Manual',
        'mermatransbenemecani' => 'Merma BNE Mecanizado'
    ];

    public function __construct($repo)
    {
        $this->repo = $repo;
    }

    public function obtenerTendenciaMermas(array $filtros): array
    {
        $fechaInicio = $this->fechaValida($filtros['fecha_inicio'] ?? '', date('Y-m-01'));
        $fechaFin = $this->fechaValida($filtros['fecha_fin'] ?? '', date('Y-m-d'));

        if ($fechaInicio > $fechaFin) {
            $tmp = $fechaInicio;
            $fechaInicio = $fechaFin;
            $fechaFin = $tmp;
        }

        $dato = trim((string)($filtros['dato'] ?? 'Peso'));
        $cliente = trim((string)($filtros['cliente'] ?? 'TODO'));

        $filtrosRepo = [
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin,
            'dato' => $dato === '' ? 'Peso' : $dato,
            'cliente' => $cliente === '' ? 'TODO' : $cliente
        ];

        $filas = $this->repo->getTendenciaMermas($filtrosRepo);
        $porFecha = [];

        foreach ($filas as $fila) {
            $periodo = (string)($fila['periodo'] ?? '');
            if ($periodo === '') {
                continue;
            }
            $porFecha[$periodo] = $fila;
        }

        $fechas = [];
        $series = [];
        foreach (array_keys($this->medidas) as $clave) {
            $series[$clave] = [];
        }

        $cursor = new DateTimeImmutable($fechaInicio);
        $limite = new DateTimeImmutable($fechaFin);

        while ($cursor <= $limite) {
            $periodo = $cursor->format('Y-m-d');
            $fila = $porFecha[$periodo] ?? null;
            $entrada = $fila ? (float)$fila['entrada'] : 0.0;
            $fechas[] = $periodo;

            foreach (array_keys($this->medidas) as $clave) {
                $valor = null;
                if ($fila && $entrada > 0) {
                    $suma = (float)($fila[$clave] ?? 0);
                    $valor = round(($suma / $entrada) * 100, 4);
                }
                $series[$clave][] = $valor;
            }

            $cursor = $cursor->modify('+1 day');
        }

        $data = [];
        foreach ($fechas as $indice => $fecha) {
            $fila = [
                'periodo' => $fecha,
                'fecha_formateada' => $this->formatearFecha($fecha)
            ];
            foreach (array_keys($this->medidas) as $clave) {
                $fila[$clave] = $series[$clave][$indice];
            }
            $data[] = $fila;
        }

        $seriesSalida = [];
        foreach ($this->medidas as $clave => $etiqueta) {
            $seriesSalida[] = [
                'key' => $clave,
                'label' => $etiqueta,
                'valores' => $series[$clave]
            ];
        }

        return [
            'status' => 'success',
            'total' => count($data),
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin,
            'cliente' => $filtrosRepo['cliente'],
            'dato' => $filtrosRepo['dato'],
            'titulo' => 'Tendencias de Porcentaje de Merma Diaria por Fecha de Proceso/Cliente/Tipo de Merma',
            'subtitulo' => 'Merma Total y detalle sobre la entrada',
            'etiqueta_y' => 'Porcentaje de Merma',
            'fechas' => $fechas,
            'series' => $seriesSalida,
            'data' => $data
        ];
    }

    private function fechaValida($valor, string $default): string
    {
        $valor = trim((string)$valor);
        if ($valor === '') {
            return $default;
        }

        $fecha = DateTime::createFromFormat('Y-m-d', $valor);
        if (!$fecha || $fecha->format('Y-m-d') !== $valor) {
            return $default;
        }

        return $valor;
    }

    private function formatearFecha(string $fecha): string
    {
        $meses = [
            '01' => 'enero', '02' => 'febrero', '03' => 'marzo',
            '04' => 'abril', '05' => 'mayo', '06' => 'junio',
            '07' => 'julio', '08' => 'agosto', '09' => 'septiembre',
            '10' => 'octubre', '11' => 'noviembre', '12' => 'diciembre'
        ];

        $partes = explode('-', $fecha);
        if (count($partes) !== 3) {
            return $fecha;
        }

        $dia = (int)$partes[2];
        $mes = $meses[$partes[1]] ?? $partes[1];
        return "{$dia} de {$mes} de {$partes[0]}";
    }
}
