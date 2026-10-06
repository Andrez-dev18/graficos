<?php
/**
 * Controlador de Temperatura y Datalogger para CoreBI.
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/TemperaturaService.php';

class TemperaturaController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new TemperaturaService($this->db);
    }

    private function getRequestParams()
    {
        $params = array_merge($_GET, $_POST);
        $rawInput = file_get_contents('php://input');
        if ($rawInput) {
            $decoded = json_decode($rawInput, true);
            if (is_array($decoded)) {
                $params = array_merge($params, $decoded);
            }
        }
        return $params;
    }

    private function sendJsonResponse($data, $statusCode = 200)
    {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    /**
     * Dispatcher universal para compatibilidad con llamadas tipo action=...
     */
    public function crud()
    {
        $params = $this->getRequestParams();
        $action = isset($params['action']) ? trim((string)$params['action']) : '';

        try {
            switch ($action) {
                case 'upload_limits':
                    $this->sendJsonResponse($this->service->getUploadLimits());
                    break;
                case 'granjas':
                    $this->sendJsonResponse($this->service->getGranjas());
                    break;
                case 'list_groups':
                case 'list':
                    $this->sendJsonResponse($this->service->listGroups($params));
                    break;
                case 'consulta_meta':
                    $this->sendJsonResponse($this->service->getConsultaMeta($params));
                    break;
                case 'consulta_campanias_periodo':
                    $this->sendJsonResponse($this->service->getConsultaCampaniasPeriodo($params));
                    break;
                case 'consulta_datos':
                    $this->sendJsonResponse($this->service->getConsultaDatos($params));
                    break;
                case 'list_group_detail':
                    $this->sendJsonResponse($this->service->listGroupDetail($params));
                    break;
                case 'actualizar_galpon':
                    $this->sendJsonResponse($this->service->actualizarGalpon($params));
                    break;
                case 'delete_group':
                case 'delete':
                    $this->sendJsonResponse($this->service->deleteGroup($params));
                    break;
                default:
                    $this->sendJsonResponse(['success' => false, 'message' => "Acción desconocida: '{$action}'"], 400);
            }
        } catch (Exception $e) {
            $this->sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
        } catch (Throwable $e) {
            $this->sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getGranjas()
    {
        $this->sendJsonResponse($this->service->getGranjas());
    }

    public function getUploadLimits()
    {
        $this->sendJsonResponse($this->service->getUploadLimits());
    }

    public function listGroups()
    {
        $params = $this->getRequestParams();
        $this->sendJsonResponse($this->service->listGroups($params));
    }

    public function getConsultaMeta()
    {
        $params = $this->getRequestParams();
        $this->sendJsonResponse($this->service->getConsultaMeta($params));
    }

    public function getConsultaCampaniasPeriodo()
    {
        $params = $this->getRequestParams();
        $this->sendJsonResponse($this->service->getConsultaCampaniasPeriodo($params));
    }

    public function getConsultaDatos()
    {
        $params = $this->getRequestParams();
        $this->sendJsonResponse($this->service->getConsultaDatos($params));
    }

    public function listGroupDetail()
    {
        $params = $this->getRequestParams();
        $this->sendJsonResponse($this->service->listGroupDetail($params));
    }

    public function actualizarGalpon()
    {
        $params = $this->getRequestParams();
        $this->sendJsonResponse($this->service->actualizarGalpon($params));
    }

    public function deleteGroup()
    {
        $params = $this->getRequestParams();
        $this->sendJsonResponse($this->service->deleteGroup($params));
    }
}