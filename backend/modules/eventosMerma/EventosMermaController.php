<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/EventosMermaService.php';

class EventosMermaController
{
    private $service;

    public function __construct()
    {
        $database = new Database();
        $db = $database->getConnection();
        $this->service = new EventosMermaService($db);
    }

    public function getFiltros()
    {
        $this->responder(function ($data = []) {
            return $this->service->obtenerFiltros();
        }, 'Error al obtener filtros de Eventos Merma: ');
    }

    public function getDashAnalisis()
    {
        $this->responder(function ($data) {
            return $this->service->obtenerDashAnalisis($data);
        }, 'Error al consultar DashAnalisis: ');
    }

    public function getListado()
    {
        $this->responder(function ($data) {
            return $this->service->obtenerListado($data);
        }, 'Error al consultar el listado de Eventos Merma: ');
    }

    public function getPorc()
    {
        $this->responder(function ($data) {
            return $this->service->obtenerPorc($data);
        }, 'Error al consultar Porc de Eventos Merma: ');
    }

    public function getPorcDia()
    {
        $this->responder(function ($data) {
            return $this->service->obtenerPorcDia($data);
        }, 'Error al consultar PorcDia de Eventos Merma: ');
    }

    public function getCantDia()
    {
        $this->responder(function ($data) {
            return $this->service->obtenerCantDia($data);
        }, 'Error al consultar CantDia de Eventos Merma: ');
    }

    public function getPareto()
    {
        $this->responder(function ($data) {
            return $this->service->obtenerPareto($data);
        }, 'Error al consultar Pareto de Eventos Merma: ');
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
