<?php

require_once __DIR__ . '/CorrelacionGralRepo.php';

class CorrelacionGralService
{
    private $repo;

    public function __construct($db, $dbComercial)
    {
        $this->repo = new CorrelacionGralRepo($db, $dbComercial);
    }

    public function obtenerFiltros(): array
    {
        return [
            'status' => 'success',
            'data' => $this->repo->getFiltros()
        ];
    }

    public function obtenerCorrelacion(array $filtros): array
    {
        $f = $this->normalizarFiltros($filtros);

        $pageSize = max(20, min(200, (int)($filtros['page_size'] ?? 100)));
        $pages = [
            'ventas' => max(1, (int)($filtros['page_ventas'] ?? 1)),
            'transportes' => max(1, (int)($filtros['page_transportes'] ?? 1)),
            'agcausal' => max(1, (int)($filtros['page_agcausal'] ?? 1)),
            'mermas' => max(1, (int)($filtros['page_mermas'] ?? 1))
        ];

        $fTablas = $this->filtrosTablas($f);
        $fVentas = $f;
        if (!empty($f['placas_todas'])) {
            $fVentas['placas'] = [];
        }

        $ventas = $this->repo->getVentas($fVentas, $pageSize, ($pages['ventas'] - 1) * $pageSize);
        $transportes = $this->repo->getTransportes($fTablas, $pageSize, ($pages['transportes'] - 1) * $pageSize);
        $agcausal = $this->repo->getAgcausal($fTablas, $pageSize, ($pages['agcausal'] - 1) * $pageSize);
        $mermas = $this->repo->getMermas($fTablas, $pageSize, ($pages['mermas'] - 1) * $pageSize);

        return [
            'status' => 'success',
            'page_size' => $pageSize,
            'ventas' => array_merge($ventas, ['page' => $pages['ventas'], 'page_size' => $pageSize]),
            'transportes' => array_merge($transportes, ['page' => $pages['transportes'], 'page_size' => $pageSize]),
            'agcausal' => array_merge($agcausal, ['page' => $pages['agcausal'], 'page_size' => $pageSize]),
            'mermas' => array_merge($mermas, ['page' => $pages['mermas'], 'page_size' => $pageSize])
        ];
    }

    public function obtenerTabla(array $filtros, string $tabla): array
    {
        $permitidas = ['ventas', 'transportes', 'agcausal', 'mermas'];
        if (!in_array($tabla, $permitidas, true)) {
            throw new InvalidArgumentException('Tabla no válida: ' . $tabla);
        }

        $f = $this->normalizarFiltros($filtros);
        $pageSize = max(20, min(200, (int)($filtros['page_size'] ?? 100)));
        $page = max(1, (int)($filtros['page'] ?? $filtros['page_' . $tabla] ?? 1));
        $offset = ($page - 1) * $pageSize;

        if (!empty($f['placas_todas'])) {
            $f['placas'] = $tabla === 'ventas' ? [] : $this->repo->getPlacasVentas($f);
        }

        switch ($tabla) {
            case 'ventas':
                $seccion = $this->repo->getVentas($f, $pageSize, $offset);
                break;
            case 'transportes':
                $seccion = $this->repo->getTransportes($f, $pageSize, $offset);
                break;
            case 'agcausal':
                $seccion = $this->repo->getAgcausal($f, $pageSize, $offset);
                break;
            default:
                $seccion = $this->repo->getMermas($f, $pageSize, $offset);
                break;
        }

        return array_merge($seccion, [
            'status' => 'success',
            'page' => $page,
            'page_size' => $pageSize
        ]);
    }

    public function obtenerSeleccion(array $filtros): array
    {
        $f = $this->normalizarFiltros($filtros);
        $fTablas = $this->filtrosTablas($f);
        $limite = 1000;

        $transportes = $this->repo->getTransportes($fTablas, $limite, 0, $limite);
        $agcausal = $this->repo->getAgcausal($fTablas, $limite, 0, $limite);
        $mermas = $this->repo->getMermas($fTablas, $limite, 0, $limite);

        return [
            'status' => 'success',
            'page_size' => 100,
            'transportes' => $this->seccionCompleta($transportes, $limite),
            'agcausal' => $this->seccionCompleta($agcausal, $limite),
            'mermas' => $this->seccionCompleta($mermas, $limite)
        ];
    }

    private function seccionCompleta(array $seccion, int $limite): array
    {
        $total = (int)($seccion['total'] ?? 0);
        return [
            'rows' => $seccion['rows'] ?? [],
            'total' => $total,
            'completo' => $total <= $limite
        ];
    }

    private function normalizarFiltros(array $filtros): array
    {
        return [
            'fecha_inicio' => $filtros['fecha_inicio'] ?? date('Y-m-d', strtotime('-7 days')),
            'fecha_fin' => $filtros['fecha_fin'] ?? date('Y-m-d'),
            'linea' => trim((string)($filtros['linea'] ?? 'TODO')),
            'tdocs' => $this->lista($filtros['tdocs'] ?? []),
            'zonas' => $this->lista($filtros['zonas'] ?? []),
            'rutas' => $this->lista($filtros['rutas'] ?? []),
            'placas' => $this->lista($filtros['placas'] ?? []),
            'placas_todas' => !empty($filtros['placas_todas']),
            'seleccion_fecha' => trim((string)($filtros['seleccion_fecha'] ?? '')),
            'seleccion_placa' => trim((string)($filtros['seleccion_placa'] ?? ''))
        ];
    }

    private function filtrosTablas(array $f): array
    {
        if (!empty($f['placas_todas'])) {
            $f['placas'] = $this->repo->getPlacasVentas($f);
        }
        return $f;
    }

    private function lista($valor): array
    {
        if (is_array($valor)) return array_values(array_filter(array_map('strval', $valor), function($v) { return trim($v) !== ''; }));
        $valor = trim((string)$valor);
        return $valor === '' ? [] : [$valor];
    }
}
