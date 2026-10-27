<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/saldosxCobrarService.php';
require_once __DIR__ . '/handlers/SalxCobrarCtaTablaHandler.php';

class saldosxCobrarController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $db = $database->getConnection();
        $tc = ($db instanceof SmartPDO) ? $db->getConnection('tc') : null;
        $this->db = $tc ?: $db;
        $this->service = new saldosxCobrarService($this->db);
    }

    /**
     * Endpoint POST: Carga las opciones para los multiselects
     */
    public function getFiltros()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $resultado = $this->service->obtenerFiltrosIniciales();
            echo json_encode([
                'success' => true,
                'data' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener filtros: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Procesa los filtros y retorna la data del gráfico
     */
    public function getGraficoSaldos()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerSaldosGrafico($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al procesar el gráfico: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Retorna el detalle transaccional para la barra seleccionada
     */
    public function getDetalleSaldos()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerDetalleModal($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener detalle: ' . $e->getMessage()
            ]);
        }
        exit;
    }


    /**
     * FUNCIONES PARA GRAFICO DE LINEAS SALDOS POR COBRAR
     */
    /**
     * Endpoint POST: Opciones de filtros para SalxCobrarxZona
     */
    public function getFiltrosZona()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $filtros = $this->service->obtenerFiltrosZona();
            echo json_encode([
                'success' => true,
                'data'    => $filtros
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener filtros de zona: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Obtiene los datos consolidados para el gráfico por zona
     */
    public function getGraficoZona()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $filtros = json_decode($rawInput, true) ?? $_POST;

            $data = $this->service->obtenerGraficoZona($filtros);

            echo json_encode([
                'success' => true,
                'payload' => [
                    'data' => $data
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener datos por zona: ' . $e->getMessage()
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

    /**
     * FUNCIONES PARA GRAFICO DE ANTICIPOS
     */
    public function getGraficoAnticipos()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true);
            if (!$data) {
                $data = $_POST;
            }

            $resultado = $this->service->obtenerGraficoAnticiposData($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener datos de anticipos: ' . $e->getMessage()
            ]);
        }
        exit;
    }
    /**
     * FIN FUNCIONES PARA GRAFICO DE ANTICIPOS
     */

    /**
     * FUNCIONES PARA 20DashAnalisisCtasMaxDeudoresDocs (Saldos por Cuenta de Venta)
     */
    public function getGraficoAnalisisCuentas()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $filtros = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerGraficoAnalisisCuentas($filtros);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener datos de saldos por cuenta: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint para obtener análisis de corporativos y listado de documentos (20Dash)
     */
    public function getAnalisisCorporativosYDocs()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $filtros = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerAnalisisCorporativosYDocs($filtros);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener análisis corporativo: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    public function getGraficoCtaTabla()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $filtros = json_decode($rawInput, true) ?? $_POST;

            $handler = new SalxCobrarCtaTablaHandler($this->db);
            $resultado = $handler->obtenerDatos($filtros);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener la tabla de saldos por cuenta: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint para obtener Corporativos más Deudores por Zona Fiscal (18CorporativosZonaDeudores)
     */
    public function getCorporativosZonaDeudores()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $filtros = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerCorporativosZonaDeudores($filtros);

            echo json_encode([
                'success' => true,
                'data'    => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener corporativos por zona: ' . $e->getMessage()
            ]);
        }
        exit;
    }

}


