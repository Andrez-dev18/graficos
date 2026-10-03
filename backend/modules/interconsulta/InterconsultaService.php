<?php

require_once __DIR__ . '/graficas/sip_grafica_catalog_lib.php';
require_once __DIR__ . '/graficas/sip_grafica_data_lib.php';
require_once __DIR__ . '/graficas/sip_grafica_acumulado_semanal_lib.php';
require_once __DIR__ . '/graficas/sip_grafica_pesaje_lib.php';

class InterconsultaService
{
    private $conn;

    public function __construct($conn = null)
    {
        $this->conn = $conn;
    }

    public function setConnection($conn)
    {
        $this->conn = $conn;
    }

    public function getGranjasCampaniasGalpones(array $params = [])
    {
        if (!$this->conn) {
            return ['success' => false, 'message' => 'Sin conexión a base de datos disponible'];
        }

        $mergedParams = array_merge($params, sip_grafica_catalog_periodo_params($params));
        return sip_grafica_catalog_granjas_campanias_galpones($this->conn, $mergedParams);
    }

    public function getTiposGrafica()
    {
        return sip_grafica_catalog_tipos_grafica();
    }

    public function getPesajeDias($tipo = 'pesaje_pollo')
    {
        if (!$this->conn) {
            return ['success' => false, 'message' => 'Sin conexión a base de datos disponible'];
        }

        $tipoPesaje = trim((string)$tipo) !== '' ? trim((string)$tipo) : 'pesaje_pollo';
        return sip_grafica_catalog_pesaje_dias_disponibles($this->conn, $tipoPesaje);
    }

    public function getGraficaData(array $params = [])
    {
        if (!$this->conn) {
            return ['success' => false, 'message' => 'Sin conexión a base de datos disponible'];
        }

        $tipo = trim((string) (isset($params['tipo']) ? $params['tipo'] : 'mortalidad'));
        $granja = trim((string) (isset($params['granja']) ? $params['granja'] : ''));
        $campania = trim((string) (isset($params['campania']) ? $params['campania'] : ''));
        $galpon = trim((string) (isset($params['galpon']) ? $params['galpon'] : ''));
        $seccion = trim((string) (isset($params['seccion']) ? $params['seccion'] : 'linea'));

        if ($granja === '' || $campania === '') {
            return ['success' => false, 'message' => 'Faltan parámetros obligatorios: granja, campania'];
        }

        if (sip_grafica_catalog_requiere_galpon($tipo, $seccion) && $galpon === '') {
            return ['success' => false, 'message' => 'Falta parámetro obligatorio: galpon'];
        }

        $buildOpts = [
            'granja'   => $granja,
            'campania' => $campania,
            'galpon'   => $galpon,
        ];

        if (sip_grafica_catalog_tipo_usa_seccion($tipo)) {
            $buildOpts['seccion'] = $seccion;
        }

        return sip_grafica_build($this->conn, $tipo, $buildOpts);
    }

    public function getAcumuladoSemanal(array $params = [])
    {
        if (!$this->conn) {
            return ['success' => false, 'message' => 'Sin conexión a base de datos disponible'];
        }

        $tipo = trim((string) (isset($params['tipo']) ? $params['tipo'] : 'mortalidad'));
        $fechaInicio = trim((string) (isset($params['fechaInicio']) ? $params['fechaInicio'] : ''));
        $fechaFin = trim((string) (isset($params['fechaFin']) ? $params['fechaFin'] : ''));
        $semana = isset($params['semana']) ? (int) $params['semana'] : 0;
        $dia = isset($params['dia']) ? (int) $params['dia'] : 1;
        $tedad = sip_grafica_pesaje_dia_api_a_tedad($dia);

        if ($fechaInicio === '' || $fechaFin === '') {
            return ['success' => false, 'message' => 'Faltan parámetros obligatorios: fechaInicio, fechaFin'];
        }

        return sip_grafica_acumulado_semanal_build($this->conn, [
            'tipo'        => $tipo,
            'fechaInicio' => $fechaInicio,
            'fechaFin'    => $fechaFin,
            'semana'      => $semana,
            'dia'         => $dia,
            'tedad'       => $tedad,
        ]);
    }
}
