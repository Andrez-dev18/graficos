<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/PPPT2026Service.php';

class PPPT2026Controller
{
    private $database;

    public function __construct()
    {
        $this->database = new Database();
    }

    public function getDashboard()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            if (!is_array($data)) {
                $data = [];
            }

            $anio = isset($data['anio']) ? trim((string)$data['anio']) : '2026';
            if (!in_array($anio, ['2024', '2025', '2026'], true)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'status'  => 'error',
                    'message' => 'Año no válido. Los años permitidos son 2024, 2025 y 2026.'
                ]);
                exit;
            }

            $data['anio'] = $anio;
            $db = $this->database->getConnectionForYear($anio);
            $service = new PPPT2026Service($db);

            $resultado = $service->obtenerDashboard($data);

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
                'message' => 'Error al cargar Dashboard PPT 2026: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}
