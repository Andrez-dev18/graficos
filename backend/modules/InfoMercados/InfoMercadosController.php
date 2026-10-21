<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/InfoMercadosService.php';

class InfoMercadosController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new InfoMercadosService($this->db);
    }

    public function getVolSemanal()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $anio = isset($_GET['anio']) ? trim((string)$_GET['anio']) : '2026';

            if ($anio !== '2026') {
                throw new InvalidArgumentException('Año no válido. Este gráfico solo está disponible para 2026.');
            }

            $resultado = $this->service->obtenerVolSemanal($anio);

            echo json_encode([
                'success' => true,
                'status'  => 'success',
                'payload' => $resultado,
                'data'    => $resultado
            ]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => $e->getMessage()
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al cargar VolSemanal de InfoMercados: ' . $e->getMessage()
            ]);
        }

        exit;
    }
}
