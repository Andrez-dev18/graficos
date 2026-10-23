<?php

require_once __DIR__ . '/handlers/DashGallinaHandler.php';

class AsoGallinaService
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
            return 'DashGallina';
        }

        if (!in_array($tipoGrafico, ['DashGallina', 'GallUnd', 'GallPeso', 'GallKilos'], true)) {
            throw new InvalidArgumentException('Tipo de gráfico no válido: ' . $tipoGrafico);
        }

        return $tipoGrafico;
    }

    public function obtenerFiltros(string $tipoGrafico = 'DashGallina'): array
    {
        $this->validarTipo($tipoGrafico);
        return DashGallinaHandler::obtenerFiltros($this->db);
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = isset($filtros['tipo_grafico'])
            ? $this->validarTipo((string)$filtros['tipo_grafico'])
            : 'DashGallina';

        $datos = DashGallinaHandler::obtenerDatos($this->db, $filtros);
        $datos['tipo_grafico'] = $tipoGrafico;

        return $datos;
    }
}
