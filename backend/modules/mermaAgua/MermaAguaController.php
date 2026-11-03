<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/MermaAguaService.php';

class MermaAguaController
{
    private $service;

    public function __construct()
    {
        $database = new Database();
        $principal = $database->getConnection();
        $this->service = new MermaAguaService($principal);
    }

    public function getVistaProceso()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true);
            if (!is_array($data)) {
                $data = $_POST;
            }

            $resultado = $this->service->obtenerVistaProceso($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado,
                'data' => $resultado
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al cargar VistaProceso de Merma de Agua: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }

        exit;
    }
}
