<?php

require_once __DIR__ . '/handlers/VolSemanalHandler.php';

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
}
