<?php

require_once __DIR__ . '/ProduccionAvesService.php';

/**
 * Gráficos de Sanidad expuestos en la sección Producción Aves.
 */
class ProduccionAvesController
{
    private $service;

    public function __construct()
    {
        $this->service = new ProduccionAvesService();
    }

    public function getTipos()
    {
        $this->responder('tipos');
    }

    public function getGranjas()
    {
        $this->responder('granjas');
    }

    public function getGraficas()
    {
        $recurso = $this->parametro('recurso', 'data');
        $this->responder($recurso);
    }

    public function getRecursos()
    {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => true,
            'recursos' => $this->service->recursos(),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    private function responder($recurso)
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

            $resultado = $this->service->graficas($recurso, $params);
            if (isset($resultado['success']) && !$resultado['success']) {
                http_response_code(502);
            }
            echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al consultar gráficas de Sanidad: ' . $e->getMessage(),
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al consultar gráficas de Sanidad: ' . $e->getMessage(),
            ], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }

    private function parametro($clave, $porDefecto = '')
    {
        if (isset($_GET[$clave]) && trim((string) $_GET[$clave]) !== '') {
            return trim((string) $_GET[$clave]);
        }
        if (isset($_POST[$clave]) && trim((string) $_POST[$clave]) !== '') {
            return trim((string) $_POST[$clave]);
        }

        return $porDefecto;
    }
}
