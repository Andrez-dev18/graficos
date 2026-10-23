<?php

require_once __DIR__ . '/handlers/TiendasMercadosHandler.php';

class TiendasMercadosService
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
            return 'DashGral';
        }

        if (!in_array($tipoGrafico, [
            'DashGral',
            'DashPastel',
            'PorcGeneralcant',
            'PorcGeneral',
            'PorTipoEstableCant',
            'PorTipoEstable',
            'PastelPorcGeneralcant',
            'PastelPorcGeneraltam',
            'BarraPorcGeneraltam'
        ], true)) {
            throw new InvalidArgumentException('Tipo de gráfico no válido.');
        }

        return $tipoGrafico;
    }

    public function obtenerFiltros(string $tipoGrafico = 'DashGral'): array
    {
        $this->validarTipo($tipoGrafico);
        return TiendasMercadosHandler::obtenerFiltros($this->db);
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = $this->validarTipo((string)($filtros['tipo_grafico'] ?? 'DashGral'));
        $filtros['tipo_grafico'] = $tipoGrafico;

        return TiendasMercadosHandler::handle($this->db, $filtros, $tipoGrafico);
    }
}
