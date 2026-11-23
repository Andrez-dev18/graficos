<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/ConsumoLimaService.php';

class ConsumoLimaController
{
    private $service;

    public function __construct()
    {
        $database = new Database();
        $db = $database->getConnection();
        $this->service = new ConsumoLimaService($db);
    }

    public function getFiltros()
    {
        $this->responder(function ($data = []) {
            return $this->service->obtenerFiltros();
        }, 'Error al obtener filtros de Consumo Lima: ');
    }

    public function getConsumos()
    {
        $this->responder(function ($data) {
            return $this->service->obtenerConsumos($data);
        }, 'Error al consultar Consumos de Consumo Lima: ');
    }

    public function getComprasAlmacen()
    {
        $this->responder(function ($data) {
            return $this->service->obtenerComprasAlmacen($data);
        }, 'Error al consultar ComprasAlmacen de Consumo Lima: ');
    }

    public function getComprasDocumentos()
    {
        $this->responder(function ($data) {
            return $this->service->obtenerComprasDocumentos($data);
        }, 'Error al consultar ComprasDocumentos de Consumo Lima: ');
    }

    public function getTabulacionesPu()
    {
        $this->responder(function ($data) {
            return $this->service->obtenerTabulacionesPu($data);
        }, 'Error al consultar Tabulaciones de PU de Consumo Lima: ');
    }

    public function getAnalisisMermas()
    {
        $this->responder(function ($data) {
            return $this->service->obtenerAnalisisMermas($data);
        }, 'Error al consultar AnalisisMermas de Consumo Lima: ');
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
