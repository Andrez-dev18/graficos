<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/MermaGeneralMensualService.php';

class MermaGeneralMensualController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new MermaGeneralMensualService($this->db);
    }

    public function getDashboard()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true);
            if (!is_array($data)) {
                $data = $_POST;
            }

            $resultado = $this->service->obtenerDashboard($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado,
                'data' => $resultado
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al cargar Merma General Mensual: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }

        exit;
    }
}
