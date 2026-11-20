<?php

require_once __DIR__ . '/handlers/DashAnalisisHandler.php';

class EventosMermaService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerFiltros(): array
    {
        return DashAnalisisHandler::filtros($this->db);
    }

    public function obtenerDashAnalisis(array $filtros): array
    {
        return DashAnalisisHandler::handle($this->db, $filtros);
    }

    public function obtenerListado(array $filtros): array
    {
        return DashAnalisisHandler::listado($this->db, $filtros);
    }

    public function obtenerPorc(array $filtros): array
    {
        return DashAnalisisHandler::porc($this->db, $filtros);
    }

    public function obtenerPorcDia(array $filtros): array
    {
        return DashAnalisisHandler::porcDia($this->db, $filtros);
    }

    public function obtenerCantDia(array $filtros): array
    {
        return DashAnalisisHandler::cantDia($this->db, $filtros);
    }

    public function obtenerPareto(array $filtros): array
    {
        return DashAnalisisHandler::pareto($this->db, $filtros);
    }
}
