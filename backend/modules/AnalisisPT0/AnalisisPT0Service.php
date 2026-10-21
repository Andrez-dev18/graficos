<?php

require_once __DIR__ . '/AnalisisPT0Repository.php';

class AnalisisPT0Service
{
    private $repo;
    private $anio;

    public function __construct(PDO $db, string $anio = '2026')
    {
        $this->repo = new AnalisisPT0Repository($db);
        $this->anio = $anio;
    }

    public function obtenerFiltros(): array
    {
        $rango = $this->repo->obtenerRangoDisponible($this->anio);
        $ultimoMes = !empty($rango['ultimo_mes_inicio'])
            ? substr($rango['ultimo_mes_inicio'], 0, 7)
            : null;

        $talmOptions = $this->repo->obtenerTalmDisponibles($this->anio);
        $disponibles = array_column($talmOptions, 'codigo');
        $talmDefault = 'PB7';

        if (!in_array($talmDefault, $disponibles, true)) {
            $talmDefault = !empty($talmOptions) ? $talmOptions[0]['codigo'] : null;
        }

        $defaults = [
            'AlmaFecha'            => ['PB7'],
            'FechaCliente'         => ['PB7'],
            'FechaClienteTrans'    => ['A11', 'A18', 'PB1', 'PB3', 'PB4', 'PB7', 'PT0'],
            'FechaClienteTransCod' => ['PB7'],
            'Dashboard2'           => ['PB7']
        ];

        foreach ($defaults as $vista => $codigos) {
            $defaults[$vista] = array_values(array_filter($codigos, function ($codigo) use ($disponibles) {
                return in_array($codigo, $disponibles, true);
            }));
        }

        return [
            'anio'              => $this->anio,
            'talm'              => 'PT0',
            'fecha_min'         => $rango['fecha_min'],
            'fecha_max'         => $rango['fecha_max'],
            'ultimo_mes'        => $ultimoMes,
            'ultimo_mes_inicio' => $rango['ultimo_mes_inicio'],
            'ultimo_mes_fin'    => $rango['ultimo_mes_fin'],
            'talm_options'      => $talmOptions,
            'talm_default'      => $talmDefault,
            'talm_defaults'     => $defaults
        ];
    }

    public function obtenerDashboard(array $filtros): array
    {
        $filtros['anio'] = $this->anio;
        $tipoGrafico = strtolower(trim((string) ($filtros['tipo_grafico'] ?? 'DashAnalisisPT0')));

        if ($tipoGrafico === 'almafecha') {
            $resultado = $this->obtenerAlmaFecha($filtros);
        } elseif ($tipoGrafico === 'fechacliente') {
            $resultado = $this->obtenerFechaCliente($filtros);
        } elseif ($tipoGrafico === 'fechaclientetrans') {
            $resultado = $this->obtenerFechaClienteTrans($filtros);
        } elseif ($tipoGrafico === 'fechaclientetranscod') {
            $resultado = $this->obtenerFechaClienteTransCod($filtros);
        } elseif ($tipoGrafico === 'dashboard2') {
            $resultado = $this->obtenerDashboard2($filtros);
        } else {
            $resultado = $this->obtenerDashAnalisisPT0($filtros);
        }

        $resultado['anio'] = $this->anio;
        return $resultado;
    }

    private function obtenerDashAnalisisPT0(array $filtros): array
    {
        $rango = $this->repo->obtenerRangoDisponible($this->anio);

        if (empty($rango['fecha_max'])) {
            return [
                'tipo_grafico'     => 'DashAnalisisPT0',
                'filtros'          => [
                    'mes'          => null,
                    'dia'          => null,
                    'fecha_inicio' => null,
                    'fecha_fin'    => null
                ],
                'rango_disponible' => $rango,
                'base'             => [],
                'total_registros'  => 0
            ];
        }

        [$mes, $dia, $fechaInicio, $fechaFin] = $this->resolverRangoFechas($filtros, $rango);
        $base = $this->repo->obtenerBase($fechaInicio, $fechaFin);

        return [
            'tipo_grafico'     => 'DashAnalisisPT0',
            'filtros'          => [
                'mes'          => $mes,
                'dia'          => $dia,
                'fecha_inicio' => $fechaInicio,
                'fecha_fin'    => $fechaFin
            ],
            'rango_disponible' => $rango,
            'base'             => $base,
            'total_registros'  => count($base)
        ];
    }

    private function obtenerAlmaFecha(array $filtros): array
    {
        $rango = $this->repo->obtenerRangoDisponible($this->anio);

        if (empty($rango['fecha_max'])) {
            return [
                'tipo_grafico'      => 'AlmaFecha',
                'filtros'           => [
                    'mes'          => null,
                    'dia'          => null,
                    'fecha_inicio' => null,
                    'fecha_fin'    => null
                ],
                'rango_disponible'  => $rango,
                'talm_seleccionados' => [],
                'base'              => [],
                'total_registros'   => 0
            ];
        }

        [$mes, $dia, $fechaInicio, $fechaFin] = $this->resolverRangoFechas($filtros, $rango);
        $talm = $this->resolverTalm($filtros['talm'] ?? []);
        $base = $this->repo->obtenerBaseAlmaFecha($talm, $fechaInicio, $fechaFin);

        return [
            'tipo_grafico'       => 'AlmaFecha',
            'filtros'            => [
                'mes'          => $mes,
                'dia'          => $dia,
                'fecha_inicio' => $fechaInicio,
                'fecha_fin'    => $fechaFin
            ],
            'rango_disponible'   => $rango,
            'talm_seleccionados' => $talm,
            'base'               => $base,
            'total_registros'    => count($base)
        ];
    }

