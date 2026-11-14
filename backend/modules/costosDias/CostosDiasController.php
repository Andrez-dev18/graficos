<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/CostosDiasService.php';
require_once __DIR__ . '/CostosDiasPdf.php';

class CostosDiasController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new CostosDiasService($this->db);
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
                'message' => 'Error al cargar Dashboard Costos Tradicional Día: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    public function exportarPdf()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $payload = json_decode($rawInput, true) ?? $_POST;

            foreach (['datos', 'filtros'] as $campo) {
                if (isset($payload[$campo]) && is_string($payload[$campo])) {
                    $decodificado = json_decode($payload[$campo], true);
                    if (is_array($decodificado)) {
                        $payload[$campo] = $decodificado;
                    }
                }
            }

            $resultado = CostosDiasPdf::guardarTemporal($payload);

            echo json_encode([
                'success'  => true,
                'token'    => $resultado['token'],
                'filename' => $resultado['filename']
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al generar PDF: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    public function verPdf()
    {
        try {
            $token = isset($_GET['token']) ? (string)$_GET['token'] : '';
            CostosDiasPdf::servirTemporal($token);
        } catch (Throwable $e) {
            http_response_code(500);
            header('Content-Type: text/html; charset=utf-8');
            echo '<h1>Error al mostrar el PDF</h1><p>' . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8') . '</p>';
        }
        exit;
    }
}
