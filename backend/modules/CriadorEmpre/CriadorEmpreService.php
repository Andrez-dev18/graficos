<?php

require_once __DIR__ . '/handlers/CantidadesTablaHandler.php';
require_once __DIR__ . '/handlers/CantidadesGraficoHandler.php';
require_once __DIR__ . '/handlers/DashCantidadesHandler.php';

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

        if (!in_array($tipoGrafico, ['CantidadesTabla', 'CantidadesGrafico', 'DashCantidades'], true)) {
            throw new InvalidArgumentException('Tipo de gráfico no válido.');
        }

        return $tipoGrafico;
    }

    public function obtenerFiltros(string $tipoGrafico = 'CantidadesTabla'): array
    {
        $tipoGrafico = $this->validarTipo($tipoGrafico);

        $filtros = CantidadesTablaHandler::obtenerFiltros($this->db);
        $filtros['tipo_grafico'] = $tipoGrafico;

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

        return [];
    }
}
