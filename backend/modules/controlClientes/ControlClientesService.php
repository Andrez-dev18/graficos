<?php

require_once __DIR__ . '/handlers/ControlClientesHandler.php';

class ControlClientesService
{
    private $db;

    private const TIPOS_VALIDOS = [
        'UndCorporativos',
        'PesoCorporativos',
        'ParetoCorporativos',
        'ParetoCorporativosZona',
        'ParetoCorporativosSubZona',
        'ParticipacionUnd',
        'ParticipacionKilos',
        'AqpSubZonasCant',
        'AqpSubZonasPeso',
        'AqpSubClientes',
        'ConteoClientes'
    ];

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    private function validarTipo(string $tipoGrafico): string
    {
        $tipoGrafico = trim($tipoGrafico);

        if ($tipoGrafico === '') {
            return 'UndCorporativos';
        }

        if (!in_array($tipoGrafico, self::TIPOS_VALIDOS, true)) {
            throw new InvalidArgumentException('Tipo de gráfico no válido: ' . $tipoGrafico);
        }

        return $tipoGrafico;
    }

    public function obtenerFiltros(string $tipoGrafico = 'UndCorporativos'): array
    {
        $this->validarTipo($tipoGrafico);
        return ControlClientesHandler::obtenerFiltros($this->db);
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = $this->validarTipo((string)($filtros['tipo_grafico'] ?? 'UndCorporativos'));
        $filtros['tipo_grafico'] = $tipoGrafico;

        $datos = ControlClientesHandler::obtenerDatos($this->db, $filtros);
        $datos['tipo_grafico'] = $tipoGrafico;

        return $datos;
    }
}
