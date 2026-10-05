<?php

require_once __DIR__ . '/graficas/sip_grafica_catalog_lib.php';
require_once __DIR__ . '/graficas/sip_grafica_data_lib.php';
require_once __DIR__ . '/graficas/sip_grafica_acumulado_semanal_lib.php';
require_once __DIR__ . '/graficas/sip_grafica_pesaje_lib.php';
require_once __DIR__ . '/graficas/sip_grafica_luminometria_lib.php';
require_once __DIR__ . '/graficas/sip_grafica_proyeccion_lib.php';
require_once __DIR__ . '/graficas/sip_grafica_pct_lib.php';

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
        $tipoPesaje = trim((string)$tipo) !== '' ? trim((string)$tipo) : 'pesaje_pollo';
        if (function_exists('sip_grafica_pesaje_dias_build')) {
            return sip_grafica_pesaje_dias_build($tipoPesaje);
        }
        if (function_exists('sip_grafica_catalog_pesaje_dias_disponibles')) {
            return sip_grafica_catalog_pesaje_dias_disponibles($this->conn, $tipoPesaje);
        }
        return ['success' => true, 'dias' => []];
    }

    public function getLuminometriaPuntos()
    {
        if (!$this->conn) {
            return ['success' => false, 'message' => 'Sin conexión a base de datos disponible'];
        }

        $result = sip_grafica_lum_puntos_catalog($this->conn);
        if (function_exists('lum_sql_error') && lum_sql_error() !== '') {
            $result['sqlError'] = lum_sql_error();
        }
        return $result;
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
        $origen = trim((string) (isset($params['origen']) ? $params['origen'] : ''));
        $sexo = function_exists('sip_grafica_sexo_param_norm') ? sip_grafica_sexo_param_norm((string) ($params['sexo'] ?? 'ambos')) : ($params['sexo'] ?? 'ambos');

        if ($granja === '' || $campania === '') {
            return ['success' => false, 'message' => 'Faltan parámetros obligatorios: granja, campania'];
        }

        if (sip_grafica_catalog_requiere_galpon($tipo, $seccion) && $galpon === '') {
            return ['success' => false, 'message' => 'Falta parámetro obligatorio: galpon'];
        }

        $buildOpts = [
            'granja'      => $granja,
            'campania'    => $campania,
            'galpon'      => $galpon,
            'origen'      => $origen,
            'sexo'        => $sexo,
            'fechaInicio' => trim((string) ($params['fechaInicio'] ?? '')),
            'fechaFin'    => trim((string) ($params['fechaFin'] ?? '')),
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
        $esLuminometria = strtolower($tipo) === 'luminometria';

        $diasParam = $params['dias'] ?? null;
        $dias = [];
        if (is_array($diasParam)) {
            foreach ($diasParam as $dv) {
                $dias[] = (int) $dv;
            }
        } elseif (is_string($diasParam) && trim($diasParam) !== '') {
            foreach (explode(',', $diasParam) as $dv) {
                $dias[] = (int) $dv;
            }
        }

        if ($fechaInicio === '' || $fechaFin === '') {
            return ['success' => false, 'message' => 'Faltan parámetros obligatorios: fechaInicio, fechaFin'];
        }

        $buildOpts = [
            'tipo'        => $tipo,
            'fechaInicio' => $fechaInicio,
            'fechaFin'    => $fechaFin,
            'semana'      => $semana,
            'dia'         => $dia,
            'tedad'       => $tedad,
            'dias'        => $dias,
        ];

        if ($esLuminometria) {
            $buildOpts['modo'] = $params['modo'] ?? $params['agrupacion'] ?? 'subzona';
            $buildOpts['location'] = $params['location'] ?? $params['punto'] ?? '';
        }

        return sip_grafica_acumulado_semanal_build($this->conn, $buildOpts);
    }

    public function getProyeccion(array $params = [])
    {
        if (!$this->conn) {
            return ['success' => false, 'message' => 'Sin conexión a base de datos disponible'];
        }

        $tipo = trim((string) (isset($params['tipo']) ? $params['tipo'] : 'pesaje_pollo'));
        $granja = trim((string) (isset($params['granja']) ? $params['granja'] : ''));
        $campania = trim((string) (isset($params['campania']) ? $params['campania'] : ''));
        $galpon = trim((string) (isset($params['galpon']) ? $params['galpon'] : ''));
        $seccion = trim((string) (isset($params['seccion']) ? $params['seccion'] : 'linea'));
        $origen = trim((string) (isset($params['origen']) ? $params['origen'] : ''));
        $sexo = function_exists('sip_grafica_sexo_param_norm') ? sip_grafica_sexo_param_norm((string) ($params['sexo'] ?? 'ambos')) : ($params['sexo'] ?? 'ambos');

        if ($granja === '' || $campania === '') {
            return ['success' => false, 'message' => 'Faltan parámetros obligatorios: granja, campania'];
        }

        if (!function_exists('sip_grafica_proyeccion_soporta') || !sip_grafica_proyeccion_soporta($tipo)) {
            return [
                'success' => false,
                'soporta' => false,
                'tipo' => strtolower(trim($tipo)),
                'dataProyeccion' => null,
                'message' => 'Tipo sin proyeccion',
            ];
        }

        $buildOpts = [
            'granja'   => $granja,
            'campania' => $campania,
            'galpon'   => $galpon,
            'origen'   => $origen,
            
            'sexo'     => $sexo,
        ];
        if (function_exists('sip_grafica_catalog_tipo_usa_seccion') && sip_grafica_catalog_tipo_usa_seccion($tipo)) {
            $buildOpts['seccion'] = $seccion;
        }

        $result = sip_grafica_build($this->conn, $tipo, $buildOpts);
        if (!is_array($result) || !($result['success'] ?? false)) {
            return [
                'success' => false,
                'soporta' => true,
                'tipo' => strtolower(trim($tipo)),
                'dataProyeccion' => null,
                'message' => (string) ($result['message'] ?? 'Sin datos para esa combinacion'),
            ];
        }

        if (!function_exists('sip_grafica_normalize_granja_campania')) {
            require_once __DIR__ . '/graficas/sip_grafica_std_lib.php';
        }
        [$granja3, $campania3, $galBind, $galBind2] = sip_grafica_normalize_granja_campania($granja, $campania, $galpon);
        $campaniaAbierta = function_exists('sip_grafica_campania_abierta') ? sip_grafica_campania_abierta($this->conn, $granja3, $campania3, $galBind, $galBind2) : true;

        if (!$campaniaAbierta) {
            return [
                'success' => true,
                'soporta' => true,
                'tipo' => strtolower(trim($tipo)),
                'campaniaAbierta' => false,
                'dataProyeccion' => null,
            ];
        }

        $result = sip_grafica_result_adjuntar_proyeccion($result, $this->conn, $tipo, $buildOpts);

        return [
            'success' => true,
            'soporta' => true,
            'tipo' => strtolower(trim($tipo)),
            'campaniaAbierta' => true,
            'dataProyeccion' => $result['dataProyeccion'] ?? null,
            'dataEstandar' => $result['dataEstandar'] ?? null,
        ];
    }

    public function getPct(array $params = [])
    {
        if (!$this->conn) {
            return ['success' => false, 'message' => 'Sin conexión a base de datos disponible'];
        }

        $tipo = trim((string) (isset($params['tipo']) ? $params['tipo'] : 'mortalidad'));
        $granja = trim((string) (isset($params['granja']) ? $params['granja'] : ''));
        $campania = trim((string) (isset($params['campania']) ? $params['campania'] : ''));
        $galpon = trim((string) (isset($params['galpon']) ? $params['galpon'] : ''));

        if ($granja === '' || $campania === '') {
            return ['success' => false, 'message' => 'Faltan parámetros obligatorios: granja, campania'];
        }

        if (function_exists('sip_grafica_pct_build')) {
            return sip_grafica_pct_build($this->conn, $tipo, [
                'granja'   => $granja,
                'campania' => $campania,
                'galpon'   => $galpon,
            ]);
        }

        return ['success' => false, 'message' => 'Libreria PCT no disponible'];
    }
}