    private function obtenerFechaCliente(array $filtros): array
    {
        $rango = $this->repo->obtenerRangoDisponible($this->anio);

        if (empty($rango['fecha_max'])) {
            return [
                'tipo_grafico'       => 'FechaCliente',
                'filtros'            => [
                    'mes'          => null,
                    'dia'          => null,
                    'fecha_inicio' => null,
                    'fecha_fin'    => null
                ],
                'rango_disponible'   => $rango,
                'talm_seleccionados' => [],
                'base'               => [],
                'total_registros'    => 0
            ];
        }

        [$mes, $dia, $fechaInicio, $fechaFin] = $this->resolverRangoFechas($filtros, $rango);
        $talm = $this->resolverTalm($filtros['talm'] ?? []);
        $base = $this->repo->obtenerBaseFechaCliente($talm, $fechaInicio, $fechaFin);

        return [
            'tipo_grafico'       => 'FechaCliente',
            'filtros'            => [
                'mes'          => $mes,
                'dia'          => $dia,
                'fecha_inicio' => $fechaInicio,
                'fecha_fin'    => $fechaFin
            ],
            'rango_disponible'   => $rango,
            'talm_seleccionados' => $talm,
            'base'               => $base,
            'total_registros'    => count($base)
        ];
    }

    private function obtenerFechaClienteTrans(array $filtros): array
    {
        $rango = $this->repo->obtenerRangoDisponible($this->anio);

        if (empty($rango['fecha_max'])) {
            return [
                'tipo_grafico'       => 'FechaClienteTrans',
                'filtros'            => [
                    'mes'          => null,
                    'dia'          => null,
                    'fecha_inicio' => null,
                    'fecha_fin'    => null
                ],
                'rango_disponible'   => $rango,
                'talm_seleccionados' => [],
                'base'               => [],
                'total_registros'    => 0
            ];
        }

        [$mes, $dia, $fechaInicio, $fechaFin] = $this->resolverRangoFechas($filtros, $rango);
        $talm = $this->resolverTalm(
            $filtros['talm'] ?? [],
            ['A11', 'A18', 'PB1', 'PB3', 'PB4', 'PB7', 'PT0']
        );
        $base = $this->repo->obtenerBaseFechaClienteTrans($talm, $fechaInicio, $fechaFin);

        return [
            'tipo_grafico'       => 'FechaClienteTrans',
            'filtros'            => [
                'mes'          => $mes,
                'dia'          => $dia,
                'fecha_inicio' => $fechaInicio,
                'fecha_fin'    => $fechaFin
            ],
            'rango_disponible'   => $rango,
            'talm_seleccionados' => $talm,
            'base'               => $base,
            'total_registros'    => count($base)
        ];
    }

    private function obtenerFechaClienteTransCod(array $filtros): array
    {
        $rango = $this->repo->obtenerRangoDisponible($this->anio);

        if (empty($rango['fecha_max'])) {
            return [
                'tipo_grafico'       => 'FechaClienteTransCod',
                'filtros'            => [
                    'mes'          => null,
                    'dia'          => null,
                    'fecha_inicio' => null,
                    'fecha_fin'    => null
                ],
                'rango_disponible'   => $rango,
                'talm_seleccionados' => [],
                'base'               => [],
                'total_registros'    => 0
            ];
        }

        [$mes, $dia, $fechaInicio, $fechaFin] = $this->resolverRangoFechas($filtros, $rango);
        $talm = $this->resolverTalm($filtros['talm'] ?? [], ['PB7']);
        $base = $this->repo->obtenerBaseFechaClienteTransCod($talm, $fechaInicio, $fechaFin);

        return [
            'tipo_grafico'       => 'FechaClienteTransCod',
            'filtros'            => [
                'mes'          => $mes,
                'dia'          => $dia,
                'fecha_inicio' => $fechaInicio,
                'fecha_fin'    => $fechaFin
            ],
            'rango_disponible'   => $rango,
            'talm_seleccionados' => $talm,
            'base'               => $base,
            'total_registros'    => count($base)
        ];
    }

