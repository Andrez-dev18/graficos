<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/ventasResumenService.php';

class VentasResumenController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new VentasResumenService($this->db);
    }

    /**
     * Endpoint GET / POST: Devuelve las opciones de filtros para el módulo Ventas Resumen
     */
    public function getFiltros()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $body = json_decode($rawInput, true) ?? $_REQUEST;
            $lineaProceso = $body['lineaproceso'] ?? ($_GET['lineaproceso'] ?? null);

            $resultado = $this->service->obtenerFiltrosIniciales($lineaProceso);
            echo json_encode([
                'success' => true,
                'lineasProceso'   => $resultado['lineasProceso'],
                'zonasFiscales'   => $resultado['zonasFiscales'],
                'items'           => $resultado['items'],
                'nomDevoluciones' => $resultado['nomDevoluciones']
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener filtros de ventas resumen: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint GET / POST: Devuelve las zonas e items filtrados por línea de proceso
     */
    public function getOpcionesPorLinea()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $body = json_decode($rawInput, true) ?? $_REQUEST;
            $lineaProceso = $body['lineaproceso'] ?? ($_GET['lineaproceso'] ?? '');

            $opciones = $this->service->obtenerOpcionesPorLinea($lineaProceso);
            echo json_encode([
                'success'       => true,
                'zonasFiscales' => $opciones['zonasFiscales'],
                'items'         => $opciones['items']
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener opciones por línea: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Procesa los filtros y retorna los datos del gráfico 07VentasSacCoor
     */
    public function getGraficoVentasSacCoor()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerGraficoVentasSacCoor($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al procesar el gráfico Ventas y Devoluciones: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Devuelve el desglose para el Modal de Análisis Secundario (Mini Gráficos)
     */
    public function getAnalisisSecundario()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerAnalisisSecundario($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener análisis secundario: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}

