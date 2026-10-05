<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/TrazabilidadService.php';

class TrazabilidadController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new TrazabilidadService($this->db);
    }

    private function getRequestParams()
    {
        $params = array_merge($_GET, $_POST);
        $rawInput = file_get_contents('php://input');
        if ($rawInput) {
            $decoded = json_decode($rawInput, true);
            if (is_array($decoded)) {
                $params = array_merge($params, $decoded);
            }
        }
        return $params;
    }

    private function sendJsonResponse($data, $statusCode = 200)
    {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    public function getGranjas()
    {
        try {
            $res = $this->service->getGranjas();
            $this->sendJsonResponse($res);
        } catch (Exception $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener granjas: ' . $e->getMessage()
            ], 500);
        } catch (Throwable $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener granjas: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getOrigenAves()
    {
        try {
            $params = $this->getRequestParams();
            $tipo = isset($params['tipo']) ? (string)$params['tipo'] : '';
            $res = $this->service->getOrigenAves($tipo);
            $this->sendJsonResponse($res);
        } catch (Exception $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener procedencias: ' . $e->getMessage()
            ], 500);
        } catch (Throwable $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener procedencias: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getTiposMuestra()
    {
        try {
            $res = $this->service->getTiposMuestra();
            $this->sendJsonResponse($res);
        } catch (Exception $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener tipos de muestra: ' . $e->getMessage()
            ], 500);
        } catch (Throwable $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener tipos de muestra: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getAnalisisFiltro()
    {
        try {
            $params = $this->getRequestParams();
            $res = $this->service->getAnalisisFiltro($params);
            $this->sendJsonResponse($res);
        } catch (Exception $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al filtrar análisis: ' . $e->getMessage()
            ], 500);
        } catch (Throwable $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al filtrar análisis: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getAnalisisDetalle()
    {
        try {
            $params = $this->getRequestParams();
            $res = $this->service->getAnalisisDetalle($params);
            $this->sendJsonResponse($res);
        } catch (Exception $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener detalle de análisis: ' . $e->getMessage()
            ], 500);
        } catch (Throwable $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener detalle de análisis: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getAnalisisCodref()
    {
        try {
            $params = $this->getRequestParams();
            $res = $this->service->getAnalisisCodref($params);
            $this->sendJsonResponse($res);
        } catch (Exception $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener análisis por codRef: ' . $e->getMessage()
            ], 500);
        } catch (Throwable $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener análisis por codRef: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getAnalisisPeriodo()
    {
        try {
            $params = $this->getRequestParams();
            $res = $this->service->getAnalisisPeriodo($params);
            $this->sendJsonResponse($res);
        } catch (Exception $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener período de análisis: ' . $e->getMessage()
            ], 500);
        } catch (Throwable $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener período de análisis: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getAnalisisPorcentaje()
    {
        try {
            $params = $this->getRequestParams();
            $res = $this->service->getAnalisisPorcentaje($params);
            $this->sendJsonResponse($res);
        } catch (Exception $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener porcentaje de análisis: ' . $e->getMessage()
            ], 500);
        } catch (Throwable $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener porcentaje de análisis: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getReporteResultados()
    {
        try {
            $params = $this->getRequestParams();
            $res = $this->service->getReporteResultados($params);
            $this->sendJsonResponse($res);
        } catch (Exception $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al generar reporte de resultados: ' . $e->getMessage()
            ], 500);
        } catch (Throwable $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al generar reporte de resultados: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getReporteEnfermedades()
    {
        try {
            $params = $this->getRequestParams();
            $res = $this->service->getReporteEnfermedades($params);
            $this->sendJsonResponse($res);
        } catch (Exception $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al generar reporte de enfermedades: ' . $e->getMessage()
            ], 500);
        } catch (Throwable $e) {
            $this->sendJsonResponse([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al generar reporte de enfermedades: ' . $e->getMessage()
            ], 500);
        }
    }
}
