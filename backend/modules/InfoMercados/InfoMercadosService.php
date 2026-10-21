<?php

require_once __DIR__ . '/handlers/VolSemanalHandler.php';
require_once __DIR__ . '/handlers/EmpresaChartHelper.php';
require_once __DIR__ . '/handlers/AQPEmpresaHandler.php';
require_once __DIR__ . '/handlers/AQPCantEmpresaHandler.php';
require_once __DIR__ . '/handlers/ProvEmpresaHandler.php';

class InfoMercadosService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerVolSemanal(string $anio = '2026'): array
    {
        return VolSemanalHandler::handle($this->db, $anio);
    }

    public function obtenerAqpEmpresaFiltros(string $anio = '2026'): array
    {
        return AQPEmpresaHandler::obtenerFiltros($this->db, $anio);
    }

    public function obtenerAqpEmpresa(array $filtros, string $anio = '2026'): array
    {
        return AQPEmpresaHandler::handle($this->db, $filtros, $anio);
    }

    public function obtenerAqpCantEmpresaFiltros(string $anio = '2026'): array
    {
        return AQPCantEmpresaHandler::obtenerFiltros($this->db, $anio);
    }

    public function obtenerAqpCantEmpresa(array $filtros, string $anio = '2026'): array
    {
        return AQPCantEmpresaHandler::handle($this->db, $filtros, $anio);
    }

    public function obtenerProvEmpresaFiltros(string $anio = '2026'): array
    {
        return ProvEmpresaHandler::obtenerFiltros($this->db, $anio);
    }

    public function obtenerProvEmpresa(array $filtros, string $anio = '2026'): array
    {
        return ProvEmpresaHandler::handle($this->db, $filtros, $anio);
    }
}
