<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/AnalisisPT0Service.php';

class AnalisisPT0Controller
{
    private $database;

    public function __construct()
    {
        $this->database = new Database();
    }

    private function resolverAnio($valor): string
    {
        $anio = trim((string)$valor);

        if ($anio === '') {
            return '2026';
        }

        if (!in_array($anio, ['2025', '2026'], true)) {
            throw new InvalidArgumentException('Año no válido. Usa 2025 o 2026.');
        }

        return $anio;
    }

    private function crearService(string $anio): AnalisisPT0Service
    {
        $db = $this->database->getConnectionForYear($anio);
        return new AnalisisPT0Service($db, $anio);
    }

    public function getFiltros()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $anio = $this->resolverAnio($_GET['anio'] ?? '2026');
            $service = $this->crearService($anio);
            $resultado = $service->obtenerFiltros();

            echo json_encode([
                'success' => true,
                'status'  => 'success',
                'anio'    => $anio,
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
                'message' => 'Error al cargar filtros de AnalisisPT0: ' . $e->getMessage()
            ]);
        }

        exit;
    }

    public function getDashboard()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            if (!is_array($data)) {
                $data = [];
            }

            $anio = $this->resolverAnio($data['anio'] ?? '2026');
            $data['anio'] = $anio;

            $service = $this->crearService($anio);
            $resultado = $service->obtenerDashboard($data);

            echo json_encode([
                'success' => true,
                'status'  => 'success',
                'anio'    => $anio,
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
                'message' => 'Error al cargar AnalisisPT0: ' . $e->getMessage()
            ]);
        }

        exit;
    }
}