    private function obtenerDashboard2(array $filtros): array
    {
        $rango = $this->repo->obtenerRangoDisponible($this->anio);

        if (empty($rango['fecha_max'])) {
            return [
                'tipo_grafico'         => 'Dashboard2',
                'filtros'              => [
                    'mes'          => null,
                    'dia'          => null,
                    'fecha_inicio' => null,
                    'fecha_fin'    => null
                ],
                'rango_disponible'     => $rango,
                'talm_seleccionados'   => [],
                'alma_fecha'           => [],
                'fecha_cliente'        => [],
                'fecha_cliente_transcod' => []
            ];
        }

        [$mes, $dia, $fechaInicio, $fechaFin] = $this->resolverRangoFechas($filtros, $rango);
        $talm = $this->resolverTalm($filtros['talm'] ?? [], ['PB7']);

        return [
            'tipo_grafico'           => 'Dashboard2',
            'filtros'                => [
                'mes'          => $mes,
                'dia'          => $dia,
                'fecha_inicio' => $fechaInicio,
                'fecha_fin'    => $fechaFin
            ],
            'rango_disponible'       => $rango,
            'talm_seleccionados'     => $talm,
            'alma_fecha'             => $this->repo->obtenerBaseAlmaFecha($talm, $fechaInicio, $fechaFin),
            'fecha_cliente'          => $this->repo->obtenerBaseFechaCliente($talm, $fechaInicio, $fechaFin),
            'fecha_cliente_transcod' => $this->repo->obtenerBaseFechaClienteTransCod($talm, $fechaInicio, $fechaFin)
        ];
    }

    private function resolverRangoFechas(array $filtros, array $rango): array
    {
        $mesDefecto = !empty($rango['ultimo_mes_inicio'])
            ? substr($rango['ultimo_mes_inicio'], 0, 7)
            : null;

        $mes = $this->resolverMes($filtros['mes'] ?? '', null);
        $dia = $this->resolverDia($filtros['dia'] ?? '');

        $tieneFiltrosLegacy = !empty($filtros['fecha_inicio']) || !empty($filtros['fecha_fin']);

        if ($dia !== null) {
            $fechaInicio = $dia;
            $fechaFin    = $dia;
            $mes         = substr($dia, 0, 7);
        } elseif ($mes !== null) {
            $inicioMes   = new DateTimeImmutable($mes . '-01');
            $fechaInicio = $inicioMes->format('Y-m-d');
            $fechaFin    = $inicioMes->format('Y-m-t');
        } elseif ($tieneFiltrosLegacy) {
            $fechaInicio = $this->resolverFecha($filtros['fecha_inicio'] ?? '', $rango['ultimo_mes_inicio']);
            $fechaFin    = $this->resolverFecha($filtros['fecha_fin'] ?? '', $rango['ultimo_mes_fin']);
            $mes         = substr($fechaInicio, 0, 7);
        } else {
            $mes         = $mesDefecto;
            $inicioMes   = new DateTimeImmutable($mes . '-01');
            $fechaInicio = $inicioMes->format('Y-m-d');
            $fechaFin    = $inicioMes->format('Y-m-t');
        }

        if ($fechaInicio > $fechaFin) {
            throw new InvalidArgumentException('La fecha inicial no puede ser mayor que la fecha final.');
        }

        return [$mes, $dia, $fechaInicio, $fechaFin];
    }

    private function resolverTalm($valor, array $porDefecto = ['PB7']): array
    {
        $disponibles = array_column($this->repo->obtenerTalmDisponibles($this->anio), 'codigo');

        if (is_string($valor)) {
            $valor = array_map('trim', explode(',', $valor));
        }

        if (!is_array($valor)) {
            $valor = [];
        }

        $seleccionados = array_values(array_unique(array_filter(array_map('trim', $valor), function ($codigo) use ($disponibles) {
            return $codigo !== '' && in_array($codigo, $disponibles, true);
        })));

        if (!empty($seleccionados)) {
            return $seleccionados;
        }

        $defectos = array_values(array_filter($porDefecto, function ($codigo) use ($disponibles) {
            return in_array($codigo, $disponibles, true);
        }));

        if (!empty($defectos)) {
            return $defectos;
        }

        if (in_array('PB7', $disponibles, true)) {
            return ['PB7'];
        }

        return !empty($disponibles) ? [$disponibles[0]] : [];
    }

    private function resolverMes($valor, ?string $mesDefecto): ?string
    {
        $valor = trim((string) $valor);

        if ($valor === '') {
            return $mesDefecto;
        }

        if (!preg_match('/^(\d{4})-(\d{2})$/', $valor, $coincidencia)) {
            throw new InvalidArgumentException('Mes inválido: ' . $valor);
        }

        $anio = (int) $coincidencia[1];
        $mes  = (int) $coincidencia[2];

        if ($mes < 1 || $mes > 12) {
            throw new InvalidArgumentException('Mes inválido: ' . $valor);
        }

        return sprintf('%04d-%02d', $anio, $mes);
    }

    private function resolverDia($valor): ?string
    {
        $valor = trim((string) $valor);

        if ($valor === '') {
            return null;
        }

        return $this->resolverFecha($valor, '');
    }

    private function resolverFecha($valor, string $fechaDefecto): string
    {
        $valor = trim((string) $valor);

        if ($valor === '') {
            return $fechaDefecto;
        }

        $fecha = DateTimeImmutable::createFromFormat('!Y-m-d', $valor);

        if (!$fecha || $fecha->format('Y-m-d') !== $valor) {
            throw new InvalidArgumentException('Fecha inválida: ' . $valor);
        }

        return $valor;
    }
}
