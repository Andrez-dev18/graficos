<?php

require_once __DIR__ . '/../../config/Database.php';
require_once __DIR__ . '/CostoDiarioService.php';

class CostoDiarioController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new CostoDiarioService($this->db);
    }

    public function getDashboard()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerDashboard($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado,
                'data'    => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al cargar Dashboard Costo Diario: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    public function guardarFactorAlimento()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->guardarFactorAlimento($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado,
                'data'    => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al guardar factor de alimento: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}
