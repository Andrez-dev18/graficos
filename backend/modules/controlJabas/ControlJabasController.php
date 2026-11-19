<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/ControlJabasService.php';

class ControlJabasController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $db = $database->getConnection();
        $tc = ($db instanceof SmartPDO) ? $db->getConnection('tc') : null;

        $this->db = $tc ?: $db;
        $this->service = new ControlJabasService($this->db);
    }

    public function getFiltros()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $resultado = $this->service->obtenerFiltros();
            echo json_encode([
                'success' => true,
                'data' => $resultado
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener filtros de Control de Jabas: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }

        exit;
    }

    public function getDashboard()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $rawInput = file_get_contents('php://input');
            $filtros = json_decode($rawInput, true) ?? $_POST;

            if (!is_array($filtros)) {
                $filtros = [];
            }

            $resultado = $this->service->obtenerDashboard($filtros);

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
                'message' => 'Error al consultar Control de Jabas: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }

        exit;
    }

    public function getClientes()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $rawInput = file_get_contents('php://input');
            $filtros = json_decode($rawInput, true) ?? $_POST;

            if (!is_array($filtros)) {
                $filtros = [];
            }

            $resultado = $this->service->obtenerClientes($filtros);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener clientes: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }

        exit;
    }

    public function getStockProvincias()
    {
        $this->responderStockProvincias('obtenerStockProvincias', 'Error al consultar Stock de Provincias: ');
    }

    public function getStockProvinciasDetalle()
    {
        $this->responderStockProvincias('obtenerStockProvinciasDetalle', 'Error al consultar detalle de provincias: ');
    }

    public function getStockProvinciasFiltros()
    {
        $this->responderStockProvincias('obtenerStockProvinciasFiltros', 'Error al obtener filtros de provincias: ');
    }

    private function responderStockProvincias(string $metodo, string $mensajeError): void
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $rawInput = file_get_contents('php://input');
            $filtros = json_decode($rawInput, true) ?? $_POST;

            if (!is_array($filtros)) {
                $filtros = [];
            }

            $resultado = $this->service->{$metodo}($filtros);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
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
