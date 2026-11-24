<?php

require_once __DIR__ . '/handlers/DashboardHandler.php';

class AntenasService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerDashboard(array $filtros): array
    {
        return AntenasDashboardHandler::dashboard($this->db, $filtros);
    }
}
