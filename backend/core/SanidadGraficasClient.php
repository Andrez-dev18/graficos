<?php

/**
 * Cliente HTTP hacia la API de gráficas de Sanidad (modules/sip/graficas/Http).
 *
 * Mantiene el token server-side y devuelve la carga sin envelope,
 * para que los módulos de corebi reciban la misma forma que los endpoints legacy.
 */
class SanidadGraficasClient
{
    /** Recursos permitidos: alias corto => ruta en la API de Sanidad. */
    private static $recursos = [
        'health' => 'health',
        'data' => 'graficas/data',
        'pct' => 'graficas/pct',
        'proyeccion' => 'graficas/proyeccion',
        'temperatura-bb' => 'graficas/temperatura-bb',
        'trazabilidad' => 'graficas/trazabilidad',
        'acumulado-semanal' => 'graficas/acumulado-semanal',
        'luminometria' => 'graficas/luminometria',
        'luminometria-puntos' => 'graficas/luminometria-puntos',
        'pesaje-dias' => 'graficas/pesaje-dias',
        'tipos' => 'catalogo/tipos',
        'granjas' => 'catalogo/granjas',
        'liquidaciones' => 'hc/liquidaciones',
        'liquidaciones-galpones' => 'hc/liquidaciones-galpones',
        'liquidaciones-zonas' => 'hc/zonas',
        'liquidaciones-granjas' => 'hc/granjas',
    ];

    /** @var string */
    private $baseUrl;

    /** @var string */
    private $token;

    /** @var int */
    private $timeout;

    /** @var array<string,mixed>|null */
    private $configCache = null;

    public function __construct()
    {
        $this->baseUrl = rtrim($this->resolverBaseUrl(), '/');
        $this->token = $this->resolverToken();
        $this->timeout = $this->resolverTimeout();
    }

    /** @return array<int,string> */
    public static function recursosPermitidos()
    {
        return array_keys(self::$recursos);
    }

    /**
     * @param array<string,mixed> $params
     * @return array<string,mixed>
     */
    public function recurso($alias, array $params = [])
    {
        $alias = strtolower(trim((string) $alias));
        if (!isset(self::$recursos[$alias])) {
            return [
                'success' => false,
                'message' => 'Recurso no permitido: ' . $alias,
                'recursos' => self::recursosPermitidos(),
            ];
        }
        if ($this->token === '') {
            return ['success' => false, 'message' => 'SANIDAD_API_TOKEN no configurado'];
        }

        return $this->solicitar(self::$recursos[$alias], $params);
    }

    /**
     * @param array<string,mixed> $params
     * @return array<string,mixed>
     */
    private function solicitar($ruta, array $params)
    {
        unset($params['recurso']);
        $destino = $this->baseUrl . '/' . $ruta;
        if (!empty($params)) {
            $destino .= '?' . http_build_query($params);
        }

        $ch = curl_init($destino);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->token,
                'Accept: application/json',
            ],
        ]);

        $cuerpo = curl_exec($ch);
        $codigo = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errorCurl = curl_error($ch);
        curl_close($ch);

        if ($cuerpo === false) {
            return ['success' => false, 'message' => 'Error de red hacia Sanidad: ' . $errorCurl];
        }

        $json = json_decode((string) $cuerpo, true);
        if (!is_array($json)) {
            return [
                'success' => false,
                'message' => 'Respuesta no JSON de Sanidad (HTTP ' . $codigo . ')',
                'httpStatus' => $codigo,
            ];
        }

        if (isset($json['success']) && $json['success'] === false) {
            return [
                'success' => false,
                'message' => isset($json['message']) ? (string) $json['message'] : 'Error en Sanidad',
                'httpStatus' => $codigo,
            ];
        }
        if ($codigo < 200 || $codigo >= 300) {
            return [
                'success' => false,
                'message' => 'Sanidad respondio HTTP ' . $codigo,
                'httpStatus' => $codigo,
            ];
        }

        /* Envelope de Sanidad -> carga plana para corebi */
        if (array_key_exists('data', $json) && array_key_exists('meta', $json)) {
            return is_array($json['data']) ? $json['data'] : ['success' => true, 'data' => $json['data']];
        }

        return $json;
    }

    private function resolverBaseUrl()
    {
        $env = $this->env('SANIDAD_API_BASE');
        if ($env !== '') {
            return $env;
        }

        $config = $this->configuracionHeredada();
        if (is_array($config) && !empty($config['SANIDAD_API_BASE'])) {
            return (string) $config['SANIDAD_API_BASE'];
        }

        return 'http://localhost/sanidad/modules/sip/graficas/Http';
    }

    private function resolverToken()
    {
        $env = $this->env('SANIDAD_API_TOKEN');
        if ($env !== '') {
            return $env;
        }

        if (defined('API_TOKEN')) {
            return trim((string) API_TOKEN);
        }

        $config = $this->configuracionHeredada();
        if (is_array($config) && !empty($config['SANIDAD_API_TOKEN'])) {
            return (string) $config['SANIDAD_API_TOKEN'];
        }

        /* conexion_grs/configuracion.php define API_TOKEN con el token compartido */
        $ruta = dirname(__DIR__, 3) . '/conexion_grs/configuracion.php';
        if (is_file($ruta)) {
            require_once $ruta;
            if (defined('API_TOKEN')) {
                return trim((string) API_TOKEN);
            }
        }

        return '';
    }

    private function resolverTimeout()
    {
        $env = $this->env('SANIDAD_API_TIMEOUT');
        $timeout = (int) $env;

        return $timeout > 0 ? $timeout : 120;
    }

    /** @return array<string,mixed> */
    private function configuracionHeredada()
    {
        if ($this->configCache === null) {
            $ruta = dirname(__DIR__) . '/config/.env';
            $this->configCache = is_file($ruta) ? parse_ini_file($ruta) : [];
        }

        return $this->configCache;
    }

    private function env($clave)
    {
        $valor = getenv($clave);
        if (is_string($valor) && trim($valor) !== '') {
            return trim($valor);
        }

        $config = $this->configuracionHeredada();
        if (is_array($config) && isset($config[$clave]) && trim((string) $config[$clave]) !== '') {
            return trim((string) $config[$clave]);
        }

        return '';
    }
}
