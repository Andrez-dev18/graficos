<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/AnalisisCostoDiarioService.php';

class AnalisisCostoDiarioController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new AnalisisCostoDiarioService($this->db);
    }

    public function getFiltros()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $resultado = $this->service->obtenerFiltrosIniciales();
            echo json_encode([
                'success' => true,
                'status'  => 'success',
                'data'    => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al cargar filtros de AnalisisCostoDiario: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    public function getDashboard()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerDashboard($data ?? []);

            echo json_encode([
                'success' => true,
                'status'  => 'success',
                'payload' => $resultado,
                'data'    => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al cargar AnalisisCostoDiario: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}
