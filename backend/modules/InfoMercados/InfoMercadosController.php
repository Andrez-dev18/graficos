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

    public function getAqpCantEmpresaFiltros()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $anio = isset($_GET['anio']) ? trim((string)$_GET['anio']) : '2026';

            if ($anio !== '2026') {
                throw new InvalidArgumentException('Año no válido. Este gráfico solo está disponible para 2026.');
            }

            $resultado = $this->service->obtenerAqpCantEmpresaFiltros($anio);

            echo json_encode([
                'success' => true,
                'status'  => 'success',
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
                'message' => 'Error al cargar filtros de AQPCantEmpresa: ' . $e->getMessage()
            ]);
        }

        exit;
    }

    public function getAqpCantEmpresaDashboard()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            if (!is_array($data)) {
                $data = [];
            }

            $anio = isset($data['anio']) ? trim((string)$data['anio']) : '2026';

            if ($anio !== '2026') {
                throw new InvalidArgumentException('Año no válido. Este gráfico solo está disponible para 2026.');
            }

            $resultado = $this->service->obtenerAqpCantEmpresa($data, $anio);

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
                'message' => 'Error al cargar AQPCantEmpresa: ' . $e->getMessage()
            ]);
        }

        exit;
    }

    public function getAqpEmpresaFiltros()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $anio = isset($_GET['anio']) ? trim((string)$_GET['anio']) : '2026';

            if ($anio !== '2026') {
                throw new InvalidArgumentException('Año no válido. Los gráficos AQP solo están disponibles para 2026.');
            }

            $resultado = $this->service->obtenerAqpEmpresaFiltros($anio);

            echo json_encode([
                'success' => true,
                'status'  => 'success',
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
                'message' => 'Error al cargar filtros de AQPEmpresa: ' . $e->getMessage()
            ]);
        }

        exit;
    }

    public function getAqpEmpresaDashboard()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            if (!is_array($data)) {
                $data = [];
            }

            $anio = isset($data['anio']) ? trim((string)$data['anio']) : '2026';

            if ($anio !== '2026') {
                throw new InvalidArgumentException('Año no válido. Los gráficos AQP solo están disponibles para 2026.');
            }

            $permitidos = [
                'AQPCantEmpresa',
                'AQPPesoEmpresa',
                'AQPKilosEmpresa',
                'AQPSolesEmpresa',
                'AQPPrecioEmpresa'
            ];
            $tipoGrafico = isset($data['tipo_grafico']) ? trim((string)$data['tipo_grafico']) : 'AQPCantEmpresa';

            if (!in_array($tipoGrafico, $permitidos, true)) {
                throw new InvalidArgumentException('Tipo de gráfico AQP no válido.');
            }

            $data['tipo_grafico'] = $tipoGrafico;
            $resultado = $this->service->obtenerAqpEmpresa($data, $anio);

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
                'message' => 'Error al cargar AQPEmpresa: ' . $e->getMessage()
            ]);
        }

        exit;
    }

    public function getProvEmpresaFiltros()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $anio = isset($_GET['anio']) ? trim((string)$_GET['anio']) : '2026';

            if ($anio !== '2026') {
                throw new InvalidArgumentException('Año no válido. Los gráficos PROV solo están disponibles para 2026.');
            }

            $resultado = $this->service->obtenerProvEmpresaFiltros($anio);

            echo json_encode([
                'success' => true,
                'status'  => 'success',
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
                'message' => 'Error al cargar filtros de PROVEmpresa: ' . $e->getMessage()
            ]);
        }

        exit;
    }

    public function getProvEmpresaDashboard()
    {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            if (!is_array($data)) {
                $data = [];
            }

            $anio = isset($data['anio']) ? trim((string)$data['anio']) : '2026';

            if ($anio !== '2026') {
                throw new InvalidArgumentException('Año no válido. Los gráficos PROV solo están disponibles para 2026.');
            }

            $permitidos = [
                'PROVCantEmpresa',
                'PROVPesoEmpresa',
                'PROVKilosEmpresa',
                'PROVSolesEmpresa',
                'PROVPrecioEmpresa'
            ];
            $tipoGrafico = isset($data['tipo_grafico']) ? trim((string)$data['tipo_grafico']) : 'PROVCantEmpresa';

            if (!in_array($tipoGrafico, $permitidos, true)) {
                throw new InvalidArgumentException('Tipo de gráfico PROV no válido.');
            }

            $data['tipo_grafico'] = $tipoGrafico;
            $resultado = $this->service->obtenerProvEmpresa($data, $anio);

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
                'message' => 'Error al cargar PROVEmpresa: ' . $e->getMessage()
            ]);
        }

        exit;
    }
}
