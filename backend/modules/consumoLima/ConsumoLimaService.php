<?php

require_once __DIR__ . '/handlers/DashAnalisisHandler.php';

class ConsumoLimaService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerFiltros(): array
    {
        return ConsumoLimaDashAnalisisHandler::filtros($this->db);
    }

    public function obtenerConsumos(array $filtros): array
    {
        return ConsumoLimaDashAnalisisHandler::consumos($this->db, $filtros);
    }

    public function obtenerComprasAlmacen(array $filtros): array
    {
        return ConsumoLimaDashAnalisisHandler::comprasAlmacen($this->db, $filtros);
    }

    public function obtenerComprasDocumentos(array $filtros): array
    {
        return ConsumoLimaDashAnalisisHandler::comprasDocumentos($this->db, $filtros);
    }

    public function obtenerTabulacionesPu(array $filtros): array
    {
        return ConsumoLimaDashAnalisisHandler::tabulacionesPu($this->db, $filtros);
    }

    public function obtenerAnalisisMermas(array $filtros): array
    {
        return ConsumoLimaDashAnalisisHandler::analisisMermas($this->db, $filtros);
    }
}
