<?php

require_once __DIR__ . '/handlers/MermaGeneralMensualHandler.php';

class MermaGeneralMensualService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerDashboard(array $filtros = []): array
    {
        return MermaGeneralMensualHandler::handle($this->db, $filtros);
    }
}
