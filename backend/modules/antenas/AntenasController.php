<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/AntenasService.php';

class AntenasController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $db = $database->getConnection();
        $joya = ($db instanceof SmartPDO) ? $db->getConnection('joya') : null;

        $this->db = $joya ?: $db;
        $this->service = new AntenasService($this->db);
    }

    public function getDashboard()
    {
        $this->responder(function ($data) {
            return $this->service->obtenerDashboard($data);
        }, 'Error al consultar el dashboard de Antenas: ');
    }

    private function responder($callback, string $mensajeError): void
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true);

            if (!is_array($data)) {
                $data = $_POST ?: [];
            }

            $resultado = $callback($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ], JSON_UNESCAPED_UNICODE);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => $mensajeError . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }

        exit;
    }
}
