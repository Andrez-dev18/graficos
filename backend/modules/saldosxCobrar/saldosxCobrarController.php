<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/saldosxCobrarService.php';

class saldosxCobrarController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
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
}
