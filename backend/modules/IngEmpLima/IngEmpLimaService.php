<?php

require_once __DIR__ . '/handlers/ParticipacionMercadoDiariaHandler.php';
require_once __DIR__ . '/handlers/ParticipacionMercadoSemanalHandler.php';
require_once __DIR__ . '/handlers/EvolucionPesoHandler.php';
require_once __DIR__ . '/handlers/EvolucionPesoPrecioHandler.php';
require_once __DIR__ . '/handlers/EvolucionPrecioHandler.php';
require_once __DIR__ . '/handlers/KilogramosHandler.php';
require_once __DIR__ . '/handlers/PrecioPorMesHandler.php';

class IngEmpLimaService
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
            return 'ParticipacionMercadoDiaria';
        }

        if (!in_array($tipoGrafico, ['ParticipacionMercadoDiaria', 'ParticipacionMercadoSemanal', 'EvolucionPeso', 'EvolucionPesoPrecio', 'EvolucionPrecio', 'Kilogramos', 'PrecioPorMes'], true)) {
            throw new InvalidArgumentException('Tipo de gráfico no válido: ' . $tipoGrafico);
        }

        return $tipoGrafico;
    }

    public function obtenerFiltros(string $tipoGrafico = 'ParticipacionMercadoDiaria'): array
    {
        $tipoGrafico = $this->validarTipo($tipoGrafico);

        if ($tipoGrafico === 'ParticipacionMercadoDiaria') {
            return ParticipacionMercadoDiariaHandler::obtenerFiltros($this->db);
        }

        if ($tipoGrafico === 'ParticipacionMercadoSemanal') {
            return ParticipacionMercadoSemanalHandler::obtenerFiltros($this->db);
        }

        if ($tipoGrafico === 'EvolucionPeso') {
            return EvolucionPesoHandler::obtenerFiltros($this->db);
        }

        if ($tipoGrafico === 'EvolucionPesoPrecio') {
            return EvolucionPesoPrecioHandler::obtenerFiltros($this->db);
        }

        if ($tipoGrafico === 'EvolucionPrecio') {
            return EvolucionPrecioHandler::obtenerFiltros($this->db);
        }

        if ($tipoGrafico === 'Kilogramos') {
            return KilogramosHandler::obtenerFiltros($this->db);
        }

        if ($tipoGrafico === 'PrecioPorMes') {
            return PrecioPorMesHandler::obtenerFiltros($this->db);
        }

        return [];
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = $this->validarTipo((string)($filtros['tipo_grafico'] ?? 'ParticipacionMercadoDiaria'));
        $filtros['tipo_grafico'] = $tipoGrafico;

        if ($tipoGrafico === 'ParticipacionMercadoDiaria') {
            return ParticipacionMercadoDiariaHandler::handle($this->db, $filtros);
        }

        if ($tipoGrafico === 'ParticipacionMercadoSemanal') {
            return ParticipacionMercadoSemanalHandler::handle($this->db, $filtros);
        }

        if ($tipoGrafico === 'EvolucionPeso') {
            return EvolucionPesoHandler::handle($this->db, $filtros);
        }

        if ($tipoGrafico === 'EvolucionPesoPrecio') {
            return EvolucionPesoPrecioHandler::handle($this->db, $filtros);
        }

        if ($tipoGrafico === 'EvolucionPrecio') {
            return EvolucionPrecioHandler::handle($this->db, $filtros);
        }

        if ($tipoGrafico === 'Kilogramos') {
            return KilogramosHandler::handle($this->db, $filtros);
        }

        if ($tipoGrafico === 'PrecioPorMes') {
            return PrecioPorMesHandler::handle($this->db, $filtros);
        }

        return [];
    }
}
