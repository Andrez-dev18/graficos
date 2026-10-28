<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/TomasDescisionesService.php';

class TomasDescisionesController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new TomasDescisionesService($this->db);
    }

    public function getFiltrosProyectadoVentas()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $data = $this->leerEntrada();
            $resultado = $this->service->obtenerFiltrosProyectadoVentas($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener filtros: ' . $e->getMessage()
            ]);
        }

        exit;
    }

    public function getProyectadoVentasIndicador()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $data = $this->leerEntrada();
            $resultado = $this->service->obtenerProyectadoVentasIndicador($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener el dashboard: ' . $e->getMessage()
            ]);
        }

        exit;
    }

    public function getTasasInteres()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $data = $this->leerEntrada();
            $resultado = $this->service->obtenerTasasInteres($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener tasas de interés: ' . $e->getMessage()
            ]);
        }

        exit;
    }

    public function getGraficasProyectadosVSReal()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $data = $this->leerEntrada();
            $resultado = $this->service->obtenerGraficasProyectadosVSReal($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener gráficas proyectadas vs real: ' . $e->getMessage()
            ]);
        }

        exit;
    }

    public function getGraficasProyectadosDias()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $data = $this->leerEntrada();
            $resultado = $this->service->obtenerGraficasProyectadosDias($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener gráficas diarias proyectadas vs real: ' . $e->getMessage()
            ]);
        }

        exit;
    }

    private function leerEntrada(): array
    {
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (!is_array($data)) {
            $data = $_POST;
        }

        return is_array($data) ? $data : [];
    }
}
