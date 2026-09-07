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

    /**
     * Endpoint POST: Devuelve el comparativo de Cumplimiento Plan vs Real
     * para el modal de 06 Ventas Saca
     */
    public function getCumplimientoPlanReal()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerCumplimientoPlanReal($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener cumplimiento Plan vs Real: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Matriz principal de Mayores Devoluciones por Zona y Motivo (08 DevolucionesSaca)
     */
    public function getDevolucionesPorZonaMotivo()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerDevolucionesPorZonaMotivo($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener devoluciones por zona y motivo: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Modal maestro al hacer clic en un motivo (Tendencia diaria + Ranking clientes)
     */
    public function getDetalleMotivoDevolucion()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerDetalleMotivoDevolucion($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener detalle del motivo de devolución: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Obtiene el detalle de ventas y devoluciones para el modal Ver Datos
     */
    public function getDetalle()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerDetalle($data);

            echo json_encode($resultado);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener detalle de ventas resumen: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Exporta el detalle filtrado a Excel
     */
    public function exportarExcelDetalle()
    {
        try {
            $rawInput = file_get_contents('php://input');
            $filtros = json_decode($rawInput, true);
            if (!$filtros) {
                $filtros = $_POST;
            }

            $this->service->exportarExcelDetalle($filtros);
        } catch (Exception $e) {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al exportar Excel: ' . $e->getMessage()
            ]);
            exit;
        }
    }
}



