<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/IngEmpLimaService.php';

class IngEmpLimaController
{
    private $db;
    private $service;

    public function __construct()
    {
        try {
            $database = new Database();
            $this->db = $database->getConnection();
            $this->service = new IngEmpLimaService($this->db);
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
            $tipoGrafico = isset($_GET['tipo_grafico'])
                ? trim((string)$_GET['tipo_grafico'])
                : 'ParticipacionMercadoDiaria';

            $resultado = $this->service->obtenerFiltros($tipoGrafico);

            echo json_encode([
                'success' => true,
                'status'  => 'success',
                'data'    => $resultado
            ]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => $e->getMessage()
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al cargar filtros de IngEmpLima: ' . $e->getMessage()
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

            if (!is_array($data)) {
                $data = [];
            }

            $resultado = $this->service->obtenerDashboard($data);

            echo json_encode([
                'success' => true,
                'status'  => 'success',
                'payload' => $resultado,
                'data'    => $resultado
            ]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => $e->getMessage()
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al cargar datos de IngEmpLima: ' . $e->getMessage()
            ]);
        }

        exit;
    }
}
