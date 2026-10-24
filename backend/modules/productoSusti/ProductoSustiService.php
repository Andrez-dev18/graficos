<?php

require_once __DIR__ . '/handlers/ProductoSustiHandler.php';

class ProductoSustiService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerFiltros(): array
    {
        return ProductoSustiHandler::obtenerFiltros($this->db);
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = isset($filtros['tipo_grafico']) ? trim((string)$filtros['tipo_grafico']) : 'ProdGeneral';
        $resultado = ProductoSustiHandler::obtenerDatos($this->db, $filtros);
        $resultado['tipo_grafico'] = $tipoGrafico;

        return $resultado;
    }
}
