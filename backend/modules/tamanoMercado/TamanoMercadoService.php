<?php

require_once __DIR__ . '/handlers/TamanoMercadoHandler.php';

class TamanoMercadoService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerFiltros(): array
    {
        return TamanoMercadoHandler::obtenerFiltros($this->db);
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = isset($filtros['tipo_grafico']) ? trim((string)$filtros['tipo_grafico']) : 'Participacion';
        $resultado = TamanoMercadoHandler::obtenerDatos($this->db, $filtros);
        $resultado['tipo_grafico'] = $tipoGrafico;

        return $resultado;
    }
}
