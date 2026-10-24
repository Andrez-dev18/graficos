<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/TamanoMercadoService.php';

class TamanoMercadoController
{
    private $db;
    private $service;

    public function __construct()
    {
        try {
            $database = new Database();
            $this->db = $database->getConnection();
            $this->service = new TamanoMercadoService($this->db);
        } catch (Throwable $e) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al inicializar base de datos: ' . $e->getMessage()
            ]);
            exit;
        }
    }

    public function getFiltros()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $resultado = $this->service->obtenerFiltros();

            echo json_encode([
                'success' => true,
                'status'  => 'success',
                'data'    => $resultado
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al cargar filtros de Tamaño de Mercado: ' . $e->getMessage()
            ]);
        }

        exit;
    }

    public function getDashboard()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $input = json_decode(file_get_contents('php://input'), true) ?: [];

            $filtros = [
                'tipo_grafico' => $input['tipo_grafico'] ?? 'Participacion',
                'fecha_inicio' => $input['fecha_inicio'] ?? null,
                'fecha_fin'    => $input['fecha_fin'] ?? null,
                'provincia'    => $input['provincia'] ?? null,
                'provincias'   => $input['provincias'] ?? null,
                'empresas'     => $input['empresas'] ?? []
            ];

            $resultado = $this->service->obtenerDashboard($filtros);

            echo json_encode([
                'success' => true,
                'status'  => 'success',
                'data'    => $resultado
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener datos de Tamaño de Mercado: ' . $e->getMessage()
            ]);
        }

        exit;
    }
}
