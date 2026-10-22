<?php

require_once __DIR__ . '/handlers/CantidadesTablaHandler.php';
require_once __DIR__ . '/handlers/CantidadesGraficoHandler.php';
require_once __DIR__ . '/handlers/DashCantidadesHandler.php';
require_once __DIR__ . '/handlers/PreciosGraficoHandler.php';
require_once __DIR__ . '/handlers/PreciosTablaHandler.php';
require_once __DIR__ . '/handlers/DashPreciosHandler.php';

class CriadorEmpreService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    private function validarTipo(string $tipoGrafico): string
    {
        $tipoGrafico = trim($tipoGrafico);

        if ($tipoGrafico === '') {
            return 'CantidadesTabla';
        }

        if (!in_array($tipoGrafico, ['CantidadesTabla', 'CantidadesGrafico', 'DashCantidades', 'PreciosGrafico', 'PreciosTabla', 'DashPrecios'], true)) {
            throw new InvalidArgumentException('Tipo de gráfico no válido.');
        }

        return $tipoGrafico;
    }

    public function obtenerFiltros(string $tipoGrafico = 'CantidadesTabla'): array
    {
        $tipoGrafico = $this->validarTipo($tipoGrafico);

        $filtros = CantidadesTablaHandler::obtenerFiltros($this->db);
        $precios = PreciosGraficoHandler::obtenerFiltros($this->db);

        $filtros['tipo_grafico'] = $tipoGrafico;
        $filtros['titulo_precio'] = $precios['titulo'];
        $filtros['tipo_precio'] = $precios['tipo'];
        $filtros['provincias_precio'] = $precios['provincias'];
        $filtros['provincias_precio_default'] = array_column($precios['provincias'], 'id');
        $filtros['proveedores_precio'] = $precios['proveedores'];
        $filtros['proveedores_precio_default'] = $precios['proveedores_default'];
        $filtros['fecha_precio_min'] = $precios['fecha_min'];
        $filtros['fecha_precio_max'] = $precios['fecha_max'];
        $filtros['precio_min'] = $precios['precio_min'];
        $filtros['precio_max'] = $precios['precio_max'];

        return $filtros;
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = $this->validarTipo((string)($filtros['tipo_grafico'] ?? 'CantidadesTabla'));
        $filtros['tipo_grafico'] = $tipoGrafico;

        if ($tipoGrafico === 'CantidadesTabla') {
            return CantidadesTablaHandler::handle($this->db, $filtros);
        }

        if ($tipoGrafico === 'CantidadesGrafico') {
            return CantidadesGraficoHandler::handle($this->db, $filtros);
        }

        if ($tipoGrafico === 'DashCantidades') {
            return DashCantidadesHandler::handle($this->db, $filtros);
        }

        if ($tipoGrafico === 'PreciosGrafico') {
            return PreciosGraficoHandler::handle($this->db, $filtros);
        }

        if ($tipoGrafico === 'PreciosTabla') {
            return PreciosTablaHandler::handle($this->db, $filtros);
        }

        if ($tipoGrafico === 'DashPrecios') {
            return DashPreciosHandler::handle($this->db, $filtros);
        }

        return [];
    }
}
