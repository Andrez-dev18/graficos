<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/AnalisisTransporteService.php';
require_once __DIR__ . '/CorrelacionGralService.php';

class AnalisisTransporteController
{
    private $service;
    private $correlacion;

    public function __construct()
    {
        $database = new Database();
        $db = $database->getConnection();
        $comercial = ($db instanceof SmartPDO) ? $db->getConnection('tc') : null;
        $this->service = new AnalisisTransporteService($db);
        $this->correlacion = new CorrelacionGralService($db, $comercial ?: $db);
    }

    public function getLiquidacionPlacas()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;
            $resultado = $this->service->obtenerLiquidacionPlacas($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al cargar Liquidación de Placas: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    public function getCorrelacionFiltros()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            echo json_encode([
                'success' => true,
                'payload' => $this->correlacion->obtenerFiltros()
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al cargar filtros de Correlación: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    public function getCorrelacionTabla()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;
            $tabla = trim((string)($data['tabla'] ?? ''));
            $resultado = $this->correlacion->obtenerTabla($data, $tabla);
            echo json_encode(['success' => true, 'payload' => $resultado]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al cargar tabla de Correlación: ' . $e->getMessage()]);
        }
        exit;
    }

    public function getCorrelacionSeleccion()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;
            $resultado = $this->correlacion->obtenerSeleccion($data);
            echo json_encode(['success' => true, 'payload' => $resultado]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al cargar la selección: ' . $e->getMessage()]);
        }
        exit;
    }

    public function getCorrelacionGral()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;
            $resultado = $this->correlacion->obtenerCorrelacion($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al cargar Correlación General: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}
