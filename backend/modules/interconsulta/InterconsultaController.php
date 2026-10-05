<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/InterconsultaService.php';

class InterconsultaController
{
    private $database;
    private $service;

    public function __construct()
    {
        $this->database = new Database();
        $conn = $this->database->getMysqliConnection('joya');
        if (!$conn) {
            $conn = $this->database->getMysqliConnection('principal');
        }
        $this->service = new InterconsultaService($conn);
    }

    public function getGranjasCampaniasGalpones()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $params = array_merge($_GET, $_POST);
            $rawInput = file_get_contents('php://input');
            if ($rawInput) {
                $decoded = json_decode($rawInput, true);
                if (is_array($decoded)) {
                    $params = array_merge($params, $decoded);
                }
            }

            $resultado = $this->service->getGranjasCampaniasGalpones($params);
            echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al cargar catálogo de granjas: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al cargar catálogo de granjas: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }

    public function getTiposGrafica()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $resultado = $this->service->getTiposGrafica();
            echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al cargar tipos de gráfica: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al cargar tipos de gráfica: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }

    public function getPesajeDias()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $tipo = isset($_GET['tipo']) ? $_GET['tipo'] : (isset($_POST['tipo']) ? $_POST['tipo'] : 'pesaje_pollo');
            $resultado = $this->service->getPesajeDias((string) $tipo);
            echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al cargar días de pesaje: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al cargar días de pesaje: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }

    public function getGraficaData()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $params = array_merge($_GET, $_POST);
            $rawInput = file_get_contents('php://input');
            if ($rawInput) {
                $decoded = json_decode($rawInput, true);
                if (is_array($decoded)) {
                    $params = array_merge($params, $decoded);
                }
            }

            $resultado = $this->service->getGraficaData($params);
            if (isset($resultado['success']) && !$resultado['success']) {
                http_response_code(400);
            }
            echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener datos de gráfica: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener datos de gráfica: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }

    public function getAcumuladoSemanal()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $params = array_merge($_GET, $_POST);
            $rawInput = file_get_contents('php://input');
            if ($rawInput) {
                $decoded = json_decode($rawInput, true);
                if (is_array($decoded)) {
                    $params = array_merge($params, $decoded);
                }
            }

            $resultado = $this->service->getAcumuladoSemanal($params);
            if (isset($resultado['success']) && !$resultado['success']) {
                http_response_code(400);
            }
            echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener acumulado semanal: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener acumulado semanal: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }

    public function getLuminometriaPuntos()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $params = array_merge($_GET, $_POST);
            $rawInput = file_get_contents('php://input');
            if ($rawInput) {
                $decoded = json_decode($rawInput, true);
                if (is_array($decoded)) {
                    $params = array_merge($params, $decoded);
                }
            }

            $resultado = $this->service->getLuminometriaPuntos($params);
            echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener puntos de luminometría: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener puntos de luminometría: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }

    public function getProyeccion()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $params = array_merge($_GET, $_POST);
            $rawInput = file_get_contents('php://input');
            if ($rawInput) {
                $decoded = json_decode($rawInput, true);
                if (is_array($decoded)) {
                    $params = array_merge($params, $decoded);
                }
            }

            $resultado = $this->service->getProyeccion($params);
            echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener proyección: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener proyección: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }

    public function getPct()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $params = array_merge($_GET, $_POST);
            $rawInput = file_get_contents('php://input');
            if ($rawInput) {
                $decoded = json_decode($rawInput, true);
                if (is_array($decoded)) {
                    $params = array_merge($params, $decoded);
                }
            }

            $resultado = $this->service->getPct($params);
            echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener PCT: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al obtener PCT: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }

    public function exportarPdf()
    {
        $pdfScript = __DIR__ . '/reportePDF/reporte_graficos_pdf.php';
        if (file_exists($pdfScript)) {
            require $pdfScript;
        } else {
            http_response_code(404);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'message' => 'Script de reporte PDF no encontrado'], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }
}
